import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Order, Fee, FeeAllocationType } from '../../types';
import { useAppStore } from '../../store/appStore';
import { formatZAR, parseMoneyInput } from '../../lib/formatters';
import { normalizeFeeAllocationType } from '../../lib/invoiceFormatter';
import { isOrderLocked } from '../../lib/orderLifecycle';
import { ConfirmModal } from '../ui/ConfirmModal';
import { Icon } from '../ui/Icon';

function genId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

const HUMAN_FEE_OPTIONS: {
  value: FeeAllocationType;
  title: string;
  subtitle: string;
}[] = [
  {
    value: 'equal_per_person',
    title: 'Split equally between everyone',
    subtitle: 'Fixed charges (e.g. DHL disbursement fee, shared base delivery)',
  },
  {
    value: 'proportional_by_value',
    title: 'Split according to coffee order value',
    subtitle: 'Value-based charges (e.g. customs import duties, VAT)',
  },
  {
    value: 'specific_person',
    title: 'Charge one person only',
    subtitle: 'Individual charge (e.g. local PUDO courier for a specific friend)',
  },
];

interface Props {
  order: Order;
  registerCommit?: (commit: (() => Promise<void>) | null) => void;
  onOrderChange?: (patch: Partial<Order>) => void | Promise<void>;
}

export function GoodsAndFees({ order, registerCommit, onOrderChange }: Props) {
  const { people, updateOrder } = useAppStore(
    useShallow((s) => ({
      people: s.people,
      updateOrder: s.updateOrder,
    }))
  );
  const patchOrder = onOrderChange ?? ((patch: Partial<Order>) => updateOrder(order.id, patch));
  const isLocked = !onOrderChange && isOrderLocked(order);

  const [goodsInput, setGoodsInput] = useState(order.goodsTotalZar > 0 ? String(order.goodsTotalZar) : '');
  const [editingFeeId, setEditingFeeId] = useState<string | 'new' | null>(null);
  const [feeLabel, setFeeLabel] = useState('');
  const [feeAmount, setFeeAmount] = useState('');
  const [feeType, setFeeType] = useState<FeeAllocationType>('equal_per_person');
  const [feePersonId, setFeePersonId] = useState('');
  const [feeError, setFeeError] = useState('');
  const [deleteFeeTarget, setDeleteFeeTarget] = useState<Fee | null>(null);

  const totalFees = order.fees.reduce((s, f) => s + (f.amountZar || 0), 0);
  const grandTotal = (order.goodsTotalZar || 0) + totalFees;

  useEffect(() => {
    setGoodsInput(order.goodsTotalZar > 0 ? String(order.goodsTotalZar) : '');
  }, [order.id, order.goodsTotalZar]);

  useEffect(() => {
    registerCommit?.(flushGoodsSave);
    return () => registerCommit?.(null);
  }, [registerCommit, goodsInput, order.id, order.goodsTotalZar]);

  function saveGoods() {
    if (isLocked) return;
    const val = parseMoneyInput(goodsInput);
    if (val >= 0 && goodsInput.trim() !== '') {
      if (val !== order.goodsTotalZar) {
        void patchOrder({ goodsTotalZar: val });
      }
      return;
    }
    if (!goodsInput.trim() && order.goodsTotalZar !== 0) {
      void patchOrder({ goodsTotalZar: 0 });
    }
  }

  async function flushGoodsSave() {
    if (isLocked) return;
    const val = parseMoneyInput(goodsInput);
    if (val >= 0 && goodsInput.trim() !== '' && val !== order.goodsTotalZar) {
      await patchOrder({ goodsTotalZar: val });
      return;
    }
    if (!goodsInput.trim() && order.goodsTotalZar !== 0) {
      await patchOrder({ goodsTotalZar: 0 });
    }
  }

  function openNewFee() {
    setFeeLabel('');
    setFeeAmount('');
    setFeeType('equal_per_person');
    setFeePersonId('');
    setFeeError('');
    setEditingFeeId('new');
  }

  function openEditFee(fee: Fee) {
    setFeeLabel(fee.label);
    setFeeAmount(String(fee.amountZar));
    setFeeType(normalizeFeeAllocationType(fee.allocationType));
    setFeePersonId(fee.personId || '');
    setFeeError('');
    setEditingFeeId(fee.id);
  }

  function saveFee() {
    if (isLocked) return;
    setFeeError('');
    const trimmedLabel = feeLabel.trim();
    if (!trimmedLabel) {
      setFeeError('Fee name is required.');
      return;
    }
    const parsedAmount = parseMoneyInput(feeAmount);
    if (parsedAmount <= 0) {
      setFeeError('Fee amount must be greater than zero.');
      return;
    }
    if (feeType === 'specific_person' && !feePersonId) {
      setFeeError('Please select a person to pay this fee.');
      return;
    }

    const newFee: Fee = {
      id: editingFeeId === 'new' ? genId() : (editingFeeId as string),
      label: trimmedLabel,
      amountZar: parsedAmount,
      allocationType: feeType,
      personId: feeType === 'specific_person' ? feePersonId : undefined,
    };

    let updatedFees: Fee[];
    if (editingFeeId === 'new') {
      updatedFees = [...order.fees, newFee];
    } else {
      updatedFees = order.fees.map((f) => (f.id === editingFeeId ? newFee : f));
    }

    void patchOrder({ fees: updatedFees });
    setEditingFeeId(null);
  }

  function confirmDeleteFee() {
    if (!deleteFeeTarget || isLocked) return;
    void patchOrder({ fees: order.fees.filter((f) => f.id !== deleteFeeTarget.id) });
    setDeleteFeeTarget(null);
  }

  return (
    <div className="wizard-step-stack">
      {/* Goods Total Section */}
      <section className="wizard-panel">
        <div className="wizard-card-header">
          <div>
            <h2 className="wizard-card-title">Order goods total (ZAR)</h2>
            <p className="wizard-card-copy">
              The final converted amount charged to your card for the coffee goods.
            </p>
          </div>
        </div>

        <div className="field goods-input-field">
          <label className="field-label" htmlFor="order-goods-total-zar">
            Total coffee goods (ZAR) *
          </label>
          <div className="goods-input-container">
            <span className="goods-zar-prefix" aria-hidden="true">
              R
            </span>
            <input
              id="order-goods-total-zar"
              className="input goods-total-prominent-input num-cell"
              type="text"
              inputMode="decimal"
              value={goodsInput}
              onChange={(e) => setGoodsInput(e.target.value)}
              onBlur={saveGoods}
              placeholder="e.g. 1850.00"
              disabled={isLocked}
            />
          </div>
          <div className="field-hint goods-field-hint">
            <Icon name="info" size={14} className="goods-hint-icon" />
            <span>This is the final converted total paid to the foreign roaster in ZAR. Each coffee and member share is calculated from this amount.</span>
          </div>
        </div>
      </section>

      {/* Fees List Section */}
      <section className="wizard-panel">
        <div className="wizard-card-header">
          <div>
            <h2 className="wizard-card-title">Additional fees</h2>
            <p className="wizard-card-copy">
              Shipping, foreign transaction fees, customs duties, or handling charges.
            </p>
          </div>
          {editingFeeId === null && !isLocked && (
            <button className="btn btn-secondary btn-sm" type="button" onClick={openNewFee}>
              <Icon name="plus" size={14} /> Add fee
            </button>
          )}
        </div>

        {/* Inline Add / Edit Fee Form */}
        {editingFeeId !== null && (
          <div className="wizard-subsection">
            <div className="wizard-subsection-header">
              <div className="wizard-card-title">
                {editingFeeId === 'new' ? 'Add fee' : 'Edit fee'}
              </div>
            </div>

            <div className="wizard-card-grid">
              <div className="field">
                <label className="field-label" htmlFor="fee-label-input">Fee name / description *</label>
                <input
                  id="fee-label-input"
                  className="input"
                  type="text"
                  placeholder="e.g. DHL Express Shipping"
                  value={feeLabel}
                  onChange={(e) => setFeeLabel(e.target.value)}
                />
              </div>

              <div className="field">
                <label className="field-label" htmlFor="fee-amount-input">Amount (ZAR) *</label>
                <div className="goods-input-container">
                  <span className="fee-input-prefix" aria-hidden="true">R</span>
                  <input
                    id="fee-amount-input"
                    className="input fee-input-with-prefix num-cell"
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 240.00"
                    value={feeAmount}
                    onChange={(e) => setFeeAmount(e.target.value)}
                  />
                </div>
              </div>

              {/* Fee Allocation Options */}
              <div className="field fee-options-span">
                <label className="field-label">How to split this fee</label>
                <div className="fee-options-stack">
                  {HUMAN_FEE_OPTIONS.map((opt) => {
                    const isSelected = feeType === opt.value;
                    return (
                      <label
                        key={opt.value}
                        className={`fee-option-card ${isSelected ? 'is-selected' : ''}`}
                      >
                        <input
                          type="radio"
                          name="feeAllocationType"
                          value={opt.value}
                          checked={isSelected}
                          onChange={() => setFeeType(opt.value)}
                          className="fee-radio-input"
                        />
                        <div>
                          <div className="fee-option-title">
                            {opt.title}
                          </div>
                          <div className="fee-option-subtitle">
                            {opt.subtitle}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Person Picker for Specific Person */}
              {normalizeFeeAllocationType(feeType) === 'specific_person' && (
                <div className="field">
                  <label className="field-label">Who should pay this fee? *</label>
                  <select
                    className="input"
                    value={feePersonId}
                    onChange={(e) => setFeePersonId(e.target.value)}
                  >
                    <option value="">Choose person...</option>
                    {people.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {feeError && <div className="alert alert-error">{feeError}</div>}

              <div className="fee-form-actions">
                <button type="button" className="btn btn-primary" onClick={saveFee}>
                  {editingFeeId === 'new' ? 'Add fee' : 'Save fee'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setEditingFeeId(null)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Existing Fees List */}
        {order.fees.length === 0 ? (
          <p className="fees-empty-text">
            No additional fees added yet. If there are customs, shipping, or courier costs, click "+ Add fee".
          </p>
        ) : (
          <div className="table-responsive">
            <table className="fees-table">
              <thead>
                <tr>
                  <th className="cell-left">Fee description</th>
                  <th className="fee-col-method">Split type</th>
                  <th className="fee-col-amount">Amount (ZAR)</th>
                  {!isLocked && <th className="fee-col-actions">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {order.fees.map((fee) => {
                  const canonicalType = normalizeFeeAllocationType(fee.allocationType);
                  const targetPerson = fee.personId ? people.find((p) => p.id === fee.personId) : null;
                  let badgeLabel = 'Split equally';
                  let badgeClass = 'badge-equal';
                  if (canonicalType === 'proportional_by_value') {
                    badgeLabel = 'Split by coffee value';
                    badgeClass = 'badge-proportional';
                  } else if (canonicalType === 'specific_person') {
                    badgeLabel = targetPerson ? `Assigned to ${targetPerson.name}` : 'Assigned to person';
                    badgeClass = 'badge-person';
                  }

                  return (
                    <tr key={fee.id}>
                      <td>
                        <strong className="fee-name">{fee.label}</strong>
                      </td>
                      <td>
                        <span className={`fee-allocation-badge ${badgeClass}`}>
                          {badgeLabel}
                        </span>
                      </td>
                      <td className="fee-col-amount num-cell fee-amount-cell">
                        {formatZAR(fee.amountZar)}
                      </td>
                      {!isLocked && (
                        <td className="fee-col-actions">
                          <div className="fee-row-actions">
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs"
                              onClick={() => openEditFee(fee)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs btn-danger-text"
                              onClick={() => setDeleteFeeTarget(fee)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Running Totals Ledger Section */}
      <section className="wizard-panel goods-ledger-card">
        <div className="section-label ledger-header-label">Order financial ledger</div>
        <div className="ledger-table-wrap">
          <table className="ledger-table">
            <tbody>
              <tr>
                <td className="ledger-label">Goods subtotal (foreign coffee converted)</td>
                <td className="ledger-value num-cell">
                  {formatZAR(order.goodsTotalZar || 0)}
                </td>
              </tr>
              <tr>
                <td className="ledger-label">
                  Additional fees subtotal ({order.fees.length} {order.fees.length === 1 ? 'fee' : 'fees'})
                </td>
                <td className="ledger-value num-cell">
                  {formatZAR(totalFees)}
                </td>
              </tr>
              <tr className="ledger-grand-total-row">
                <td className="ledger-label-total">Grand total (ZAR)</td>
                <td className="ledger-value-total num-cell">
                  {formatZAR(grandTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Delete Fee Confirm Modal */}
      {deleteFeeTarget && (
        <ConfirmModal
          isOpen={true}
          title={`Remove "${deleteFeeTarget.label}"?`}
          description={`Are you sure you want to remove this ${formatZAR(deleteFeeTarget.amountZar)} fee from the order?`}
          confirmText="Remove fee"
          cancelText="Cancel"
          variant="danger"
          onConfirm={confirmDeleteFee}
          onCancel={() => setDeleteFeeTarget(null)}
        />
      )}

      <style>{`
        .goods-input-field {
          max-width: 420px;
        }

        .goods-input-container {
          position: relative;
        }

        .goods-zar-prefix {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--color-accent);
          font-weight: 700;
          font-size: 1.125rem;
          pointer-events: none;
        }

        .goods-total-prominent-input {
          padding-left: 36px;
          font-size: 1.25rem;
          font-weight: 700;
          height: 48px;
        }

        .goods-field-hint {
          display: flex;
          align-items: flex-start;
          gap: var(--space-2);
          margin-top: var(--space-2);
          font-size: var(--text-sm);
          color: var(--color-text-secondary);
        }

        .goods-hint-icon {
          flex-shrink: 0;
          margin-top: 2px;
          color: var(--color-text-muted);
        }

        .fee-input-prefix {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--color-text-muted);
          font-weight: 700;
          pointer-events: none;
        }

        .fee-input-with-prefix {
          padding-left: 28px;
        }

        .fee-options-span {
          grid-column: 1 / -1;
        }

        .fee-options-stack {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .fee-radio-input {
          margin-top: 3px;
        }

        .fee-option-title {
          font-weight: 600;
          font-size: var(--text-md);
          color: var(--color-text-primary);
        }

        .fee-option-subtitle {
          font-size: var(--text-xs);
          color: var(--color-text-muted);
          margin-top: 2px;
        }

        .fee-form-actions {
          display: flex;
          gap: var(--space-3);
          flex-wrap: wrap;
          grid-column: 1 / -1;
        }

        .fee-option-card {
          display: flex;
          align-items: flex-start;
          gap: var(--space-3);
          padding: 10px 12px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--color-border);
          background: var(--color-surface);
          cursor: pointer;
          transition: background-color 120ms ease-out, border-color 120ms ease-out;
        }

        .fee-option-card:hover {
          border-color: color-mix(in srgb, var(--color-accent) 40%, var(--color-border));
          background: var(--color-surface-raised);
        }

        .fee-option-card.is-selected {
          border-color: var(--color-accent);
          background: var(--color-accent-light);
        }

        .fees-empty-text {
          color: var(--color-text-muted);
          font-size: var(--text-md);
        }

        /* Fees table styles */
        .fees-table {
          width: 100%;
          border-collapse: collapse;
          font-size: var(--text-md);
        }

        .fees-table th {
          padding: 8px 12px;
          border-bottom: 2px solid var(--color-border);
          color: var(--color-text-muted);
          font-size: var(--text-xs);
          font-weight: 600;
        }

        .cell-left {
          text-align: left;
        }

        .fee-col-method {
          text-align: left;
          width: 220px;
        }

        .fee-col-amount {
          text-align: right;
          width: 140px;
        }

        .fee-col-actions {
          text-align: right;
          width: 130px;
        }

        .fee-amount-cell {
          font-weight: 700;
        }

        .fee-row-actions {
          display: inline-flex;
          gap: var(--space-1);
          justify-content: flex-end;
        }

        .fees-table td {
          padding: 10px 12px;
          border-bottom: 1px solid var(--color-border);
          color: var(--color-text-primary);
        }

        .fees-table tbody tr:hover {
          background: var(--color-surface-raised);
        }

        .fee-allocation-badge {
          display: inline-flex;
          align-items: center;
          padding: 2px 8px;
          border-radius: var(--radius-sm);
          font-size: var(--text-xs);
          font-weight: 600;
        }

        .fee-allocation-badge.badge-equal {
          background: color-mix(in srgb, var(--color-accent) 12%, var(--color-surface));
          color: var(--color-accent);
          border: 1px solid color-mix(in srgb, var(--color-accent) 25%, transparent);
        }

        .fee-allocation-badge.badge-proportional {
          background: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface));
          color: var(--color-primary);
          border: 1px solid color-mix(in srgb, var(--color-primary) 25%, transparent);
        }

        .fee-allocation-badge.badge-person {
          background: color-mix(in srgb, var(--color-warning) 15%, var(--color-surface));
          color: var(--color-warning);
          border: 1px solid color-mix(in srgb, var(--color-warning) 30%, transparent);
        }

        /* Ledger card */
        .goods-ledger-card {
          background: var(--color-surface-raised);
          border: 1px solid var(--color-border);
        }

        .ledger-header-label {
          margin-bottom: var(--space-3);
        }

        .ledger-table-wrap {
          overflow-x: auto;
        }

        .ledger-table {
          width: 100%;
          border-collapse: collapse;
          font-size: var(--text-md);
        }

        .ledger-table td {
          padding: 8px 12px;
          border-bottom: 1px solid var(--color-border);
        }

        .ledger-label {
          color: var(--color-text-secondary);
        }

        .ledger-value {
          text-align: right;
          font-weight: 600;
          color: var(--color-text-primary);
        }

        .ledger-grand-total-row td {
          border-bottom: none;
          padding-top: 12px;
          padding-bottom: 12px;
        }

        .ledger-label-total {
          font-size: var(--text-base);
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .ledger-value-total {
          text-align: right;
          font-size: var(--text-xl);
          font-weight: 700;
          color: var(--color-accent);
          font-family: var(--font-body);
        }
      `}</style>
    </div>
  );
}
