import { useMemo, useState } from 'react';
import { InvoiceActions } from '../invoice/InvoiceActions';
import { InvoiceView } from '../invoice/InvoiceView';
import { formatDate, formatZAR, todayISO } from '../../lib/formatters';
import type { CalculationResult, Order, PaymentRecord, PaymentStatus, Person } from '../../types';

interface Props {
  order: Order;
  people: Person[];
  result: CalculationResult;
  title?: string;
  description?: string;
  onPaymentChange?: (personId: string, record: PaymentRecord) => void;
  paymentEditingEnabled?: boolean;
}

export function SettlementPacks({
  order,
  people,
  result,
  title = 'People settlement',
  description = 'Each person stays compact until you open the one you need.',
  onPaymentChange,
  paymentEditingEnabled = false,
}: Props) {
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null);

  const personMap = useMemo(
    () => new Map(people.map((person) => [person.id, person])),
    [people],
  );
  const payer = order.payerId ? personMap.get(order.payerId) : undefined;

  return (
    <section className="wizard-panel">
      <div className="wizard-card-header">
        <div>
          <div className="wizard-card-title">{title}</div>
          <p className="wizard-card-copy">{description}</p>
        </div>
      </div>

      <div className="settlement-pack-list">
        {result.personIds.map((personId) => {
          const person = personMap.get(personId);
          const calc = result.personCalcs[personId];
          const payment = order.payments[personId];
          const status = payment?.status || 'unpaid';
          const isExpanded = expandedPersonId === personId;

          if (!person) return null;

          return (
            <div key={personId} className={`settlement-pack ${isExpanded ? 'is-open' : ''}`}>
              <div className="settlement-pack-header">
                <div className="settlement-pack-primary">
                  <div className="settlement-pack-name">
                    {person.name}
                    {personId === order.payerId && <span className="wizard-inline-meta">Payer</span>}
                  </div>
                  <div className="settlement-pack-copy">
                    {calc.totalGrams}g - {status === 'paid' ? 'Paid in full' : status === 'partial' ? 'Partially paid' : 'Waiting for payment'}
                  </div>
                </div>

                <div className="settlement-pack-topline">
                  <strong className="settlement-pack-total">{formatZAR(calc.totalFinal)}</strong>
                  <StatusPill payment={payment} />
                </div>
              </div>

              <div className="settlement-pack-toolbar">
                <div className="settlement-pack-actions">
                  <InvoiceActions
                    order={order}
                    person={person}
                    payer={payer}
                    calc={calc}
                    showPrint={false}
                  />
                </div>

                <button
                  className={`btn btn-sm ${isExpanded ? 'btn-secondary' : 'btn-ghost'}`}
                  onClick={() => setExpandedPersonId((current) => (current === personId ? null : personId))}
                >
                  {isExpanded ? 'Hide details' : 'View details'}
                </button>
              </div>

              {isExpanded && (
                <div className="settlement-pack-preview">
                  <div className="settlement-pack-detail-grid">
                    <div className="settlement-pack-detail-panel">
                      <div className="settlement-pack-detail-header">
                        <div>
                          <div className="settlement-pack-detail-title">Settlement details</div>
                          <div className="settlement-pack-detail-copy">
                            Payment tracking and invoice review stay together for {person.name}.
                          </div>
                        </div>
                        <button className="btn btn-ghost btn-sm" onClick={() => window.print()}>
                          Print invoice
                        </button>
                      </div>

                      {paymentEditingEnabled && onPaymentChange ? (
                        <PaymentEditor
                          personName={person.name}
                          totalDue={calc.totalFinal}
                          payment={payment}
                          isPayer={personId === order.payerId}
                          onChange={(record) => onPaymentChange(personId, record)}
                        />
                      ) : (
                        <PaymentReadout payment={payment} totalDue={calc.totalFinal} />
                      )}
                    </div>

                    <div className="settlement-pack-detail-panel">
                      <div className="settlement-pack-detail-header">
                        <div>
                          <div className="settlement-pack-detail-title">Invoice preview</div>
                          <div className="settlement-pack-detail-copy">
                            Coffee line items, fee breakdowns, and payment instructions stay tucked away until needed.
                          </div>
                        </div>
                      </div>
                      <InvoiceView
                        order={order}
                        person={person}
                        payer={payer}
                        calc={calc}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function StatusPill({ payment }: { payment?: PaymentRecord }) {
  const status = payment?.status || 'unpaid';
  return (
    <span className={`pill pill-${status}`}>
      {status === 'paid' ? 'Paid' : status === 'partial' ? 'Partial' : 'Unpaid'}
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
    <div className="settlement-payment-card">
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
        <div className="wizard-card-grid settlement-payment-grid">
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

function PaymentReadout({ payment, totalDue }: { payment?: PaymentRecord; totalDue: number }) {
  if (!payment || payment.status === 'unpaid') {
    return (
      <div className="settlement-payment-note">
        No payment recorded yet. Use the quick actions above when you are ready to send the request.
      </div>
    );
  }

  if (payment.status === 'paid') {
    return (
      <div className="alert alert-success" style={{ fontSize: '0.8125rem' }}>
        Paid {payment.amountPaid ? formatZAR(payment.amountPaid) : ''}{payment.datePaid ? ` on ${formatDate(payment.datePaid)}` : ''}
      </div>
    );
  }

  return (
    <div className="alert alert-warning" style={{ fontSize: '0.8125rem' }}>
      Partial payment of {formatZAR(payment.amountPaid || 0)} recorded. Outstanding: {formatZAR(Math.max(0, totalDue - (payment.amountPaid || 0)))}
    </div>
  );
}
