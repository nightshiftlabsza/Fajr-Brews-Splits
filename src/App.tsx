import { useEffect, useState } from 'react';
import { useAppStore } from './store/appStore';
import { AuthPage } from './components/auth/AuthPage';
import { PendingAccess } from './components/auth/PendingAccess';
import { Header } from './components/layout/Header';
import { OrderPage } from './components/pages/OrderPage';
import { InvoicesPage } from './components/pages/InvoicesPage';
import { PeoplePage } from './components/pages/PeoplePage';
import { HistoryPage } from './components/pages/HistoryPage';
import { SettingsPage } from './components/pages/SettingsPage';
import type { AppTab } from './types';

import './styles/globals.css';
import './styles/print.css';

export default function App() {
  const { initialize, isInitialized, isLoading, user, membershipStatus } = useAppStore();
  const [currentTab, setCurrentTab] = useState<AppTab>('order');

  useEffect(() => {
    initialize();
  }, []);

  // Apply saved theme on mount (also done in initialize, but ensure it's set)
  useEffect(() => {
    const saved = localStorage.getItem('fb_theme');
    if (saved && ['porcelain', 'obsidian', 'slate'].includes(saved)) {
      document.documentElement.setAttribute('data-theme', saved);
    }
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
