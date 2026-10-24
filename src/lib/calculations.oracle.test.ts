import { describe, it, expect } from 'vitest';
import { calculate } from './calculations';
import { normalizeLotToBags } from './orderWizard';
import { normalizeFeeAllocationType } from './invoiceFormatter';
import type { Order, CoffeeLot, Bag, Fee, CalculationResult } from '../types';

// ─── Mathematical Oracle ───────────────────────────────────────
// Built strictly and independently from the specification in README.md:
// 1. TOTAL_LIST_FOREIGN = Σ(lot.foreignPricePerBag × lot.quantity)
// 2. LOT_GOODS_ZAR = (lot_total_foreign / TOTAL_LIST_FOREIGN) × GOODS_TOTAL_ZAR
// 3. SHARE_GOODS_ZAR = (shareGrams / lotTotalGrams) × LOT_GOODS_ZAR
// 4. PERSON_GOODS_ZAR = Σ(all SHARE_GOODS_ZAR for that person)
// 5. Fee allocation:
//    - equal_per_person (fixed_shared): fee.amountZar / participatingPeopleCount (>0g only)
//    - proportional_by_value (value_based): fee.amountZar × (personForeignValue / totalForeignValue)
//    - specific_person: 100% to fee.personId
// 6. Non-payer: Math.floor(preRound * 100) / 100
// 7. Payer absorbs remainder: Math.round((totalOrderZar - sumNonPayers) * 100) / 100

interface OraclePersonResult {
  goodsZar: number;
  feesZar: number;
  totalPreRound: number;
  totalFinal: number;
  coffeeValueForeign: number;
}

interface OracleResult {
  totalOrderZar: number;
  totalGoodsZar: number;
  totalFeesZar: number;
  roundingAbsorbed: number;
  personResults: Record<string, OraclePersonResult>;
  lotsTotalZar: number;
  standaloneFeesZar: number;
}

function oracleCalculate(order: Order): OracleResult {
  // Step 1: Foreign totals
  const totalListForeign = order.lots.reduce((sum, lot) => {
    const qty = normalizeLotToBags(lot).length;
    return sum + lot.foreignPricePerBag * qty;
  }, 0);

  // Collect person IDs
  const personIdSet = new Set<string>();
  if (order.payerId && order.payerId.trim()) {
    personIdSet.add(order.payerId.trim());
  }
  for (const lot of order.lots) {
    const bags = normalizeLotToBags(lot);
    for (const bag of bags) {
      for (const buyer of bag.buyers) {
        if (buyer.personId.trim() && buyer.grams > 0) {
          personIdSet.add(buyer.personId.trim());
        }
      }
    }
  }
  for (const fee of order.fees) {
    const type = normalizeFeeAllocationType(fee.allocationType);
    if (type === 'specific_person' && fee.personId && fee.personId.trim()) {
      personIdSet.add(fee.personId.trim());
    }
  }
  for (const [pid, payment] of Object.entries(order.payments || {})) {
    if (payment && payment.status !== 'unpaid') {
      personIdSet.add(pid);
    }
  }

  const personIds = Array.from(personIdSet);
  const personGoods: Record<string, number> = {};
  const personCoffeeValueForeign: Record<string, number> = {};
  const personTotalGrams: Record<string, number> = {};
  const personFees: Record<string, number> = {};

  for (const pid of personIds) {
    personGoods[pid] = 0;
    personCoffeeValueForeign[pid] = 0;
    personTotalGrams[pid] = 0;
    personFees[pid] = 0;
  }

  // Step 2 & 3: Goods and Foreign Value per share
  for (const lot of order.lots) {
    const bags = normalizeLotToBags(lot);
    const qty = bags.length;
    const lotTotalGrams = lot.gramsPerBag * qty;
    const lotTotalForeign = lot.foreignPricePerBag * qty;
    const lotGoodsZar = (lotTotalForeign / totalListForeign) * order.goodsTotalZar;

    for (const bag of bags) {
      for (const buyer of bag.buyers) {
        const pid = buyer.personId.trim();
        if (!pid || buyer.grams <= 0) continue;

        const shareFraction = buyer.grams / lotTotalGrams;
        personGoods[pid] += shareFraction * lotGoodsZar;
        personCoffeeValueForeign[pid] += shareFraction * lotTotalForeign;
        personTotalGrams[pid] += buyer.grams;
      }
    }
  }

  // Step 4: Eligible people for equal_per_person (> 0g only)
  const eligiblePeople = personIds.filter((pid) => personTotalGrams[pid] > 0);
  const totalForeignValue = personIds.reduce((sum, pid) => sum + personCoffeeValueForeign[pid], 0);

  // Step 5: Fee allocation
  for (const fee of order.fees) {
    const type = normalizeFeeAllocationType(fee.allocationType);
    if (type === 'equal_per_person') {
      if (eligiblePeople.length > 0) {
        const share = fee.amountZar / eligiblePeople.length;
        for (const pid of eligiblePeople) {
          personFees[pid] += share;
        }
      }
    } else if (type === 'proportional_by_value') {
      if (totalForeignValue > 0) {
        for (const pid of personIds) {
          const ratio = personCoffeeValueForeign[pid] / totalForeignValue;
          personFees[pid] += ratio * fee.amountZar;
        }
      }
    } else if (type === 'specific_person') {
      if (fee.personId && personIds.includes(fee.personId.trim())) {
        personFees[fee.personId.trim()] += fee.amountZar;
      }
    }
  }

  const totalGoodsZar = order.goodsTotalZar;
  const totalFeesZar = Math.round(order.fees.reduce((sum, f) => sum + f.amountZar, 0) * 100) / 100;
  const totalOrderZar = Math.round((totalGoodsZar + totalFeesZar) * 100) / 100;

  // Step 6 & 7: Rounding
  const personResults: Record<string, OraclePersonResult> = {};
  let sumNonPayers = 0;
  const payerId = order.payerId?.trim() ?? '';

  for (const pid of personIds) {
    const preRound = personGoods[pid] + personFees[pid];
    if (pid !== payerId) {
      // Non-payer: Math.floor to 2 decimal places with 1e-9 epsilon
      const finalVal = Math.floor((preRound + 1e-9) * 100) / 100;
      sumNonPayers += finalVal;
      personResults[pid] = {
        goodsZar: personGoods[pid],
        feesZar: personFees[pid],
        totalPreRound: preRound,
        totalFinal: finalVal,
        coffeeValueForeign: personCoffeeValueForeign[pid],
      };
    }
  }

  // Payer absorbs remainder
  if (payerId && personIds.includes(payerId)) {
    const payerPreRound = personGoods[payerId] + personFees[payerId];
    const rawPayerFinal = Math.round((totalOrderZar - sumNonPayers) * 100) / 100;
    const payerFinal = Object.is(rawPayerFinal, -0) ? 0 : rawPayerFinal;
    personResults[payerId] = {
      goodsZar: personGoods[payerId],
      feesZar: personFees[payerId],
      totalPreRound: payerPreRound,
      totalFinal: payerFinal,
      coffeeValueForeign: personCoffeeValueForeign[payerId],
    };
  }

  const roundingAbsorbed = payerId && personResults[payerId]
    ? personResults[payerId].totalFinal - personResults[payerId].totalPreRound
    : 0;

  // CoffeeCostSummary reconciliation:
  // Standalone fees are fees assigned to participants who have 0g of coffee.
  const standaloneFeesZar = personIds
    .filter((pid) => personTotalGrams[pid] === 0)
    .reduce((sum, pid) => sum + personFees[pid], 0);

  const lotsTotalZar = totalOrderZar - standaloneFeesZar;

  return {
    totalOrderZar,
    totalGoodsZar,
    totalFeesZar,
    roundingAbsorbed,
    personResults,
    lotsTotalZar,
    standaloneFeesZar,
  };
}

// ─── Test Helper: Order Builder ────────────────────────────────
function buildOrder(
  lotsConfig: {
    foreignPrice: number;
    gramsPerBag: number;
    bags: { splitMode: Bag['splitMode']; buyers: { pid: string; grams: number }[] }[];
  }[],
  feesConfig: { label: string; amountZar: number; allocationType: Fee['allocationType']; personId?: string }[],
  goodsTotalZar: number,
  payerId: string
): Order {
  const lots: CoffeeLot[] = lotsConfig.map((lc, lIdx) => {
    const bags: Bag[] = lc.bags.map((b, bIdx) => ({
      id: `bag-${lIdx}-${bIdx}`,
      splitMode: b.splitMode,
      buyers: b.buyers.map((by, byIdx) => ({
        id: `buyer-${lIdx}-${bIdx}-${byIdx}`,
        personId: by.pid,
        grams: by.grams,
      })),
    }));

    const totalGrams = lc.gramsPerBag * bags.length;
    const buyerGrams = bags.reduce((s, bag) => s + bag.buyers.reduce((bs, b) => bs + b.grams, 0), 0);
    if (buyerGrams !== totalGrams) {
      throw new Error(`Lot ${lIdx} buyer grams (${buyerGrams}) != total grams (${totalGrams})`);
    }

    return {
      id: `lot-${lIdx}`,
      name: `Lot ${lIdx + 1}`,
      foreignPricePerBag: lc.foreignPrice,
      gramsPerBag: lc.gramsPerBag,
      quantity: bags.length,
      bags,
      shares: [],
    };
  });

  const fees: Fee[] = feesConfig.map((fc, fIdx) => ({
    id: `fee-${fIdx}`,
    label: fc.label,
    amountZar: fc.amountZar,
    allocationType: fc.allocationType,
    personId: fc.personId,
  }));

  return {
    id: 'test-order',
    workspaceId: 'ws-1',
    name: 'Test Order',
    orderDate: '2026-10-23',
    roasterId: null,
    roasterSnapshot: null,
    payerId,
    payerBank: { bankName: 'FNB', accountNumber: '1234567890', beneficiary: 'Payer' },
    referenceTemplate: 'FAJR-{ORDER}-{NAME}',
    goodsTotalZar,
    lots,
    fees,
    payments: {},
    isArchived: false,
    createdAt: '2026-10-23T00:00:00Z',
    updatedAt: '2026-10-23T00:00:00Z',
  };
}

describe('Empirical Verification: Mathematical Oracle vs calculate()', () => {
  it('Oracle matches calculate() for multi-lot uneven split with multiple fees', () => {
    const order = buildOrder(
      [
        {
          foreignPrice: 22.5,
          gramsPerBag: 250,
          bags: [
            {
              splitMode: 'custom',
              buyers: [
                { pid: 'alice', grams: 150 },
                { pid: 'bob', grams: 100 },
              ],
            },
            {
              splitMode: 'full',
              buyers: [{ pid: 'charlie', grams: 250 }],
            },
          ],
        },
        {
          foreignPrice: 18.0,
          gramsPerBag: 500,
          bags: [
            {
              splitMode: 'equal',
              buyers: [
                { pid: 'alice', grams: 250 },
                { pid: 'bob', grams: 250 },
              ],
            },
          ],
        },
      ],
      [
        { label: 'Disbursement', amountZar: 250.0, allocationType: 'equal_per_person' },
        { label: 'Customs', amountZar: 420.5, allocationType: 'proportional_by_value' },
        { label: 'PUDO Delivery', amountZar: 65.0, allocationType: 'specific_person', personId: 'charlie' },
      ],
      1850.75,
      'bob'
    );

    const calcResult = calculate(order, { alice: 'Alice', bob: 'Bob', charlie: 'Charlie' });
    const oracleResult = oracleCalculate(order);

    expect(calcResult.isValid).toBe(true);

    // Order level invariants
    expect(calcResult.totalOrderZar).toBeCloseTo(oracleResult.totalOrderZar, 6);
    expect(calcResult.totalGoodsZar).toBeCloseTo(oracleResult.totalGoodsZar, 6);
    expect(calcResult.totalFeesZar).toBeCloseTo(oracleResult.totalFeesZar, 6);
    expect(calcResult.roundingAbsorbed).toBeCloseTo(oracleResult.roundingAbsorbed, 6);

    // Per-person exact comparison
    for (const pid of calcResult.personIds) {
      const actual = calcResult.personCalcs[pid];
      const expected = oracleResult.personResults[pid];

      expect(actual.goodsZar).toBeCloseTo(expected.goodsZar, 6);
      expect(actual.feesZar).toBeCloseTo(expected.feesZar, 6);
      expect(actual.totalPreRound).toBeCloseTo(expected.totalPreRound, 6);
      expect(actual.totalFinal).toBe(expected.totalFinal);

      // Verify Non-payer floor rule
      if (pid !== order.payerId) {
        expect(actual.totalFinal).toBe(Math.floor(actual.totalPreRound * 100) / 100);
        expect(actual.totalFinal).toBeLessThanOrEqual(actual.totalPreRound);
      }
    }

    // Payer absorbs remainder
    const sumNonPayers = calcResult.personIds
      .filter((pid) => pid !== order.payerId)
      .reduce((s, pid) => s + calcResult.personCalcs[pid].totalFinal, 0);

    expect(calcResult.personCalcs['bob'].totalFinal).toBe(
      Math.round((calcResult.totalOrderZar - sumNonPayers) * 100) / 100
    );

    // Cent conservation: exact sum equals totalOrderZar
    const grandSum = calcResult.personIds.reduce(
      (s, pid) => s + calcResult.personCalcs[pid].totalFinal,
      0
    );
    expect(grandSum).toBe(calcResult.totalOrderZar);
  });

  it('Verifies 100% equivalence between legacy fee aliases and canonical enums', () => {
    // We construct 4 variants of the same order:
    // Variant 1: all legacy ('fixed_shared', 'value_based')
    // Variant 2: all canonical ('equal_per_person', 'proportional_by_value')
    // Variant 3: mixed 1 ('fixed_shared', 'proportional_by_value')
    // Variant 4: mixed 2 ('equal_per_person', 'value_based')
    const configs: [Fee['allocationType'], Fee['allocationType']][] = [
      ['fixed_shared', 'value_based'],
      ['equal_per_person', 'proportional_by_value'],
      ['fixed_shared', 'proportional_by_value'],
      ['equal_per_person', 'value_based'],
    ];

    const results: CalculationResult[] = configs.map(([alloc1, alloc2]) => {
      const order = buildOrder(
        [
          {
            foreignPrice: 24,
            gramsPerBag: 250,
            bags: [
              {
                splitMode: 'equal',
                buyers: [
                  { pid: 'alice', grams: 125 },
                  { pid: 'bob', grams: 125 },
                ],
              },
            ],
          },
        ],
        [
          { label: 'Fee 1', amountZar: 180, allocationType: alloc1 },
          { label: 'Fee 2', amountZar: 320, allocationType: alloc2 },
        ],
        900,
        'alice'
      );
      return calculate(order, { alice: 'Alice', bob: 'Bob' });
    });

    const [r1, r2, r3, r4] = results;

    // All results must be valid
    expect(r1.isValid).toBe(true);
    expect(r2.isValid).toBe(true);
    expect(r3.isValid).toBe(true);
    expect(r4.isValid).toBe(true);

    // Totals must be identical
    for (const r of [r2, r3, r4]) {
      expect(r.totalOrderZar).toBe(r1.totalOrderZar);
      expect(r.totalGoodsZar).toBe(r1.totalGoodsZar);
      expect(r.totalFeesZar).toBe(r1.totalFeesZar);
      expect(r.roundingAbsorbed).toBe(r1.roundingAbsorbed);

      for (const pid of ['alice', 'bob']) {
        expect(r.personCalcs[pid].goodsZar).toBe(r1.personCalcs[pid].goodsZar);
        expect(r.personCalcs[pid].feesZar).toBe(r1.personCalcs[pid].feesZar);
        expect(r.personCalcs[pid].totalPreRound).toBe(r1.personCalcs[pid].totalPreRound);
        expect(r.personCalcs[pid].totalFinal).toBe(r1.personCalcs[pid].totalFinal);
        expect(r.personCalcs[pid].coffeeValueForeignShare).toBe(r1.personCalcs[pid].coffeeValueForeignShare);
      }

      for (let i = 0; i < r.lotCalcs.length; i++) {
        expect(r.lotCalcs[i].goodsZar).toBe(r1.lotCalcs[i].goodsZar);
        expect(r.lotCalcs[i].feesZar).toBe(r1.lotCalcs[i].feesZar);
        expect(r.lotCalcs[i].totalZar).toBe(r1.lotCalcs[i].totalZar);
      }
    }
  });

  describe('CoffeeCostSummary Reconciliation with Standalone Fees', () => {
    it('Reconciles cleanly when NO fees exist', () => {
      const order = buildOrder(
        [
          {
            foreignPrice: 20,
            gramsPerBag: 250,
            bags: [{ splitMode: 'full', buyers: [{ pid: 'p1', grams: 250 }] }],
          },
        ],
        [],
        500,
        'p1'
      );
      const res = calculate(order, {});
      const lotsTotal = res.lotCalcs.reduce((s, l) => s + l.totalZar, 0);
      const standalone = Math.max(0, Math.round((res.totalOrderZar - lotsTotal) * 100) / 100);

      expect(lotsTotal).toBe(500);
      expect(standalone).toBe(0);
      expect(lotsTotal + standalone).toBe(res.totalOrderZar);
    });

    it('Reconciles cleanly when general fees exist and all participants have > 0g', () => {
      const order = buildOrder(
        [
          {
            foreignPrice: 20,
            gramsPerBag: 250,
            bags: [
              {
                splitMode: 'equal',
                buyers: [
                  { pid: 'p1', grams: 125 },
                  { pid: 'p2', grams: 125 },
                ],
              },
            ],
          },
        ],
        [
          { label: 'Equal fee', amountZar: 100, allocationType: 'equal_per_person' },
          { label: 'Value fee', amountZar: 150, allocationType: 'proportional_by_value' },
        ],
        500,
        'p1'
      );
      const res = calculate(order, {});
      const lotsTotal = res.lotCalcs.reduce((s, l) => s + l.totalZar, 0);
      const standalone = Math.max(0, Math.round((res.totalOrderZar - lotsTotal) * 100) / 100);

      expect(standalone).toBe(0);
      expect(Math.round(lotsTotal * 100) / 100).toBe(res.totalOrderZar);
      expect(lotsTotal + standalone).toBeCloseTo(res.totalOrderZar, 6);
    });

    it('Reconciles when a 0g participant has a standalone specific_person fee', () => {
      const order = buildOrder(
        [
          {
            foreignPrice: 20,
            gramsPerBag: 250,
            bags: [{ splitMode: 'full', buyers: [{ pid: 'p1', grams: 250 }] }],
          },
        ],
        [
          { label: 'Coffee fee', amountZar: 100, allocationType: 'equal_per_person' },
          { label: 'Standalone Courier', amountZar: 85, allocationType: 'specific_person', personId: 'non-buyer' },
        ],
        500,
        'p1'
      );
      const res = calculate(order, {});
      expect(res.personIds).toContain('non-buyer');
      expect(res.personCalcs['non-buyer'].totalGrams).toBe(0);
      expect(res.personCalcs['non-buyer'].totalFinal).toBe(85);

      const lotsTotal = res.lotCalcs.reduce((s, l) => s + l.totalZar, 0);
      const standalone = Math.max(0, Math.round((res.totalOrderZar - lotsTotal) * 100) / 100);

      expect(lotsTotal).toBe(600); // 500 goods + 100 equal fee (allocated to p1)
      expect(standalone).toBe(85); // 85 standalone courier fee
      expect(lotsTotal + standalone).toBe(res.totalOrderZar); // 685
    });

    it('Reconciles when PAYER has 0g and has a standalone fee', () => {
      // Payer is organizer who does not buy coffee, but pays R50 bank fee
      const order = buildOrder(
        [
          {
            foreignPrice: 20,
            gramsPerBag: 250,
            bags: [
              {
                splitMode: 'equal',
                buyers: [
                  { pid: 'buyer-a', grams: 125 },
                  { pid: 'buyer-b', grams: 125 },
                ],
              },
            ],
          },
        ],
        [
          { label: 'Bank Fee', amountZar: 50.33, allocationType: 'specific_person', personId: 'organizer' },
        ],
        600.77,
        'organizer'
      );
      const res = calculate(order, {});
      expect(res.isValid).toBe(true);
      expect(res.personCalcs['organizer'].totalGrams).toBe(0);

      const lotsTotal = res.lotCalcs.reduce((s, l) => s + l.totalZar, 0);
      const standalone = Math.max(0, Math.round((res.totalOrderZar - lotsTotal) * 100) / 100);

      expect(lotsTotal).toBeCloseTo(600.77, 4);
      expect(standalone).toBe(50.33);
      expect(Math.round((lotsTotal + standalone) * 100) / 100).toBe(res.totalOrderZar);

      // Cent conservation across participants
      const sumFinal = res.personIds.reduce((s, pid) => s + res.personCalcs[pid].totalFinal, 0);
      expect(sumFinal).toBe(res.totalOrderZar);
    });

    it('Reconciles when PAYER has 0g and NO fees (only absorbs remainder)', () => {
      // Payer pays for the order, but buys 0g and has 0 fees
      const order = buildOrder(
        [
          {
            foreignPrice: 20,
            gramsPerBag: 300,
            bags: [
              {
                splitMode: 'equal',
                buyers: [
                  { pid: 'b1', grams: 100 },
                  { pid: 'b2', grams: 100 },
                  { pid: 'b3', grams: 100 },
                ],
              },
            ],
          },
        ],
        [],
        1000.0,
        'organizer'
      );
      const res = calculate(order, {});
      expect(res.isValid).toBe(true);

      // b1, b2, b3 each have 1000 / 3 = 333.3333... ZAR floored to 333.33
      expect(res.personCalcs['b1'].totalFinal).toBe(333.33);
      expect(res.personCalcs['b2'].totalFinal).toBe(333.33);
      expect(res.personCalcs['b3'].totalFinal).toBe(333.33);

      // Organizer (Payer, 0g) absorbs the 1 cent remainder!
      expect(res.personCalcs['organizer'].totalFinal).toBe(0.01);

      const sumFinal = res.personIds.reduce((s, pid) => s + res.personCalcs[pid].totalFinal, 0);
      expect(sumFinal).toBe(1000.0);
    });

    it('Evaluates floating-point precision on R20.40 50/50 split', () => {
      // In JS: 10.20 * 100 === 1019.9999999999999.
      // Let's test whether calculate() produces 10.20 or 10.19 for the non-payer.
      const order = buildOrder(
        [
          {
            foreignPrice: 10,
            gramsPerBag: 200,
            bags: [
              {
                splitMode: 'equal',
                buyers: [
                  { pid: 'payer', grams: 100 },
                  { pid: 'buyer2', grams: 100 },
                ],
              },
            ],
          },
        ],
        [],
        20.40,
        'payer'
      );
      const res = calculate(order, {});
      expect(res.isValid).toBe(true);
      const b2Final = res.personCalcs['buyer2'].totalFinal;
      const payerFinal = res.personCalcs['payer'].totalFinal;

      // Invariant: Non-payer is floored per README: Math.floor(preRound * 100) / 100
      // In JavaScript float arithmetic, 20.40 / 2 = 10.2.
      // 10.2 * 100 is 1019.9999999999999, so Math.floor is 1019 -> 10.19!
      // Cent conservation holds: 10.19 + 10.21 === 20.40.
      expect(b2Final + payerFinal).toBe(20.40);
    });

    it('Reconciles with multiple 0g standalone fee recipients and general fees', () => {
      const order = buildOrder(
        [
          {
            foreignPrice: 25,
            gramsPerBag: 250,
            bags: [
              {
                splitMode: 'full',
                buyers: [{ pid: 'buyer1', grams: 250 }],
              },
            ],
          },
        ],
        [
          { label: 'General equal fee', amountZar: 50, allocationType: 'equal_per_person' },
          { label: 'Courier 1', amountZar: 60, allocationType: 'specific_person', personId: 'nonbuyer1' },
          { label: 'Courier 2', amountZar: 75, allocationType: 'specific_person', personId: 'nonbuyer2' },
          { label: 'Organizer handling', amountZar: 40, allocationType: 'specific_person', personId: 'organizer' },
        ],
        500,
        'organizer'
      );

      const res = calculate(order, {});
      expect(res.isValid).toBe(true);

      // Buyer1: 500 goods + 50 equal fee = 550
      expect(res.personCalcs['buyer1'].totalFinal).toBe(550);

      // Non-buyers: 0g, pay only their specific fees
      expect(res.personCalcs['nonbuyer1'].totalFinal).toBe(60);
      expect(res.personCalcs['nonbuyer2'].totalFinal).toBe(75);

      // Organizer (payer, 0g): gets specific fee of 40, absorbs 0 remainder = 40
      expect(res.personCalcs['organizer'].totalFinal).toBe(40);

      // CoffeeCostSummary reconciliation:
      const lotsTotal = res.lotCalcs.reduce((s, l) => s + l.totalZar, 0);
      const standalone = Math.max(0, Math.round((res.totalOrderZar - lotsTotal) * 100) / 100);

      // lotsTotal should be exactly 550 (buyer1's coffee line including the general fee)
      expect(lotsTotal).toBe(550);
      // standalone should be 60 + 75 + 40 = 175
      expect(standalone).toBe(175);
      // Sum matches totalOrderZar: 550 + 175 = 725
      expect(lotsTotal + standalone).toBe(res.totalOrderZar);
      expect(res.totalOrderZar).toBe(725);
    });

    it('Handles single-person order where buyer is also payer', () => {
      const order = buildOrder(
        [
          {
            foreignPrice: 30,
            gramsPerBag: 250,
            bags: [{ splitMode: 'full', buyers: [{ pid: 'solo', grams: 250 }] }],
          },
        ],
        [
          { label: 'Shipping', amountZar: 120, allocationType: 'equal_per_person' },
        ],
        450,
        'solo'
      );

      const res = calculate(order, {});
      expect(res.isValid).toBe(true);
      expect(res.personIds).toHaveLength(1);
      expect(res.personCalcs['solo'].totalFinal).toBe(570);
      expect(res.totalOrderZar).toBe(570);
      expect(res.roundingAbsorbed).toBe(0);

      const lotsTotal = res.lotCalcs.reduce((s, l) => s + l.totalZar, 0);
      const standalone = Math.max(0, Math.round((res.totalOrderZar - lotsTotal) * 100) / 100);
      expect(lotsTotal).toBe(570);
      expect(standalone).toBe(0);
    });

    it('Evaluates untrimmed payerId: demonstrates whether trailing space breaks remainder absorption', () => {
      const order = buildOrder(
        [
          {
            foreignPrice: 10,
            gramsPerBag: 300,
            bags: [
              {
                splitMode: 'equal',
                buyers: [
                  { pid: 'alice', grams: 100 },
                  { pid: 'bob', grams: 100 },
                  { pid: 'charlie', grams: 100 },
                ],
              },
            ],
          },
        ],
        [],
        100,
        'alice ' // Untrimmed!
      );

      const res = calculate(order, {});
      expect(res.isValid).toBe(true);

      const sumFinal = res.personIds.reduce((s, pid) => s + res.personCalcs[pid].totalFinal, 0);
      console.log('Untrimmed payerId test:', {
        sumFinal,
        alice: res.personCalcs['alice']?.totalFinal,
        untrimmedAlice: res.personCalcs['alice ']?.totalFinal,
        personIds: res.personIds,
      });

      // If untrimmed payerId breaks absorption:
      // alice gets 33.33 (floored as non-payer), bob gets 33.33, charlie gets 33.33. Sum = 99.99 (1 cent lost!).
      // If trimmed properly, alice absorbs remainder and gets 33.34. Sum = 100.00.
    });
  });

  describe('Fuzzing & Property-Based Stress Harness (1,000 Randomized Permutations)', () => {
    it('verifies mathematical invariants across 1,000 pseudo-random orders', () => {
      const pids = ['p-payer', 'p-buyer1', 'p-buyer2', 'p-buyer3', 'p-buyer4', 'p-nonbuyer'];

      // Simple deterministic LCG random generator for reproducible stress testing
      let seed = 123456789;
      function rand(): number {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      }
      function randInt(min: number, max: number): number {
        return Math.floor(rand() * (max - min + 1)) + min;
      }

      for (let trial = 0; trial < 1000; trial++) {
        const numLots = randInt(1, 3);
        const lotsConfig: {
          foreignPrice: number;
          gramsPerBag: number;
          bags: { splitMode: Bag['splitMode']; buyers: { pid: string; grams: number }[] }[];
        }[] = [];

        for (let l = 0; l < numLots; l++) {
          const gramsPerBag = [200, 250, 500][randInt(0, 2)];
          const foreignPrice = randInt(10, 50);
          const numBags = randInt(1, 3);
          const bags: { splitMode: Bag['splitMode']; buyers: { pid: string; grams: number }[] }[] = [];

          for (let b = 0; b < numBags; b++) {
            const splitModeChoice = randInt(0, 2);
            if (splitModeChoice === 0) {
              // full bag
              const buyerPid = pids[randInt(0, 4)];
              bags.push({
                splitMode: 'full',
                buyers: [{ pid: buyerPid, grams: gramsPerBag }],
              });
            } else if (splitModeChoice === 1) {
              // 2-way equal split
              const b1 = pids[randInt(0, 4)];
              let b2 = pids[randInt(0, 4)];
              if (b2 === b1) b2 = pids[(pids.indexOf(b1) + 1) % 5];
              const half = gramsPerBag / 2;
              bags.push({
                splitMode: 'equal',
                buyers: [
                  { pid: b1, grams: half },
                  { pid: b2, grams: half },
                ],
              });
            } else {
              // custom split
              const b1 = pids[randInt(0, 4)];
              let b2 = pids[randInt(0, 4)];
              if (b2 === b1) b2 = pids[(pids.indexOf(b1) + 1) % 5];
              const part1 = randInt(10, gramsPerBag - 10);
              const part2 = gramsPerBag - part1;
              bags.push({
                splitMode: 'custom',
                buyers: [
                  { pid: b1, grams: part1 },
                  { pid: b2, grams: part2 },
                ],
              });
            }
          }

          lotsConfig.push({ foreignPrice, gramsPerBag, bags });
        }

        // Random goods total (with cents)
        const goodsTotalZar = Math.round((rand() * 5000 + 100) * 100) / 100;

        // Fees
        const feeTypes: Fee['allocationType'][] = [
          'equal_per_person',
          'proportional_by_value',
          'fixed_shared',
          'value_based',
          'specific_person',
        ];
        const numFees = randInt(0, 3);
        const feesConfig: { label: string; amountZar: number; allocationType: Fee['allocationType']; personId?: string }[] = [];

        for (let f = 0; f < numFees; f++) {
          const type = feeTypes[randInt(0, feeTypes.length - 1)];
          const amount = Math.round((rand() * 200 + 10) * 100) / 100;
          let targetPerson: string | undefined = undefined;
          if (type === 'specific_person') {
            targetPerson = pids[randInt(0, pids.length - 1)];
          }
          feesConfig.push({
            label: `Fee ${f}`,
            amountZar: amount,
            allocationType: type,
            personId: targetPerson,
          });
        }

        // Payer: pick buyer or p-nonbuyer
        const payerId = pids[randInt(0, pids.length - 1)];

        const order = buildOrder(lotsConfig, feesConfig, goodsTotalZar, payerId);
        const calcRes = calculate(order, {});
        const oracleRes = oracleCalculate(order);

        // Verification 1: Valid
        expect(calcRes.isValid).toBe(true);

        // Verification 2: Cent Conservation
        const sumFinal = calcRes.personIds.reduce(
          (s, pid) => s + calcRes.personCalcs[pid].totalFinal,
          0
        );
        expect(Math.round(sumFinal * 100) / 100).toBe(Math.round(calcRes.totalOrderZar * 100) / 100);

        // Verification 3: Non-payer floor rule & No overcharging
        for (const pid of calcRes.personIds) {
          const pc = calcRes.personCalcs[pid];
          if (pid !== payerId) {
            expect(pc.totalFinal).toBe(Math.floor((pc.totalPreRound + 1e-9) * 100) / 100);
            expect(pc.totalFinal).toBeLessThanOrEqual(pc.totalPreRound + 1e-9);
          }
        }

        // Verification 4: Payer absorbs remainder
        const sumNonPayers = calcRes.personIds
          .filter((pid) => pid !== payerId)
          .reduce((s, pid) => s + calcRes.personCalcs[pid].totalFinal, 0);

        const expectedPayerFinal = Math.round((calcRes.totalOrderZar - sumNonPayers) * 100) / 100;
        expect(calcRes.personCalcs[payerId].totalFinal).toBe(expectedPayerFinal);

        // Verification 5: CoffeeCostSummary reconciliation
        const lotsTotal = calcRes.lotCalcs.reduce((s, l) => s + l.totalZar, 0);
        const standaloneFees = Math.max(0, Math.round((calcRes.totalOrderZar - lotsTotal) * 100) / 100);
        expect(Math.round((lotsTotal + standaloneFees) * 100) / 100).toBe(Math.round(calcRes.totalOrderZar * 100) / 100);

        // Verification 6: Oracle Match
        for (const pid of calcRes.personIds) {
          const actual = calcRes.personCalcs[pid].totalFinal === 0 ? 0 : calcRes.personCalcs[pid].totalFinal;
          const expected = oracleRes.personResults[pid].totalFinal === 0 ? 0 : oracleRes.personResults[pid].totalFinal;
          expect(actual).toBe(expected);
        }
      }
    });
  });
});
