import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Order, Fee, FeeAllocationType, Person } from '../../types';
import { useAppStore } from '../../store/appStore';
import { formatZAR, parseMoneyInput } from '../../lib/formatters';
import { getFeeAllocationLabel, normalizeFeeAllocationType } from '../../lib/invoiceFormatter';
import { isOrderLocked } from '../../lib/orderLifecycle';
import { ConfirmModal } from '../ui/ConfirmModal';

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
    if (isLocked) return;
    setFeeLabel('');
    setFeeAmount('');
    setFeeType('equal_per_person');
    setFeePersonId('');
    setFeeError('');
    setEditingFeeId('new');
  }

  function openEditFee(fee: Fee) {
    if (isLocked) return;
    setFeeLabel(fee.label);
    setFeeAmount(String(fee.amountZar));
    setFeeType(normalizeFeeAllocationType(fee.allocationType));
    setFeePersonId(fee.personId ?? '');
    setFeeError('');
    setEditingFeeId(fee.id);
  }

  function saveFee() {
    if (isLocked) return;
    if (!feeLabel.trim()) return setFeeError('Fee label is required.');
    const amt = parseMoneyInput(feeAmount);
    if (amt <= 0) return setFeeError('Amount must be greater than zero.');
    if (normalizeFeeAllocationType(feeType) === 'specific_person' && !feePersonId) {
      return setFeeError('Please select who should pay this fee.');
    }
    setFeeError('');

    let updatedFees: Fee[];
    const normalizedType = normalizeFeeAllocationType(feeType);
    const nextFee = {
      label: feeLabel.trim(),
      amountZar: amt,
      allocationType: normalizedType,
      personId: normalizedType === 'specific_person' ? feePersonId : null,
    };

    if (editingFeeId === 'new') {
      updatedFees = [
        ...order.fees,
        { id: genId(), ...nextFee },
      ];
    } else {
      updatedFees = order.fees.map((f) => (f.id === editingFeeId ? { ...f, ...nextFee } : f));
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
      {/* Goods Total Card */}
      <section className="wizard-panel">
        <div className="wizard-card-header">
          <div>
            <h2 className="wizard-card-title">Order Goods Total (ZAR)</h2>
            <p className="wizard-card-copy">
              The final converted amount charged to your card for the coffee goods.
            </p>
          </div>
        </div>

        <div className="field" style={{ maxWidth: 420 }}>
          <label className="field-label" htmlFor="order-goods-total-zar">
            Total Coffee Goods (ZAR) *
          </label>
          <div style={{ position: 'relative' }}>
            <span
              style={{
                position: 'absolute',
                left: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-accent)',
                fontWeight: 700,
                fontSize: '1.125rem',
                pointerEvents: 'none',
              }}
            >
              R
            </span>
            <input
              id="order-goods-total-zar"
              className="input goods-total-prominent-input"
              type="text"
              inputMode="decimal"
              style={{
                paddingLeft: 36,
                fontSize: '1.25rem',
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                height: 48,
              }}
              value={goodsInput}
              onChange={(e) => setGoodsInput(e.target.value)}
              onBlur={saveGoods}
              placeholder="e.g. 1850.00"
              disabled={isLocked}
            />
          </div>
          <div className="field-hint" style={{ marginTop: 'var(--space-2)', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
            ℹ This is the final converted total paid to the foreign roaster in ZAR. Each coffee lot and member share is proportionally calculated from this amount.
          </div>
        </div>
      </section>

      {/* Fees List Card */}
      <section className="wizard-panel">
        <div className="wizard-card-header">
          <div>
            <h2 className="wizard-card-title">Additional Fees</h2>
            <p className="wizard-card-copy">
              Shipping, foreign transaction fees, customs duties, or handling charges.
            </p>
          </div>
          {editingFeeId === null && !isLocked && (
            <button className="btn btn-secondary btn-sm" type="button" onClick={openNewFee}>
              + Add Fee
            </button>
          )}
        </div>

        {/* Inline Add / Edit Fee Form */}
        {editingFeeId !== null && (
          <div className="wizard-subsection" style={{ marginBottom: 'var(--space-4)' }}>
            <div className="wizard-subsection-header">
              <div className="wizard-card-title">
                {editingFeeId === 'new' ? 'Add Fee' : 'Edit Fee'}
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
                  autoFocus
                />
              </div>

              <div className="field">
                <label className="field-label" htmlFor="fee-amount-input">Amount (ZAR) *</label>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute',
                    left: 14,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--color-text-muted)',
                    fontWeight: 700,
                    pointerEvents: 'none',
                  }}>
                    R
                  </span>
                  <input
                    id="fee-amount-input"
                    className="input"
                    type="text"
                    inputMode="decimal"
                    style={{ paddingLeft: 34 }}
                    placeholder="0.00"
                    value={feeAmount}
                    onChange={(e) => setFeeAmount(e.target.value)}
                  />
                </div>
              </div>

              {/* Fee Division Options */}
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <span className="field-label" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>
                  How should this fee be divided? *
                </span>
                <div role="radiogroup" aria-label="Fee allocation method" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {HUMAN_FEE_OPTIONS.map((opt) => {
                    const isSelected = normalizeFeeAllocationType(feeType) === opt.value;
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
                          style={{ marginTop: 3 }}
                        />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>
                            {opt.title}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
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

              <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-primary" onClick={saveFee}>
                  {editingFeeId === 'new' ? 'Add Fee' : 'Save Fee'}
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
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            No additional fees added yet. If there are customs, shipping, or courier costs, click "+ Add Fee".
          </p>
        ) : (
          <div className="table-responsive" style={{ overflowX: 'auto' }}>
            <table className="fees-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Fee Description</th>
                  <th style={{ textAlign: 'left', width: '220px' }}>Allocation Method</th>
                  <th style={{ textAlign: 'right', width: '140px' }}>Amount (ZAR)</th>
                  {!isLocked && <th style={{ textAlign: 'right', width: '130px' }}>Actions</th>}
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
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                        {formatZAR(fee.amountZar)}
                      </td>
                      {!isLocked && (
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 'var(--space-1)', justifyContent: 'flex-end' }}>
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

      {/* Running Totals Ledger Card */}
      <section className="wizard-panel goods-ledger-card">
        <div className="section-label" style={{ marginBottom: 'var(--space-3)' }}>Order Financial Ledger</div>
        <div className="ledger-table-wrap">
          <table className="ledger-table">
            <tbody>
              <tr>
                <td className="ledger-label">Goods Subtotal (Foreign Coffee Converted)</td>
                <td className="ledger-value" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatZAR(order.goodsTotalZar || 0)}
                </td>
              </tr>
              <tr>
                <td className="ledger-label">
                  Additional Fees Subtotal ({order.fees.length} {order.fees.length === 1 ? 'fee' : 'fees'})
                </td>
                <td className="ledger-value" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatZAR(totalFees)}
                </td>
              </tr>
              <tr className="ledger-grand-total-row">
                <td className="ledger-label-total">Grand Total (ZAR)</td>
                <td className="ledger-value-total" style={{ fontVariantNumeric: 'tabular-nums' }}>
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
          confirmText="Remove Fee"
          cancelText="Cancel"
          variant="danger"
          onConfirm={confirmDeleteFee}
          onCancel={() => setDeleteFeeTarget(null)}
        />
      )}

      <style>{`
        .fee-option-card {
          display: flex;
          align-items: flex-start;
          gap: var(--space-3);
          padding: 10px 12px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--color-border);
          background: var(--color-surface);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .fee-option-card:hover {
          border-color: color-mix(in srgb, var(--color-accent) 40%, var(--color-border));
          background: var(--color-surface-raised);
        }

        .fee-option-card.is-selected {
          border-color: var(--color-accent);
          background: var(--color-accent-light);
        }

        /* Fees table styles */
        .fees-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.875rem;
        }

        .fees-table th {
          padding: 8px 12px;
          border-bottom: 2px solid var(--color-border);
          color: var(--color-text-muted);
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
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
          border-radius: 999px;
          font-size: 0.75rem;
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

        .ledger-table-wrap {
          overflow-x: auto;
        }

        .ledger-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.875rem;
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
          font-size: 1rem;
          font-weight: 800;
          color: var(--color-text-primary);
        }

        .ledger-value-total {
          text-align: right;
          font-size: 1.25rem;
          font-weight: 800;
          color: var(--color-accent);
          font-family: var(--font-display);
        }
      `}</style>
    </div>
  );
}
