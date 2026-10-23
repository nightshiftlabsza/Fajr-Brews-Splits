import { describe, it, expect } from 'vitest';
import { calculate } from './calculations';
import { parseMoneyInput } from './formatters';
import type { Order, CoffeeLot, Fee } from '../types';

function makeLot(
  id: string,
  name: string,
  gramsPerBag: number,
  foreignPricePerBag: number,
  buyers: { personId: string; grams: number }[]
): CoffeeLot {
  return {
    id,
    name,
    gramsPerBag,
    foreignPricePerBag,
    quantity: 1,
    shares: [],
    bags: [
      {
        id: `bag-${id}`,
        splitMode: 'equal',
        buyers: buyers.map((b, i) => ({
          id: `buyer-${id}-${i}`,
          personId: b.personId,
          grams: b.grams,
        })),
      },
    ],
  };
}

function createOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'test-order-stress',
    name: 'Stress Order',
    workspaceId: 'ws-1',
    orderDate: '2026-10-23',
    status: 'locked',
    isArchived: false,
    roasterId: null,
    roasterSnapshot: null,
    payerId: 'p-payer',
    payerBank: { bankName: 'FNB', accountNumber: '1234567890', beneficiary: 'Payer' },
    referenceTemplate: 'FAJR-{ORDER}-{NAME}',
    goodsTotalZar: 1000,
    lots: [
      makeLot('lot-1', 'Kenya Nyeri', 250, 20, [
        { personId: 'p-payer', grams: 125 },
        { personId: 'p-buyer2', grams: 125 },
      ]),
    ],
    fees: [],
    payments: {},
    createdAt: '2026-10-23T10:00:00Z',
    updatedAt: '2026-10-23T10:00:00Z',
    ...overrides,
  };
}

describe('Adversarial Stress Testing: calculations.ts & parseMoneyInput', () => {
  describe('Empirical Defect 1: Floating-Point Under-Flooring (Math.floor precision loss)', () => {
    it('demonstrates IEEE 754 precision loss on 50/50 split of R20.40 (drops 1 cent to 10.19)', () => {
      // 50/50 split of R20.40 = exactly R10.20 each.
      // In JS IEEE 754: 10.20 * 100 === 1019.9999999999999.
      // Math.floor(10.20 * 100) / 100 evaluates to 10.19!
      // This undercharges non-payer (10.19) and overcharges payer (10.21).
      const order = createOrder({
        goodsTotalZar: 20.40,
        payerId: 'p-payer',
        lots: [
          makeLot('lot-1', 'Lot 1', 250, 10, [
            { personId: 'p-payer', grams: 125 },
            { personId: 'p-buyer2', grams: 125 },
          ]),
        ],
      });

      const res = calculate(order, {});
      expect(res.isValid).toBe(true);
      const buyer2Final = res.personCalcs['p-buyer2'].totalFinal;
      const payerFinal = res.personCalcs['p-payer'].totalFinal;

      // EMPIRICAL BUG REPRODUCTION:
      // When unpatched, buyer2 gets 10.19 and payer gets 10.21.
      // Expected mathematical invariant: 10.20 for both.
      expect(buyer2Final).toBe(10.20);
      expect(payerFinal).toBe(10.20);
    });

    it('demonstrates precision loss across known trap numbers (0.29, 0.57, 1.13, 1.15, 2.01, 10.03)', () => {
      const traps = [0.29, 0.57, 1.13, 1.14, 1.15, 2.01, 2.26, 4.02, 10.03, 10.20, 16.06];
      for (const trap of traps) {
        const order = createOrder({
          goodsTotalZar: Math.round(trap * 2 * 100) / 100,
          payerId: 'p-payer',
          lots: [
            makeLot('lot-1', 'Lot 1', 200, 10, [
              { personId: 'p-payer', grams: 100 },
              { personId: 'p-buyer2', grams: 100 },
            ]),
          ],
        });

        const res = calculate(order, {});
        expect(res.isValid).toBe(true);
        const buyer2Final = res.personCalcs['p-buyer2'].totalFinal;
        expect(buyer2Final).toBe(trap);
      }
    });
  });

  describe('Empirical Defect 2: Untrimmed payerId Breaks Remainder Absorption', () => {
    it('fails to absorb remainder and loses cents if payerId has trailing whitespace', () => {
      const order = createOrder({
        goodsTotalZar: 100,
        payerId: 'p-payer ', // Untrimmed whitespace
        lots: [
          makeLot('lot-1', 'Lot 1', 300, 10, [
            { personId: 'p-payer', grams: 100 },
            { personId: 'p-b2', grams: 100 },
            { personId: 'p-b3', grams: 100 },
          ]),
        ],
      });

      const res = calculate(order, {});
      expect(res.isValid).toBe(true);
      const sumFinal = res.personIds.reduce((s, pid) => s + res.personCalcs[pid].totalFinal, 0);

      // EMPIRICAL BUG REPRODUCTION:
      // When unpatched, sumFinal evaluates to 99.99 because 'p-payer ' !== 'p-payer'.
      // Expected invariant: exactly 100.00.
      expect(Math.round(sumFinal * 100) / 100).toBe(100.00);
      expect(res.personCalcs['p-payer'].totalFinal).toBe(33.34);
    });
  });

  describe('Stress Invariants: Odd Cents Splits (7-way, 11-way, 13-way)', () => {
    it('7-way split of 1 cent remainder reconciles exactly to totalOrderZar', () => {
      const people = ['p-payer', 'p-2', 'p-3', 'p-4', 'p-5', 'p-6', 'p-7'];
      const order = createOrder({
        goodsTotalZar: 100.00,
        payerId: 'p-payer',
        lots: [
          makeLot(
            'lot-1',
            'Lot 1',
            700,
            10,
            people.map((pid) => ({ personId: pid, grams: 100 }))
          ),
        ],
      });

      const res = calculate(order, {});
      expect(res.isValid).toBe(true);
      for (const pid of ['p-2', 'p-3', 'p-4', 'p-5', 'p-6', 'p-7']) {
        expect(res.personCalcs[pid].totalFinal).toBe(14.28);
      }
      expect(res.personCalcs['p-payer'].totalFinal).toBe(14.32);
      const totalSum = res.personIds.reduce((s, pid) => s + res.personCalcs[pid].totalFinal, 0);
      expect(Math.round(totalSum * 100) / 100).toBe(100.00);
      expect(res.roundingAbsorbed).toBeCloseTo(14.32 - (100 / 7), 5);
    });

    it('13-way split of 0.01 ZAR remainder reconciles exactly', () => {
      const people = Array.from({ length: 13 }, (_, i) => `p-${i}`);
      const order = createOrder({
        goodsTotalZar: 130.01,
        payerId: 'p-0',
        lots: [
          makeLot(
            'lot-1',
            'Lot 1',
            1300,
            13,
            people.map((pid) => ({ personId: pid, grams: 100 }))
          ),
        ],
      });

      const res = calculate(order, {});
      expect(res.isValid).toBe(true);
      const totalSum = res.personIds.reduce((s, pid) => s + res.personCalcs[pid].totalFinal, 0);
      expect(Math.round(totalSum * 100) / 100).toBe(130.01);
      for (let i = 1; i < 13; i++) {
        expect(res.personCalcs[`p-${i}`].totalFinal).toBeLessThanOrEqual(res.personCalcs[`p-${i}`].totalPreRound);
      }
    });
  });

  describe('Zero-Gram Participants and Extreme Splits', () => {
    it('zero-gram participant receives specific_person fee, but zero equal_per_person or value_based fee', () => {
      const order = createOrder({
        goodsTotalZar: 500,
        payerId: 'p-payer',
        lots: [
          makeLot('lot-1', 'Lot 1', 250, 10, [
            { personId: 'p-payer', grams: 250 },
          ]),
        ],
        fees: [
          { id: 'f-1', label: 'Equal Shared', amountZar: 60, allocationType: 'equal_per_person' },
          { id: 'f-2', label: 'Value Based', amountZar: 40, allocationType: 'proportional_by_value' },
          { id: 'f-3', label: 'Courier to Non-Buyer', amountZar: 100, allocationType: 'specific_person', personId: 'p-zerogram' },
        ],
      });

      const res = calculate(order, {});
      expect(res.isValid).toBe(true);
      expect(res.personIds).toContain('p-zerogram');
      expect(res.personCalcs['p-zerogram'].totalGrams).toBe(0);
      expect(res.personCalcs['p-zerogram'].goodsZar).toBe(0);
      expect(res.personCalcs['p-zerogram'].feesZar).toBe(100);
      expect(res.personCalcs['p-zerogram'].totalFinal).toBe(100);
      expect(res.personCalcs['p-payer'].totalFinal).toBe(600);
      expect(res.totalOrderZar).toBe(700);
    });

    it('payer who has 0g absorbs remainder without error', () => {
      const order = createOrder({
        goodsTotalZar: 100,
        payerId: 'p-organizer',
        lots: [
          makeLot('lot-1', 'Lot 1', 300, 10, [
            { personId: 'p-b1', grams: 150 },
            { personId: 'p-b2', grams: 150 },
          ]),
        ],
        fees: [
          { id: 'f-1', label: 'Fee', amountZar: 10.01, allocationType: 'equal_per_person' },
        ],
      });

      const res = calculate(order, {});
      expect(res.isValid).toBe(true);
      expect(res.personIds).toContain('p-organizer');
      expect(res.personCalcs['p-organizer'].totalGrams).toBe(0);
      expect(res.personCalcs['p-b1'].totalFinal).toBe(55.00);
      expect(res.personCalcs['p-b2'].totalFinal).toBe(55.00);
      expect(res.personCalcs['p-organizer'].totalFinal).toBe(0.01);
      const totalSum = res.personIds.reduce((s, pid) => s + res.personCalcs[pid].totalFinal, 0);
      expect(Math.round(totalSum * 100) / 100).toBe(110.01);
    });

    it('handles extreme amounts (R1,000,000,000.00) without overflow or reconciliation loss', () => {
      const order = createOrder({
        goodsTotalZar: 1000000000.00,
        payerId: 'p-payer',
        lots: [
          makeLot('lot-1', 'Lot 1', 300, 10, [
            { personId: 'p-payer', grams: 100 },
            { personId: 'p-b1', grams: 100 },
            { personId: 'p-b2', grams: 100 },
          ]),
        ],
      });

      const res = calculate(order, {});
      expect(res.isValid).toBe(true);
      expect(res.totalOrderZar).toBe(1000000000.00);
      const totalSum = res.personIds.reduce((s, pid) => s + res.personCalcs[pid].totalFinal, 0);
      expect(Math.round(totalSum * 100) / 100).toBe(1000000000.00);
    });

    it('handles fees with R0.00 gracefully', () => {
      const order = createOrder({
        goodsTotalZar: 100,
        payerId: 'p-payer',
        fees: [
          { id: 'f-zero', label: 'Zero Fee', amountZar: 0, allocationType: 'equal_per_person' },
        ],
      });

      const res = calculate(order, {});
      expect(res.isValid).toBe(true);
      expect(res.totalFeesZar).toBe(0);
      expect(res.totalOrderZar).toBe(100);
    });
  });

  describe('Property-Based Fuzzing Across 10,000 Randomized Permutations', () => {
    it('conserves money and invariants over 10,000 randomized orders', () => {
      let seed = 42;
      function rand() {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      }

      for (let i = 0; i < 10000; i++) {
        const numLots = 1 + Math.floor(rand() * 3);
        const numPeople = 2 + Math.floor(rand() * 6);
        const people = Array.from({ length: numPeople }, (_, idx) => `user_${idx}`);
        const payerIdx = Math.floor(rand() * numPeople);
        const payerId = people[payerIdx];

        const goodsTotalZar = Math.round((50 + rand() * 5000) * 100) / 100;

        const lots: CoffeeLot[] = [];
        for (let l = 0; l < numLots; l++) {
          const gramsPerBag = [200, 250, 500, 1000][Math.floor(rand() * 4)];
          const foreignPricePerBag = Math.round((5 + rand() * 40) * 100) / 100;
          
          let remaining = gramsPerBag;
          const buyers = [];
          const buyersCount = 1 + Math.floor(rand() * numPeople);
          const chosenPeople = [...people].sort(() => rand() - 0.5).slice(0, buyersCount);

          for (let b = 0; b < chosenPeople.length; b++) {
            const isLast = b === chosenPeople.length - 1;
            const grams = isLast
              ? remaining
              : Math.max(1, Math.floor(rand() * (remaining - (chosenPeople.length - b - 1))));
            remaining -= grams;
            buyers.push({
              personId: chosenPeople[b],
              grams,
            });
          }

          lots.push(makeLot(`lot-${l}`, `Lot ${l}`, gramsPerBag, foreignPricePerBag, buyers));
        }

        const fees: Fee[] = [];
        const numFees = Math.floor(rand() * 4);
        for (let f = 0; f < numFees; f++) {
          const typeChoice = Math.floor(rand() * 3);
          const types: Fee['allocationType'][] = ['equal_per_person', 'proportional_by_value', 'specific_person'];
          const chosenType = types[typeChoice];
          const amountZar = Math.round((10 + rand() * 200) * 100) / 100;
          fees.push({
            id: `fee-${f}`,
            label: `Fee ${f}`,
            amountZar,
            allocationType: chosenType,
            personId: chosenType === 'specific_person' ? people[Math.floor(rand() * numPeople)] : null,
          });
        }

        const order: Order = {
          id: `order-fuzz-${i}`,
          name: `Fuzz Order ${i}`,
          workspaceId: 'ws-1',
          orderDate: '2026-10-23',
          status: 'locked',
          isArchived: false,
          roasterId: null,
          roasterSnapshot: null,
          payerId,
          payerBank: { bankName: 'FNB', accountNumber: '1234567890', beneficiary: 'Payer' },
          referenceTemplate: 'FAJR-{ORDER}-{NAME}',
          goodsTotalZar,
          lots,
          fees,
          payments: {},
          createdAt: '2026-10-23T10:00:00Z',
          updatedAt: '2026-10-23T10:00:00Z',
        };

        const res = calculate(order, {});
        if (!res.isValid) {
          throw new Error(`Order ${i} unexpectedly invalid: ${res.validationErrors.join(', ')}`);
        }

        // Invariant 1: Exact Cent Conservation
        const sumFinal = res.personIds.reduce((s, pid) => s + res.personCalcs[pid].totalFinal, 0);
        const expectedTotal = Math.round((goodsTotalZar + fees.reduce((s, f) => s + f.amountZar, 0)) * 100) / 100;
        expect(Math.round(sumFinal * 100) / 100).toBe(expectedTotal);

        // Invariant 2: Non-payers are NEVER overcharged due to rounding (allowing tiny float tolerance)
        for (const pid of res.personIds) {
          if (pid !== payerId) {
            expect(res.personCalcs[pid].totalFinal).toBeLessThanOrEqual(res.personCalcs[pid].totalPreRound + 0.0001);
          }
        }
      }
    });
  });

  describe('parseMoneyInput Stress Testing', () => {
    it('handles commas, spaces, currency symbols, and negatives correctly', () => {
      expect(parseMoneyInput('12,50')).toBe(12.50);
      expect(parseMoneyInput('1250,50')).toBe(1250.50);
      expect(parseMoneyInput('1 250,50')).toBe(1250.50);
      expect(parseMoneyInput('1,250.50')).toBe(1250.50);
      expect(parseMoneyInput('1.250,50')).toBe(1250.50);
      expect(parseMoneyInput('R 12,50')).toBe(12.50);
      expect(parseMoneyInput('ZAR 12.50')).toBe(12.50);
      expect(parseMoneyInput('12.50 ZAR')).toBe(12.50);
      expect(parseMoneyInput('$ 19.99')).toBe(19.99);
      expect(parseMoneyInput('€ 25,50')).toBe(25.50);
      expect(parseMoneyInput('£100.00')).toBe(100.00);
      expect(parseMoneyInput('-15,50')).toBe(-15.50);
      expect(parseMoneyInput('- R 50,25')).toBe(-50.25);
      expect(parseMoneyInput('R -50,25')).toBe(-50.25);
    });

    it('adversarial inputs with weird characters, multiple symbols, emojis, scientific notation', () => {
      // Empty / Null / Undefined
      expect(parseMoneyInput(null)).toBe(0);
      expect(parseMoneyInput(undefined)).toBe(0);
      expect(parseMoneyInput('')).toBe(0);
      expect(parseMoneyInput('   ')).toBe(0);

      // Multiple negatives
      expect(parseMoneyInput('--50')).toBe(-50);
      expect(parseMoneyInput('- - 50')).toBe(-50);

      // Positive sign
      expect(parseMoneyInput('+50.25')).toBe(50.25);

      // Single comma with no leading digits (,50)
      expect(parseMoneyInput(',50')).toBe(0.50);
      expect(parseMoneyInput('50,')).toBe(50);

      // Scientific notation
      expect(parseMoneyInput('1e3')).toBe(1000);
      expect(parseMoneyInput('1.5e2')).toBe(150);
      expect(parseMoneyInput('1e-2')).toBe(0.01);
      expect(parseMoneyInput('1e+4')).toBe(10000);

      // Trailing & leading spaces with tabs and newlines
      expect(parseMoneyInput('\n\t  R 450,75 \r\n ')).toBe(450.75);

      // Invalids
      expect(parseMoneyInput('abc')).toBe(0);
      expect(parseMoneyInput('NaN')).toBe(0);
      expect(parseMoneyInput('Infinity')).toBe(0);
      expect(parseMoneyInput('-Infinity')).toBe(0);

      // Emojis
      expect(parseMoneyInput('☕ 150.00')).toBe(0);
      expect(parseMoneyInput('150.00 ☕')).toBe(150.00);
      expect(parseMoneyInput('150,00 ☕')).toBe(150.00);

      // Large values
      expect(parseMoneyInput('1,000,000.00')).toBe(1000000);
      expect(parseMoneyInput('1.000.000,00')).toBe(1000000);
      expect(parseMoneyInput('1000000000')).toBe(1000000000);
    });
  });
});
