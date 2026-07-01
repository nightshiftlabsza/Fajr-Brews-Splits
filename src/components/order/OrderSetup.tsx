import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import type { Order, PayerBank, Person, Roaster } from '../../types';
import { todayISO } from '../../lib/formatters';
import { dedupePeopleById } from '../../lib/storeState';
import { createRoasterSnapshot } from '../../lib/roasters';
import { RoasterPicker } from '../roaster/RoasterPicker';

interface Props {
  order: Order;
  registerCommit?: (commit: (() => Promise<void>) | null) => void;
  onOrderChange?: (patch: Partial<Order>) => void | Promise<void>;
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

export function OrderSetup({ order, registerCommit, onOrderChange }: Props) {
  const {
    people,
    roasters,
    orders,
    accessStatus,
    roasterFeatureStatus,
    roasterFeatureMessage,
    updateOrder,
    createRoaster,
  } = useAppStore();
  const patchOrder = onOrderChange ?? ((patch: Partial<Order>) => updateOrder(order.id, patch));

  const [name, setName] = useState(order.name);
  const [orderDate, setOrderDate] = useState(order.orderDate || todayISO());
  const [selectedRoasterId, setSelectedRoasterId] = useState(order.roasterId || '');
  const [payerId, setPayerId] = useState(order.payerId || '');
  const [bank, setBank] = useState<PayerBank>(normalizeBank(order.payerBank));
  const [bankOpen, setBankOpen] = useState(Boolean(
    order.payerBank?.bankName ||
    order.payerBank?.accountNumber ||
    order.payerBank?.beneficiary ||
    order.payerBank?.branch
  ));
  const hydrationRef = useRef(true);
  const bankHydrationRef = useRef(true);

  const includedPeople = useMemo(() => getIncludedPeople(order, people), [order, people]);
  const canonicalPeople = useMemo(() => dedupePeopleById(people), [people]);

  useEffect(() => {
    hydrationRef.current = true;
    bankHydrationRef.current = true;
    setName(order.name);
    setOrderDate(order.orderDate || todayISO());
    setSelectedRoasterId(order.roasterId || '');
    setPayerId(order.payerId || '');
    setBank(normalizeBank(order.payerBank));
    setBankOpen(Boolean(
      order.payerBank?.bankName ||
      order.payerBank?.accountNumber ||
      order.payerBank?.beneficiary ||
      order.payerBank?.branch
    ));
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
      void patchOrder({ name: trimmedName });
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
      void patchOrder({ payerBank: bank });
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [bank, order.id, order.payerBank, updateOrder]);

  function flushNameSave() {
    const trimmedName = name.trim();
    setName(trimmedName);
    if (trimmedName !== order.name) {
      void patchOrder({ name: trimmedName });
    }
  }

  function flushBankSave() {
    const normalizedBank = normalizeBank(bank);
    setBank(normalizedBank);
    if (!banksEqual(normalizedBank, normalizeBank(order.payerBank))) {
      void patchOrder({ payerBank: normalizedBank });
    }
  }

  async function flushPendingSetupChanges() {
    const updates: Partial<Order> = {};
    const trimmedName = name.trim();
    const normalizedBank = normalizeBank(bank);
    const selectedRoaster = roasters.find((roaster) => roaster.id === selectedRoasterId) ?? null;
    const nextRoasterSnapshot = selectedRoaster ? createRoasterSnapshot(selectedRoaster) : null;

    if (trimmedName !== order.name) {
      updates.name = trimmedName;
    }
    if (orderDate !== order.orderDate) {
      updates.orderDate = orderDate;
    }
    if ((selectedRoasterId || null) !== order.roasterId) {
      updates.roasterId = selectedRoasterId || null;
      updates.roasterSnapshot = nextRoasterSnapshot;
    }
    if ((payerId || null) !== order.payerId) {
      updates.payerId = payerId || null;
    }
    if (!banksEqual(normalizedBank, normalizeBank(order.payerBank))) {
      updates.payerBank = normalizedBank;
    }

    setName(trimmedName);
    setBank(normalizedBank);

    if (Object.keys(updates).length > 0) {
      await patchOrder(updates);
    }
  }

  useEffect(() => {
    registerCommit?.(flushPendingSetupChanges);
    return () => registerCommit?.(null);
  }, [registerCommit, flushPendingSetupChanges]);

  function handleBankChange(field: keyof PayerBank, value: string) {
    setBank((current) => ({ ...current, [field]: value }));
  }

  function handlePayerChange(nextPayerId: string) {
    setPayerId(nextPayerId);
    void patchOrder({ payerId: nextPayerId || null });
  }

  function handleRoasterSelect(roaster: Roaster | null) {
    setSelectedRoasterId(roaster?.id ?? '');
    void patchOrder({
      roasterId: roaster?.id ?? null,
      roasterSnapshot: createRoasterSnapshot(roaster),
    });
  }

  async function handleCreateRoaster(data: { name: string; logoFile?: File | null }) {
    const roaster = await createRoaster(data);
    await patchOrder({
      roasterId: roaster.id,
      roasterSnapshot: createRoasterSnapshot(roaster),
    });
    setSelectedRoasterId(roaster.id);
    return roaster;
  }

  return (
    <div className="wizard-step-stack">
      <section className="wizard-panel">
        <div className="wizard-card-header">
          <div>
            <div className="section-label" style={{ marginBottom: 'var(--space-2)' }}>Step 1</div>
            <h3 className="wizard-card-title">Setup details</h3>
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
                void patchOrder({ orderDate: event.target.value });
              }}
            />
          </div>
        </div>

        <RoasterPicker
          orders={orders}
          roasters={roasters}
          selectedRoasterId={selectedRoasterId || null}
          selectedRoasterSnapshot={order.roasterSnapshot}
          featureStatus={roasterFeatureStatus}
          featureMessage={roasterFeatureMessage}
          canManageRoasters={accessStatus === 'member'}
          onSelectRoaster={handleRoasterSelect}
          onCreateRoaster={handleCreateRoaster}
        />

        <div className="field">
          <label className="field-label" htmlFor="payer">Payer</label>
          <select
            id="payer"
            className="select"
            value={payerId}
            onChange={(event) => handlePayerChange(event.target.value)}
          >
            <option value="">Select payer</option>
            {canonicalPeople.map((person) => (
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
        summary={bankOpen ? 'Optional payment details for settlement requests' : 'Optional'}
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

      <section className="wizard-panel">
        <div className="wizard-card-header">
          <div>
            <div className="section-label" style={{ marginBottom: 'var(--space-2)' }}>Privacy</div>
            <div className="wizard-card-title">Finalized order visibility</div>
          </div>
        </div>
        <p className="wizard-card-copy">
          Finalized orders are visible to workspace members and the people included in this order. No extra PIN is needed to view them.
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
          Participant visibility is matched automatically using saved email first, then phone, then a cautious confirmed name match as a last resort. People without a linked app account will still appear in the order, but they will need to confirm their profile before the archive becomes visible.
        </span>
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
