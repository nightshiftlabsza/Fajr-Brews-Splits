import { describe, expect, it } from 'vitest';
import type { BagAllocationDraft } from './orderWizard';
import type { Bag, CoffeeLot, Order } from '../types';
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
  // Bag-first API
  normalizeLotToBags,
  serializeLotFromBags,
  inferSplitMode,
  recalculateBagGrams,
  createUnassignedBag,
  createUnassignedBags,
  validateBags,
  getBagStatus,
  applyAllocationToBags,
  duplicateBag,
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

// ─── Bag-First Model Tests ─────────────────────────────────────

describe('inferSplitMode', () => {
  it('returns unassigned for empty buyers', () => {
    expect(inferSplitMode([], 250)).toBe('unassigned');
  });

  it('returns full for a single buyer with full grams', () => {
    expect(inferSplitMode([{ id: '1', personId: 'p1', grams: 250 }], 250)).toBe('full');
  });

  it('returns equal for two buyers with equal grams', () => {
    expect(inferSplitMode([
      { id: '1', personId: 'p1', grams: 125 },
      { id: '2', personId: 'p2', grams: 125 },
    ], 250)).toBe('equal');
  });

  it('returns equal for three buyers with remainder to last', () => {
    expect(inferSplitMode([
      { id: '1', personId: 'p1', grams: 83 },
      { id: '2', personId: 'p2', grams: 83 },
      { id: '3', personId: 'p3', grams: 84 },
    ], 250)).toBe('equal');
  });

  it('returns custom for unequal grams', () => {
    expect(inferSplitMode([
      { id: '1', personId: 'p1', grams: 50 },
      { id: '2', personId: 'p2', grams: 200 },
    ], 250)).toBe('custom');
  });
});

describe('recalculateBagGrams', () => {
  it('auto-fills full bag grams', () => {
    const bag: Bag = { id: '1', splitMode: 'full', buyers: [{ id: 'b1', personId: 'p1', grams: 0 }] };
    const result = recalculateBagGrams(bag, 250);
    expect(result.buyers[0].grams).toBe(250);
  });

  it('distributes equal grams with remainder to last', () => {
    const bag: Bag = {
      id: '1', splitMode: 'equal', buyers: [
        { id: 'b1', personId: 'p1', grams: 0 },
        { id: 'b2', personId: 'p2', grams: 0 },
        { id: 'b3', personId: 'p3', grams: 0 },
      ],
    };
    const result = recalculateBagGrams(bag, 250);
    expect(result.buyers.map((b) => b.grams)).toEqual([83, 83, 84]);
  });

  it('does not auto-calc custom bags', () => {
    const bag: Bag = {
      id: '1', splitMode: 'custom', buyers: [
        { id: 'b1', personId: 'p1', grams: 100 },
        { id: 'b2', personId: 'p2', grams: 100 },
      ],
    };
    const result = recalculateBagGrams(bag, 250);
    expect(result.buyers.map((b) => b.grams)).toEqual([100, 100]);
  });
});

describe('normalizeLotToBags', () => {
  it('returns lot.bags directly if present', () => {
    const bags: Bag[] = [
      { id: 'b1', splitMode: 'full', buyers: [{ id: 'x', personId: 'p1', grams: 250 }] },
    ];
    const lot: CoffeeLot = { ...makeLot(), bags };
    expect(normalizeLotToBags(lot)).toBe(bags);
  });

  it('normalizes legacy shares into bags', () => {
    const lot = makeLot();
    const bags = normalizeLotToBags(lot);
    expect(bags).toHaveLength(2);
    expect(bags[0].splitMode).toBe('full');
    expect(bags[0].buyers[0].personId).toBe('person-1');
    expect(bags[0].buyers[0].grams).toBe(250);
    expect(bags[1].splitMode).toBe('full');
    expect(bags[1].buyers[0].personId).toBe('person-2');
  });

  it('normalizes cross-boundary shares into mixed bags', () => {
    const lot = makeLot({
      shares: [
        { id: 's1', personId: 'person-1', shareGrams: 300 },
        { id: 's2', personId: 'person-2', shareGrams: 200 },
      ],
    });
    const bags = normalizeLotToBags(lot);
    expect(bags).toHaveLength(2);
    expect(bags[0].splitMode).toBe('full');
    expect(bags[1].splitMode).toBe('custom');
    expect(bags[1].buyers).toHaveLength(2);
  });
});

describe('serializeLotFromBags', () => {
  it('round-trips bags to all legacy fields', () => {
    const bags: Bag[] = [
      { id: 'b1', splitMode: 'full', buyers: [{ id: 'x', personId: 'p1', grams: 250 }] },
      { id: 'b2', splitMode: 'equal', buyers: [
        { id: 'y', personId: 'p1', grams: 125 },
        { id: 'z', personId: 'p2', grams: 125 },
      ]},
    ];
    const result = serializeLotFromBags(bags);
    expect(result.quantity).toBe(2);
    expect(result.bags).toBe(bags);
    expect(result.shares).toHaveLength(3);
    expect(result.bagAllocations).toHaveLength(2);
    expect(result.bagAllocations![0].mode).toBe('single');
    expect(result.bagAllocations![1].mode).toBe('split');
  });
});

describe('validateBags', () => {
  it('rejects unassigned bags', () => {
    const errors = validateBags([createUnassignedBag()], 250);
    expect(errors).toEqual(['Bag 1: buyer is required.']);
  });

  it('accepts a valid full bag', () => {
    const bags: Bag[] = [{ id: '1', splitMode: 'full', buyers: [{ id: 'b', personId: 'p1', grams: 250 }] }];
    expect(validateBags(bags, 250)).toEqual([]);
  });

  it('accepts a valid equal split', () => {
    const bags: Bag[] = [{
      id: '1', splitMode: 'equal', buyers: [
        { id: 'b1', personId: 'p1', grams: 125 },
        { id: 'b2', personId: 'p2', grams: 125 },
      ],
    }];
    expect(validateBags(bags, 250)).toEqual([]);
  });

  it('rejects a split bag with fewer than 2 buyers', () => {
    const bags: Bag[] = [{
      id: '1', splitMode: 'equal', buyers: [{ id: 'b1', personId: 'p1', grams: 250 }],
    }];
    expect(validateBags(bags, 250)).toContainEqual(expect.stringContaining('at least two buyers'));
  });

  it('rejects a custom split with wrong total', () => {
    const bags: Bag[] = [{
      id: '1', splitMode: 'custom', buyers: [
        { id: 'b1', personId: 'p1', grams: 100 },
        { id: 'b2', personId: 'p2', grams: 100 },
      ],
    }];
    expect(validateBags(bags, 250)).toContainEqual(expect.stringContaining('total exactly 250g'));
  });
});

describe('getBagStatus', () => {
  it('reports complete when all bags are valid', () => {
    const bags: Bag[] = [
      { id: '1', splitMode: 'full', buyers: [{ id: 'b', personId: 'p1', grams: 250 }] },
    ];
    expect(getBagStatus(bags, 250).tone).toBe('complete');
  });

  it('reports warning for unassigned bags', () => {
    const bags: Bag[] = [createUnassignedBag()];
    expect(getBagStatus(bags, 250).tone).toBe('warning');
  });
});

describe('bulk actions', () => {
  it('applies allocation to all unassigned bags', () => {
    const source: Bag = { id: 's', splitMode: 'full', buyers: [{ id: 'b', personId: 'p1', grams: 250 }] };
    const targets: Bag[] = [
      source,
      createUnassignedBag(),
      { id: 'assigned', splitMode: 'full', buyers: [{ id: 'b2', personId: 'p2', grams: 250 }] },
      createUnassignedBag(),
    ];
    const result = applyAllocationToBags(source, targets);
    expect(result[0]).toBe(source); // source unchanged
    expect(result[1].splitMode).toBe('full');
    expect(result[1].buyers[0].personId).toBe('p1');
    expect(result[2].buyers[0].personId).toBe('p2'); // assigned bag unchanged
    expect(result[3].splitMode).toBe('full');
    expect(result[3].buyers[0].personId).toBe('p1');
  });

  it('duplicates a bag with new IDs', () => {
    const source: Bag = { id: 's', splitMode: 'equal', buyers: [
      { id: 'b1', personId: 'p1', grams: 125 },
      { id: 'b2', personId: 'p2', grams: 125 },
    ]};
    const duped = duplicateBag(source);
    expect(duped.id).not.toBe(source.id);
    expect(duped.splitMode).toBe('equal');
    expect(duped.buyers).toHaveLength(2);
    expect(duped.buyers[0].personId).toBe('p1');
    expect(duped.buyers[0].id).not.toBe(source.buyers[0].id);
  });
});

describe('createUnassignedBags', () => {
  it('creates N unassigned bags with unique IDs', () => {
    const bags = createUnassignedBags(3);
    expect(bags).toHaveLength(3);
    expect(bags.every((b) => b.splitMode === 'unassigned')).toBe(true);
    expect(bags.every((b) => b.buyers.length === 0)).toBe(true);
    const ids = new Set(bags.map((b) => b.id));
    expect(ids.size).toBe(3);
  });
});
