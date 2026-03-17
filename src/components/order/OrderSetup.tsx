import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import type { Order, PayerBank, Person } from '../../types';
import { todayISO } from '../../lib/formatters';

interface Props {
  order: Order;
}

function normalizeBank(bank?: Partial<PayerBank> | null): PayerBank {
  return {
    bankName: bank?.bankName || '',
    accountNumber: bank?.accountNumber || '',
    beneficiary: bank?.beneficiary || '',
    branch: bank?.branch || '',
  };
}

function banksEqual(left: PayerBank, right: PayerBank): boolean {
  return (
    left.bankName === right.bankName &&
    left.accountNumber === right.accountNumber &&
    left.beneficiary === right.beneficiary &&
    (left.branch || '') === (right.branch || '')
  );
}

function getIncludedPeople(order: Order, people: Person[]): Person[] {
  const personIds = new Set<string>();

  for (const lot of order.lots) {
    for (const share of lot.shares) {
      if (share.shareGrams > 0) {
        personIds.add(share.personId);
      }
    }
  }

  if (order.payerId) {
    personIds.add(order.payerId);
  }

  return Array.from(personIds)
    .map((personId) => people.find((person) => person.id === personId) ?? null)
    .filter((person): person is Person => person !== null);
}

export function OrderSetup({ order }: Props) {
  const {
    people,
    updateOrder,
    setOrderPin,
    clearOrderPin,
    sessionUi,
    setOrderProtectionOpen,
  } = useAppStore();

  const [name, setName] = useState(order.name);
  const [orderDate, setOrderDate] = useState(order.orderDate || todayISO());
  const [payerId, setPayerId] = useState(order.payerId || '');
  const [bank, setBank] = useState<PayerBank>(normalizeBank(order.payerBank));
  const [bankOpen, setBankOpen] = useState(Boolean(
    order.payerBank?.bankName ||
    order.payerBank?.accountNumber ||
    order.payerBank?.beneficiary ||
    order.payerBank?.branch
  ));
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinSaving, setPinSaving] = useState(false);
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState('');

  const protectionOpen = sessionUi.orderProtectionOpen[order.id] ?? Boolean(order.pinRequired);
  const hydrationRef = useRef(true);
  const bankHydrationRef = useRef(true);

  const includedPeople = useMemo(() => getIncludedPeople(order, people), [order, people]);

  useEffect(() => {
    hydrationRef.current = true;
    bankHydrationRef.current = true;
    setName(order.name);
    setOrderDate(order.orderDate || todayISO());
    setPayerId(order.payerId || '');
    setBank(normalizeBank(order.payerBank));
    setBankOpen(Boolean(
      order.payerBank?.bankName ||
      order.payerBank?.accountNumber ||
      order.payerBank?.beneficiary ||
      order.payerBank?.branch
    ));
    setNewPin('');
    setConfirmPin('');
    setPinError('');
    setPinSuccess('');

    if (sessionUi.orderProtectionOpen[order.id] === undefined) {
      setOrderProtectionOpen(order.id, Boolean(order.pinRequired));
    }
  }, [order.id]);

  useEffect(() => {
    if (hydrationRef.current) {
      hydrationRef.current = false;
      return;
    }

    const trimmedName = name.trim();
    if (trimmedName === order.name) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void updateOrder(order.id, { name: trimmedName });
    }, 450);

    return () => window.clearTimeout(timeoutId);
  }, [name, order.id, order.name, updateOrder]);

  useEffect(() => {
    if (bankHydrationRef.current) {
      bankHydrationRef.current = false;
      return;
    }

    const normalizedOrderBank = normalizeBank(order.payerBank);
    if (banksEqual(bank, normalizedOrderBank)) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void updateOrder(order.id, { payerBank: bank });
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [bank, order.id, order.payerBank, updateOrder]);

  function flushNameSave() {
    const trimmedName = name.trim();
    setName(trimmedName);
    if (trimmedName !== order.name) {
      void updateOrder(order.id, { name: trimmedName });
    }
  }

  function flushBankSave() {
    const normalizedBank = normalizeBank(bank);
    setBank(normalizedBank);
    if (!banksEqual(normalizedBank, normalizeBank(order.payerBank))) {
      void updateOrder(order.id, { payerBank: normalizedBank });
    }
  }

  function handleBankChange(field: keyof PayerBank, value: string) {
    setBank((current) => ({ ...current, [field]: value }));
  }

  function handlePayerChange(nextPayerId: string) {
    setPayerId(nextPayerId);
    void updateOrder(order.id, { payerId: nextPayerId || null });
  }

  function handleProtectionToggle() {
    setOrderProtectionOpen(order.id, !protectionOpen);
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
      setOrderProtectionOpen(order.id, true);
      setNewPin('');
      setConfirmPin('');
      setPinSuccess('PIN enabled for this order.');
    } catch {
      setPinError('Failed to set PIN. Please try again.');
    } finally {
      setPinSaving(false);
    }
  }

  async function handleClearPin() {
    if (!confirm('Remove PIN protection from this order?')) return;
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

  return (
    <div className="wizard-step-stack">
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
              onChange={(event) => setName(event.target.value)}
              onBlur={flushNameSave}
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
              onChange={(event) => {
                setOrderDate(event.target.value);
                void updateOrder(order.id, { orderDate: event.target.value });
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
            onChange={(event) => handlePayerChange(event.target.value)}
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
              onChange={(event) => handleBankChange('bankName', event.target.value)}
              onBlur={flushBankSave}
              placeholder="e.g. FNB"
            />
          </div>
          <div className="field">
            <label className="field-label">Account number</label>
            <input
              className="input"
              value={bank.accountNumber}
              onChange={(event) => handleBankChange('accountNumber', event.target.value)}
              onBlur={flushBankSave}
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
              onChange={(event) => handleBankChange('beneficiary', event.target.value)}
              onBlur={flushBankSave}
              placeholder="Account holder name"
            />
          </div>
          <div className="field">
            <label className="field-label">Branch code</label>
            <input
              className="input"
              value={bank.branch || ''}
              onChange={(event) => handleBankChange('branch', event.target.value)}
              onBlur={flushBankSave}
              placeholder="Optional"
            />
          </div>
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel
        open={protectionOpen}
        onToggle={handleProtectionToggle}
        title="Order protection"
        summary={order.pinRequired ? 'PIN required for included people' : 'Optional'}
      >
        <p className="wizard-card-copy">
          If PIN protection is enabled, only people included in this order can open it, and the PIN will be required.
        </p>

        <div className="wizard-inline-note">
          <strong>Included automatically:</strong> buyers with grams in this order, plus the payer.
        </div>

        {includedPeople.length > 0 ? (
          <div className="wizard-protection-list">
            {includedPeople.map((person) => (
              <span key={person.id} className="wizard-badge wizard-badge-muted">
                {person.name}
              </span>
            ))}
          </div>
        ) : (
          <div className="wizard-inline-empty">
            <span>No one is included yet.</span>
            <span className="field-hint">Assign buyers or choose a payer first, then protection will follow automatically.</span>
          </div>
        )}

        <span className="field-hint">
          Access is matched automatically using the email on each included person. People without matching app accounts will still appear in the order, but they will not be able to open a PIN-protected order yet.
        </span>

        {order.pinRequired ? (
          <div className="wizard-inline-actions">
            <button className="btn btn-secondary" onClick={handleClearPin} disabled={pinSaving}>
              {pinSaving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Remove PIN'}
            </button>
          </div>
        ) : (
          <>
            <div className="wizard-card-grid">
              <div className="field">
                <label className="field-label">Order PIN</label>
                <input
                  className="input"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={newPin}
                  onChange={(event) => setNewPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
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
                  onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Repeat PIN"
                />
              </div>
            </div>

            <div className="wizard-inline-actions">
              <button
                className="btn btn-primary"
                onClick={handleSetPin}
                disabled={pinSaving || newPin.length < 4 || newPin !== confirmPin}
              >
                {pinSaving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Enable PIN protection'}
              </button>
            </div>
          </>
        )}

        {pinError && <div className="alert alert-error">{pinError}</div>}
        {pinSuccess && <div className="alert alert-success">{pinSuccess}</div>}
      </CollapsiblePanel>
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
