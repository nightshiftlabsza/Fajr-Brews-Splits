import { useEffect, useState } from 'react';
import type { Order, Fee, FeeAllocationType, Person } from '../../types';
import { useAppStore } from '../../store/appStore';
import { formatZAR } from '../../lib/formatters';
import { getFeeAllocationLabel, normalizeFeeAllocationType } from '../../lib/invoiceFormatter';
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
  const { people, updateOrder } = useAppStore();
  const patchOrder = onOrderChange ?? ((patch: Partial<Order>) => updateOrder(order.id, patch));

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
    const val = parseFloat(goodsInput);
    if (!isNaN(val) && val > 0) {
      void patchOrder({ goodsTotalZar: val });
      return;
    }
    if (!goodsInput.trim() && order.goodsTotalZar !== 0) {
      void patchOrder({ goodsTotalZar: 0 });
    }
  }

  async function flushGoodsSave() {
    const val = parseFloat(goodsInput);
    if (!isNaN(val) && val > 0 && val !== order.goodsTotalZar) {
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
    setFeePersonId(fee.personId ?? '');
    setFeeError('');
    setEditingFeeId(fee.id);
  }

  function saveFee() {
    if (!feeLabel.trim()) return setFeeError('Fee label is required.');
    const amt = parseFloat(feeAmount);
    if (isNaN(amt) || amt <= 0) return setFeeError('Amount must be greater than zero.');
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
    if (!deleteFeeTarget) return;
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

        <div className="field">
          <label className="field-label">Total Coffee Goods (ZAR) *</label>
          <div style={{ position: 'relative', maxWidth: 300 }}>
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
              className="input"
              type="number"
              style={{ paddingLeft: 34, fontSize: '1.125rem', fontWeight: 600 }}
              value={goodsInput}
              onChange={(e) => setGoodsInput(e.target.value)}
              onBlur={saveGoods}
              placeholder="e.g. 1850.00"
              min="0.01"
              step="0.01"
            />
          </div>
        </div>
      </section>

      {/* Fees List Card */}
      <section className="wizard-panel">
        <div className="wizard-card-header">
          <div>
            <h2 className="wizard-card-title">Shipping, Customs & Additional Fees</h2>
            <p className="wizard-card-copy">
              Add customs duties, VAT, courier, or delivery fees. Choose how each fee is fairly divided.
            </p>
          </div>
          {editingFeeId === null && (
            <button className="btn btn-secondary btn-sm" onClick={openNewFee}>
              + Add Fee
            </button>
          )}
        </div>

        {editingFeeId !== null && (
          <div className="card-padded" style={{
            background: 'var(--color-surface-raised)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-4)',
          }}>
            <div className="section-label" style={{ marginBottom: 'var(--space-3)' }}>
              {editingFeeId === 'new' ? 'New Fee' : 'Edit Fee'}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="grid-2">
                <div className="field">
                  <label className="field-label">Fee Label *</label>
                  <input
                    className="input"
                    value={feeLabel}
                    onChange={(e) => setFeeLabel(e.target.value)}
                    placeholder="e.g. DHL Clearance, Customs VAT, Local PUDO"
                    autoFocus
                  />
                </div>

                <div className="field">
                  <label className="field-label">Amount (ZAR) *</label>
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
                      className="input"
                      type="number"
                      style={{ paddingLeft: 34 }}
                      value={feeAmount}
                      onChange={(e) => setFeeAmount(e.target.value)}
                      placeholder="250.00"
                      min="0.01"
                      step="0.01"
                    />
                  </div>
                </div>
              </div>

              {/* Fee Division Options */}
              <div className="field">
                <label className="field-label" style={{ marginBottom: 'var(--space-2)' }}>
                  How should this fee be divided? *
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {HUMAN_FEE_OPTIONS.map((opt) => {
                    const isSelected = normalizeFeeAllocationType(feeType) === opt.value;
                    return (
                      <label
                        key={opt.value}
                        className={`fee-option-card ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => setFeeType(opt.value)}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {order.fees.map((fee) => {
              const allocationLabel = getFeeAllocationLabel(fee.allocationType);
              const targetPerson = fee.personId ? people.find((p) => p.id === fee.personId) : null;
              return (
                <div
                  key={fee.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 'var(--space-3) var(--space-4)',
                    background: 'var(--color-surface-raised)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    gap: 'var(--space-3)',
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--color-text-primary)' }}>
                      {fee.label}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {allocationLabel}
                      {targetPerson ? ` (${targetPerson.name})` : ''}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <strong style={{ fontSize: '1rem', color: 'var(--color-text-primary)' }}>
                      {formatZAR(fee.amountZar)}
                    </strong>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => openEditFee(fee)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--color-unpaid)' }}
                      onClick={() => setDeleteFeeTarget(fee)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Summary Totals Footer Card */}
      <section className="wizard-panel" style={{ background: 'var(--color-surface-raised)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Estimated Combined Total</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
              {formatZAR(grandTotal)}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-6)', fontSize: '0.875rem' }}>
            <div>
              <span style={{ color: 'var(--color-text-muted)' }}>Goods: </span>
              <strong>{formatZAR(order.goodsTotalZar || 0)}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-muted)' }}>Fees: </span>
              <strong>{formatZAR(totalFees)}</strong>
            </div>
          </div>
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
      `}</style>
    </div>
  );
}
