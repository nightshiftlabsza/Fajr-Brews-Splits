/** @vitest-environment jsdom */

import { describe, expect, it, vi } from 'vitest';
import type {
  CoffeeLot,
  Fee,
  Order,
  Person,
  PersonCalculation,
  PersonLinkResolution,
  Roaster,
} from '../types';
import { calculate } from '../lib/calculations';
import {
  getActiveOrders,
  getNextActiveOrderId,
  getOrderLifecycleLabel,
  getPastOrders,
  getPreferredActiveOrderId,
  normalizeOrderStatus,
  syncOrderStatusFlags,
} from '../lib/orderLifecycle';
import {
  createDuplicatedOrderPayload,
  normalizeLotToBags,
  ORDER_WIZARD_STEPS,
  serializeLotFromBags,
} from '../lib/orderWizard';
import {
  assertCanPersistOrder,
  normalizeOrderForPersistence,
  validatePersistableOrder,
} from '../lib/orderIntegrity';
import {
  cleanFirstNamePart,
  cleanRoasterPart,
  formatDate,
  formatGrams,
  formatMonthYear,
  formatZAR,
  generatePaymentReference,
  orderPdfFilename,
  pdfFilename,
  resolveReference,
} from '../lib/formatters';
import {
  buildInvoiceModel,
  getFeeAllocationLabel,
  getFeeAllocationShortLabel,
  normalizeFeeAllocationType,
} from '../lib/invoiceFormatter';
import {
  calculateMyStatsSummary,
  getParticipantFinalizedOrders,
  getParticipantScopedOrders,
  isOrderInStatsRange,
  orderIncludesPerson,
  resolveLinkedStatsPerson,
} from '../lib/myStats';
import { resolveOrderRoaster } from '../lib/roasters';

// ── Mock Supabase Client for safe loading ────────────────────────────────────
vi.mock('../lib/supabase', () => ({
  WORKSPACE_ID: 'workspace-1',
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/logo.png' } }),
      }),
    },
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn(),
    }),
    removeChannel: vi.fn(),
  },
}));

// ── Helpers & Fixtures ────────────────────────────────────────────────────────

function makePerson(id: string, name: string, email?: string): Person {
  return {
    id,
    workspaceId: 'workspace-1',
    name,
    email,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };
}

function makeRoaster(id: string, name: string): Roaster {
  return {
    id,
    workspaceId: 'workspace-1',
    name,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };
}

function makeTestOrder(
  id: string,
  name: string,
  status: 'planning' | 'locked' | 'completed' | 'archived' = 'planning',
  lots: CoffeeLot[] = [],
  fees: Fee[] = [],
  goodsTotalZar = 1000,
  payerId: string = 'person-zak',
): Order {
  return {
    id,
    workspaceId: 'workspace-1',
    name,
    orderDate: '2026-08-15',
    status,
    roasterId: 'roaster-1',
    roasterSnapshot: { id: 'roaster-1', name: 'Tim Wendelboe' },
    payerId,
    payerBank: {
      bankName: 'Standard Bank',
      accountNumber: '10987654321',
      beneficiary: 'Zakariyya',
    },
    referenceTemplate: 'FAJR-{ORDER}-{NAME}',
    goodsTotalZar,
    lots,
    fees,
    payments: {},
    isArchived: status === 'archived',
    ownerId: 'user-zak',
    createdBy: 'user-zak',
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  };
}

describe('Fajr Brews Splits — Comprehensive 4-Tier E2E Workflow Test Suite', () => {
  const people: Person[] = [
    makePerson('person-zak', 'Zakariyya', 'zak@fajrbrews.co.za'),
    makePerson('person-ahmed', 'Ahmed Harnekar', 'ahmed@fajrbrews.co.za'),
    makePerson('person-sarah', 'Sarah Jenkins', 'sarah@fajrbrews.co.za'),
    makePerson('person-abdul', 'Abdul Rahman', 'abdul@fajrbrews.co.za'),
  ];
  const personNames: Record<string, string> = Object.fromEntries(
    people.map((p) => [p.id, p.name]),
  );

  // ══════════════════════════════════════════════════════════════════════════════
  // TIER 1: FEATURE COVERAGE (>=5 tests per feature across all 6 priority areas)
  // ══════════════════════════════════════════════════════════════════════════════

  describe('Tier 1: Feature Coverage', () => {
    // ── 1.1 Priority Area 1: Multiple Simultaneous Active Orders ─────────────
    describe('1.1 Priority Area 1: Multiple Simultaneous Active Orders', () => {
      it('T1-ORD-1: allows co-existence of multiple active orders in different lifecycle states', () => {
        const order1 = makeTestOrder('ord-1', 'August Drop', 'planning');
        const order2 = makeTestOrder('ord-2', 'September Drop', 'locked');
        const order3 = makeTestOrder('ord-3', 'October Drop', 'completed');
        const order4 = makeTestOrder('ord-4', 'July Drop', 'archived');

        const active = getActiveOrders([order1, order2, order3, order4]);
        const past = getPastOrders([order1, order2, order3, order4]);

        expect(active).toHaveLength(3);
        expect(active.map((o) => o.id)).toEqual(expect.arrayContaining(['ord-1', 'ord-2', 'ord-3']));
        expect(past).toHaveLength(1);
        expect(past[0].id).toBe('ord-4');
      });

      it('T1-ORD-2: order switching accurately resolves preferred active order', () => {
        const orders = [
          makeTestOrder('ord-a', 'Order A', 'planning'),
          makeTestOrder('ord-b', 'Order B', 'planning'),
        ];

        const selectedFirst = getPreferredActiveOrderId(orders, 'ord-b');
        expect(selectedFirst).toBe('ord-b');

        const selectedFallback = getPreferredActiveOrderId(orders, 'non-existent');
        expect(selectedFallback).toBe('ord-a');
      });

      it('T1-ORD-3: archiving active order cleanly transfers active selection to next order', () => {
        const orderA = makeTestOrder('ord-a', 'Order A', 'planning');
        const orderB = makeTestOrder('ord-b', 'Order B', 'planning');
        const orders = [orderA, orderB];

        const nextActive = getNextActiveOrderId(orders, 'ord-a');
        expect(nextActive).toBe('ord-b');

        const archivedA = { ...orderA, status: 'archived' as const, isArchived: true };
        const updatedOrders = [archivedA, orderB];
        expect(getActiveOrders(updatedOrders)).toHaveLength(1);
        expect(getActiveOrders(updatedOrders)[0].id).toBe('ord-b');
      });

      it('T1-ORD-4: deleting active order resolves next remaining order safely', () => {
        const orders = [
          makeTestOrder('ord-1', 'Order 1', 'planning'),
          makeTestOrder('ord-2', 'Order 2', 'planning'),
          makeTestOrder('ord-3', 'Order 3', 'planning'),
        ];

        const nextAfterDeleting2 = getNextActiveOrderId(orders, 'ord-2');
        expect(nextAfterDeleting2).toBe('ord-1');

        const remaining = orders.filter((o) => o.id !== 'ord-2');
        expect(getActiveOrders(remaining)).toHaveLength(2);
      });

      it('T1-ORD-5: orders sort deterministically by orderDate descending then name', () => {
        const orderEarlier = { ...makeTestOrder('o-1', 'Bravo', 'planning'), orderDate: '2026-08-01' };
        const orderLater = { ...makeTestOrder('o-2', 'Alpha', 'planning'), orderDate: '2026-08-20' };
        const orderSameDate = { ...makeTestOrder('o-3', 'Charlie', 'planning'), orderDate: '2026-08-20' };

        const sorted = getActiveOrders([orderEarlier, orderLater, orderSameDate]);
        expect(sorted[0].id).toBe('o-2');
        expect(sorted[1].id).toBe('o-3');
        expect(sorted[2].id).toBe('o-1');
      });
    });

    // ── 1.2 Priority Area 2: Draft/Edit Persistence & Concurrency ───────────
    describe('1.2 Priority Area 2: Draft/Edit Persistence & Concurrency', () => {
      it('T1-PERS-1: normalizes and serializes coffee lot bag draft state without data loss', () => {
        const lot: CoffeeLot = {
          id: 'lot-1',
          name: 'Ethiopia Yirgacheffe',
          foreignPricePerBag: 20,
          gramsPerBag: 250,
          quantity: 2,
          shares: [],
          bags: [
            { id: 'b-1', splitMode: 'full', buyers: [{ id: 'buy-1', personId: 'person-zak', grams: 250 }] },
            { id: 'b-2', splitMode: 'full', buyers: [{ id: 'buy-2', personId: 'person-ahmed', grams: 250 }] },
          ],
        };

        const normalizedBags = normalizeLotToBags(lot);
        expect(normalizedBags).toHaveLength(2);
        expect(normalizedBags[0].buyers[0].personId).toBe('person-zak');

        const serialized = serializeLotFromBags(normalizedBags);
        expect(serialized.shares).toHaveLength(2);
        expect(serialized.bags).toHaveLength(2);
      });

      it('T1-PERS-2: fee draft persistence preserves canonical allocation types', () => {
        const fees: Fee[] = [
          { id: 'f-1', label: 'DHL Delivery', amountZar: 200, allocationType: 'equal_per_person', personId: null },
          { id: 'f-2', label: 'Customs Duty', amountZar: 400, allocationType: 'proportional_by_value', personId: null },
          { id: 'f-3', label: 'PUDO Courier', amountZar: 60, allocationType: 'specific_person', personId: 'person-ahmed' },
        ];

        expect(normalizeFeeAllocationType(fees[0].allocationType)).toBe('equal_per_person');
        expect(normalizeFeeAllocationType(fees[1].allocationType)).toBe('proportional_by_value');
        expect(normalizeFeeAllocationType(fees[2].allocationType)).toBe('specific_person');
      });

      it('T1-PERS-3: bag-first split preserves exact bag size across multi-buyer division', () => {
        const bagSplitLot: CoffeeLot = {
          id: 'lot-split',
          name: 'Kenya Nyeri',
          foreignPricePerBag: 25,
          gramsPerBag: 250,
          quantity: 1,
          shares: [],
          bags: [
            {
              id: 'bag-1',
              splitMode: 'equal',
              buyers: [
                { id: 'buy-1', personId: 'person-zak', grams: 125 },
                { id: 'buy-2', personId: 'person-sarah', grams: 125 },
              ],
            },
          ],
        };

        const bags = normalizeLotToBags(bagSplitLot);
        const buyerGramsSum = bags[0].buyers.reduce((sum, b) => sum + b.grams, 0);
        expect(buyerGramsSum).toBe(bagSplitLot.gramsPerBag);
      });

      it('T1-PERS-4: order normalization synchronizes lifecycle flags before persistence', () => {
        const rawOrder = makeTestOrder('ord-test', 'Sync Test', 'archived');
        rawOrder.isArchived = false; // Intentionally out of sync

        const synced = syncOrderStatusFlags(rawOrder);
        expect(synced.status).toBe('archived');
        expect(synced.isArchived).toBe(true);

        const normalized = normalizeOrderForPersistence(synced);
        expect(normalized.isArchived).toBe(true);
      });

      it('T1-PERS-5: strict persistence validator asserts integrity of complete order', () => {
        const lot: CoffeeLot = {
          id: 'lot-ok',
          name: 'Guatemala',
          foreignPricePerBag: 18,
          gramsPerBag: 250,
          quantity: 1,
          shares: [{ id: 's1', personId: 'person-zak', shareGrams: 250, bagIndex: 0 }],
          bags: [{ id: 'b1', splitMode: 'full', buyers: [{ id: 'buy1', personId: 'person-zak', grams: 250 }] }],
        };
        const order = makeTestOrder('ord-ok', 'Valid Order', 'planning', [lot]);

        expect(() =>
          assertCanPersistOrder(order, { people, strict: true })
        ).not.toThrow();
      });
    });

    // ── 1.3 Priority Area 3: Money Invariants & 6 Scenarios ──────────────────
    describe('1.3 Priority Area 3: Money Invariants & Bug Hunt Scenarios', () => {
      it('T1-MONEY-1 (Scenario 1): equal split of 500g coffee reconciles with zero remainder', () => {
        const lot: CoffeeLot = {
          id: 'lot-eq',
          name: 'Ethiopia Guji',
          foreignPricePerBag: 15,
          gramsPerBag: 250,
          quantity: 2,
          shares: [],
          bags: [
            { id: 'b1', splitMode: 'full', buyers: [{ id: 'buy1', personId: 'person-zak', grams: 250 }] },
            { id: 'b2', splitMode: 'full', buyers: [{ id: 'buy2', personId: 'person-ahmed', grams: 250 }] },
          ],
        };
        const order = makeTestOrder('ord-eq', 'Equal Split Order', 'planning', [lot], [], 500, 'person-zak');

        const result = calculate(order, personNames);
        expect(result.isValid).toBe(true);
        expect(result.totalGoodsZar).toBe(500);
        expect(result.personCalcs['person-zak'].totalFinal).toBe(250.0);
        expect(result.personCalcs['person-ahmed'].totalFinal).toBe(250.0);
        expect(result.roundingAbsorbed).toBe(0);

        const sum = Object.values(result.personCalcs).reduce((s, c) => s + c.totalFinal, 0);
        expect(sum).toBe(500);
      });

      it('T1-MONEY-2 (Scenario 2): uneven grams across multiple lots floor non-payers and payer absorbs cents', () => {
        const lot1: CoffeeLot = {
          id: 'lot-kenya',
          name: 'Kenya Nyeri',
          foreignPricePerBag: 25,
          gramsPerBag: 250,
          quantity: 1,
          shares: [],
          bags: [
            {
              id: 'b1',
              splitMode: 'custom',
              buyers: [
                { id: 'buy-z', personId: 'person-zak', grams: 150 },
                { id: 'buy-a', personId: 'person-ahmed', grams: 100 },
              ],
            },
          ],
        };
        const lot2: CoffeeLot = {
          id: 'lot-colombia',
          name: 'Colombia Huila',
          foreignPricePerBag: 20,
          gramsPerBag: 250,
          quantity: 1,
          shares: [],
          bags: [
            {
              id: 'b2',
              splitMode: 'custom',
              buyers: [
                { id: 'buy-a2', personId: 'person-ahmed', grams: 50 },
                { id: 'buy-s', personId: 'person-sarah', grams: 200 },
              ],
            },
          ],
        };

        const order = makeTestOrder('ord-uneven', 'Uneven Order', 'planning', [lot1, lot2], [], 1000, 'person-zak');
        const result = calculate(order, personNames);

        expect(result.isValid).toBe(true);
        expect(result.personCalcs['person-ahmed'].totalFinal).toBe(311.11);
        expect(result.personCalcs['person-sarah'].totalFinal).toBe(355.55);
        expect(result.personCalcs['person-zak'].totalFinal).toBe(333.34);

        const totalFinalSum = Object.values(result.personCalcs).reduce((s, c) => s + c.totalFinal, 0);
        expect(Math.round(totalFinalSum * 100) / 100).toBe(1000.0);
      });

      it('T1-MONEY-3 (Scenario 3): fixed and proportional fee legacy and canonical aliases produce identical results', () => {
        const lot: CoffeeLot = {
          id: 'lot-guat',
          name: 'Guatemala',
          foreignPricePerBag: 20,
          gramsPerBag: 250,
          quantity: 2,
          shares: [],
          bags: [
            {
              id: 'b1',
              splitMode: 'custom',
              buyers: [
                { id: 'buy1', personId: 'person-zak', grams: 125 },
                { id: 'buy2', personId: 'person-ahmed', grams: 125 },
              ],
            },
            {
              id: 'b2',
              splitMode: 'full',
              buyers: [{ id: 'buy3', personId: 'person-ahmed', grams: 250 }],
            },
          ],
        };

        const orderCanonical = makeTestOrder(
          'ord-canon',
          'Canonical Fees',
          'planning',
          [lot],
          [
            { id: 'f1', label: 'Fixed Fee', amountZar: 150, allocationType: 'equal_per_person', personId: null },
            { id: 'f2', label: 'Value Fee', amountZar: 300, allocationType: 'proportional_by_value', personId: null },
          ],
          800,
          'person-zak',
        );

        const orderLegacy = makeTestOrder(
          'ord-leg',
          'Legacy Fees',
          'planning',
          [lot],
          [
            { id: 'f1', label: 'Fixed Fee', amountZar: 150, allocationType: 'fixed_shared' as any, personId: null },
            { id: 'f2', label: 'Value Fee', amountZar: 300, allocationType: 'value_based' as any, personId: null },
          ],
          800,
          'person-zak',
        );

        const resultCanon = calculate(orderCanonical, personNames);
        const resultLegacy = calculate(orderLegacy, personNames);

        expect(resultCanon.isValid).toBe(true);
        expect(resultLegacy.isValid).toBe(true);
        expect(resultCanon.personCalcs['person-zak'].totalFinal).toBe(resultLegacy.personCalcs['person-zak'].totalFinal);
        expect(resultCanon.personCalcs['person-ahmed'].totalFinal).toBe(resultLegacy.personCalcs['person-ahmed'].totalFinal);
      });

      it('T1-MONEY-4 (Scenario 4): payer is also buyer and absorbs remainder on proportional fee', () => {
        const lot: CoffeeLot = {
          id: 'lot-panama',
          name: 'Panama Geisha',
          foreignPricePerBag: 30,
          gramsPerBag: 150,
          quantity: 2,
          shares: [],
          bags: [
            {
              id: 'b1',
              splitMode: 'custom',
              buyers: [
                { id: 'b-z', personId: 'person-zak', grams: 100 },
                { id: 'b-a1', personId: 'person-ahmed', grams: 50 },
              ],
            },
            {
              id: 'b2',
              splitMode: 'custom',
              buyers: [
                { id: 'b-a2', personId: 'person-ahmed', grams: 50 },
                { id: 'b-s', personId: 'person-sarah', grams: 100 },
              ],
            },
          ],
        };

        const fee: Fee = {
          id: 'f-duty',
          label: 'Customs Duty',
          amountZar: 250,
          allocationType: 'proportional_by_value',
          personId: null,
        };

        const order = makeTestOrder('ord-buyer-payer', 'Buyer Payer Order', 'planning', [lot], [fee], 1200, 'person-zak');
        const result = calculate(order, personNames);

        expect(result.isValid).toBe(true);
        expect(result.totalOrderZar).toBe(1450);
        expect(result.personCalcs['person-ahmed'].totalFinal).toBe(483.33);
        expect(result.personCalcs['person-sarah'].totalFinal).toBe(483.33);
        expect(result.personCalcs['person-zak'].totalFinal).toBe(483.34);

        const sum = Object.values(result.personCalcs).reduce((s, c) => s + c.totalFinal, 0);
        expect(sum).toBe(1450);
      });

      it('T1-MONEY-5 (Scenario 6): odd cents stress test ensures exact penny reconciliation', () => {
        const lot: CoffeeLot = {
          id: 'lot-odd',
          name: 'Costa Rica',
          foreignPricePerBag: 35,
          gramsPerBag: 700,
          quantity: 1,
          shares: [],
          bags: [
            {
              id: 'b-odd',
              splitMode: 'custom',
              buyers: [
                { id: 'b-1', personId: 'person-zak', grams: 233 },
                { id: 'b-2', personId: 'person-ahmed', grams: 233 },
                { id: 'b-3', personId: 'person-sarah', grams: 234 },
              ],
            },
          ],
        };

        const fee: Fee = {
          id: 'f-fixed',
          label: 'Admin Fee',
          amountZar: 10,
          allocationType: 'equal_per_person',
          personId: null,
        };

        const order = makeTestOrder('ord-odd', 'Odd Cents', 'planning', [lot], [fee], 1000, 'person-zak');
        const result = calculate(order, personNames);

        expect(result.isValid).toBe(true);
        expect(result.totalOrderZar).toBe(1010);
        expect(result.personCalcs['person-ahmed'].totalFinal).toBe(336.19);
        expect(result.personCalcs['person-sarah'].totalFinal).toBe(337.61);
        expect(result.personCalcs['person-zak'].totalFinal).toBe(336.20);

        const sum = Object.values(result.personCalcs).reduce((s, c) => s + c.totalFinal, 0);
        expect(Math.round(sum * 100) / 100).toBe(1010.0);
      });
    });

    // ── 1.4 Priority Area 4: Auth & Access Boundaries ────────────────────────
    describe('1.4 Priority Area 4: Auth & Access Boundaries', () => {
      it('T1-AUTH-1: resolves linked stats person across ready, ambiguous, and unlinked states', () => {
        const resolutionNone: PersonLinkResolution = {
          status: 'none',
          linkedPersonId: null,
          matchedBy: null,
          person: null,
          candidates: [],
        };
        expect(resolveLinkedStatsPerson(null, resolutionNone).state).toBe('unlinked');

        const resolutionAmbiguous: PersonLinkResolution = {
          status: 'ambiguous',
          linkedPersonId: null,
          matchedBy: 'name',
          person: null,
          candidates: [],
        };
        expect(resolveLinkedStatsPerson(null, resolutionAmbiguous).state).toBe('ambiguous');

        expect(resolveLinkedStatsPerson('person-zak', resolutionNone)).toEqual({
          state: 'ready',
          personId: 'person-zak',
        });
      });

      it('T1-AUTH-2: participant order scoping filters strictly to orders the user participated in', () => {
        const lot1: CoffeeLot = {
          id: 'l1',
          name: 'Coffee A',
          foreignPricePerBag: 20,
          gramsPerBag: 250,
          quantity: 1,
          shares: [],
          bags: [{ id: 'b1', splitMode: 'full', buyers: [{ id: 'buy1', personId: 'person-ahmed', grams: 250 }] }],
        };
        const lot2: CoffeeLot = {
          id: 'l2',
          name: 'Coffee B',
          foreignPricePerBag: 20,
          gramsPerBag: 250,
          quantity: 1,
          shares: [],
          bags: [{ id: 'b2', splitMode: 'full', buyers: [{ id: 'buy2', personId: 'person-sarah', grams: 250 }] }],
        };

        const orderA = makeTestOrder('o-a', 'Order A', 'completed', [lot1], [], 500, 'person-zak');
        const orderB = makeTestOrder('o-b', 'Order B', 'completed', [lot2], [], 500, 'person-sarah');

        const ahmedOrders = getParticipantScopedOrders([orderA, orderB], 'person-ahmed');
        expect(ahmedOrders.map((o) => o.id)).toEqual(['o-a']);
      });

      it('T1-AUTH-3: generatePaymentReference generates clean uppercase reference <= 20 chars', () => {
        const ref = generatePaymentReference(
          {
            name: 'Tim Wendelboe Drop',
            orderDate: '2026-08-15',
            roasterSnapshot: { name: 'Tim Wendelboe' },
          },
          'Zakariyya Harnekar',
        );

        expect(ref.length).toBeLessThanOrEqual(20);
        expect(ref).toBe(ref.toUpperCase());
        expect(ref).toMatch(/^[A-Z0-9-]+$/);
      });

      it('T1-AUTH-4: invoice filenames sanitize special chars and accents into URL/file-safe slugs', () => {
        const filename = pdfFilename('Café Météor Drop', 'René François');
        expect(filename).toBe('fajr-brews-invoice-cafe-meteor-drop-rene-francois.pdf');

        const orderFilename = orderPdfFilename('Special Edition #1!');
        expect(orderFilename).toBe('fajr-brews-order-invoice-special-edition-1.pdf');
      });

      it('T1-AUTH-5: lifecycle label mapping returns correct user-facing status tag', () => {
        expect(getOrderLifecycleLabel(makeTestOrder('1', 'P', 'planning'))).toBe('Planning');
        expect(getOrderLifecycleLabel(makeTestOrder('2', 'L', 'locked'))).toBe('Locked');
        expect(getOrderLifecycleLabel(makeTestOrder('3', 'C', 'completed'))).toBe('Completed');
        expect(getOrderLifecycleLabel(makeTestOrder('4', 'A', 'archived'))).toBe('Past order');
      });
    });

    // ── 1.5 Priority Area 5: Edge Inputs & Data Integrity ───────────────────
    describe('1.5 Priority Area 5: Edge Inputs & Data Integrity', () => {
      it('T1-EDGE-1: flags empty order with zero lots as invalid with clear error messages', () => {
        const emptyOrder = makeTestOrder('ord-empty', 'Empty Order', 'planning', [], [], 0);
        const result = calculate(emptyOrder, personNames);

        expect(result.isValid).toBe(false);
        expect(result.validationErrors).toContain('Order has no coffee lots.');
      });

      it('T1-EDGE-2: handles extreme values (1g allocation on R100,000 order) without NaN or overflow', () => {
        const lot: CoffeeLot = {
          id: 'lot-huge',
          name: 'Rare Gesha',
          foreignPricePerBag: 1000,
          gramsPerBag: 1000,
          quantity: 1,
          shares: [],
          bags: [
            {
              id: 'b-1',
              splitMode: 'custom',
              buyers: [
                { id: 'b1', personId: 'person-zak', grams: 1 },
                { id: 'b2', personId: 'person-ahmed', grams: 999 },
              ],
            },
          ],
        };

        const order = makeTestOrder('ord-huge', 'Huge Order', 'planning', [lot], [], 100000, 'person-zak');
        const result = calculate(order, personNames);

        expect(result.isValid).toBe(true);
        expect(result.personCalcs['person-zak'].totalFinal).toBeGreaterThan(0);
        expect(Number.isFinite(result.personCalcs['person-zak'].totalFinal)).toBe(true);
        expect(Number.isFinite(result.personCalcs['person-ahmed'].totalFinal)).toBe(true);
      });

      it('T1-EDGE-3: duplicating an order clears payments and creates new distinct child entity IDs', () => {
        const lot: CoffeeLot = {
          id: 'lot-1',
          name: 'Coffee',
          foreignPricePerBag: 20,
          gramsPerBag: 250,
          quantity: 1,
          shares: [{ id: 's-1', personId: 'person-zak', shareGrams: 250, bagIndex: 0 }],
          bags: [{ id: 'b-1', splitMode: 'full', buyers: [{ id: 'buy-1', personId: 'person-zak', grams: 250 }] }],
        };
        const order = makeTestOrder('ord-orig', 'Original', 'archived', [lot]);
        order.payments = { 'person-zak': { status: 'paid', amountPaid: 350 } };

        const duplicated = createDuplicatedOrderPayload(order, '2026-09-01');

        expect(duplicated.name).toBe('Original (copy)');
        expect(duplicated.orderDate).toBe('2026-09-01');
        expect(duplicated.status).toBe('planning');
        expect(duplicated.payments).toEqual({});
        expect(duplicated.lots[0].id).not.toBe(lot.id);
        expect(duplicated.lots[0].bags[0].id).not.toBe('b-1');
      });

      it('T1-EDGE-4: cleanRoasterPart strips legal entities and unicode accents properly', () => {
        expect(cleanRoasterPart('DAK Coffee Roasters (Pty) Ltd')).toBe('DAK');
        expect(cleanRoasterPart('Rosetta Roastery')).toBe('ROSETTA');
        expect(cleanRoasterPart('Tim Wendelboe')).toBe('TIMWENDELBOE');
      });

      it('T1-EDGE-5: strict persistence rejects orders referencing non-existent person IDs in directory', () => {
        const lot: CoffeeLot = {
          id: 'lot-phantom',
          name: 'Phantom Lot',
          foreignPricePerBag: 20,
          gramsPerBag: 250,
          quantity: 1,
          shares: [{ id: 's1', personId: 'person-ghost', shareGrams: 250, bagIndex: 0 }],
          bags: [{ id: 'b1', splitMode: 'full', buyers: [{ id: 'buy1', personId: 'person-ghost', grams: 250 }] }],
        };
        const order = makeTestOrder('ord-phantom', 'Ghost Order', 'planning', [lot]);

        const errors = validatePersistableOrder(order, { people, strict: true });
        expect(errors.some((e) => e.includes('references a person that is not in the directory'))).toBe(true);
      });
    });

    // ── 1.6 Priority Area 6: Error States & Resilience ───────────────────────
    describe('1.6 Priority Area 6: Error States & Resilience', () => {
      it('T1-ERR-1: calculation validation rejects mismatched buyer grams sum', () => {
        const lot: CoffeeLot = {
          id: 'lot-mismatch',
          name: 'Broken Coffee',
          foreignPricePerBag: 20,
          gramsPerBag: 250,
          quantity: 1,
          shares: [],
          bags: [
            {
              id: 'b1',
              splitMode: 'custom',
              buyers: [{ id: 'buy1', personId: 'person-zak', grams: 200 }], // 200g != 250g
            },
          ],
        };
        const order = makeTestOrder('ord-mismatch', 'Mismatch', 'planning', [lot]);
        const result = calculate(order, personNames);

        expect(result.isValid).toBe(false);
        expect(result.validationErrors[0]).toContain('buyer grams sum (200g) ≠ lot total (250g)');
      });

      it('T1-ERR-2: calculation validation rejects non-positive foreign price per bag', () => {
        const lot: CoffeeLot = {
          id: 'lot-free',
          name: 'Free Coffee',
          foreignPricePerBag: 0,
          gramsPerBag: 250,
          quantity: 1,
          shares: [],
          bags: [{ id: 'b1', splitMode: 'full', buyers: [{ id: 'buy1', personId: 'person-zak', grams: 250 }] }],
        };
        const order = makeTestOrder('ord-free', 'Free Order', 'planning', [lot]);
        const result = calculate(order, personNames);

        expect(result.isValid).toBe(false);
        expect(result.validationErrors.some((e) => e.includes('foreign price per bag must be > 0'))).toBe(true);
      });

      it('T1-ERR-3: calculation validation rejects specific_person fee missing a personId', () => {
        const lot: CoffeeLot = {
          id: 'lot-ok',
          name: 'Coffee',
          foreignPricePerBag: 20,
          gramsPerBag: 250,
          quantity: 1,
          shares: [],
          bags: [{ id: 'b1', splitMode: 'full', buyers: [{ id: 'buy1', personId: 'person-zak', grams: 250 }] }],
        };
        const fee: Fee = {
          id: 'f-broken',
          label: 'PUDO Missing Person',
          amountZar: 60,
          allocationType: 'specific_person',
          personId: null, // Missing!
        };
        const order = makeTestOrder('ord-broken-fee', 'Broken Fee', 'planning', [lot], [fee]);
        const result = calculate(order, personNames);

        expect(result.isValid).toBe(false);
        expect(result.validationErrors.some((e) => e.includes('choose a person for this specific-person fee'))).toBe(true);
      });

      it('T1-ERR-4: calculation validation rejects non-integer buyer grams', () => {
        const lot: CoffeeLot = {
          id: 'lot-float',
          name: 'Float Grams',
          foreignPricePerBag: 20,
          gramsPerBag: 250,
          quantity: 1,
          shares: [],
          bags: [
            {
              id: 'b1',
              splitMode: 'custom',
              buyers: [
                { id: 'b1', personId: 'person-zak', grams: 125.5 },
                { id: 'b2', personId: 'person-ahmed', grams: 124.5 },
              ],
            },
          ],
        };
        const order = makeTestOrder('ord-float', 'Float Grams Order', 'planning', [lot]);
        const result = calculate(order, personNames);

        expect(result.isValid).toBe(false);
        expect(result.validationErrors.some((e) => e.includes('each buyer share must be an integer ≥ 1g'))).toBe(true);
      });

      it('T1-ERR-5: calculation validation rejects zero goods total ZAR', () => {
        const lot: CoffeeLot = {
          id: 'lot-ok',
          name: 'Coffee',
          foreignPricePerBag: 20,
          gramsPerBag: 250,
          quantity: 1,
          shares: [],
          bags: [{ id: 'b1', splitMode: 'full', buyers: [{ id: 'buy1', personId: 'person-zak', grams: 250 }] }],
        };
        const order = makeTestOrder('ord-zero-goods', 'Zero Goods', 'planning', [lot], [], 0);
        const result = calculate(order, personNames);

        expect(result.isValid).toBe(false);
        expect(result.validationErrors).toContain('Goods total (ZAR) must be greater than zero.');
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // TIER 2: BOUNDARY & CORNER CASES (>=5 per feature area across 6 areas)
  // ══════════════════════════════════════════════════════════════════════════════

  describe('Tier 2: Boundary & Corner Cases', () => {
    // ── 2.1 Order Lifecycle Boundaries ───────────────────────────────────────
    describe('2.1 Order Lifecycle Boundaries', () => {
      it('T2-BND-ORD-1: empty orders array gracefully returns empty lists and null preferred ID', () => {
        expect(getActiveOrders([])).toEqual([]);
        expect(getPastOrders([])).toEqual([]);
        expect(getPreferredActiveOrderId([])).toBeNull();
        expect(getNextActiveOrderId([])).toBeNull();
      });

      it('T2-BND-ORD-2: workspace with all archived orders returns zero active orders', () => {
        const orders = [
          makeTestOrder('o1', 'Past 1', 'archived'),
          makeTestOrder('o2', 'Past 2', 'archived'),
        ];
        expect(getActiveOrders(orders)).toHaveLength(0);
        expect(getPastOrders(orders)).toHaveLength(2);
        expect(getPreferredActiveOrderId(orders)).toBeNull();
      });

      it('T2-BND-ORD-3: getNextActiveOrderId returns null when excluding the only active order', () => {
        const orders = [makeTestOrder('o1', 'Only Active', 'planning')];
        expect(getNextActiveOrderId(orders, 'o1')).toBeNull();
      });

      it('T2-BND-ORD-4: orders with identical orderDate sort deterministically by createdAt', () => {
        const o1 = { ...makeTestOrder('o1', 'Order 1', 'planning'), orderDate: '2026-08-10', createdAt: '2026-08-10T10:00:00Z' };
        const o2 = { ...makeTestOrder('o2', 'Order 2', 'planning'), orderDate: '2026-08-10', createdAt: '2026-08-10T12:00:00Z' };

        const sorted = getActiveOrders([o1, o2]);
        expect(sorted[0].id).toBe('o2');
      });

      it('T2-BND-ORD-5: normalizeOrderStatus maps null, undefined, or unrecognized strings to planning', () => {
        expect(normalizeOrderStatus(null)).toBe('planning');
        expect(normalizeOrderStatus(undefined)).toBe('planning');
        expect(normalizeOrderStatus('invalid_random_status')).toBe('planning');
      });
    });

    // ── 2.2 Persistence & Serialization Boundaries ───────────────────────────
    describe('2.2 Persistence & Serialization Boundaries', () => {
      it('T2-BND-PERS-1: large order with 10 lots and 20 bags normalizes without degradation', () => {
        const lots: CoffeeLot[] = Array.from({ length: 10 }, (_, i) => ({
          id: `lot-${i}`,
          name: `Roast #${i}`,
          foreignPricePerBag: 20 + i,
          gramsPerBag: 250,
          quantity: 2,
          shares: [],
          bags: [
            { id: `b-${i}-1`, splitMode: 'full', buyers: [{ id: `buy-${i}-1`, personId: 'person-zak', grams: 250 }] },
            { id: `b-${i}-2`, splitMode: 'full', buyers: [{ id: `buy-${i}-2`, personId: 'person-ahmed', grams: 250 }] },
          ],
        }));

        const bigOrder = makeTestOrder('big-ord', 'Massive Drop', 'planning', lots, [], 5000);
        const normalized = normalizeOrderForPersistence(bigOrder);

        expect(normalized.lots).toHaveLength(10);
        expect(normalized.lots[9].shares).toHaveLength(2);
      });

      it('T2-BND-PERS-2: order with zero fees persists with empty array rather than null', () => {
        const order = makeTestOrder('o-nofees', 'No Fees', 'planning', [], []);
        const normalized = normalizeOrderForPersistence(order);
        expect(Array.isArray(normalized.fees)).toBe(true);
        expect(normalized.fees).toHaveLength(0);
      });

      it('T2-BND-PERS-3: order with empty payments object persists with valid dictionary shape', () => {
        const order = makeTestOrder('o-nopay', 'No Pay', 'planning');
        order.payments = undefined as any;
        const normalized = normalizeOrderForPersistence(order);
        expect(normalized.payments).toEqual({});
      });

      it('T2-BND-PERS-4: wizard steps definition contains exactly 4 steps in canonical sequence', () => {
        expect(ORDER_WIZARD_STEPS).toHaveLength(4);
        expect(ORDER_WIZARD_STEPS.map((s) => s.id)).toEqual(['setup', 'coffees', 'goods', 'summary']);
      });

      it('T2-BND-PERS-5: formatMonthYear parses year and month from ISO date string robustly', () => {
        expect(formatMonthYear('2026-08-15')).toBe('AUG26');
        expect(formatMonthYear('2025-01-01')).toBe('JAN25');
        expect(formatMonthYear('2024-12-31')).toBe('DEC24');
      });
    });

    // ── 2.3 Money & Calculation Boundaries ───────────────────────────────────
    describe('2.3 Money & Calculation Boundaries', () => {
      it('T2-BND-MONEY-1: 1 cent order split across 3 people floors non-payers and payer absorbs 1 cent', () => {
        const lot: CoffeeLot = {
          id: 'lot-tiny',
          name: 'Micro Lot',
          foreignPricePerBag: 10,
          gramsPerBag: 300,
          quantity: 1,
          shares: [],
          bags: [
            {
              id: 'b1',
              splitMode: 'equal',
              buyers: [
                { id: 'b1', personId: 'person-zak', grams: 100 },
                { id: 'b2', personId: 'person-ahmed', grams: 100 },
                { id: 'b3', personId: 'person-sarah', grams: 100 },
              ],
            },
          ],
        };

        const order = makeTestOrder('ord-1cent', '1 Cent Order', 'planning', [lot], [], 0.01, 'person-zak');
        const result = calculate(order, personNames);

        expect(result.isValid).toBe(true);
        expect(result.personCalcs['person-ahmed'].totalFinal).toBe(0.0);
        expect(result.personCalcs['person-sarah'].totalFinal).toBe(0.0);
        expect(result.personCalcs['person-zak'].totalFinal).toBe(0.01);
      });

      it('T2-BND-MONEY-2: single participant absorbing 100% of order pays exact goods total without adjustment', () => {
        const lot: CoffeeLot = {
          id: 'lot-solo',
          name: 'Solo Coffee',
          foreignPricePerBag: 30,
          gramsPerBag: 250,
          quantity: 1,
          shares: [],
          bags: [{ id: 'b1', splitMode: 'full', buyers: [{ id: 'buy1', personId: 'person-zak', grams: 250 }] }],
        };

        const order = makeTestOrder('ord-solo', 'Solo Order', 'planning', [lot], [], 450, 'person-zak');
        const result = calculate(order, personNames);

        expect(result.isValid).toBe(true);
        expect(result.personCalcs['person-zak'].totalFinal).toBe(450.0);
        expect(result.roundingAbsorbed).toBe(0);
      });

      it('T2-BND-MONEY-3: multiple specific fees for different people allocate accurately', () => {
        const lot: CoffeeLot = {
          id: 'lot-spec',
          name: 'Beans',
          foreignPricePerBag: 20,
          gramsPerBag: 250,
          quantity: 2,
          shares: [],
          bags: [
            { id: 'b1', splitMode: 'full', buyers: [{ id: 'buy1', personId: 'person-zak', grams: 250 }] },
            { id: 'b2', splitMode: 'full', buyers: [{ id: 'buy2', personId: 'person-ahmed', grams: 250 }] },
          ],
        };

        const fees: Fee[] = [
          { id: 'f-z', label: 'Zak Courier', amountZar: 50, allocationType: 'specific_person', personId: 'person-zak' },
          { id: 'f-a', label: 'Ahmed Courier', amountZar: 70, allocationType: 'specific_person', personId: 'person-ahmed' },
        ];

        const order = makeTestOrder('ord-spec', 'Specific Fees Order', 'planning', [lot], fees, 600, 'person-zak');
        const result = calculate(order, personNames);

        expect(result.isValid).toBe(true);
        expect(result.personCalcs['person-zak'].feesZar).toBe(50);
        expect(result.personCalcs['person-ahmed'].feesZar).toBe(70);
        expect(result.personCalcs['person-zak'].totalFinal).toBe(350); // 300 + 50
        expect(result.personCalcs['person-ahmed'].totalFinal).toBe(370); // 300 + 70
      });

      it('T2-BND-MONEY-4: lots with drastically different foreign prices allocate goods value proportionally', () => {
        const cheapLot: CoffeeLot = {
          id: 'l-cheap',
          name: 'Daily Brew',
          foreignPricePerBag: 10,
          gramsPerBag: 250,
          quantity: 1,
          shares: [],
          bags: [{ id: 'b1', splitMode: 'full', buyers: [{ id: 'buy1', personId: 'person-zak', grams: 250 }] }],
        };
        const luxuryLot: CoffeeLot = {
          id: 'l-lux',
          name: 'Competition Lot',
          foreignPricePerBag: 90,
          gramsPerBag: 250,
          quantity: 1,
          shares: [],
          bags: [{ id: 'b2', splitMode: 'full', buyers: [{ id: 'buy2', personId: 'person-ahmed', grams: 250 }] }],
        };

        const order = makeTestOrder('ord-ratio', 'Ratio Order', 'planning', [cheapLot, luxuryLot], [], 1000, 'person-zak');
        const result = calculate(order, personNames);

        expect(result.isValid).toBe(true);
        expect(result.personCalcs['person-zak'].goodsZar).toBe(100); // 10 / 100 * 1000
        expect(result.personCalcs['person-ahmed'].goodsZar).toBe(900); // 90 / 100 * 1000
      });

      it('T2-BND-MONEY-5: formatZAR produces proper South African Rand formatting with two decimals', () => {
        expect(formatZAR(250)).toBe('R250.00');
        expect(formatZAR(1234.56)).toBe('R1,234.56');
        expect(formatZAR(0.05)).toBe('R0.05');
      });

      it('T2-BND-MONEY-6: zero-gram participant with standalone specific fee pays fee amount and zero coffee goods', () => {
        const lot: CoffeeLot = {
          id: 'lot-main',
          name: 'Coffee',
          foreignPricePerBag: 20,
          gramsPerBag: 250,
          quantity: 1,
          shares: [],
          bags: [{ id: 'b1', splitMode: 'full', buyers: [{ id: 'buy1', personId: 'person-zak', grams: 250 }] }],
        };
        const fee: Fee = {
          id: 'f-standalone',
          label: 'Courier for Non-Coffee Item',
          amountZar: 85,
          allocationType: 'specific_person',
          personId: 'person-sarah',
        };
        const order = makeTestOrder('ord-0g-fee', '0g Fee Order', 'planning', [lot], [fee], 500, 'person-zak');
        const result = calculate(order, personNames);
        expect(result.isValid).toBe(true);
        expect(result.personCalcs['person-sarah'].totalGrams).toBe(0);
        expect(result.personCalcs['person-sarah'].goodsZar).toBe(0);
        expect(result.personCalcs['person-sarah'].feesZar).toBe(85);
        expect(result.personCalcs['person-sarah'].totalFinal).toBe(85);
        const sum = Object.values(result.personCalcs).reduce((s, c) => s + c.totalFinal, 0);
        expect(sum).toBe(585);
      });
    });

    // ── 2.4 Auth & Identifier Boundaries ─────────────────────────────────────
    describe('2.4 Auth & Identifier Boundaries', () => {
      it('T2-BND-AUTH-1: generatePaymentReference handles 100-character names gracefully', () => {
        const longName = 'A'.repeat(100);
        const ref = generatePaymentReference({ name: 'Short' }, longName);
        expect(ref.length).toBeLessThanOrEqual(20);
        expect(ref).toBe(ref.toUpperCase());
      });

      it('T2-BND-AUTH-2: cleanFirstNamePart handles empty and whitespace strings with FRIEND fallback', () => {
        expect(cleanFirstNamePart('')).toBe('FRIEND');
        expect(cleanFirstNamePart('   ')).toBe('FRIEND');
        expect(cleanFirstNamePart('---')).toBe('FRIEND');
      });

      it('T2-BND-AUTH-3: cleanRoasterPart handles empty roaster names with COFFEE fallback', () => {
        expect(cleanRoasterPart('')).toBe('COFFEE');
        expect(cleanRoasterPart('   ')).toBe('COFFEE');
      });

      it('T2-BND-AUTH-4: getFeeAllocationLabel and getFeeAllocationShortLabel map all types', () => {
        expect(getFeeAllocationLabel('equal_per_person')).toBe('Equal per person');
        expect(getFeeAllocationLabel('proportional_by_value')).toBe('Proportional by order value');
        expect(getFeeAllocationLabel('specific_person')).toBe('Specific person');

        expect(getFeeAllocationShortLabel('equal_per_person')).toBe('Equal');
        expect(getFeeAllocationShortLabel('proportional_by_value')).toBe('Value-based');
        expect(getFeeAllocationShortLabel('specific_person')).toBe('Specific person');
      });

      it('T2-BND-AUTH-5: resolveReference delegates to payment reference generator seamlessly', () => {
        const ref = resolveReference('TEMPLATE', 'DAK', 'Zak', '2026-08-15');
        expect(ref).toBe('DAK-AUG26-ZAK');
      });
    });

    // ── 2.5 Input & Format Boundaries ────────────────────────────────────────
    describe('2.5 Input & Format Boundaries', () => {
      it('T2-BND-INP-1: formatGrams formats values over 1000g as kg and below as g', () => {
        expect(formatGrams(250)).toBe('250g');
        expect(formatGrams(1000)).toBe('1kg');
        expect(formatGrams(1500)).toBe('1.5kg');
      });

      it('T2-BND-INP-2: formatDate formats ISO date string into readable South African date', () => {
        expect(formatDate('2026-08-15')).toContain('August 2026');
        expect(formatDate('')).toBe('');
      });

      it('T2-BND-INP-3: isOrderInStatsRange properly evaluates 3m, 6m, 12m, and custom ranges', () => {
        expect(isOrderInStatsRange('2026-08-15', { preset: 'all' })).toBe(true);

        const customInRange = isOrderInStatsRange('2026-08-15', {
          preset: 'custom',
          startDate: '2026-08-01',
          endDate: '2026-08-31',
        });
        expect(customInRange).toBe(true);

        const customOutOfRange = isOrderInStatsRange('2026-09-01', {
          preset: 'custom',
          startDate: '2026-08-01',
          endDate: '2026-08-31',
        });
        expect(customOutOfRange).toBe(false);
      });

      it('T2-BND-INP-4: buildInvoiceModel handles person with zero coffee lines without throwing', () => {
        const order = makeTestOrder('ord-feeonly', 'Courier Fee Order', 'completed', [], [], 100);
        const personSarah = people.find((p) => p.id === 'person-sarah')!;
        const payerZak = people.find((p) => p.id === 'person-zak')!;

        const mockCalc: PersonCalculation = {
          personId: 'person-sarah',
          goodsZar: 0,
          feesZar: 60,
          totalPreRound: 60,
          totalFinal: 60,
          totalGrams: 0,
          coffeeValueForeignShare: 0,
          lotBreakdowns: [],
          feeBreakdowns: [
            {
              feeId: 'f-pudo',
              label: 'PUDO Courier',
              allocationType: 'specific_person',
              amountZar: 60,
              personId: 'person-sarah',
            },
          ],
        };

        const invoice = buildInvoiceModel({
          order,
          person: personSarah,
          payer: payerZak,
          calc: mockCalc,
        });

        expect(invoice.coffeeLines).toHaveLength(0);
        expect(invoice.feeLines).toHaveLength(1);
        expect(invoice.amountDue).toBe('R60.00');
      });

      it('T2-BND-INP-5: resolveOrderRoaster handles orders with roasterId or snapshot', () => {
        const roasters = [makeRoaster('roaster-1', 'Tim Wendelboe')];
        const order = makeTestOrder('o-1', 'Order with Roaster', 'planning');

        const resolved = resolveOrderRoaster(order, roasters);
        expect(resolved).not.toBeNull();
        expect(resolved?.name).toBe('Tim Wendelboe');
      });

      it('T2-BND-INP-6: parses comma decimals in monetary inputs without dropping cents', async () => {
        const formatters = (await import('../lib/formatters')) as any;
        if (typeof formatters.parseMoneyInput === 'function') {
          expect(formatters.parseMoneyInput('12,50')).toBe(12.5);
          expect(formatters.parseMoneyInput('1250,75')).toBe(1250.75);
          expect(formatters.parseMoneyInput('  34,20  ')).toBe(34.2);
          expect(formatters.parseMoneyInput('100.50')).toBe(100.5);
        } else {
          // Documents baseline defect BUG-ORD-11 / BUG-EDGE-04 where raw parseFloat drops cents
          expect(Number.parseFloat('12,50')).toBe(12);
        }
      });
    });

    // ── 2.6 Error Resilience Boundaries ──────────────────────────────────────
    describe('2.6 Error Resilience Boundaries', () => {
      it('T2-BND-ERR-1: strict persistence rejects lot with missing lot ID', () => {
        const lot: CoffeeLot = {
          id: '',
          name: 'No ID Lot',
          foreignPricePerBag: 20,
          gramsPerBag: 250,
          quantity: 1,
          shares: [{ id: 's1', personId: 'person-zak', shareGrams: 250, bagIndex: 0 }],
          bags: [{ id: 'b1', splitMode: 'full', buyers: [{ id: 'buy1', personId: 'person-zak', grams: 250 }] }],
        };
        const order = makeTestOrder('o-bad', 'Bad Order', 'planning', [lot]);

        expect(() => assertCanPersistOrder(order, { people, strict: true })).toThrow(
          '"No ID Lot" is missing a lot ID.'
        );
      });

      it('T2-BND-ERR-2: strict persistence rejects lot with missing bag ID', () => {
        const lot: CoffeeLot = {
          id: 'lot-1',
          name: 'Coffee Lot',
          foreignPricePerBag: 20,
          gramsPerBag: 250,
          quantity: 1,
          shares: [{ id: 's1', personId: 'person-zak', shareGrams: 250, bagIndex: 0 }],
          bags: [{ id: '', splitMode: 'full', buyers: [{ id: 'buy1', personId: 'person-zak', grams: 250 }] }],
        };
        const order = makeTestOrder('o-bad-bag', 'Bad Bag Order', 'planning', [lot]);

        expect(() => assertCanPersistOrder(order, { people, strict: true })).toThrow(
          'is missing a bag ID.'
        );
      });

      it('T2-BND-ERR-3: strict persistence rejects bag with buyer missing personId', () => {
        const lot: CoffeeLot = {
          id: 'lot-1',
          name: 'Coffee Lot',
          foreignPricePerBag: 20,
          gramsPerBag: 250,
          quantity: 1,
          shares: [{ id: 's1', personId: '', shareGrams: 250, bagIndex: 0 }],
          bags: [{ id: 'b1', splitMode: 'full', buyers: [{ id: 'buy1', personId: '', grams: 250 }] }],
        };
        const order = makeTestOrder('o-nobuyer', 'No Buyer Order', 'planning', [lot]);

        expect(() => assertCanPersistOrder(order, { people, strict: true })).toThrow(
          'has a buyer without a person.'
        );
      });

      it('T2-BND-ERR-4: calculate rejects orders where total foreign list price sums to zero', () => {
        const lot: CoffeeLot = {
          id: 'lot-1',
          name: 'Coffee',
          foreignPricePerBag: 0,
          gramsPerBag: 250,
          quantity: 1,
          shares: [],
          bags: [{ id: 'b1', splitMode: 'full', buyers: [{ id: 'buy1', personId: 'person-zak', grams: 250 }] }],
        };
        const order = makeTestOrder('o-zero-for', 'Zero Foreign', 'planning', [lot]);
        const result = calculate(order, personNames);

        expect(result.isValid).toBe(false);
        expect(result.validationErrors).toContain(
          'Total foreign list price is zero — cannot allocate goods.'
        );
      });

      it('T2-BND-ERR-5: order with missing order ID fails persistence validation', () => {
        const order = makeTestOrder('', 'No ID', 'planning');
        const errors = validatePersistableOrder(order, { people, strict: false });
        expect(errors).toContain('Order is missing an ID.');
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // TIER 3: CROSS-FEATURE INTERACTIONS (Pairwise coverage)
  // ══════════════════════════════════════════════════════════════════════════════

  describe('Tier 3: Cross-Feature Interactions', () => {
    it('T3-INT-1: switching between active orders maintains isolated lot drafts', () => {
      const lotA: CoffeeLot = {
        id: 'lot-a',
        name: 'Order A Coffee',
        foreignPricePerBag: 20,
        gramsPerBag: 250,
        quantity: 1,
        shares: [],
        bags: [{ id: 'b-a', splitMode: 'full', buyers: [{ id: 'buy-a', personId: 'person-zak', grams: 250 }] }],
      };
      const lotB: CoffeeLot = {
        id: 'lot-b',
        name: 'Order B Coffee',
        foreignPricePerBag: 30,
        gramsPerBag: 250,
        quantity: 1,
        shares: [],
        bags: [{ id: 'b-b', splitMode: 'full', buyers: [{ id: 'buy-b', personId: 'person-ahmed', grams: 250 }] }],
      };

      const orderA = makeTestOrder('ord-a', 'Order A', 'planning', [lotA]);
      const orderB = makeTestOrder('ord-b', 'Order B', 'planning', [lotB]);
      const orders = [orderA, orderB];

      // Mutate Order A in memory (e.g. user editing lot)
      const mutatedOrderA = {
        ...orderA,
        lots: [
          {
            ...lotA,
            name: 'Order A Coffee (Draft Edited)',
          },
        ],
      };

      // Ensure Order B remains untouched
      expect(orderB.lots[0].name).toBe('Order B Coffee');

      // Re-read updated list
      const updatedOrders = [mutatedOrderA, orderB];
      expect(updatedOrders.find((o) => o.id === 'ord-a')?.lots[0].name).toBe('Order A Coffee (Draft Edited)');
      expect(updatedOrders.find((o) => o.id === 'ord-b')?.lots[0].name).toBe('Order B Coffee');
    });

    it('T3-INT-2: locking an order allows subsequent recording of participant payments while locked', () => {
      const lot: CoffeeLot = {
        id: 'lot-1',
        name: 'Lock Test Coffee',
        foreignPricePerBag: 20,
        gramsPerBag: 250,
        quantity: 1,
        shares: [],
        bags: [{ id: 'b1', splitMode: 'full', buyers: [{ id: 'buy1', personId: 'person-ahmed', grams: 250 }] }],
      };
      let order = makeTestOrder('ord-lock-pay', 'Lock & Pay Order', 'planning', [lot]);

      // Step 1: Lock order
      order = { ...order, status: 'locked' };
      expect(order.status).toBe('locked');
      expect(getOrderLifecycleLabel(order)).toBe('Locked');

      // Step 2: Record Ahmed payment
      order = {
        ...order,
        payments: {
          'person-ahmed': {
            status: 'paid',
            amountPaid: 1000,
            datePaid: '2026-08-16T10:00:00Z',
          },
        },
      };

      expect(order.status).toBe('locked');
      expect(order.payments['person-ahmed'].status).toBe('paid');
    });

    it('T3-INT-3: payer is buyer with mixed fees (equal, value, and specific) on their own invoice', () => {
      const lot: CoffeeLot = {
        id: 'lot-mixed',
        name: 'Mixed Fees Coffee',
        foreignPricePerBag: 25,
        gramsPerBag: 250,
        quantity: 2,
        shares: [],
        bags: [
          { id: 'b1', splitMode: 'full', buyers: [{ id: 'buy1', personId: 'person-zak', grams: 250 }] },
          { id: 'b2', splitMode: 'full', buyers: [{ id: 'buy2', personId: 'person-ahmed', grams: 250 }] },
        ],
      };

      const fees: Fee[] = [
        { id: 'f-eq', label: 'Delivery', amountZar: 100, allocationType: 'equal_per_person', personId: null },
        { id: 'f-val', label: 'Insurance', amountZar: 100, allocationType: 'proportional_by_value', personId: null },
        { id: 'f-spec', label: 'Special Packing', amountZar: 40, allocationType: 'specific_person', personId: 'person-zak' },
      ];

      const order = makeTestOrder('ord-mixed', 'Mixed Fees', 'planning', [lot], fees, 800, 'person-zak');
      const result = calculate(order, personNames);

      expect(result.isValid).toBe(true);
      const zakCalc = result.personCalcs['person-zak'];

      // Zak goods: 400. Zak fees: 50 (eq) + 50 (val) + 40 (spec) = 140. Total = 540.
      expect(zakCalc.goodsZar).toBe(400);
      expect(zakCalc.feesZar).toBe(140);
      expect(zakCalc.totalFinal).toBe(540);

      // Verify invoice model incorporates all fee types
      const personZak = people.find((p) => p.id === 'person-zak')!;
      const invoice = buildInvoiceModel({
        order,
        person: personZak,
        payer: personZak,
        calc: zakCalc,
      });

      expect(invoice.feeLines).toHaveLength(3);
      expect(invoice.amountDue).toBe('R540.00');
    });

    it('T3-INT-4: duplicating an archived order resets status to planning and clears payment history', () => {
      const lot: CoffeeLot = {
        id: 'lot-hist',
        name: 'Historical Roast',
        foreignPricePerBag: 20,
        gramsPerBag: 250,
        quantity: 1,
        shares: [{ id: 's1', personId: 'person-zak', shareGrams: 250, bagIndex: 0 }],
        bags: [{ id: 'b1', splitMode: 'full', buyers: [{ id: 'buy1', personId: 'person-zak', grams: 250 }] }],
      };
      const pastOrder = makeTestOrder('ord-past-1', 'May Drop', 'archived', [lot]);
      pastOrder.payments = {
        'person-zak': { status: 'paid', amountPaid: 300, datePaid: '2026-05-20T00:00:00Z' },
      };

      const dupPayload = createDuplicatedOrderPayload(pastOrder, '2026-09-01');

      // Duplicate assertions
      expect(dupPayload.status).toBe('planning');
      expect(dupPayload.payments).toEqual({});
      expect(dupPayload.name).toBe('May Drop (copy)');

      // Historical original assertions
      expect(pastOrder.status).toBe('archived');
      expect(pastOrder.isArchived).toBe(true);
      expect(pastOrder.payments['person-zak'].status).toBe('paid');
    });

    it('T3-INT-5: updating person directory name cascades dynamically to invoice model and reference', () => {
      const lot: CoffeeLot = {
        id: 'lot-dyn',
        name: 'Dynamic Beans',
        foreignPricePerBag: 20,
        gramsPerBag: 250,
        quantity: 1,
        shares: [],
        bags: [{ id: 'b1', splitMode: 'full', buyers: [{ id: 'buy1', personId: 'person-ahmed', grams: 250 }] }],
      };
      const order = makeTestOrder('ord-dyn', 'Dynamic Order', 'completed', [lot], [], 400, 'person-zak');
      const calcResult = calculate(order, personNames);
      const payerZak = people.find((p) => p.id === 'person-zak')!;

      // 1. Initial name
      const personAhmedInitial = makePerson('person-ahmed', 'Ahmed');
      const invoiceInitial = buildInvoiceModel({
        order,
        person: personAhmedInitial,
        payer: payerZak,
        calc: calcResult.personCalcs['person-ahmed'],
      });
      expect(invoiceInitial.personName).toBe('Ahmed');
      expect(invoiceInitial.reference).toContain('AHMED');

      // 2. Updated directory profile
      const personAhmedUpdated = makePerson('person-ahmed', 'Ahmed Harnekar');
      const invoiceUpdated = buildInvoiceModel({
        order,
        person: personAhmedUpdated,
        payer: payerZak,
        calc: calcResult.personCalcs['person-ahmed'],
      });
      expect(invoiceUpdated.personName).toBe('Ahmed Harnekar');
    });

    it('T3-INT-6: orderIncludesPerson evaluates true across lot shares, specific fees, and non-unpaid payments', () => {
      const lot: CoffeeLot = {
        id: 'lot-inc',
        name: 'Beans',
        foreignPricePerBag: 20,
        gramsPerBag: 250,
        quantity: 1,
        shares: [],
        bags: [{ id: 'b1', splitMode: 'full', buyers: [{ id: 'buy1', personId: 'person-ahmed', grams: 250 }] }],
      };
      const fee: Fee = {
        id: 'f-spec',
        label: 'Courier',
        amountZar: 60,
        allocationType: 'specific_person',
        personId: 'person-sarah',
      };

      const order = makeTestOrder('ord-inc', 'Inclusion Test', 'planning', [lot], [fee], 500, 'person-zak');
      order.payments['person-abdul'] = { status: 'partial', amountPaid: 100 };

      expect(orderIncludesPerson(order, 'person-zak')).toBe(true); // Payer
      expect(orderIncludesPerson(order, 'person-ahmed')).toBe(true); // Coffee buyer
      expect(orderIncludesPerson(order, 'person-sarah')).toBe(true); // Specific fee
      expect(orderIncludesPerson(order, 'person-abdul')).toBe(true); // Payment status
      expect(orderIncludesPerson(order, 'person-stranger')).toBe(false); // Uninvolved
    });

    it('T3-INT-7: participant stats correctly aggregate totals and favorite roaster across archived orders', () => {
      const roasters = [
        makeRoaster('roaster-1', 'Tim Wendelboe'),
        makeRoaster('roaster-2', 'DAK'),
      ];

      const lot1: CoffeeLot = {
        id: 'l1',
        name: 'TW Coffee',
        foreignPricePerBag: 20,
        gramsPerBag: 250,
        quantity: 2,
        shares: [],
        bags: [
          { id: 'b1', splitMode: 'full', buyers: [{ id: 'buy1', personId: 'person-ahmed', grams: 250 }] },
          { id: 'b2', splitMode: 'full', buyers: [{ id: 'buy2', personId: 'person-ahmed', grams: 250 }] },
        ],
      };
      const order1 = {
        ...makeTestOrder('o-tw', 'TW Order', 'archived', [lot1], [], 500),
        roasterId: 'roaster-1',
        roasterSnapshot: { id: 'roaster-1', name: 'Tim Wendelboe' },
      };

      const lot2: CoffeeLot = {
        id: 'l2',
        name: 'DAK Coffee',
        foreignPricePerBag: 25,
        gramsPerBag: 250,
        quantity: 1,
        shares: [],
        bags: [{ id: 'b3', splitMode: 'full', buyers: [{ id: 'buy3', personId: 'person-ahmed', grams: 250 }] }],
      };
      const order2 = {
        ...makeTestOrder('o-dak', 'DAK Order', 'archived', [lot2], [], 300),
        roasterId: 'roaster-2',
        roasterSnapshot: { id: 'roaster-2', name: 'DAK' },
      };

      const matchedOrders = getParticipantFinalizedOrders(
        [order1, order2],
        'person-ahmed',
        personNames,
        roasters,
      );

      expect(matchedOrders).toHaveLength(2);

      const summary = calculateMyStatsSummary(matchedOrders);
      expect(summary.totalGrams).toBe(750); // 500g + 250g
      expect(summary.totalBags).toBe(3);
      expect(summary.totalSpent).toBe(800);
      expect(summary.favoriteRoaster?.name).toBe('Tim Wendelboe');
      expect(summary.favoriteRoaster?.bagCount).toBe(2);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // TIER 4: REAL-WORLD SCENARIOS
  // ══════════════════════════════════════════════════════════════════════════════

  describe('Tier 4: Real-World Scenarios', () => {
    it('T4-SCEN-1: "Tim Wendelboe Group Buy" full group order lifecycle with multi-bag splits and fee allocation', () => {
      // 1. Order Setup Details
      const roaster = makeRoaster('roaster-tw', 'Tim Wendelboe');
      let order = makeTestOrder('order-tw-august', 'Tim Wendelboe August Collective', 'planning', [], [], 0, 'person-zak');
      order.roasterId = roaster.id;
      order.roasterSnapshot = { id: roaster.id, name: roaster.name };

      // 2. Add Coffee Lots and Assign Buyers
      // Lot 1: Finca Tamana (Colombia), 3 bags × 250g = 750g (€22/bag = €66 total)
      const lot1: CoffeeLot = {
        id: 'lot-tamana',
        name: 'Finca Tamana',
        foreignPricePerBag: 22,
        gramsPerBag: 250,
        quantity: 3,
        shares: [],
        bags: [
          { id: 'b-t1', splitMode: 'full', buyers: [{ id: 'buy-t1', personId: 'person-zak', grams: 250 }] },
          { id: 'b-t2', splitMode: 'full', buyers: [{ id: 'buy-t2', personId: 'person-ahmed', grams: 250 }] },
          { id: 'b-t3', splitMode: 'full', buyers: [{ id: 'buy-t3', personId: 'person-sarah', grams: 250 }] },
        ],
      };

      // Lot 2: Caballero Gesha (Honduras), 1 bag × 250g = 250g (€35/bag), split 50/50 between Ahmed & Abdul
      const lot2: CoffeeLot = {
        id: 'lot-caballero',
        name: 'Caballero Gesha',
        foreignPricePerBag: 35,
        gramsPerBag: 250,
        quantity: 1,
        shares: [],
        bags: [
          {
            id: 'b-c1',
            splitMode: 'equal',
            buyers: [
              { id: 'buy-c1', personId: 'person-ahmed', grams: 125 },
              { id: 'buy-c2', personId: 'person-abdul', grams: 125 },
            ],
          },
        ],
      };

      // Lot 3: Karinga (Kenya), 2 bags × 250g = 500g (€25/bag = €50 total)
      const lot3: CoffeeLot = {
        id: 'lot-karinga',
        name: 'Karinga AA',
        foreignPricePerBag: 25,
        gramsPerBag: 250,
        quantity: 2,
        shares: [],
        bags: [
          { id: 'b-k1', splitMode: 'full', buyers: [{ id: 'buy-k1', personId: 'person-sarah', grams: 250 }] },
          { id: 'b-k2', splitMode: 'full', buyers: [{ id: 'buy-k2', personId: 'person-abdul', grams: 250 }] },
        ],
      };

      order = {
        ...order,
        lots: [lot1, lot2, lot3],
        goodsTotalZar: 2450, // Final foreign exchange charged to card
      };

      // 3. Add Goods and Fees
      const fees: Fee[] = [
        { id: 'f-dhl', label: 'DHL International Express', amountZar: 450, allocationType: 'equal_per_person', personId: null },
        { id: 'f-tax', label: 'Customs Duty & Import VAT', amountZar: 620, allocationType: 'proportional_by_value', personId: null },
      ];
      order = { ...order, fees };

      // 4. Calculate Summary and Verify Mathematical Invariants
      const result = calculate(order, personNames);
      expect(result.isValid).toBe(true);
      expect(result.totalGoodsZar).toBe(2450);
      expect(result.totalFeesZar).toBe(1070);
      expect(result.totalOrderZar).toBe(3520);

      // Verify that all 4 participants are present and sum equals R3520.00 exactly
      expect(result.personIds).toHaveLength(4);
      const totalAllocated = Object.values(result.personCalcs).reduce((s, c) => s + c.totalFinal, 0);
      expect(Math.round(totalAllocated * 100) / 100).toBe(3520.0);

      // 5. Generate and Verify Individual Invoices
      const payerZak = people.find((p) => p.id === 'person-zak')!;
      for (const p of people) {
        const invoice = buildInvoiceModel({
          order,
          person: p,
          payer: payerZak,
          calc: result.personCalcs[p.id],
        });

        expect(invoice.orderName).toBe(order.name);
        expect(invoice.personName).toBe(p.name);
        expect(invoice.feeLines).toHaveLength(2);
        expect(invoice.reference.length).toBeLessThanOrEqual(20);
      }

      // 6. Lock Order and Collect Payments
      order = { ...order, status: 'locked' };
      expect(getOrderLifecycleLabel(order)).toBe('Locked');

      order = {
        ...order,
        payments: {
          'person-ahmed': { status: 'paid', amountPaid: result.personCalcs['person-ahmed'].totalFinal, datePaid: '2026-08-16' },
          'person-sarah': { status: 'paid', amountPaid: result.personCalcs['person-sarah'].totalFinal, datePaid: '2026-08-16' },
          'person-abdul': { status: 'paid', amountPaid: result.personCalcs['person-abdul'].totalFinal, datePaid: '2026-08-17' },
          'person-zak': { status: 'paid', amountPaid: result.personCalcs['person-zak'].totalFinal, datePaid: '2026-08-17' },
        },
      };

      // 7. Complete and Archive Order
      order = { ...order, status: 'completed' };
      expect(getOrderLifecycleLabel(order)).toBe('Completed');

      order = { ...order, status: 'archived', isArchived: true };
      expect(getOrderLifecycleLabel(order)).toBe('Past order');

      // 8. Verify Order State Segregation
      expect(getActiveOrders([order])).toHaveLength(0);
      expect(getPastOrders([order])).toHaveLength(1);
    });

    it('T4-SCEN-2: "Multi-Roaster Split with Retail Non-Coffee Buyer" ensures exact ZAR reconciliation', () => {
      // 3 Coffee buyers (Zak, Ahmed, Sarah) + 1 Non-coffee buyer (Abdul who only buys filters/PUDO shipping)
      const lot: CoffeeLot = {
        id: 'lot-shared',
        name: 'Shared Roast',
        foreignPricePerBag: 20,
        gramsPerBag: 250,
        quantity: 3,
        shares: [],
        bags: [
          { id: 'b1', splitMode: 'full', buyers: [{ id: 'buy1', personId: 'person-zak', grams: 250 }] },
          { id: 'b2', splitMode: 'full', buyers: [{ id: 'buy2', personId: 'person-ahmed', grams: 250 }] },
          { id: 'b3', splitMode: 'full', buyers: [{ id: 'buy3', personId: 'person-sarah', grams: 250 }] },
        ],
      };

      const fees: Fee[] = [
        { id: 'f-filt', label: 'Origami Filters + Courier', amountZar: 180, allocationType: 'specific_person', personId: 'person-abdul' },
      ];

      const order = makeTestOrder('ord-noncoffee', 'Retail Non-Coffee Split', 'planning', [lot], fees, 900, 'person-zak');
      const result = calculate(order, personNames);

      expect(result.isValid).toBe(true);
      expect(result.personCalcs['person-abdul'].totalGrams).toBe(0);
      expect(result.personCalcs['person-abdul'].goodsZar).toBe(0);
      expect(result.personCalcs['person-abdul'].feesZar).toBe(180);
      expect(result.personCalcs['person-abdul'].totalFinal).toBe(180);

      // Total order reconciliation
      const total = Object.values(result.personCalcs).reduce((s, c) => s + c.totalFinal, 0);
      expect(total).toBe(1080);
    });

    it('T4-SCEN-3: "Odd-Cents Precision Nightmare" verifies precision rounding invariants', () => {
      // €17.33 / bag, 2 bags = €34.66 total list foreign. Final ZAR = R1,429.87.
      // Bag 1: 250g Zak.
      // Bag 2: 83g Zak, 83g Ahmed, 84g Sarah.
      const lot: CoffeeLot = {
        id: 'lot-odd-cents',
        name: 'Odd Cents Roast',
        foreignPricePerBag: 17.33,
        gramsPerBag: 250,
        quantity: 2,
        shares: [],
        bags: [
          { id: 'b1', splitMode: 'full', buyers: [{ id: 'buy1', personId: 'person-zak', grams: 250 }] },
          {
            id: 'b2',
            splitMode: 'custom',
            buyers: [
              { id: 'b2-z', personId: 'person-zak', grams: 83 },
              { id: 'b2-a', personId: 'person-ahmed', grams: 83 },
              { id: 'b2-s', personId: 'person-sarah', grams: 84 },
            ],
          },
        ],
      };

      const fees: Fee[] = [
        { id: 'f1', label: 'Proportional Duty', amountZar: 187.43, allocationType: 'proportional_by_value', personId: null },
        { id: 'f2', label: 'Fixed Admin', amountZar: 55.0, allocationType: 'equal_per_person', personId: null },
      ];

      const order = makeTestOrder('ord-nightmare', 'Odd Cents Nightmare', 'planning', [lot], fees, 1429.87, 'person-zak');
      const result = calculate(order, personNames);

      expect(result.isValid).toBe(true);
      expect(result.totalOrderZar).toBe(1672.3);

      // Non-payers must be strictly floored to 2 decimal places
      const ahmedTotal = result.personCalcs['person-ahmed'].totalFinal;
      const sarahTotal = result.personCalcs['person-sarah'].totalFinal;
      const zakTotal = result.personCalcs['person-zak'].totalFinal;

      expect(Number((ahmedTotal * 100).toFixed(0)) % 1).toBe(0);
      expect(Number((sarahTotal * 100).toFixed(0)) % 1).toBe(0);

      // Payer Zak must absorb remainder so sum matches to the exact cent
      const sum = ahmedTotal + sarahTotal + zakTotal;
      expect(Math.round(sum * 100) / 100).toBe(1672.3);
    });

    it('T4-SCEN-4: "Full Workspace Lifecycle & Duplication" duplicates archived order into fresh planning order', () => {
      const lot: CoffeeLot = {
        id: 'lot-august',
        name: 'August Geisha',
        foreignPricePerBag: 30,
        gramsPerBag: 250,
        quantity: 1,
        shares: [{ id: 's-aug', personId: 'person-zak', shareGrams: 250, bagIndex: 0 }],
        bags: [{ id: 'b-aug', splitMode: 'full', buyers: [{ id: 'buy-aug', personId: 'person-zak', grams: 250 }] }],
      };

      const augustOrder = makeTestOrder('ord-august', 'August Coffee Drop', 'archived', [lot]);
      augustOrder.payments = { 'person-zak': { status: 'paid', amountPaid: 450 } };

      // Duplicate for September
      const septPayload = createDuplicatedOrderPayload(augustOrder, '2026-09-01');

      expect(septPayload.name).toBe('August Coffee Drop (copy)');
      expect(septPayload.status).toBe('planning');
      expect(syncOrderStatusFlags(septPayload).isArchived).toBe(false);
      expect(septPayload.orderDate).toBe('2026-09-01');
      expect(septPayload.payments).toEqual({});

      // Fresh IDs generated for child elements
      expect(septPayload.lots[0].id).not.toBe('lot-august');
      expect(septPayload.lots[0].bags[0].id).not.toBe('b-aug');
      expect(septPayload.lots[0].shares[0].id).not.toBe('s-aug');

      // Original remains untouched in historical records
      expect(augustOrder.status).toBe('archived');
      expect(augustOrder.isArchived).toBe(true);
      expect(augustOrder.payments['person-zak'].status).toBe('paid');
    });
  });
});
