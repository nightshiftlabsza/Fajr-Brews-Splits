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
  isLoading: false,
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
    roasterId: 'roasterId' in overrides ? overrides.roasterId! : 'roaster-1',
    roasterSnapshot: 'roasterSnapshot' in overrides ? overrides.roasterSnapshot! : {
      id: 'roaster-1',
      name: 'Father Coffee',
      logoUrl: 'https://example.com/father.png',
    },
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
        bags: [
          {
            id: 'bag-1',
            splitMode: 'full',
            buyers: [{ id: 'buyer-1', personId: 'person-1', grams: 250 }],
          },
        ],
      },
    ],
    fees: overrides.fees ?? [],
    payments: overrides.payments ?? {},
    status: overrides.status ?? 'completed',
    isArchived: overrides.isArchived ?? true,
    createdAt: overrides.createdAt ?? '2026-03-18T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-03-18T00:00:00.000Z',
  };
}

describe('MyStatsPage Redesign (Lane W & Lane P)', () => {
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
        logoUrl: 'https://example.com/father.png',
        createdAt: '2026-03-18T00:00:00.000Z',
        updatedAt: '2026-03-18T00:00:00.000Z',
      },
      {
        id: 'roaster-2',
        workspaceId: 'workspace-1',
        name: 'Rosetta',
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
    mockStoreState.isLoading = false;
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  it('renders unlinked participant state cleanly without jargon', () => {
    act(() => {
      root.render(<MyStatsPage />);
    });

    expect(container.textContent).toContain('Link a profile to view your stats');
    expect(container.textContent).not.toMatch(/finalized|ZAR share|250g eq/);
  });

  it('renders ambiguous participant state asking for confirmation', () => {
    mockStoreState.linkResolution = {
      status: 'ambiguous',
      linkedPersonId: null,
      matchedBy: null,
      person: null,
      candidates: [],
    };

    act(() => {
      root.render(<MyStatsPage />);
    });

    expect(container.textContent).toContain('We still need to confirm your profile');
  });

  it('renders empty orders state with a friendly link to start an order', () => {
    mockStoreState.linkedPersonId = 'person-1';
    mockStoreState.orders = [];

    act(() => {
      root.render(<MyStatsPage />);
    });

    expect(container.textContent).toContain('No orders you were part of yet');
    expect(container.textContent).toContain('Start an order →');
  });

  it('renders full calm coffee overview matching Stitch designs with correct numbers', () => {
    mockStoreState.linkedPersonId = 'person-1';
    mockStoreState.orders = [
      makeOrder({
        id: 'order-1',
        name: 'Autumn Restock',
        orderDate: '2026-03-18',
        lots: [
          {
            id: 'l1',
            name: 'Kenya Nyeri AA',
            foreignPricePerBag: 20,
            gramsPerBag: 250,
            quantity: 1,
            shares: [{ id: 's1', personId: 'person-1', shareGrams: 250, bagIndex: 0 }],
            bags: [{ id: 'b1', splitMode: 'full', buyers: [{ id: 'buy1', personId: 'person-1', grams: 250 }] }],
          },
        ],
      }),
      makeOrder({
        id: 'order-2',
        name: 'Spring Drop',
        orderDate: '2026-05-10',
        lots: [
          {
            id: 'l2',
            name: 'Ethiopia Guji',
            foreignPricePerBag: 25,
            gramsPerBag: 500,
            quantity: 1,
            shares: [{ id: 's2', personId: 'person-1', shareGrams: 500, bagIndex: 0 }],
            bags: [{ id: 'b2', splitMode: 'full', buyers: [{ id: 'buy2', personId: 'person-1', grams: 500 }] }],
          },
        ],
      }),
    ];

    act(() => {
      root.render(<MyStatsPage />);
    });

    // Heading
    expect(container.textContent).toContain('Your coffee');
    expect(container.textContent).toContain('From orders you were part of, once they are done.');

    // 3 Headline Facts: 750g = 0.75kg, 2 bags shared in, 1 roaster tried
    expect(container.textContent).toContain('0.75');
    expect(container.textContent).toContain('Coffee taken');
    expect(container.textContent).toContain('Bags you shared in');
    expect(container.textContent).toContain('Roasters tried');

    // Favourite Roaster
    expect(container.textContent).toContain('Father Coffee');
    expect(container.textContent).toContain('100% of the coffee you took · 2 orders');

    // Recent orders list with quiet your share
    expect(container.textContent).toContain('Kenya Nyeri AA');
    expect(container.textContent).toContain('Ethiopia Guji');
    expect(container.textContent).toContain('Your share:');

    // Banner to Year in Coffee
    expect(container.textContent).toContain('Your Year in Coffee');
    expect(container.textContent).toContain('A look back at your year');
  });

  it('switches to Year in Coffee view when recap banner is clicked and back to overview', () => {
    mockStoreState.linkedPersonId = 'person-1';
    mockStoreState.orders = [
      makeOrder({ id: 'o-1', orderDate: '2026-02-10' }),
      makeOrder({ id: 'o-2', orderDate: '2026-04-12' }),
      makeOrder({ id: 'o-3', orderDate: '2026-06-15' }),
      makeOrder({ id: 'o-4', orderDate: '2026-08-20' }),
    ];

    act(() => {
      root.render(<MyStatsPage />);
    });

    const banner = container.querySelector('.stats-recap-banner') as HTMLButtonElement;
    expect(banner).toBeTruthy();

    act(() => {
      banner.click();
    });

    // Now in Year in Coffee recap view
    expect(container.textContent).toContain('What you took from the orders this year.');
    expect(container.textContent).toContain('01 · Your year');
    expect(container.textContent).toContain('Back to your coffee');

    // Click back to return
    const backBtn = container.querySelector('button.btn-secondary') as HTMLButtonElement;
    act(() => {
      backBtn.click();
    });

    expect(container.textContent).toContain('From orders you were part of, once they are done.');
  });

  it('no banned words are rendered in MyStatsPage', () => {
    mockStoreState.linkedPersonId = 'person-1';
    mockStoreState.orders = [makeOrder()];

    act(() => {
      root.render(<MyStatsPage />);
    });

    const text = container.textContent || '';
    expect(text).not.toMatch(/\b(finalized|250g eq|participated|settled by the organiser|allocated)\b/i);
    expect(text).not.toContain('ZAR share');
  });

  it('all interactive controls have accessible names', () => {
    mockStoreState.linkedPersonId = 'person-1';
    mockStoreState.orders = [makeOrder()];

    act(() => {
      root.render(<MyStatsPage />);
    });

    const buttons = container.querySelectorAll('button');
    buttons.forEach((btn) => {
      const hasName = Boolean(btn.textContent?.trim() || btn.getAttribute('aria-label') || btn.getAttribute('title'));
      expect(hasName).toBe(true);
    });
  });
});
