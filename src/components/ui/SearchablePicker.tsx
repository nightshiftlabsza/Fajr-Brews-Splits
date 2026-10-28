import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Icon } from './Icon';

export interface SearchablePickerProps<T> {
  items: T[];
  selectedId?: string;
  onSelect: (item: T) => void;
  onClose?: () => void;
  getId: (item: T) => string;
  getSearchFields: (item: T) => (string | undefined | null)[];
  renderItem: (item: T, isSelected: boolean, isHighlighted: boolean) => ReactNode;
  isSuggested?: (item: T) => boolean;
  placeholder?: string;
  emptyMessage?: string;
  suggestedLabel?: string;
  allLabel?: string;
  className?: string;
  ariaLabel?: string;
}

export function SearchablePicker<T>({
  items,
  selectedId,
  onSelect,
  onClose,
  getId,
  getSearchFields,
  renderItem,
  isSuggested,
  placeholder = 'Type to search...',
  emptyMessage = 'No matches found.',
  suggestedLabel = 'Suggested',
  allLabel = 'All',
  className = '',
  ariaLabel = 'Searchable picker',
}: SearchablePickerProps<T>) {
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputId = useId();
  const listRef = useRef<HTMLDivElement>(null);

  // Filter items matching query across passed search fields
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const fields = getSearchFields(item);
      return fields.some((field) => (field ? field.toLowerCase().includes(q) : false));
    });
  }, [items, query, getSearchFields]);

  // Group into Suggested and All
  const { suggestedList, allList, flattenedList } = useMemo(() => {
    if (!isSuggested) {
      return {
        suggestedList: [],
        allList: filteredItems,
        flattenedList: filteredItems,
      };
    }

    const suggested: T[] = [];
    const rest: T[] = [];

    for (const item of filteredItems) {
      if (isSuggested(item)) {
        suggested.push(item);
      } else {
        rest.push(item);
      }
    }

    return {
      suggestedList: suggested,
      allList: rest,
      flattenedList: [...suggested, ...rest],
    };
  }, [filteredItems, isSuggested]);

  // Reset highlight index when query changes
  function handleQueryChange(newQuery: string) {
    setQuery(newQuery);
    setHighlightedIndex(0);
  }

  useEffect(() => {
    if (!listRef.current) return;
    const highlightedEl = listRef.current.querySelector('.fb-picker-option.is-highlighted');
    if (highlightedEl && typeof (highlightedEl as HTMLElement).scrollIntoView === 'function') {
      (highlightedEl as HTMLElement).scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((prev) => (flattenedList.length === 0 ? 0 : (prev + 1) % flattenedList.length));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((prev) =>
        flattenedList.length === 0 ? 0 : (prev - 1 + flattenedList.length) % flattenedList.length
      );
    } else if (event.key === 'Enter') {
      if (flattenedList.length > 0 && flattenedList[highlightedIndex]) {
        event.preventDefault();
        onSelect(flattenedList[highlightedIndex]);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      if (query) {
        setQuery('');
      } else if (onClose) {
        onClose();
      }
    }
  }

  return (
    <div
      className={`fb-searchable-picker ${className}`.trim()}
      onKeyDown={handleKeyDown}
      role="region"
      aria-label={ariaLabel}
    >
      {/* Search Input */}
      <div className="fb-picker-search-bar">
        <label htmlFor={inputId} className="sr-only">
          {placeholder}
        </label>
        <div className="fb-picker-input-wrap">
          <span className="fb-picker-search-icon" aria-hidden="true">
            <Icon name="search" size={15} />
          </span>
          <input
            id={inputId}
            type="search"
            role="combobox"
            aria-expanded={flattenedList.length > 0}
            aria-autocomplete="list"
            aria-controls={`${inputId}-listbox`}
            aria-activedescendant={
              flattenedList[highlightedIndex]
                ? `${inputId}-opt-${getId(flattenedList[highlightedIndex])}`
                : undefined
            }
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder={placeholder}
            className="input fb-picker-input"
            autoComplete="off"
            spellCheck="false"
          />
          {query && (
            <button
              type="button"
              className="fb-picker-clear-btn"
              onClick={() => handleQueryChange('')}
              aria-label="Clear search"
            >
              <Icon name="close" size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Options List */}
      <div
        ref={listRef}
        id={`${inputId}-listbox`}
        className="fb-picker-list"
        role="listbox"
        aria-label={ariaLabel}
      >
        {flattenedList.length === 0 ? (
          <div className="fb-picker-empty" role="status">
            <p>{emptyMessage}</p>
          </div>
        ) : (
          <>
            {/* Suggested Group */}
            {suggestedList.length > 0 && (
              <div className="fb-picker-group" role="group" aria-label={suggestedLabel}>
                <div className="fb-picker-group-heading">{suggestedLabel}</div>
                {suggestedList.map((item, localIdx) => {
                  const globalIdx = localIdx;
                  const itemId = getId(item);
                  const isSelected = selectedId === itemId;
                  const isHighlighted = highlightedIndex === globalIdx;

                  return (
                    <div
                      key={itemId}
                      id={`${inputId}-opt-${itemId}`}
                      role="option"
                      aria-selected={isSelected}
                      className={`fb-picker-option ${isSelected ? 'is-selected' : ''} ${
                        isHighlighted ? 'is-highlighted' : ''
                      }`}
                      onClick={() => onSelect(item)}
                      onMouseEnter={() => setHighlightedIndex(globalIdx)}
                    >
                      {renderItem(item, isSelected, isHighlighted)}
                    </div>
                  );
                })}
              </div>
            )}

            {/* All / Remaining Group */}
            {allList.length > 0 && (
              <div
                className="fb-picker-group"
                role="group"
                aria-label={suggestedList.length > 0 ? allLabel : undefined}
              >
                {suggestedList.length > 0 && <div className="fb-picker-group-heading">{allLabel}</div>}
                {allList.map((item, localIdx) => {
                  const globalIdx = suggestedList.length + localIdx;
                  const itemId = getId(item);
                  const isSelected = selectedId === itemId;
                  const isHighlighted = highlightedIndex === globalIdx;

                  return (
                    <div
                      key={itemId}
                      id={`${inputId}-opt-${itemId}`}
                      role="option"
                      aria-selected={isSelected}
                      className={`fb-picker-option ${isSelected ? 'is-selected' : ''} ${
                        isHighlighted ? 'is-highlighted' : ''
                      }`}
                      onClick={() => onSelect(item)}
                      onMouseEnter={() => setHighlightedIndex(globalIdx)}
                    >
                      {renderItem(item, isSelected, isHighlighted)}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
