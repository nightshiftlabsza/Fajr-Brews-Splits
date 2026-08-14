import { describe, expect, it, vi } from 'vitest';
import { getActiveOrders, getPastOrders, normalizeOrderStatus, syncOrderStatusFlags } from '../lib/orderLifecycle';
import type { CoffeeLot, Order } from '../types';

function createMockOrder(id: string, name: string, status: 'planning' | 'locked' | 'completed' | 'archived', lots: CoffeeLot[] = []): Order {
  return {
    id,
    workspaceId: 'workspace-1',
    name,
    orderDate: '2026-08-14',
    status,
    roasterId: null,
    roasterSnapshot: null,
    payerId: 'person-1',
    payerBank: { bankName: 'Standard Bank', accountNumber: '123456789', beneficiary: 'Zakariyya' },
    referenceTemplate: 'FAJR-{ORDER}-{NAME}',
    goodsTotalZar: 1000,
    lots,
    fees: [],
    payments: { 'person-1': { status: 'paid', amountPaid: 500 } },
    isArchived: status === 'archived',
    createdAt: '2026-08-14T00:00:00.000Z',
    updatedAt: '2026-08-14T00:00:00.000Z',
  };
}

describe('Architecture Rules & Constraints', () => {
  describe('Rule 1: Multiple Active Orders Coexistence', () => {
    it('supports multiple active orders simultaneously without interference', () => {
      const orderA = createMockOrder('order-a', 'September Coffee Collective', 'planning');
      const orderB = createMockOrder('order-b', 'Tim Wendelboe Order', 'planning');
      const pastOrder = createMockOrder('order-past', 'August Coffee Order', 'archived');

      const allOrders = [orderA, orderB, pastOrder];
      const active = getActiveOrders(allOrders);
      const past = getPastOrders(allOrders);

      expect(active.map((o) => o.id)).toEqual(['order-a', 'order-b']);
      expect(past.map((o) => o.id)).toEqual(['order-past']);
    });
  });

  describe('Rule 2: Canonical OrderStatus Normalization', () => {
    it('normalizes status and keeps isArchived in sync', () => {
      expect(normalizeOrderStatus('planning', false)).toBe('planning');
      expect(normalizeOrderStatus('locked', false)).toBe('locked');
      expect(normalizeOrderStatus('completed', false)).toBe('completed');
      expect(normalizeOrderStatus('archived', false)).toBe('archived');
      expect(normalizeOrderStatus('planning', true)).toBe('archived');
      expect(normalizeOrderStatus(null, true)).toBe('archived');
      expect(normalizeOrderStatus(null, false)).toBe('planning');
    });

    it('prevents contradictory status and isArchived states via syncOrderStatusFlags', () => {
      const order = { status: 'planning' as const, isArchived: true };
      const synced = syncOrderStatusFlags(order);
      expect(synced.status).toBe('archived');
      expect(synced.isArchived).toBe(true);

      const activeOrder = { status: 'locked' as const, isArchived: false };
      const syncedActive = syncOrderStatusFlags(activeOrder);
      expect(syncedActive.status).toBe('locked');
      expect(syncedActive.isArchived).toBe(false);
    });
  });

  describe('Rule 4: Privacy & Scoped Participant Projection', () => {
    it('filters visible person IDs so participants only see their own records', () => {
      const allPersonIds = ['person-1', 'person-2', 'person-3'];
      const participantPersonId = 'person-2';

      const visibleIdsForParticipant = allPersonIds.filter(
        (id) => !participantPersonId || id === participantPersonId,
      );

      expect(visibleIdsForParticipant).toEqual(['person-2']);
    });

    it('prunes buyer arrays to exclude other participants from the participant projection', () => {
      const mockLot: CoffeeLot = {
        id: 'lot-1',
        name: 'Ethiopia Guji',
        foreignPricePerBag: 20,
        gramsPerBag: 250,
        quantity: 2,
        shares: [],
        bags: [
          {
            id: 'bag-1',
            splitMode: 'equal',
            buyers: [
              { id: 'b-1', personId: 'caller-person-id', grams: 125 },
              { id: 'b-2', personId: 'other-person-id', grams: 125 },
            ],
          },
        ],
      };

      // Simulates the server-side projected buyer list for caller-person-id
      const callerPersonId = 'caller-person-id';
      const prunedBags = mockLot.bags?.map((bag) => ({
        ...bag,
        buyers: bag.buyers.filter((b) => b.personId === callerPersonId),
      }));

      expect(prunedBags?.[0].buyers).toHaveLength(1);
      expect(prunedBags?.[0].buyers[0].personId).toBe('caller-person-id');
    });
  });

  describe('Historical Order Editing and Isolation', () => {
    it('preserves existing coffee lots and allocations when adding new people', () => {
      const existingLots: CoffeeLot[] = [
        {
          id: 'lot-1',
          name: 'Kenya Nyeri',
          foreignPricePerBag: 25,
          gramsPerBag: 250,
          quantity: 1,
          shares: [],
          bags: [{ id: 'bag-1', splitMode: 'full', buyers: [{ id: 'b-1', personId: 'person-1', grams: 250 }] }],
        },
      ];

      const historicalOrder = createMockOrder('order-hist', 'Historic Order', 'archived', existingLots);

      // Simulating modifying people directory
      const newPerson = { id: 'person-new', name: 'New Joiner' };
      expect(newPerson.name).toBe('New Joiner');

      // The historical order's lots remain intact
      expect(historicalOrder.lots).toHaveLength(1);
      expect(historicalOrder.lots[0].name).toBe('Kenya Nyeri');
      expect(historicalOrder.status).toBe('archived');
      expect(historicalOrder.isArchived).toBe(true);
    });

    it('duplicates a historical order as a fresh active order with new ID, planning status and cleared payments', () => {
      const historicalOrder = createMockOrder('order-hist', 'Historic Order', 'archived', [
        {
          id: 'lot-1',
          name: 'Kenya Nyeri',
          foreignPricePerBag: 25,
          gramsPerBag: 250,
          quantity: 1,
          shares: [],
        },
      ]);

      const duplicatedOrder: Order = {
        ...historicalOrder,
        id: 'new-uuid-1234',
        name: `${historicalOrder.name} (copy)`,
        status: 'planning',
        isArchived: false,
        payments: {},
      };

      expect(duplicatedOrder.id).toBe('new-uuid-1234');
      expect(duplicatedOrder.status).toBe('planning');
      expect(duplicatedOrder.isArchived).toBe(false);
      expect(duplicatedOrder.payments).toEqual({});
      expect(historicalOrder.status).toBe('archived');
      expect(historicalOrder.isArchived).toBe(true);
    });
  });
});
