import type { ChangeEvent } from 'react';
import type { Bag } from '../../types';
import { createEmptyBags } from '../../lib/allocationInference';
import { getListCurrencySymbol } from '../../lib/listPriceFormat';

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
  currencyCode?: string | null;
  onChange: (form: LotFormState) => void;
  onSaveAndAssign?: () => void;
  onSaveLater: () => void;
  onCancel: () => void;
}

export function LotEditorForm({
  form,
  error,
  isNew,
  currencyCode,
  onChange,
  onSaveAndAssign,
  onSaveLater,
  onCancel,
}: LotEditorFormProps) {
  function setField(key: keyof LotFormState) {
    return (e: ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      const nextForm = { ...form, [key]: val };

      // Resize bags when bag count changes
      if (key === 'initialBagCount') {
        const rawCount = val.trim();
        const parsedCount = parseInt(rawCount, 10);
        if (!isNaN(parsedCount) && parsedCount > 0) {
          nextForm.bags = form.bags.length < parsedCount
            ? [...form.bags, ...createEmptyBags(parsedCount - form.bags.length)]
            : form.bags.slice(0, parsedCount);
        }
      }

      onChange(nextForm);
    };
  }

  const currencySymbol = getListCurrencySymbol(currencyCode);

  return (
    <div className="lot-editor-form-stack">
      <div className="field">
        <label className="field-label" htmlFor="coffee-name-input">Coffee name *</label>
        <input
          id="coffee-name-input"
          className="input"
          value={form.name}
          onChange={setField('name')}
          placeholder="e.g. Pastel Hour, Gesha Spirits, Caballero"
          autoFocus
        />
      </div>

      <div className="lot-specs-grid">
        <div className="field">
          <label className="field-label" htmlFor="coffee-price-input">Price per bag *</label>
          <div className="fb-currency-input-wrap">
            {currencySymbol && (
              <span className="fb-currency-prefix" aria-hidden="true">
                {currencySymbol}
              </span>
            )}
            <input
              id="coffee-price-input"
              className="input num-cell"
              type="number"
              value={form.foreignPricePerBag}
              onChange={setField('foreignPricePerBag')}
              min="0.01"
              step="0.01"
              placeholder="18.50"
            />
          </div>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="coffee-grams-input">Grams per bag *</label>
          <input
            id="coffee-grams-input"
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
          <label className="field-label" htmlFor="coffee-bags-input">Bags *</label>
          <input
            id="coffee-bags-input"
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

      {error && <div className="alert alert-error">{error}</div>}

      <div className="lot-editor-actions">
        {isNew ? (
          <>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onSaveAndAssign || onSaveLater}
            >
              Choose who gets each bag
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onSaveLater}
            >
              Do this later
            </button>
            <button type="button" className="btn btn-ghost" onClick={onCancel}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-primary" onClick={onSaveLater}>
              Save changes
            </button>
            <button type="button" className="btn btn-ghost" onClick={onCancel}>
              Cancel
            </button>
          </>
        )}
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

        .fb-currency-input-wrap {
          display: flex;
          align-items: center;
          position: relative;
        }

        .fb-currency-prefix {
          position: absolute;
          left: 10px;
          color: var(--color-text-muted);
          font-weight: 600;
          font-size: var(--text-sm);
          pointer-events: none;
          z-index: 1;
        }

        .fb-currency-input-wrap .input {
          padding-left: var(--space-6);
          width: 100%;
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
