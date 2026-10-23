import { describe, expect, it } from 'vitest';
import type { Order, Person, Roaster } from '../types';
import { calculate } from './calculations';
import { applyOrderPatches, mergeConcurrentOrderUpdate, upsertPersonById, upsertRoasterById } from './storeState';

function makePerson(id: string, name: string): Person {
  return {
    id,
    workspaceId: 'workspace-1',
    name,
    createdAt: '2026-03-18T00:00:00.000Z',
    updatedAt: '2026-03-18T00:00:00.000Z',
  };
}

function makeRoaster(id: string, name: string, updatedAt = '2026-03-18T00:00:00.000Z'): Roaster {
  return {
    id,
    workspaceId: 'workspace-1',
    name,
    createdAt: '2026-03-18T00:00:00.000Z',
    updatedAt,
  };
}

const baseOrder: Order = {
  id: 'order-1',
  workspaceId: 'workspace-1',
  name: 'Fresh Order',
  orderDate: '2026-03-18',
  roasterId: null,
  roasterSnapshot: null,
  payerId: 'person-1',
  payerBank: { bankName: '', accountNumber: '', beneficiary: '' },
  referenceTemplate: 'FAJR-{ORDER}-{NAME}',
  goodsTotalZar: 0,
  lots: [],
  fees: [],
  payments: {},
  isArchived: false,
  createdAt: '2026-03-18T00:00:00.000Z',
  updatedAt: '2026-03-18T00:00:00.000Z',
};

const personNames = {
  'person-1': 'Zak',
  'person-2': 'Friend',
};

describe('store state helpers', () => {
  it('upsertPersonById prevents duplicate realtime/create merges for the same person id', () => {
    const buyer = makePerson('person-1', 'New Buyer');
    const once = upsertPersonById([], buyer);
    const twice = upsertPersonById(once, buyer);

    expect(once).toHaveLength(1);
    expect(twice).toHaveLength(1);
    expect(twice[0].id).toBe('person-1');
  });

  it('upsertRoasterById keeps the newest roaster first and replaces same-id updates', () => {
    const first = upsertRoasterById([], makeRoaster('roaster-1', 'Father Coffee'));
    const second = upsertRoasterById(first, makeRoaster('roaster-1', 'Father Coffee', '2026-03-19T00:00:00.000Z'));
    const third = upsertRoasterById(second, makeRoaster('roaster-2', 'Rosetta', '2026-03-20T00:00:00.000Z'));

    expect(second).toHaveLength(1);
    expect(third[0].id).toBe('roaster-2');
    expect(third[1].updatedAt).toBe('2026-03-19T00:00:00.000Z');
  });

  it('preserves lots, goods total, and fees through summary-style re-reads', () => {
    const finalOrder = applyOrderPatches(baseOrder, [
      {
        lots: [
          {
            id: 'lot-1',
            name: 'Kenya AA',
            foreignPricePerBag: 18.5,
            gramsPerBag: 250,
            quantity: 2,
            shares: [
              { id: 'share-1', personId: 'person-1', shareGrams: 250 },
              { id: 'share-2', personId: 'person-2', shareGrams: 250 },
            ],
          },
          {
            id: 'lot-2',
            name: 'Burundi',
            foreignPricePerBag: 22,
            gramsPerBag: 250,
            quantity: 1,
            shares: [
              { id: 'share-3', personId: 'person-1', shareGrams: 125 },
              { id: 'share-4', personId: 'person-2', shareGrams: 125 },
            ],
          },
        ],
      },
      {
        goodsTotalZar: 1650,
      },
      {
        fees: [
          { id: 'fee-1', label: 'Disbursement', amountZar: 120, allocationType: 'fixed_shared' },
          { id: 'fee-2', label: 'Customs', amountZar: 180, allocationType: 'value_based' },
        ],
      },
    ]);

    expect(finalOrder.lots).toHaveLength(2);
    expect(finalOrder.goodsTotalZar).toBe(1650);
    expect(finalOrder.fees).toHaveLength(2);

    const firstSummaryRead = calculate(finalOrder, personNames);
    const secondSummaryRead = calculate(finalOrder, personNames);

    expect(firstSummaryRead.isValid).toBe(true);
    expect(firstSummaryRead.totalGoodsZar).toBe(1650);
    expect(firstSummaryRead.totalFeesZar).toBe(300);
    expect(firstSummaryRead.personIds).toEqual(['person-1', 'person-2']);
    expect(secondSummaryRead.totalOrderZar).toBe(firstSummaryRead.totalOrderZar);
    expect(secondSummaryRead.personCalcs['person-1'].lotBreakdowns).toHaveLength(2);
  });

  describe('mergeConcurrentOrderUpdate', () => {
    it('returns remote order when neither localOrder nor baseSnapshot is provided', () => {
      const remote = { ...baseOrder, name: 'Remote Order', goodsTotalZar: 999 };
      expect(mergeConcurrentOrderUpdate(remote)).toEqual(remote);
    });

    it('merges remote fees while preserving local in-flight name edit', () => {
      const base = { ...baseOrder, name: 'Original Name', fees: [] };
      const local = { ...baseOrder, name: 'In-Flight Local Name', fees: [] };
      const remote = {
        ...baseOrder,
        name: 'Original Name',
        fees: [{ id: 'remote-fee-1', label: 'Customs', amountZar: 200, allocationType: 'equal_per_person' as const, personId: null }],
      };

      const result = mergeConcurrentOrderUpdate(remote, local, base);
      expect(result.name).toBe('In-Flight Local Name');
      expect(result.fees).toHaveLength(1);
      expect(result.fees[0].id).toBe('remote-fee-1');
    });

    it('merges remote goods total update while preserving local lot edits', () => {
      const base = { ...baseOrder, goodsTotalZar: 500, lots: [] };
      const local = {
        ...baseOrder,
        goodsTotalZar: 500,
        lots: [{
          id: 'local-lot-1',
          name: 'Geisha',
          foreignPricePerBag: 30,
          gramsPerBag: 250,
          quantity: 1,
          shares: [{ id: 's1', personId: 'person-1', shareGrams: 250 }],
        }],
      };
      const remote = { ...baseOrder, goodsTotalZar: 750, lots: [] };

      const result = mergeConcurrentOrderUpdate(remote, local, base);
      expect(result.goodsTotalZar).toBe(750);
      expect(result.lots).toHaveLength(1);
      expect(result.lots[0].name).toBe('Geisha');
    });

    it('preserves local optimistic snapshot modifications against concurrent remote updates', () => {
      const optimisticSnapshot = { ...baseOrder, name: 'Optimistic Edit' };
      const remote = {
        ...baseOrder,
        name: 'Original Name',
        fees: [{ id: 'fee-remote', label: 'Shipping', amountZar: 150, allocationType: 'equal_per_person' as const, personId: null }],
      };

      const result = mergeConcurrentOrderUpdate(remote, optimisticSnapshot, baseOrder);
      expect(result.name).toBe('Optimistic Edit');
      expect(result.fees).toHaveLength(1);
      expect(result.fees[0].id).toBe('fee-remote');

      const resultSingle = mergeConcurrentOrderUpdate(remote, null, optimisticSnapshot);
      expect(resultSingle.name).toBe('Optimistic Edit');
      expect(resultSingle.fees).toHaveLength(1);
    });
  });
});
