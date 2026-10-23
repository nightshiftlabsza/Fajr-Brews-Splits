/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PersonLinkResolution } from './types';

const mockStoreState = {
  initialize: vi.fn().mockResolvedValue(undefined),
  isInitialized: true,
  isLoading: false,
  user: { id: 'user-1', email: 'owner@example.com' } as { id: string; email?: string } | null,
  accessStatus: 'member' as 'checking' | 'member' | 'participant' | 'none' | 'error',
  linkResolution: {
    status: 'idle' as const,
    linkedPersonId: null,
    matchedBy: null,
    person: null,
    candidates: [],
  } as PersonLinkResolution,
  dismissLinkResolution: vi.fn(),
  confirmPersonLink: vi.fn().mockResolvedValue(null),
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
  AuthPage: ({ initialError }: { initialError?: string }) => (
    <div>
      AuthPage
      {initialError && <div data-testid="auth-error">{initialError}</div>}
    </div>
  ),
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

vi.mock('./components/auth/ResetPasswordPage', () => ({
  ResetPasswordPage: ({
    onComplete,
    onNavigateToSignIn,
  }: {
    onComplete: () => void;
    onNavigateToSignIn?: () => void;
  }) => (
    <div>
      <div>ResetPasswordPage</div>
      <button data-testid="reset-complete" onClick={onComplete}>Complete</button>
      <button data-testid="reset-back-to-signin" onClick={onNavigateToSignIn}>Back to sign in</button>
    </div>
  ),
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
    mockStoreState.confirmPersonLink = vi.fn().mockResolvedValue(null);
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

  it('BUG-AUTH-01: renders loading splash when isInitialized is true but auth session resolution is in progress (accessStatus checking)', async () => {
    mockStoreState.isInitialized = true;
    mockStoreState.accessStatus = 'checking';
    mockStoreState.user = null;

    await act(async () => {
      root.render(<App />);
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Fajr Brews');
    expect(container.querySelector('.spinner')).not.toBeNull();
    expect(container.textContent).not.toContain('AuthPage');
  });

  it('BUG-AUTH-02: redirects authenticated user away from reset-password path to home', async () => {
    window.history.pushState({}, 'Reset Password', '/reset-password');

    mockStoreState.isInitialized = true;
    mockStoreState.accessStatus = 'member';
    mockStoreState.user = { id: 'user-1', email: 'owner@example.com' };

    await act(async () => {
      root.render(<App />);
      await Promise.resolve();
    });

    expect(window.location.pathname).toBe('/');
    expect(container.textContent).toContain('OrderPage');
    expect(container.textContent).not.toContain('ResetPasswordPage');
  });

  it('BUG-AUTH-03: extracts otp_expired from URL hash and displays error on AuthPage', async () => {
    window.location.hash = '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired';

    mockStoreState.isInitialized = true;
    mockStoreState.accessStatus = 'none';
    mockStoreState.user = null;

    await act(async () => {
      root.render(<App />);
      await Promise.resolve();
    });

    expect(container.textContent).toContain('This password reset link has expired');
  });

  it('BUG-AUTH-04: surfaces confirmation banner for workspace members with ambiguous/needs-confirmation links', async () => {
    mockStoreState.isInitialized = true;
    mockStoreState.accessStatus = 'member';
    mockStoreState.user = { id: 'user-1', email: 'zaid@example.com' };
    mockStoreState.linkResolution = {
      status: 'needs-confirmation',
      linkedPersonId: null,
      matchedBy: 'name',
      person: {
        personId: 'person-zaid',
        name: 'Zaid',
        email: 'zaid@example.com',
        matchReason: 'name',
      },
      candidates: [
        {
          personId: 'person-zaid',
          name: 'Zaid',
          email: 'zaid@example.com',
          matchReason: 'name',
        },
      ],
    };

    await act(async () => {
      root.render(<App />);
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Confirm your participant profile');
    const linkButton = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Link as Zaid'));
    expect(linkButton).toBeTruthy();

    await act(async () => {
      linkButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(mockStoreState.confirmPersonLink).toHaveBeenCalledWith('person-zaid');
  });

  it('BUG-AUTH-02: resets authMode and navigates to sign-in form when ResetPasswordPage triggers onNavigateToSignIn', async () => {
    window.location.hash = '#type=recovery';
    mockStoreState.isInitialized = true;
    mockStoreState.accessStatus = 'none';
    mockStoreState.user = null;

    await act(async () => {
      root.render(<App />);
      await Promise.resolve();
    });

    expect(container.textContent).toContain('ResetPasswordPage');

    const backButton = container.querySelector('[data-testid="reset-back-to-signin"]');
    expect(backButton).toBeTruthy();

    await act(async () => {
      backButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(container.textContent).toContain('AuthPage');
    expect(container.textContent).not.toContain('ResetPasswordPage');
    expect(window.location.pathname).toBe('/');
  });

  it('does not cause React update while rendering warning when signed-in user lands on /reset-password', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    window.history.pushState({}, 'Reset Password', '/reset-password');
    mockStoreState.isInitialized = true;
    mockStoreState.accessStatus = 'member';
    mockStoreState.user = { id: 'u1', email: 'test@example.com' };

    await act(async () => {
      root.render(<App />);
      await Promise.resolve();
    });

    const updateDuringRenderWarnings = [...errorSpy.mock.calls, ...warnSpy.mock.calls].filter((call) =>
      call.some((arg) => typeof arg === 'string' && (arg.includes('Cannot update a component') || arg.includes('update while rendering')))
    );
    expect(updateDuringRenderWarnings).toHaveLength(0);
    expect(container.textContent).not.toContain('ResetPasswordPage');

    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('renders inline error notice when confirmPersonLink fails', async () => {
    mockStoreState.isInitialized = true;
    mockStoreState.accessStatus = 'member';
    mockStoreState.user = { id: 'u1', email: 'test@example.com' };
    mockStoreState.confirmPersonLink = vi.fn().mockResolvedValue('Database linking failed');
    mockStoreState.linkResolution = {
      status: 'needs-confirmation',
      linkedPersonId: null,
      matchedBy: 'name',
      person: {
        personId: 'person-zaid',
        name: 'Zaid',
        email: 'zaid@example.com',
        matchReason: 'name',
      },
      candidates: [
        {
          personId: 'person-zaid',
          name: 'Zaid',
          email: 'zaid@example.com',
          matchReason: 'name',
        },
      ],
    };

    await act(async () => {
      root.render(<App />);
      await Promise.resolve();
    });

    const linkButton = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Link as Zaid'));
    expect(linkButton).toBeTruthy();

    await act(async () => {
      linkButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Database linking failed');
    expect(container.querySelector('.alert.alert-error')).toBeTruthy();
  });
});
