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

  it('Person A lot breakdowns should contain value-based fee distribution', () => {
    const aCalc = result.personCalcs[PERSON_A];
    // Total value based fees for A = 500 * (A share of value)
    // A total foreign = 18*250/250*1 + 28*250/500*1 = 18 + 14 = 32
    // Total foreign = 64
    // A value share = 32/64 = 0.5
    // A total value-based fee = 0.5 * 500 = 250
    const sumLotFees = aCalc.lotBreakdowns.reduce((s, lb) => s + lb.valueBasedFeesZar, 0);
    expect(sumLotFees).toBeCloseTo(250, 4);
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
