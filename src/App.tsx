import { useEffect, useRef, useState } from 'react';
import { useAppStore } from './store/appStore';
import type { ThemeMode } from './types';
import { AuthPage } from './components/auth/AuthPage';
import { PendingAccess } from './components/auth/PendingAccess';
import { Header } from './components/layout/Header';
import { OrderPage } from './components/pages/OrderPage';
import { InvoicesPage } from './components/pages/InvoicesPage';
import { PeoplePage } from './components/pages/PeoplePage';
import { HistoryPage } from './components/pages/HistoryPage';
import { SettingsPage } from './components/pages/SettingsPage';
import type { AppTab } from './types';
import { supabase } from './lib/supabase';

import './styles/globals.css';
import './styles/print.css';

function isRecoveryHash(hash: string): boolean {
  return hash.includes('type=recovery');
}

export default function App() {
  const { initialize, isInitialized, isLoading, user, membershipStatus } = useAppStore();
  const [currentTab, setCurrentTab] = useState<AppTab>('order');
  const [authMode, setAuthMode] = useState<'default' | 'recovery'>(() => (
    typeof window !== 'undefined' && isRecoveryHash(window.location.hash) ? 'recovery' : 'default'
  ));

  useEffect(() => {
    void initialize();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setAuthMode('recovery');
      } else if (event === 'SIGNED_OUT') {
        setAuthMode('default');
      }

      void initialize();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

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

  if (authMode === 'recovery') {
    return (
      <AuthPage
        initialMode="recovery"
        onRecoveryComplete={() => {
          setAuthMode('default');
        }}
      />
    );
  }

  // Not logged in
  if (!user) {
    return <AuthPage />;
  }

  // Logged in but not a workspace member
  if (membershipStatus === 'none') {
    return <PendingAccess />;
  }

  // Main app
  return (
    <div className="app-shell">
      <Header
        currentTab={currentTab}
        onTabChange={setCurrentTab}
      />

      <main className="app-main">
        {currentTab === 'order' && <OrderPage />}
        {currentTab === 'invoices' && (
          <InvoicesPage onNavigateToOrder={() => setCurrentTab('order')} />
        )}
        {currentTab === 'people' && <PeoplePage />}
        {currentTab === 'history' && (
          <HistoryPage onNavigateToOrder={() => setCurrentTab('order')} />
        )}
        {currentTab === 'settings' && <SettingsPage />}
      </main>
    </div>
  );
}
