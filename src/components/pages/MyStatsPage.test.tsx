/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Order, Person, PersonLinkResolution, Roaster } from '../../types';

const mockStoreState = {
  orders: [] as Order[],
  roasters: [] as Roaster[],
  people: [] as Person[],
  linkedPersonId: null as string | null,
  linkResolution: {
    status: 'idle',
    linkedPersonId: null,
    matchedBy: null,
    person: null,
    candidates: [],
  } as PersonLinkResolution,
};

vi.mock('../../store/appStore', () => ({
  useAppStore: () => mockStoreState,
}));

import { MyStatsPage } from './MyStatsPage';

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: overrides.id ?? 'order-1',
    workspaceId: 'workspace-1',
    name: overrides.name ?? 'Saved Order',
    orderDate: overrides.orderDate ?? '2026-03-18',
    roasterId: overrides.roasterId ?? 'roaster-1',
    roasterSnapshot: overrides.roasterSnapshot ?? { id: 'roaster-1', name: 'Father Coffee' },
    payerId: overrides.payerId ?? 'person-1',
    payerBank: overrides.payerBank ?? { bankName: '', accountNumber: '', beneficiary: '' },
    referenceTemplate: overrides.referenceTemplate ?? 'FAJR-{ORDER}-{NAME}',
    goodsTotalZar: overrides.goodsTotalZar ?? 400,
    lots: overrides.lots ?? [
      {
        id: 'lot-1',
        name: 'Kenya AA',
        foreignPricePerBag: 10,
        gramsPerBag: 250,
        quantity: 1,
        shares: [{ id: 'share-1', personId: 'person-1', shareGrams: 250, bagIndex: 0 }],
        bagAllocations: [
          {
            id: 'bag-1',
            bagIndex: 0,
            mode: 'single',
            participants: [{ id: 'participant-1', personId: 'person-1', shareGrams: 250, sourceShareId: 'share-1' }],
          },
        ],
      },
    ],
    fees: overrides.fees ?? [],
    payments: overrides.payments ?? {},
    isArchived: overrides.isArchived ?? true,
    createdAt: overrides.createdAt ?? '2026-03-18T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-03-18T00:00:00.000Z',
  };
}

describe('MyStatsPage', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    mockStoreState.people = [
      {
        id: 'person-1',
        workspaceId: 'workspace-1',
        name: 'Amina',
        createdAt: '2026-03-18T00:00:00.000Z',
        updatedAt: '2026-03-18T00:00:00.000Z',
      },
    ];
    mockStoreState.roasters = [
      {
        id: 'roaster-1',
        workspaceId: 'workspace-1',
        name: 'Father Coffee',
        createdAt: '2026-03-18T00:00:00.000Z',
        updatedAt: '2026-03-18T00:00:00.000Z',
      },
    ];
    mockStoreState.linkedPersonId = null;
    mockStoreState.linkResolution = {
      status: 'idle',
      linkedPersonId: null,
      matchedBy: null,
      person: null,
      candidates: [],
    };
    mockStoreState.orders = [];
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  it('shows the clean empty state when no linked participant is available', () => {
    act(() => {
      root.render(<MyStatsPage />);
    });

    expect(container.textContent).toContain('Link a participant to unlock My Stats');
  });

  it('shows personal metrics from finalized linked orders only', () => {
    mockStoreState.linkedPersonId = 'person-1';
    mockStoreState.linkResolution = {
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
    mockStoreState.orders = [
      makeOrder(),
      makeOrder({ id: 'order-2', isArchived: false }),
    ];

    act(() => {
      root.render(<MyStatsPage />);
    });

    expect(container.textContent).toContain('Total grams bought');
    expect(container.textContent).toContain('250g');
    expect(container.textContent).toContain('Father Coffee');
  });
});
