import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import type { Person } from '../../types';
import { Icon } from '../ui/Icon';

export interface PersonPickerListProps {
  people: Person[];
  selectedPersonIds: string[];
  onTogglePerson: (personId: string) => void;
  onSelectAll?: () => void;
  onClearAll?: () => void;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
}

export function PersonPickerList({
  people,
  selectedPersonIds,
  onTogglePerson,
  onSelectAll,
  onClearAll,
  searchPlaceholder = 'Search people...',
  emptyMessage = 'No matching people found.',
  className = '',
}: PersonPickerListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputId = useId();

  const selectedSet = useMemo(() => new Set(selectedPersonIds), [selectedPersonIds]);

  const filteredPeople = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return people;
    return people.filter((p) => {
      const matchName = p.name.toLowerCase().includes(q);
      const matchNote = p.note ? p.note.toLowerCase().includes(q) : false;
      const matchEmail = p.email ? p.email.toLowerCase().includes(q) : false;
      const matchPhone = p.phone ? p.phone.toLowerCase().includes(q) : false;
      return matchName || matchNote || matchEmail || matchPhone;
    });
  }, [people, searchQuery]);

  function handleRowKeyDown(event: KeyboardEvent<HTMLLabelElement>, personId: string) {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      onTogglePerson(personId);
    }
  }

  return (
    <div className={`fb-person-picker ${className}`.trim()}>
      {/* Search Header */}
      <div className="fb-person-picker-search-bar">
        <label htmlFor={searchInputId} className="sr-only">
          {searchPlaceholder}
        </label>
        <div className="fb-person-picker-search-input-wrap">
          <span className="fb-person-picker-search-icon" aria-hidden="true">
            <Icon name="search" size={15} />
          </span>
          <input
            id={searchInputId}
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="input fb-person-picker-search-input"
            autoComplete="off"
            spellCheck="false"
          />
          {searchQuery && (
            <button
              type="button"
              className="fb-person-picker-clear-search-btn"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              <Icon name="close" size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Quick Select Actions and Counts */}
      <div className="fb-person-picker-actions">
        <span className="fb-person-picker-count">
          {selectedPersonIds.length} of {people.length} selected
        </span>
        <div className="fb-person-picker-action-links">
          {onSelectAll && (
            <button
              type="button"
              className="fb-person-picker-link-btn"
              onClick={onSelectAll}
            >
              Select all
            </button>
          )}
          {onClearAll && selectedPersonIds.length > 0 && (
            <button
              type="button"
              className="fb-person-picker-link-btn"
              onClick={onClearAll}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Checklist Rows */}
      <div
        className="fb-person-picker-list"
        role="group"
        aria-label="People checklist"
      >
        {filteredPeople.length === 0 ? (
          <div className="fb-person-picker-empty">
            <p>{emptyMessage}</p>
          </div>
        ) : (
          filteredPeople.map((person) => {
            const isSelected = selectedSet.has(person.id);
            const checkboxId = `person-check-${person.id}`;

            return (
              <label
                key={person.id}
                htmlFor={checkboxId}
                role="checkbox"
                aria-checked={isSelected}
                tabIndex={0}
                onKeyDown={(e) => handleRowKeyDown(e, person.id)}
                className={`fb-person-picker-row ${isSelected ? 'is-selected' : ''}`}
              >
                <input
                  id={checkboxId}
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onTogglePerson(person.id)}
                  tabIndex={-1}
                  className="fb-person-picker-checkbox"
                  aria-label={person.name}
                />
                <span className="fb-person-picker-custom-check" aria-hidden="true">
                  {isSelected && <Icon name="check" size={12} />}
                </span>
                <div className="fb-person-picker-info">
                  <span className="fb-person-picker-name">{person.name}</span>
                  {(person.note || person.email) && (
                    <span className="fb-person-picker-meta">
                      {person.note || person.email}
                    </span>
                  )}
                </div>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
