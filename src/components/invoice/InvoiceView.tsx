import type { Order, Person, PersonCalculation } from '../../types';
import { formatZAR, formatDate, resolveReference } from '../../lib/formatters';

interface Props {
  order: Order;
  person: Person;
  payer: Person | undefined;
  calc: PersonCalculation;
}

export function InvoiceView({ order, person, payer, calc }: Props) {
  const ref = resolveReference(
    order.referenceTemplate,
    order.name,
    person.name,
    order.orderDate
  );

  const payment = order.payments[person.id];
  const roundingAdjustment = calc.totalFinal - calc.totalPreRound;

  return (
    <div className="invoice-paper" id={`invoice-${person.id}`}>
      {/* Header */}
      <div className="invoice-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ marginBottom: 4 }}>Fajr Brews</h2>
            <div style={{
              fontSize: '0.6875rem',
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              opacity: 0.75,
            }}>
              Coffee Splitter · Invoice
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontSize: '1.75rem',
              fontWeight: 800,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
              marginBottom: 4,
            }}>
              {formatZAR(calc.totalFinal)}
            </div>
            <div style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.75 }}>
              {payment?.status === 'paid' ? '✓ Paid' : payment?.status === 'partial' ? '◑ Partial' : 'Amount Due'}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="invoice-body">
        {/* Person + order info */}
        <div className="invoice-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--color-text-primary)', marginBottom: 4 }}>
                {person.name}
              </div>
              {person.phone && <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>{person.phone}</div>}
              {person.email && <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>{person.email}</div>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>{order.name}</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>{formatDate(order.orderDate)}</div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                Ref: {ref}
              </div>
            </div>
          </div>
        </div>

        {/* Coffee shares */}
        <div className="invoice-section">
          <div className="invoice-section-label">Coffee Shares</div>

          {calc.lotBreakdowns.map((lb) => {
            return (
              <div className="invoice-lot" key={lb.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <div className="invoice-lot-name">{lb.lotName}</div>
                    <div className="invoice-lot-meta">
                      Bag {lb.bagIndex + 1} · {lb.shareGrams}g · {lb.bagMode === 'split' ? 'split bag' : 'own bag'}
                    </div>
                    {lb.splitWith.length > 0 && (
                      <div className="invoice-lot-split">
                        Split with: {lb.splitWith.join(', ')}
                      </div>
                    )}
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                      <span style={{ opacity: 0.8 }}>Beans: {formatZAR(lb.goodsZar)}</span>
                      {lb.feesZar > 0 && (
                        <>
                          <span style={{ margin: '0 6px', opacity: 0.4 }}>•</span>
                          <span style={{ opacity: 0.8 }}>Allocated fees: {formatZAR(lb.feesZar)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text-primary)' }}>
                      {formatZAR(lb.totalZar)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Allocated Fees */}
        {calc.feeBreakdowns.length > 0 && (
          <div className="invoice-section">
            <div className="invoice-section-label">Included Allocated Fees</div>
            {calc.feeBreakdowns.map((fb) => (
              <div className="invoice-total-row" key={fb.feeId}>
                <div style={{ color: 'var(--color-text-secondary)' }}>
                  {fb.label}
                  <span style={{ marginLeft: 6, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    {fb.allocationType === 'value_based' ? 'Value-based' : 'Shared'}
                  </span>
                </div>
                <span className="amount-small">{formatZAR(fb.amountZar)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Totals */}
        <div className="invoice-section">
          <div className="invoice-section-label">Summary</div>
          <div className="invoice-total-row">
            <span style={{ color: 'var(--color-text-secondary)' }}>Coffee + allocated fees</span>
            <span className="amount-small">{formatZAR(calc.totalPreRound)}</span>
          </div>
          {Math.abs(roundingAdjustment) > 0.001 && (
            <div className="invoice-total-row">
              <span style={{ color: 'var(--color-text-secondary)' }}>Rounding adjustment</span>
              <span className="amount-small">{formatZAR(roundingAdjustment)}</span>
            </div>
          )}
          <div className="invoice-grand-total">
            <span style={{ fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Total due
            </span>
            <span>{formatZAR(calc.totalFinal)}</span>
          </div>
        </div>

        {/* Payment instructions */}
        <div className="invoice-section">
          <div className="invoice-section-label">Payment Instructions</div>
          <div>
            {[
              ['Beneficiary', order.payerBank.beneficiary || payer?.name || '—'],
              ['Bank', order.payerBank.bankName],
              ['Account number', order.payerBank.accountNumber],
              ...(order.payerBank.branch ? [['Branch', order.payerBank.branch]] : []),
              ['Reference', ref],
            ].filter(([, v]) => v).map(([label, value]) => (
              <div className="invoice-bank-row" key={label}>
                <span className="invoice-bank-label">{label}</span>
                <span className="invoice-bank-value">{value}</span>
              </div>
            ))}
          </div>
          {order.payerNote && (
            <div style={{
              marginTop: 'var(--space-4)',
              padding: 'var(--space-3)',
              background: 'var(--color-surface-raised)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8125rem',
              color: 'var(--color-text-secondary)',
              fontStyle: 'italic',
            }}>
              {order.payerNote}
            </div>
          )}
        </div>

        {/* Payment status if recorded */}
        {payment && payment.status !== 'unpaid' && (
          <div className={`alert alert-${payment.status === 'paid' ? 'success' : 'warning'}`} style={{ fontSize: '0.8125rem' }}>
            {payment.status === 'paid' ? (
              <>✓ Paid {payment.amountPaid ? formatZAR(payment.amountPaid) : ''}{payment.datePaid ? ` on ${formatDate(payment.datePaid)}` : ''}</>
            ) : (
              <>◑ Partial payment of {formatZAR(payment.amountPaid || 0)} recorded. Outstanding: {formatZAR(calc.totalFinal - (payment.amountPaid || 0))}</>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
