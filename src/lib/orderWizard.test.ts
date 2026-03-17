import { describe, expect, it } from 'vitest';
import type { Order } from '../types';
import {
  getInitialShareGramsForNewBuyer,
  getLotAssignmentMode,
  getSuggestedWizardStep,
  isStepComplete,
  validateCoffeeStep,
  validateGoodsStep,
  validateSetupStep,
} from './orderWizard';

const baseOrder: Order = {
  id: 'order-1',
  workspaceId: 'workspace-1',
  name: 'March Drop',
  orderDate: '2026-03-17',
  payerId: 'person-1',
  payerBank: { bankName: '', accountNumber: '', beneficiary: '' },
  referenceTemplate: 'FAJR-{ORDER}-{NAME}',
  goodsTotalZar: 1200,
  lots: [
    {
      id: 'lot-1',
      name: 'Kenya AA',
      foreignPricePerBag: 18.5,
      gramsPerBag: 250,
      quantity: 2,
      shares: [
        { id: 'share-1', personId: 'person-1', shareGrams: 300 },
        { id: 'share-2', personId: 'person-2', shareGrams: 200 },
      ],
    },
  ],
  fees: [
    {
      id: 'fee-1',
      label: 'Disbursement',
      amountZar: 120,
      allocationType: 'fixed_shared',
    },
  ],
  payments: {},
  isArchived: false,
  createdAt: '2026-03-17T00:00:00.000Z',
  updatedAt: '2026-03-17T00:00:00.000Z',
};

describe('orderWizard helpers', () => {
  it('requires only setup essentials in step 1', () => {
    const order: Order = { ...baseOrder, name: '', payerId: null };
    expect(validateSetupStep(order)).toEqual([
      'Order name is required.',
      'Payer is required.',
    ]);
  });

  it('marks a balanced multi-buyer lot as split', () => {
    expect(getLotAssignmentMode(baseOrder.lots[0])).toBe('split');
    expect(validateCoffeeStep(baseOrder)).toHaveLength(0);
    expect(isStepComplete(baseOrder, 'coffees')).toBe(true);
  });

  it('marks a single full-bag buyer as own bag', () => {
    const ownBagLot = {
      ...baseOrder.lots[0],
      quantity: 1,
      shares: [{ id: 'share-1', personId: 'person-1', shareGrams: 250 }],
    };
    expect(getLotAssignmentMode(ownBagLot)).toBe('own');
  });

  it('returns remaining grams for an inline buyer', () => {
    const lot = {
      ...baseOrder.lots[0],
      shares: [{ id: 'share-1', personId: 'person-1', shareGrams: 300 }],
    };
    expect(getInitialShareGramsForNewBuyer(lot)).toBe(200);
  });

  it('does not force a new buyer to become payer when setup is already valid', () => {
    const order: Order = {
      ...baseOrder,
      lots: [
        {
          ...baseOrder.lots[0],
          shares: [...baseOrder.lots[0].shares, { id: 'share-3', personId: 'person-3', shareGrams: 0 }],
        },
      ],
    };
    expect(order.payerId).toBe('person-1');
    expect(validateSetupStep(order)).toHaveLength(0);
  });

  it('rejects unsupported fee models', () => {
    const order: Order = {
      ...baseOrder,
      fees: [
        {
          id: 'fee-2',
          label: 'Legacy',
          amountZar: 45,
          allocationType: 'per_bag' as never,
        },
      ],
    };
    expect(validateGoodsStep(order)).toContain('"Legacy" has an unsupported fee type.');
  });

  it('suggests the first incomplete wizard step', () => {
    expect(getSuggestedWizardStep(baseOrder)).toBe('summary');
    expect(getSuggestedWizardStep({ ...baseOrder, goodsTotalZar: 0 })).toBe('goods');
    expect(getSuggestedWizardStep({ ...baseOrder, lots: [] })).toBe('coffees');
    expect(getSuggestedWizardStep({ ...baseOrder, payerId: null })).toBe('setup');
  });
});
