import { useAppStore } from '../../store/appStore';
import type { AppTab } from '../../types';

interface HeaderProps {
  currentTab: AppTab;
  onTabChange: (tab: AppTab) => void;
}

const TABS: { id: AppTab; label: string; icon: string }[] = [
  { id: 'order',    label: 'Order',    icon: '📋' },
  { id: 'invoices', label: 'Invoices', icon: '🧾' },
  { id: 'people',   label: 'People',   icon: '👥' },
  { id: 'history',  label: 'History',  icon: '📂' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

export function Header({ currentTab, onTabChange }: HeaderProps) {
  const { user } = useAppStore();

  return (
    <>
      {/* Desktop top navigation */}
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
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={`nav-desktop-tab ${currentTab === tab.id ? 'active' : ''}`}
                onClick={() => onTabChange(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="nav-user">
            <div className="realtime-dot" title="Realtime sync active" />
            <span className="nav-user-email">{user?.email}</span>
          </div>
        </div>
      </header>

      {/* Mobile bottom navigation */}
      <nav className="nav-bottom">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`nav-bottom-tab ${currentTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
            aria-label={tab.label}
          >
            <span className="nav-bottom-icon">{tab.icon}</span>
            <span className="nav-bottom-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      <style>{`
        /* ── Desktop top nav ─────────────────────────────────── */
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
          .nav-top { display: flex; align-items: center; }
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
        }

        .nav-user-email {
          font-size: 0.8125rem;
          color: var(--color-text-muted);
          max-width: 180px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* ── Mobile bottom nav ───────────────────────────────── */
        .nav-bottom {
          display: flex;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 100;
          background: var(--color-surface);
          border-top: 1px solid var(--color-border);
          box-shadow: 0 -4px 12px rgba(0,0,0,0.06);
          /* Safe area for iOS */
          padding-bottom: env(safe-area-inset-bottom, 0);
        }

        @media (min-width: 768px) {
          .nav-bottom { display: none; }
        }

        .nav-bottom-tab {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          padding: 8px 4px;
          border: none;
          background: transparent;
          cursor: pointer;
          transition: background-color var(--transition-fast);
          min-height: 56px;
        }

        .nav-bottom-tab:active {
          background: var(--color-surface-raised);
        }

        .nav-bottom-tab.active .nav-bottom-label {
          color: var(--color-accent);
          font-weight: 700;
        }

        .nav-bottom-tab.active .nav-bottom-icon {
          filter: drop-shadow(0 0 4px color-mix(in srgb, var(--color-accent) 30%, transparent));
        }

        .nav-bottom-icon {
          font-size: 1.25rem;
          line-height: 1;
          display: block;
        }

        .nav-bottom-label {
          font-size: 0.625rem;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--color-text-muted);
        }
      `}</style>
    </>
  );
}
