import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from './store/appStore';
import type { ThemeMode } from './types';
import { AuthPage } from './components/auth/AuthPage';
import { PendingAccess } from './components/auth/PendingAccess';
import { Header } from './components/layout/Header';
import { OrderPage } from './components/pages/OrderPage';
import { PeoplePage } from './components/pages/PeoplePage';
import { MyStatsPage } from './components/pages/MyStatsPage';
import { HistoryPage } from './components/pages/HistoryPage';
import { ResetPasswordPage } from './components/auth/ResetPasswordPage';
import { SettingsPage } from './components/pages/SettingsPage';
import { SplitsLockup } from './components/brand/SplitsLockup';
import type { AppTab } from './types';
import { HOME_PATH, RESET_PASSWORD_PATH } from './lib/appConfig';
import { supabase } from './lib/supabase';

import './styles/globals.css';
import './styles/print.css';

function isRecoveryHash(hash: string): boolean {
  return hash.includes('type=recovery');
}

export function parseAuthHashError(hash: string): string | null {
  if (!hash || !hash.includes('error=')) {
    return null;
  }
  const cleanHash = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(cleanHash);
  const errorCode = params.get('error_code');
  const errorDescription = params.get('error_description');

  if (errorCode === 'otp_expired') {
    return 'This password reset link has expired. Please request a new reset link.';
  }
  if (errorDescription) {
    return errorDescription.replace(/\+/g, ' ');
  }
  if (params.get('error')) {
    return 'Authentication error from link. Please try signing in again.';
  }
  return null;
}

function getCurrentPath(): string {
  if (typeof window === 'undefined') {
    return HOME_PATH;
  }

  return window.location.pathname || HOME_PATH;
}

export function updatePath(
  path: string,
  options: { replace?: boolean; preserveSearch?: boolean; preserveHash?: boolean } = {},
): void {
  if (typeof window === 'undefined') {
    return;
  }

  const { replace = false, preserveSearch = false, preserveHash = false } = options;
  const nextUrl = `${path}${preserveSearch ? window.location.search : ''}${preserveHash ? window.location.hash : ''}`;

  if (replace) {
    window.history.replaceState({}, document.title, nextUrl);
  } else {
    window.history.pushState({}, document.title, nextUrl);
  }

  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function getAuthReinitializeOptions(isInitialized: boolean): { silent?: boolean } {
  return isInitialized ? { silent: true } : {};
}

export function formatSnapshotSavedAt(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return isoString;
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / (60 * 1000));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 30) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  } catch {
    return isoString;
  }
}

export default function App() {
  const {
    initialize,
    isInitialized,
    isSyncing,
    error,
    snapshotSavedAt,
    user,
    accessStatus,
    linkResolution,
    dismissLinkResolution,
    confirmPersonLink,
  } = useAppStore(
    useShallow((s) => ({
      initialize: s.initialize,
      isInitialized: s.isInitialized,
      isSyncing: s.isSyncing,
      error: s.error,
      snapshotSavedAt: s.snapshotSavedAt,
      user: s.user,
      accessStatus: s.accessStatus,
      linkResolution: s.linkResolution,
      dismissLinkResolution: s.dismissLinkResolution,
      confirmPersonLink: s.confirmPersonLink,
    }))
  );
  const [currentTab, setCurrentTab] = useState<AppTab>('order');
  const [authMode, setAuthMode] = useState<'default' | 'recovery'>(() => (
    typeof window !== 'undefined' && isRecoveryHash(window.location.hash) ? 'recovery' : 'default'
  ));
  const [authError, setAuthError] = useState<string | null>(() => (
    typeof window !== 'undefined' ? parseAuthHashError(window.location.hash) : null
  ));
  const [currentPath, setCurrentPath] = useState(getCurrentPath);
  const [linkError, setLinkError] = useState<string | null>(null);
  const previousTabRef = useRef<AppTab>('order');
  const tabScrollPositionsRef = useRef<Record<AppTab, number>>({
    order: 0,
    people: 0,
    'my-stats': 0,
    history: 0,
    settings: 0,
  });

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(getCurrentPath());
    };

    window.addEventListener('popstate', handlePopState);
    handlePopState();

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        useAppStore.getState().saveSnapshot();
      }
    };
    const handlePageHide = () => {
      useAppStore.getState().saveSnapshot();
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', handlePageHide);
    }

    const hashError = parseAuthHashError(window.location.hash);
    if (hashError) {
      setAuthError(hashError);
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
      }
    } else if (isRecoveryHash(window.location.hash) && window.location.pathname !== RESET_PASSWORD_PATH) {
      updatePath(RESET_PASSWORD_PATH, {
        replace: true,
        preserveSearch: true,
        preserveHash: true,
      });
    }

    void initialize();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Token refresh doesn't change user identity or data — skip re-init
      if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') return;

      const currentUser = useAppStore.getState().user;
      if (event === 'SIGNED_IN') {
        setAuthError(null);
        if (currentUser && currentUser.id === session?.user?.id) {
          return;
        }
        if (getCurrentPath() === RESET_PASSWORD_PATH && authMode !== 'recovery') {
          updatePath(HOME_PATH, { replace: true });
        }
      }

      if (event === 'PASSWORD_RECOVERY') {
        setAuthMode('recovery');
        updatePath(RESET_PASSWORD_PATH, {
          replace: true,
          preserveSearch: true,
          preserveHash: true,
        });
      } else if (event === 'SIGNED_OUT') {
        setAuthMode('default');
        if (getCurrentPath() === RESET_PASSWORD_PATH) {
          updatePath(HOME_PATH, { replace: true });
        }
      }

      void initialize(getAuthReinitializeOptions(useAppStore.getState().isInitialized));
    });

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('pagehide', handlePageHide);
      }
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const joinOrderId = params.get('joinOrder');
    if (joinOrderId) {
      void useAppStore.getState().joinOrder(joinOrderId).then(() => {
        const nextParams = new URLSearchParams(window.location.search);
        nextParams.delete('joinOrder');
        const search = nextParams.toString() ? `?${nextParams.toString()}` : '';
        window.history.replaceState({}, document.title, `${window.location.pathname}${search}${window.location.hash}`);
        setCurrentTab('order');
      }).catch((err) => {
        console.error('Failed to join order:', err);
      });
    }
  }, [user]);

  useEffect(() => {
    if (accessStatus === 'participant' && (currentTab === 'order' || currentTab === 'people')) {
      setCurrentTab('my-stats');
    }
  }, [accessStatus, currentTab]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const previousTab = previousTabRef.current;
    if (previousTab === currentTab) {
      return;
    }

    tabScrollPositionsRef.current[previousTab] = window.scrollY;
    previousTabRef.current = currentTab;

    const nextScrollY = tabScrollPositionsRef.current[currentTab] ?? 0;
    const frameId = window.requestAnimationFrame(() => {
      window.scrollTo({ top: nextScrollY, behavior: 'auto' });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [currentTab]);

  useEffect(() => {
    if (user && authMode !== 'recovery' && currentPath === RESET_PASSWORD_PATH) {
      updatePath(HOME_PATH, { replace: true });
    }
  }, [user, authMode, currentPath]);

  // Apply saved theme + mode on mount (also done in initialize, but ensures fast flash-of-wrong-theme prevention)
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('fb_theme');
      if (savedTheme && ['emerald', 'yinmn'].includes(savedTheme)) {
        document.documentElement.setAttribute('data-theme', savedTheme);
      }

      const savedMode = (localStorage.getItem('fb_theme_mode') ?? 'light') as ThemeMode;
      const validMode = (['light', 'dark', 'auto'] as ThemeMode[]).includes(savedMode) ? savedMode : 'light';
      document.documentElement.setAttribute('data-mode', validMode);
    } catch {
      // Private browsing — ignore
    }
  }, []);

  const [initTimeout, setInitTimeout] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isInitialized || accessStatus === 'checking') setInitTimeout(true);
    }, 8000);
    return () => clearTimeout(timer);
  }, [isInitialized, accessStatus]);

  // Loading splash: keep visible while initializing store or resolving auth session
  if (!isInitialized || accessStatus === 'checking') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg)',
        gap: 'var(--space-4)',
        padding: 'var(--space-4)',
        textAlign: 'center',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <SplitsLockup size="large" />
        </div>
        <div className="spinner" />
        {initTimeout && (
          <div style={{ marginTop: 'var(--space-3)', maxWidth: 320 }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
              Connecting to workspace is taking longer than expected.
            </p>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setInitTimeout(false);
                void initialize();
              }}
            >
              Retry Connection
            </button>
          </div>
        )}
      </div>
    );
  }

  if (authMode === 'recovery' || (!user && currentPath === RESET_PASSWORD_PATH)) {
    return (
      <ResetPasswordPage
        onComplete={() => {
          setAuthMode('default');
          updatePath(HOME_PATH, { replace: true });
        }}
        onNavigateToSignIn={() => {
          setAuthMode('default');
          updatePath(HOME_PATH, { replace: true });
        }}
      />
    );
  }

  // Not logged in
  if (!user) {
    return <AuthPage initialError={authError || undefined} />;
  }

  // Logged in but not linked to any accessible records yet
  if (accessStatus === 'none') {
    return <PendingAccess />;
  }

  const participantOnly = accessStatus === 'participant';

  // Main app
  return (
    <div className="app-shell">
      <Header
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        participantOnly={participantOnly}
      />
      {isSyncing && (
        <div
          aria-live="polite"
          style={{
            position: 'fixed',
            top: 72,
            right: 16,
            zIndex: 20,
            padding: '6px 10px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--color-surface-raised)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-muted)',
            fontSize: '0.75rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          Syncing...
        </div>
      )}

      {!isSyncing && error && snapshotSavedAt && (
        <aside
          role="status"
          aria-live="polite"
          className="alert alert-warning"
          style={{
            position: 'fixed',
            top: 72,
            right: 16,
            zIndex: 20,
            padding: '6px 12px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <span>Couldn't refresh. Showing data saved {formatSnapshotSavedAt(snapshotSavedAt)}.</span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              void initialize({ silent: true });
            }}
            style={{ padding: '2px 6px', fontSize: '0.75rem' }}
          >
            Retry
          </button>
        </aside>
      )}

      <main className="app-main">
        {linkResolution.status === 'auto-linked' && linkResolution.person && (
          <div className="page-container" style={{ paddingBottom: 0 }}>
            <div className="alert alert-success" style={{ marginBottom: 'var(--space-4)' }}>
              Your account is now linked to {linkResolution.person.name}. Orders you were already part of are now available.
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                onClick={dismissLinkResolution}
                style={{ marginLeft: 'var(--space-3)', padding: 0 }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {(linkResolution.status === 'needs-confirmation' || linkResolution.status === 'ambiguous') && (
          <div className="page-container" style={{ paddingBottom: 0 }}>
            <div className="card card-padded alert-info" style={{ marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <div>
                  <h4 style={{ margin: 0, marginBottom: 'var(--space-1)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    Confirm your participant profile
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                    {linkResolution.status === 'needs-confirmation'
                      ? 'We found a possible match for your account in the workspace directory. Confirm to link your past orders and personal stats.'
                      : 'We found multiple possible matching directory profiles for your account. Please select which person profile belongs to you.'}
                  </p>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  onClick={() => {
                    setLinkError(null);
                    dismissLinkResolution();
                  }}
                >
                  Dismiss
                </button>
              </div>

              {linkError && (
                <div className="alert alert-error" style={{ marginTop: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                  {linkError}
                </div>
              )}

              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginTop: 'var(--space-3)' }}>
                {(linkResolution.candidates?.length > 0 ? linkResolution.candidates : (linkResolution.person ? [linkResolution.person] : [])).map((candidate) => (
                  <button
                    key={candidate.personId}
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={async () => {
                      setLinkError(null);
                      const err = await confirmPersonLink(candidate.personId);
                      if (err) {
                        setLinkError(err);
                      }
                    }}
                  >
                    Link as {candidate.name}
                    {candidate.email ? ` (${candidate.email})` : ''}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {!participantOnly && (
          <section className={`app-page ${currentTab === 'order' ? 'is-active' : ''}`} aria-hidden={currentTab !== 'order'}>
            <OrderPage onNavigateToHistory={() => setCurrentTab('history')} />
          </section>
        )}
        {!participantOnly && (
          <section className={`app-page ${currentTab === 'people' ? 'is-active' : ''}`} aria-hidden={currentTab !== 'people'}>
            <PeoplePage />
          </section>
        )}
        <section className={`app-page ${currentTab === 'my-stats' ? 'is-active' : ''}`} aria-hidden={currentTab !== 'my-stats'}>
          <MyStatsPage />
        </section>
        <section className={`app-page ${currentTab === 'history' ? 'is-active' : ''}`} aria-hidden={currentTab !== 'history'}>
          <HistoryPage participantOnly={participantOnly} />
        </section>
        <section className={`app-page ${currentTab === 'settings' ? 'is-active' : ''}`} aria-hidden={currentTab !== 'settings'}>
          <SettingsPage />
        </section>
      </main>
    </div>
  );
}
