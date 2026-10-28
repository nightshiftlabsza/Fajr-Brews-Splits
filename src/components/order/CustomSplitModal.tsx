import { useState, useEffect } from 'react';
import type { Bag, CoffeeLot, Person } from '../../types';
import { formatGrams } from '../../lib/formatters';
import { Icon } from '../ui/Icon';

export interface CustomSplitModalProps {
  isOpen: boolean;
  lot: CoffeeLot;
  bag: Bag;
  people: Person[];
  onSave: (buyers: { personId: string; grams: number }[]) => void;
  onCancel: () => void;
}

export function CustomSplitModal({
  isOpen,
  lot,
  bag,
  people,
  onSave,
  onCancel,
}: CustomSplitModalProps) {
  const [gramMap, setGramMap] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const b of bag.buyers) {
      if (b.personId) map[b.personId] = String(b.grams || '');
    }
    return map;
  });
  const [error, setError] = useState('');

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCancel();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  if (!isOpen) return null;

  const buyerIds = Object.keys(gramMap);
  const totalGrams = buyerIds.reduce((sum, id) => sum + (parseInt(gramMap[id], 10) || 0), 0);
  const targetGrams = lot.gramsPerBag;
  const remaining = targetGrams - totalGrams;
  const isValid =
    totalGrams === targetGrams &&
    buyerIds.length > 0 &&
    buyerIds.every((id) => (parseInt(gramMap[id], 10) || 0) > 0);

  const availablePeople = people.filter((p) => !buyerIds.includes(p.id));

  function handleAddPersonToSplit(personId: string) {
    if (!personId) return;
    const initialGrams = remaining > 0 ? String(remaining) : '';
    setGramMap((prev) => ({ ...prev, [personId]: initialGrams }));
    setError('');
  }

  function handleRemovePersonFromSplit(personId: string) {
    setGramMap((prev) => {
      const next = { ...prev };
      delete next[personId];
      return next;
    });
    setError('');
  }

  function handleSave() {
    if (!isValid) {
      setError(`Buyer grams must total exactly ${targetGrams}g (currently ${totalGrams}g).`);
      return;
    }
    const buyers = buyerIds.map((personId) => ({
      personId,
      grams: parseInt(gramMap[personId], 10),
    }));
    onSave(buyers);
  }

  return (
    <div className="fb-modal-backdrop" onClick={onCancel} role="dialog" aria-modal="true" aria-labelledby="custom-split-title">
      <div className="fb-modal-card" onClick={(e) => e.stopPropagation()}>
        <h3 id="custom-split-title" className="fb-modal-title">Custom gram split</h3>
        <p className="fb-modal-description custom-split-description">
          Specify exact grams for each person sharing this {formatGrams(targetGrams)} bag of "{lot.name}".
        </p>

        <div className="custom-split-list">
          {buyerIds.map((personId) => {
            const person = people.find((p) => p.id === personId);
            return (
              <div key={personId} className="custom-split-row">
                <span className="custom-split-person-name">{person?.name || 'Unknown'}</span>
                <div className="custom-split-input-group">
                  <input
                    className="input custom-split-gram-input num-cell"
                    type="number"
                    value={gramMap[personId]}
                    onChange={(e) => {
                      setGramMap({ ...gramMap, [personId]: e.target.value });
                      setError('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && isValid) {
                        e.preventDefault();
                        handleSave();
                      }
                    }}
                    min="1"
                    step="1"
                    autoFocus={buyerIds[0] === personId}
                  />
                  <span className="custom-split-unit">g</span>
                  {buyerIds.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs custom-split-remove-btn"
                      onClick={() => handleRemovePersonFromSplit(personId)}
                      aria-label={`Remove ${person?.name || 'person'} from split`}
                      title="Remove person"
                    >
                      <Icon name="close" size={12} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add another person to split */}
        {availablePeople.length > 0 && (
          <div className="custom-split-select-wrap">
            <select
              className="input custom-split-select"
              value=""
              onChange={(e) => handleAddPersonToSplit(e.target.value)}
            >
              <option value="">+ Add person to this split...</option>
              {availablePeople.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Balance indicator */}
        <div className={`custom-split-balance ${isValid ? 'is-valid' : 'is-invalid'}`}>
          {isValid ? (
            <>
              <Icon name="check" size={14} />
              <span>Total: {totalGrams}g of {targetGrams}g (Split matches bag)</span>
            </>
          ) : remaining > 0 ? (
            <span>Total: {totalGrams}g of {targetGrams}g ({remaining}g left to give)</span>
          ) : (
            <span>Total: {totalGrams}g of {targetGrams}g ({Math.abs(remaining)}g over limit)</span>
          )}
        </div>

        {error && <div className="alert alert-error custom-split-error">{error}</div>}

        <div className="custom-split-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={!isValid}>
            Save Custom Split
          </button>
        </div>
      </div>

      <style>{`
        .custom-split-description {
          margin-bottom: var(--space-4);
        }

        .custom-split-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
          margin-bottom: var(--space-4);
        }

        .custom-split-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-3);
        }

        .custom-split-person-name {
          font-weight: 600;
          font-size: 0.875rem;
        }

        .custom-split-input-group {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .custom-split-gram-input {
          width: 90px;
          text-align: right;
        }

        .custom-split-unit {
          font-size: 0.8125rem;
          color: var(--color-text-muted);
        }

        .custom-split-remove-btn {
          color: var(--color-text-muted);
        }

        .custom-split-select-wrap {
          margin-bottom: var(--space-4);
        }

        .custom-split-select {
          font-size: 0.8125rem;
        }

        .custom-split-balance {
          padding: 8px 12px;
          border-radius: var(--radius-sm);
          font-size: 0.8125rem;
          font-weight: 600;
          margin-bottom: var(--space-4);
          font-variant-numeric: tabular-nums;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .custom-split-balance.is-valid {
          background: var(--color-paid-bg);
          border: 1px solid var(--color-paid);
          color: var(--color-paid);
        }

        .custom-split-balance.is-invalid {
          background: var(--color-partial-bg);
          border: 1px solid var(--color-partial);
          color: var(--color-partial);
        }

        .custom-split-error {
          margin-bottom: var(--space-4);
        }

        .custom-split-actions {
          display: flex;
          justify-content: flex-end;
          gap: var(--space-3);
        }
      `}</style>
    </div>
  );
}
