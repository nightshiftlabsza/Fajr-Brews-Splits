import { useEffect, useRef, useState, useId } from 'react';
import { validateStatsDateRange, type StatsDateRange, type StatsRangePreset } from '../../lib/yearInCoffee';

interface YearPickerProps {
  years: string[];
  selectedRange: StatsDateRange;
  selectedYear?: string | null;
  currentYear: string;
  orderCountByYear?: Record<string, number>;
  totalOrdersCount: number;
  onSelectYear: (year: string | null) => void;
  onSelectRange: (range: StatsDateRange) => void;
}

export function YearPicker({
  years,
  selectedRange,
  selectedYear,
  currentYear,
  orderCountByYear = {},
  totalOrdersCount,
  onSelectYear,
  onSelectRange,
}: YearPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showCustomFields, setShowCustomFields] = useState(selectedRange.preset === 'custom');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Keyboard navigation & focus trap for mobile bottom sheet
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
        return;
      }

      if (event.key === 'Tab' && sheetRef.current) {
        const focusables = sheetRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (!first || !last) return;

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Auto-focus first interactive element when opening
    const timer = setTimeout(() => {
      if (sheetRef.current) {
        const closeBtn = sheetRef.current.querySelector<HTMLElement>('.stats-sheet-close-btn');
        closeBtn?.focus();
      }
    }, 50);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
    };
  }, [isOpen]);

  const handleClose = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const customValidation = selectedRange.preset === 'custom' ? validateStatsDateRange(selectedRange) : null;

  const getTriggerLabel = (): string => {
    if (selectedYear) {
      return selectedYear === currentYear ? `${selectedYear} so far` : selectedYear;
    }
    if (selectedRange.preset === 'all') {
      return 'All time';
    }
    if (selectedRange.preset === '3m') {
      return 'Last 3 months';
    }
    if (selectedRange.preset === '6m') {
      return 'Last 6 months';
    }
    if (selectedRange.preset === '12m') {
      return 'Last 12 months';
    }
    if (selectedRange.preset === 'custom') {
      return 'Custom range';
    }
    return 'Choose a year';
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        ref={triggerRef}
        type="button"
        className="stats-picker-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label="Choose coffee statistics period"
      >
        <span>{getTriggerLabel()}</span>
        <span aria-hidden="true">▾</span>
      </button>

      {isOpen && (
        <div
          className={isMobile ? 'stats-bottom-sheet-backdrop' : 'stats-dropdown-backdrop'}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleClose();
            }
          }}
        >
          <div
            ref={sheetRef}
            className={isMobile ? 'stats-bottom-sheet' : 'stats-card'}
            style={
              !isMobile
                ? {
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    left: 0,
                    minWidth: '320px',
                    zIndex: 100,
                    boxShadow: 'var(--shadow-lg)',
                    padding: 'var(--space-4)',
                  }
                : undefined
            }
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            {isMobile && <div className="stats-sheet-drag-handle" aria-hidden="true" />}

            <div className="stats-sheet-header">
              <h3 id={titleId} className="stats-sheet-title">
                Choose a year
              </h3>
              <button
                type="button"
                className="stats-sheet-close-btn"
                onClick={handleClose}
                aria-label="Close year picker"
              >
                ✕
              </button>
            </div>

            <div className="stats-sheet-body">
              <button
                type="button"
                className={`stats-sheet-row ${!selectedYear && selectedRange.preset === 'all' ? 'is-active' : ''}`}
                onClick={() => {
                  onSelectYear(null);
                  handleClose();
                }}
              >
                <span>All time</span>
                <span className="stats-sheet-row-meta">
                  {totalOrdersCount} {totalOrdersCount === 1 ? 'order' : 'orders'} total
                  {!selectedYear && selectedRange.preset === 'all' && <span aria-hidden="true"> ✓</span>}
                </span>
              </button>

              {years.map((year) => {
                const isCurrent = year === currentYear;
                const isSelected = selectedYear === year;
                const count = orderCountByYear[year] ?? 0;
                return (
                  <button
                    key={year}
                    type="button"
                    className={`stats-sheet-row ${isSelected ? 'is-active' : ''}`}
                    onClick={() => {
                      onSelectYear(year);
                      handleClose();
                    }}
                  >
                    <span>
                      {year}
                      {isCurrent && <span className="stats-sheet-badge-current">so far</span>}
                    </span>
                    <span className="stats-sheet-row-meta">
                      {count} {count === 1 ? 'order' : 'orders'}
                      {isSelected && <span aria-hidden="true"> ✓</span>}
                    </span>
                  </button>
                );
              })}

              <div
                style={{
                  margin: 'var(--space-3) 0 var(--space-2)',
                  paddingTop: 'var(--space-2)',
                  borderTop: '1px solid var(--color-border)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--color-text-muted)',
                }}
              >
                More ranges
              </div>

              {(['3m', '6m', '12m'] as StatsRangePreset[]).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`stats-sheet-row ${selectedRange.preset === preset ? 'is-active' : ''}`}
                  onClick={() => {
                    onSelectRange({ preset });
                    handleClose();
                  }}
                >
                  <span>
                    {preset === '3m' ? 'Last 3 months' : preset === '6m' ? 'Last 6 months' : 'Last 12 months'}
                  </span>
                  {selectedRange.preset === preset && <span aria-hidden="true">✓</span>}
                </button>
              ))}

              <button
                type="button"
                className={`stats-sheet-row ${selectedRange.preset === 'custom' ? 'is-active' : ''}`}
                onClick={() => {
                  setShowCustomFields(true);
                  if (selectedRange.preset !== 'custom') {
                    onSelectRange({ preset: 'custom', startDate: '', endDate: '' });
                  }
                }}
              >
                <span>Custom date range</span>
                {selectedRange.preset === 'custom' && <span aria-hidden="true">✓</span>}
              </button>

              {showCustomFields && (
                <div style={{ padding: 'var(--space-2) 0', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  <div>
                    <label htmlFor="stats-custom-start" style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 2 }}>
                      Start date
                    </label>
                    <input
                      id="stats-custom-start"
                      type="date"
                      className="input"
                      style={{ width: '100%', minHeight: '44px' }}
                      value={selectedRange.startDate ?? ''}
                      onChange={(e) =>
                        onSelectRange({
                          preset: 'custom',
                          startDate: e.target.value,
                          endDate: selectedRange.endDate ?? '',
                        })
                      }
                    />
                  </div>
                  <div>
                    <label htmlFor="stats-custom-end" style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 2 }}>
                      End date
                    </label>
                    <input
                      id="stats-custom-end"
                      type="date"
                      className="input"
                      style={{ width: '100%', minHeight: '44px' }}
                      value={selectedRange.endDate ?? ''}
                      onChange={(e) =>
                        onSelectRange({
                          preset: 'custom',
                          startDate: selectedRange.startDate ?? '',
                          endDate: e.target.value,
                        })
                      }
                    />
                  </div>
                  {customValidation?.status === 'incomplete' && (
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-warning)', padding: '2px 0' }}>
                      Select both a start and end date.
                    </div>
                  )}
                  {customValidation?.status === 'invalid' && (
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger, #d32f2f)', padding: '2px 0' }}>
                      Start date must be on or before end date.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
