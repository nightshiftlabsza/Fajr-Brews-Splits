import { useState } from 'react';
import type { Order, Person, PersonCalculation } from '../../types';
import { formatZAR, formatDate, formatGrams } from '../../lib/formatters';
import { buildInvoiceModel } from '../../lib/invoiceFormatter';

interface Props {
  order: Order;
  person: Person;
  payer: Person | undefined;
  calc: PersonCalculation;
}

export function InvoiceView({ order, person, payer, calc }: Props) {
  const [showAudit, setShowAudit] = useState(false);
  const invoice = buildInvoiceModel({ order, person, payer, calc });
  const payment = order.payments[person.id];
  const roundingAdjustment = calc.totalFinal - calc.totalPreRound;

  return (
    <div className="invoice-paper" id={`invoice-${person.id}`}>
      {/* Header */}
      <div className="invoice-header">
        <div className="invoice-header-row">
          <div>
            <h2>Splits</h2>
            <div className="invoice-subtitle">
              by Fajr Brews · Invoice
            </div>
          </div>
          <div className="text-right">
            <div className="invoice-amount-hero">
              {invoice.amountDue}
            </div>
            <div className="invoice-status-label">
              {payment?.status === 'paid' ? 'Paid' : payment?.status === 'partial' ? 'Partial' : 'Amount Due'}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="invoice-body">
        {/* Person + order info */}
        <div className="invoice-section">
          <div className="invoice-meta-row">
            <div>
              <div className="invoice-client-name">
                {person.name}
              </div>
              {person.phone && <div className="text-xs text-muted">{person.phone}</div>}
              {person.email && <div className="text-xs text-muted">{person.email}</div>}
            </div>
            <div className="text-right">
              <div className="text-xs text-muted">{invoice.orderName}</div>
              <div className="text-xs text-muted">{invoice.orderDate}</div>
              <div className="invoice-ref-text">
                Ref: {invoice.reference}
              </div>
            </div>
          </div>
        </div>

        {/* Coffee shares */}
        <div className="invoice-section">
          <div className="invoice-section-label">Coffee Shares</div>

          {invoice.coffeeLines.map((line) => {
            return (
              <div className="invoice-lot" key={line.id}>
                <div className="invoice-lot-row">
                  <div>
                    <div className="invoice-lot-name">
                      {line.name} · {formatGrams(line.shareGrams)}
                    </div>
                    <div className="invoice-lot-meta" style={{ fontStyle: 'italic', marginBottom: 0 }}>
                      ({line.breakdownSummary})
                    </div>
                    {line.splitWith.length > 0 && (
                      <div className="invoice-lot-split">
                        Split with: {line.splitWith.join(', ')}
                      </div>
                    )}
                  </div>
                  <div className="invoice-lot-price">
                    {line.totalAmount}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Audit Details Toggle */}
        {(calc.feeBreakdowns.length > 0 || Math.abs(roundingAdjustment) > 0.001) && (
          <div className="mt-2 mb-2">
            <button
              type="button"
              className="btn btn-ghost btn-sm text-xs text-muted"
              onClick={() => setShowAudit((prev) => !prev)}
            >
              {showAudit ? 'Hide calculation details' : 'Show calculation details'}
            </button>
          </div>
        )}

        {/* Allocated Fees (Audit Level 3) */}
        {showAudit && calc.feeBreakdowns.length > 0 && (
          <div className="invoice-section">
            <div className="invoice-section-label">Fee Calculation Details</div>
            {invoice.feeLines.map((fee) => (
              <div className="invoice-total-row" key={fee.id}>
                <div className="text-secondary">
                  {fee.label}
                  <span className="text-xs text-muted" style={{ marginLeft: 6 }}>
                    {fee.methodLabel}
                  </span>
                </div>
                <span className="amount-small">{fee.amount}</span>
              </div>
            ))}
            {Math.abs(roundingAdjustment) > 0.001 && (
              <div className="invoice-total-row">
                <span className="text-secondary">Rounding adjustment</span>
                <span className="amount-small">{formatZAR(roundingAdjustment)}</span>
              </div>
            )}
          </div>
        )}

        {/* Totals */}
        <div className="invoice-section">
          <div className="invoice-grand-total">
            <span className="invoice-grand-total-label">
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
              ['Reference', invoice.reference],
            ].filter(([, v]) => v).map(([label, value]) => (
              <div className="invoice-bank-row" key={label}>
                <span className="invoice-bank-label">{label}</span>
                <span className="invoice-bank-value">{value}</span>
              </div>
            ))}
          </div>
          {order.payerNote && (
            <div className="invoice-payer-note">
              {order.payerNote}
            </div>
          )}
        </div>

        {/* Payment status if recorded */}
        {payment && payment.status !== 'unpaid' && (
          <div className={`alert alert-${payment.status === 'paid' ? 'success' : 'warning'} text-xs`}>
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
