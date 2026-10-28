import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { InvoiceActions } from '../invoice/InvoiceActions';
import { InvoiceView } from '../invoice/InvoiceView';
import { formatDate, formatZAR, generatePaymentReference, todayISO } from '../../lib/formatters';
import { useAppStore } from '../../store/appStore';
import { PaymentStatusChip } from './PaymentStatusChip';
import { Sheet } from '../ui/Sheet';
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
  title = 'Participants & invoices',
  description,
  onPaymentChange,
  paymentEditingEnabled = false,
  visiblePersonIds,
}: Props) {
  const { user, linkedPersonId, memberRole } = useAppStore(
    useShallow((s) => ({
      user: s.user,
      linkedPersonId: s.linkedPersonId,
      memberRole: s.memberRole,
    }))
  );
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
      <div className="settlement-header">
        <div>
          <div className="wizard-card-title">{title}</div>
          {description && <p className="wizard-card-copy">{description}</p>}
        </div>
      </div>

      {/* Personal Share for Logged-In User */}
      {isCurrentUserParticipant && myPerson && myCalc && (
        <div className="personal-share-hero-card">
          <div className="personal-share-header">
            <div>
              <span className="personal-share-badge">Your personal share</span>
              <h3 className="personal-share-name">{myPerson.name}</h3>
            </div>
            <div className="personal-share-status">
              <PaymentStatusChip
                status={myPayment?.status || 'unpaid'}
                readOnly={true}
                personName={myPerson.name}
              />
              {currentPersonId === order.payerId && (
                <span className="wizard-inline-meta personal-share-payer-meta">You are the order payer</span>
              )}
            </div>
          </div>

          <div className="personal-share-body">
            <div className="personal-share-amount-box">
              <span className="personal-share-amount-label">Total amount due</span>
              <span className="personal-share-amount num-cell">
                {formatZAR(myCalc.totalFinal)}
              </span>
              <span className="personal-share-grams num-cell">
                {myCalc.totalGrams}g of coffee ({myCalc.lotBreakdowns.length} {myCalc.lotBreakdowns.length === 1 ? 'coffee' : 'coffees'})
              </span>
            </div>

            {order.payerBank && (order.payerBank.bankName || order.payerBank.accountNumber) && (
              <div className="personal-share-bank-box">
                <div className="personal-share-bank-title">EFT / banking details</div>
                <div className="personal-share-bank-grid">
                  <div>
                    <span className="bank-meta-label">Bank:</span>
                    <strong>{order.payerBank.bankName}</strong>
                  </div>
                  <div>
                    <span className="bank-meta-label">Account:</span>
                    <strong className="num-cell">{order.payerBank.accountNumber}</strong>
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
                      <strong className="num-cell">{order.payerBank.branch}</strong>
                    </div>
                  )}
                  <div className="bank-grid-full-row">
                    <span className="bank-meta-label">Payment ref:</span>
                    <strong className="payment-ref-text">
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

      {/* Participant Ruled List */}
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
              <div key={personId} className={`fb-participant-row settlement-pack ${isExpanded ? 'is-open' : ''}`}>
                <div className="settlement-pack-header" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                  <div className="fb-participant-lead settlement-pack-primary">
                    <div className="fb-participant-info">
                      <div className="fb-participant-name settlement-pack-name" title={resolvedPerson.name}>
                        {resolvedPerson.name}
                        {personId === order.payerId && <span className="wizard-inline-meta" style={{ marginLeft: 'var(--space-2)' }}>Payer</span>}
                        {!person && <span className="wizard-inline-meta is-deleted" style={{ marginLeft: 'var(--space-2)' }}>Deleted</span>}
                      </div>
                      <div className="fb-participant-grams settlement-pack-copy num-cell">
                        {calc.totalGrams}g
                      </div>
                    </div>
                  </div>

                  {/* Payment status chip replaces three buttons plus a pill */}
                  <PaymentStatusChip
                    status={status}
                    readOnly={!canEditPayments || personId === order.payerId}
                    personName={resolvedPerson.name}
                    onStatusChange={(newStatus: PaymentStatus) => {
                      if (!onPaymentChange) return;
                      const datePaid = payment?.datePaid || todayISO();
                      if (newStatus === 'paid') {
                        onPaymentChange(personId, { status: 'paid', amountPaid: calc.totalFinal, datePaid });
                      } else if (newStatus === 'partial') {
                        onPaymentChange(personId, { status: 'partial', amountPaid: payment?.amountPaid || 0, datePaid });
                      } else {
                        onPaymentChange(personId, { status: 'unpaid' });
                      }
                    }}
                  />

                  <div className="fb-participant-amount-group settlement-pack-topline">
                    <strong className="fb-participant-amount settlement-pack-total num-cell">
                      {formatZAR(calc.totalFinal)}
                    </strong>
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
                    <div className="field summary-partial-field-amount">
                      <label className="field-label compact-label">Amount paid (ZAR)</label>
                      <div className="input-with-zar-prefix">
                        <span className="input-prefix-zar" aria-hidden="true">R</span>
                        <input
                          className="input input-with-prefix num-cell"
                          style={{ minHeight: 44, fontSize: '1rem' }}
                          type="number"
                          value={payment?.amountPaid ?? ''}
                          onChange={(e) => onPaymentChange(personId, {
                            status: 'partial',
                            amountPaid: parseFloat(e.target.value) || 0,
                            datePaid: payment?.datePaid || todayISO(),
                          })}
                          min="0"
                          step="0.01"
                        />
                      </div>
                      {payment?.amountPaid !== undefined && payment.amountPaid > 0 && (
                        <span className="field-hint compact-hint num-cell">
                          Outstanding: {formatZAR(Math.max(0, calc.totalFinal - payment.amountPaid))}
                        </span>
                      )}
                    </div>

                    <div className="field summary-partial-field-date">
                      <label className="field-label compact-label">Date paid</label>
                      <input
                        className="input"
                        type="date"
                        value={payment?.datePaid || todayISO()}
                        onChange={(e) => onPaymentChange(personId, {
                          ...payment,
                          status: 'partial',
                          datePaid: e.target.value,
                        })}
                      />
                    </div>
                  </div>
                )}

                {isExpanded && (
                  <div className="settlement-pack-preview">
                    <div className="settlement-expanded-actions">
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
        .settlement-header {
          margin-bottom: var(--space-3);
        }

        .personal-share-hero-card {
          background: color-mix(in srgb, var(--color-accent-light) 25%, var(--color-surface));
          border: 1px solid color-mix(in srgb, var(--color-accent) 40%, var(--color-border));
          border-radius: var(--radius-md);
          padding: var(--space-5);
          margin-bottom: var(--space-5);
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
          font-size: var(--text-xs);
          font-weight: 600;
          color: var(--color-accent);
          background: color-mix(in srgb, var(--color-accent-light) 60%, var(--color-surface));
          padding: 2px 8px;
          border-radius: var(--radius-sm);
          display: inline-block;
          margin-bottom: 4px;
        }

        .personal-share-payer-meta {
          margin-left: 6px;
        }

        .personal-share-name {
          font-size: var(--text-xl);
          font-weight: 700;
          color: var(--color-text-primary);
          margin: 0;
        }

        .personal-share-status {
          display: flex;
          align-items: center;
          gap: var(--space-2);
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
          font-size: var(--text-xs);
          font-weight: 600;
          color: var(--color-text-muted);
        }

        .personal-share-amount {
          font-size: var(--text-2xl);
          font-weight: 700;
          color: var(--color-accent);
        }

        .personal-share-grams {
          font-size: var(--text-sm);
          color: var(--color-text-secondary);
        }

        .personal-share-bank-box {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          padding: var(--space-4);
        }

        .personal-share-bank-title {
          font-size: var(--text-xs);
          font-weight: 600;
          color: var(--color-text-muted);
          margin-bottom: var(--space-2);
        }

        .personal-share-bank-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 6px 12px;
          font-size: var(--text-sm);
        }

        .bank-meta-label {
          color: var(--color-text-muted);
          margin-right: 4px;
        }

        .bank-grid-full-row {
          grid-column: 1 / -1;
        }

        .payment-ref-text {
          color: var(--color-accent);
        }

        .personal-share-actions-row {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          flex-wrap: wrap;
        }

        .is-deleted {
          color: var(--color-warning-text, var(--color-warning));
        }

        .settlement-pack-total {
          min-width: 90px;
          text-align: right;
        }

        .compact-label {
          font-size: var(--text-xs);
        }

        .compact-hint {
          font-size: var(--text-xs);
        }

        .summary-partial-field-amount {
          margin: 0;
          flex: 1;
          min-width: 160px;
        }

        .summary-partial-field-date {
          margin: 0;
          flex: 1;
          min-width: 140px;
        }

        .input-with-zar-prefix {
          position: relative;
        }

        .input-prefix-zar {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--color-text-muted);
          font-weight: 700;
          pointer-events: none;
        }

        .input-with-prefix {
          padding-left: 26px;
          min-height: 44px;
          font-size: 1rem;
        }

        .settlement-expanded-actions {
          margin-bottom: var(--space-4);
        }
      `}</style>
    </section>
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
