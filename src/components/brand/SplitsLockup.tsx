import { SplitsMark } from './SplitsMark';

export interface SplitsLockupProps {
  showAttribution?: boolean;
  size?: 'default' | 'large';
  className?: string;
}

export function SplitsLockup({
  showAttribution = true,
  size = 'default',
  className,
}: SplitsLockupProps) {
  const isLarge = size === 'large';
  const markSize = isLarge ? 48 : 32;

  const rootClasses = [
    'splits-lockup',
    isLarge ? 'splits-lockup--large' : '',
    className || '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClasses}>
      <SplitsMark size={markSize} />
      <div className="splits-lockup-text">
        <div className="splits-brand-name">
          Splits<span className="splits-dot">.</span>
        </div>
        {showAttribution && (
          <div className="splits-attribution">
            by <span className="splits-attribution-org">Fajr Brews</span>
          </div>
        )}
      </div>

      <style>{`
        .splits-lockup {
          display: inline-flex;
          align-items: center;
          gap: var(--space-3);
          text-decoration: none;
          color: inherit;
          user-select: none;
        }

        .splits-lockup-text {
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .splits-brand-name {
          font-family: var(--font-display);
          font-size: 1.375rem;
          line-height: 1;
          letter-spacing: -0.02em;
          color: var(--color-text-primary);
        }

        [data-theme="emerald"] .splits-brand-name {
          font-weight: 600;
        }

        [data-theme="yinmn"] .splits-brand-name {
          font-weight: 700;
        }

        .splits-dot {
          color: var(--color-accent);
        }

        .splits-attribution {
          font-family: var(--font-body);
          font-size: 0.6875rem;
          font-weight: 500;
          color: var(--color-text-muted);
          line-height: 1.2;
          margin-top: 3px;
          white-space: nowrap;
        }

        .splits-attribution-org {
          color: var(--color-text-primary);
        }

        [data-theme="emerald"] .splits-attribution-org {
          font-family: 'Fraunces', Georgia, serif;
          font-style: italic;
          font-weight: 500;
        }

        [data-theme="yinmn"] .splits-attribution-org {
          font-family: var(--font-body);
          font-style: normal;
          font-weight: 700;
        }

        @media (max-width: 480px) {
          .splits-lockup:not(.splits-lockup--large) .splits-mark {
            width: 28px;
            height: 28px;
          }

          .splits-lockup:not(.splits-lockup--large) .splits-brand-name {
            font-size: 1.25rem;
          }

          .splits-lockup:not(.splits-lockup--large) .splits-attribution {
            display: none;
          }
        }

        .splits-lockup--large {
          gap: var(--space-4);
        }

        .splits-lockup--large .splits-brand-name {
          font-size: 2rem;
        }

        .splits-lockup--large .splits-attribution {
          font-size: 0.875rem;
          margin-top: 4px;
        }
      `}</style>
    </div>
  );
}
