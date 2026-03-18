import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import type { AppTab } from '../../types';

interface HeaderProps {
  currentTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  participantOnly?: boolean;
}

const FULL_TABS: { id: AppTab; label: string }[] = [
  { id: 'order', label: 'Order' },
  { id: 'people', label: 'People' },
  { id: 'history', label: 'Past Orders' },
  { id: 'settings', label: 'Settings' },
];

const PARTICIPANT_TABS: { id: AppTab; label: string }[] = [
  { id: 'history', label: 'My Orders' },
  { id: 'settings', label: 'Settings' },
];

export function Header({ currentTab, onTabChange, participantOnly = false }: HeaderProps) {
  const { user, signOut } = useAppStore();
  const tabs = participantOnly ? PARTICIPANT_TABS : FULL_TABS;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const userInitials = useMemo(() => {
    const email = user?.email?.trim();
    if (!email) return 'FB';
    return email.slice(0, 2).toUpperCase();
  }, [user?.email]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  async function handleSignOut() {
    setMenuOpen(false);
    await signOut();
  }

  return (
    <>
      <header className="nav-top">
        <div className="nav-top-inner">
          <div className="nav-brand">
            <span className="nav-brand-icon">☕</span>
            <div>
              <div className="nav-brand-name">Fajr Brews</div>
              <div className="nav-brand-sub">Coffee Splitter</div>
            </div>
          </div>

          <nav className="nav-desktop-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`nav-desktop-tab ${currentTab === tab.id ? 'active' : ''}`}
                onClick={() => onTabChange(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="nav-user" ref={menuRef}>
            <div className="realtime-dot" title="Realtime sync active" />
            <button
              type="button"
              className={`nav-user-trigger ${menuOpen ? 'is-open' : ''}`}
              onClick={() => setMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <span className="nav-user-avatar" aria-hidden="true">{userInitials}</span>
              <span className="nav-user-email">{user?.email}</span>
              <span className="nav-user-caret" aria-hidden="true">▾</span>
            </button>

            {menuOpen && (
              <div className="nav-user-menu" role="menu">
                <div className="nav-user-menu-label">Signed in as</div>
                <div className="nav-user-menu-email">{user?.email}</div>
                <button type="button" className="nav-user-menu-action" onClick={() => void handleSignOut()}>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <nav className="nav-bottom" aria-label="Primary navigation">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`nav-bottom-tab ${currentTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
            aria-label={tab.label}
            aria-current={currentTab === tab.id ? 'page' : undefined}
          >
            <span className="nav-bottom-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      <style>{`
        .nav-top {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 100;
          background: var(--color-surface);
          border-bottom: 1px solid var(--color-border);
          box-shadow: var(--shadow-xs);
          height: 64px;
        }

        @media (min-width: 768px) {
          .nav-top {
            display: flex;
            align-items: center;
          }
        }

        .nav-top-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          max-width: 1100px;
          margin: 0 auto;
          padding: 0 var(--space-6);
          gap: var(--space-6);
        }

        .nav-brand {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          flex-shrink: 0;
        }

        .nav-brand-icon {
          font-size: 1.5rem;
          line-height: 1;
        }

        .nav-brand-name {
          font-family: var(--font-display);
          font-size: 1.125rem;
          font-weight: 700;
          color: var(--color-text-primary);
          line-height: 1.1;
          letter-spacing: -0.01em;
        }

        .nav-brand-sub {
          font-size: 0.625rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--color-text-muted);
        }

        .nav-desktop-tabs {
          display: flex;
          gap: 2px;
        }

        .nav-desktop-tab {
          padding: 6px 16px;
          border-radius: var(--radius-sm);
          border: none;
          background: transparent;
          cursor: pointer;
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--color-text-muted);
          transition: background-color var(--transition-fast), color var(--transition-fast);
        }

        .nav-desktop-tab:hover {
          background: var(--color-surface-raised);
          color: var(--color-text-primary);
        }

        .nav-desktop-tab.active {
          background: var(--color-accent-light);
          color: var(--color-accent);
        }

        .nav-user {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          flex-shrink: 0;
          position: relative;
        }

        .nav-user-trigger {
          display: inline-flex;
          align-items: center;
          gap: var(--space-2);
          min-height: 40px;
          padding: 6px 10px 6px 8px;
          border: 1px solid color-mix(in srgb, var(--color-border) 88%, transparent);
          border-radius: 999px;
          background: color-mix(in srgb, var(--color-surface) 94%, transparent);
          cursor: pointer;
          transition: border-color var(--transition-fast), background-color var(--transition-fast), box-shadow var(--transition-fast);
        }

        .nav-user-trigger:hover,
        .nav-user-trigger.is-open {
          border-color: color-mix(in srgb, var(--color-accent) 24%, var(--color-border));
          background: var(--color-surface-raised);
          box-shadow: var(--shadow-xs);
        }

        .nav-user-avatar {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: 999px;
          background: color-mix(in srgb, var(--color-accent) 16%, white);
          color: var(--color-accent);
          font-size: 0.6875rem;
          font-weight: 800;
          letter-spacing: 0.08em;
        }

        .nav-user-email {
          font-size: 0.8125rem;
          color: var(--color-text-muted);
          max-width: 180px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .nav-user-caret {
          color: var(--color-text-muted);
          font-size: 0.75rem;
        }

        .nav-user-menu {
          position: absolute;
          top: calc(100% + 10px);
          right: 0;
          min-width: 220px;
          padding: 10px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          background: var(--color-surface);
          box-shadow: var(--shadow-lg);
        }

        .nav-user-menu-label {
          font-size: 0.6875rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--color-text-muted);
        }

        .nav-user-menu-email {
          margin-top: 6px;
          margin-bottom: 10px;
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--color-text-primary);
          word-break: break-word;
        }

        .nav-user-menu-action {
          width: 100%;
          min-height: 40px;
          padding: 10px 12px;
          border: none;
          border-radius: var(--radius-sm);
          background: color-mix(in srgb, var(--color-surface-raised) 92%, transparent);
          color: var(--color-text-primary);
          font-size: 0.875rem;
          font-weight: 600;
          text-align: left;
          cursor: pointer;
          transition: background-color var(--transition-fast), color var(--transition-fast);
        }

        .nav-user-menu-action:hover {
          background: color-mix(in srgb, var(--color-accent-light) 88%, white);
          color: var(--color-accent);
        }

        .nav-bottom {
          display: flex;
          position: fixed;
          left: 50%;
          bottom: calc(12px + env(safe-area-inset-bottom, 0));
          transform: translateX(-50%);
          z-index: 100;
          width: min(calc(100% - 24px), 560px);
          padding: 8px;
          gap: 4px;
          background: color-mix(in srgb, var(--color-surface) 88%, transparent);
          border: 1px solid color-mix(in srgb, var(--color-border) 90%, transparent);
          border-radius: 999px;
          box-shadow: var(--shadow-lg);
          backdrop-filter: blur(18px);
        }

        @media (min-width: 768px) {
          .nav-bottom {
            display: none;
          }
        }

        .nav-bottom-tab {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          padding: 10px 6px;
          border: none;
          border-radius: 999px;
          background: transparent;
          cursor: pointer;
          position: relative;
          transition: background-color var(--transition-fast), box-shadow var(--transition-fast);
        }

        .nav-bottom-tab:active {
          background: color-mix(in srgb, var(--color-surface-raised) 84%, transparent);
        }

        .nav-bottom-tab.active {
          background: color-mix(in srgb, var(--color-surface) 96%, transparent);
          box-shadow: var(--shadow-xs);
        }

        .nav-bottom-tab.active::after {
          content: '';
          position: absolute;
          left: 18px;
          right: 18px;
          bottom: 6px;
          height: 2px;
          border-radius: 999px;
          background: color-mix(in srgb, var(--color-accent) 68%, transparent);
        }

        .nav-bottom-label {
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--color-text-muted);
        }

        .nav-bottom-tab.active .nav-bottom-label {
          color: var(--color-text-primary);
        }
      `}</style>
    </>
  );
}
