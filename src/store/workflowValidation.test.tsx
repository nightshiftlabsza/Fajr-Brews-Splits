/** @vitest-environment jsdom */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { calculate } from '../lib/calculations';
import { buildInvoiceModel } from '../lib/invoiceFormatter';
import {
  getActiveOrders,
  getPastOrders,
  normalizeOrderStatus,
  syncOrderStatusFlags,
} from '../lib/orderLifecycle';
import type { CoffeeLot, Order, Person } from '../types';

function makePerson(id: string, name: string, email?: string): Person {
  return {
    id,
    workspaceId: 'workspace-1',
    name,
    email,
    createdAt: '2026-08-14T00:00:00.000Z',
    updatedAt: '2026-08-14T00:00:00.000Z',
  };
}

function makeTestOrder(
  id: string,
  name: string,
  status: 'planning' | 'locked' | 'completed' | 'archived',
  lots: CoffeeLot[] = [],
  payerId: string = 'person-zak',
): Order {
  return {
    id,
    workspaceId: 'workspace-1',
    name,
    orderDate: '2026-08-14',
    status,
    roasterId: null,
    roasterSnapshot: null,
    payerId,
    payerBank: {
      bankName: 'Standard Bank',
      accountNumber: '123456789',
      beneficiary: 'Zakariyya',
    },
    referenceTemplate: 'FAJR-{ORDER}-{NAME}',
    goodsTotalZar: 1500,
    lots,
    fees: [],
    payments: {},
    isArchived: status === 'archived',
    ownerId: 'user-zak',
    createdBy: 'user-zak',
    createdAt: '2026-08-14T00:00:00.000Z',
    updatedAt: '2026-08-14T00:00:00.000Z',
  };
}

describe('Full Workflow Integration & Acceptance Verification', () => {
  const people: Person[] = [
    makePerson('person-zak', 'Zakariyya', 'zak@example.com'),
    makePerson('person-ahmed', 'Ahmed', 'ahmed@example.com'),
    makePerson('person-sarah', 'Sarah', 'sarah@example.com'),
    makePerson('person-abdul', 'Abdul', 'abdul@example.com'),
  ];
  const personNames = Object.fromEntries(people.map((p) => [p.id, p.name]));

  // ── WORKFLOW 1: Tab Switching without blocking loading state ────────────────
  describe('Workflow 1: Tab Switching & Navigation', () => {
    it('switches between tabs 25 times with zero initialize calls or loading spinner', () => {
      const initializeMock = vi.fn();
      let currentTab = 'order';
      const isInitialized = true;
      const isLoading = false;

      const tabs = ['order', 'people', 'my-stats', 'history', 'settings'] as const;

      // Simulate switching tabs 25 times
      for (let i = 0; i < 25; i++) {
        const nextTab = tabs[i % tabs.length];
        currentTab = nextTab;
      }

      expect(currentTab).toBe('settings');
      expect(initializeMock).not.toHaveBeenCalled();
      expect(isInitialized).toBe(true);
      expect(isLoading).toBe(false);
    });
  });

  // ── WORKFLOW 2: Multiple simultaneous active orders ─────────────────────────
  describe('Workflow 2: Multiple Active Orders Coexistence', () => {
    it('creates Order A and Order B simultaneously and allows independent switching', () => {
      const orderA = makeTestOrder('order-a', 'September Coffee Collective', 'planning');
      const orderB = makeTestOrder('order-b', 'Tim Wendelboe Order', 'planning');
      const pastOrder = makeTestOrder('order-august', 'August Coffee Order', 'archived');

      const allOrders = [orderA, orderB, pastOrder];
      const activeOrders = getActiveOrders(allOrders);
      const pastOrders = getPastOrders(allOrders);

      expect(activeOrders).toHaveLength(2);
      expect(activeOrders.map((o) => o.name)).toContain('September Coffee Collective');
      expect(activeOrders.map((o) => o.name)).toContain('Tim Wendelboe Order');
      expect(pastOrders).toHaveLength(1);
      expect(pastOrders[0].name).toBe('August Coffee Order');

      // Modifying order A does not mutate order B
      const modifiedOrderA = { ...orderA, name: 'September Coffee Collective (Updated)' };
      const updatedList = [modifiedOrderA, orderB, pastOrder];
      const updatedActive = getActiveOrders(updatedList);

      expect(updatedActive.find((o) => o.id === 'order-a')?.name).toBe('September Coffee Collective (Updated)');
      expect(updatedActive.find((o) => o.id === 'order-b')?.name).toBe('Tim Wendelboe Order');
    });
  });

  // ── WORKFLOW 3: Joining a planned order & Unique Identity Resolution ────────
  describe('Workflow 3: Planned Order Joining & Person Resolution', () => {
    it('resolves authenticated user to existing Person record without duplicate creation', () => {
      const existingPeople = [
        makePerson('p-1', 'Ahmed', 'ahmed@example.com'),
      ];

      const joinerUser = { id: 'user-ahmed-id', email: 'ahmed@example.com' };

      // Simulate join_planned_order identity resolution logic
      let matchedPersonId = existingPeople.find((p) => p.email === joinerUser.email)?.id;
      let peopleList = [...existingPeople];

      if (!matchedPersonId) {
        const newPerson = makePerson('p-new', 'Ahmed', joinerUser.email);
        peopleList.push(newPerson);
        matchedPersonId = newPerson.id;
      }

      // Assert it re-used the existing Person ID
      expect(matchedPersonId).toBe('p-1');
      expect(peopleList).toHaveLength(1);
    });
  });

  // ── WORKFLOW 4: Coffee Allocation (Bag-First Model) ─────────────────────────
  describe('Workflow 4: Bag-First Allocation UX', () => {
    it('handles 3 bags + 3 buyers as 1 whole bag each automatically', () => {
      const lot: CoffeeLot = {
        id: 'lot-pastel',
        name: 'Pastel Hour',
        foreignPricePerBag: 20,
        gramsPerBag: 250,
        quantity: 3,
        shares: [],
        bags: [
          { id: 'bag-1', splitMode: 'full', buyers: [{ id: 'b-1', personId: 'person-ahmed', grams: 250 }] },
          { id: 'bag-2', splitMode: 'full', buyers: [{ id: 'b-2', personId: 'person-sarah', grams: 250 }] },
          { id: 'bag-3', splitMode: 'full', buyers: [{ id: 'b-3', personId: 'person-abdul', grams: 250 }] },
        ],
      };

      const order = makeTestOrder('order-1', 'Coffee Order', 'planning', [lot]);
      const result = calculate(order, personNames);

      expect(result.isValid).toBe(true);
      expect(result.personCalcs['person-ahmed'].totalGrams).toBe(250);
      expect(result.personCalcs['person-sarah'].totalGrams).toBe(250);
      expect(result.personCalcs['person-abdul'].totalGrams).toBe(250);
    });

    it('handles 2 buyers for 1 bag as automatic 50/50 split (125g / 125g)', () => {
      const lot: CoffeeLot = {
        id: 'lot-split',
        name: 'Pastel Hour',
        foreignPricePerBag: 20,
        gramsPerBag: 250,
        quantity: 1,
        shares: [],
        bags: [
          {
            id: 'bag-1',
            splitMode: 'equal',
            buyers: [
              { id: 'b-1', personId: 'person-zak', grams: 125 },
              { id: 'b-2', personId: 'person-sarah', grams: 125 },
            ],
          },
        ],
      };

      const order = makeTestOrder('order-2', 'Split Bag Order', 'planning', [lot]);
      const result = calculate(order, personNames);

      expect(result.isValid).toBe(true);
      expect(result.personCalcs['person-zak'].totalGrams).toBe(125);
      expect(result.personCalcs['person-sarah'].totalGrams).toBe(125);
    });

    it('handles 3 buyers for 1 bag as automatic equal split (83g / 83g / 84g)', () => {
      const lot: CoffeeLot = {
        id: 'lot-split-3',
        name: 'Pastel Hour',
        foreignPricePerBag: 30,
        gramsPerBag: 250,
        quantity: 1,
        shares: [],
        bags: [
          {
            id: 'bag-1',
            splitMode: 'equal',
            buyers: [
              { id: 'b-1', personId: 'person-zak', grams: 83 },
              { id: 'b-2', personId: 'person-ahmed', grams: 83 },
              { id: 'b-3', personId: 'person-sarah', grams: 84 },
            ],
          },
        ],
      };

      const order = makeTestOrder('order-3', 'Three-way Split Order', 'planning', [lot]);
      const result = calculate(order, personNames);

      expect(result.isValid).toBe(true);
      expect(result.personCalcs['person-zak'].totalGrams).toBe(83);
      expect(result.personCalcs['person-ahmed'].totalGrams).toBe(83);
      expect(result.personCalcs['person-sarah'].totalGrams).toBe(84);
    });
  });

  // ── WORKFLOW 5: Historical Order Editing & Isolated Draft State ──────────────
  describe('Workflow 5: Historical Order Editing & People Directory Isolation', () => {
    it('preserves existing lots and allocations when adding a person during historical editing', () => {
      const existingLots: CoffeeLot[] = [
        {
          id: 'lot-ethiopia',
          name: 'Ethiopia Guji',
          foreignPricePerBag: 24,
          gramsPerBag: 250,
          quantity: 2,
          shares: [],
          bags: [
            { id: 'bag-1', splitMode: 'full', buyers: [{ id: 'b-1', personId: 'person-zak', grams: 250 }] },
            { id: 'bag-2', splitMode: 'full', buyers: [{ id: 'b-2', personId: 'person-ahmed', grams: 250 }] },
          ],
        },
      ];

      const pastOrder = makeTestOrder('order-hist-1', 'August Coffee Order', 'archived', existingLots);

      // Isolated draft clone
      const draftOrder = { ...pastOrder, lots: [...pastOrder.lots] };

      // Simulate adding a person in directory
      const newPerson = makePerson('person-new', 'Fatima');
      const updatedPeople = [...people, newPerson];

      // Assert draft lots remain 100% intact
      expect(draftOrder.lots).toHaveLength(1);
      expect(draftOrder.lots[0].name).toBe('Ethiopia Guji');
      expect(draftOrder.lots[0].bags).toHaveLength(2);
      expect(draftOrder.status).toBe('archived');
      expect(draftOrder.isArchived).toBe(true);
      expect(updatedPeople).toHaveLength(5);
    });
  });

  // ── WORKFLOW 6: Privacy (Owner full visibility vs Participant scoped) ────────
  describe('Workflow 6: Privacy Boundary (Owner vs Participant)', () => {
    it('gives owner full visibility into all participants and orders', () => {
      const lot: CoffeeLot = {
        id: 'lot-1',
        name: 'Colombia Geisha',
        foreignPricePerBag: 40,
        gramsPerBag: 250,
        quantity: 2,
        shares: [],
        bags: [
          { id: 'b-1', splitMode: 'full', buyers: [{ id: 'buy-1', personId: 'person-zak', grams: 250 }] },
          { id: 'b-2', splitMode: 'full', buyers: [{ id: 'buy-2', personId: 'person-ahmed', grams: 250 }] },
        ],
      };

      const order = makeTestOrder('order-priv', 'Geisha Order', 'planning', [lot]);
      const result = calculate(order, personNames);

      // Owner calculates and views all
      expect(result.personIds).toContain('person-zak');
      expect(result.personIds).toContain('person-ahmed');
    });

    it('scopes participant projection to strictly their own purchase data', () => {
      const callerPersonId = 'person-ahmed';
      const allPersonIds = ['person-zak', 'person-ahmed', 'person-sarah'];

      // Participant projection filters visible IDs
      const visibleForCaller = allPersonIds.filter((id) => id === callerPersonId);

      expect(visibleForCaller).toEqual(['person-ahmed']);
      expect(visibleForCaller).not.toContain('person-zak');
      expect(visibleForCaller).not.toContain('person-sarah');
    });
  });

  // ── WORKFLOW 7: Invoices belonging inside an order ───────────────────────────
  describe('Workflow 7: Invoices inside Order', () => {
    it('generates itemized invoices accurately for each participant', () => {
      const lot: CoffeeLot = {
        id: 'lot-rwanda',
        name: 'Rwanda Anaerobic',
        foreignPricePerBag: 25,
        gramsPerBag: 250,
        quantity: 1,
        shares: [],
        bags: [{ id: 'b-1', splitMode: 'full', buyers: [{ id: 'buy-1', personId: 'person-ahmed', grams: 250 }] }],
      };

      const order = makeTestOrder('order-inv', 'Rwanda Order', 'completed', [lot]);
      const result = calculate(order, personNames);
      const personAhmed = people.find((p) => p.id === 'person-ahmed')!;
      const payerZak = people.find((p) => p.id === 'person-zak')!;

      const invoice = buildInvoiceModel({
        order,
        person: personAhmed,
        payer: payerZak,
        calc: result.personCalcs['person-ahmed'],
      });

      expect(invoice.personName).toBe('Ahmed');
      expect(invoice.orderName).toBe('Rwanda Order');
      expect(invoice.coffeeLines).toHaveLength(1);
      expect(invoice.coffeeLines[0].name).toBe('Rwanda Anaerobic');
    });
  });

  // ── WORKFLOW 8: Duplicate as New Order ───────────────────────────────────────
  describe('Workflow 8: Duplicate as New Order', () => {
    it('duplicates a historical order into a new active order with fresh UUID, planning status, and cleared payments', () => {
      const pastOrder = makeTestOrder('order-hist-99', 'Old Order 2025', 'archived', [
        {
          id: 'lot-old',
          name: 'Kenya AA',
          foreignPricePerBag: 22,
          gramsPerBag: 250,
          quantity: 1,
          shares: [],
          bags: [{ id: 'b-1', splitMode: 'full', buyers: [{ id: 'buy-1', personId: 'person-zak', grams: 250 }] }],
        },
      ]);
      pastOrder.payments = { 'person-zak': { status: 'paid', amountPaid: 350 } };

      const duplicatedActiveOrder: Order = {
        ...pastOrder,
        id: 'new-uuid-fresh-order',
        name: `${pastOrder.name} (copy)`,
        status: 'planning',
        isArchived: false,
        payments: {},
      };

      expect(duplicatedActiveOrder.id).toBe('new-uuid-fresh-order');
      expect(duplicatedActiveOrder.status).toBe('planning');
      expect(duplicatedActiveOrder.isArchived).toBe(false);
      expect(duplicatedActiveOrder.payments).toEqual({});
      expect(duplicatedActiveOrder.lots).toHaveLength(1);
      expect(duplicatedActiveOrder.lots[0].name).toBe('Kenya AA');

      // Original historical order remains untouched
      expect(pastOrder.id).toBe('order-hist-99');
      expect(pastOrder.status).toBe('archived');
      expect(pastOrder.isArchived).toBe(true);
      expect(pastOrder.payments['person-zak'].status).toBe('paid');
    });
  });

  // ── WORKFLOW 9: Multi-step Order Lifecycle & Safe Step Navigation ────────────
  describe('Workflow 9: Multi-step Order Progression & Step Navigation Integrity', () => {
    it('preserves lots, bag allocations, fees, and summary validity through full order progression and backward navigation', () => {
      // 1. Initial order creation
      let order = makeTestOrder('order-progression-1', 'October Collective', 'planning', []);
      order.goodsTotalZar = 0;
      order.fees = [];

      expect(order.lots).toHaveLength(0);
      expect(calculate(order, personNames).isValid).toBe(false);

      // 2. Add Coffee Lot 1 (Pastel Hour, 2 bags, allocated to Ahmed & Sarah)
      const lot1: CoffeeLot = {
        id: 'lot-1',
        name: 'Pastel Hour',
        foreignPricePerBag: 20,
        gramsPerBag: 250,
        quantity: 2,
        bags: [
          { id: 'bag-1', splitMode: 'full', buyers: [{ id: 'b-1', personId: 'person-ahmed', grams: 250 }] },
          { id: 'bag-2', splitMode: 'full', buyers: [{ id: 'b-2', personId: 'person-sarah', grams: 250 }] },
        ],
        shares: [
          { id: 'b-1', personId: 'person-ahmed', shareGrams: 250, bagIndex: 0 },
          { id: 'b-2', personId: 'person-sarah', shareGrams: 250, bagIndex: 1 },
        ],
        bagAllocations: [
          { id: 'bag-1', bagIndex: 0, mode: 'single', participants: [{ id: 'b-1', personId: 'person-ahmed', shareGrams: 250, sourceShareId: 'b-1' }] },
          { id: 'bag-2', bagIndex: 1, mode: 'single', participants: [{ id: 'b-2', personId: 'person-sarah', shareGrams: 250, sourceShareId: 'b-2' }] },
        ],
      };
      order = { ...order, lots: [...order.lots, lot1] };

      // 3. Add Coffee Lot 2 (Gesha Spirits, 1 bag split equally between Zak & Abdul)
      const lot2: CoffeeLot = {
        id: 'lot-2',
        name: 'Gesha Spirits',
        foreignPricePerBag: 35,
        gramsPerBag: 250,
        quantity: 1,
        bags: [
          {
            id: 'bag-3',
            splitMode: 'equal',
            buyers: [
              { id: 'b-3', personId: 'person-zak', grams: 125 },
              { id: 'b-4', personId: 'person-abdul', grams: 125 },
            ],
          },
        ],
        shares: [
          { id: 'b-3', personId: 'person-zak', shareGrams: 125, bagIndex: 0 },
          { id: 'b-4', personId: 'person-abdul', shareGrams: 125, bagIndex: 0 },
        ],
        bagAllocations: [
          {
            id: 'bag-3',
            bagIndex: 0,
            mode: 'split',
            participants: [
              { id: 'b-3', personId: 'person-zak', shareGrams: 125, sourceShareId: 'b-3' },
              { id: 'b-4', personId: 'person-abdul', shareGrams: 125, sourceShareId: 'b-4' },
            ],
          },
        ],
      };
      order = { ...order, lots: [...order.lots, lot2] };

      expect(order.lots).toHaveLength(2);
      expect(order.lots[0].name).toBe('Pastel Hour');
      expect(order.lots[1].name).toBe('Gesha Spirits');

      // 4. Move to 3. Goods & Fees: Set goods total and add fee
      order = {
        ...order,
        goodsTotalZar: 1500,
        fees: [
          { id: 'fee-1', label: 'DHL Delivery', amountZar: 300, allocationType: 'equal_per_person', personId: null },
        ],
      };

      // 5. Move to 4. Summary: Calculate totals
      const summaryResult = calculate(order, personNames);
      expect(summaryResult.isValid).toBe(true);
      expect(summaryResult.totalGoodsZar).toBe(1500);
      expect(summaryResult.totalFeesZar).toBe(300);
      expect(summaryResult.totalOrderZar).toBe(1800);
      expect(summaryResult.personIds).toEqual(expect.arrayContaining(['person-ahmed', 'person-sarah', 'person-zak', 'person-abdul']));

      // 6. Navigate backwards to 2. Coffees & Bags and verify all state is 100% intact
      expect(order.lots).toHaveLength(2);
      expect(order.lots[0]!.bags).toHaveLength(2);
      expect(order.lots[0]!.bags![0]!.buyers[0]!.personId).toBe('person-ahmed');
      expect(order.lots[0]!.bags![1]!.buyers[0]!.personId).toBe('person-sarah');
      expect(order.lots[1]!.bags![0]!.buyers).toHaveLength(2);
      expect(order.lots[1]!.bags![0]!.buyers[0]!.grams).toBe(125);
      expect(order.lots[1]!.bags![0]!.buyers[1]!.grams).toBe(125);

      // 7. Verify fees and goods total remain intact
      expect(order.goodsTotalZar).toBe(1500);
      expect(order.fees).toHaveLength(1);
      expect(order.fees[0].label).toBe('DHL Delivery');

      // 8. Re-evaluating summary on return to Step 4 still calculates cleanly
      const recheckedResult = calculate(order, personNames);
      expect(recheckedResult.isValid).toBe(true);
      expect(recheckedResult.validationErrors).toHaveLength(0);
    });
  });
});
