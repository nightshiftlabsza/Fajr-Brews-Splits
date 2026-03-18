import { describe, expect, it } from 'vitest';
import type { BagAllocationDraft } from './orderWizard';
import type { CoffeeLot, Order } from '../types';
import {
  collapseBagDraftsToShares,
  expandLotToBagDrafts,
  getInitialShareGramsForNewBuyer,
  getLotAssignmentMode,
  getLotBagStatus,
  getSuggestedWizardStep,
  isStepComplete,
  serializeBagDrafts,
  validateBagDrafts,
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

function makeLot(overrides: Partial<CoffeeLot> = {}): CoffeeLot {
  return {
    id: 'lot-1',
    name: 'Kenya AA',
    foreignPricePerBag: 18.5,
    gramsPerBag: 250,
    quantity: 2,
    shares: [
      { id: 'share-1', personId: 'person-1', shareGrams: 250 },
      { id: 'share-2', personId: 'person-2', shareGrams: 250 },
    ],
    ...overrides,
  };
}

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

  it('treats multiple full bags assigned to different people as own bags, not split', () => {
    expect(getLotAssignmentMode(makeLot())).toBe('own');
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

describe('bag-draft serialization helpers', () => {
  it('round-trips two full bags with one buyer per bag', () => {
    const lot = makeLot();
    const bags = expandLotToBagDrafts(lot);

    expect(bags).toHaveLength(2);
    expect(bags[0].mode).toBe('single');
    expect(bags[0].participants[0]).toMatchObject({ personId: 'person-1', shareGrams: 250 });
    expect(bags[1].mode).toBe('single');
    expect(bags[1].participants[0]).toMatchObject({ personId: 'person-2', shareGrams: 250 });

    expect(collapseBagDraftsToShares(bags)).toEqual([
      { id: 'share-1', personId: 'person-1', shareGrams: 250, bagIndex: 0 },
      { id: 'share-2', personId: 'person-2', shareGrams: 250, bagIndex: 1 },
    ]);
  });

  it('round-trips one full bag plus one split bag', () => {
    const lot = makeLot({
      shares: [
        { id: 'share-1', personId: 'person-1', shareGrams: 250 },
        { id: 'share-2', personId: 'person-2', shareGrams: 125 },
        { id: 'share-3', personId: 'person-3', shareGrams: 125 },
      ],
    });

    const bags = expandLotToBagDrafts(lot);

    expect(bags[0].mode).toBe('single');
    expect(bags[1].mode).toBe('split');
    expect(bags[1].participants.map((participant) => participant.personId)).toEqual(['person-2', 'person-3']);
    expect(bags[1].participants.map((participant) => participant.shareGrams)).toEqual([125, 125]);

    expect(collapseBagDraftsToShares(bags)).toEqual([
      { id: 'share-1', personId: 'person-1', shareGrams: 250, bagIndex: 0 },
      { id: 'share-2', personId: 'person-2', shareGrams: 125, bagIndex: 1 },
      { id: 'share-3', personId: 'person-3', shareGrams: 125, bagIndex: 1 },
    ]);
  });

  it('round-trips arbitrary serialized shares across bag boundaries', () => {
    const lot = makeLot({
      shares: [
        { id: 'share-1', personId: 'person-1', shareGrams: 300 },
        { id: 'share-2', personId: 'person-2', shareGrams: 200 },
      ],
    });

    const bags = expandLotToBagDrafts(lot);

    expect(bags[0].mode).toBe('single');
    expect(bags[0].participants[0]).toMatchObject({ personId: 'person-1', shareGrams: 250 });
    expect(bags[1].mode).toBe('split');
    expect(bags[1].participants.map((participant) => participant.personId)).toEqual(['person-1', 'person-2']);
    expect(bags[1].participants.map((participant) => participant.shareGrams)).toEqual([50, 200]);

    expect(collapseBagDraftsToShares(bags)).toEqual([
      { id: 'share-1', personId: 'person-1', shareGrams: 250, bagIndex: 0 },
      { id: 'share-1', personId: 'person-1', shareGrams: 50, bagIndex: 1 },
      { id: 'share-2', personId: 'person-2', shareGrams: 200, bagIndex: 1 },
    ]);
  });

  it('preserves repeated split patterns through share serialization', () => {
    const bags: BagAllocationDraft[] = [
      {
        id: 'bag-0',
        bagIndex: 0,
        mode: 'split',
        participants: [
          { id: 'bp-1', personId: 'person-1', shareGrams: 125, sourceShareId: 'share-1' },
          { id: 'bp-2', personId: 'person-2', shareGrams: 125, sourceShareId: 'share-2' },
        ],
      },
      {
        id: 'bag-1',
        bagIndex: 1,
        mode: 'split',
        participants: [
          { id: 'bp-3', personId: 'person-1', shareGrams: 125, sourceShareId: 'share-1' },
          { id: 'bp-4', personId: 'person-2', shareGrams: 125, sourceShareId: 'share-2' },
        ],
      },
    ];

    const shares = collapseBagDraftsToShares(bags);
    expect(shares).toEqual([
      { id: 'share-1', personId: 'person-1', shareGrams: 125, bagIndex: 0 },
      { id: 'share-2', personId: 'person-2', shareGrams: 125, bagIndex: 0 },
      { id: 'share-1', personId: 'person-1', shareGrams: 125, bagIndex: 1 },
      { id: 'share-2', personId: 'person-2', shareGrams: 125, bagIndex: 1 },
    ]);

    const serialized = serializeBagDrafts(bags);
    const reexpanded = expandLotToBagDrafts(makeLot({ shares: serialized.shares, bagAllocations: serialized.bagAllocations }));
    expect(reexpanded.map((bag) => bag.mode)).toEqual(['split', 'split']);
    expect(reexpanded[0].participants.map((participant) => participant.personId)).toEqual(['person-1', 'person-2']);
    expect(reexpanded[1].participants.map((participant) => participant.personId)).toEqual(['person-1', 'person-2']);
  });

  it('preserves assigned bags and appends empty bags when quantity increases', () => {
    const lot = makeLot({
      quantity: 3,
    });

    const bags = expandLotToBagDrafts(lot);
    expect(bags).toHaveLength(3);
    expect(bags[0].participants[0].personId).toBe('person-1');
    expect(bags[1].participants[0].personId).toBe('person-2');
    expect(bags[2].participants).toEqual([]);

    const status = getLotBagStatus(bags, 250);
    expect(status.label).toBe('1 bag still needs a buyer');
  });

  it('preserves split mode through serialization even before a second buyer is added', () => {
    const serialized = serializeBagDrafts([
      {
        id: 'bag-0',
        bagIndex: 0,
        mode: 'split',
        participants: [{ id: 'bp-1', personId: 'person-1', shareGrams: 250, sourceShareId: 'share-1' }],
      },
    ]);

    const reexpanded = expandLotToBagDrafts(makeLot({
      quantity: 1,
      shares: serialized.shares,
      bagAllocations: serialized.bagAllocations,
    }));

    expect(reexpanded[0].mode).toBe('split');
    expect(reexpanded[0].participants).toHaveLength(1);
    expect(reexpanded[0].participants[0].personId).toBe('person-1');
  });
});

describe('bag-draft validation', () => {
  it('rejects an unassigned single-owner bag', () => {
    const bags: BagAllocationDraft[] = [
      { id: 'bag-0', bagIndex: 0, mode: 'single', participants: [] },
    ];

    expect(validateBagDrafts(bags, 250)).toEqual([
      'Bag 1: buyer is required.',
    ]);
  });

  it('rejects an under-assigned split bag', () => {
    const bags: BagAllocationDraft[] = [
      {
        id: 'bag-0',
        bagIndex: 0,
        mode: 'split',
        participants: [
          { id: 'bp-1', personId: 'person-1', shareGrams: 100, sourceShareId: 'share-1' },
          { id: 'bp-2', personId: 'person-2', shareGrams: 100, sourceShareId: 'share-2' },
        ],
      },
    ];

    expect(validateBagDrafts(bags, 250)).toEqual([
      'Bag 1: shared bag grams must total exactly 250g.',
    ]);
  });

  it('rejects an over-assigned split bag', () => {
    const bags: BagAllocationDraft[] = [
      {
        id: 'bag-0',
        bagIndex: 0,
        mode: 'split',
        participants: [
          { id: 'bp-1', personId: 'person-1', shareGrams: 150, sourceShareId: 'share-1' },
          { id: 'bp-2', personId: 'person-2', shareGrams: 150, sourceShareId: 'share-2' },
        ],
      },
    ];

    expect(validateBagDrafts(bags, 250)).toEqual([
      'Bag 1: shared bag grams must total exactly 250g.',
    ]);
  });

  it('rejects a split bag that still has only one buyer', () => {
    const bags: BagAllocationDraft[] = [
      {
        id: 'bag-0',
        bagIndex: 0,
        mode: 'split',
        participants: [
          { id: 'bp-1', personId: 'person-1', shareGrams: 250, sourceShareId: 'share-1' },
        ],
      },
    ];

    expect(validateBagDrafts(bags, 250)).toEqual([
      'Bag 1: shared bags need at least two buyers.',
    ]);
  });

  it('passes a fully assigned bag set and keeps coffee-step validation green after serialization', () => {
    const bags: BagAllocationDraft[] = [
      {
        id: 'bag-0',
        bagIndex: 0,
        mode: 'single',
        participants: [{ id: 'bp-1', personId: 'person-1', shareGrams: 250, sourceShareId: 'share-1' }],
      },
      {
        id: 'bag-1',
        bagIndex: 1,
        mode: 'split',
        participants: [
          { id: 'bp-2', personId: 'person-2', shareGrams: 125, sourceShareId: 'share-2' },
          { id: 'bp-3', personId: 'person-3', shareGrams: 125, sourceShareId: 'share-3' },
        ],
      },
    ];

    expect(validateBagDrafts(bags, 250)).toEqual([]);

    const order: Order = {
      ...baseOrder,
      lots: [
        makeLot({
          shares: collapseBagDraftsToShares(bags),
        }),
      ],
    };
    expect(validateCoffeeStep(order)).toEqual([]);
    expect(isStepComplete(order, 'coffees')).toBe(true);
  });
});
