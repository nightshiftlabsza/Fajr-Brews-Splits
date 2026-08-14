import { useMemo, useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import type { Bag, BagBuyer, BagSplitMode, CoffeeLot, Order, Person } from '../../types';
import { formatGrams } from '../../lib/formatters';
import { getCanonicalPeopleOptions } from '../../lib/peopleOptions';
import {
  normalizeLotToBags,
  serializeLotFromBags,
  recalculateBagGrams,
  getBagStatus,
} from '../../lib/orderWizard';
import {
  addBagToBags,
  assignFullBag,
  formatBagSummary,
  formatLotAllocationSummary,
  proposeAllocationForLot,
  removeBagFromBags,
  setCustomSplit,
  splitBagEqually,
} from '../../lib/allocationInference';
import { PersonEditor, type PersonFormValues } from '../people/PersonEditor';
import { ConfirmModal } from '../ui/ConfirmModal';

function genId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

interface Props {
  order: Order;
  onOrderChange?: (patch: Partial<Order>) => void | Promise<void>;
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

export function CoffeeLotsSection({ order, onOrderChange }: Props) {
  const { people, addPerson, updateOrder } = useAppStore();
  const patchOrder = onOrderChange ?? ((patch: Partial<Order>) => updateOrder(order.id, patch));

  const [editingLotId, setEditingLotId] = useState<string | 'new' | null>(null);
  const [expandedLotId, setExpandedLotId] = useState<string | null>(order.lots[0]?.id ?? null);
  const [lotForm, setLotForm] = useState<LotFormState>(emptyLotForm);
  const [formError, setFormError] = useState('');

  // Modals state
  const [personEditorTarget, setPersonEditorTarget] = useState<{ lotId: string; bagId?: string } | null>(null);
  const [personEditorError, setPersonEditorError] = useState('');
  const [personEditorSaving, setPersonEditorSaving] = useState(false);

  const [customSplitTarget, setCustomSplitTarget] = useState<{ lot: CoffeeLot; bag: Bag } | null>(null);
  const [deleteLotTarget, setDeleteLotTarget] = useState<CoffeeLot | null>(null);
  const [bagSizeConfirmTarget, setBagSizeConfirmTarget] = useState<{ lot: CoffeeLot; newGrams: number; nextBags: Bag[] } | null>(null);

  const personNameMap = useMemo(
    () => Object.fromEntries(people.map((p) => [p.id, p.name])),
    [people],
  );

  useEffect(() => {
    if (editingLotId === 'new') return;
    if (expandedLotId && order.lots.some((lot) => lot.id === expandedLotId)) return;
    if (order.lots.length > 0) {
      setExpandedLotId(order.lots[0].id);
    } else {
      setExpandedLotId(null);
    }
  }, [order.lots, editingLotId, expandedLotId]);

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
      const newBags = Array.from({ length: initialBagCount }, () => ({
        id: genId(),
        splitMode: 'unassigned' as BagSplitMode,
        buyers: [],
      }));
      const serialized = serializeLotFromBags(newBags);
      const newLotId = genId();
      void patchOrder({
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
      const hasCustom = nextBags.some((b) => b.splitMode === 'custom');
      if (hasCustom) {
        setBagSizeConfirmTarget({
          lot: existingLot,
          newGrams: gramsPerBag,
          nextBags: nextBags.map((bag) => {
            if (bag.splitMode === 'custom') {
              return { ...bag, splitMode: 'unassigned' as BagSplitMode, buyers: [] };
            }
            return recalculateBagGrams(bag, gramsPerBag);
          }),
        });
        return;
      }

      nextBags = nextBags.map((bag) => recalculateBagGrams(bag, gramsPerBag));
    }

    const serialized = serializeLotFromBags(nextBags);
    void patchOrder({
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

  function commitBagSizeChange() {
    if (!bagSizeConfirmTarget) return;
    const { lot, newGrams, nextBags } = bagSizeConfirmTarget;
    const serialized = serializeLotFromBags(nextBags);
    void patchOrder({
      lots: order.lots.map((l) => (l.id === lot.id
        ? {
            ...l,
            name: lotForm.name.trim() || l.name,
            foreignPricePerBag: parseFloat(lotForm.foreignPricePerBag) || l.foreignPricePerBag,
            gramsPerBag: newGrams,
            ...serialized,
          }
        : l)),
    });
    setBagSizeConfirmTarget(null);
    setEditingLotId(null);
    setExpandedLotId(lot.id);
  }

  function deleteLot(lotId: string) {
    const remainingLots = order.lots.filter((lot) => lot.id !== lotId);
    void patchOrder({ lots: remainingLots });
    if (editingLotId === lotId) setEditingLotId(null);
    if (expandedLotId === lotId) setExpandedLotId(remainingLots[0]?.id ?? null);
    setDeleteLotTarget(null);
  }

  function updateLotBags(lotId: string, nextBags: Bag[]) {
    const serialized = serializeLotFromBags(nextBags);
    void patchOrder({
      lots: order.lots.map((lot) => (lot.id === lotId ? { ...lot, ...serialized } : lot)),
    });
  }

  async function handleCreatePerson(values: PersonFormValues) {
    if (!personEditorTarget) return;
    if (!values.name.trim()) {
      setPersonEditorError('Name is required.');
      return;
    }

    setPersonEditorSaving(true);
    setPersonEditorError('');
    try {
      const person = await addPerson({
        name: values.name.trim(),
        phone: values.phone || undefined,
        email: values.email || undefined,
        note: values.note || undefined,
      });

      const lot = order.lots.find((l) => l.id === personEditorTarget.lotId);
      if (lot && personEditorTarget.bagId) {
        const bags = normalizeLotToBags(lot);
        const nextBags = bags.map((b) => {
          if (b.id !== personEditorTarget.bagId) return b;
          return assignFullBag(b, person.id, lot.gramsPerBag);
        });
        updateLotBags(lot.id, nextBags);
      }

      setPersonEditorTarget(null);
    } catch (error) {
      setPersonEditorError(error instanceof Error ? error.message : 'Failed to add person.');
    } finally {
      setPersonEditorSaving(false);
    }
  }

  return (
    <div className="wizard-step-stack">
      {/* Top Header Card */}
      <section className="wizard-panel">
        <div className="wizard-card-header">
          <div>
            <h2 className="wizard-card-title">Coffees & Bag Allocations</h2>
            <p className="wizard-card-copy">
              Add coffees, specify the number of bags, and choose who gets each bag. Whole-bag and equal splits are automatic.
            </p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={openNew}>
            + Add Coffee Lot
          </button>
        </div>
      </section>

      {/* Empty State */}
      {order.lots.length === 0 && editingLotId !== 'new' && (
        <section className="wizard-panel">
          <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
            <div className="empty-state-icon">☕</div>
            <h3>No coffee lots added</h3>
            <p>Add your first coffee to begin allocating bags among participants.</p>
            <button className="btn btn-primary" onClick={openNew}>
              Add First Coffee Lot
            </button>
          </div>
        </section>
      )}

      {/* New Lot Form */}
      {editingLotId === 'new' && (
        <section className="wizard-panel">
          <div className="section-label" style={{ marginBottom: 'var(--space-3)' }}>New Coffee Lot</div>
          <LotEditorForm
            form={lotForm}
            error={formError}
            isNew={true}
            onChange={setLotForm}
            onSave={saveLot}
            onCancel={() => setEditingLotId(null)}
          />
        </section>
      )}

      {/* Coffee Lots List */}
      {order.lots.map((lot) => {
        const isEditing = editingLotId === lot.id;
        const isExpanded = expandedLotId === lot.id;
        const bags = normalizeLotToBags(lot);
        const lotSummary = formatLotAllocationSummary(bags, lot.gramsPerBag, personNameMap);

        if (isEditing) {
          return (
            <section key={lot.id} className="wizard-panel">
              <div className="section-label" style={{ marginBottom: 'var(--space-3)' }}>Edit Coffee Lot</div>
              <LotEditorForm
                form={lotForm}
                error={formError}
                isNew={false}
                onChange={setLotForm}
                onSave={saveLot}
                onCancel={() => setEditingLotId(null)}
              />
            </section>
          );
        }

        return (
          <section key={lot.id} className="wizard-panel lot-card-panel">
            {/* Lot Summary Header */}
            <div className="lot-card-header">
              <div className="lot-card-title-group" onClick={() => setExpandedLotId(isExpanded ? null : lot.id)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <h3 className="lot-title">{lot.name}</h3>
                  <span className={`allocation-status-badge ${lotSummary.isComplete ? 'is-complete' : 'is-pending'}`}>
                    {lotSummary.isComplete ? '✓ Allocated' : `${lotSummary.unassignedCount} need buyers`}
                  </span>
                </div>
                <div className="lot-meta-line">
                  <span>{bags.length} × {formatGrams(lot.gramsPerBag)}</span>
                  <span>·</span>
                  <span>{lot.foreignPricePerBag} / bag</span>
                  <span>·</span>
                  <span className="lot-summary-headline">{lotSummary.headline}</span>
                </div>
              </div>

              <div className="lot-card-actions">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => openEdit(lot)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-danger-text"
                  onClick={() => setDeleteLotTarget(lot)}
                >
                  Delete
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setExpandedLotId(isExpanded ? null : lot.id)}
                >
                  {isExpanded ? 'Collapse ▲' : 'Manage Bags ▼'}
                </button>
              </div>
            </div>

            {/* Expanded Bag List & Allocations */}
            {isExpanded && (
              <div className="lot-bags-container">
                <div className="lot-bags-header">
                  <div className="field-label" style={{ margin: 0 }}>
                    {bags.length === 1 ? '1 Physical Bag' : `${bags.length} Physical Bags`}
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => updateLotBags(lot.id, addBagToBags(bags))}
                  >
                    + Add bag
                  </button>
                </div>

                <div className="bags-grid">
                  {bags.map((bag, index) => (
                    <BagRow
                      key={bag.id}
                      bag={bag}
                      bagIndex={index}
                      totalBagsInLot={bags.length}
                      gramsPerBag={lot.gramsPerBag}
                      people={people}
                      personNameMap={personNameMap}
                      onAssignFull={(personId) => {
                        const updated = assignFullBag(bag, personId, lot.gramsPerBag);
                        const nextBags = bags.map((b) => (b.id === bag.id ? updated : b));
                        updateLotBags(lot.id, nextBags);
                      }}
                      onSplitEqual={(personIds) => {
                        const updated = splitBagEqually(bag, personIds, lot.gramsPerBag);
                        const nextBags = bags.map((b) => (b.id === bag.id ? updated : b));
                        updateLotBags(lot.id, nextBags);
                      }}
                      onOpenCustomSplit={() => setCustomSplitTarget({ lot, bag })}
                      onRemoveBag={() => updateLotBags(lot.id, removeBagFromBags(bags, bag.id))}
                      onAddNewPerson={() => {
                        setPersonEditorError('');
                        setPersonEditorTarget({ lotId: lot.id, bagId: bag.id });
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </section>
        );
      })}

      {/* Add New Person Modal */}
      {personEditorTarget && (
        <div className="fb-modal-backdrop" onClick={() => setPersonEditorTarget(null)}>
          <div className="fb-modal-card" onClick={(e) => e.stopPropagation()}>
            <PersonEditor
              title="Add new buyer"
              description="Add this coffee lover to the workspace directory to assign bags or splits."
              error={personEditorError}
              saving={personEditorSaving}
              submitLabel="Add buyer"
              onSave={handleCreatePerson}
              onCancel={() => setPersonEditorTarget(null)}
            />
          </div>
        </div>
      )}

      {/* Custom Split Modal */}
      {customSplitTarget && (
        <CustomSplitModal
          isOpen={true}
          lot={customSplitTarget.lot}
          bag={customSplitTarget.bag}
          people={people}
          onSave={(buyers) => {
            const nextBags = normalizeLotToBags(customSplitTarget.lot).map((b) => {
              if (b.id !== customSplitTarget.bag.id) return b;
              return setCustomSplit(b, buyers);
            });
            updateLotBags(customSplitTarget.lot.id, nextBags);
            setCustomSplitTarget(null);
          }}
          onCancel={() => setCustomSplitTarget(null)}
        />
      )}

      {/* Delete Lot Confirm Modal */}
      {deleteLotTarget && (
        <ConfirmModal
          isOpen={true}
          title={`Delete "${deleteLotTarget.name}"?`}
          description="Are you sure you want to remove this coffee lot and its bag allocations? This action cannot be undone."
          confirmText="Delete Coffee Lot"
          cancelText="Cancel"
          variant="danger"
          onConfirm={() => deleteLot(deleteLotTarget.id)}
          onCancel={() => setDeleteLotTarget(null)}
        />
      )}

      {/* Bag Size Change Confirm Modal */}
      {bagSizeConfirmTarget && (
        <ConfirmModal
          isOpen={true}
          title="Reset Custom Split Allocations?"
          description={`Changing the bag size to ${bagSizeConfirmTarget.newGrams}g will reset custom split allocations for "${bagSizeConfirmTarget.lot.name}". Whole and equal splits will automatically scale.`}
          confirmText="Update Bag Size"
          cancelText="Keep Existing Size"
          variant="warning"
          onConfirm={commitBagSizeChange}
          onCancel={() => setBagSizeConfirmTarget(null)}
        />
      )}

      {/* STYLES */}
      <style>{`
        .lot-card-panel {
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          background: var(--color-surface);
          box-shadow: var(--shadow-xs);
          padding: 0;
          overflow: hidden;
          margin-bottom: var(--space-4);
        }

        .lot-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-4) var(--space-5);
          background: var(--color-surface);
          gap: var(--space-3);
          flex-wrap: wrap;
        }

        .lot-card-title-group {
          cursor: pointer;
          flex: 1;
          min-width: 240px;
        }

        .lot-title {
          font-size: 1.125rem;
          font-weight: 700;
          color: var(--color-text-primary);
          margin: 0;
        }

        .allocation-status-badge {
          font-size: 0.6875rem;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 999px;
          text-transform: uppercase;
        }

        .allocation-status-badge.is-complete {
          background: #d1fae5;
          color: #065f46;
        }

        .allocation-status-badge.is-pending {
          background: #fef3c7;
          color: #92400e;
        }

        .lot-meta-line {
          display: flex;
          gap: 6px;
          align-items: center;
          font-size: 0.8125rem;
          color: var(--color-text-muted);
          margin-top: 4px;
          flex-wrap: wrap;
        }

        .lot-summary-headline {
          font-weight: 600;
          color: var(--color-text-secondary);
        }

        .lot-card-actions {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          flex-shrink: 0;
        }

        .btn-danger-text {
          color: var(--color-unpaid, #dc2626);
        }

        /* Bags Container inside lot */
        .lot-bags-container {
          border-top: 1px solid var(--color-border);
          background: var(--color-surface-raised);
          padding: var(--space-4) var(--space-5);
        }

        .lot-bags-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--space-3);
        }

        .bags-grid {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

        /* Bag Row Card */
        .bag-row-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          padding: var(--space-3) var(--space-4);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-3);
          flex-wrap: wrap;
        }

        .bag-row-left {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          flex: 1;
          min-width: 260px;
        }

        .bag-tag {
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--color-text-muted);
          background: var(--color-surface-raised);
          border: 1px solid var(--color-border);
          padding: 3px 8px;
          border-radius: var(--radius-sm);
          white-space: nowrap;
        }

        .bag-buyer-select-wrapper {
          flex: 1;
          max-width: 320px;
        }

        .bag-row-summary {
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--color-text-secondary);
        }

        .bag-row-actions {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          flex-shrink: 0;
        }

        @media (max-width: 640px) {
          .lot-card-header {
            padding: var(--space-3);
          }
          .lot-bags-container {
            padding: var(--space-3);
          }
          .bag-row-card {
            flex-direction: column;
            align-items: stretch;
          }
          .bag-row-left {
            width: 100%;
          }
          .bag-row-actions {
            width: 100%;
            justify-content: flex-end;
          }
        }
      `}</style>
    </div>
  );
}

// ─── Lot Editor Form Component ───
interface LotEditorFormProps {
  form: LotFormState;
  error: string;
  isNew: boolean;
  onChange: (form: LotFormState) => void;
  onSave: () => void;
  onCancel: () => void;
}

function LotEditorForm({ form, error, isNew, onChange, onSave, onCancel }: LotEditorFormProps) {
  function setField(key: keyof LotFormState) {
    return (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...form, [key]: e.target.value });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div className="field">
        <label className="field-label">Coffee Name *</label>
        <input
          className="input"
          value={form.name}
          onChange={setField('name')}
          placeholder="e.g. Pastel Hour, Gesha Spirits, Caballero"
          autoFocus
        />
      </div>

      <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-3)' }}>
        <div className="field">
          <label className="field-label">Foreign List Price *</label>
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
          <label className="field-label">Grams per Bag *</label>
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

        {isNew && (
          <div className="field">
            <label className="field-label">Initial Bag Count</label>
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
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-primary" onClick={onSave}>
          {isNew ? 'Create Coffee Lot' : 'Save Changes'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Bag Row Component ───
interface BagRowProps {
  bag: Bag;
  bagIndex: number;
  totalBagsInLot: number;
  gramsPerBag: number;
  people: Person[];
  personNameMap: Record<string, string>;
  onAssignFull: (personId: string) => void;
  onSplitEqual: (personIds: string[]) => void;
  onOpenCustomSplit: () => void;
  onRemoveBag: () => void;
  onAddNewPerson: () => void;
}

function BagRow({
  bag,
  bagIndex,
  totalBagsInLot,
  gramsPerBag,
  people,
  personNameMap,
  onAssignFull,
  onSplitEqual,
  onOpenCustomSplit,
  onRemoveBag,
  onAddNewPerson,
}: BagRowProps) {
  const [isSplitting, setIsSplitting] = useState(bag.splitMode === 'equal' || bag.splitMode === 'custom');
  const [splitSelectedIds, setSplitSelectedIds] = useState<string[]>(() => bag.buyers.map((b) => b.personId).filter(Boolean));

  useEffect(() => {
    setIsSplitting(bag.splitMode === 'equal' || bag.splitMode === 'custom');
    setSplitSelectedIds(bag.buyers.map((b) => b.personId).filter(Boolean));
  }, [bag]);

  const summary = formatBagSummary(bag, gramsPerBag, personNameMap);

  function handleSingleSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    if (val === '__new__') {
      onAddNewPerson();
      return;
    }
    if (val === '__split__') {
      setIsSplitting(true);
      return;
    }
    onAssignFull(val);
  }

  function handleToggleSplitPerson(personId: string) {
    let nextIds: string[];
    if (splitSelectedIds.includes(personId)) {
      nextIds = splitSelectedIds.filter((id) => id !== personId);
    } else {
      nextIds = [...splitSelectedIds, personId];
    }
    setSplitSelectedIds(nextIds);
    if (nextIds.length >= 2) {
      onSplitEqual(nextIds);
    } else if (nextIds.length === 1) {
      onAssignFull(nextIds[0]);
    } else {
      onAssignFull('');
    }
  }

  return (
    <div className="bag-row-card">
      <div className="bag-row-left">
        <span className="bag-tag">Bag {bagIndex + 1} ({formatGrams(gramsPerBag)})</span>

        {!isSplitting ? (
          <div className="bag-buyer-select-wrapper">
            <select
              className="input"
              value={bag.splitMode === 'full' ? bag.buyers[0]?.personId || '' : ''}
              onChange={handleSingleSelect}
            >
              <option value="">Select a buyer (full bag)...</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
              <option disabled>──────────</option>
              <option value="__split__">⚡ Split this bag between multiple people...</option>
              <option value="__new__">+ Add new buyer...</option>
            </select>
          </div>
        ) : (
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                Select buyers sharing this bag:
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ padding: '0 4px', height: 20, fontSize: '0.6875rem' }}
                onClick={() => {
                  setIsSplitting(false);
                  if (splitSelectedIds[0]) onAssignFull(splitSelectedIds[0]);
                }}
              >
                Switch to full bag
              </button>
            </div>

            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {people.map((p) => {
                const selected = splitSelectedIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`split-person-chip ${selected ? 'is-selected' : ''}`}
                    onClick={() => handleToggleSplitPerson(p.id)}
                  >
                    {selected ? '✓ ' : '+ '}
                    {p.name}
                  </button>
                );
              })}
              <button
                type="button"
                className="split-person-chip chip-add"
                onClick={onAddNewPerson}
              >
                + New person
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bag-row-actions">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onAddNewPerson}
          style={{ fontSize: '0.8125rem' }}
        >
          Add new buyer
        </button>

        {isSplitting && bag.buyers.length >= 2 && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onOpenCustomSplit}
            title="Specify custom grams for this bag"
          >
            Adjust split
          </button>
        )}

        {totalBagsInLot > 1 && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ color: 'var(--color-text-muted)' }}
            onClick={onRemoveBag}
            title="Remove bag"
          >
            ✕
          </button>
        )}
      </div>

      <style>{`
        .split-person-chip {
          padding: 3px 8px;
          border-radius: 999px;
          border: 1px solid var(--color-border);
          background: var(--color-surface);
          color: var(--color-text-secondary);
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .split-person-chip:hover {
          background: var(--color-surface-raised);
          border-color: color-mix(in srgb, var(--color-accent) 40%, var(--color-border));
        }

        .split-person-chip.is-selected {
          background: var(--color-accent-light);
          color: var(--color-accent);
          border-color: color-mix(in srgb, var(--color-accent) 40%, transparent);
          font-weight: 700;
        }

        .chip-add {
          border-style: dashed;
        }
      `}</style>
    </div>
  );
}

// ─── Custom Split Modal Component ───
interface CustomSplitModalProps {
  isOpen: boolean;
  lot: CoffeeLot;
  bag: Bag;
  people: Person[];
  onSave: (buyers: { personId: string; grams: number }[]) => void;
  onCancel: () => void;
}

function CustomSplitModal({ isOpen, lot, bag, people, onSave, onCancel }: CustomSplitModalProps) {
  const [gramMap, setGramMap] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const b of bag.buyers) {
      if (b.personId) map[b.personId] = String(b.grams || '');
    }
    return map;
  });
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const buyerIds = Object.keys(gramMap);
  const totalGrams = buyerIds.reduce((sum, id) => sum + (parseInt(gramMap[id], 10) || 0), 0);
  const targetGrams = lot.gramsPerBag;
  const remaining = targetGrams - totalGrams;
  const isValid = totalGrams === targetGrams && buyerIds.length > 0 && buyerIds.every((id) => (parseInt(gramMap[id], 10) || 0) > 0);

  const availablePeople = people.filter((p) => !buyerIds.includes(p.id));

  function handleAddPersonToSplit(personId: string) {
    if (!personId) return;
    const initialGrams = remaining > 0 ? String(remaining) : '';
    setGramMap((prev) => ({ ...prev, [personId]: initialGrams }));
    setError('');
  }

  function handleRemovePersonFromSplit(personId: string) {
    setGramMap((prev) => {
      const next = { ...prev };
      delete next[personId];
      return next;
    });
    setError('');
  }

  function handleSave() {
    if (!isValid) {
      setError(`Buyer grams must total exactly ${targetGrams}g (currently ${totalGrams}g).`);
      return;
    }
    const buyers = buyerIds.map((personId) => ({
      personId,
      grams: parseInt(gramMap[personId], 10),
    }));
    onSave(buyers);
  }

  return (
    <div className="fb-modal-backdrop" onClick={onCancel}>
      <div className="fb-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <h3 className="fb-modal-title">Adjust Custom Split</h3>
        <p className="fb-modal-description" style={{ marginBottom: 'var(--space-4)' }}>
          Specify exact grams for each person sharing this {formatGrams(targetGrams)} bag of "{lot.name}".
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          {buyerIds.map((personId) => {
            const person = people.find((p) => p.id === personId);
            return (
              <div key={personId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{person?.name || 'Unknown'}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    className="input"
                    type="number"
                    style={{ width: 90, textAlign: 'right' }}
                    value={gramMap[personId]}
                    onChange={(e) => {
                      setGramMap({ ...gramMap, [personId]: e.target.value });
                      setError('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && isValid) {
                        e.preventDefault();
                        handleSave();
                      }
                    }}
                    min="1"
                    step="1"
                    autoFocus={buyerIds[0] === personId}
                  />
                  <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>g</span>
                  {buyerIds.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '2px 6px', color: 'var(--color-text-muted)' }}
                      onClick={() => handleRemovePersonFromSplit(personId)}
                      title="Remove person from split"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add another person to split */}
        {availablePeople.length > 0 && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <select
              className="input"
              value=""
              onChange={(e) => handleAddPersonToSplit(e.target.value)}
              style={{ fontSize: '0.8125rem' }}
            >
              <option value="">+ Add person to this split...</option>
              {availablePeople.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Live Total Indicator */}
        <div style={{
          padding: '10px 14px',
          borderRadius: 'var(--radius-sm)',
          background: isValid ? '#ecfdf5' : '#fffbeb',
          border: `1px solid ${isValid ? '#a7f3d0' : '#fde68a'}`,
          fontSize: '0.875rem',
          fontWeight: 600,
          color: isValid ? '#065f46' : '#92400e',
          marginBottom: 'var(--space-4)',
        }}>
          {isValid
            ? `✓ Total: ${totalGrams}g of ${targetGrams}g (Valid split)`
            : remaining > 0
              ? `Total: ${totalGrams}g of ${targetGrams}g (${remaining}g unallocated)`
              : `Total: ${totalGrams}g of ${targetGrams}g (${Math.abs(remaining)}g over limit)`}
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-4)' }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={!isValid}>
            Save Custom Split
          </button>
        </div>
      </div>
    </div>
  );
}
