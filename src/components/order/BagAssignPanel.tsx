import { useMemo, useState, useRef, type KeyboardEvent } from 'react';
import type { Bag, BagSplitMode, Person } from '../../types';
import {
  computeCustomSplit,
  computeEqualSplit,
  disambiguatePersonNames,
} from '../../lib/bagAllocationEditor';
import { Icon } from '../ui/Icon';

export interface BagAssignPanelProps {
  bag: Bag;
  bagIndex: number;
  bagSize: number;
  people: Person[];
  onSave: (buyers: { personId: string; grams: number }[], mode: BagSplitMode) => void;
  onCancel: () => void;
  onAddNewPerson?: () => void;
  isSheet?: boolean;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function BagAssignPanel({
  bag,
  bagIndex,
  bagSize,
  people,
  onSave,
  onCancel,
  onAddNewPerson,
  isSheet = false,
}: BagAssignPanelProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    return bag.buyers.map((b) => b.personId).filter(Boolean);
  });

  const [isCustomMode, setIsCustomMode] = useState<boolean>(() => bag.splitMode === 'custom');

  const [fixedAmounts, setFixedAmounts] = useState<Record<string, number | null>>(() => {
    if (bag.splitMode !== 'custom') return {};
    const map: Record<string, number | null> = {};
    for (const b of bag.buyers) {
      if (b.personId) {
        map[b.personId] = b.grams;
      }
    }
    return map;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  const disambiguated = useMemo(() => disambiguatePersonNames(people), [people]);

  const [decimalNotice, setDecimalNotice] = useState<string | null>(null);

  // Compute allocations based on mode
  const { allocations, balance, state, doneAllowed, helpMessage, adviceMessage } = useMemo(() => {
    if (selectedIds.length === 0) {
      return {
        allocations: {} as Record<string, number>,
        floatingPersonIds: [] as string[],
        balance: bagSize,
        state: 'under' as const,
        doneAllowed: false,
        helpMessage: `Left to give: ${bagSize}g`,
        adviceMessage: 'Bag is unassigned',
      };
    }

    if (!isCustomMode) {
      const split = computeEqualSplit(bagSize, selectedIds);
      const alloc: Record<string, number> = {};
      for (const item of split) {
        alloc[item.personId] = item.grams;
      }
      return {
        allocations: alloc,
        floatingPersonIds: [] as string[],
        balance: 0,
        state: 'exact' as const,
        doneAllowed: true,
        helpMessage: `${bagSize}g of ${bagSize}g`,
        adviceMessage: '',
      };
    }

    return computeCustomSplit(bagSize, selectedIds, fixedAmounts);
  }, [bagSize, selectedIds, isCustomMode, fixedAmounts]);

  function handleTogglePerson(personId: string) {
    if (selectedIds.includes(personId)) {
      const next = selectedIds.filter((id) => id !== personId);
      setSelectedIds(next);
      if (isCustomMode) {
        setFixedAmounts((prev) => {
          const updated = { ...prev };
          delete updated[personId];
          return updated;
        });
      }
    } else {
      setSelectedIds([...selectedIds, personId]);
    }
  }

  function handleCustomGramChange(personId: string, rawVal: string) {
    const val = rawVal.trim();
    if (val === '') {
      setFixedAmounts((prev) => ({ ...prev, [personId]: null }));
      return;
    }
    const num = parseFloat(val);
    setFixedAmounts((prev) => ({ ...prev, [personId]: isNaN(num) ? null : Math.max(0, num) }));
  }

  function handleCustomGramBlur(personId: string, rawVal: string) {
    const val = rawVal.trim();
    if (val === '') return;
    const num = parseFloat(val);
    if (!isNaN(num)) {
      const rounded = Math.max(0, Math.round(num));
      if (!Number.isInteger(num)) {
        setDecimalNotice(`Amounts must be whole grams. Rounded to ${rounded}g.`);
        setTimeout(() => setDecimalNotice(null), 3500);
      }
      setFixedAmounts((prev) => ({ ...prev, [personId]: rounded }));
    }
  }

  function handleSwitchToEqual() {
    setIsCustomMode(false);
    setFixedAmounts({});
    setDecimalNotice(null);
  }

  function handleSwitchToCustom() {
    // Prime fixed amounts with current equal values
    const map: Record<string, number | null> = {};
    for (const id of selectedIds) {
      map[id] = allocations[id] ?? null;
    }
    setFixedAmounts(map);
    setIsCustomMode(true);
  }

  function handleDone() {
    if (!doneAllowed) return;

    let mode: BagSplitMode = 'unassigned';
    if (selectedIds.length === 1) {
      mode = 'full';
    } else if (isCustomMode) {
      mode = 'custom';
    } else {
      mode = 'equal';
    }

    const buyers = selectedIds.map((personId) => ({
      personId,
      grams: allocations[personId] ?? 0,
    }));

    onSave(buyers, mode);
  }

  function handleListKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
      return;
    }
    if (e.key === 'Enter' && doneAllowed) {
      e.preventDefault();
      handleDone();
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const rows = listRef.current?.querySelectorAll<HTMLElement>('.fb-assign-person-row');
      if (!rows || rows.length === 0) return;
      const active = document.activeElement as HTMLElement | null;
      let currentIndex = -1;
      rows.forEach((r, idx) => {
        if (r === active) currentIndex = idx;
      });
      if (e.key === 'ArrowDown') {
        const next = currentIndex + 1 < rows.length ? currentIndex + 1 : 0;
        rows[next]?.focus();
      } else {
        const prev = currentIndex - 1 >= 0 ? currentIndex - 1 : rows.length - 1;
        rows[prev]?.focus();
      }
    }
  }

  const filteredPeople = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return people;
    return people.filter((p) => {
      const name = p.name.toLowerCase();
      const note = p.note ? p.note.toLowerCase() : '';
      const email = p.email ? p.email.toLowerCase() : '';
      return name.includes(q) || note.includes(q) || email.includes(q);
    });
  }, [people, searchQuery]);

  return (
    <div
      className={`fb-bag-assign-panel ${isSheet ? 'is-in-sheet' : ''}`}
      onKeyDown={handleListKeyDown}
      role="region"
      aria-label={`Bag ${bagIndex + 1} assignment`}
    >
      {/* Search box if more than 6 people */}
      {people.length > 6 && (
        <div className="fb-assign-search-bar">
          <span className="fb-assign-search-icon" aria-hidden="true">
            <Icon name="search" size={14} />
          </span>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search people..."
            className="input fb-assign-search-input"
          />
        </div>
      )}

      {/* Mode toggle link */}
      <div className="fb-assign-mode-toggle">
        <span className="fb-assign-mode-label">
          {isCustomMode ? 'Custom amounts' : 'Equal split'}
        </span>
        {selectedIds.length > 1 && (
          <div>
            {isCustomMode ? (
              <button
                type="button"
                className="fb-assign-mode-link"
                onClick={handleSwitchToEqual}
              >
                Split equally again
              </button>
            ) : (
              <button
                type="button"
                className="fb-assign-mode-link"
                onClick={handleSwitchToCustom}
              >
                Change amounts
              </button>
            )}
          </div>
        )}
      </div>

      {decimalNotice && (
        <div className="alert alert-info" style={{ padding: '6px 12px', fontSize: 'var(--text-xs)', marginBottom: 'var(--space-2)' }}>
          {decimalNotice}
        </div>
      )}

      {/* 64px compact person checklist */}
      <div
        ref={listRef}
        className="fb-assign-people-list"
        role="group"
        aria-label="Assign bag to members"
      >
        {filteredPeople.map((person) => {
          const isSelected = selectedIds.includes(person.id);
          const grams = allocations[person.id];
          const isFixed = isCustomMode && fixedAmounts[person.id] !== null && fixedAmounts[person.id] !== undefined;
          const displayName = disambiguated[person.id] || person.name;

          return (
            <div
              key={person.id}
              tabIndex={0}
              className={`fb-assign-person-row ${isSelected ? 'is-selected' : ''}`}
              onClick={() => handleTogglePerson(person.id)}
              onKeyDown={(e) => {
                if (e.key === ' ') {
                  e.preventDefault();
                  handleTogglePerson(person.id);
                }
              }}
              role="checkbox"
              aria-checked={isSelected}
              aria-label={displayName}
            >
              <div className="fb-assign-person-lead">
                <span className="fb-assign-checkbox" aria-hidden="true">
                  {isSelected && <Icon name="check" size={12} />}
                </span>
                <span className="fb-assign-avatar" aria-hidden="true">
                  {getInitials(person.name)}
                </span>
                <div className="fb-assign-person-info">
                  <span className="fb-assign-person-name">{displayName}</span>
                  {isSelected && isCustomMode && !isFixed && (
                    <span className="fb-assign-person-sub">shares the rest</span>
                  )}
                  {(!isSelected || !isCustomMode || isFixed) && person.note && (
                    <span className="fb-assign-person-sub">{person.note}</span>
                  )}
                </div>
              </div>

              {isSelected && (
                <div
                  className="fb-assign-grams-cell"
                  onClick={(e) => e.stopPropagation()}
                >
                  {isCustomMode ? (
                    <>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        className="input fb-assign-gram-input"
                        value={fixedAmounts[person.id] ?? (grams !== undefined ? grams : '')}
                        onChange={(e) => handleCustomGramChange(person.id, e.target.value)}
                        onBlur={(e) => handleCustomGramBlur(person.id, e.target.value)}
                        aria-label={`${displayName} grams`}
                      />
                      <span className="fb-assign-gram-unit">g</span>
                    </>
                  ) : (
                    <span className="fb-assign-grams-pill">
                      {grams !== undefined ? `${grams}g` : '—'}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Live balance bar */}
      <div
        className={`fb-assign-balance-bar is-${state}`}
        aria-live="polite"
      >
        <div className="fb-assign-balance-msg">
          <Icon name={state === 'exact' ? 'check' : 'warning'} size={14} />
          <span className="fb-assign-balance-text">{helpMessage}</span>
          {adviceMessage ? <span className="fb-assign-balance-advice"> · {adviceMessage}</span> : null}
        </div>
      </div>

      {/* Footer controls */}
      <div className="fb-assign-footer">
        {onAddNewPerson ? (
          <button
            type="button"
            className="fb-assign-add-btn"
            onClick={onAddNewPerson}
          >
            <Icon name="plus" size={12} />
            <span>Add person</span>
          </button>
        ) : <div />}

        <div className="fb-assign-btn-group">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleDone}
            disabled={!doneAllowed}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
