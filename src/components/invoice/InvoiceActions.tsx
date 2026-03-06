import { useState } from 'react';
import type { Order, Person, PersonCalculation } from '../../types';
import { generateInvoicePDF } from '../../lib/pdf';
import { copyPaymentSummary, openWhatsApp, openEmail } from '../../lib/sharing';

interface Props {
  order: Order;
  person: Person;
  payer: Person | undefined;
  calc: PersonCalculation;
}

export function InvoiceActions({ order, person, payer, calc }: Props) {
  const [copying, setCopying] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const payload = { order, person, payer, calc };

  async function handleCopy() {
    setCopying(true);
    setActionError(null);
    try {
      await copyPaymentSummary(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to copy. Please try again.');
    } finally {
      setCopying(false);
    }
  }

  async function handlePDF() {
    setGenerating(true);
    setActionError(null);
    try {
      await generateInvoicePDF(order, person, payer, calc);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to generate PDF. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div>
    {actionError && (
      <div className="alert alert-error" style={{ marginBottom: 'var(--space-3)', fontSize: '0.8125rem' }}>{actionError}</div>
    )}
    <div className="invoice-actions" style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
      <button className="btn btn-primary btn-sm" onClick={handlePDF} disabled={generating}>
        {generating ? (
          <span className="spinner" style={{ width: 14, height: 14 }} />
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
          </svg>
        )}
        PDF
      </button>

      <button className="btn btn-secondary btn-sm" onClick={handleCopy} disabled={copying}>
        {copied ? (
          <>✓ Copied</>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
            </svg>
            Copy
          </>
        )}
      </button>

      <button
        className="btn btn-secondary btn-sm"
        onClick={() => openWhatsApp(payload)}
        title={person.phone ? `WhatsApp ${person.phone}` : 'Open WhatsApp (no phone on record)'}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
          <path d="M11.998 2C6.478 2 2 6.478 2 11.998c0 1.909.505 3.694 1.381 5.237L2.05 22l4.89-1.31A9.953 9.953 0 0011.998 22c5.52 0 9.998-4.478 9.998-9.998S17.518 2 11.998 2z" fillRule="evenodd" clipRule="evenodd"/>
        </svg>
        WhatsApp
      </button>

      <button
        className="btn btn-secondary btn-sm"
        onClick={() => openEmail(payload)}
        title={person.email ? `Email ${person.email}` : 'Open email (no address on record)'}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
          <polyline points="22,6 12,13 2,6"/>
        </svg>
        Email
      </button>

      <button className="btn btn-ghost btn-sm" onClick={handlePrint}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
        </svg>
        Print
      </button>
    </div>
    </div>
  );
}
