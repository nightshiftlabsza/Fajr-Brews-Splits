import { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../store/appStore';
import type { AppTab } from '../../types';

interface HeaderProps {
  currentTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  participantOnly?: boolean;
}

const FULL_TABS: { id: AppTab; label: string }[] = [
  { id: 'order', label: 'Active Orders' },
  { id: 'my-stats', label: 'My Stats' },
  { id: 'history', label: 'Past Orders' },
  { id: 'settings', label: 'Settings' },
];

const PARTICIPANT_TABS: { id: AppTab; label: string }[] = [
  { id: 'my-stats', label: 'My Stats' },
  { id: 'history', label: 'My Orders' },
  { id: 'settings', label: 'Settings' },
];

export function Header({ currentTab, onTabChange, participantOnly = false }: HeaderProps) {
  const { user, signOut } = useAppStore(
    useShallow((s) => ({
      user: s.user,
      signOut: s.signOut,
    }))
  );
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
          z-index: var(--z-header);
          background: var(--color-surface);
          border-bottom: 1px solid var(--color-border);
          box-shadow: none;
          height: var(--nav-top-height, 64px);
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
          max-width: var(--content-max-width, 1200px);
          margin: 0 auto;
          padding: 0 var(--space-6);
          gap: var(--space-4);
        }

        @media (min-width: 768px) and (max-width: 1023px) {
          .nav-top-inner {
            padding: 0 var(--space-4);
            gap: var(--space-3);
          }
          .nav-desktop-tab {
            padding: 6px 10px;
            font-size: 0.8125rem;
          }
          .nav-brand-name {
            font-size: 1rem;
          }
          .nav-user-email {
            max-width: 110px;
          }
        }

        .nav-brand {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          flex-shrink: 0;
        }

        .nav-brand-icon {
          font-size: 1.375rem;
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
          align-items: center;
          gap: var(--space-1);
        }

        .nav-desktop-tab {
          border: none;
          background: transparent;
          cursor: pointer;
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--color-text-secondary);
          padding: 6px 14px;
          border-radius: var(--radius-sm);
          transition: background-color var(--transition-fast), color var(--transition-fast);
        }

        .nav-desktop-tab:hover {
          background: var(--color-surface-raised);
          color: var(--color-text-primary);
        }

        .nav-desktop-tab.active {
          background: var(--color-accent-light);
          color: var(--color-accent);
          font-weight: 600;
        }

        .nav-user {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          flex-shrink: 0;
          position: relative;
        }

        .nav-user-trigger {
          display: inline-flex;
          align-items: center;
          gap: var(--space-2);
          min-height: 38px;
          padding: 4px 12px 4px 6px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-full);
          background: var(--color-surface);
          cursor: pointer;
          transition: border-color var(--transition-fast), background-color var(--transition-fast);
        }

        .nav-user-trigger:hover,
        .nav-user-trigger.is-open {
          border-color: var(--color-border-strong);
          background: var(--color-surface-raised);
        }

        .nav-user-avatar {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: var(--color-accent-light);
          color: var(--color-accent);
          font-size: 0.6875rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          flex-shrink: 0;
        }

        .nav-user-email {
          font-size: 0.8125rem;
          font-weight: 500;
          color: var(--color-text-secondary);
          max-width: 180px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .nav-user-caret {
          color: var(--color-text-muted);
          font-size: 0.75rem;
          flex-shrink: 0;
        }

        .nav-user-menu {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          min-width: 220px;
          padding: var(--space-3);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          background: var(--color-surface);
          box-shadow: var(--shadow-md);
          z-index: var(--z-header);
        }

        .nav-user-menu-label {
          font-size: 0.6875rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--color-text-muted);
        }

        .nav-user-menu-email {
          margin-top: 4px;
          margin-bottom: 12px;
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--color-text-primary);
          word-break: break-all;
        }

        .nav-user-menu-action {
          width: 100%;
          min-height: 36px;
          padding: 8px 12px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          background: var(--color-surface-raised);
          color: var(--color-text-primary);
          font-size: 0.875rem;
          font-weight: 500;
          text-align: left;
          cursor: pointer;
          transition: background-color var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast);
        }

        .nav-user-menu-action:hover {
          background: var(--color-surface-hover);
          border-color: var(--color-border-strong);
        }

        .nav-bottom {
          display: flex;
          position: fixed;
          left: 50%;
          bottom: calc(12px + env(safe-area-inset-bottom, 0));
          transform: translateX(-50%);
          z-index: var(--z-header);
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
