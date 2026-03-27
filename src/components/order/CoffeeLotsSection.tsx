import { useMemo, useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import type { Bag, BagBuyer, BagSplitMode, CoffeeLot, Order, Person } from '../../types';
import { formatGrams } from '../../lib/formatters';
import { getCanonicalPeopleOptions } from '../../lib/peopleOptions';
import {
  normalizeLotToBags,
  serializeLotFromBags,
  createUnassignedBag,
  createUnassignedBags,
  recalculateBagGrams,
  inferSplitMode,
  applyAllocationToBags,
  duplicateBag,
  getBagStatus,
  type LotBagStatus,
} from '../../lib/orderWizard';
import { PersonEditor, type PersonFormValues } from '../people/PersonEditor';

function genId() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

function summarizeNames(names: string[], limit = 3): string {
  if (names.length === 0) return 'No buyers assigned yet';
  if (names.length <= limit) return names.join(', ');
  return `${names.slice(0, limit).join(', ')} +${names.length - limit} more`;
}

function getPreferredExpandedLotId(lots: CoffeeLot[]): string | null {
  const firstIncomplete = lots.find((lot) => {
    const bags = normalizeLotToBags(lot);
    return getBagStatus(bags, lot.gramsPerBag).tone !== 'complete';
  });
  return firstIncomplete?.id ?? lots[lots.length - 1]?.id ?? null;
}

function orderPeopleForBag(people: Person[], bags: Bag[], recentBuyerIds: string[]): Person[] {
  return getCanonicalPeopleOptions(
    people,
    bags.flatMap((bag) => bag.buyers.map((b) => b.personId).filter(Boolean)),
    recentBuyerIds,
  );
}

function getBagDisplayLabel(bag: Bag, gramsPerBag: number, people: Person[]): string {
  if (bag.splitMode === 'unassigned') return 'Unassigned';
  const names = bag.buyers
    .filter((b) => b.personId.trim())
    .map((b) => people.find((p) => p.id === b.personId)?.name || 'Unknown');

  if (bag.splitMode === 'full') return names[0] || 'Unassigned';
  if (bag.splitMode === 'equal') {
    return `${names.join(' + ')} (equal ${bag.buyers.map((b) => `${b.grams}g`).join('/')})`;
  }
  return `${names.join(' + ')} (${bag.buyers.map((b) => `${b.grams}g`).join('/')})`;
}

function getBagToneLabel(bag: Bag, gramsPerBag: number): { label: string; tone: 'complete' | 'warning' | 'info' } {
  if (bag.splitMode === 'unassigned') return { label: 'Needs buyer', tone: 'warning' };
  if (bag.splitMode === 'full') {
    if (bag.buyers.length === 1 && bag.buyers[0].personId.trim() && bag.buyers[0].grams === gramsPerBag) {
      return { label: 'Full bag', tone: 'complete' };
    }
    return { label: 'Needs buyer', tone: 'warning' };
  }
  if (bag.splitMode === 'equal' || bag.splitMode === 'custom') {
    const total = bag.buyers.reduce((s, b) => s + b.grams, 0);
    const allValid = bag.buyers.length >= 2 &&
      bag.buyers.every((b) => b.personId.trim() && b.grams > 0) &&
      total === gramsPerBag;
    if (allValid) return { label: bag.splitMode === 'equal' ? 'Equal split' : 'Custom split', tone: 'complete' };
    return { label: 'Split needs attention', tone: 'warning' };
  }
  return { label: 'Assigned', tone: 'complete' };
}

// ─── Main Component ──────────────────────────────────────────

interface Props {
  order: Order;
}

interface BuyerModalTarget {
  lotId: string;
  bagId: string;
}

interface LotFormState {
  name: string;
  foreignPricePerBag: string;
  gramsPerBag: string;
  initialBagCount: string;
}

const emptyLotForm: LotFormState = {
  name: '',
  foreignPricePerBag: '',
  gramsPerBag: '250',
  initialBagCount: '1',
};

export function CoffeeLotsSection({ order }: Props) {
  const { people, addPerson, updateOrder } = useAppStore();
  const [editingLotId, setEditingLotId] = useState<string | 'new' | null>(null);
  const [expandedLotId, setExpandedLotId] = useState<string | null>(() => getPreferredExpandedLotId(order.lots));
  const [lotForm, setLotForm] = useState<LotFormState>(emptyLotForm);
  const [formError, setFormError] = useState('');
  const [buyerModalTarget, setBuyerModalTarget] = useState<BuyerModalTarget | null>(null);
  const [buyerError, setBuyerError] = useState('');
  const [buyerSaving, setBuyerSaving] = useState(false);
  const [recentBuyerIds, setRecentBuyerIds] = useState<string[]>([]);

  useEffect(() => {
    if (editingLotId === 'new') return;
    if (expandedLotId === null) return;
    if (expandedLotId && order.lots.some((lot) => lot.id === expandedLotId)) return;
    setExpandedLotId(getPreferredExpandedLotId(order.lots));
  }, [editingLotId, expandedLotId, order.lots]);

  const activeBuyerLot = buyerModalTarget
    ? order.lots.find((lot) => lot.id === buyerModalTarget.lotId) ?? null
    : null;

  const activeBuyerBag = activeBuyerLot && buyerModalTarget
    ? normalizeLotToBags(activeBuyerLot).find((bag) => bag.id === buyerModalTarget.bagId) ?? null
    : null;

  const lotCountLabel = useMemo(() => (
    `${order.lots.length} coffee lot${order.lots.length === 1 ? '' : 's'}`
  ), [order.lots.length]);

  function rememberBuyer(personId: string) {
    if (!personId) return;
    setRecentBuyerIds((current) => [personId, ...current.filter((c) => c !== personId)]);
  }

  function openNew() {
    setLotForm(emptyLotForm);
    setFormError('');
    setExpandedLotId(null);
    setEditingLotId('new');
  }

  function openEdit(lot: CoffeeLot) {
    const bags = normalizeLotToBags(lot);
    setLotForm({
      name: lot.name,
      foreignPricePerBag: String(lot.foreignPricePerBag),
      gramsPerBag: String(lot.gramsPerBag),
      initialBagCount: String(bags.length),
    });
    setFormError('');
    setExpandedLotId(lot.id);
    setEditingLotId(lot.id);
  }

  function saveLot() {
    const gramsPerBag = parseInt(lotForm.gramsPerBag, 10);
    const initialBagCount = parseInt(lotForm.initialBagCount, 10);
    const foreignPricePerBag = parseFloat(lotForm.foreignPricePerBag);

    if (!lotForm.name.trim()) return setFormError('Coffee name is required.');
    if (!Number.isInteger(gramsPerBag) || gramsPerBag < 1) return setFormError('Grams per bag must be an integer >= 1.');
    if (!Number.isFinite(foreignPricePerBag) || foreignPricePerBag <= 0) return setFormError('Foreign list price per bag must be greater than zero.');

    if (editingLotId === 'new') {
      if (!Number.isInteger(initialBagCount) || initialBagCount < 1) return setFormError('Initial bag count must be at least 1.');
      const newBags = createUnassignedBags(initialBagCount);
      const serialized = serializeLotFromBags(newBags);
      const newLotId = genId();
      void updateOrder(order.id, {
        lots: [
          ...order.lots,
          {
            id: newLotId,
            name: lotForm.name.trim(),
            foreignPricePerBag,
            gramsPerBag,
            ...serialized,
          },
        ],
      });
      setExpandedLotId(newLotId);
      setEditingLotId(null);
      setFormError('');
      return;
    }

    const existingLot = order.lots.find((lot) => lot.id === editingLotId);
    if (!existingLot) {
      setFormError('Could not find the coffee lot you are editing.');
      return;
    }

    let nextBags = normalizeLotToBags(existingLot);

    if (existingLot.gramsPerBag !== gramsPerBag) {
      // Grams per bag changed — recalculate full/equal bags, reset custom bags
      const hasCustom = nextBags.some((b) => b.splitMode === 'custom');
      if (hasCustom && !confirm('Changing grams per bag will reset custom split bags. Continue?')) {
        return;
      }
      nextBags = nextBags.map((bag) => {
        if (bag.splitMode === 'custom') {
          return { ...bag, splitMode: 'unassigned' as BagSplitMode, buyers: [] };
        }
        return recalculateBagGrams(bag, gramsPerBag);
      });
    }

    const serialized = serializeLotFromBags(nextBags);
    void updateOrder(order.id, {
      lots: order.lots.map((lot) => (lot.id === editingLotId
        ? {
            ...lot,
            name: lotForm.name.trim(),
            foreignPricePerBag,
            gramsPerBag,
            ...serialized,
          }
        : lot)),
    });
    setExpandedLotId(existingLot.id);
    setEditingLotId(null);
    setFormError('');
  }

  function deleteLot(lotId: string) {
    const remainingLots = order.lots.filter((lot) => lot.id !== lotId);
    void updateOrder(order.id, { lots: remainingLots });
    if (editingLotId === lotId) setEditingLotId(null);
    if (expandedLotId === lotId) setExpandedLotId(getPreferredExpandedLotId(remainingLots));
  }

  function updateBags(lotId: string, bags: Bag[], touchedPersonIds: string[] = []) {
    touchedPersonIds.forEach(rememberBuyer);
    const serialized = serializeLotFromBags(bags);
    void updateOrder(order.id, {
      lots: order.lots.map((lot) => (lot.id === lotId ? { ...lot, ...serialized } : lot)),
    });
  }

  async function handleCreateBuyer(values: PersonFormValues) {
    if (!activeBuyerLot || !activeBuyerBag) return;
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

      const nextBags = normalizeLotToBags(activeBuyerLot).map((bag) => {
        if (bag.id !== activeBuyerBag.id) return bag;

        if (bag.splitMode === 'equal' || bag.splitMode === 'custom') {
          const newBuyer: BagBuyer = { id: genId(), personId: person.id, grams: 0 };
          const updatedBag: Bag = { ...bag, buyers: [...bag.buyers, newBuyer] };
          if (bag.splitMode === 'equal') {
            return recalculateBagGrams({ ...updatedBag, splitMode: 'equal' }, activeBuyerLot.gramsPerBag);
          }
          return updatedBag;
        }

        // For unassigned or full: assign as full owner
        return recalculateBagGrams({
          ...bag,
          splitMode: 'full',
          buyers: [{ id: genId(), personId: person.id, grams: activeBuyerLot.gramsPerBag }],
        }, activeBuyerLot.gramsPerBag);
      });

      updateBags(activeBuyerLot.id, nextBags, [person.id]);
      setBuyerModalTarget(null);
    } catch (error) {
      setBuyerError(error instanceof Error ? error.message : 'Failed to add buyer.');
    } finally {
      setBuyerSaving(false);
    }
  }

  return (
    <div className="wizard-step-stack">
      {buyerModalTarget && activeBuyerLot && activeBuyerBag && (
        <div className="wizard-modal-backdrop" onClick={() => setBuyerModalTarget(null)}>
          <div className="wizard-modal-sheet" onClick={(event) => event.stopPropagation()}>
            <PersonEditor
              title="Add new buyer"
              description={`This buyer will be added to the shared directory and assigned to Bag ${normalizeLotToBags(activeBuyerLot).indexOf(activeBuyerBag) + 1} for "${activeBuyerLot.name || 'this coffee lot'}".`}
              error={buyerError}
              saving={buyerSaving}
              submitLabel="Add buyer"
              onSave={handleCreateBuyer}
              onCancel={() => setBuyerModalTarget(null)}
            />
          </div>
        </div>
      )}

      <section className="wizard-panel">
        <div className="wizard-card-header">
          <div>
            <div className="section-label" style={{ marginBottom: 'var(--space-2)' }}>Step 2</div>
            <h3 className="wizard-card-title">Add coffees and assign bags</h3>
            <p className="wizard-card-copy">
              Add each coffee, then assign buyers to each bag. Smart defaults handle the common cases automatically.
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
            <p>Add your first coffee lot, then assign the bags inside that lot.</p>
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
          recentBuyerIds={recentBuyerIds}
          isEditing={editingLotId === lot.id}
          isExpanded={expandedLotId === lot.id}
          lotForm={lotForm}
          formError={formError}
          setLotForm={setLotForm}
          onExpand={() => { setExpandedLotId(lot.id); setEditingLotId(null); }}
          onCollapse={() => setExpandedLotId((c) => (c === lot.id ? null : c))}
          onEdit={() => openEdit(lot)}
          onSave={saveLot}
          onCancel={() => setEditingLotId(null)}
          onDelete={() => deleteLot(lot.id)}
          onBagsChange={(bags, touchedPersonIds) => updateBags(lot.id, bags, touchedPersonIds)}
          onAddNewBuyer={(bagId) => { setBuyerError(''); setBuyerModalTarget({ lotId: lot.id, bagId }); }}
        />
      ))}

      {editingLotId === 'new' && (
        <section className="wizard-panel">
          <div className="section-label" style={{ marginBottom: 'var(--space-3)' }}>New coffee lot</div>
          <LotForm
            form={lotForm}
            error={formError}
            isNew
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

// ─── LotCard ──────────────────────────────────────────────────

interface LotCardProps {
  lot: CoffeeLot;
  people: Person[];
  recentBuyerIds: string[];
  isEditing: boolean;
  isExpanded: boolean;
  lotForm: LotFormState;
  formError: string;
  setLotForm: (form: LotFormState) => void;
  onExpand: () => void;
  onCollapse: () => void;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onBagsChange: (bags: Bag[], touchedPersonIds?: string[]) => void;
  onAddNewBuyer: (bagId: string) => void;
}

function LotCard({
  lot, people, recentBuyerIds, isEditing, isExpanded,
  lotForm, formError, setLotForm,
  onExpand, onCollapse, onEdit, onSave, onCancel, onDelete,
  onBagsChange, onAddNewBuyer,
}: LotCardProps) {
  const bags = useMemo(() => normalizeLotToBags(lot), [lot]);
  const bagStatus = useMemo(() => getBagStatus(bags, lot.gramsPerBag), [bags, lot.gramsPerBag]);
  const totalGrams = lot.gramsPerBag * bags.length;

  const buyerNames = useMemo(() => Array.from(new Set(
    bags.flatMap((bag) => bag.buyers)
      .filter((b) => b.personId.trim() && b.grams > 0)
      .map((b) => people.find((p) => p.id === b.personId)?.name || 'Unknown'),
  )), [bags, people]);

  const splitBagCount = bags.filter((b) => b.splitMode === 'equal' || b.splitMode === 'custom').length;

  const badgeClass = bagStatus.tone === 'complete'
    ? 'wizard-badge-accent'
    : splitBagCount > 0 ? 'wizard-badge-info' : 'wizard-badge-muted';
  const badgeLabel = bagStatus.assignedBags === 0
    ? 'Unassigned'
    : splitBagCount > 0 ? 'Shared bags' : 'Assigned';

  function handleAddBag() {
    const newBag = createUnassignedBag();
    onBagsChange([...bags, newBag]);
  }

  function handleRemoveBag(bagId: string) {
    if (bags.length <= 1) return;
    onBagsChange(bags.filter((b) => b.id !== bagId));
  }

  return (
    <section className="wizard-panel">
      {isEditing ? (
        <>
          <div className="section-label" style={{ marginBottom: 'var(--space-3)' }}>Edit coffee lot</div>
          <LotForm
            form={lotForm}
            error={formError}
            isNew={false}
            onChange={setLotForm}
            onSave={onSave}
            onCancel={onCancel}
          />
        </>
      ) : !isExpanded ? (
        <div className="coffee-lot-collapsed" data-lot-state="collapsed">
          <button className="coffee-lot-summary-trigger" onClick={onExpand}>
            <div className="coffee-lot-summary-main">
              <div className="coffee-lot-summary-top">
                <div>
                  <div className="wizard-card-title">{lot.name}</div>
                  <p className="wizard-card-copy coffee-lot-summary-copy">
                    {bags.length} x {formatGrams(lot.gramsPerBag)} bag · {formatGrams(totalGrams)} total
                  </p>
                </div>
                <StatusBadge
                  tone={bagStatus.tone === 'complete' ? 'complete' : bagStatus.tone === 'warning' ? 'warning' : 'error'}
                  label={bagStatus.label}
                  compact
                />
              </div>

              <div className="coffee-lot-summary-grid">
                <div className="coffee-lot-summary-item">
                  <span className="coffee-lot-summary-label">Buyers</span>
                  <strong>{summarizeNames(buyerNames)}</strong>
                </div>
                <div className="coffee-lot-summary-item">
                  <span className="coffee-lot-summary-label">Status</span>
                  <strong>{bagStatus.assignedBags} of {bags.length} bags assigned</strong>
                </div>
              </div>
            </div>
            <span className="coffee-lot-summary-chevron" aria-hidden="true">⌄</span>
          </button>

          <div className="coffee-lot-summary-actions">
            <button className="btn btn-ghost btn-sm" onClick={onExpand}>Expand</button>
            <button className="btn btn-ghost btn-sm" onClick={onEdit}>Edit</button>
            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-unpaid)' }} onClick={onDelete}>Delete</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <div className="wizard-card-header">
            <div>
              <div className="wizard-card-title">{lot.name}</div>
              <p className="wizard-card-copy" style={{ marginTop: 'var(--space-2)' }}>
                {bags.length} x {formatGrams(lot.gramsPerBag)} bag • {formatGrams(totalGrams)} total • {lot.foreignPricePerBag} list price per bag
              </p>
            </div>

            <div className="wizard-chip-row">
              <span className={`wizard-badge ${badgeClass}`}>{badgeLabel}</span>
              <button className="btn btn-ghost btn-sm" onClick={onCollapse}>Collapse</button>
              <button className="btn btn-ghost btn-sm" onClick={onEdit}>Edit</button>
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-unpaid)' }} onClick={onDelete}>Delete</button>
            </div>
          </div>

          <div className="wizard-subsection">
            <div className="wizard-subsection-header">
              <div>
                <div className="section-label" style={{ marginBottom: 'var(--space-2)' }}>
                  {bags.length === 1 ? 'Who is ordering this bag?' : 'Who is ordering these bags?'}
                </div>
                <p className="wizard-card-copy">
                  Select buyers — the system auto-assigns grams. Use custom split only when needed.
                </p>
              </div>
              <StatusBadge tone={bagStatus.tone === 'complete' ? 'complete' : bagStatus.tone === 'warning' ? 'warning' : 'error'} label={bagStatus.label} />
            </div>

            <div className="bag-card-list">
              {bags.map((bag, bagIndex) => (
                <BagCard
                  key={bag.id}
                  bag={bag}
                  bags={bags}
                  bagIndex={bagIndex}
                  gramsPerBag={lot.gramsPerBag}
                  people={people}
                  recentBuyerIds={recentBuyerIds}
                  canRemove={bags.length > 1}
                  onChange={(nextBags, touchedPersonIds) => onBagsChange(nextBags, touchedPersonIds)}
                  onRemove={() => handleRemoveBag(bag.id)}
                  onAddNewBuyer={() => onAddNewBuyer(bag.id)}
                />
              ))}
            </div>

            <div className="wizard-inline-actions">
              <button className="btn btn-secondary btn-sm" onClick={handleAddBag}>
                + Add bag
              </button>
            </div>
          </div>

          <div className={`wizard-allocation-note ${bagStatus.tone === 'complete' ? 'is-complete' : bagStatus.tone === 'warning' ? 'is-warning' : 'is-error'}`}>
            {bagStatus.label}
          </div>
        </div>
      )}
    </section>
  );
}

// ─── LotForm ──────────────────────────────────────────────────

interface LotFormProps {
  form: LotFormState;
  error: string;
  isNew: boolean;
  onChange: (form: LotFormState) => void;
  onSave: () => void;
  onCancel: () => void;
}

function LotForm({ form, error, isNew, onChange, onSave, onCancel }: LotFormProps) {
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

      {isNew && (
        <div className="field" style={{ maxWidth: 220 }}>
          <label className="field-label">Initial bag count</label>
          <input
            className="input"
            type="number"
            value={form.initialBagCount}
            onChange={setField('initialBagCount')}
            min="1"
            step="1"
            placeholder="1"
          />
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={onSave}>Save coffee lot</button>
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ─── BagCard ──────────────────────────────────────────────────

interface BagCardProps {
  bag: Bag;
  bags: Bag[];
  bagIndex: number;
  gramsPerBag: number;
  people: Person[];
  recentBuyerIds: string[];
  canRemove: boolean;
  onChange: (bags: Bag[], touchedPersonIds?: string[]) => void;
  onRemove: () => void;
  onAddNewBuyer: () => void;
}

export function BagCard({
  bag, bags, bagIndex, gramsPerBag, people, recentBuyerIds,
  canRemove, onChange, onRemove, onAddNewBuyer,
}: BagCardProps) {
  const [isExpanded, setIsExpanded] = useState(bag.splitMode === 'unassigned');
  const orderedPeople = useMemo(() => orderPeopleForBag(people, bags, recentBuyerIds), [people, bags, recentBuyerIds]);
  const tone = getBagToneLabel(bag, gramsPerBag);
  const previousBag = bagIndex > 0 ? bags[bagIndex - 1] : null;
  const hasUnassigned = bags.some((b) => b.splitMode === 'unassigned');

  function commit(nextBags: Bag[], touchedPersonIds: string[] = []) {
    onChange(nextBags, touchedPersonIds);
  }

  function replaceBag(nextBag: Bag, touchedPersonIds: string[] = []) {
    commit(bags.map((b) => (b.id === bag.id ? nextBag : b)), touchedPersonIds);
  }

  // ── Smart assignment: select a single buyer → full bag ──
  function assignFullBag(personId: string) {
    if (!personId) {
      replaceBag({ ...bag, splitMode: 'unassigned', buyers: [] });
      return;
    }
    const fullBag = recalculateBagGrams({
      ...bag,
      splitMode: 'full',
      buyers: [{ id: genId(), personId, grams: gramsPerBag }],
    }, gramsPerBag);
    replaceBag(fullBag, [personId]);
    setIsExpanded(false);
  }

  // ── Quick-assign: equal split with selected people ──
  function startEqualSplit() {
    const existingBuyers = bag.buyers.length >= 2 ? bag.buyers : [];
    if (existingBuyers.length >= 2) {
      const equalBag = recalculateBagGrams({ ...bag, splitMode: 'equal' }, gramsPerBag);
      replaceBag(equalBag);
    } else {
      // Start with 2 empty buyer slots
      replaceBag({
        ...bag,
        splitMode: 'equal',
        buyers: [
          { id: genId(), personId: '', grams: 0 },
          { id: genId(), personId: '', grams: 0 },
        ],
      });
    }
    setIsExpanded(true);
  }

  function startCustomSplit() {
    const currentBuyers = bag.buyers.length >= 2 ? bag.buyers : [
      { id: genId(), personId: '', grams: 0 },
      { id: genId(), personId: '', grams: 0 },
    ];
    replaceBag({ ...bag, splitMode: 'custom', buyers: currentBuyers });
    setIsExpanded(true);
  }

  function copyPreviousBag() {
    if (!previousBag) return;
    const cloned = duplicateBag(previousBag);
    replaceBag({ ...cloned, id: bag.id }, cloned.buyers.map((b) => b.personId).filter(Boolean));
    setIsExpanded(false);
  }

  // ── Bulk: apply this bag's allocation to all unassigned ──
  function applyToAllUnassigned() {
    const nextBags = applyAllocationToBags(bag, bags);
    commit(nextBags, bag.buyers.map((b) => b.personId).filter(Boolean));
  }

  // ── Bulk: assign all remaining unassigned bags to this person ──
  function assignAllRemainingToOwner() {
    if (bag.splitMode !== 'full' || !bag.buyers[0]?.personId) return;
    const personId = bag.buyers[0].personId;
    const nextBags = bags.map((b) => {
      if (b.splitMode !== 'unassigned') return b;
      return recalculateBagGrams({
        ...b,
        splitMode: 'full',
        buyers: [{ id: genId(), personId, grams: gramsPerBag }],
      }, gramsPerBag);
    });
    commit(nextBags, [personId]);
  }

  // ── Split: add a buyer row ──
  function addBuyer() {
    const usedIds = new Set(bag.buyers.map((b) => b.personId).filter(Boolean));
    const nextPerson = orderedPeople.find((p) => !usedIds.has(p.id));
    const newBuyer: BagBuyer = { id: genId(), personId: nextPerson?.id || '', grams: 0 };
    const updatedBag: Bag = { ...bag, buyers: [...bag.buyers, newBuyer] };

    if (bag.splitMode === 'equal') {
      replaceBag(recalculateBagGrams(updatedBag, gramsPerBag), nextPerson ? [nextPerson.id] : []);
    } else {
      replaceBag(updatedBag, nextPerson ? [nextPerson.id] : []);
    }
  }

  // ── Split: update a buyer's person or grams ──
  function updateBuyer(buyerId: string, field: 'personId' | 'grams', value: string) {
    let updatedBag: Bag = {
      ...bag,
      buyers: bag.buyers.map((b) => {
        if (b.id !== buyerId) return b;
        if (field === 'personId') return { ...b, personId: value };
        return { ...b, grams: parseInt(value, 10) || 0 };
      }),
    };

    // Auto-infer mode when people change
    if (field === 'personId' && bag.splitMode === 'equal') {
      updatedBag = recalculateBagGrams(updatedBag, gramsPerBag);
    }

    const touchedIds = field === 'personId' && value ? [value] : [];
    replaceBag(updatedBag, touchedIds);
  }

  // ── Split: remove a buyer ──
  function removeBuyer(buyerId: string) {
    const remaining = bag.buyers.filter((b) => b.id !== buyerId);

    // Smart mode inference after removal
    if (remaining.length === 0) {
      replaceBag({ ...bag, splitMode: 'unassigned', buyers: [] });
      setIsExpanded(true);
      return;
    }
    if (remaining.length === 1 && remaining[0].personId.trim()) {
      // Drop back to full bag
      const fullBag = recalculateBagGrams({
        ...bag,
        splitMode: 'full',
        buyers: remaining,
      }, gramsPerBag);
      replaceBag(fullBag);
      setIsExpanded(false);
      return;
    }

    let updatedBag: Bag = { ...bag, buyers: remaining };
    if (bag.splitMode === 'equal') {
      updatedBag = recalculateBagGrams(updatedBag, gramsPerBag);
    }
    replaceBag(updatedBag);
  }

  // ── Split: distribute equally ──
  function splitEqually() {
    replaceBag(recalculateBagGrams({ ...bag, splitMode: 'equal' }, gramsPerBag));
  }

  // ── Split: assign remainder to last buyer ──
  function assignRemainder() {
    if (bag.buyers.length === 0) return;
    const last = [...bag.buyers].reverse().find((b) => b.personId.trim()) ?? bag.buyers[bag.buyers.length - 1];
    const allocated = bag.buyers.reduce((s, b) => s + b.grams, 0);
    const delta = gramsPerBag - allocated;
    replaceBag({
      ...bag,
      buyers: bag.buyers.map((b) => (
        b.id === last.id ? { ...b, grams: Math.max(0, b.grams + delta) } : b
      )),
    });
  }

  // ── Collapsed view ──
  if (!isExpanded && bag.splitMode !== 'unassigned') {
    return (
      <div className="bag-card bag-card-collapsed">
        <div className="bag-card-header">
          <div style={{ flex: 1 }}>
            <div className="bag-card-title">Bag {bagIndex + 1}</div>
            <div className="bag-card-meta">{getBagDisplayLabel(bag, gramsPerBag, people)}</div>
          </div>
          <StatusBadge tone={tone.tone} label={tone.label} compact />
          <div className="bag-card-inline-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setIsExpanded(true)}>Edit</button>
            {canRemove && (
              <button className="btn btn-ghost btn-icon" onClick={onRemove} title="Remove bag">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Bulk action hints for assigned bags */}
        {tone.tone === 'complete' && hasUnassigned && (
          <div className="wizard-chip-row" style={{ paddingTop: 'var(--space-2)' }}>
            <button className="btn btn-ghost btn-sm" onClick={applyToAllUnassigned}>
              Apply to all unassigned
            </button>
            {bag.splitMode === 'full' && (
              <button className="btn btn-ghost btn-sm" onClick={assignAllRemainingToOwner}>
                Assign all remaining to {people.find((p) => p.id === bag.buyers[0]?.personId)?.name || 'this buyer'}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Expanded view ──
  return (
    <div className="bag-card">
      <div className="bag-card-header">
        <div>
          <div className="bag-card-title">Bag {bagIndex + 1}</div>
          <div className="bag-card-meta">{formatGrams(gramsPerBag)}</div>
        </div>
        <div className="bag-card-inline-actions">
          <StatusBadge tone={tone.tone} label={tone.label} compact />
          {bag.splitMode !== 'unassigned' && (
            <button className="btn btn-ghost btn-sm" onClick={() => setIsExpanded(false)}>Done</button>
          )}
          {canRemove && (
            <button className="btn btn-ghost btn-icon" onClick={onRemove} title="Remove bag">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="bag-card-body">
        {bag.splitMode === 'unassigned' ? (
          /* ── Unassigned: quick-assign buttons ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div className="field">
              <label className="field-label">Quick assign — full bag</label>
              <select
                className="select"
                value=""
                onChange={(e) => assignFullBag(e.target.value)}
              >
                <option value="">Select a buyer (full bag)</option>
                {orderedPeople.map((person) => (
                  <option key={person.id} value={person.id}>{person.name}</option>
                ))}
              </select>
            </div>

            <div className="wizard-chip-row">
              <button className="btn btn-secondary btn-sm" onClick={startEqualSplit}>
                Split equally
              </button>
              <button className="btn btn-ghost btn-sm" onClick={startCustomSplit}>
                Custom split
              </button>
              <button className="btn btn-ghost btn-sm" onClick={onAddNewBuyer}>
                Add new buyer
              </button>
              {previousBag && (
                <button className="btn btn-ghost btn-sm" onClick={copyPreviousBag}>
                  Copy previous bag
                </button>
              )}
            </div>
          </div>
        ) : bag.splitMode === 'full' ? (
          /* ── Full bag: single buyer ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div className="field">
              <label className="field-label">Buyer (full bag)</label>
              <select
                className="select"
                value={bag.buyers[0]?.personId ?? ''}
                onChange={(e) => assignFullBag(e.target.value)}
              >
                <option value="">Select a buyer</option>
                {orderedPeople.map((person) => (
                  <option key={person.id} value={person.id}>{person.name}</option>
                ))}
              </select>
            </div>

            <div className="wizard-chip-row">
              <button className="btn btn-ghost btn-sm" onClick={onAddNewBuyer}>Add new buyer</button>
              <button className="btn btn-ghost btn-sm" onClick={startEqualSplit}>Split bag</button>
              {previousBag && (
                <button className="btn btn-ghost btn-sm" onClick={copyPreviousBag}>Copy previous bag</button>
              )}
              {bag.buyers[0]?.personId && hasUnassigned && (
                <>
                  <button className="btn btn-secondary btn-sm" onClick={assignAllRemainingToOwner}>
                    Assign all remaining
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={applyToAllUnassigned}>
                    Apply to all unassigned
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          /* ── Equal / Custom split ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div className="bag-split-mode-indicator">
              <span className={`wizard-badge ${bag.splitMode === 'equal' ? 'wizard-badge-accent' : 'wizard-badge-info'}`}>
                {bag.splitMode === 'equal' ? 'Equal split' : 'Custom split'}
              </span>
              {bag.splitMode === 'equal' && (
                <button className="btn btn-ghost btn-sm" onClick={startCustomSplit}>Switch to custom</button>
              )}
              {bag.splitMode === 'custom' && (
                <button className="btn btn-ghost btn-sm" onClick={splitEqually}>Switch to equal</button>
              )}
            </div>

            {bag.buyers.map((buyer) => (
              <div key={buyer.id} className="buyer-row">
                <select
                  className="select"
                  value={buyer.personId}
                  onChange={(e) => updateBuyer(buyer.id, 'personId', e.target.value)}
                  style={{ flex: 1 }}
                >
                  <option value="">Select a buyer</option>
                  {orderedPeople.map((person) => (
                    <option
                      key={person.id}
                      value={person.id}
                      disabled={bag.buyers.some((b) => b.id !== buyer.id && b.personId === person.id)}
                    >
                      {person.name}
                    </option>
                  ))}
                </select>

                {bag.splitMode === 'custom' ? (
                  <div className="buyer-grams-field">
                    <input
                      className="input"
                      type="number"
                      value={buyer.grams || ''}
                      onChange={(e) => updateBuyer(buyer.id, 'grams', e.target.value)}
                      min="0"
                      step="1"
                      placeholder="g"
                    />
                    <span className="buyer-grams-suffix">g</span>
                  </div>
                ) : (
                  <div className="buyer-grams-display">
                    {buyer.grams > 0 ? `${buyer.grams}g` : '—'}
                  </div>
                )}

                <button className="btn btn-ghost btn-icon" onClick={() => removeBuyer(buyer.id)} title="Remove buyer">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}

            <div className="wizard-chip-row">
              {bag.buyers.length < people.length && (
                <button className="btn btn-secondary btn-sm" onClick={addBuyer}>
                  Add buyer
                </button>
              )}
              <button className="btn btn-ghost btn-sm" onClick={onAddNewBuyer}>Add new buyer</button>
              {bag.splitMode === 'custom' && bag.buyers.length > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={assignRemainder}>Assign remainder</button>
              )}
              {previousBag && (
                <button className="btn btn-ghost btn-sm" onClick={copyPreviousBag}>Copy previous bag</button>
              )}
              {tone.tone === 'complete' && hasUnassigned && (
                <button className="btn btn-ghost btn-sm" onClick={applyToAllUnassigned}>Apply to all unassigned</button>
              )}
            </div>

            {bag.splitMode === 'custom' && (() => {
              const allocated = bag.buyers.reduce((s, b) => s + b.grams, 0);
              const delta = gramsPerBag - allocated;
              if (delta === 0 && bag.buyers.length >= 2 && bag.buyers.every((b) => b.personId.trim() && b.grams > 0)) {
                return <div className="wizard-inline-note bag-split-note is-complete">Custom split balanced at {formatGrams(gramsPerBag)}.</div>;
              }
              if (delta > 0) {
                return <div className="wizard-inline-note bag-split-note is-warning">{formatGrams(delta)} still need to be assigned.</div>;
              }
              if (delta < 0) {
                return <div className="wizard-inline-note bag-split-note is-error">{formatGrams(Math.abs(delta))} over-assigned.</div>;
              }
              return null;
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── StatusBadge ──────────────────────────────────────────────

function StatusBadge({
  tone,
  label,
  compact = false,
}: {
  tone: 'complete' | 'warning' | 'error' | 'info';
  label: string;
  compact?: boolean;
}) {
  const className = tone === 'complete'
    ? 'grams-badge-ok'
    : tone === 'warning'
      ? 'grams-badge-warn'
      : tone === 'error'
        ? 'grams-badge-error'
        : 'wizard-badge-info';

  return (
    <span className={`grams-badge ${className} ${compact ? 'is-compact' : ''}`}>
      {label}
    </span>
  );
}
