import { describe, it, expect } from 'vitest';
import {
  normalizeOrderForPersistence,
  validatePersistableOrder,
  assertCanPersistOrder,
} from './orderIntegrity';
import type { Order, Person } from '../types';

describe('orderIntegrity', () => {
  const people: Person[] = [
    {
      id: 'person-1',
      workspaceId: 'ws-1',
      name: 'Person One',
      email: 'one@example.com',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'person-2',
      workspaceId: 'ws-1',
      name: 'Person Two',
      email: 'two@example.com',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ];

  const validOrder: Order = {
    id: 'order-1',
    workspaceId: 'ws-1',
    name: 'Sample Order',
    orderDate: '2026-03-01',
    roasterId: null,
    roasterSnapshot: null,
    payerId: 'person-1',
    payerBank: { bankName: 'FNB', accountNumber: '1234567890', beneficiary: 'Person One' },
    referenceTemplate: 'FAJR-{ORDER}-{NAME}',
    goodsTotalZar: 500,
    lots: [
      {
        id: 'lot-1',
        name: 'Ethiopian Guji',
        foreignPricePerBag: 15,
        gramsPerBag: 250,
        quantity: 1,
        shares: [{ id: 's-1', personId: 'person-1', shareGrams: 250 }],
        bags: [
          {
            id: 'b-1',
            splitMode: 'full',
            buyers: [{ id: 'by-1', personId: 'person-1', grams: 250 }],
          },
        ],
      },
    ],
    fees: [
      { id: 'fee-1', label: 'Courier', amountZar: 60, allocationType: 'specific_person', personId: 'person-2' },
    ],
    payments: {},
    isArchived: false,
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z',
  };

  describe('normalizeOrderForPersistence', () => {
    it('serializes lots from bags and normalizes null fees/payments', () => {
      const orderToNormalize = {
        ...validOrder,
        fees: [],
        payments: {},
      };

      const normalized = normalizeOrderForPersistence(orderToNormalize);
      expect(Array.isArray(normalized.fees)).toBe(true);
      expect(normalized.fees).toHaveLength(0);
      expect(typeof normalized.payments).toBe('object');
      expect(normalized.payments).toEqual({});
      expect(normalized.lots[0].bags).toBeDefined();
    });
  });

  describe('validatePersistableOrder', () => {
    it('returns error when order is missing an ID', () => {
      const order = { ...validOrder, id: '' };
      const errors = validatePersistableOrder(order, { strict: false });
      expect(errors).toContain('Order is missing an ID.');
    });

    it('bypasses deeper checks when strict is false', () => {
      const draft = { ...validOrder, lots: [] };
      const errors = validatePersistableOrder(draft, { strict: false });
      expect(errors).toHaveLength(0);
    });

    it('validates lots presence when strict is true', () => {
      const order = { ...validOrder, lots: [] };
      const errors = validatePersistableOrder(order, { people, strict: true });
      expect(errors).toContain('Saved orders must keep at least one coffee lot.');
    });

    it('validates lot bags and buyer grams in strict mode', () => {
      const invalidGramsOrder: Order = {
        ...validOrder,
        lots: [
          {
            ...validOrder.lots[0],
            bags: [
              {
                id: 'b-1',
                splitMode: 'full',
                buyers: [{ id: 'by-1', personId: 'person-1', grams: 100 }], // 100g !== 250g
              },
            ],
          },
        ],
      };
      const errors = validatePersistableOrder(invalidGramsOrder, { people, strict: true });
      expect(errors).toContain('"Ethiopian Guji" bag 1 buyer grams must total 250g.');
    });

    it('validates directory references for buyers and specific fees in strict mode', () => {
      const invalidPersonOrder: Order = {
        ...validOrder,
        fees: [
          { id: 'fee-unknown', label: 'Courier', amountZar: 60, allocationType: 'specific_person', personId: 'unknown-person' },
        ],
      };
      const errors = validatePersistableOrder(invalidPersonOrder, { people, strict: true });
      expect(errors).toContain('"Courier" references a person that is not in the directory.');
    });
  });

  describe('assertCanPersistOrder', () => {
    it('returns normalized order when validation passes', () => {
      const result = assertCanPersistOrder(validOrder, { people, strict: true });
      expect(result.id).toBe(validOrder.id);
      expect(result.lots).toHaveLength(1);
    });

    it('throws error when validation fails', () => {
      const badOrder = { ...validOrder, id: '' };
      expect(() => assertCanPersistOrder(badOrder, { strict: false })).toThrow('Order is missing an ID.');
    });
  });
});
