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
  const { user } = useAppStore();
  const tabs = participantOnly ? PARTICIPANT_TABS : FULL_TABS;

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

          <div className="nav-user">
            <div className="realtime-dot" title="Realtime sync active" />
            <span className="nav-user-email">{user?.email}</span>
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
        }

        .nav-user-email {
          font-size: 0.8125rem;
          color: var(--color-text-muted);
          max-width: 180px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
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
