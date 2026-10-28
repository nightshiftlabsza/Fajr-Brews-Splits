import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import {
  CURRENCIES,
  getAllCurrencies,
  getCurrency,
  getSuggestedCurrencies,
  isSuggestedCurrency,
  type Currency,
} from '../../data/currencies';
import { SearchablePicker } from '../ui/SearchablePicker';
import { Sheet } from '../ui/Sheet';
import { Icon } from '../ui/Icon';

export interface RoasterCurrencyFieldProps {
  value?: string | null;
  onChange: (currencyCode: string) => void;
  disabled?: boolean;
  id?: string;
}

export function RoasterCurrencyField({
  value,
  onChange,
  disabled = false,
  id: externalId,
}: RoasterCurrencyFieldProps) {
  const generatedId = useId();
  const fieldId = externalId || generatedId;
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(max-width: 767px)').matches;
    }
    return false;
  });

  // Track responsive screen size
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const updateMatch = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches);
    };
    updateMatch(mediaQuery);

    const listener = (e: MediaQueryListEvent) => updateMatch(e);
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    } else if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(listener);
      return () => mediaQuery.removeListener(listener);
    }
  }, []);

  // Close desktop popover on outside click
  useEffect(() => {
    if (!isOpen || isMobile) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, isMobile]);

  const selectedCurrency = useMemo(() => getCurrency(value), [value]);

  // Items ordered: Suggested first in required order, followed by all remaining A to Z
  const pickerItems = useMemo(() => {
    const suggested = getSuggestedCurrencies();
    const remaining = getAllCurrencies().filter((c) => !isSuggestedCurrency(c));
    return [...suggested, ...remaining];
  }, []);

  const handleSelect = useCallback(
    (currency: Currency) => {
      onChange(currency.code);
      setIsOpen(false);
      triggerRef.current?.focus();
    },
    [onChange]
  );

  const handleTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen(true);
    }
  };

  const renderPicker = () => (
    <SearchablePicker<Currency>
      items={pickerItems}
      selectedId={selectedCurrency?.code}
      onSelect={handleSelect}
      onClose={() => {
        setIsOpen(false);
        triggerRef.current?.focus();
      }}
      getId={(item) => item.code}
      getSearchFields={(item) => [item.code, item.name, item.symbol, ...item.countries]}
      isSuggested={isSuggestedCurrency}
      suggestedLabel="Suggested"
      allLabel="All currencies"
      placeholder="Search currency, code or country..."
      emptyMessage="No currencies found."
      ariaLabel="Choose roaster price currency"
      renderItem={(item, isSelected) => (
        <div className="roaster-currency-option">
          <div className="roaster-currency-option-main">
            <span className="roaster-currency-option-symbol" aria-hidden="true">
              {item.symbol}
            </span>
            <span className="roaster-currency-option-name">{item.name}</span>
          </div>
          <span className="roaster-currency-option-code">{item.code}</span>
        </div>
      )}
    />
  );

  return (
    <div className="roaster-currency-field" ref={containerRef}>
      <label htmlFor={fieldId} className="roaster-currency-label">
        Roaster's currency
      </label>

      <button
        type="button"
        id={fieldId}
        ref={triggerRef}
        className="roaster-currency-trigger"
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        onKeyDown={handleTriggerKeyDown}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <div className="roaster-currency-trigger-content">
          {selectedCurrency ? (
            <>
              <span className="roaster-currency-symbol-badge" aria-hidden="true">
                {selectedCurrency.symbol}
              </span>
              <span className="roaster-currency-trigger-text">
                {selectedCurrency.name} ({selectedCurrency.code})
              </span>
            </>
          ) : (
            <span className="roaster-currency-trigger-text roaster-currency-trigger-placeholder">
              {value ? `${value} (unrecognized)` : 'Choose currency...'}
            </span>
          )}
        </div>
        <Icon name="chevron-down" size={16} />
      </button>

      <div className="roaster-currency-help">
        This only labels the roaster's prices. It does not change any amounts.
      </div>

      {isOpen && (
        isMobile ? (
          <Sheet
            isOpen={isOpen}
            onClose={() => {
              setIsOpen(false);
              triggerRef.current?.focus();
            }}
            title="Roaster's currency"
            description="This only labels the roaster's prices. It does not change any amounts."
            fullHeight
          >
            <div className="roaster-currency-sheet-content">
              {renderPicker()}
            </div>
          </Sheet>
        ) : (
          <div className="roaster-currency-popover" role="dialog" aria-modal="false">
            {renderPicker()}
          </div>
        )
      )}
    </div>
  );
}
