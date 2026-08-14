/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockStoreState = {
  initialize: vi.fn().mockResolvedValue(undefined),
  isInitialized: true,
  isLoading: false,
  user: { id: 'user-1', email: 'owner@example.com' },
  accessStatus: 'member' as 'checking' | 'member' | 'participant' | 'none' | 'error',
  linkResolution: {
    status: 'idle' as const,
    linkedPersonId: null,
    matchedBy: null,
    person: null,
    candidates: [],
  },
  dismissLinkResolution: vi.fn(),
};

vi.mock('./store/appStore', () => ({
  useAppStore: Object.assign(
    () => mockStoreState,
    {
      getState: () => mockStoreState,
    },
  ),
}));

vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(() => ({
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
      })),
    },
  },
}));

vi.mock('./components/auth/AuthPage', () => ({
  AuthPage: () => <div>AuthPage</div>,
}));

vi.mock('./components/auth/PendingAccess', () => ({
  PendingAccess: () => <div>PendingAccess</div>,
}));

vi.mock('./components/layout/Header', () => ({
  Header: ({ onTabChange }: { onTabChange: (tab: string) => void }) => (
    <div>
      <button data-tab="order" onClick={() => onTabChange('order')}>Order</button>
      <button data-tab="people" onClick={() => onTabChange('people')}>People</button>
      <button data-tab="history" onClick={() => onTabChange('history')}>History</button>
      <button data-tab="my-stats" onClick={() => onTabChange('my-stats')}>My Stats</button>
    </div>
  ),
}));

vi.mock('./components/pages/OrderPage', () => ({
  OrderPage: () => <div>OrderPage</div>,
}));

vi.mock('./components/pages/PeoplePage', () => ({
  PeoplePage: () => <div>PeoplePage</div>,
}));

vi.mock('./components/pages/MyStatsPage', () => ({
  MyStatsPage: () => <div>MyStatsPage</div>,
}));

vi.mock('./components/pages/HistoryPage', () => ({
  HistoryPage: () => <div>HistoryPage</div>,
}));

vi.mock('./components/pages/ResetPasswordPage', () => ({
  ResetPasswordPage: () => <div>ResetPasswordPage</div>,
}));

vi.mock('./components/pages/SettingsPage', () => ({
  SettingsPage: () => <div>SettingsPage</div>,
}));

import App from './App';

describe('App loading shell', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );
    mockStoreState.initialize = vi.fn().mockResolvedValue(undefined);
    mockStoreState.isInitialized = true;
    mockStoreState.isLoading = false;
    mockStoreState.user = { id: 'user-1', email: 'owner@example.com' };
    mockStoreState.accessStatus = 'member';
    mockStoreState.linkResolution = {
      status: 'idle',
      linkedPersonId: null,
      matchedBy: null,
      person: null,
      candidates: [],
    };
    mockStoreState.dismissLinkResolution = vi.fn();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('keeps the app visible during background loading after initialization', async () => {
    mockStoreState.isLoading = true;

    await act(async () => {
      root.render(<App />);
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Order');
    expect(container.textContent).toContain('OrderPage');
    expect(container.textContent).toContain('MyStatsPage');
    expect(container.textContent).not.toContain('Fajr Brews');
  });

  it('still shows the startup splash before the app has initialized', async () => {
    mockStoreState.isInitialized = false;

    await act(async () => {
      root.render(<App />);
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Fajr Brews');
  });

  it('routes participant-only users to My Stats instead of the order workbench', async () => {
    mockStoreState.accessStatus = 'participant';

    await act(async () => {
      root.render(<App />);
      await Promise.resolve();
    });

    expect(container.textContent).toContain('MyStatsPage');
    expect(container.textContent).toContain('HistoryPage');
    expect(container.textContent).not.toContain('OrderPage');
  });

  it('keeps the main shell alive without showing startup splash when isInitialized is true', async () => {
    mockStoreState.isInitialized = true;
    mockStoreState.isLoading = false;

    await act(async () => {
      root.render(<App />);
      await Promise.resolve();
    });

    expect(container.querySelector('.spinner')).toBeNull();
    expect(container.textContent).toContain('OrderPage');
  });

  it('does NOT call initialize() when switching tabs 25 times and shows ZERO loading spinners', async () => {
    mockStoreState.isInitialized = true;
    mockStoreState.isLoading = false;

    await act(async () => {
      root.render(<App />);
      await Promise.resolve();
    });

    const initCallsAfterMount = mockStoreState.initialize.mock.calls.length;

    const toPeople = container.querySelector('button[data-tab="people"]');
    const toOrder = container.querySelector('button[data-tab="order"]');
    const toHistory = container.querySelector('button[data-tab="history"]');

    expect(toPeople).toBeTruthy();
    expect(toOrder).toBeTruthy();
    expect(toHistory).toBeTruthy();

    for (let i = 0; i < 25; i++) {
      await act(async () => {
        toPeople?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      expect(container.querySelector('.spinner')).toBeNull();

      await act(async () => {
        toOrder?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      expect(container.querySelector('.spinner')).toBeNull();

      await act(async () => {
        toHistory?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      expect(container.querySelector('.spinner')).toBeNull();
    }

    // initialize was NEVER called during tab transitions
    expect(mockStoreState.initialize.mock.calls.length).toBe(initCallsAfterMount);
  });
});
