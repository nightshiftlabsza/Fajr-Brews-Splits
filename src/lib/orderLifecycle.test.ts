import { describe, expect, it } from 'vitest';
import type { Order } from '../types';
import {
  getActiveOrders,
  getNextActiveOrderId,
  getOrderLifecycleLabel,
  getPastOrders,
  getPreferredActiveOrderId,
} from './orderLifecycle';

function makeOrder(id: string, orderDate: string, isArchived: boolean): Order {
  return {
    id,
    workspaceId: 'workspace-1',
    name: id,
    orderDate,
    payerId: null,
    payerBank: { bankName: '', accountNumber: '', beneficiary: '' },
    referenceTemplate: 'FAJR-{ORDER}-{NAME}',
    goodsTotalZar: 0,
    lots: [],
    fees: [],
    payments: {},
    isArchived,
    createdAt: '2026-03-18T00:00:00.000Z',
    updatedAt: '2026-03-18T00:00:00.000Z',
  };
}

describe('orderLifecycle helpers', () => {
  const orders = [
    makeOrder('draft-1', '2026-03-18', false),
    makeOrder('past-1', '2026-03-16', true),
    makeOrder('draft-2', '2026-03-17', false),
  ];

  it('splits active and past orders cleanly', () => {
    expect(getActiveOrders(orders).map((order) => order.id)).toEqual(['draft-1', 'draft-2']);
    expect(getPastOrders(orders).map((order) => order.id)).toEqual(['past-1']);
  });

  it('prefers the current active order when it is still active', () => {
    expect(getPreferredActiveOrderId(orders, 'draft-2')).toBe('draft-2');
  });

  it('falls back to the newest active order when the current one is missing or archived', () => {
    expect(getPreferredActiveOrderId(orders, 'past-1')).toBe('draft-1');
    expect(getPreferredActiveOrderId(orders, null)).toBe('draft-1');
  });

  it('finds the next active order when one is finalized', () => {
    expect(getNextActiveOrderId(orders, 'draft-1')).toBe('draft-2');
    expect(getNextActiveOrderId([makeOrder('past-only', '2026-03-18', true)], 'past-only')).toBe(null);
  });

  it('labels order lifecycle state for the UI', () => {
    expect(getOrderLifecycleLabel(makeOrder('draft', '2026-03-18', false))).toBe('In progress');
    expect(getOrderLifecycleLabel(makeOrder('past', '2026-03-18', true))).toBe('Past order');
  });
});
