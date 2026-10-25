import { useMemo, useState } from 'react';
import { InvoiceActions } from '../invoice/InvoiceActions';
import { InvoiceView } from '../invoice/InvoiceView';
import { formatDate, formatZAR, generatePaymentReference, todayISO } from '../../lib/formatters';
import { useAppStore } from '../../store/appStore';
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
  title = 'Participants & Invoices',
  description,
  onPaymentChange,
  paymentEditingEnabled = false,
  visiblePersonIds,
}: Props) {
  const { user, linkedPersonId, memberRole } = useAppStore();
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null);

  const isWorkspaceManager = memberRole === 'owner' || memberRole === 'admin';
  const isOwner = !order.ownerId || order.ownerId === user?.id || isWorkspaceManager;

  const personMap = useMemo(
    () => new Map(people.map((person) => [person.id, person])),
    [people],
  );
  const payer = order.payerId ? personMap.get(order.payerId) : undefined;

  // Identify if logged-in user is a participant in this order
  const currentPersonId = useMemo(() => {
    if (linkedPersonId && people.some((p) => p.id === linkedPersonId)) {
      return linkedPersonId;
    }
    if (user?.email) {
      const normalizedEmail = user.email.toLowerCase().trim();
      const matched = people.find((p) => p.email && p.email.toLowerCase().trim() === normalizedEmail);
      if (matched) return matched.id;
    }
    return null;
  }, [linkedPersonId, user?.email, people]);

  // The payer receives the money, so they may record payments too.
  const isPayer = Boolean(currentPersonId && currentPersonId === order.payerId);
  const canEditPayments = paymentEditingEnabled && (isOwner || isPayer);

  const myPerson = currentPersonId ? personMap.get(currentPersonId) : null;
  const myCalc = currentPersonId ? result.personCalcs[currentPersonId] : null;
  const myPayment = currentPersonId ? order.payments[currentPersonId] : undefined;
  const isCurrentUserParticipant = Boolean(
    currentPersonId &&
    myCalc &&
    (myCalc.totalGrams > 0 || myCalc.totalFinal > 0)
  );

  return (
    <section className="wizard-panel settlement-packs-section">
      <div className="wizard-card-header" style={{ marginBottom: 'var(--space-3)' }}>
        <div>
          <div className="wizard-card-title">{title}</div>
          {description && <p className="wizard-card-copy">{description}</p>}
        </div>
      </div>

      {/* ── Friction Point #5: Elevated Personal Share Card for Logged-In User ── */}
      {isCurrentUserParticipant && myPerson && myCalc && (
        <div className="personal-share-hero-card">
          <div className="personal-share-header">
            <div>
              <span className="personal-share-badge">Your Personal Share</span>
              <h3 className="personal-share-name">{myPerson.name}</h3>
            </div>
            <div className="personal-share-status">
              <StatusPill payment={myPayment} />
              {currentPersonId === order.payerId && (
                <span className="wizard-inline-meta" style={{ marginLeft: 6 }}>You are the order payer</span>
              )}
            </div>
          </div>

          <div className="personal-share-body">
            <div className="personal-share-amount-box">
              <span className="personal-share-amount-label">Total Amount Due</span>
              <span className="personal-share-amount" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatZAR(myCalc.totalFinal)}
              </span>
              <span className="personal-share-grams" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {myCalc.totalGrams}g of coffee ({myCalc.lotBreakdowns.length} {myCalc.lotBreakdowns.length === 1 ? 'lot' : 'lots'})
              </span>
            </div>

            {order.payerBank && (order.payerBank.bankName || order.payerBank.accountNumber) && (
              <div className="personal-share-bank-box">
                <div className="personal-share-bank-title">EFT / Banking Details</div>
                <div className="personal-share-bank-grid">
                  <div>
                    <span className="bank-meta-label">Bank:</span>
                    <strong>{order.payerBank.bankName}</strong>
                  </div>
                  <div>
                    <span className="bank-meta-label">Account:</span>
                    <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{order.payerBank.accountNumber}</strong>
                  </div>
                  {order.payerBank.beneficiary && (
                    <div>
                      <span className="bank-meta-label">Beneficiary:</span>
                      <strong>{order.payerBank.beneficiary}</strong>
                    </div>
                  )}
                  {order.payerBank.branch && (
                    <div>
                      <span className="bank-meta-label">Branch:</span>
                      <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{order.payerBank.branch}</strong>
                    </div>
                  )}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span className="bank-meta-label">Payment Ref:</span>
                    <strong style={{ color: 'var(--color-accent)' }}>
                      {generatePaymentReference(order, myPerson.name)}
                    </strong>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="personal-share-actions-row">
            <InvoiceActions
              order={order}
              person={myPerson}
              payer={payer}
              calc={myCalc}
              showPrint={true}
            />
          </div>
        </div>
      )}

      {/* ── Participant Cards List ── */}
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
              workspaceId: order.workspaceId,
              name: 'Deleted Person',
              phone: '',
              email: '',
              note: '',
              createdAt: '',
              updatedAt: '',
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
                    <div className="settlement-pack-copy" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {calc.totalGrams}g
                    </div>
                  </div>

                  {/* Owner quick payment status toggle controls */}
                  {canEditPayments && onPaymentChange && personId !== order.payerId && (
                    <div className="settlement-quick-status-buttons" role="group" aria-label={`Payment status for ${resolvedPerson.name}`}>
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
                    <strong className="settlement-pack-total" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatZAR(calc.totalFinal)}
                    </strong>
                    <StatusPill payment={payment} readOnly={!canEditPayments} />
                    <button
                      type="button"
                      className={`btn btn-sm ${isExpanded ? 'btn-secondary' : 'btn-ghost'}`}
                      onClick={() => setExpandedPersonId((current) => (current === personId ? null : personId))}
                    >
                      {isExpanded ? 'Hide details' : 'View details'}
                    </button>
                  </div>
                </div>

                {canEditPayments && onPaymentChange && status === 'partial' && (
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
                          style={{ paddingLeft: 26, minHeight: 44, fontSize: '1rem', fontVariantNumeric: 'tabular-nums' }}
                        />
                      </div>
                      {payment?.amountPaid !== undefined && payment.amountPaid > 0 && (
                        <span className="field-hint" style={{ fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums' }}>
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
                        style={{ minHeight: 44, fontSize: '1rem' }}
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

      <style>{`
        .personal-share-hero-card {
          background: color-mix(in srgb, var(--color-accent-light) 25%, var(--color-surface));
          border: 1px solid color-mix(in srgb, var(--color-accent) 40%, var(--color-border));
          border-radius: var(--radius-md);
          padding: var(--space-5);
          margin-bottom: var(--space-5);
          box-shadow: var(--shadow-xs);
        }

        .personal-share-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: var(--space-3);
          margin-bottom: var(--space-4);
          flex-wrap: wrap;
        }

        .personal-share-badge {
          font-size: 0.6875rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--color-accent);
          background: color-mix(in srgb, var(--color-accent-light) 60%, var(--color-surface));
          padding: 2px 8px;
          border-radius: 999px;
          display: inline-block;
          margin-bottom: 4px;
        }

        .personal-share-name {
          font-size: 1.25rem;
          font-weight: 800;
          color: var(--color-text-primary);
          margin: 0;
        }

        .personal-share-body {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: var(--space-4);
          margin-bottom: var(--space-4);
        }

        .personal-share-amount-box {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          padding: var(--space-4);
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .personal-share-amount-label {
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-muted);
        }

        .personal-share-amount {
          font-size: 1.75rem;
          font-weight: 800;
          color: var(--color-accent);
          font-family: var(--font-display);
        }

        .personal-share-grams {
          font-size: 0.8125rem;
          color: var(--color-text-secondary);
        }

        .personal-share-bank-box {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          padding: var(--space-4);
        }

        .personal-share-bank-title {
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-muted);
          margin-bottom: var(--space-2);
        }

        .personal-share-bank-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 6px 12px;
          font-size: 0.8125rem;
        }

        .bank-meta-label {
          color: var(--color-text-muted);
          margin-right: 4px;
        }

        .personal-share-actions-row {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          flex-wrap: wrap;
        }
      `}</style>
    </section>
  );
}

function StatusPill({ payment, readOnly }: { payment?: PaymentRecord; readOnly?: boolean }) {
  const status = payment?.status || 'unpaid';
  return (
    <span
      className={`pill pill-${status}`}
      title={readOnly ? 'Payment status is managed by the order organizer' : undefined}
    >
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
