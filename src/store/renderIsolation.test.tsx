/** @vitest-environment jsdom */

import { act, Profiler } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Order, Person } from '../types';

vi.mock('../lib/supabase', () => ({
  WORKSPACE_ID: 'workspace-1',
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn(),
    }),
    removeChannel: vi.fn(),
  },
}));

import { useAppStore } from './appStore';
import { OrderPage } from '../components/pages/OrderPage';
import { PeoplePage } from '../components/pages/PeoplePage';
import { MyStatsPage } from '../components/pages/MyStatsPage';
import { HistoryPage } from '../components/pages/HistoryPage';

describe('render isolation across store updates', () => {
  let container: HTMLDivElement;
  let root: Root;

  const renderCounts: Record<string, number> = {
    OrderPage: 0,
    PeoplePage: 0,
    MyStatsPage: 0,
    HistoryPage: 0,
  };

  const renderDurations: Record<string, number> = {
    OrderPage: 0,
    PeoplePage: 0,
    MyStatsPage: 0,
    HistoryPage: 0,
  };

  const initialPeople: Person[] = [
    {
      id: 'person-1',
      workspaceId: 'workspace-1',
      name: 'Alice',
      createdAt: '2026-03-18T00:00:00.000Z',
      updatedAt: '2026-03-18T00:00:00.000Z',
    },
    {
      id: 'person-2',
      workspaceId: 'workspace-1',
      name: 'Bob',
      createdAt: '2026-03-18T00:00:00.000Z',
      updatedAt: '2026-03-18T00:00:00.000Z',
    },
  ];

  const initialOrders: Order[] = [
    {
      id: 'order-1',
      workspaceId: 'workspace-1',
      name: 'March Drop',
      orderDate: '2026-03-18',
      roasterId: null,
      roasterSnapshot: null,
      status: 'planning',
      isArchived: false,
      payerId: 'person-1',
      payerBank: { bankName: '', accountNumber: '', beneficiary: '' },
      referenceTemplate: 'FAJR-{ORDER}-{NAME}',
      goodsTotalZar: 240,
      lots: [
        {
          id: 'lot-1',
          name: 'Pastel Hour',
          foreignPricePerBag: 20,
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
      fees: [],
      payments: {},
      ownerId: 'user-1',
      createdAt: '2026-03-18T00:00:00.000Z',
      updatedAt: '2026-03-18T00:00:00.000Z',
    },
  ];

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    renderCounts.OrderPage = 0;
    renderCounts.PeoplePage = 0;
    renderCounts.MyStatsPage = 0;
    renderCounts.HistoryPage = 0;

    renderDurations.OrderPage = 0;
    renderDurations.PeoplePage = 0;
    renderDurations.MyStatsPage = 0;
    renderDurations.HistoryPage = 0;

    useAppStore.setState({
      user: { id: 'user-1', email: 'owner@example.com', fullName: 'Owner User' },
      memberRole: 'owner',
      accessStatus: 'member',
      people: initialPeople,
      orders: initialOrders,
      currentOrderId: 'order-1',
      roasters: [],
      roasterFeatureStatus: 'ready',
      isInitialized: true,
      isLoading: false,
      isSyncing: false,
      error: null,
      linkedPersonId: 'person-1',
      linkResolution: { status: 'none', linkedPersonId: null, matchedBy: null, person: null, candidates: [] },
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  function onRender(id: string, phase: string, actualDuration: number) {
    if (phase === 'update') {
      renderCounts[id] = (renderCounts[id] || 0) + 1;
      renderDurations[id] = (renderDurations[id] || 0) + actualDuration;
    }
  }

  it('does not re-render pages on unrelated isSyncing and error updates, but re-renders PeoplePage on people update', () => {
    act(() => {
      root.render(
        <div>
          <Profiler id="OrderPage" onRender={onRender}>
            <OrderPage onNavigateToHistory={() => {}} />
          </Profiler>
          <Profiler id="PeoplePage" onRender={onRender}>
            <PeoplePage />
          </Profiler>
          <Profiler id="MyStatsPage" onRender={onRender}>
            <MyStatsPage />
          </Profiler>
          <Profiler id="HistoryPage" onRender={onRender}>
            <HistoryPage />
          </Profiler>
        </div>
      );
    });

    // Reset counts after initial mount
    renderCounts.OrderPage = 0;
    renderCounts.PeoplePage = 0;
    renderCounts.MyStatsPage = 0;
    renderCounts.HistoryPage = 0;

    renderDurations.OrderPage = 0;
    renderDurations.PeoplePage = 0;
    renderDurations.MyStatsPage = 0;
    renderDurations.HistoryPage = 0;

    // Trigger unrelated updates: isSyncing toggle and error change
    act(() => {
      useAppStore.setState({ isSyncing: true });
    });
    act(() => {
      useAppStore.setState({ error: 'x' });
    });

    console.log('Profiler numbers after unrelated updates (isSyncing, error):', {
      counts: { ...renderCounts },
      durations: { ...renderDurations },
    });

    // Assert zero re-renders on unrelated updates
    expect(renderCounts.OrderPage).toBe(0);
    expect(renderCounts.PeoplePage).toBe(0);
    expect(renderCounts.MyStatsPage).toBe(0);
    expect(renderCounts.HistoryPage).toBe(0);

    // Now change one person's name
    const peopleUpdateStartCount = renderCounts.PeoplePage;
    act(() => {
      useAppStore.setState({
        people: [
          { ...initialPeople[0], name: 'Alice Renamed' },
          initialPeople[1],
        ],
      });
    });

    // Proves selectors still update
    expect(renderCounts.PeoplePage).toBeGreaterThan(peopleUpdateStartCount);
  });
});
