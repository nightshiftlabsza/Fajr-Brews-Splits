import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../../store/appStore';
import type { Order, PayerBank } from '../../types';
import { todayISO } from '../../lib/formatters';

interface Props {
  order: Order;
}

export function OrderSetup({ order }: Props) {
  const {
    people, updateOrder,
    setOrderPin, clearOrderPin, addOrderParticipant,
    user, workspaceMembers, fetchWorkspaceMembers,
  } = useAppStore();

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

  // PIN state
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinSaving, setPinSaving] = useState(false);
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState('');

  // Participants state
  const [addUserId, setAddUserId] = useState('');
  const [addingParticipant, setAddingParticipant] = useState(false);
  const [participantError, setParticipantError] = useState('');
  const [participantSuccess, setParticipantSuccess] = useState('');

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
    setNewPin('');
    setConfirmPin('');
    setPinError('');
    setPinSuccess('');
  }, [order.id]);

  // Load workspace members for participants dropdown (once on mount)
  useEffect(() => {
    fetchWorkspaceMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  async function handleSetPin() {
    if (newPin.length < 4 || newPin.length > 6) {
      setPinError('PIN must be 4–6 digits.');
      return;
    }
    if (newPin !== confirmPin) {
      setPinError('PINs do not match.');
      return;
    }
    setPinSaving(true);
    setPinError('');
    setPinSuccess('');
    try {
      await setOrderPin(order.id, newPin);
      setNewPin('');
      setConfirmPin('');
      setPinSuccess('PIN set. This order now requires a PIN to open from history.');
    } catch {
      setPinError('Failed to set PIN. Please try again.');
    } finally {
      setPinSaving(false);
    }
  }

  async function handleClearPin() {
    if (!confirm('Remove PIN from this order? Anyone with workspace access will be able to open it.')) return;
    setPinSaving(true);
    setPinError('');
    setPinSuccess('');
    try {
      await clearOrderPin(order.id);
    } catch {
      setPinError('Failed to remove PIN. Please try again.');
    } finally {
      setPinSaving(false);
    }
  }

  async function handleAddParticipant() {
    if (!addUserId) return;
    setAddingParticipant(true);
    setParticipantError('');
    setParticipantSuccess('');
    try {
      await addOrderParticipant(order.id, addUserId);
      const member = workspaceMembers.find((m) => m.userId === addUserId);
      setParticipantSuccess(`${member?.fullName || member?.email || 'Member'} added to this order.`);
      setAddUserId('');
    } catch {
      setParticipantError('Failed to add participant. Please try again.');
    } finally {
      setAddingParticipant(false);
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
            onBlur={() => name.trim() && save({ name: name.trim() })}
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

      {/* Order Access */}
      <div>
        <div className="section-label">Order Access</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>

          {/* PIN Protection */}
          <div className="card card-padded">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--color-text-primary)' }}>
                  PIN Protection
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                  {order.pinRequired
                    ? '🔒 This order requires a PIN to open from history.'
                    : 'No PIN required — anyone in the workspace can open it.'}
                </div>
              </div>
              {order.pinRequired && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleClearPin}
                  disabled={pinSaving}
                >
                  {pinSaving
                    ? <span className="spinner" style={{ width: 14, height: 14 }} />
                    : 'Remove PIN'}
                </button>
              )}
            </div>

            {!order.pinRequired && (
              <div style={{
                marginTop: 'var(--space-4)',
                borderTop: '1px solid var(--color-border)',
                paddingTop: 'var(--space-4)',
              }}>
                <div className="section-label" style={{ marginBottom: 'var(--space-3)' }}>Set a PIN</div>
                <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div className="field" style={{ flex: 1, minWidth: 140, marginBottom: 0 }}>
                    <label className="field-label">PIN (4–6 digits)</label>
                    <input
                      className="input"
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="••••"
                      style={{ letterSpacing: '0.25em', textAlign: 'center' }}
                    />
                  </div>
                  <div className="field" style={{ flex: 1, minWidth: 140, marginBottom: 0 }}>
                    <label className="field-label">Confirm PIN</label>
                    <input
                      className="input"
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="••••"
                      style={{ letterSpacing: '0.25em', textAlign: 'center' }}
                    />
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={handleSetPin}
                    disabled={pinSaving || newPin.length < 4 || newPin !== confirmPin}
                    style={{ alignSelf: 'flex-end' }}
                  >
                    {pinSaving
                      ? <span className="spinner" style={{ width: 16, height: 16 }} />
                      : 'Set PIN'}
                  </button>
                </div>
                <p className="field-hint" style={{ marginTop: 'var(--space-2)' }}>
                  PIN is hashed server-side and never stored in plain text.
                </p>
              </div>
            )}

            {pinError && (
              <div className="alert alert-error" style={{ marginTop: 'var(--space-3)', fontSize: '0.8125rem' }}>
                {pinError}
              </div>
            )}
            {pinSuccess && (
              <div className="alert alert-success" style={{ marginTop: 'var(--space-3)', fontSize: '0.8125rem' }}>
                {pinSuccess}
              </div>
            )}
          </div>

          {/* Participants */}
          <div className="card card-padded">
            <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>
              Add Participant
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
              Grant another workspace member access to this order in their history.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              <select
                className="select"
                value={addUserId}
                onChange={(e) => setAddUserId(e.target.value)}
                style={{ flex: 1, minWidth: 200 }}
              >
                <option value="">— Select member —</option>
                {workspaceMembers
                  .filter((m) => m.userId !== user?.id)
                  .map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.fullName || m.email || m.userId}
                    </option>
                  ))}
              </select>
              <button
                className="btn btn-primary"
                onClick={handleAddParticipant}
                disabled={!addUserId || addingParticipant}
              >
                {addingParticipant
                  ? <span className="spinner" style={{ width: 16, height: 16 }} />
                  : 'Add'}
              </button>
            </div>
            {participantError && (
              <div className="alert alert-error" style={{ marginTop: 'var(--space-3)', fontSize: '0.8125rem' }}>
                {participantError}
              </div>
            )}
            {participantSuccess && (
              <div className="alert alert-success" style={{ marginTop: 'var(--space-3)', fontSize: '0.8125rem' }}>
                {participantSuccess}
              </div>
            )}
            {workspaceMembers.filter((m) => m.userId !== user?.id).length === 0 && (
              <p className="field-hint" style={{ marginTop: 'var(--space-2)' }}>
                No other members found. Visit Settings → Workspace Members to load them first.
              </p>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
