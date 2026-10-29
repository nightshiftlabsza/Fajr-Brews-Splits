/** @vitest-environment jsdom */

import { describe, expect, it, vi } from 'vitest';
import type { Order, Person } from '../types';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockImplementation((payload: any) => ({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: payload.id || '11111111-2222-3333-4444-555555555555',
              workspace_id: payload.workspace_id,
              name: payload.name,
              order_date: payload.order_date,
              status: payload.status,
              roaster_id: payload.roaster_id,
              roaster_snapshot: payload.roaster_snapshot,
              payer_id: payload.payer_id,
              payer_bank: payload.payer_bank,
              reference_template: payload.reference_template,
              payer_note: payload.payer_note,
              goods_total_zar: String(payload.goods_total_zar ?? 0),
              lots: payload.lots,
              fees: payload.fees,
              payments: payload.payments,
              is_archived: payload.is_archived,
              list_currency: payload.list_currency,
              created_at: '2026-03-20T10:00:00.000Z',
              updated_at: '2026-03-20T10:00:00.000Z',
            },
            error: null,
          }),
        }),
      })),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    }),
    removeChannel: vi.fn(),
  },
  WORKSPACE_ID: 'a1b2c3d4-0000-0000-0000-000000000001',
}));

describe('importJSON hardening against hostile inputs', () => {
  it('throws before writing anything when file structure is malformed', async () => {
    const { useAppStore } = await import('./appStore');

    // Not valid JSON
    await expect(useAppStore.getState().importJSON('{ invalid json')).rejects.toThrow(
      'Invalid backup file. Expected a valid JSON object.'
    );

    // Array instead of object
    await expect(useAppStore.getState().importJSON(JSON.stringify([1, 2, 3]))).rejects.toThrow(
      'Invalid backup file. Expected a JSON object.'
    );

    // Invalid version
    await expect(useAppStore.getState().importJSON(JSON.stringify({ version: '99', orders: [] }))).rejects.toThrow(
      'Unsupported export format. Expected version 1 or 2.'
    );

    // Orders is not an array
    await expect(useAppStore.getState().importJSON(JSON.stringify({ version: '2', orders: 'not-array' }))).rejects.toThrow(
      'Invalid backup file. The orders field must be a list.'
    );
  });

  it('skips orders with hostile or invalid IDs and imports valid orders without aborting', async () => {
    const { useAppStore } = await import('./appStore');
    useAppStore.setState({ orders: [] });

    const hostileBackup = JSON.stringify({
      version: '2',
      people: [],
      roasters: [],
      orders: [
        {
          id: "'; DROP TABLE orders; --",
          name: 'SQL Injection Attempt',
          orderDate: '2026-03-20',
          status: 'planning',
          goodsTotalZar: 100,
          lots: [],
          fees: [],
          payments: {},
        },
        {
          id: '<script>alert("xss")</script>',
          name: 'XSS Attempt',
          orderDate: '2026-03-20',
          status: 'planning',
          goodsTotalZar: 200,
          lots: [],
          fees: [],
          payments: {},
        },
        {
          id: '12345678-1234-1234-1234-123456789abc',
          name: 'Legitimate Order',
          orderDate: '2026-03-20',
          status: 'planning',
          goodsTotalZar: 350,
          lots: [],
          fees: [],
          payments: {},
        },
      ],
      settings: {},
    });

    const result = await useAppStore.getState().importJSON(hostileBackup);

    expect(result.importedCount).toBe(1);
    expect(result.skippedCount).toBe(2);
    expect(result.reasons).toContain('invalid ID');
    expect(result.summary).toBe('Imported 1, skipped 2: invalid ID.');

    // Only legitimate order exists in store
    const storeOrders = useAppStore.getState().orders;
    expect(storeOrders.find((o) => o.name === 'Legitimate Order')).toBeDefined();
    expect(storeOrders.find((o) => o.name === 'SQL Injection Attempt')).toBeUndefined();
    expect(storeOrders.find((o) => o.name === 'XSS Attempt')).toBeUndefined();
  });

  it('caps excessively long strings and drops unknown listCurrency without failing', async () => {
    const { useAppStore } = await import('./appStore');
    useAppStore.setState({ orders: [] });

    const longName = 'A'.repeat(500); // 500 chars, limit is 100
    const longNote = 'B'.repeat(5000); // 5000 chars, limit is 1000

    const backup = JSON.stringify({
      version: '2',
      people: [],
      roasters: [],
      orders: [
        {
          id: '99999999-8888-7777-6666-555555555555',
          name: longName,
          orderDate: '2026-03-20',
          status: 'planning',
          payerNote: longNote,
          listCurrency: 'UNKNOWN_CURRENCY_CODE',
          goodsTotalZar: 500,
          lots: [],
          fees: [],
          payments: {},
        },
      ],
      settings: {},
    });

    const result = await useAppStore.getState().importJSON(backup);

    expect(result.importedCount).toBe(1);
    expect(result.skippedCount).toBe(0);

    const imported = useAppStore.getState().orders.find((o) => o.id === '99999999-8888-7777-6666-555555555555');
    expect(imported).toBeDefined();
    expect(imported?.name.length).toBeLessThanOrEqual(100);
    expect(imported?.payerNote?.length).toBeLessThanOrEqual(1000);
    // Unknown currency was dropped
    expect(imported?.listCurrency).toBeUndefined();
  });

  it('skips invalid person and roaster entries while importing valid ones', async () => {
    const { useAppStore } = await import('./appStore');
    useAppStore.setState({ accessStatus: 'member', people: [], roasters: [] });

    const backup = JSON.stringify({
      version: '2',
      people: [
        { id: 'p-1', name: '   ' }, // empty name -> skipped
        { id: 'p-2', name: 'Valid Person', phone: '0821234567' },
      ],
      roasters: [
        { id: 'r-1', name: '' }, // empty name -> skipped
        { id: 'r-2', name: 'Valid Roaster' },
      ],
      orders: [],
      settings: {},
    });

    const result = await useAppStore.getState().importJSON(backup);

    expect(result.importedCount).toBe(2); // 1 person + 1 roaster
    expect(result.skippedCount).toBe(2);
    expect(result.reasons).toEqual(expect.arrayContaining(['person missing name', 'roaster missing name']));
  });
});
