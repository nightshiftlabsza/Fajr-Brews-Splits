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
  visiblePersonIds?: string[];
}

export function SettlementPacks({
  order,
  people,
  result,
  title = 'People settlement',
  description,
  onPaymentChange,
  paymentEditingEnabled = false,
  visiblePersonIds,
}: Props) {
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null);

  const personMap = useMemo(
    () => new Map(people.map((person) => [person.id, person])),
    [people],
  );
  const payer = order.payerId ? personMap.get(order.payerId) : undefined;

  return (
    <section className="wizard-panel">
      <div className="wizard-card-header" style={{ marginBottom: 'var(--space-3)' }}>
        <div>
          <div className="wizard-card-title">{title}</div>
          {description && <p className="wizard-card-copy">{description}</p>}
        </div>
      </div>

      <div className="settlement-pack-list">
        {result.personIds
          .filter((personId) => !visiblePersonIds || visiblePersonIds.includes(personId))
          .filter((personId) => {
            const calc = result.personCalcs[personId];
            if (!calc) return false;
            if (personId === order.payerId && calc.totalGrams === 0 && calc.totalFinal === 0 && !order.payments[personId]) {
              return false;
            }
            return true;
          })
          .map((personId) => {
          const person = personMap.get(personId);
          const resolvedPerson: Person = person ?? {
            id: personId,
            name: 'Deleted Person',
            phone: '',
            email: '',
            note: '',
          };
          const calc = result.personCalcs[personId];
          const payment = order.payments[personId];
          const status = payment?.status || 'unpaid';
          const isExpanded = expandedPersonId === personId;

          if (!calc) return null;

          return (
            <div key={personId} className={`settlement-pack ${isExpanded ? 'is-open' : ''}`}>
              <div className="settlement-pack-header">
                <div className="settlement-pack-primary">
                  <div className="settlement-pack-name">
                    {resolvedPerson.name}
                    {personId === order.payerId && <span className="wizard-inline-meta">Payer</span>}
                    {!person && <span className="wizard-inline-meta" style={{ color: 'var(--color-warning)' }}>Deleted</span>}
                  </div>
                  <div className="settlement-pack-copy">
                    {calc.totalGrams}g
                  </div>
                </div>

                {paymentEditingEnabled && onPaymentChange && personId !== order.payerId && (
                  <div className="settlement-quick-status-buttons">
                    {(['unpaid', 'partial', 'paid'] as PaymentStatus[]).map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={`btn btn-sm ${status === option ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => {
                          const datePaid = payment?.datePaid || todayISO();
                          if (option === 'paid') {
                            onPaymentChange(personId, { status: 'paid', amountPaid: calc.totalFinal, datePaid });
                          } else if (option === 'partial') {
                            onPaymentChange(personId, { status: 'partial', amountPaid: payment?.amountPaid || 0, datePaid });
                          } else {
                            onPaymentChange(personId, { status: 'unpaid' });
                          }
                        }}
                      >
                        {option === 'unpaid' ? 'Unpaid' : option === 'partial' ? 'Partial' : 'Paid'}
                      </button>
                    ))}
                  </div>
                )}

                <div className="settlement-pack-topline">
                  <strong className="settlement-pack-total">{formatZAR(calc.totalFinal)}</strong>
                  <StatusPill payment={payment} />
                  <button
                    type="button"
                    className={`btn btn-sm ${isExpanded ? 'btn-secondary' : 'btn-ghost'}`}
                    onClick={() => setExpandedPersonId((current) => (current === personId ? null : personId))}
                  >
                    {isExpanded ? 'Hide details' : 'View details'}
                  </button>
                </div>
              </div>

              {paymentEditingEnabled && onPaymentChange && status === 'partial' && (
                <div className="summary-partial-fields">
                  <div className="field" style={{ margin: 0, flex: 1, minWidth: 160 }}>
                    <label className="field-label" style={{ fontSize: '0.75rem' }}>Amount paid (ZAR)</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontWeight: 700, pointerEvents: 'none' }}>R</span>
                      <input
                        className="input"
                        type="number"
                        value={payment?.amountPaid ?? ''}
                        onChange={(e) => onPaymentChange(personId, {
                          status: 'partial',
                          amountPaid: parseFloat(e.target.value) || 0,
                          datePaid: payment?.datePaid || todayISO(),
                        })}
                        min="0"
                        step="0.01"
                        style={{ paddingLeft: 26, height: 36, fontSize: '0.875rem' }}
                      />
                    </div>
                    {payment?.amountPaid !== undefined && payment.amountPaid > 0 && (
                      <span className="field-hint" style={{ fontSize: '0.75rem' }}>
                        Outstanding: {formatZAR(Math.max(0, calc.totalFinal - payment.amountPaid))}
                      </span>
                    )}
                  </div>

                  <div className="field" style={{ margin: 0, flex: 1, minWidth: 140 }}>
                    <label className="field-label" style={{ fontSize: '0.75rem' }}>Date paid</label>
                    <input
                      className="input"
                      type="date"
                      value={payment?.datePaid || todayISO()}
                      onChange={(e) => onPaymentChange(personId, {
                        ...payment,
                        status: 'partial',
                        datePaid: e.target.value,
                      })}
                      style={{ height: 36, fontSize: '0.875rem' }}
                    />
                  </div>
                </div>
              )}

              {isExpanded && (
                <div className="settlement-pack-preview">
                  <div className="settlement-expanded-actions" style={{ marginBottom: 'var(--space-4)' }}>
                    <InvoiceActions
                      order={order}
                      person={resolvedPerson}
                      payer={payer}
                      calc={calc}
                      showPrint={true}
                    />
                  </div>
                  <div className="settlement-pack-detail-grid">
                    <div className="settlement-pack-detail-panel">
                      <PaymentReadout payment={payment} totalDue={calc.totalFinal} />
                    </div>

                    <div className="settlement-pack-detail-panel">
                      <InvoiceView
                        order={order}
                        person={resolvedPerson}
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

function PaymentReadout({ payment, totalDue }: { payment?: PaymentRecord; totalDue: number }) {
  if (!payment || payment.status === 'unpaid') {
    return (
      <div className="settlement-payment-note">
        No payment recorded yet.
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
