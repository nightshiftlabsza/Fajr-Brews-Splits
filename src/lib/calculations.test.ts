import { describe, it, expect } from 'vitest';
import { calculate } from './calculations';
import type { Order } from '../types';

// ─── Multi-share person scenario ─────────────────────────────
//
// Lot A  Ethiopian, 250g bags, €18/bag, qty 2 → 500g total
//   Person A: 250g  (1 full bag)
//   Person B: 250g  (1 full bag)
//
// Lot B  Colombian, 500g bags, €28/bag, qty 1 → 500g total
//   Person A: 250g  (half bag)
//   Person C: 250g  (half bag)
//
// Goods total:  R1000
// Fees:
//   Disbursement R300  fixed_shared      (÷ 3 people = R100 each)
//   Customs      R500  value_based
//
// Payer: Person B
//
// Verification targets
// ───────────────────
// • Person A fixed fee = R100  (NOT R200 — charged once, not per lot)
// • Person A goods total (without fees) = R500
// • Fee breakdown for Person A has exactly 2 entries
// • Sum of all totalFinal = R1800 (1000 goods + 300 fixed + 500 value_based)

const ORDER_A = 'lot-a';
const ORDER_B = 'lot-b';
const PERSON_A = 'person-a';
const PERSON_B = 'person-b';
const PERSON_C = 'person-c';
const FEE_DISBURSEMENT = 'fee-disbursement';
const FEE_CUSTOMS = 'fee-customs';

const testOrder: Order = {
  id: 'order-1',
  workspaceId: 'ws-1',
  name: 'Test Order',
  orderDate: '2025-03-01',
  roasterId: null,
  roasterSnapshot: null,
  payerId: PERSON_B,
  payerBank: { bankName: 'FNB', accountNumber: '1234567890', beneficiary: 'Person B' },
  referenceTemplate: 'FAJR-{ORDER}-{NAME}',
  goodsTotalZar: 1000,
  lots: [
    {
      id: ORDER_A,
      name: 'Ethiopian Yirgacheffe',
      foreignPricePerBag: 18,
      gramsPerBag: 250,
      quantity: 2,
      shares: [
        { id: 'share-a1', personId: PERSON_A, shareGrams: 250 },
        { id: 'share-b1', personId: PERSON_B, shareGrams: 250 },
      ],
    },
    {
      id: ORDER_B,
      name: 'Colombian Huila',
      foreignPricePerBag: 28,
      gramsPerBag: 500,
      quantity: 1,
      shares: [
        { id: 'share-a2', personId: PERSON_A, shareGrams: 250 },
        { id: 'share-c1', personId: PERSON_C, shareGrams: 250 },
      ],
    },
  ],
  fees: [
    { id: FEE_DISBURSEMENT, label: 'Disbursement', allocationType: 'fixed_shared', amountZar: 300 },
    { id: FEE_CUSTOMS,      label: 'Customs',      allocationType: 'value_based', amountZar: 500 },
  ],
  payments: {},
  isArchived: false,
  createdAt: '2025-03-01T00:00:00Z',
  updatedAt: '2025-03-01T00:00:00Z',
};

const personNames: Record<string, string> = {
  [PERSON_A]: 'Person A',
  [PERSON_B]: 'Person B',
  [PERSON_C]: 'Person C',
};

describe('calculate() — updated fee model scenario', () => {
  const result = calculate(testOrder, personNames);

  it('should produce a valid result', () => {
    expect(result.isValid).toBe(true);
    expect(result.validationErrors).toHaveLength(0);
  });

  it('should include all 3 participants', () => {
    expect(result.personIds).toHaveLength(3);
    expect(result.personIds).toContain(PERSON_A);
    expect(result.personIds).toContain(PERSON_B);
    expect(result.personIds).toContain(PERSON_C);
  });

  it('Person A goods should include both Lot A and Lot B shares', () => {
    const aCalc = result.personCalcs[PERSON_A];
    expect(aCalc.lotBreakdowns).toHaveLength(2);
    expect(aCalc.goodsZar).toBeGreaterThan(0);
    // Lot A foreign: 18*2=36, Lot B foreign: 28*1=28, total=64
    // Lot A alloc: 36/64 * 1000 = 562.5 ZAR; A's share: 250/500 * 562.5 = 281.25
    // Lot B alloc: 28/64 * 1000 = 437.5 ZAR; A's share: 250/500 * 437.5 = 218.75
    // A goods total = 281.25 + 218.75 = 500
    expect(aCalc.goodsZar).toBeCloseTo(500, 4);
  });

  it('Person A total grams should be 500g', () => {
    expect(result.personCalcs[PERSON_A].totalGrams).toBe(500);
  });

  it('Person A fixed_shared fee should be exactly R100 (charged ONCE, not per lot)', () => {
    const aFeeBreakdowns = result.personCalcs[PERSON_A].feeBreakdowns;
    const disbursement = aFeeBreakdowns.find((f) => f.feeId === FEE_DISBURSEMENT);
    expect(disbursement).toBeDefined();
    // 3 participants → R300 / 3 = R100
    expect(disbursement!.amountZar).toBeCloseTo(100, 6);
  });

  it('Person A fee breakdown should have exactly 2 entries (one per fee type)', () => {
    const aFeeBreakdowns = result.personCalcs[PERSON_A].feeBreakdowns;
    expect(aFeeBreakdowns).toHaveLength(2);
    const feeIds = aFeeBreakdowns.map((f) => f.feeId);
    expect(feeIds).toContain(FEE_DISBURSEMENT);
    expect(feeIds).toContain(FEE_CUSTOMS);
  });

  it('Person A lot breakdowns should contain fee distribution that reconciles to their person-level fees', () => {
    const aCalc = result.personCalcs[PERSON_A];
    const sumLotFees = aCalc.lotBreakdowns.reduce((sum, lb) => sum + lb.feesZar, 0);
    expect(sumLotFees).toBeCloseTo(aCalc.feesZar, 6);
    expect(aCalc.lotBreakdowns.reduce((sum, lb) => sum + lb.totalZar, 0)).toBeCloseTo(aCalc.totalPreRound, 6);
  });

  it('distributes all fees down to coffee totals without breaking order reconciliation', () => {
    expect(result.lotCalcs).toHaveLength(2);
    expect(result.lotCalcs.reduce((sum, lot) => sum + lot.goodsZar, 0)).toBeCloseTo(result.totalGoodsZar, 6);
    expect(result.lotCalcs.reduce((sum, lot) => sum + lot.feesZar, 0)).toBeCloseTo(result.totalFeesZar, 6);
    expect(result.lotCalcs.reduce((sum, lot) => sum + lot.totalZar, 0)).toBeCloseTo(result.totalOrderZar, 6);
    expect(result.lotCalcs.every((lot) => lot.totalZar === lot.goodsZar + lot.feesZar)).toBe(true);
  });

  it('sum of all totalFinal values should equal goodsTotal + all fees = R1800', () => {
    const grandTotal = result.totalOrderZar;
    expect(grandTotal).toBeCloseTo(1800, 4);
    const sumFinals = result.personIds.reduce(
      (s, pid) => s + (result.personCalcs[pid].totalFinal ?? 0),
      0
    );
    expect(sumFinals).toBeCloseTo(1800, 1);
  });

  it('payer (Person B) absorbs rounding — totalFinal should be non-negative', () => {
    const bFinal = result.personCalcs[PERSON_B].totalFinal;
    expect(bFinal).toBeGreaterThanOrEqual(0);
  });
});

describe('calculate() - bag-level split context', () => {
  function makeBagLevelOrder(lots: Order['lots']): Order {
    return {
      ...testOrder,
      goodsTotalZar: 600,
      lots,
      fees: [],
      payerId: PERSON_A,
    };
  }

  it('does not mark two full bags in the same lot as split', () => {
    const order = makeBagLevelOrder([
      {
        id: 'lot-full',
        name: 'Kenya AA',
        foreignPricePerBag: 18,
        gramsPerBag: 250,
        quantity: 2,
        shares: [
          { id: 'share-a-0', personId: PERSON_A, shareGrams: 250, bagIndex: 0 },
          { id: 'share-b-1', personId: PERSON_B, shareGrams: 250, bagIndex: 1 },
        ],
        bagAllocations: [
          {
            id: 'bag-0',
            bagIndex: 0,
            mode: 'single',
            participants: [{ id: 'bp-a-0', personId: PERSON_A, shareGrams: 250, sourceShareId: 'share-a-0' }],
          },
          {
            id: 'bag-1',
            bagIndex: 1,
            mode: 'single',
            participants: [{ id: 'bp-b-1', personId: PERSON_B, shareGrams: 250, sourceShareId: 'share-b-1' }],
          },
        ],
      },
    ]);

    const result = calculate(order, personNames);

    expect(result.isValid).toBe(true);
    expect(result.personCalcs[PERSON_A].lotBreakdowns).toHaveLength(1);
    expect(result.personCalcs[PERSON_A].lotBreakdowns[0].bagMode).toBe('full');
    expect(result.personCalcs[PERSON_A].lotBreakdowns[0].splitWith).toEqual([]);
    expect(result.personCalcs[PERSON_B].lotBreakdowns[0].splitWith).toEqual([]);
  });

  it('only marks the bag that was actually split', () => {
    const order = makeBagLevelOrder([
      {
        id: 'lot-mixed',
        name: 'Colombian Huila',
        foreignPricePerBag: 19,
        gramsPerBag: 250,
        quantity: 2,
        shares: [
          { id: 'share-a-0', personId: PERSON_A, shareGrams: 250, bagIndex: 0 },
          { id: 'share-b-1', personId: PERSON_B, shareGrams: 125, bagIndex: 1 },
          { id: 'share-c-1', personId: PERSON_C, shareGrams: 125, bagIndex: 1 },
        ],
        bagAllocations: [
          {
            id: 'bag-0',
            bagIndex: 0,
            mode: 'single',
            participants: [{ id: 'bp-a-0', personId: PERSON_A, shareGrams: 250, sourceShareId: 'share-a-0' }],
          },
          {
            id: 'bag-1',
            bagIndex: 1,
            mode: 'split',
            participants: [
              { id: 'bp-b-1', personId: PERSON_B, shareGrams: 125, sourceShareId: 'share-b-1' },
              { id: 'bp-c-1', personId: PERSON_C, shareGrams: 125, sourceShareId: 'share-c-1' },
            ],
          },
        ],
      },
    ]);

    const result = calculate(order, personNames);

    expect(result.personCalcs[PERSON_A].lotBreakdowns[0].splitWith).toEqual([]);
    expect(result.personCalcs[PERSON_A].lotBreakdowns[0].bagMode).toBe('full');
    expect(result.personCalcs[PERSON_B].lotBreakdowns[0].bagMode).toBe('equal');
    expect(result.personCalcs[PERSON_B].lotBreakdowns[0].splitWith).toEqual(['Person C']);
    expect(result.personCalcs[PERSON_C].lotBreakdowns[0].splitWith).toEqual(['Person B']);
  });

  it('keeps split context separate when lots share the same coffee name', () => {
    const order = makeBagLevelOrder([
      {
        id: 'lot-full',
        name: 'Kenya AA',
        foreignPricePerBag: 18,
        gramsPerBag: 250,
        quantity: 2,
        shares: [
          { id: 'share-a-0', personId: PERSON_A, shareGrams: 250, bagIndex: 0 },
          { id: 'share-b-1', personId: PERSON_B, shareGrams: 250, bagIndex: 1 },
        ],
        bagAllocations: [
          {
            id: 'bag-full-0',
            bagIndex: 0,
            mode: 'single',
            participants: [{ id: 'bp-a-full', personId: PERSON_A, shareGrams: 250, sourceShareId: 'share-a-0' }],
          },
          {
            id: 'bag-full-1',
            bagIndex: 1,
            mode: 'single',
            participants: [{ id: 'bp-b-full', personId: PERSON_B, shareGrams: 250, sourceShareId: 'share-b-1' }],
          },
        ],
      },
      {
        id: 'lot-split',
        name: 'Kenya AA',
        foreignPricePerBag: 18,
        gramsPerBag: 250,
        quantity: 1,
        shares: [
          { id: 'share-a-split', personId: PERSON_A, shareGrams: 125, bagIndex: 0 },
          { id: 'share-c-split', personId: PERSON_C, shareGrams: 125, bagIndex: 0 },
        ],
        bagAllocations: [
          {
            id: 'bag-split-0',
            bagIndex: 0,
            mode: 'split',
            participants: [
              { id: 'bp-a-split', personId: PERSON_A, shareGrams: 125, sourceShareId: 'share-a-split' },
              { id: 'bp-c-split', personId: PERSON_C, shareGrams: 125, sourceShareId: 'share-c-split' },
            ],
          },
        ],
      },
    ]);

    const result = calculate(order, personNames);
    const aBreakdowns = result.personCalcs[PERSON_A].lotBreakdowns;

    expect(aBreakdowns).toHaveLength(2);
    expect(aBreakdowns.find((breakdown) => breakdown.lotId === 'lot-full')?.splitWith).toEqual([]);
    expect(aBreakdowns.find((breakdown) => breakdown.lotId === 'lot-split')?.splitWith).toEqual(['Person C']);
  });
});

describe('calculate() — fixed_shared fee guard: zero eligible people', () => {
  it('should return isValid=false when there are no lots', () => {
    const emptyOrder: Order = {
      ...testOrder,
      lots: [],
      fees: [{ id: 'fee-1', label: 'Test', allocationType: 'fixed_shared', amountZar: 100 }],
    };
    const result = calculate(emptyOrder, {});
    expect(result.isValid).toBe(false);
  });
});

describe('calculate() - person-specific fees and rounding', () => {
  it('charges a specific-person fee only to the selected person and counts them as a participant', () => {
    const order: Order = {
      ...testOrder,
      goodsTotalZar: 100,
      payerId: PERSON_A,
      lots: [
        {
          id: 'lot-1',
          name: 'Pastel Hour',
          foreignPricePerBag: 20,
          gramsPerBag: 250,
          quantity: 1,
          shares: [{ id: 'share-a', personId: PERSON_A, shareGrams: 250, bagIndex: 0 }],
          bags: [
            {
              id: 'bag-1',
              splitMode: 'full',
              buyers: [{ id: 'buyer-a', personId: PERSON_A, grams: 250 }],
            },
          ],
        },
      ],
      fees: [
        { id: 'fee-pudo', label: 'PUDO courier', amountZar: 60, allocationType: 'specific_person', personId: PERSON_B },
      ],
    };

    const result = calculate(order, personNames);

    expect(result.isValid).toBe(true);
    expect(result.personIds).toContain(PERSON_B);
    expect(result.personCalcs[PERSON_B].totalGrams).toBe(0);
    expect(result.personCalcs[PERSON_B].feesZar).toBe(60);
    expect(result.personCalcs[PERSON_B].feeBreakdowns).toEqual([
      expect.objectContaining({
        feeId: 'fee-pudo',
        allocationType: 'specific_person',
        amountZar: 60,
        personId: PERSON_B,
      }),
    ]);
    expect(result.personCalcs[PERSON_A].feeBreakdowns).toHaveLength(0);
  });

  it('rounds non-payers down and lets the payer absorb the remaining cents', () => {
    const order: Order = {
      ...testOrder,
      goodsTotalZar: 100,
      payerId: PERSON_A,
      lots: [
        {
          id: 'lot-1',
          name: 'Pastel Hour',
          foreignPricePerBag: 30,
          gramsPerBag: 300,
          quantity: 1,
          shares: [
            { id: 'share-a', personId: PERSON_A, shareGrams: 100, bagIndex: 0 },
            { id: 'share-b', personId: PERSON_B, shareGrams: 100, bagIndex: 0 },
            { id: 'share-c', personId: PERSON_C, shareGrams: 100, bagIndex: 0 },
          ],
          bags: [
            {
              id: 'bag-1',
              splitMode: 'equal',
              buyers: [
                { id: 'buyer-a', personId: PERSON_A, grams: 100 },
                { id: 'buyer-b', personId: PERSON_B, grams: 100 },
                { id: 'buyer-c', personId: PERSON_C, grams: 100 },
              ],
            },
          ],
        },
      ],
      fees: [],
    };

    const result = calculate(order, personNames);

    expect(result.personCalcs[PERSON_B].totalFinal).toBe(33.33);
    expect(result.personCalcs[PERSON_C].totalFinal).toBe(33.33);
    expect(result.personCalcs[PERSON_A].totalFinal).toBe(33.34);
    expect(result.roundingAbsorbed).toBeCloseTo(0.006666, 5);
  });
});

describe('6 Money Reconciliation & Regression Scenarios (BUG-MONEY-01, BUG-MONEY-02, BUG-MONEY-03)', () => {
  // Scenario 1: Equal Split
  it('Scenario 1: Equal split — 2 participants share 1 lot equally with no fees', () => {
    const order: Order = {
      ...testOrder,
      goodsTotalZar: 500,
      payerId: PERSON_A,
      lots: [
        {
          id: 'lot-s1',
          name: 'Ethiopian Guji',
          foreignPricePerBag: 15,
          gramsPerBag: 250,
          quantity: 2,
          shares: [
            { id: 's1-a', personId: PERSON_A, shareGrams: 250, bagIndex: 0 },
            { id: 's1-b', personId: PERSON_B, shareGrams: 250, bagIndex: 1 },
          ],
          bags: [
            { id: 'b1-0', splitMode: 'full', buyers: [{ id: 'by-a', personId: PERSON_A, grams: 250 }] },
            { id: 'b1-1', splitMode: 'full', buyers: [{ id: 'by-b', personId: PERSON_B, grams: 250 }] },
          ],
        },
      ],
      fees: [],
    };

    const res = calculate(order, personNames);

    expect(res.isValid).toBe(true);
    expect(res.totalOrderZar).toBe(500);
    expect(res.personCalcs[PERSON_A].goodsZar).toBe(250);
    expect(res.personCalcs[PERSON_A].feesZar).toBe(0);
    expect(res.personCalcs[PERSON_A].totalFinal).toBe(250);
    expect(res.personCalcs[PERSON_B].goodsZar).toBe(250);
    expect(res.personCalcs[PERSON_B].feesZar).toBe(0);
    expect(res.personCalcs[PERSON_B].totalFinal).toBe(250);
    expect(res.roundingAbsorbed).toBe(0);

    const sumFinal = res.personIds.reduce((sum, pid) => sum + (res.personCalcs[pid].totalFinal ?? 0), 0);
    expect(sumFinal).toBe(500);
  });

  // Scenario 2: Uneven Grams
  it('Scenario 2: Uneven grams across 2 lots with different list prices', () => {
    const order: Order = {
      ...testOrder,
      goodsTotalZar: 1000,
      payerId: PERSON_A,
      lots: [
        {
          id: 'lot-kenya',
          name: 'Kenya Nyeri',
          foreignPricePerBag: 25,
          gramsPerBag: 250,
          quantity: 1,
          shares: [
            { id: 's-k-a', personId: PERSON_A, shareGrams: 150, bagIndex: 0 },
            { id: 's-k-b', personId: PERSON_B, shareGrams: 100, bagIndex: 0 },
          ],
          bags: [
            {
              id: 'bag-k-0',
              splitMode: 'custom',
              buyers: [
                { id: 'by-k-a', personId: PERSON_A, grams: 150 },
                { id: 'by-k-b', personId: PERSON_B, grams: 100 },
              ],
            },
          ],
        },
        {
          id: 'lot-colombia',
          name: 'Colombia Huila',
          foreignPricePerBag: 20,
          gramsPerBag: 250,
          quantity: 1,
          shares: [
            { id: 's-c-b', personId: PERSON_B, shareGrams: 50, bagIndex: 0 },
            { id: 's-c-c', personId: PERSON_C, shareGrams: 200, bagIndex: 0 },
          ],
          bags: [
            {
              id: 'bag-c-0',
              splitMode: 'custom',
              buyers: [
                { id: 'by-c-b', personId: PERSON_B, grams: 50 },
                { id: 'by-c-c', personId: PERSON_C, grams: 200 },
              ],
            },
          ],
        },
      ],
      fees: [],
    };

    const res = calculate(order, personNames);

    expect(res.isValid).toBe(true);
    expect(res.totalOrderZar).toBe(1000);

    // Person A pre-round: 333.3333... ZAR -> payer absorbs remainder to 333.34
    expect(res.personCalcs[PERSON_A].totalPreRound).toBeCloseTo(1000 / 3, 4);
    expect(res.personCalcs[PERSON_A].totalFinal).toBe(333.34);

    // Person B pre-round: 311.1111... ZAR -> non-payer floored to 311.11
    expect(res.personCalcs[PERSON_B].totalPreRound).toBeCloseTo(311.1111, 3);
    expect(res.personCalcs[PERSON_B].totalFinal).toBe(311.11);

    // Person C pre-round: 355.5555... ZAR -> non-payer floored to 355.55
    expect(res.personCalcs[PERSON_C].totalPreRound).toBeCloseTo(355.5555, 3);
    expect(res.personCalcs[PERSON_C].totalFinal).toBe(355.55);

    // Grand total reconciliation
    const sumFinal = res.personIds.reduce((sum, pid) => sum + (res.personCalcs[pid].totalFinal ?? 0), 0);
    expect(sumFinal).toBe(1000);
    expect(res.roundingAbsorbed).toBeCloseTo(0.006666, 5);
  });

  // Scenario 3: Fixed and Proportional Fees (Testing legacy aliases & new enums)
  it('Scenario 3: Fixed and proportional fees match identically across legacy and canonical fee types', () => {
    function makeScenario3Order(allocationType1: 'fixed_shared' | 'equal_per_person', allocationType2: 'value_based' | 'proportional_by_value'): Order {
      return {
        ...testOrder,
        goodsTotalZar: 800,
        payerId: PERSON_A,
        lots: [
          {
            id: 'lot-guat',
            name: 'Guatemala Huehuetenango',
            foreignPricePerBag: 20,
            gramsPerBag: 250,
            quantity: 2,
            shares: [
              { id: 's-g-a', personId: PERSON_A, shareGrams: 125, bagIndex: 0 },
              { id: 's-g-b', personId: PERSON_B, shareGrams: 375, bagIndex: 0 },
            ],
            bags: [
              {
                id: 'bag-g-0',
                splitMode: 'equal',
                buyers: [
                  { id: 'by-g-a', personId: PERSON_A, grams: 125 },
                  { id: 'by-g-b1', personId: PERSON_B, grams: 125 },
                ],
              },
              {
                id: 'bag-g-1',
                splitMode: 'full',
                buyers: [
                  { id: 'by-g-b2', personId: PERSON_B, grams: 250 },
                ],
              },
            ],
          },
        ],
        fees: [
          { id: 'f-shared', label: 'Disbursement', amountZar: 150, allocationType: allocationType1 as any },
          { id: 'f-value', label: 'Customs', amountZar: 300, allocationType: allocationType2 as any },
        ],
      };
    }

    const resLegacy = calculate(makeScenario3Order('fixed_shared', 'value_based'), personNames);
    const resCanonical = calculate(makeScenario3Order('equal_per_person', 'proportional_by_value'), personNames);

    for (const res of [resLegacy, resCanonical]) {
      expect(res.isValid).toBe(true);
      expect(res.totalOrderZar).toBe(1250);
      expect(res.totalGoodsZar).toBe(800);
      expect(res.totalFeesZar).toBe(450);

      // Person A: Goods R200 (25%), Fee 1 R75 (50%), Fee 2 R75 (25%) = R350.00
      expect(res.personCalcs[PERSON_A].goodsZar).toBe(200);
      expect(res.personCalcs[PERSON_A].feesZar).toBe(150);
      expect(res.personCalcs[PERSON_A].totalFinal).toBe(350);

      // Person B: Goods R600 (75%), Fee 1 R75 (50%), Fee 2 R225 (75%) = R900.00
      expect(res.personCalcs[PERSON_B].goodsZar).toBe(600);
      expect(res.personCalcs[PERSON_B].feesZar).toBe(300);
      expect(res.personCalcs[PERSON_B].totalFinal).toBe(900);

      const sumFinal = res.personIds.reduce((sum, pid) => sum + (res.personCalcs[pid].totalFinal ?? 0), 0);
      expect(sumFinal).toBe(1250);
    }

    // Verify exact equality between legacy aliases and new enum strings
    expect(resLegacy.personCalcs[PERSON_A].totalFinal).toBe(resCanonical.personCalcs[PERSON_A].totalFinal);
    expect(resLegacy.personCalcs[PERSON_B].totalFinal).toBe(resCanonical.personCalcs[PERSON_B].totalFinal);
  });

  // Scenario 4: Payer is also a Buyer
  it('Scenario 4: Payer is also a buyer and absorbs remainder from 3-way split', () => {
    const order: Order = {
      ...testOrder,
      goodsTotalZar: 1200,
      payerId: PERSON_A,
      lots: [
        {
          id: 'lot-geisha',
          name: 'Panama Geisha',
          foreignPricePerBag: 30,
          gramsPerBag: 150,
          quantity: 2,
          shares: [
            { id: 's-pg-a', personId: PERSON_A, shareGrams: 100, bagIndex: 0 },
            { id: 's-pg-b', personId: PERSON_B, shareGrams: 100, bagIndex: 0 },
            { id: 's-pg-c', personId: PERSON_C, shareGrams: 100, bagIndex: 1 },
          ],
          bags: [
            {
              id: 'bag-pg-0',
              splitMode: 'custom',
              buyers: [
                { id: 'by-pg-a', personId: PERSON_A, grams: 100 },
                { id: 'by-pg-b', personId: PERSON_B, grams: 50 },
              ],
            },
            {
              id: 'bag-pg-1',
              splitMode: 'custom',
              buyers: [
                { id: 'by-pg-b2', personId: PERSON_B, grams: 50 },
                { id: 'by-pg-c', personId: PERSON_C, grams: 100 },
              ],
            },
          ],
        },
      ],
      fees: [
        { id: 'fee-customs', label: 'Customs Clearance', amountZar: 250, allocationType: 'proportional_by_value' },
      ],
    };

    const res = calculate(order, personNames);

    expect(res.isValid).toBe(true);
    expect(res.totalOrderZar).toBe(1450);

    // Each person: Goods R400, Fee 83.333333... ZAR -> Pre-round = 483.3333... ZAR
    expect(res.personCalcs[PERSON_B].totalFinal).toBe(483.33);
    expect(res.personCalcs[PERSON_C].totalFinal).toBe(483.33);

    // Payer Person A absorbs remainder: 1450 - (483.33 + 483.33) = R483.34
    expect(res.personCalcs[PERSON_A].totalFinal).toBe(483.34);

    const sumFinal = res.personIds.reduce((sum, pid) => sum + (res.personCalcs[pid].totalFinal ?? 0), 0);
    expect(sumFinal).toBe(1450);
  });

  // Scenario 5: Zero-gram person with specific fee (BUG-MONEY-01 regression)
  it('Scenario 5: Zero-gram person with specific fee is NOT charged equal_per_person fee (BUG-MONEY-01)', () => {
    const order: Order = {
      ...testOrder,
      goodsTotalZar: 600,
      payerId: PERSON_A,
      lots: [
        {
          id: 'lot-burundi',
          name: 'Burundi Kayanza',
          foreignPricePerBag: 20,
          gramsPerBag: 250,
          quantity: 2,
          shares: [
            { id: 's-bu-a', personId: PERSON_A, shareGrams: 250, bagIndex: 0 },
            { id: 's-bu-b', personId: PERSON_B, shareGrams: 250, bagIndex: 1 },
          ],
          bags: [
            { id: 'bag-bu-0', splitMode: 'full', buyers: [{ id: 'by-bu-a', personId: PERSON_A, grams: 250 }] },
            { id: 'bag-bu-1', splitMode: 'full', buyers: [{ id: 'by-bu-b', personId: PERSON_B, grams: 250 }] },
          ],
        },
      ],
      fees: [
        { id: 'f-courier', label: 'Local Courier / PUDO', amountZar: 60, allocationType: 'specific_person', personId: PERSON_C },
        { id: 'f-disb', label: 'Disbursement Fee', amountZar: 100, allocationType: 'equal_per_person' },
      ],
      payments: {},
    };

    const res = calculate(order, personNames);

    expect(res.isValid).toBe(true);
    expect(res.totalOrderZar).toBe(760);

    // Person C has 0g coffee, so they should ONLY pay their specific courier fee (R60), NOT the disbursement fee!
    expect(res.personCalcs[PERSON_C].totalGrams).toBe(0);
    expect(res.personCalcs[PERSON_C].feesZar).toBe(60);
    expect(res.personCalcs[PERSON_C].totalFinal).toBe(60);
    expect(res.personCalcs[PERSON_C].feeBreakdowns).toHaveLength(1);
    expect(res.personCalcs[PERSON_C].feeBreakdowns[0].feeId).toBe('f-courier');

    // Person A and B have 250g each (>0g), so the R100 equal fee is split equally between the 2 of them (R50 each)
    expect(res.personCalcs[PERSON_A].goodsZar).toBe(300);
    expect(res.personCalcs[PERSON_A].feesZar).toBe(50);
    expect(res.personCalcs[PERSON_A].totalFinal).toBe(350);

    expect(res.personCalcs[PERSON_B].goodsZar).toBe(300);
    expect(res.personCalcs[PERSON_B].feesZar).toBe(50);
    expect(res.personCalcs[PERSON_B].totalFinal).toBe(350);

    // Grand total reconciliation
    const sumFinal = res.personIds.reduce((sum, pid) => sum + (res.personCalcs[pid].totalFinal ?? 0), 0);
    expect(sumFinal).toBe(760);

    // Now test payment status invariance: marking Person C as 'paid' must NOT mutate fee allocations!
    const orderWithPaidC: Order = {
      ...order,
      payments: {
        [PERSON_C]: {
          status: 'paid',
          amountPaid: 60,
          datePaid: '2026-03-01',
        },
      },
    };

    const resPaid = calculate(orderWithPaidC, personNames);
    expect(resPaid.personCalcs[PERSON_C].feesZar).toBe(60);
    expect(resPaid.personCalcs[PERSON_A].feesZar).toBe(50);
    expect(resPaid.personCalcs[PERSON_B].feesZar).toBe(50);
  });

  // Scenario 6: Odd Cents
  it('Scenario 6: Odd cents — 3 participants with fractional cents reconcile to exact cent', () => {
    const order: Order = {
      ...testOrder,
      goodsTotalZar: 1000,
      payerId: PERSON_A,
      lots: [
        {
          id: 'lot-tarrazu',
          name: 'Costa Rica Tarrazu',
          foreignPricePerBag: 35,
          gramsPerBag: 700,
          quantity: 1,
          shares: [
            { id: 's-t-a', personId: PERSON_A, shareGrams: 233, bagIndex: 0 },
            { id: 's-t-b', personId: PERSON_B, shareGrams: 233, bagIndex: 0 },
            { id: 's-t-c', personId: PERSON_C, shareGrams: 234, bagIndex: 0 },
          ],
          bags: [
            {
              id: 'bag-t-0',
              splitMode: 'custom',
              buyers: [
                { id: 'by-t-a', personId: PERSON_A, grams: 233 },
                { id: 'by-t-b', personId: PERSON_B, grams: 233 },
                { id: 'by-t-c', personId: PERSON_C, grams: 234 },
              ],
            },
          ],
        },
      ],
      fees: [
        { id: 'f-fixed-10', label: 'Processing Fee', amountZar: 10, allocationType: 'equal_per_person' },
      ],
    };

    const res = calculate(order, personNames);

    expect(res.isValid).toBe(true);
    expect(res.totalOrderZar).toBe(1010);

    // Non-payers Person B & Person C floored to 2 dp
    expect(res.personCalcs[PERSON_B].totalFinal).toBe(336.19);
    expect(res.personCalcs[PERSON_C].totalFinal).toBe(337.61);

    // Payer Person A absorbs remainder
    expect(res.personCalcs[PERSON_A].totalFinal).toBe(336.20);
    expect(res.roundingAbsorbed).toBeCloseTo(0.0095238, 5);

    // Sum of finals must equal 1010.00 exactly
    const sumFinal = res.personIds.reduce((sum, pid) => sum + (res.personCalcs[pid].totalFinal ?? 0), 0);
    expect(sumFinal).toBe(1010);
  });

  // BUG-MONEY-02: Missing payerId validation
  it('BUG-MONEY-02: validateOrder requires non-empty payerId for rounding remainder reconciliation', () => {
    const invalidOrder = {
      ...testOrder,
      payerId: null as unknown as string,
    };
    const res = calculate(invalidOrder, personNames);
    expect(res.isValid).toBe(false);
    expect(res.validationErrors).toContain('Order payer is required for rounding reconciliation.');

    const emptyPayerOrder = {
      ...testOrder,
      payerId: '   ',
    };
    const resEmpty = calculate(emptyPayerOrder, personNames);
    expect(resEmpty.isValid).toBe(false);
    expect(resEmpty.validationErrors).toContain('Order payer is required for rounding reconciliation.');
  });

  // BUG-MONEY-03: Standalone fees lotCalcs reconciliation
  it('BUG-MONEY-03: lotCalcs totals + unallocated standalone fees reconcile to totalOrderZar', () => {
    const orderWithStandaloneFee: Order = {
      ...testOrder,
      goodsTotalZar: 600,
      payerId: PERSON_A,
      lots: [
        {
          id: 'lot-1',
          name: 'House Blend',
          foreignPricePerBag: 20,
          gramsPerBag: 250,
          quantity: 2,
          shares: [
            { id: 's-1', personId: PERSON_A, shareGrams: 500, bagIndex: 0 },
          ],
          bags: [
            { id: 'b-1', splitMode: 'full', buyers: [{ id: 'by-1', personId: PERSON_A, grams: 250 }] },
            { id: 'b-2', splitMode: 'full', buyers: [{ id: 'by-2', personId: PERSON_A, grams: 250 }] },
          ],
        },
      ],
      fees: [
        { id: 'fee-pudo', label: 'PUDO courier', amountZar: 60, allocationType: 'specific_person', personId: PERSON_B },
      ],
    };

    const res = calculate(orderWithStandaloneFee, personNames);
    expect(res.isValid).toBe(true);

    const lotCalcsTotal = res.lotCalcs.reduce((sum, lot) => sum + lot.totalZar, 0);
    const unallocatedFees = res.totalOrderZar - lotCalcsTotal;

    // The standalone fee of R60 is not tied to any coffee bag, so lotCalcs is R600 while totalOrderZar is R660
    expect(lotCalcsTotal).toBe(600);
    expect(unallocatedFees).toBe(60);
    expect(lotCalcsTotal + unallocatedFees).toBe(res.totalOrderZar);
  });

  // BUG-CHALLENGE-01: IEEE 754 precision loss on 50/50 split of R20.40
  it('BUG-CHALLENGE-01: 50/50 split of R20.40 allocates exactly R10.20 to both non-payer and payer without precision loss', () => {
    const splitOrder: Order = {
      ...testOrder,
      goodsTotalZar: 20.40,
      payerId: PERSON_A,
      lots: [
        {
          id: 'lot-2040',
          name: 'Precision Test Lot',
          foreignPricePerBag: 10,
          gramsPerBag: 250,
          quantity: 1,
          shares: [
            { id: 's-p1', personId: PERSON_A, shareGrams: 125, bagIndex: 0 },
            { id: 's-p2', personId: PERSON_B, shareGrams: 125, bagIndex: 0 },
          ],
          bags: [
            {
              id: 'bag-p1',
              splitMode: 'custom',
              buyers: [
                { id: 'b-p1', personId: PERSON_A, grams: 125 },
                { id: 'b-p2', personId: PERSON_B, grams: 125 },
              ],
            },
          ],
        },
      ],
      fees: [],
    };

    const res = calculate(splitOrder, personNames);
    expect(res.isValid).toBe(true);
    expect(res.totalOrderZar).toBe(20.40);

    // IEEE 754 precision loss previously caused Math.floor(10.20 * 100) to floor 1019.9999999999999 to 1019 (10.19)
    expect(res.personCalcs[PERSON_B].totalFinal).toBe(10.20);
    expect(res.personCalcs[PERSON_A].totalFinal).toBe(10.20);
    expect(res.roundingAbsorbed).toBe(0);

    const sumFinal = res.personIds.reduce((sum, pid) => sum + res.personCalcs[pid].totalFinal, 0);
    expect(sumFinal).toBe(20.40);
  });

  // BUG-CHALLENGE-02: Whitespace in payerId preserves remainder absorption
  it('BUG-CHALLENGE-02: untrimmed payerId with whitespace absorbs remainder and conserves exact cents', () => {
    const whitespacePayerOrder: Order = {
      ...testOrder,
      goodsTotalZar: 100.00,
      payerId: `  ${PERSON_B}  `,
      lots: [
        {
          id: 'lot-3way',
          name: '3-Way Split',
          foreignPricePerBag: 10,
          gramsPerBag: 300,
          quantity: 1,
          shares: [
            { id: 's-w-a', personId: PERSON_A, shareGrams: 100, bagIndex: 0 },
            { id: 's-w-b', personId: PERSON_B, shareGrams: 100, bagIndex: 0 },
            { id: 's-w-c', personId: PERSON_C, shareGrams: 100, bagIndex: 0 },
          ],
          bags: [
            {
              id: 'bag-w-1',
              splitMode: 'custom',
              buyers: [
                { id: 'b-w-a', personId: PERSON_A, grams: 100 },
                { id: 'b-w-b', personId: PERSON_B, grams: 100 },
                { id: 'b-w-c', personId: PERSON_C, grams: 100 },
              ],
            },
          ],
        },
      ],
      fees: [],
    };

    const res = calculate(whitespacePayerOrder, personNames);
    expect(res.isValid).toBe(true);
    expect(res.totalOrderZar).toBe(100.00);

    // Non-payers floored to 33.33
    expect(res.personCalcs[PERSON_A].totalFinal).toBe(33.33);
    expect(res.personCalcs[PERSON_C].totalFinal).toBe(33.33);

    // Payer absorbs 1 cent remainder: 100 - (33.33 + 33.33) = 33.34
    expect(res.personCalcs[PERSON_B].totalFinal).toBe(33.34);

    const sumFinal = res.personIds.reduce((sum, pid) => sum + res.personCalcs[pid].totalFinal, 0);
    expect(Math.round(sumFinal * 100) / 100).toBe(100.00);
  });
});
