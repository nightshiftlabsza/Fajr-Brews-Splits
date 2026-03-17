import { useMemo, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import type { CoffeeLot, Order, Person } from '../../types';
import { formatGrams } from '../../lib/formatters';
import {
  collapseBagDraftsToShares,
  expandLotToBagDrafts,
  getLotBagStatus,
  type BagAllocationDraft,
  type BagParticipantDraft,
} from '../../lib/orderWizard';
import { PersonEditor, type PersonFormValues } from '../people/PersonEditor';

function genId() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

function createParticipant(personId: string, shareGrams: number, sourceShareId?: string): BagParticipantDraft {
  const id = genId();
  return {
    id,
    personId,
    shareGrams,
    sourceShareId: sourceShareId || id,
  };
}

function getBagAllocatedGrams(bag: BagAllocationDraft): number {
  return bag.participants.reduce((sum, participant) => sum + (participant.shareGrams || 0), 0);
}

function isBagValid(bag: BagAllocationDraft, gramsPerBag: number): boolean {
  if (bag.mode === 'single') {
    return (
      bag.participants.length === 1 &&
      bag.participants[0].personId.trim().length > 0 &&
      bag.participants[0].shareGrams === gramsPerBag
    );
  }

  const allocated = getBagAllocatedGrams(bag);
  return (
    bag.participants.length > 0 &&
    bag.participants.every((participant) => participant.personId.trim().length > 0 && Number.isInteger(participant.shareGrams) && participant.shareGrams > 0) &&
    allocated === gramsPerBag
  );
}

function copyBagDraft(bag: BagAllocationDraft, bagIndex = bag.bagIndex): BagAllocationDraft {
  return {
    id: bag.id,
    bagIndex,
    mode: bag.mode,
    participants: bag.participants.map((participant) => ({
      ...participant,
      id: genId(),
    })),
  };
}

function buildSingleOwnerBag(bag: BagAllocationDraft, personId: string, gramsPerBag: number): BagAllocationDraft {
  if (!personId) {
    return {
      ...bag,
      mode: 'single',
      participants: [],
    };
  }

  const existing = bag.participants.find((participant) => participant.personId === personId);
  return {
    ...bag,
    mode: 'single',
    participants: [createParticipant(personId, gramsPerBag, existing?.sourceShareId)],
  };
}

function orderPeopleForBag(
  people: Person[],
  bags: BagAllocationDraft[],
  recentBuyerIds: string[],
): Person[] {
  const lotOrder = Array.from(
    new Set(
      bags.flatMap((bag) => bag.participants.map((participant) => participant.personId).filter(Boolean))
    )
  );
  const lotRank = new Map(lotOrder.map((personId, index) => [personId, index]));
  const recentRank = new Map(recentBuyerIds.map((personId, index) => [personId, index]));

  return [...people].sort((a, b) => {
    const aLot = lotRank.has(a.id) ? 0 : 1;
    const bLot = lotRank.has(b.id) ? 0 : 1;
    if (aLot !== bLot) return aLot - bLot;
    if (aLot === 0) return (lotRank.get(a.id) ?? 0) - (lotRank.get(b.id) ?? 0);

    const aRecent = recentRank.has(a.id) ? 0 : 1;
    const bRecent = recentRank.has(b.id) ? 0 : 1;
    if (aRecent !== bRecent) return aRecent - bRecent;
    if (aRecent === 0) return (recentRank.get(a.id) ?? 0) - (recentRank.get(b.id) ?? 0);

    return a.name.localeCompare(b.name);
  });
}

function getBagTone(bag: BagAllocationDraft, gramsPerBag: number): { label: string; tone: 'complete' | 'warning' | 'info' } {
  if (bag.participants.length === 0) {
    return { label: 'Needs buyer', tone: 'warning' };
  }
  if (bag.mode === 'split' && !isBagValid(bag, gramsPerBag)) {
    return { label: 'Shared bag needs attention', tone: 'warning' };
  }
  if (bag.mode === 'split') {
    return { label: 'Shared bag', tone: 'info' };
  }
  return { label: 'Assigned', tone: 'complete' };
}

function getSplitBagNote(bag: BagAllocationDraft, gramsPerBag: number): { tone: 'complete' | 'warning' | 'error'; label: string } {
  const allocated = getBagAllocatedGrams(bag);
  const delta = gramsPerBag - allocated;

  if (
    bag.participants.length > 0 &&
    bag.participants.every((participant) => participant.personId.trim().length > 0 && participant.shareGrams > 0) &&
    delta === 0
  ) {
    return {
      tone: 'complete',
      label: `Shared bag balanced at ${formatGrams(gramsPerBag)}.`,
    };
  }

  if (delta > 0) {
    return {
      tone: 'warning',
      label: `${formatGrams(delta)} still need to be assigned in this shared bag.`,
    };
  }

  return {
    tone: 'error',
    label: `${formatGrams(Math.abs(delta))} are over-assigned in this shared bag.`,
  };
}

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
  const [buyerModalTarget, setBuyerModalTarget] = useState<BuyerModalTarget | null>(null);
  const [buyerError, setBuyerError] = useState('');
  const [buyerSaving, setBuyerSaving] = useState(false);
  const [recentBuyerIds, setRecentBuyerIds] = useState<string[]>([]);

  const activeBuyerLot = buyerModalTarget
    ? order.lots.find((lot) => lot.id === buyerModalTarget.lotId) ?? null
    : null;

  const activeBuyerBag = activeBuyerLot && buyerModalTarget
    ? expandLotToBagDrafts(activeBuyerLot).find((bag) => bag.id === buyerModalTarget.bagId) ?? null
    : null;

  const lotCountLabel = useMemo(() => (
    `${order.lots.length} coffee lot${order.lots.length === 1 ? '' : 's'}`
  ), [order.lots.length]);

  function rememberBuyer(personId: string) {
    if (!personId) return;
    setRecentBuyerIds((current) => [personId, ...current.filter((candidate) => candidate !== personId)]);
  }

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

    if (editingLotId === 'new') {
      void updateOrder(order.id, {
        lots: [
          ...order.lots,
          {
            id: genId(),
            name: lotForm.name.trim(),
            foreignPricePerBag,
            gramsPerBag,
            quantity,
            shares: [],
          },
        ],
      });
      setEditingLotId(null);
      setFormError('');
      return;
    }

    const existingLot = order.lots.find((lot) => lot.id === editingLotId);
    if (!existingLot) {
      setFormError('Could not find the coffee lot you are editing.');
      return;
    }

    let nextShares = existingLot.shares;

    if (existingLot.gramsPerBag !== gramsPerBag) {
      if (
        existingLot.shares.length > 0 &&
        !confirm('Changing grams per bag resets the bag assignments for this coffee. Continue?')
      ) {
        return;
      }
      nextShares = [];
    } else if (quantity < existingLot.quantity) {
      const existingBags = expandLotToBagDrafts(existingLot);
      const removedBags = existingBags.slice(quantity);
      const droppingAssignments = removedBags.some((bag) => bag.participants.length > 0);

      if (
        droppingAssignments &&
        !confirm(`Reducing the quantity will remove assignments from ${removedBags.length} bag${removedBags.length === 1 ? '' : 's'}. Continue?`)
      ) {
        return;
      }

      nextShares = collapseBagDraftsToShares(existingBags.slice(0, quantity));
    }

    void updateOrder(order.id, {
      lots: order.lots.map((lot) => (lot.id === editingLotId
        ? {
            ...lot,
            name: lotForm.name.trim(),
            foreignPricePerBag,
            gramsPerBag,
            quantity,
            shares: nextShares,
          }
        : lot)),
    });
    setEditingLotId(null);
    setFormError('');
  }

  function deleteLot(lotId: string) {
    void updateOrder(order.id, {
      lots: order.lots.filter((lot) => lot.id !== lotId),
    });
  }

  function updateShares(lotId: string, bags: BagAllocationDraft[], touchedPersonIds: string[] = []) {
    touchedPersonIds.forEach(rememberBuyer);
    void updateOrder(order.id, {
      lots: order.lots.map((lot) => (lot.id === lotId ? { ...lot, shares: collapseBagDraftsToShares(bags) } : lot)),
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

      const nextBags = expandLotToBagDrafts(activeBuyerLot).map((bag) => {
        if (bag.id !== activeBuyerBag.id) return bag;

        if (bag.mode === 'split') {
          const remaining = Math.max(0, activeBuyerLot.gramsPerBag - getBagAllocatedGrams(bag));
          return {
            ...bag,
            participants: [...bag.participants, createParticipant(person.id, remaining)],
          };
        }

        return buildSingleOwnerBag(bag, person.id, activeBuyerLot.gramsPerBag);
      });

      updateShares(activeBuyerLot.id, nextBags, [person.id]);
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
          <div
            className="wizard-modal-sheet"
            onClick={(event) => event.stopPropagation()}
          >
            <PersonEditor
              title="Add new buyer"
              description={`This buyer will be added to the shared directory and inserted directly into Bag ${activeBuyerBag.bagIndex + 1} for "${activeBuyerLot.name || 'this coffee lot'}".`}
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
              Add each coffee, then assign each bag to a buyer. Only open grams when a bag is genuinely being shared.
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
          lotForm={lotForm}
          formError={formError}
          setLotForm={setLotForm}
          onEdit={() => openEdit(lot)}
          onSave={saveLot}
          onCancel={() => setEditingLotId(null)}
          onDelete={() => deleteLot(lot.id)}
          onBagsChange={(bags, touchedPersonIds) => updateShares(lot.id, bags, touchedPersonIds)}
          onAddNewBuyer={(bagId) => {
            setBuyerError('');
            setBuyerModalTarget({ lotId: lot.id, bagId });
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
  recentBuyerIds: string[];
  isEditing: boolean;
  lotForm: LotFormState;
  formError: string;
  setLotForm: (form: LotFormState) => void;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onBagsChange: (bags: BagAllocationDraft[], touchedPersonIds?: string[]) => void;
  onAddNewBuyer: (bagId: string) => void;
}

function LotCard({
  lot,
  people,
  recentBuyerIds,
  isEditing,
  lotForm,
  formError,
  setLotForm,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  onBagsChange,
  onAddNewBuyer,
}: LotCardProps) {
  const totalGrams = lot.gramsPerBag * lot.quantity;
  const bags = useMemo(() => expandLotToBagDrafts(lot), [lot]);
  const bagStatus = useMemo(() => getLotBagStatus(bags, lot.gramsPerBag), [bags, lot.gramsPerBag]);
  const includesSplitBag = bags.some((bag) => bag.mode === 'split');
  const badgeClass = bagStatus.tone === 'complete'
    ? 'wizard-badge-accent'
    : includesSplitBag
      ? 'wizard-badge-info'
      : 'wizard-badge-muted';
  const badgeLabel = bagStatus.assignedBags === 0
    ? 'Unassigned'
    : includesSplitBag
      ? 'Shared bags'
      : 'Assigned';

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
              <span className={`wizard-badge ${badgeClass}`}>
                {badgeLabel}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={onEdit}>Edit</button>
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-unpaid)' }} onClick={onDelete}>Delete</button>
            </div>
          </div>

          <div className="wizard-subsection">
            <div className="wizard-subsection-header">
              <div>
                <div className="section-label" style={{ marginBottom: 'var(--space-2)' }}>
                  {lot.quantity === 1 ? 'Who is ordering this bag?' : 'Who is ordering these bags?'}
                </div>
                <p className="wizard-card-copy">
                  Assign each bag to one buyer by default, and only split the bags that are actually shared.
                </p>
              </div>
              <StatusBadge tone={bagStatus.tone} label={bagStatus.label} />
            </div>

            <div className="bag-card-list">
              {bags.map((bag, bagIndex) => (
                <BagAssignmentCard
                  key={bag.id}
                  bag={bag}
                  bags={bags}
                  bagIndex={bagIndex}
                  gramsPerBag={lot.gramsPerBag}
                  people={people}
                  recentBuyerIds={recentBuyerIds}
                  onChange={(nextBags, touchedPersonIds) => onBagsChange(nextBags, touchedPersonIds)}
                  onAddNewBuyer={() => onAddNewBuyer(bag.id)}
                />
              ))}
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

interface BagAssignmentCardProps {
  bag: BagAllocationDraft;
  bags: BagAllocationDraft[];
  bagIndex: number;
  gramsPerBag: number;
  people: Person[];
  recentBuyerIds: string[];
  onChange: (bags: BagAllocationDraft[], touchedPersonIds?: string[]) => void;
  onAddNewBuyer: () => void;
}

function BagAssignmentCard({
  bag,
  bags,
  bagIndex,
  gramsPerBag,
  people,
  recentBuyerIds,
  onChange,
  onAddNewBuyer,
}: BagAssignmentCardProps) {
  const orderedPeople = useMemo(() => orderPeopleForBag(people, bags, recentBuyerIds), [people, bags, recentBuyerIds]);
  const selectedPersonId = bag.participants[0]?.personId ?? '';
  const tone = getBagTone(bag, gramsPerBag);
  const splitNote = bag.mode === 'split' ? getSplitBagNote(bag, gramsPerBag) : null;
  const previousBag = bagIndex > 0 ? bags[bagIndex - 1] : null;

  function commit(nextBags: BagAllocationDraft[], touchedPersonIds: string[] = []) {
    onChange(nextBags, touchedPersonIds);
  }

  function replaceCurrentBag(nextBag: BagAllocationDraft, touchedPersonIds: string[] = []) {
    commit(bags.map((candidate) => (candidate.id === bag.id ? nextBag : candidate)), touchedPersonIds);
  }

  function setSingleOwner(personId: string) {
    replaceCurrentBag(buildSingleOwnerBag(bag, personId, gramsPerBag), personId ? [personId] : []);
  }

  function splitBag() {
    replaceCurrentBag({
      ...bag,
      mode: 'split',
      participants: bag.participants.length > 0
        ? bag.participants
        : [createParticipant('', gramsPerBag)],
    });
  }

  function copyPreviousBag() {
    if (!previousBag) return;
    const cloned = copyBagDraft(previousBag, bag.bagIndex);
    cloned.id = bag.id;
    replaceCurrentBag(cloned, cloned.participants.map((participant) => participant.personId).filter(Boolean));
  }

  function assignAllRemainingBags() {
    if (!selectedPersonId) return;
    const nextBags = bags.map((candidate, candidateIndex) => {
      if (candidateIndex < bagIndex) return candidate;
      if (candidate.participants.length > 0) return candidate;
      return buildSingleOwnerBag(candidate, selectedPersonId, gramsPerBag);
    });
    commit(nextBags, [selectedPersonId]);
  }

  function addSplitParticipant() {
    const usedIds = new Set(bag.participants.map((participant) => participant.personId).filter(Boolean));
    const nextPerson = orderedPeople.find((person) => !usedIds.has(person.id));
    if (!nextPerson) return;

    const remainder = Math.max(0, gramsPerBag - getBagAllocatedGrams(bag));
    replaceCurrentBag({
      ...bag,
      participants: [...bag.participants, createParticipant(nextPerson.id, remainder)],
    }, [nextPerson.id]);
  }

  function updateSplitParticipant(participantId: string, field: 'personId' | 'shareGrams', value: string) {
    const nextBag: BagAllocationDraft = {
      ...bag,
      participants: bag.participants.map((participant) => {
        if (participant.id !== participantId) return participant;
        if (field === 'personId') {
          return { ...participant, personId: value };
        }
        return { ...participant, shareGrams: parseInt(value, 10) || 0 };
      }),
    };

    const touchedIds = field === 'personId' && value ? [value] : [];
    replaceCurrentBag(nextBag, touchedIds);
  }

  function removeSplitParticipant(participantId: string) {
    replaceCurrentBag({
      ...bag,
      participants: bag.participants.filter((participant) => participant.id !== participantId),
    });
  }

  function splitEqually() {
    if (bag.participants.length === 0) return;
    const validParticipants = bag.participants.filter((participant) => participant.personId.trim().length > 0);
    if (validParticipants.length === 0) return;

    const base = Math.floor(gramsPerBag / validParticipants.length);
    const remainder = gramsPerBag - base * validParticipants.length;
    let carry = remainder;

    replaceCurrentBag({
      ...bag,
      participants: bag.participants.map((participant) => {
        if (!participant.personId.trim()) return participant;
        const nextShareGrams = base + (carry > 0 ? 1 : 0);
        if (carry > 0) carry -= 1;
        return { ...participant, shareGrams: nextShareGrams };
      }),
    });
  }

  function assignRemainder() {
    if (bag.participants.length === 0) return;
    const lastParticipant = [...bag.participants].reverse().find((participant) => participant.personId.trim().length > 0)
      ?? bag.participants[bag.participants.length - 1];
    const allocated = getBagAllocatedGrams(bag);
    const delta = gramsPerBag - allocated;

    replaceCurrentBag({
      ...bag,
      participants: bag.participants.map((participant) => (
        participant.id === lastParticipant.id
          ? { ...participant, shareGrams: Math.max(0, participant.shareGrams + delta) }
          : participant
      )),
    });
  }

  function backToSingleOwner() {
    if (bag.participants.length === 1 && bag.participants[0].personId.trim()) {
      setSingleOwner(bag.participants[0].personId);
      return;
    }
    replaceCurrentBag({ ...bag, mode: 'single', participants: [] });
  }

  return (
    <div className="bag-card">
      <div className="bag-card-header">
        <div>
          <div className="bag-card-title">Bag {bag.bagIndex + 1}</div>
          <div className="bag-card-meta">{formatGrams(gramsPerBag)}</div>
        </div>
        <StatusBadge tone={tone.tone} label={tone.label} compact />
      </div>

      {bag.mode === 'single' ? (
        <div className="bag-card-body">
          <div className="field">
            <label className="field-label">Buyer</label>
            <select
              className="select"
              value={selectedPersonId}
              onChange={(e) => setSingleOwner(e.target.value)}
            >
              <option value="">Select a buyer</option>
              {orderedPeople.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </div>

          <div className="wizard-chip-row">
            <button className="btn btn-ghost btn-sm" onClick={onAddNewBuyer}>
              Add new buyer
            </button>
            <button className="btn btn-ghost btn-sm" onClick={splitBag}>
              Split bag
            </button>
            {previousBag && (
              <button className="btn btn-ghost btn-sm" onClick={copyPreviousBag}>
                Copy previous bag
              </button>
            )}
            {selectedPersonId && bags.slice(bagIndex).some((candidate) => candidate.participants.length === 0) && (
              <button className="btn btn-secondary btn-sm" onClick={assignAllRemainingBags}>
                Assign all remaining bags to this buyer
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bag-card-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {bag.participants.map((participant) => (
              <div key={participant.id} className="buyer-row">
                <select
                  className="select"
                  value={participant.personId}
                  onChange={(e) => updateSplitParticipant(participant.id, 'personId', e.target.value)}
                  style={{ flex: 1 }}
                >
                  <option value="">Select a buyer</option>
                  {orderedPeople.map((person) => (
                    <option
                      key={person.id}
                      value={person.id}
                      disabled={bag.participants.some((candidate) => candidate.id !== participant.id && candidate.personId === person.id)}
                    >
                      {person.name}
                    </option>
                  ))}
                </select>

                <div className="buyer-grams-field">
                  <input
                    className="input"
                    type="number"
                    value={participant.shareGrams || ''}
                    onChange={(e) => updateSplitParticipant(participant.id, 'shareGrams', e.target.value)}
                    min="0"
                    step="1"
                    placeholder="g"
                  />
                  <span className="buyer-grams-suffix">g</span>
                </div>

                <button className="btn btn-ghost btn-icon" onClick={() => removeSplitParticipant(participant.id)} title="Remove buyer">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          <div className="wizard-chip-row">
            {bag.participants.length < people.length && (
              <button className="btn btn-secondary btn-sm" onClick={addSplitParticipant}>
                Add buyer
              </button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={onAddNewBuyer}>
              Add new buyer
            </button>
            {bag.participants.length > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={splitEqually}>
                Split equally
              </button>
            )}
            {bag.participants.length > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={assignRemainder}>
                Assign remainder
              </button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={backToSingleOwner}>
              Back to single owner
            </button>
            {previousBag && (
              <button className="btn btn-ghost btn-sm" onClick={copyPreviousBag}>
                Copy previous bag
              </button>
            )}
          </div>

          {splitNote && (
            <div className={`wizard-inline-note bag-split-note is-${splitNote.tone}`}>
              {splitNote.label}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
