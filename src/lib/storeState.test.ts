import { describe, expect, it } from 'vitest';
import type { Order, Person } from '../types';
import { calculate } from './calculations';
import { applyOrderPatches, upsertPersonById } from './storeState';

function makePerson(id: string, name: string): Person {
  return {
    id,
    workspaceId: 'workspace-1',
    name,
    createdAt: '2026-03-18T00:00:00.000Z',
    updatedAt: '2026-03-18T00:00:00.000Z',
  };
}

const baseOrder: Order = {
  id: 'order-1',
  workspaceId: 'workspace-1',
  name: 'Fresh Order',
  orderDate: '2026-03-18',
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
});
