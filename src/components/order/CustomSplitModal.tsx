import { useState } from 'react';
import type { Bag, CoffeeLot, Person } from '../../types';
import { formatGrams } from '../../lib/formatters';

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
        <h3 id="custom-split-title" className="fb-modal-title">Custom Gram Split</h3>
        <p className="fb-modal-description" style={{ marginBottom: 'var(--space-4)' }}>
          Specify exact grams for each person sharing this {formatGrams(targetGrams)} bag of "{lot.name}".
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          {buyerIds.map((personId) => {
            const person = people.find((p) => p.id === personId);
            return (
              <div
                key={personId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--space-3)',
                }}
              >
                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{person?.name || 'Unknown'}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    className="input"
                    type="number"
                    style={{ width: 90, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
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
                  <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>g</span>
                  {buyerIds.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      style={{ color: 'var(--color-text-muted)' }}
                      onClick={() => handleRemovePersonFromSplit(personId)}
                      aria-label={`Remove ${person?.name || 'person'} from split`}
                      title="Remove person"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add another person to split */}
        {availablePeople.length > 0 && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <select
              className="input"
              value=""
              onChange={(e) => handleAddPersonToSplit(e.target.value)}
              style={{ fontSize: '0.8125rem' }}
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
        <div
          style={{
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            background: isValid ? 'var(--color-paid-bg)' : 'var(--color-partial-bg)',
            border: `1px solid ${isValid ? 'var(--color-paid)' : 'var(--color-partial)'}`,
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: isValid ? 'var(--color-paid)' : 'var(--color-partial)',
            marginBottom: 'var(--space-4)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {isValid
            ? `✓ Total: ${totalGrams}g of ${targetGrams}g (Valid split)`
            : remaining > 0
              ? `Total: ${totalGrams}g of ${targetGrams}g (${remaining}g unallocated)`
              : `Total: ${totalGrams}g of ${targetGrams}g (${Math.abs(remaining)}g over limit)`}
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-4)' }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={!isValid}>
            Save Custom Split
          </button>
        </div>
      </div>
    </div>
  );
}
