import { useState } from 'react';
import type { Order, Fee, FeeAllocationType } from '../../types';
import { useAppStore } from '../../store/appStore';
import { formatZAR } from '../../lib/formatters';

function genId() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

const ALLOCATION_OPTIONS: { value: FeeAllocationType; label: string; description: string }[] = [
  {
    value: 'fixed_shared',
    label: 'Fixed shared',
    description: 'Split equally across all participants (disbursement, payment fee, admin)',
  },
  {
    value: 'proportional_value',
    label: 'Proportional by coffee value',
    description: 'By each person\'s share of foreign list value (customs, duties, VAT)',
  },
  {
    value: 'per_bag',
    label: 'Per bag',
    description: 'By bag fractions received (freight, packing, handling per unit)',
  },
];

interface Props {
  order: Order;
}

export function GoodsAndFees({ order }: Props) {
  const { updateOrder } = useAppStore();
  const [goodsInput, setGoodsInput] = useState(order.goodsTotalZar > 0 ? String(order.goodsTotalZar) : '');
  const [editingFeeId, setEditingFeeId] = useState<string | 'new' | null>(null);
  const [feeLabel, setFeeLabel] = useState('');
  const [feeAmount, setFeeAmount] = useState('');
  const [feeType, setFeeType] = useState<FeeAllocationType>('fixed_shared');
  const [feeError, setFeeError] = useState('');

  const totalFees = order.fees.reduce((s, f) => s + (f.amountZar || 0), 0);
  const grandTotal = (order.goodsTotalZar || 0) + totalFees;

  function saveGoods() {
    const val = parseFloat(goodsInput);
    if (!isNaN(val) && val > 0) {
      updateOrder(order.id, { goodsTotalZar: val });
    }
  }

  function openNewFee() {
    setFeeLabel('');
    setFeeAmount('');
    setFeeType('fixed_shared');
    setFeeError('');
    setEditingFeeId('new');
  }

  function openEditFee(fee: Fee) {
    setFeeLabel(fee.label);
    setFeeAmount(String(fee.amountZar));
    setFeeType(fee.allocationType);
    setFeeError('');
    setEditingFeeId(fee.id);
  }

  function saveFee() {
    if (!feeLabel.trim()) return setFeeError('Fee label is required.');
    const amt = parseFloat(feeAmount);
    if (isNaN(amt) || amt <= 0) return setFeeError('Amount must be > 0.');
    setFeeError('');

    let updatedFees: Fee[];

    if (editingFeeId === 'new') {
      updatedFees = [
        ...order.fees,
        { id: genId(), label: feeLabel.trim(), amountZar: amt, allocationType: feeType },
      ];
    } else {
      updatedFees = order.fees.map((f) =>
        f.id === editingFeeId
          ? { ...f, label: feeLabel.trim(), amountZar: amt, allocationType: feeType }
          : f
      );
    }

    updateOrder(order.id, { fees: updatedFees });
    setEditingFeeId(null);
  }

  function deleteFee(feeId: string) {
    updateOrder(order.id, { fees: order.fees.filter((f) => f.id !== feeId) });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Goods total */}
      <div>
        <div className="section-label">Final goods amount paid (ZAR)</div>
        <div className="field">
          <div style={{ position: 'relative', maxWidth: 300 }}>
            <span style={{
              position: 'absolute',
              left: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--color-text-muted)',
              fontWeight: 700,
              pointerEvents: 'none',
            }}>R</span>
            <input
              className="input"
              type="number"
              value={goodsInput}
              onChange={(e) => setGoodsInput(e.target.value)}
              onBlur={saveGoods}
              step="0.01"
              min="0.01"
              placeholder="0.00"
              style={{ paddingLeft: 28 }}
            />
          </div>
          <span className="field-hint">
            The actual ZAR amount invoiced for coffee goods after tax deductions and discounts.
            Do not include shipping, duties, or other fees here — add them below as separate fee items.
          </span>
        </div>
      </div>

      {/* Fees */}
      <div>
        <div className="section-label">Additional fees</div>

        {order.fees.length === 0 && editingFeeId === null && (
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
            No fees added. Common fees: disbursement, customs duty, freight.
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {order.fees.map((fee) => (
            <div key={fee.id}>
              {editingFeeId === fee.id ? (
                <div className="card card-padded">
                  <FeeForm
                    label={feeLabel}
                    amount={feeAmount}
                    type={feeType}
                    error={feeError}
                    onLabelChange={setFeeLabel}
                    onAmountChange={setFeeAmount}
                    onTypeChange={setFeeType}
                    onSave={saveFee}
                    onCancel={() => setEditingFeeId(null)}
                  />
                </div>
              ) : (
                <FeeRow fee={fee} onEdit={() => openEditFee(fee)} onDelete={() => deleteFee(fee.id)} />
              )}
            </div>
          ))}

          {editingFeeId === 'new' && (
            <div className="card card-padded">
              <FeeForm
                label={feeLabel}
                amount={feeAmount}
                type={feeType}
                error={feeError}
                onLabelChange={setFeeLabel}
                onAmountChange={setFeeAmount}
                onTypeChange={setFeeType}
                onSave={saveFee}
                onCancel={() => setEditingFeeId(null)}
              />
            </div>
          )}

          {editingFeeId === null && (
            <button className="btn btn-secondary btn-sm" onClick={openNewFee} style={{ alignSelf: 'flex-start' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
              Add fee
            </button>
          )}
        </div>
      </div>

      {/* Totals summary */}
      {(order.goodsTotalZar > 0 || totalFees > 0) && (
        <div style={{
          background: 'var(--color-surface-raised)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm)',
          padding: 'var(--space-4)',
        }}>
          <TotalRow label="Goods total" value={formatZAR(order.goodsTotalZar || 0)} />
          {totalFees > 0 && <TotalRow label="Fees total" value={formatZAR(totalFees)} />}
          <div style={{ borderTop: '1px solid var(--color-border)', marginTop: 'var(--space-2)', paddingTop: 'var(--space-2)' }}>
            <TotalRow label="Order total" value={formatZAR(grandTotal)} bold />
          </div>
        </div>
      )}
    </div>
  );
}

function TotalRow({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '4px 0',
      fontSize: bold ? '1rem' : '0.875rem',
      fontWeight: bold ? 700 : 400,
      color: bold ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
    }}>
      <span>{label}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}

function FeeRow({ fee, onEdit, onDelete }: { fee: Fee; onEdit: () => void; onDelete: () => void }) {
  const typeLabel = {
    fixed_shared: 'Equal split',
    proportional_value: 'By value',
    per_bag: 'Per bag',
  }[fee.allocationType];

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-3)',
      padding: 'var(--space-3) var(--space-4)',
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-sm)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--color-text-primary)' }}>{fee.label}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 1 }}>{typeLabel}</div>
      </div>
      <div style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
        {formatZAR(fee.amountZar)}
      </div>
      <button className="btn btn-ghost btn-sm" onClick={onEdit}>Edit</button>
      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-unpaid)' }} onClick={onDelete}>Delete</button>
    </div>
  );
}

interface FeeFormProps {
  label: string;
  amount: string;
  type: FeeAllocationType;
  error: string;
  onLabelChange: (v: string) => void;
  onAmountChange: (v: string) => void;
  onTypeChange: (v: FeeAllocationType) => void;
  onSave: () => void;
  onCancel: () => void;
}

function FeeForm({ label, amount, type, error, onLabelChange, onAmountChange, onTypeChange, onSave, onCancel }: FeeFormProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div className="grid-2">
        <div className="field">
          <label className="field-label">Fee label</label>
          <input
            className="input"
            value={label}
            onChange={(e) => onLabelChange(e.target.value)}
            placeholder="e.g. Customs duty"
            autoFocus
          />
        </div>
        <div className="field">
          <label className="field-label">Amount (ZAR)</label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontWeight: 700, pointerEvents: 'none' }}>R</span>
            <input
              className="input"
              type="number"
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              step="0.01"
              min="0.01"
              placeholder="0.00"
              style={{ paddingLeft: 28 }}
            />
          </div>
        </div>
      </div>

      <div className="field">
        <label className="field-label">Allocation method</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {ALLOCATION_OPTIONS.map((opt) => (
            <label key={opt.value} style={{
              display: 'flex',
              gap: 'var(--space-3)',
              padding: 'var(--space-3)',
              border: `1.5px solid ${type === opt.value ? 'var(--color-accent)' : 'var(--color-border)'}`,
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              background: type === opt.value ? 'var(--color-accent-light)' : 'transparent',
              transition: 'border-color var(--transition-fast), background var(--transition-fast)',
            }}>
              <input
                type="radio"
                name="fee-type"
                value={opt.value}
                checked={type === opt.value}
                onChange={() => onTypeChange(opt.value)}
                style={{ marginTop: 2, accentColor: 'var(--color-accent)' }}
              />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>{opt.label}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{opt.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
        <button className="btn btn-primary" onClick={onSave}>Save fee</button>
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
