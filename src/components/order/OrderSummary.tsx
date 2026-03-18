import { useState } from 'react';
import type { Order, PaymentRecord, PaymentStatus } from '../../types';
import { useAppStore } from '../../store/appStore';
import { calculate } from '../../lib/calculations';
import { formatZAR, todayISO } from '../../lib/formatters';
import type { OrderWizardStep } from '../../lib/orderWizard';
import { getNextActiveOrderId } from '../../lib/orderLifecycle';
import { SettlementPacks } from './SettlementPacks';

interface Props {
  order: Order;
  onJumpToStep: (step: Extract<OrderWizardStep, 'setup' | 'coffees' | 'goods'>) => void;
  onFinalize: () => void;
}

export function OrderSummary({ order, onJumpToStep, onFinalize }: Props) {
  const { people, orders, updateOrder, setCurrentOrderId } = useAppStore();
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);

  const personNames = Object.fromEntries(people.map((person) => [person.id, person.name]));
  const result = calculate(order, personNames);

  if (!result.isValid) {
    return (
      <div className="wizard-step-stack">
        <section className="wizard-panel">
          <div className="wizard-card-title">Summary is waiting for the earlier steps</div>
          <p className="wizard-card-copy" style={{ marginTop: 'var(--space-2)' }}>
            Fix the highlighted issues below, then come back here for the final review.
          </p>
        </section>
        {result.validationErrors.map((error, index) => (
          <div key={index} className="alert alert-warning">{error}</div>
        ))}
      </div>
    );
  }

  function updatePayment(personId: string, record: PaymentRecord) {
    void updateOrder(order.id, {
      payments: { ...order.payments, [personId]: record },
    });
  }

  async function handleFinalizeOrder() {
    setFinalizing(true);
    setFinalizeError(null);
    try {
      await updateOrder(order.id, { isArchived: true });
      const nextActiveOrderId = getNextActiveOrderId(useAppStore.getState().orders, order.id);
      setCurrentOrderId(nextActiveOrderId);
      onFinalize();
    } catch (error) {
      setFinalizeError(error instanceof Error ? error.message : 'Failed to finalize this order. Please try again.');
    } finally {
      setFinalizing(false);
    }
  }

  const payer = people.find((person) => person.id === order.payerId);
  const activeOrderCount = orders.filter((candidate) => !candidate.isArchived && candidate.id !== order.id).length;

  return (
    <div className="wizard-step-stack">
      <section className="wizard-panel">
        <div className="wizard-card-header">
          <div>
            <div className="section-label" style={{ marginBottom: 'var(--space-2)' }}>Step 4</div>
            <h3 className="wizard-card-title">Summary</h3>
            <p className="wizard-card-copy">
              Review the final settlement, send payment requests, and save this order into Past Orders when it is ready.
            </p>
          </div>
        </div>

        <div className="wizard-summary-grid">
          <SummaryMetric label="Goods subtotal" value={formatZAR(result.totalGoodsZar)} />
          <SummaryMetric label="Fees subtotal" value={formatZAR(result.totalFeesZar)} />
          <SummaryMetric label="Grand total" value={formatZAR(result.totalOrderZar)} emphasize />
          <SummaryMetric label="People charged" value={String(result.personIds.length)} />
        </div>

        <div className="wizard-chip-row" style={{ marginTop: 'var(--space-4)' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => onJumpToStep('setup')}>Edit setup</button>
          <button className="btn btn-secondary btn-sm" onClick={() => onJumpToStep('coffees')}>Edit coffees</button>
          <button className="btn btn-secondary btn-sm" onClick={() => onJumpToStep('goods')}>Edit goods and fees</button>
        </div>
      </section>

      {Math.abs(result.roundingAbsorbed) > 0.001 && (
        <div className="alert alert-info">
          Rounding absorbed by {payer?.name || 'payer'}: {formatZAR(Math.abs(result.roundingAbsorbed))}
          {result.roundingAbsorbed > 0 ? ' (payer pays more)' : ' (payer pays less)'}
        </div>
      )}

      <section className="wizard-panel">
        <div className="wizard-card-header">
          <div>
            <div className="wizard-card-title">Totals per person</div>
            <p className="wizard-card-copy">A calm final check of who received what and what each person owes.</p>
          </div>
        </div>

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
              {result.personIds.map((personId) => {
                const calc = result.personCalcs[personId];
                const payment = order.payments[personId];
                const isPayer = personId === order.payerId;
                return (
                  <tr key={personId}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{personNames[personId] || 'Unknown'}</div>
                      {isPayer && (
                        <div className="wizard-inline-meta">Payer</div>
                      )}
                    </td>
                    <td className="td-right td-mono">{calc.totalGrams}g</td>
                    <td className="td-right td-mono">{formatZAR(calc.goodsZar)}</td>
                    <td className="td-right td-mono">{formatZAR(calc.feesZar)}</td>
                    <td className="td-right"><span className="amount">{formatZAR(calc.totalFinal)}</span></td>
                    <td className="td-right"><StatusPill payment={payment} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="wizard-panel">
        <div className="wizard-card-header">
          <div>
            <div className="wizard-card-title">Payment state</div>
            <p className="wizard-card-copy">Track who has paid, who is partial, and what still remains.</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {result.personIds.map((personId) => {
            const calc = result.personCalcs[personId];
            return (
              <PaymentEditor
                key={personId}
                personName={personNames[personId] || 'Unknown'}
                totalDue={calc.totalFinal}
                payment={order.payments[personId]}
                isPayer={personId === order.payerId}
                onChange={(record) => updatePayment(personId, record)}
              />
            );
          })}
        </div>
      </section>

      <SettlementPacks
        order={order}
        people={people}
        result={result}
      />

      <section className="wizard-panel">
        <div className="wizard-card-header">
          <div>
            <div className="wizard-card-title">Complete this order</div>
            <p className="wizard-card-copy">
              Save this finished order into Past Orders. It stays fully intact, but it leaves the active drafting workspace.
            </p>
          </div>
        </div>

        <div className="wizard-inline-note">
          {activeOrderCount > 0
            ? `Finalizing now will move this order to Past Orders and return you to your remaining ${activeOrderCount} active ${activeOrderCount === 1 ? 'order' : 'orders'}.`
            : 'Finalizing now will move this order to Past Orders and clear it from the active drafting workspace.'}
        </div>

        {finalizeError && (
          <div className="alert alert-error" style={{ marginTop: 'var(--space-4)' }}>
            {finalizeError}
          </div>
        )}

        <div className="wizard-inline-actions" style={{ marginTop: 'var(--space-4)' }}>
          <button className="btn btn-primary" onClick={handleFinalizeOrder} disabled={finalizing}>
            {finalizing ? <span className="spinner" style={{ width: 16, height: 16 }} /> : 'Save to Past Orders'}
          </button>
        </div>
      </section>
    </div>
  );
}

function SummaryMetric({ label, value, emphasize = false }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div className={`wizard-metric ${emphasize ? 'is-emphasized' : ''}`}>
      <div className="wizard-metric-label">{label}</div>
      <div className="wizard-metric-value">{value}</div>
    </div>
  );
}

function StatusPill({ payment }: { payment?: PaymentRecord }) {
  const status = payment?.status || 'unpaid';
  return (
    <span className={`pill pill-${status}`}>
      {status === 'paid' ? '✓ Paid' : status === 'partial' ? '◑ Partial' : '○ Unpaid'}
    </span>
  );
}

interface PaymentEditorProps {
  personName: string;
  totalDue: number;
  payment?: PaymentRecord;
  isPayer: boolean;
  onChange: (record: PaymentRecord) => void;
}

function PaymentEditor({ personName, totalDue, payment, isPayer, onChange }: PaymentEditorProps) {
  const status = payment?.status || 'unpaid';
  const datePaid = payment?.datePaid || todayISO();

  function setStatus(nextStatus: PaymentStatus) {
    if (nextStatus === 'paid') {
      onChange({ status: 'paid', amountPaid: totalDue, datePaid });
      return;
    }
    if (nextStatus === 'partial') {
      onChange({ status: 'partial', amountPaid: payment?.amountPaid || 0, datePaid });
      return;
    }
    onChange({ status: 'unpaid' });
  }

  return (
    <div className="summary-payment-card">
      <div className="summary-payment-header">
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{personName}</div>
          <div className="wizard-card-copy" style={{ marginTop: 'var(--space-1)' }}>
            {formatZAR(totalDue)} due {isPayer && <span className="wizard-inline-meta">Payer</span>}
          </div>
        </div>

        <div className="wizard-chip-row">
          {(['unpaid', 'partial', 'paid'] as PaymentStatus[]).map((option) => (
            <button
              key={option}
              className={`btn btn-sm ${status === option ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setStatus(option)}
            >
              {option === 'unpaid' ? 'Unpaid' : option === 'partial' ? 'Partial' : 'Paid'}
            </button>
          ))}
        </div>
      </div>

      {(status === 'paid' || status === 'partial') && (
        <div className="wizard-card-grid" style={{ marginTop: 'var(--space-4)' }}>
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
                  min="0"
                  step="0.01"
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
