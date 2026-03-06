import { useState } from 'react';
import type { Order, PaymentRecord, PaymentStatus } from '../../types';
import { useAppStore } from '../../store/appStore';
import { calculate, allLotsBalanced } from '../../lib/calculations';
import { formatZAR, formatDateShort, todayISO } from '../../lib/formatters';

interface Props {
  order: Order;
}

export function OrderSummary({ order }: Props) {
  const { people, updateOrder } = useAppStore();

  const personNames = Object.fromEntries(people.map((p) => [p.id, p.name]));
  const result = calculate(order, personNames);

  if (!result.isValid) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
          Fix the following before calculations run:
        </div>
        {result.validationErrors.map((err, i) => (
          <div key={i} className="alert alert-warning">{err}</div>
        ))}
      </div>
    );
  }

  function updatePayment(personId: string, record: PaymentRecord) {
    updateOrder(order.id, {
      payments: { ...order.payments, [personId]: record },
    });
  }

  const payer = people.find((p) => p.id === order.payerId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {/* Reconciliation notice */}
      {Math.abs(result.roundingAbsorbed) > 0.001 && (
        <div className="alert alert-info" style={{ fontSize: '0.8125rem' }}>
          Rounding absorbed by {payer?.name || 'payer'}: {formatZAR(Math.abs(result.roundingAbsorbed))}
          {result.roundingAbsorbed > 0 ? ' (payer pays more)' : ' (payer pays less)'}
        </div>
      )}

      {/* Summary table */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Person</th>
              <th className="td-right">Grams</th>
              <th className="td-right">Goods</th>
              <th className="td-right">Fees</th>
              <th className="td-right">Total due</th>
              <th className="td-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {result.personIds.map((pid) => {
              const calc = result.personCalcs[pid];
              const name = personNames[pid] || 'Unknown';
              const payment = order.payments[pid];
              const isPayer = pid === order.payerId;

              return (
                <tr key={pid}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{name}</div>
                    {isPayer && (
                      <div style={{ fontSize: '0.6875rem', color: 'var(--color-accent)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Payer
                      </div>
                    )}
                  </td>
                  <td className="td-right td-mono">{calc.totalGrams}g</td>
                  <td className="td-right td-mono">{formatZAR(calc.goodsZar)}</td>
                  <td className="td-right td-mono">{formatZAR(calc.feesZar)}</td>
                  <td className="td-right">
                    <span className="amount">{formatZAR(calc.totalFinal)}</span>
                  </td>
                  <td className="td-right">
                    <StatusPill payment={payment} />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th colSpan={4} style={{ textAlign: 'right', fontSize: '0.8125rem' }}>Order total</th>
              <th className="td-right">
                <span className="amount">{formatZAR(result.totalOrderZar)}</span>
              </th>
              <th />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Payment tracking per person */}
      <div>
        <div className="section-label">Payment tracking</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {result.personIds.map((pid) => {
            const name = personNames[pid] || 'Unknown';
            const calc = result.personCalcs[pid];
            const payment = order.payments[pid];
            const isPayer = pid === order.payerId;

            return (
              <PaymentEditor
                key={pid}
                personName={name}
                totalDue={calc.totalFinal}
                payment={payment}
                isPayer={isPayer}
                onChange={(rec) => updatePayment(pid, rec)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Status Pill ──────────────────────────────────────────────

function StatusPill({ payment }: { payment?: PaymentRecord }) {
  const status = payment?.status || 'unpaid';
  return (
    <span className={`pill pill-${status}`}>
      {status === 'paid' ? '✓ Paid' : status === 'partial' ? '◑ Partial' : '○ Unpaid'}
    </span>
  );
}

// ─── Payment Editor ───────────────────────────────────────────

interface PaymentEditorProps {
  personName: string;
  totalDue: number;
  payment?: PaymentRecord;
  isPayer: boolean;
  onChange: (rec: PaymentRecord) => void;
}

function PaymentEditor({ personName, totalDue, payment, isPayer, onChange }: PaymentEditorProps) {
  const status = payment?.status || 'unpaid';
  const amountPaid = payment?.amountPaid ?? totalDue;
  const datePaid = payment?.datePaid || todayISO();

  function setStatus(s: PaymentStatus) {
    if (s === 'paid') {
      onChange({ status: 'paid', amountPaid: totalDue, datePaid: payment?.datePaid || todayISO() });
    } else if (s === 'partial') {
      onChange({ status: 'partial', amountPaid: payment?.amountPaid || 0, datePaid: payment?.datePaid || todayISO() });
    } else {
      onChange({ status: 'unpaid' });
    }
  }

  return (
    <div style={{
      padding: 'var(--space-4)',
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-sm)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', marginBottom: (status !== 'unpaid') ? 'var(--space-3)' : 0 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{personName}</div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
            {formatZAR(totalDue)} due
            {isPayer && <span style={{ marginLeft: 6, color: 'var(--color-accent)', fontWeight: 700, fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Payer</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          {(['unpaid', 'partial', 'paid'] as PaymentStatus[]).map((s) => (
            <button
              key={s}
              className={`btn btn-sm ${status === s ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setStatus(s)}
              style={{ fontSize: '0.75rem', padding: '4px 12px', minHeight: 32 }}
            >
              {s === 'unpaid' ? 'Unpaid' : s === 'partial' ? 'Partial' : 'Paid'}
            </button>
          ))}
        </div>
      </div>

      {(status === 'paid' || status === 'partial') && (
        <div className="grid-2" style={{ marginTop: 'var(--space-3)' }}>
          {status === 'partial' && (
            <div className="field">
              <label className="field-label">Amount paid (ZAR)</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontWeight: 700, pointerEvents: 'none' }}>R</span>
                <input
                  className="input"
                  type="number"
                  value={payment?.amountPaid ?? ''}
                  onChange={(e) => onChange({ status: 'partial', amountPaid: parseFloat(e.target.value) || 0, datePaid })}
                  step="0.01"
                  min="0"
                  style={{ paddingLeft: 28 }}
                />
              </div>
              {payment?.amountPaid !== undefined && payment.amountPaid > 0 && (
                <span className="field-hint">
                  Outstanding: {formatZAR(Math.max(0, totalDue - payment.amountPaid))}
                </span>
              )}
            </div>
          )}
          <div className="field">
            <label className="field-label">Date paid</label>
            <input
              className="input"
              type="date"
              value={payment?.datePaid || todayISO()}
              onChange={(e) => onChange({ ...payment, status, datePaid: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
