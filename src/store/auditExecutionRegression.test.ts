import { describe, expect, it } from 'vitest';
import { calculate } from '../lib/calculations';
import { resolveReference, pdfFilename } from '../lib/formatters';
import { createDuplicatedOrderPayload } from '../lib/orderWizard';
import { getActiveOrders } from '../lib/orderLifecycle';
import type { Order } from '../types';

describe('Audit Execution Regression Test Suite', () => {
  it('correctly allocates rounding remainder to payer even when payer ordered 0g coffee', () => {
    const order: Order = {
      id: 'order-1',
      workspaceId: 'workspace-1',
      name: 'Coffee Drop',
      orderDate: '2026-03-18',
      roasterId: null,
      payerId: 'payer-1',
      payerBank: { bankName: '', accountNumber: '', beneficiary: '' },
      referenceTemplate: 'FAJR-{ORDER}-{NAME}',
      goodsTotalZar: 100.01,
      lots: [
        {
          id: 'lot-1',
          name: 'Ethiopia Yirgacheffe',
          foreignPricePerBag: 10,
          gramsPerBag: 300,
          quantity: 1,
          shares: [],
          bags: [
            {
              id: 'bag-1',
              splitMode: 'equal',
              buyers: [
                { personId: 'buyer-1', grams: 100 },
                { personId: 'buyer-2', grams: 100 },
                { personId: 'buyer-3', grams: 100 },
              ],
            },
          ],
        },
      ],
      fees: [],
      payments: {},
      isArchived: false,
    };

    const personNames = {
      'payer-1': 'Payer Person',
      'buyer-1': 'Buyer One',
      'buyer-2': 'Buyer Two',
      'buyer-3': 'Buyer Three',
    };

    const result = calculate(order, personNames);
    expect(result.isValid).toBe(true);

    // 100.01 divided among 3 buyers = 33.33666...
    // Buyers are floored: 33.33 + 33.33 + 33.33 = 99.99
    // Payer absorbs remainder: 100.01 - 99.99 = 0.02
    expect(result.personCalcs['buyer-1'].totalFinal).toBe(33.33);
    expect(result.personCalcs['buyer-2'].totalFinal).toBe(33.33);
    expect(result.personCalcs['buyer-3'].totalFinal).toBe(33.33);
    expect(result.personCalcs['payer-1'].totalFinal).toBe(0.02);

    const sum = Object.values(result.personCalcs).reduce((acc, c) => acc + c.totalFinal, 0);
    expect(Math.round(sum * 100) / 100).toBe(100.01);
  });

  it('normalizes accented Unicode characters into clean ASCII in slugify and pdfFilename', () => {
    const ref = resolveReference('FAJR-{ORDER}-{NAME}', 'Café Météor', 'René & François');
    expect(ref).toBe('FAJR-CAFE-METEOR-RENE-FRANCOIS');

    const filename = pdfFilename('Café Special', 'Müller');
    expect(filename).toBe('fajr-brews-invoice-cafe-special-muller.pdf');
  });

  it('duplicates orders with fresh distinct inner IDs for lots, bags, and fees', () => {
    const original: Order = {
      id: 'old-order-id',
      workspaceId: 'ws-1',
      name: 'Original Order',
      orderDate: '2026-01-01',
      roasterId: 'roaster-1',
      payerId: 'person-1',
      payerBank: { bankName: 'FNB', accountNumber: '123', beneficiary: 'Test' },
      referenceTemplate: 'FAJR-{ORDER}-{NAME}',
      goodsTotalZar: 200,
      lots: [
        {
          id: 'lot-old-1',
          name: 'Beans',
          foreignPricePerBag: 15,
          gramsPerBag: 250,
          quantity: 1,
          shares: [{ id: 'share-old-1', personId: 'person-1', shareGrams: 250, bagIndex: 0 }],
          bags: [{ id: 'bag-old-1', splitMode: 'full', buyers: [{ personId: 'person-1', grams: 250 }] }],
        },
      ],
      fees: [{ id: 'fee-old-1', label: 'Courier', amountZar: 50, allocationType: 'equal_per_person' }],
      payments: { 'person-1': { status: 'paid', amountPaid: 250 } },
      isArchived: true,
    };

    const duplicate = createDuplicatedOrderPayload(original, '2026-03-20');
    expect(duplicate.name).toBe('Original Order (copy)');
    expect(duplicate.orderDate).toBe('2026-03-20');
    expect(duplicate.status).toBe('planning');
    expect(duplicate.payments).toEqual({});

    // Inner IDs must NOT match original IDs
    expect(duplicate.lots[0].id).not.toBe('lot-old-1');
    expect(duplicate.lots[0].bags[0].id).not.toBe('bag-old-1');
    expect(duplicate.fees[0].id).not.toBe('fee-old-1');
    expect(duplicate.lots[0].shares[0].id).not.toBe('share-old-1');
  });

  it('sorts orders stably by orderDate descending with deterministic secondary tie-breaker', () => {
    const orders: Order[] = [
      { id: 'b', workspaceId: '1', name: 'Order B', orderDate: '2026-03-18', payerId: null, payerBank: { bankName: '', accountNumber: '', beneficiary: '' }, referenceTemplate: '', goodsTotalZar: 0, lots: [], fees: [], payments: {}, isArchived: false, createdAt: '2026-03-18T10:00:00Z' },
      { id: 'a', workspaceId: '1', name: 'Order A', orderDate: '2026-03-18', payerId: null, payerBank: { bankName: '', accountNumber: '', beneficiary: '' }, referenceTemplate: '', goodsTotalZar: 0, lots: [], fees: [], payments: {}, isArchived: false, createdAt: '2026-03-18T11:00:00Z' },
      { id: 'c', workspaceId: '1', name: 'Order C', orderDate: '2026-03-19', payerId: null, payerBank: { bankName: '', accountNumber: '', beneficiary: '' }, referenceTemplate: '', goodsTotalZar: 0, lots: [], fees: [], payments: {}, isArchived: false, createdAt: '2026-03-19T09:00:00Z' },
    ];

    const sorted = getActiveOrders(orders);
    expect(sorted.map((o) => o.id)).toEqual(['c', 'a', 'b']);
  });
});
