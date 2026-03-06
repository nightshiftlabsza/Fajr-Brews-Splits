import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../../store/appStore';
import type { Order, PayerBank } from '../../types';
import { todayISO } from '../../lib/formatters';

interface Props {
  order: Order;
}

export function OrderSetup({ order }: Props) {
  const { people, updateOrder, createOrder } = useAppStore();

  const [name, setName] = useState(order.name);
  const [orderDate, setOrderDate] = useState(order.orderDate || todayISO());
  const [payerId, setPayerId] = useState(order.payerId || '');
  const [bank, setBank] = useState<PayerBank>({
    bankName: order.payerBank?.bankName || '',
    accountNumber: order.payerBank?.accountNumber || '',
    beneficiary: order.payerBank?.beneficiary || '',
    branch: order.payerBank?.branch || '',
  });
  const [refTemplate, setRefTemplate] = useState(order.referenceTemplate || 'FAJR-{ORDER}-{NAME}');
  const [payerNote, setPayerNote] = useState(order.payerNote || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(order.name);
    setOrderDate(order.orderDate || todayISO());
    setPayerId(order.payerId || '');
    setBank({
      bankName: order.payerBank?.bankName || '',
      accountNumber: order.payerBank?.accountNumber || '',
      beneficiary: order.payerBank?.beneficiary || '',
      branch: order.payerBank?.branch || '',
    });
    setRefTemplate(order.referenceTemplate || 'FAJR-{ORDER}-{NAME}');
    setPayerNote(order.payerNote || '');
  }, [order.id]);

  const save = useCallback(async (changes: Partial<Order>) => {
    setSaving(true);
    try {
      await updateOrder(order.id, changes);
    } finally {
      setSaving(false);
    }
  }, [order.id, updateOrder]);

  function handleBankChange(field: keyof PayerBank, value: string) {
    const updated = { ...bank, [field]: value };
    setBank(updated);
    save({ payerBank: updated });
  }

  // Auto-fill beneficiary from payer name
  function handlePayerChange(pid: string) {
    setPayerId(pid);
    const payer = people.find((p) => p.id === pid);
    if (payer && !bank.beneficiary) {
      const updated = { ...bank, beneficiary: payer.name };
      setBank(updated);
      save({ payerId: pid, payerBank: updated });
    } else {
      save({ payerId: pid });
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {saving && (
        <div style={{
          fontSize: '0.75rem',
          color: 'var(--color-text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <div className="spinner" style={{ width: 12, height: 12 }} />
          Saving…
        </div>
      )}

      {/* Order basics */}
      <div className="grid-2">
        <div className="field">
          <label className="field-label" htmlFor="order-name">Order name</label>
          <input
            id="order-name"
            className="input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => save({ name })}
            placeholder="e.g. March Import 2025"
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="order-date">Order date</label>
          <input
            id="order-date"
            className="input"
            type="date"
            value={orderDate}
            onChange={(e) => { setOrderDate(e.target.value); save({ orderDate: e.target.value }); }}
          />
        </div>
      </div>

      {/* Payer */}
      <div className="field">
        <label className="field-label" htmlFor="payer">Payer (collects all funds)</label>
        <select
          id="payer"
          className="select"
          value={payerId}
          onChange={(e) => handlePayerChange(e.target.value)}
        >
          <option value="">— Select payer —</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <span className="field-hint">
          The payer's total will absorb rounding remainders.
        </span>
      </div>

      {/* Bank details */}
      <div>
        <div className="section-label">Bank details</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div className="grid-2">
            <div className="field">
              <label className="field-label">Bank name</label>
              <input
                className="input"
                value={bank.bankName}
                onChange={(e) => setBank((b) => ({ ...b, bankName: e.target.value }))}
                onBlur={() => save({ payerBank: bank })}
                placeholder="e.g. FNB"
              />
            </div>
            <div className="field">
              <label className="field-label">Account number</label>
              <input
                className="input"
                value={bank.accountNumber}
                onChange={(e) => setBank((b) => ({ ...b, accountNumber: e.target.value }))}
                onBlur={() => save({ payerBank: bank })}
                placeholder="e.g. 62xxxxxxxxx"
              />
            </div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label className="field-label">Beneficiary name</label>
              <input
                className="input"
                value={bank.beneficiary}
                onChange={(e) => setBank((b) => ({ ...b, beneficiary: e.target.value }))}
                onBlur={() => save({ payerBank: bank })}
                placeholder="Account holder name"
              />
            </div>
            <div className="field">
              <label className="field-label">Branch code (optional)</label>
              <input
                className="input"
                value={bank.branch}
                onChange={(e) => setBank((b) => ({ ...b, branch: e.target.value }))}
                onBlur={() => save({ payerBank: bank })}
                placeholder="e.g. 250655"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Reference template */}
      <div className="field">
        <label className="field-label">Payment reference template</label>
        <input
          className="input"
          value={refTemplate}
          onChange={(e) => setRefTemplate(e.target.value)}
          onBlur={() => save({ referenceTemplate: refTemplate })}
          placeholder="FAJR-{ORDER}-{NAME}"
        />
        <span className="field-hint">
          Tokens: <code>{'{ORDER}'}</code> <code>{'{NAME}'}</code> <code>{'{MONTH}'}</code> <code>{'{YEAR}'}</code>
        </span>
      </div>

      {/* Payer note */}
      <div className="field">
        <label className="field-label">Payer note (optional)</label>
        <textarea
          className="textarea"
          value={payerNote}
          onChange={(e) => setPayerNote(e.target.value)}
          onBlur={() => save({ payerNote })}
          placeholder="Any note that will appear on invoices…"
          rows={2}
        />
      </div>
    </div>
  );
}
