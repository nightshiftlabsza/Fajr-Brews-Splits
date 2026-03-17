import { useCallback, useEffect, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import type { Order, PayerBank } from '../../types';
import { todayISO } from '../../lib/formatters';

interface Props {
  order: Order;
}

export function OrderSetup({ order }: Props) {
  const {
    people,
    updateOrder,
    setOrderPin,
    clearOrderPin,
    addOrderParticipant,
    user,
    workspaceMembers,
    fetchWorkspaceMembers,
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
  const [saving, setSaving] = useState(false);

  const [bankOpen, setBankOpen] = useState(Boolean(
    order.payerBank?.bankName ||
    order.payerBank?.accountNumber ||
    order.payerBank?.beneficiary ||
    order.payerBank?.branch
  ));
  const [pinOpen, setPinOpen] = useState(Boolean(order.pinRequired));

  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinSaving, setPinSaving] = useState(false);
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState('');

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
    setBankOpen(Boolean(
      order.payerBank?.bankName ||
      order.payerBank?.accountNumber ||
      order.payerBank?.beneficiary ||
      order.payerBank?.branch
    ));
    setPinOpen(Boolean(order.pinRequired));
    setNewPin('');
    setConfirmPin('');
    setPinError('');
    setPinSuccess('');
    setParticipantError('');
    setParticipantSuccess('');
  }, [order]);

  useEffect(() => {
    void fetchWorkspaceMembers();
  }, [fetchWorkspaceMembers]);

  const save = useCallback(async (changes: Partial<Order>) => {
    setSaving(true);
    try {
      await updateOrder(order.id, changes);
    } finally {
      setSaving(false);
    }
  }, [order.id, updateOrder]);

  function handleBankChange(field: keyof PayerBank, value: string) {
    const nextBank = { ...bank, [field]: value };
    setBank(nextBank);
  }

  function handlePayerChange(nextPayerId: string) {
    setPayerId(nextPayerId);
    save({ payerId: nextPayerId });
  }

  async function handleSetPin() {
    if (newPin.length < 4 || newPin.length > 6) {
      setPinError('PIN must be 4-6 digits.');
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
      setPinSuccess('PIN set. This order now requires a PIN from history.');
    } catch {
      setPinError('Failed to set PIN. Please try again.');
    } finally {
      setPinSaving(false);
    }
  }

  async function handleClearPin() {
    if (!confirm('Remove PIN from this order? Authorized participants will still keep access.')) return;
    setPinSaving(true);
    setPinError('');
    setPinSuccess('');
    try {
      await clearOrderPin(order.id);
      setPinSuccess('PIN removed.');
      setNewPin('');
      setConfirmPin('');
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
      const member = workspaceMembers.find((item) => item.userId === addUserId);
      setParticipantSuccess(`${member?.fullName || member?.email || 'Member'} can now open this order from history.`);
      setAddUserId('');
    } catch {
      setParticipantError('Failed to add participant. Please try again.');
    } finally {
      setAddingParticipant(false);
    }
  }

  return (
    <div className="wizard-step-stack">
      {saving && (
        <div className="wizard-inline-status">
          <div className="spinner" style={{ width: 12, height: 12 }} />
          Saving changes...
        </div>
      )}

      <section className="wizard-panel">
        <div className="wizard-card-header">
          <div>
            <div className="section-label" style={{ marginBottom: 'var(--space-2)' }}>Step 1</div>
            <h3 className="wizard-card-title">Setup details</h3>
            <p className="wizard-card-copy">
              Keep this light. Set the basics, then move straight into coffee lots and buyer assignment.
            </p>
          </div>
        </div>

        <div className="wizard-card-grid">
          <div className="field">
            <label className="field-label" htmlFor="order-name">Order name</label>
            <input
              id="order-name"
              className="input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => save({ name: name.trim() })}
              placeholder="e.g. March Import 2026"
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="order-date">Order date</label>
            <input
              id="order-date"
              className="input"
              type="date"
              value={orderDate}
              onChange={(e) => {
                setOrderDate(e.target.value);
                void save({ orderDate: e.target.value });
              }}
            />
          </div>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="payer">Payer</label>
          <select
            id="payer"
            className="select"
            value={payerId}
            onChange={(e) => handlePayerChange(e.target.value)}
          >
            <option value="">Select payer</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
          <span className="field-hint">
            The payer absorbs the final rounding remainder after all other people are rounded down.
          </span>
        </div>
      </section>

      <CollapsiblePanel
        open={bankOpen}
        onToggle={() => setBankOpen((current) => !current)}
        title="Bank details"
        summary={bankOpen ? 'Optional payment details for invoices' : 'Optional'}
      >
        <div className="wizard-card-grid">
          <div className="field">
            <label className="field-label">Bank name</label>
            <input
              className="input"
              value={bank.bankName}
              onChange={(e) => handleBankChange('bankName', e.target.value)}
              onBlur={() => save({ payerBank: bank })}
              placeholder="e.g. FNB"
            />
          </div>
          <div className="field">
            <label className="field-label">Account number</label>
            <input
              className="input"
              value={bank.accountNumber}
              onChange={(e) => handleBankChange('accountNumber', e.target.value)}
              onBlur={() => save({ payerBank: bank })}
              placeholder="e.g. 62xxxxxxxxx"
            />
          </div>
        </div>
        <div className="wizard-card-grid">
          <div className="field">
            <label className="field-label">Beneficiary</label>
            <input
              className="input"
              value={bank.beneficiary}
              onChange={(e) => handleBankChange('beneficiary', e.target.value)}
              onBlur={() => save({ payerBank: bank })}
              placeholder="Account holder name"
            />
          </div>
          <div className="field">
            <label className="field-label">Branch code</label>
            <input
              className="input"
              value={bank.branch || ''}
              onChange={(e) => handleBankChange('branch', e.target.value)}
              onBlur={() => save({ payerBank: bank })}
              placeholder="Optional"
            />
          </div>
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel
        open={pinOpen}
        onToggle={() => setPinOpen((current) => !current)}
        title="PIN protection"
        summary={order.pinRequired ? 'PIN currently enabled' : 'Optional'}
      >
        <p className="wizard-card-copy" style={{ marginBottom: 'var(--space-4)' }}>
          Use a short PIN if you want another layer before an authorized participant can open the order from history.
        </p>

        {order.pinRequired ? (
          <div className="wizard-inline-actions">
            <button className="btn btn-secondary" onClick={handleClearPin} disabled={pinSaving}>
              {pinSaving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Remove PIN'}
            </button>
          </div>
        ) : (
          <div className="wizard-card-grid">
            <div className="field">
              <label className="field-label">Order PIN</label>
              <input
                className="input"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="4 to 6 digits"
              />
            </div>
            <div className="field">
              <label className="field-label">Confirm PIN</label>
              <input
                className="input"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Repeat PIN"
              />
            </div>
          </div>
        )}

        {!order.pinRequired && (
          <div className="wizard-inline-actions">
            <button
              className="btn btn-primary"
              onClick={handleSetPin}
              disabled={pinSaving || newPin.length < 4 || newPin !== confirmPin}
            >
              {pinSaving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Set PIN'}
            </button>
          </div>
        )}

        {pinError && <div className="alert alert-error">{pinError}</div>}
        {pinSuccess && <div className="alert alert-success">{pinSuccess}</div>}
      </CollapsiblePanel>

      <section className="wizard-panel">
        <div className="wizard-card-header">
          <div>
            <div className="wizard-card-title">Order access</div>
            <p className="wizard-card-copy">
              Order history access is restricted to relevant authorized users. You can add extra workspace members here without exposing fake privacy modes.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <select
            className="select"
            value={addUserId}
            onChange={(e) => setAddUserId(e.target.value)}
            style={{ flex: 1, minWidth: 220 }}
          >
            <option value="">Select workspace member</option>
            {workspaceMembers
              .filter((member) => member.userId !== user?.id)
              .map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.fullName || member.email || member.userId}
                </option>
              ))}
          </select>

          <button
            className="btn btn-secondary"
            onClick={handleAddParticipant}
            disabled={!addUserId || addingParticipant}
          >
            {addingParticipant ? <span className="spinner" style={{ width: 16, height: 16 }} /> : 'Add access'}
          </button>
        </div>

        <span className="field-hint">
          Participants added here can find the order in history. PIN protection, if enabled, still applies on open.
        </span>

        {participantError && <div className="alert alert-error">{participantError}</div>}
        {participantSuccess && <div className="alert alert-success">{participantSuccess}</div>}
      </section>
    </div>
  );
}

interface CollapsiblePanelProps {
  open: boolean;
  onToggle: () => void;
  title: string;
  summary: string;
  children: React.ReactNode;
}

function CollapsiblePanel({ open, onToggle, title, summary, children }: CollapsiblePanelProps) {
  return (
    <section className="wizard-panel wizard-collapsible">
      <button className="wizard-collapsible-trigger" onClick={onToggle}>
        <div>
          <div className="wizard-card-title">{title}</div>
          <div className="wizard-collapsible-summary">{summary}</div>
        </div>
        <span className={`wizard-chevron ${open ? 'open' : ''}`}>⌄</span>
      </button>
      {open && <div className="wizard-collapsible-body">{children}</div>}
    </section>
  );
}
