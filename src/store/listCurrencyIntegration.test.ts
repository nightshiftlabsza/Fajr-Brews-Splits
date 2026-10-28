/** @vitest-environment jsdom */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { DbOrder, Order } from '../types';
import { createDuplicatedOrderPayload } from '../lib/orderWizard';

const testLocalStorage = (() => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    get length() {
      return store.size;
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: testLocalStorage,
  configurable: true,
  writable: true,
});
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: testLocalStorage,
    configurable: true,
    writable: true,
  });
}

function makeMockSupabase(initialOrders: DbOrder[] = []) {
  let storedOrders = [...initialOrders];

  const makeQueryBuilder = (resolveDataFn: () => any) => {
    const builder: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockImplementation(() => Promise.resolve({ data: resolveDataFn(), error: null })),
      single: vi.fn().mockImplementation(() => Promise.resolve({ data: resolveDataFn(), error: null })),
      then: (onfulfilled: any, onrejected: any) =>
        Promise.resolve({ data: resolveDataFn(), error: null }).then(onfulfilled, onrejected),
    };
    return builder;
  };

  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            user: {
              id: 'test-user-id',
              email: 'test@example.com',
            },
          },
        },
        error: null,
      }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    rpc: vi.fn().mockImplementation((name: string) => {
      if (name === 'resolve_my_person_link') {
        return Promise.resolve({
          data: { status: 'none', linkedPersonId: null, matchedBy: null, person: null, candidates: [] },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    }),
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'orders') {
        const builder = makeQueryBuilder(() => storedOrders);
        builder.insert = vi.fn().mockImplementation((payload: any) => {
          const newRow: DbOrder = {
            id: payload.id || `order-${Math.random().toString(36).slice(2, 8)}`,
            workspace_id: payload.workspace_id,
            name: payload.name,
            order_date: payload.order_date,
            status: payload.status,
            roaster_id: payload.roaster_id ?? null,
            roaster_snapshot: payload.roaster_snapshot ?? null,
            payer_id: payload.payer_id ?? null,
            payer_bank: payload.payer_bank ?? { bankName: '', accountNumber: '', beneficiary: '' },
            reference_template: payload.reference_template ?? 'FAJR-{ORDER}-{NAME}',
            payer_note: payload.payer_note ?? null,
            goods_total_zar: payload.goods_total_zar ?? 0,
            lots: payload.lots ?? [],
            fees: payload.fees ?? [],
            payments: payload.payments ?? {},
            is_archived: payload.is_archived ?? false,
            list_currency: payload.list_currency ?? null,
            owner_id: payload.owner_id ?? null,
            created_by: payload.created_by ?? null,
            created_at: '2026-03-20T00:00:00.000Z',
            updated_at: '2026-03-20T00:00:00.000Z',
          };
          storedOrders.push(newRow);
          return {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: newRow, error: null }),
            }),
          };
        });
        builder.update = vi.fn().mockImplementation((payload: any) => ({
          eq: vi.fn().mockImplementation((field: string, val: string) => {
            storedOrders = storedOrders.map((o) => (o.id === val ? { ...o, ...payload } : o));
            return Promise.resolve({ error: null });
          }),
        }));
        builder.delete = vi.fn().mockImplementation(() => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }));
        return builder;
      }
      if (table === 'workspace_members') {
        return makeQueryBuilder(() => ({ role: 'owner' }));
      }
      if (table === 'people' || table === 'roasters') {
        const builder = makeQueryBuilder(() => []);
        builder.insert = vi.fn().mockImplementation((payload: any) => ({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'p-1', ...payload, created_at: '2026-03-20', updated_at: '2026-03-20' },
              error: null,
            }),
          }),
        }));
        return builder;
      }
      if (table === 'user_settings') {
        const builder = makeQueryBuilder(() => null);
        builder.upsert = vi.fn().mockResolvedValue({ error: null });
        return builder;
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn(),
    }),
    removeChannel: vi.fn(),
    setStoredOrders: (orders: DbOrder[]) => {
      storedOrders = [...orders];
    },
  };
}

describe('listCurrency integration in appStore', () => {
  let mockSupabase: ReturnType<typeof makeMockSupabase>;

  beforeEach(() => {
    testLocalStorage.clear();
    mockSupabase = makeMockSupabase();
    vi.doMock('../lib/supabase', () => ({
      WORKSPACE_ID: 'ws-1',
      supabase: mockSupabase,
    }));
  });

  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('maps list_currency from DB row to Order.listCurrency on initialize', async () => {
    const dbOrder: DbOrder = {
      id: 'order-eur-1',
      workspace_id: 'ws-1',
      name: 'April Drop',
      order_date: '2026-04-01',
      status: 'planning',
      roaster_id: null,
      roaster_snapshot: null,
      payer_id: null,
      payer_bank: { bankName: '', accountNumber: '', beneficiary: '' },
      reference_template: 'FAJR-{ORDER}-{NAME}',
      payer_note: null,
      goods_total_zar: 500,
      lots: [],
      fees: [],
      payments: {},
      is_archived: false,
      list_currency: 'EUR',
      owner_id: null,
      created_by: null,
      created_at: '2026-04-01T00:00:00.000Z',
      updated_at: '2026-04-01T00:00:00.000Z',
    };

    mockSupabase.setStoredOrders([dbOrder]);

    const { useAppStore } = await import('./appStore');
    await useAppStore.getState().initialize();

    const order = useAppStore.getState().orders.find((o) => o.id === 'order-eur-1');
    expect(order).toBeDefined();
    expect(order?.listCurrency).toBe('EUR');
  });

  it('leaves listCurrency undefined when DB row has null or empty list_currency', async () => {
    const dbOrder: DbOrder = {
      id: 'order-plain-1',
      workspace_id: 'ws-1',
      name: 'Plain Legacy Order',
      order_date: '2026-04-01',
      status: 'planning',
      roaster_id: null,
      roaster_snapshot: null,
      payer_id: null,
      payer_bank: { bankName: '', accountNumber: '', beneficiary: '' },
      reference_template: 'FAJR-{ORDER}-{NAME}',
      payer_note: null,
      goods_total_zar: 500,
      lots: [],
      fees: [],
      payments: {},
      is_archived: false,
      list_currency: null,
      owner_id: null,
      created_by: null,
      created_at: '2026-04-01T00:00:00.000Z',
      updated_at: '2026-04-01T00:00:00.000Z',
    };

    mockSupabase.setStoredOrders([dbOrder]);

    const { useAppStore } = await import('./appStore');
    await useAppStore.getState().initialize();

    const order = useAppStore.getState().orders.find((o) => o.id === 'order-plain-1');
    expect(order).toBeDefined();
    expect(order?.listCurrency).toBeUndefined();
  });

  it('creates order with user last currency choice from local storage or EUR default', async () => {
    testLocalStorage.setItem('fb_last_list_currency', 'GBP');

    const { useAppStore } = await import('./appStore');
    await useAppStore.getState().initialize();

    const created = await useAppStore.getState().createOrder({
      name: 'May Drop',
      orderDate: '2026-05-01',
      status: 'planning',
      roasterId: null,
      roasterSnapshot: null,
      payerId: null,
      payerBank: { bankName: '', accountNumber: '', beneficiary: '' },
      referenceTemplate: 'FAJR-{ORDER}-{NAME}',
      goodsTotalZar: 0,
      lots: [],
      fees: [],
      payments: {},
    });

    expect(created).toBeDefined();
    expect(created?.listCurrency).toBe('GBP');
  });

  it('updates listCurrency and persists it to local storage', async () => {
    const { useAppStore } = await import('./appStore');
    await useAppStore.getState().initialize();

    const created = await useAppStore.getState().createOrder({
      name: 'June Drop',
      orderDate: '2026-06-01',
      status: 'planning',
      roasterId: null,
      roasterSnapshot: null,
      payerId: null,
      payerBank: { bankName: '', accountNumber: '', beneficiary: '' },
      referenceTemplate: 'FAJR-{ORDER}-{NAME}',
      goodsTotalZar: 0,
      lots: [],
      fees: [],
      payments: {},
      listCurrency: 'EUR',
    });

    await useAppStore.getState().updateOrder(created!.id, {
      listCurrency: 'ZAR',
    });

    const updated = useAppStore.getState().orders.find((o) => o.id === created!.id);
    expect(updated?.listCurrency).toBe('ZAR');
    expect(testLocalStorage.getItem('fb_last_list_currency')).toBe('ZAR');
  });

  it('round-trips listCurrency through exportJSON and importJSON', async () => {
    const { useAppStore } = await import('./appStore');
    await useAppStore.getState().initialize();

    const order = await useAppStore.getState().createOrder({
      name: 'Export Currency Test',
      orderDate: '2026-07-01',
      status: 'planning',
      roasterId: null,
      roasterSnapshot: null,
      payerId: null,
      payerBank: { bankName: '', accountNumber: '', beneficiary: '' },
      referenceTemplate: 'FAJR-{ORDER}-{NAME}',
      goodsTotalZar: 0,
      lots: [],
      fees: [],
      payments: {},
      listCurrency: 'USD',
    });

    const exported = useAppStore.getState().exportJSON();
    expect(exported).toContain('"listCurrency": "USD"');

    // Simulate import of backup
    await useAppStore.getState().importJSON(exported);
    const reloaded = useAppStore.getState().orders.find((o) => o.id === order!.id);
    expect(reloaded?.listCurrency).toBe('USD');
  });

  it('importJSON gracefully handles invalid listCurrency without failing import', async () => {
    const { useAppStore } = await import('./appStore');
    await useAppStore.getState().initialize();

    const invalidCurrencyPayload = JSON.stringify({
      version: '2',
      people: [],
      roasters: [],
      orders: [
        {
          id: 'order-corrupt-curr',
          name: 'Corrupt Currency Order',
          orderDate: '2026-08-01',
          status: 'planning',
          roasterId: null,
          roasterSnapshot: null,
          payerId: null,
          payerBank: { bankName: '', accountNumber: '', beneficiary: '' },
          referenceTemplate: 'FAJR-{ORDER}-{NAME}',
          goodsTotalZar: 0,
          lots: [],
          fees: [],
          payments: {},
          listCurrency: 'NOT_A_VALID_ISO_CODE_123456',
        },
      ],
      settings: {},
    });

    await expect(useAppStore.getState().importJSON(invalidCurrencyPayload)).resolves.not.toThrow();
    const imported = useAppStore.getState().orders.find((o) => o.id === 'order-corrupt-curr');
    expect(imported).toBeDefined();
    expect(imported?.listCurrency).toBeUndefined();
  });

  it('duplicate order workflow copies listCurrency', async () => {
    const { useAppStore } = await import('./appStore');
    await useAppStore.getState().initialize();

    const original: Order = {
      id: 'order-orig-1',
      workspaceId: 'ws-1',
      name: 'Original Order',
      orderDate: '2026-03-20',
      status: 'locked',
      roasterId: null,
      roasterSnapshot: null,
      payerId: null,
      payerBank: { bankName: '', accountNumber: '', beneficiary: '' },
      referenceTemplate: 'FAJR-{ORDER}-{NAME}',
      goodsTotalZar: 0,
      lots: [],
      fees: [],
      payments: {},
      isArchived: false,
      listCurrency: 'GBP',
      createdAt: '2026-03-20T00:00:00Z',
      updatedAt: '2026-03-20T00:00:00Z',
    };

    const duplicatePayload = {
      ...createDuplicatedOrderPayload(original, '2026-03-21'),
      listCurrency: original.listCurrency,
    };

    const duplicated = await useAppStore.getState().createOrder(duplicatePayload);
    expect(duplicated).toBeDefined();
    expect(duplicated?.listCurrency).toBe('GBP');
    expect(duplicated?.name).toBe('Original Order (copy)');
  });
});
