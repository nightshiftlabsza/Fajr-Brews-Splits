import { describe, expect, it, vi } from 'vitest';
import type { Order, PersonLinkResolution, Roaster } from '../types';
import {
  calculateMyStatsSummary,
  filterParticipantOrdersByRange,
  getParticipantFinalizedOrders,
  getParticipantScopedOrders,
  resolveLinkedStatsPerson,
  type StatsDateRange,
} from './myStats';

const linkResolution: PersonLinkResolution = {
  status: 'linked',
  linkedPersonId: 'person-1',
  matchedBy: 'manual',
  person: {
    personId: 'person-1',
    name: 'Amina',
    matchReason: 'email',
  },
  candidates: [],
};

const roasters: Roaster[] = [
  {
    id: 'roaster-1',
    workspaceId: 'workspace-1',
    name: 'Father Coffee',
    logoUrl: 'https://example.com/father.png',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'roaster-2',
    workspaceId: 'workspace-1',
    name: 'Rosetta',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
];

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: overrides.id ?? 'order-1',
    workspaceId: 'workspace-1',
    name: overrides.name ?? 'Saved Order',
    orderDate: overrides.orderDate ?? '2026-03-01',
    roasterId: overrides.roasterId ?? 'roaster-1',
    roasterSnapshot: overrides.roasterSnapshot ?? {
      id: 'roaster-1',
      name: 'Father Coffee',
      logoUrl: 'https://example.com/father.png',
    },
    payerId: overrides.payerId ?? 'person-1',
    payerBank: overrides.payerBank ?? { bankName: '', accountNumber: '', beneficiary: '' },
    referenceTemplate: overrides.referenceTemplate ?? 'FAJR-{ORDER}-{NAME}',
    goodsTotalZar: overrides.goodsTotalZar ?? 500,
    lots: overrides.lots ?? [
      {
        id: 'lot-1',
        name: 'Kenya AA',
        foreignPricePerBag: 15,
        gramsPerBag: 250,
        quantity: 2,
        shares: [
          { id: 'share-1', personId: 'person-1', shareGrams: 250, bagIndex: 0 },
          { id: 'share-2', personId: 'person-2', shareGrams: 250, bagIndex: 1 },
        ],
        bagAllocations: [
          {
            id: 'bag-0',
            bagIndex: 0,
            mode: 'single',
            participants: [
              { id: 'participant-1', personId: 'person-1', shareGrams: 250, sourceShareId: 'share-1' },
            ],
          },
          {
            id: 'bag-1',
            bagIndex: 1,
            mode: 'single',
            participants: [
              { id: 'participant-2', personId: 'person-2', shareGrams: 250, sourceShareId: 'share-2' },
            ],
          },
        ],
      },
    ],
    fees: overrides.fees ?? [
      { id: 'fee-1', label: 'Shipping', amountZar: 100, allocationType: 'fixed_shared' },
    ],
    payments: overrides.payments ?? {},
    isArchived: overrides.isArchived ?? true,
    createdAt: overrides.createdAt ?? '2026-03-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-03-01T00:00:00.000Z',
  };
}

describe('myStats helpers', () => {
  it('resolves linked participants without guessing ambiguous links', () => {
    expect(resolveLinkedStatsPerson('person-1', linkResolution)).toEqual({
      state: 'ready',
      personId: 'person-1',
    });

    expect(resolveLinkedStatsPerson(null, { ...linkResolution, status: 'ambiguous', linkedPersonId: null })).toEqual({
      state: 'ambiguous',
      personId: null,
    });
  });

  it('filters participant-scoped orders before showing personal history', () => {
    const included = makeOrder();
    const excluded = makeOrder({
      id: 'order-2',
      payerId: 'person-2',
      lots: [
        {
          id: 'lot-2',
          name: 'Burundi',
          foreignPricePerBag: 14,
          gramsPerBag: 250,
          quantity: 1,
          shares: [{ id: 'share-3', personId: 'person-2', shareGrams: 250, bagIndex: 0 }],
        },
      ],
    });

    expect(getParticipantScopedOrders([included, excluded], 'person-1')).toEqual([included]);
  });

  it('uses finalized valid orders only for stats metrics and avoids leaking other people totals', () => {
    const finalized = makeOrder();
    const active = makeOrder({ id: 'order-2', isArchived: false });
    const noRoaster = makeOrder({
      id: 'order-3',
      roasterId: null,
      roasterSnapshot: null,
      lots: [
        {
          id: 'lot-3',
          name: 'Ethiopia',
          foreignPricePerBag: 12,
          gramsPerBag: 250,
          quantity: 1,
          shares: [
            { id: 'share-4', personId: 'person-1', shareGrams: 125, bagIndex: 0 },
            { id: 'share-5', personId: 'person-2', shareGrams: 125, bagIndex: 0 },
          ],
          bagAllocations: [
            {
              id: 'bag-3',
              bagIndex: 0,
              mode: 'split',
              participants: [
                { id: 'participant-4', personId: 'person-1', shareGrams: 125, sourceShareId: 'share-4' },
                { id: 'participant-5', personId: 'person-2', shareGrams: 125, sourceShareId: 'share-5' },
              ],
            },
          ],
        },
      ],
    });

    const entries = getParticipantFinalizedOrders(
      [finalized, active, noRoaster],
      'person-1',
      { 'person-1': 'Amina', 'person-2': 'Bilal' },
      roasters,
    );
    const summary = calculateMyStatsSummary(entries);

    expect(entries).toHaveLength(2);
    expect(summary.totalGrams).toBe(375);
    expect(summary.totalBags).toBeCloseTo(1.5, 6);
    expect(summary.totalSpent).toBe(600);
    expect(summary.favoriteRoaster?.name).toBe('Father Coffee');
  });

  it('applies preset and custom ranges correctly', () => {
    const entries = getParticipantFinalizedOrders(
      [
        makeOrder({ id: 'order-1', orderDate: '2026-03-01' }),
        makeOrder({ id: 'order-2', orderDate: '2025-01-15', roasterId: 'roaster-2', roasterSnapshot: { id: 'roaster-2', name: 'Rosetta' } }),
      ],
      'person-1',
      { 'person-1': 'Amina', 'person-2': 'Bilal' },
      roasters,
    );

    const allRange: StatsDateRange = { preset: 'all' };
    const customRange: StatsDateRange = { preset: 'custom', startDate: '2026-02-01', endDate: '2026-03-31' };

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-30T12:00:00.000Z'));
    expect(filterParticipantOrdersByRange(entries, allRange)).toHaveLength(2);
    expect(filterParticipantOrdersByRange(entries, { preset: '12m' })).toHaveLength(1);
    expect(filterParticipantOrdersByRange(entries, customRange)).toHaveLength(1);
    vi.useRealTimers();
  });

  it('ranks favorite roasters by bag count, then recency, then name', () => {
    const entries = getParticipantFinalizedOrders(
      [
        makeOrder({ id: 'order-1', orderDate: '2026-03-01', roasterId: 'roaster-1', roasterSnapshot: { id: 'roaster-1', name: 'Father Coffee' } }),
        makeOrder({
          id: 'order-2',
          orderDate: '2026-03-10',
          roasterId: 'roaster-2',
          roasterSnapshot: { id: 'roaster-2', name: 'Rosetta' },
        }),
      ],
      'person-1',
      { 'person-1': 'Amina', 'person-2': 'Bilal' },
      roasters,
    );

    const summary = calculateMyStatsSummary(entries);
    expect(summary.favoriteRoaster?.name).toBe('Rosetta');
  });
});
