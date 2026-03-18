import { describe, expect, it } from 'vitest';
import type { Order } from '../types';
import { getPastOrderSummary } from './pastOrderSummary';

const baseOrder: Order = {
  id: 'order-1',
  workspaceId: 'workspace-1',
  name: 'April Order',
  orderDate: '2026-04-01',
  payerId: 'person-1',
  payerBank: { bankName: '', accountNumber: '', beneficiary: '' },
  referenceTemplate: 'FAJR-{ORDER}-{NAME}',
  goodsTotalZar: 600,
  lots: [
    {
      id: 'lot-1',
      name: 'Lot 1',
      foreignPricePerBag: 10,
      gramsPerBag: 250,
      quantity: 2,
      shares: [
        { id: 'share-1', personId: 'person-1', shareGrams: 250 },
        { id: 'share-2', personId: 'person-2', shareGrams: 250 },
      ],
    },
  ],
  fees: [
    {
      id: 'fee-1',
      label: 'Shipping',
      amountZar: 100,
      allocationType: 'fixed_shared',
    },
  ],
  payments: {
    'person-1': { status: 'paid', amountPaid: 350 },
    'person-2': { status: 'partial', amountPaid: 100 },
  },
  isArchived: true,
  createdAt: '2026-04-01T10:00:00Z',
  updatedAt: '2026-04-01T10:00:00Z',
};

describe('getPastOrderSummary', () => {
  it('derives summary from a valid saved order', () => {
    const summary = getPastOrderSummary(baseOrder, {
      'person-1': 'Amina',
      'person-2': 'Yusuf',
    });

    expect(summary.isValid).toBe(true);
    expect(summary.participantCount).toBe(2);
    expect(summary.lotCount).toBe(1);
    expect(summary.totalZar).toBe(700);
    expect(summary.paidCount).toBe(1);
    expect(summary.partialCount).toBe(1);
  });

  it('falls back to saved shares and totals when the archived order is invalid', () => {
    const invalidOrder: Order = {
      ...baseOrder,
      goodsTotalZar: 0,
    };

    const summary = getPastOrderSummary(invalidOrder, {});

    expect(summary.isValid).toBe(false);
    expect(summary.participantCount).toBe(2);
    expect(summary.lotCount).toBe(1);
    expect(summary.totalZar).toBe(100);
  });
});
