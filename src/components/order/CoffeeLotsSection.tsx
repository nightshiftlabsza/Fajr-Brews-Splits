import { useMemo, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import type { CoffeeLot, Order, Person, ShareLine } from '../../types';
import { remainingGrams } from '../../lib/calculations';
import { formatGrams } from '../../lib/formatters';
import { getInitialShareGramsForNewBuyer, getLotAssignmentMode } from '../../lib/orderWizard';
import { PersonEditor, type PersonFormValues } from '../people/PersonEditor';

function genId() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

interface Props {
  order: Order;
}

interface LotFormState {
  name: string;
  foreignPricePerBag: string;
  gramsPerBag: string;
  quantity: string;
}

const emptyLotForm: LotFormState = {
  name: '',
  foreignPricePerBag: '',
  gramsPerBag: '250',
  quantity: '1',
};

export function CoffeeLotsSection({ order }: Props) {
  const { people, addPerson, updateOrder } = useAppStore();
  const [editingLotId, setEditingLotId] = useState<string | 'new' | null>(null);
  const [lotForm, setLotForm] = useState<LotFormState>(emptyLotForm);
  const [formError, setFormError] = useState('');
  const [buyerModalLotId, setBuyerModalLotId] = useState<string | null>(null);
  const [buyerError, setBuyerError] = useState('');
  const [buyerSaving, setBuyerSaving] = useState(false);

  const activeBuyerLot = buyerModalLotId
    ? order.lots.find((lot) => lot.id === buyerModalLotId) ?? null
    : null;

  const lotCountLabel = useMemo(() => (
    `${order.lots.length} coffee lot${order.lots.length === 1 ? '' : 's'}`
  ), [order.lots.length]);

  function openNew() {
    setLotForm(emptyLotForm);
    setFormError('');
    setEditingLotId('new');
  }

  function openEdit(lot: CoffeeLot) {
    setLotForm({
      name: lot.name,
      foreignPricePerBag: String(lot.foreignPricePerBag),
      gramsPerBag: String(lot.gramsPerBag),
      quantity: String(lot.quantity),
    });
    setFormError('');
    setEditingLotId(lot.id);
  }

  function saveLot() {
    const gramsPerBag = parseInt(lotForm.gramsPerBag, 10);
    const quantity = parseInt(lotForm.quantity, 10);
    const foreignPricePerBag = parseFloat(lotForm.foreignPricePerBag);

    if (!lotForm.name.trim()) return setFormError('Coffee name is required.');
    if (!Number.isInteger(gramsPerBag) || gramsPerBag < 1) return setFormError('Grams per bag must be an integer >= 1.');
    if (!Number.isInteger(quantity) || quantity < 1) return setFormError('Quantity must be an integer >= 1.');
    if (!Number.isFinite(foreignPricePerBag) || foreignPricePerBag <= 0) return setFormError('Foreign list price per bag must be greater than zero.');
    setFormError('');

    let nextLots: CoffeeLot[];
    if (editingLotId === 'new') {
      nextLots = [
        ...order.lots,
        {
          id: genId(),
          name: lotForm.name.trim(),
          foreignPricePerBag,
          gramsPerBag,
          quantity,
          shares: [],
        },
      ];
    } else {
      nextLots = order.lots.map((lot) => {
        if (lot.id !== editingLotId) return lot;
        const totalChanged = lot.gramsPerBag * lot.quantity !== gramsPerBag * quantity;
        return {
          ...lot,
          name: lotForm.name.trim(),
          foreignPricePerBag,
          gramsPerBag,
          quantity,
          shares: totalChanged ? [] : lot.shares,
        };
      });
    }

    void updateOrder(order.id, { lots: nextLots });
    setEditingLotId(null);
  }

  function deleteLot(lotId: string) {
    void updateOrder(order.id, {
      lots: order.lots.filter((lot) => lot.id !== lotId),
    });
  }

  function updateShares(lotId: string, shares: ShareLine[]) {
    void updateOrder(order.id, {
      lots: order.lots.map((lot) => (lot.id === lotId ? { ...lot, shares } : lot)),
    });
  }

  async function handleCreateBuyer(values: PersonFormValues) {
    if (!activeBuyerLot) return;
    if (!values.name.trim()) {
      setBuyerError('Name is required.');
      return;
    }

    setBuyerSaving(true);
    setBuyerError('');
    try {
      const person = await addPerson({
        name: values.name.trim(),
        phone: values.phone || undefined,
        email: values.email || undefined,
        note: values.note || undefined,
      });

      const freshLot = order.lots.find((lot) => lot.id === activeBuyerLot.id);
      if (freshLot) {
        updateShares(freshLot.id, [
          ...freshLot.shares,
          {
            id: genId(),
            personId: person.id,
            shareGrams: getInitialShareGramsForNewBuyer(freshLot),
          },
        ]);
      }

      setBuyerModalLotId(null);
    } catch (error) {
      setBuyerError(error instanceof Error ? error.message : 'Failed to add buyer.');
    } finally {
      setBuyerSaving(false);
    }
  }

  return (
    <div className="wizard-step-stack">
      {buyerModalLotId && activeBuyerLot && (
        <div className="wizard-modal-backdrop" onClick={() => setBuyerModalLotId(null)}>
          <div
            className="wizard-modal-sheet"
            onClick={(event) => event.stopPropagation()}
          >
            <PersonEditor
              title="Add new buyer"
              description={`This buyer will be added to the shared directory and inserted directly into "${activeBuyerLot.name || 'this coffee lot'}".`}
              error={buyerError}
              saving={buyerSaving}
              submitLabel="Add buyer"
              onSave={handleCreateBuyer}
              onCancel={() => setBuyerModalLotId(null)}
            />
          </div>
        </div>
      )}

      <section className="wizard-panel">
        <div className="wizard-card-header">
          <div>
            <div className="section-label" style={{ marginBottom: 'var(--space-2)' }}>Step 2</div>
            <h3 className="wizard-card-title">Add coffees and assign buyers</h3>
            <p className="wizard-card-copy">
              Add each coffee, then decide who is ordering it. Use one buyer for own bags or split grams across multiple buyers for shared bags.
            </p>
          </div>
          <div className="wizard-badge wizard-badge-muted">{lotCountLabel}</div>
        </div>
      </section>

      {order.lots.length === 0 && editingLotId !== 'new' && (
        <section className="wizard-panel wizard-empty-panel">
          <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
            <div className="empty-state-icon">☕</div>
            <h3>No coffee lots yet</h3>
            <p>Add your first coffee lot, then assign buyers inside that same lot.</p>
            <button className="btn btn-primary" onClick={openNew}>
              Add first coffee lot
            </button>
          </div>
        </section>
      )}

      {order.lots.map((lot) => (
        <LotCard
          key={lot.id}
          lot={lot}
          people={people}
          isEditing={editingLotId === lot.id}
          lotForm={lotForm}
          formError={formError}
          setLotForm={setLotForm}
          onEdit={() => openEdit(lot)}
          onSave={saveLot}
          onCancel={() => setEditingLotId(null)}
          onDelete={() => deleteLot(lot.id)}
          onSharesChange={(shares) => updateShares(lot.id, shares)}
          onAddNewBuyer={() => {
            setBuyerError('');
            setBuyerModalLotId(lot.id);
          }}
        />
      ))}

      {editingLotId === 'new' && (
        <section className="wizard-panel">
          <div className="section-label" style={{ marginBottom: 'var(--space-3)' }}>New coffee lot</div>
          <LotForm
            form={lotForm}
            error={formError}
            onChange={setLotForm}
            onSave={saveLot}
            onCancel={() => setEditingLotId(null)}
          />
        </section>
      )}

      {editingLotId === null && order.lots.length > 0 && (
        <div className="wizard-inline-actions">
          <button className="btn btn-secondary" onClick={openNew}>
            Add another coffee lot
          </button>
        </div>
      )}
    </div>
  );
}

interface LotCardProps {
  lot: CoffeeLot;
  people: Person[];
  isEditing: boolean;
  lotForm: LotFormState;
  formError: string;
  setLotForm: (form: LotFormState) => void;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onSharesChange: (shares: ShareLine[]) => void;
  onAddNewBuyer: () => void;
}

function LotCard({
  lot,
  people,
  isEditing,
  lotForm,
  formError,
  setLotForm,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  onSharesChange,
  onAddNewBuyer,
}: LotCardProps) {
  const totalGrams = lot.gramsPerBag * lot.quantity;
  const remainder = remainingGrams(lot);
  const mode = getLotAssignmentMode(lot);

  return (
    <section className="wizard-panel">
      {isEditing ? (
        <>
          <div className="section-label" style={{ marginBottom: 'var(--space-3)' }}>Edit coffee lot</div>
          <LotForm
            form={lotForm}
            error={formError}
            onChange={setLotForm}
            onSave={onSave}
            onCancel={onCancel}
          />
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <div className="wizard-card-header">
            <div>
              <div className="wizard-card-title">{lot.name}</div>
              <p className="wizard-card-copy" style={{ marginTop: 'var(--space-2)' }}>
                {lot.quantity} x {formatGrams(lot.gramsPerBag)} bag • {formatGrams(totalGrams)} total • {lot.foreignPricePerBag} list price per bag
              </p>
            </div>

            <div className="wizard-chip-row">
              <span className={`wizard-badge ${mode === 'own' ? 'wizard-badge-accent' : mode === 'split' ? 'wizard-badge-info' : 'wizard-badge-muted'}`}>
                {mode === 'own' ? 'Own bag' : mode === 'split' ? 'Split bag' : 'Unassigned'}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={onEdit}>Edit</button>
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-unpaid)' }} onClick={onDelete}>Delete</button>
            </div>
          </div>

          <div className="wizard-subsection">
            <div className="wizard-subsection-header">
              <div>
                <div className="section-label" style={{ marginBottom: 'var(--space-2)' }}>Who is ordering this?</div>
                <p className="wizard-card-copy">
                  Use one buyer for an own bag or split grams between multiple buyers for a shared bag.
                </p>
              </div>
              <GramsBadge remaining={remainder} total={totalGrams} />
            </div>

            <SharesManager
              lot={lot}
              people={people}
              onChange={onSharesChange}
              onAddNewBuyer={onAddNewBuyer}
            />
          </div>

          <div className={`wizard-allocation-note ${remainder === 0 ? 'is-complete' : remainder < 0 ? 'is-error' : 'is-warning'}`}>
            {remainder === 0
              ? `Balanced. All ${formatGrams(totalGrams)} are assigned.`
              : remainder > 0
                ? `${formatGrams(remainder)} still need to be assigned.`
                : `${formatGrams(Math.abs(remainder))} are over-assigned. Adjust buyer grams to continue.`}
          </div>
        </div>
      )}
    </section>
  );
}

interface LotFormProps {
  form: LotFormState;
  error: string;
  onChange: (form: LotFormState) => void;
  onSave: () => void;
  onCancel: () => void;
}

function LotForm({ form, error, onChange, onSave, onCancel }: LotFormProps) {
  function setField(key: keyof LotFormState) {
    return (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...form, [key]: e.target.value });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div className="field">
        <label className="field-label">Coffee name</label>
        <input
          className="input"
          value={form.name}
          onChange={setField('name')}
          placeholder="e.g. Ethiopian Yirgacheffe"
          autoFocus
        />
      </div>

      <div className="wizard-card-grid">
        <div className="field">
          <label className="field-label">Foreign list price per bag</label>
          <input
            className="input"
            type="number"
            value={form.foreignPricePerBag}
            onChange={setField('foreignPricePerBag')}
            min="0.01"
            step="0.01"
            placeholder="18.50"
          />
        </div>
        <div className="field">
          <label className="field-label">Grams per bag</label>
          <input
            className="input"
            type="number"
            value={form.gramsPerBag}
            onChange={setField('gramsPerBag')}
            min="1"
            step="1"
            placeholder="250"
          />
        </div>
      </div>

      <div className="field" style={{ maxWidth: 220 }}>
        <label className="field-label">Quantity</label>
        <input
          className="input"
          type="number"
          value={form.quantity}
          onChange={setField('quantity')}
          min="1"
          step="1"
          placeholder="1"
        />
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={onSave}>Save coffee lot</button>
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

interface SharesManagerProps {
  lot: CoffeeLot;
  people: Person[];
  onChange: (shares: ShareLine[]) => void;
  onAddNewBuyer: () => void;
}

function SharesManager({ lot, people, onChange, onAddNewBuyer }: SharesManagerProps) {
  const totalGrams = lot.gramsPerBag * lot.quantity;
  const shares = lot.shares;

  function addShare() {
    const usedIds = shares.map((share) => share.personId);
    const nextPerson = people.find((person) => !usedIds.includes(person.id));
    if (!nextPerson) return;
    onChange([
      ...shares,
      {
        id: genId(),
        personId: nextPerson.id,
        shareGrams: getInitialShareGramsForNewBuyer(lot),
      },
    ]);
  }

  function updateShare(shareId: string, field: 'personId' | 'shareGrams', value: string) {
    onChange(shares.map((share) => {
      if (share.id !== shareId) return share;
      if (field === 'shareGrams') {
        return { ...share, shareGrams: parseInt(value, 10) || 0 };
      }
      return { ...share, personId: value };
    }));
  }

  function removeShare(shareId: string) {
    onChange(shares.filter((share) => share.id !== shareId));
  }

  function splitEqually() {
    if (people.length === 0) return;
    const count = people.length;
    const base = Math.floor(totalGrams / count);
    const remainder = totalGrams - base * count;
    onChange(people.map((person, index) => ({
      id: shares.find((share) => share.personId === person.id)?.id || genId(),
      personId: person.id,
      shareGrams: base + (index === 0 ? remainder : 0),
    })));
  }

  function assignRemainderToLast() {
    if (shares.length === 0) return;
    const remainder = remainingGrams(lot);
    const lastShare = shares[shares.length - 1];
    onChange(shares.map((share) =>
      share.id === lastShare.id
        ? { ...share, shareGrams: Math.max(0, share.shareGrams + remainder) }
        : share
    ));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {shares.length === 0 && (
        <div className="wizard-inline-empty">
          <span>No buyers assigned yet.</span>
          <span className="field-hint">Start with one buyer for an own bag or add multiple for a split bag.</span>
        </div>
      )}

      {shares.map((share) => (
        <div key={share.id} className="buyer-row">
          <select
            className="select"
            value={share.personId}
            onChange={(e) => updateShare(share.id, 'personId', e.target.value)}
            style={{ flex: 1 }}
          >
            {people.map((person) => (
              <option
                key={person.id}
                value={person.id}
                disabled={shares.some((candidate) => candidate.id !== share.id && candidate.personId === person.id)}
              >
                {person.name}
              </option>
            ))}
          </select>

          <div className="buyer-grams-field">
            <input
              className="input"
              type="number"
              value={share.shareGrams || ''}
              onChange={(e) => updateShare(share.id, 'shareGrams', e.target.value)}
              min="0"
              step="1"
              placeholder="g"
            />
            <span className="buyer-grams-suffix">g</span>
          </div>

          <button className="btn btn-ghost btn-icon" onClick={() => removeShare(share.id)} title="Remove buyer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}

      <div className="wizard-chip-row">
        {shares.length < people.length && (
          <button className="btn btn-secondary btn-sm" onClick={addShare}>
            Add buyer
          </button>
        )}
        <button className="btn btn-ghost btn-sm" onClick={onAddNewBuyer}>
          Add new buyer
        </button>
        {people.length > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={splitEqually}>
            Split equally
          </button>
        )}
        {shares.length > 0 && remainingGrams(lot) !== 0 && (
          <button className="btn btn-ghost btn-sm" onClick={assignRemainderToLast}>
            Assign remainder
          </button>
        )}
      </div>
    </div>
  );
}

function GramsBadge({ remaining, total }: { remaining: number; total: number }) {
  const label = remaining === 0
    ? `Balanced • ${formatGrams(total)}`
    : remaining > 0
      ? `${formatGrams(remaining)} left`
      : `${formatGrams(Math.abs(remaining))} over`;

  return (
    <span className={`grams-badge ${remaining === 0 ? 'grams-badge-ok' : remaining > 0 ? 'grams-badge-warn' : 'grams-badge-error'}`}>
      {label}
    </span>
  );
}
