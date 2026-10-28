import type { ChangeEvent } from 'react';
import type { Bag, Person } from '../../types';
import { formatGrams } from '../../lib/formatters';
import {
  createEmptyBags,
  formatCompactAllocationSummary,
  syncLotWithSelectedBuyers,
} from '../../lib/allocationInference';
import { Icon } from '../ui/Icon';

export interface LotFormState {
  name: string;
  foreignPricePerBag: string;
  gramsPerBag: string;
  initialBagCount: string;
  selectedBuyerIds: string[];
  bags: Bag[];
}

export interface LotEditorFormProps {
  form: LotFormState;
  error: string;
  isNew: boolean;
  people: Person[];
  personNameMap: Record<string, string>;
  onChange: (form: LotFormState) => void;
  onSave: () => void;
  onCancel: () => void;
  onAddNewPerson: () => void;
}

export function LotEditorForm({
  form,
  error,
  isNew,
  people,
  personNameMap,
  onChange,
  onSave,
  onCancel,
  onAddNewPerson,
}: LotEditorFormProps) {
  function setField(key: keyof LotFormState) {
    return (e: ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      const nextForm = { ...form, [key]: val };

      // Live inference sync when bag count or grams change
      if (key === 'initialBagCount' || key === 'gramsPerBag') {
        const rawCount = (key === 'initialBagCount' ? val : form.initialBagCount).trim();
        const parsedCount = parseInt(rawCount, 10);
        const grams = parseInt(key === 'gramsPerBag' ? val : form.gramsPerBag, 10) || 250;
        if (!isNaN(parsedCount) && parsedCount > 0) {
          const resizedBags = form.bags.length < parsedCount
            ? [...form.bags, ...createEmptyBags(parsedCount - form.bags.length)]
            : form.bags.slice(0, parsedCount);
          nextForm.bags = syncLotWithSelectedBuyers(resizedBags, form.selectedBuyerIds, grams);
        }
      }

      onChange(nextForm);
    };
  }

  function handleToggleBuyer(personId: string) {
    const isSelected = form.selectedBuyerIds.includes(personId);
    const nextBuyers = isSelected
      ? form.selectedBuyerIds.filter((id) => id !== personId)
      : [...form.selectedBuyerIds, personId];

    const bagCount = parseInt(form.initialBagCount, 10) || 1;
    const grams = parseInt(form.gramsPerBag, 10) || 250;
    const resizedBags = form.bags.length < bagCount
      ? [...form.bags, ...createEmptyBags(bagCount - form.bags.length)]
      : form.bags.slice(0, bagCount);

    const nextBags = syncLotWithSelectedBuyers(resizedBags, nextBuyers, grams);
    onChange({
      ...form,
      selectedBuyerIds: nextBuyers,
      bags: nextBags,
    });
  }

  const bagCount = parseInt(form.initialBagCount, 10) || 1;
  const grams = parseInt(form.gramsPerBag, 10) || 250;
  const compactSummary = formatCompactAllocationSummary(form.bags, grams, personNameMap);

  return (
    <div className="lot-editor-form-stack">
      <div className="field">
        <label className="field-label">Coffee name *</label>
        <input
          className="input"
          value={form.name}
          onChange={setField('name')}
          placeholder="e.g. Pastel Hour, Gesha Spirits, Caballero"
          autoFocus
        />
      </div>

      <div className="lot-specs-grid">
        <div className="field">
          <label className="field-label">Price per bag *</label>
          <input
            className="input num-cell"
            type="number"
            value={form.foreignPricePerBag}
            onChange={setField('foreignPricePerBag')}
            min="0.01"
            step="0.01"
            placeholder="18.50"
          />
        </div>

        <div className="field">
          <label className="field-label">Grams per bag *</label>
          <input
            className="input num-cell"
            type="number"
            value={form.gramsPerBag}
            onChange={setField('gramsPerBag')}
            min="1"
            step="1"
            placeholder="250"
          />
        </div>

        <div className="field">
          <label className="field-label">Bags *</label>
          <input
            className="input num-cell"
            type="number"
            value={form.initialBagCount}
            onChange={setField('initialBagCount')}
            min="1"
            step="1"
            placeholder="1"
          />
        </div>
      </div>

      {/* Buyers Selector */}
      <div className="field buyer-field">
        <label className="field-label buyer-chips-label">Buyers</label>
        <div className="buyer-chips-wrap">
          {people.map((p) => {
            const isSelected = form.selectedBuyerIds.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                className={`buyer-chip ${isSelected ? 'is-selected' : ''}`}
                onClick={() => handleToggleBuyer(p.id)}
              >
                <Icon name={isSelected ? 'check' : 'plus'} size={12} />
                <span>{p.name}</span>
              </button>
            );
          })}
          <button
            type="button"
            className="buyer-chip buyer-chip-add"
            onClick={onAddNewPerson}
          >
            <Icon name="plus" size={12} />
            <span>Add person</span>
          </button>
        </div>

        {/* Live Inferred Allocation Preview */}
        <div className="lot-editor-preview">
          <span className="lot-editor-preview-label">Who gets what:</span>
          <span className="num-cell">
            {bagCount} × {formatGrams(grams)} · {compactSummary}
          </span>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="lot-editor-actions">
        <button type="button" className="btn btn-primary" onClick={onSave}>
          {isNew ? 'Create coffee' : 'Save changes'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>

      <style>{`
        .lot-editor-form-stack {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .lot-specs-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
          gap: var(--space-3);
        }

        .buyer-field {
          margin: 0;
        }

        .buyer-chips-label {
          margin-bottom: 6px;
        }

        .lot-editor-preview {
          margin-top: var(--space-2);
          padding: 8px 12px;
          background: var(--color-surface-raised);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          font-size: 0.8125rem;
          color: var(--color-text-secondary);
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .lot-editor-preview-label {
          font-weight: 700;
          color: var(--color-accent);
        }

        .lot-editor-actions {
          display: flex;
          gap: var(--space-3);
          flex-wrap: wrap;
          margin-top: var(--space-1);
        }
      `}</style>
    </div>
  );
}
