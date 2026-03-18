import { useEffect, useRef, useState } from 'react';
import { useAppStore } from './store/appStore';
import type { ThemeMode } from './types';
import { AuthPage } from './components/auth/AuthPage';
import { PendingAccess } from './components/auth/PendingAccess';
import { Header } from './components/layout/Header';
import { OrderPage } from './components/pages/OrderPage';
import { PeoplePage } from './components/pages/PeoplePage';
import { HistoryPage } from './components/pages/HistoryPage';
import { ResetPasswordPage } from './components/pages/ResetPasswordPage';
import { SettingsPage } from './components/pages/SettingsPage';
import type { AppTab } from './types';
import { HOME_PATH, RESET_PASSWORD_PATH } from './lib/appConfig';
import { supabase } from './lib/supabase';

import './styles/globals.css';
import './styles/print.css';

function isRecoveryHash(hash: string): boolean {
  return hash.includes('type=recovery');
}

function getCurrentPath(): string {
  if (typeof window === 'undefined') {
    return HOME_PATH;
  }

  return window.location.pathname || HOME_PATH;
}

function updatePath(
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

export default function App() {
  const { initialize, isInitialized, isLoading, user, accessStatus, linkResolution, dismissLinkResolution } = useAppStore();
  const [currentTab, setCurrentTab] = useState<AppTab>('order');
  const [authMode, setAuthMode] = useState<'default' | 'recovery'>(() => (
    typeof window !== 'undefined' && isRecoveryHash(window.location.hash) ? 'recovery' : 'default'
  ));
  const [currentPath, setCurrentPath] = useState(getCurrentPath);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(getCurrentPath());
    };

    window.addEventListener('popstate', handlePopState);
    handlePopState();

    if (isRecoveryHash(window.location.hash) && window.location.pathname !== RESET_PASSWORD_PATH) {
      updatePath(RESET_PASSWORD_PATH, {
        replace: true,
        preserveSearch: true,
        preserveHash: true,
      });
    }

    void initialize();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
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
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (accessStatus === 'participant' && (currentTab === 'order' || currentTab === 'people')) {
      setCurrentTab('history');
    }
  }, [accessStatus, currentTab]);

  // Track mediaQuery listener for cleanup
  const modeListenerRef = useRef<((e: MediaQueryListEvent) => void) | null>(null);
  const modeMediaRef = useRef<MediaQueryList | null>(null);

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

    // Listen for OS dark-mode changes (used when mode='auto')
    try {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      modeMediaRef.current = mq;
      const handler = () => {
        // Force a repaint so @media (prefers-color-scheme) CSS re-evaluates
        const mode = document.documentElement.getAttribute('data-mode');
        if (mode === 'auto') {
          // Toggling a dummy attribute triggers CSS re-evaluation
          document.documentElement.setAttribute('data-mode', 'auto');
        }
      };
      modeListenerRef.current = handler;
      mq.addEventListener('change', handler);
    } catch { /* ignore */ }

    return () => {
      try {
        if (modeMediaRef.current && modeListenerRef.current) {
          modeMediaRef.current.removeEventListener('change', modeListenerRef.current);
        }
      } catch { /* ignore */ }
    };
  }, []);

  // Loading splash
  if (!isInitialized || isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg)',
        gap: 'var(--space-4)',
      }}>
        <div style={{ fontSize: '2.5rem' }}>☕</div>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.5rem',
          fontWeight: 700,
          color: 'var(--color-text-primary)',
        }}>
          Fajr Brews
        </div>
        <div className="spinner" />
      </div>
    );
  }

  if (authMode === 'recovery' || currentPath === RESET_PASSWORD_PATH) {
    return (
      <ResetPasswordPage
        onComplete={() => {
          setAuthMode('default');
          updatePath(HOME_PATH, { replace: true });
        }}
      />
    );
  }

  // Not logged in
  if (!user) {
    return <AuthPage />;
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
        <section className={`app-page ${currentTab === 'history' ? 'is-active' : ''}`} aria-hidden={currentTab !== 'history'}>
          <HistoryPage onNavigateToOrder={() => setCurrentTab('order')} participantOnly={participantOnly} />
        </section>
        <section className={`app-page ${currentTab === 'settings' ? 'is-active' : ''}`} aria-hidden={currentTab !== 'settings'}>
          <SettingsPage />
        </section>
      </main>
    </div>
  );
}
