import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import type { Bag, BagSplitMode, CoffeeLot, Order, Person } from '../../types';
import { formatGrams } from '../../lib/formatters';
import {
  normalizeLotToBags,
  serializeLotFromBags,
  recalculateBagGrams,
  validateCoffeeStep,
} from '../../lib/orderWizard';
import {
  addBagToBags,
  assignFullBag,
  createEmptyBags,
  formatCompactAllocationSummary,
  formatLotAllocationSummary,
  getLotBuyers,
  removeBagFromBags,
  setCustomSplit,
  splitBagEqually,
  syncLotWithSelectedBuyers,
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
  onContinue?: () => void;
}

interface LotFormState {
  name: string;
  foreignPricePerBag: string;
  gramsPerBag: string;
  initialBagCount: string;
  selectedBuyerIds: string[];
  bags: Bag[];
}

const emptyLotForm: LotFormState = {
  name: '',
  foreignPricePerBag: '',
  gramsPerBag: '250',
  initialBagCount: '1',
  selectedBuyerIds: [],
  bags: createEmptyBags(1),
};

export function CoffeeLotsSection({ order, onOrderChange, onContinue }: Props) {
  const { people, addPerson, updateOrder } = useAppStore();
  const patchOrder = onOrderChange ?? ((patch: Partial<Order>) => updateOrder(order.id, patch));

  const [editingLotId, setEditingLotId] = useState<string | 'new' | null>(null);
  const [adjustingLotId, setAdjustingLotId] = useState<string | null>(null);
  const [lotForm, setLotForm] = useState<LotFormState>(emptyLotForm);
  const [formError, setFormError] = useState('');

  // Modals state
  const [personEditorTarget, setPersonEditorTarget] = useState<{ lotId?: string; bagId?: string; inForm?: boolean } | null>(null);
  const [personEditorError, setPersonEditorError] = useState('');
  const [personEditorSaving, setPersonEditorSaving] = useState(false);

  const [customSplitTarget, setCustomSplitTarget] = useState<{ lot: CoffeeLot; bag: Bag } | null>(null);
  const [deleteLotTarget, setDeleteLotTarget] = useState<CoffeeLot | null>(null);
  const [bagSizeConfirmTarget, setBagSizeConfirmTarget] = useState<{ lot: CoffeeLot; newGrams: number; nextBags: Bag[] } | null>(null);

  const personNameMap = useMemo(
    () => Object.fromEntries(people.map((p) => [p.id, p.name])),
    [people],
  );

  const coffeeErrors = useMemo(() => validateCoffeeStep(order), [order]);
  const isAllocationComplete = order.lots.length > 0 && coffeeErrors.length === 0;

  const allocationStats = useMemo(() => {
    let totalBags = 0;
    let unassignedBags = 0;
    for (const lot of order.lots) {
      const bags = normalizeLotToBags(lot);
      totalBags += bags.length;
      for (const bag of bags) {
        if (bag.splitMode === 'unassigned' || bag.buyers.length === 0) {
          unassignedBags += 1;
        }
      }
    }
    return { totalBags, unassignedBags };
  }, [order.lots]);

  function openNew() {
    setLotForm({
      name: '',
      foreignPricePerBag: '',
      gramsPerBag: '250',
      initialBagCount: '1',
      selectedBuyerIds: [],
      bags: createEmptyBags(1),
    });
    setFormError('');
    setAdjustingLotId(null);
    setEditingLotId('new');
  }

  function openEdit(lot: CoffeeLot) {
    const bags = normalizeLotToBags(lot);
    const existingBuyers = getLotBuyers(bags);
    setLotForm({
      name: lot.name,
      foreignPricePerBag: String(lot.foreignPricePerBag),
      gramsPerBag: String(lot.gramsPerBag),
      initialBagCount: String(bags.length),
      selectedBuyerIds: existingBuyers,
      bags,
    });
    setFormError('');
    setAdjustingLotId(null);
    setEditingLotId(lot.id);
  }

  function saveLot() {
    const gramsPerBag = parseInt(lotForm.gramsPerBag, 10);
    const bagCount = parseInt(lotForm.initialBagCount, 10);
    const foreignPricePerBag = parseFloat(lotForm.foreignPricePerBag);

    if (!lotForm.name.trim()) return setFormError('Coffee name is required.');
    if (!Number.isInteger(gramsPerBag) || gramsPerBag < 1) return setFormError('Grams per bag must be an integer ≥ 1.');
    if (!Number.isFinite(foreignPricePerBag) || foreignPricePerBag <= 0) return setFormError('Foreign list price per bag must be greater than zero.');
    if (!Number.isInteger(bagCount) || bagCount < 1) return setFormError('Bag count must be at least 1.');

    // Use current form bags, or if bags count changed, sync bags with selected buyers
    let finalBags = lotForm.bags;
    if (finalBags.length !== bagCount) {
      const resizedBags = finalBags.length < bagCount
        ? [...finalBags, ...createEmptyBags(bagCount - finalBags.length)]
        : finalBags.slice(0, bagCount);
      finalBags = syncLotWithSelectedBuyers(resizedBags, lotForm.selectedBuyerIds, gramsPerBag);
    }

    if (editingLotId === 'new') {
      const serialized = serializeLotFromBags(finalBags);
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
      setEditingLotId(null);
      setFormError('');
      return;
    }

    const existingLot = order.lots.find((lot) => lot.id === editingLotId);
    if (!existingLot) {
      setFormError('Could not find the coffee lot you are editing.');
      return;
    }

    let nextBags = finalBags;

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
  }

  function deleteLot(lotId: string) {
    const remainingLots = order.lots.filter((lot) => lot.id !== lotId);
    void patchOrder({ lots: remainingLots });
    if (editingLotId === lotId) setEditingLotId(null);
    if (adjustingLotId === lotId) setAdjustingLotId(null);
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

      if (personEditorTarget.inForm) {
        // Add to current form
        const nextSelected = [...lotForm.selectedBuyerIds, person.id];
        const grams = parseInt(lotForm.gramsPerBag, 10) || 250;
        const nextBags = syncLotWithSelectedBuyers(lotForm.bags, nextSelected, grams);
        setLotForm({
          ...lotForm,
          selectedBuyerIds: nextSelected,
          bags: nextBags,
        });
      } else if (personEditorTarget.lotId) {
        const lot = order.lots.find((l) => l.id === personEditorTarget.lotId);
        if (lot) {
          const bags = normalizeLotToBags(lot);
          if (personEditorTarget.bagId) {
            const nextBags = bags.map((b) => (b.id === personEditorTarget.bagId ? assignFullBag(b, person.id, lot.gramsPerBag) : b));
            updateLotBags(lot.id, nextBags);
          } else {
            const nextSelected = [...getLotBuyers(bags), person.id];
            const nextBags = syncLotWithSelectedBuyers(bags, nextSelected, lot.gramsPerBag);
            updateLotBags(lot.id, nextBags);
          }
        }
      }

      setPersonEditorTarget(null);
    } catch (error) {
      setPersonEditorError(error instanceof Error ? error.message : 'Failed to add person.');
    } finally {
      setPersonEditorSaving(false);
    }
  }

  return (
    <div className="coffee-section-stack">
      {/* Top Header Card */}
      <section className="wizard-panel">
        <div className="wizard-card-header">
          <div>
            <h2 className="wizard-card-title">Coffees</h2>
            <p className="wizard-card-copy">
              Enter each coffee lot, bag size, and count. Buyer allocations are assigned automatically.
            </p>
          </div>
          {editingLotId !== 'new' && (
            <button className="btn btn-primary btn-sm" onClick={openNew}>
              + Add Coffee
            </button>
          )}
        </div>
      </section>

      {/* Empty State */}
      {order.lots.length === 0 && editingLotId !== 'new' && (
        <section className="wizard-panel">
          <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
            <div className="empty-state-icon">☕</div>
            <h3>No coffees added yet</h3>
            <p>Add your first coffee to automatically assign bags and calculate shares.</p>
            <button className="btn btn-primary" onClick={openNew}>
              Add Coffee
            </button>
          </div>
        </section>
      )}

      {/* New Coffee Form */}
      {editingLotId === 'new' && (
        <section className="wizard-panel lot-form-panel">
          <div className="section-label" style={{ marginBottom: 'var(--space-3)' }}>New Coffee</div>
          <LotEditorForm
            form={lotForm}
            error={formError}
            isNew={true}
            people={people}
            personNameMap={personNameMap}
            onChange={setLotForm}
            onSave={saveLot}
            onCancel={() => setEditingLotId(null)}
            onAddNewPerson={() => {
              setPersonEditorError('');
              setPersonEditorTarget({ inForm: true });
            }}
          />
        </section>
      )}

      {/* Coffee Lots List */}
      {order.lots.map((lot) => {
        const isEditing = editingLotId === lot.id;
        const isAdjusting = adjustingLotId === lot.id;
        const bags = normalizeLotToBags(lot);
        const lotBuyers = getLotBuyers(bags);
        const lotSummary = formatLotAllocationSummary(bags, lot.gramsPerBag, personNameMap);
        const compactAllocation = formatCompactAllocationSummary(bags, lot.gramsPerBag, personNameMap);

        if (isEditing) {
          return (
            <section key={lot.id} className="wizard-panel lot-form-panel">
              <div className="section-label" style={{ marginBottom: 'var(--space-3)' }}>Edit Coffee</div>
              <LotEditorForm
                form={lotForm}
                error={formError}
                isNew={false}
                people={people}
                personNameMap={personNameMap}
                onChange={setLotForm}
                onSave={saveLot}
                onCancel={() => setEditingLotId(null)}
                onAddNewPerson={() => {
                  setPersonEditorError('');
                  setPersonEditorTarget({ lotId: lot.id });
                }}
              />
            </section>
          );
        }

        return (
          <section key={lot.id} className="wizard-panel lot-card-panel">
            {/* Main Lot Row */}
            <div className="lot-card-body">
              <div className="lot-card-top-row">
                <div className="lot-name-group">
                  <h3 className="lot-name">{lot.name}</h3>
                  <div className="lot-spec-tags">
                    <span className="spec-tag">{bags.length} × {formatGrams(lot.gramsPerBag)}</span>
                    <span className="spec-dot">·</span>
                    <span className="spec-tag">{lot.foreignPricePerBag} / bag</span>
                  </div>
                </div>

                <div className="lot-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() => openEdit(lot)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs btn-danger-text"
                    onClick={() => setDeleteLotTarget(lot)}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Allocation Summary & Quick Toggles */}
              <div className="lot-allocation-row">
                <div className="lot-allocation-summary-block">
                  <div className="allocation-headline-row">
                    <span className="allocation-headline-text">
                      {compactAllocation}
                    </span>
                    {lotSummary.isComplete ? (
                      <span className="allocation-status-chip is-complete">✓ Allocated</span>
                    ) : (
                      <span className="allocation-status-chip is-pending">{lotSummary.unassignedCount} needed</span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  className={`btn btn-xs ${isAdjusting ? 'btn-secondary' : 'btn-ghost'}`}
                  onClick={() => setAdjustingLotId(isAdjusting ? null : lot.id)}
                  title="Fine-tune individual bags or custom splits"
                >
                  {isAdjusting ? 'Close adjustment ▲' : 'Adjust allocation ⚙'}
                </button>
              </div>

              {/* If unassigned, quick single-tap buyer chips */}
              {!lotSummary.isComplete && !isAdjusting && (
                <div className="quick-assign-row">
                  <span className="quick-assign-label">Assign to:</span>
                  <div className="buyer-chips-wrap">
                    {people.map((p) => {
                      const isSelected = lotBuyers.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          className={`buyer-chip ${isSelected ? 'is-selected' : ''}`}
                          onClick={() => {
                            const nextBuyers = isSelected
                              ? lotBuyers.filter((id) => id !== p.id)
                              : [...lotBuyers, p.id];
                            const nextBags = syncLotWithSelectedBuyers(bags, nextBuyers, lot.gramsPerBag);
                            updateLotBags(lot.id, nextBags);
                          }}
                        >
                          {isSelected ? '✓ ' : '+ '}
                          {p.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Progressive Disclosure Bag Adjuster */}
            {isAdjusting && (
              <div className="lot-adjuster-panel">
                <div className="adjuster-header">
                  <span className="adjuster-title">Bag-by-Bag Allocation</span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() => updateLotBags(lot.id, addBagToBags(bags))}
                  >
                    + Add Bag
                  </button>
                </div>

                <div className="adjuster-bags-list">
                  {bags.map((bag, idx) => (
                    <BagAdjusterRow
                      key={bag.id}
                      bag={bag}
                      bagIndex={idx}
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

      {/* ── Bottom Next-Step Action ── */}
      {order.lots.length > 0 && onContinue && (
        <div className="lot-section-footer">
          {!isAllocationComplete && (
            <div className="lot-section-footer-hint">
              {allocationStats.unassignedBags > 0
                ? `${allocationStats.unassignedBags} ${allocationStats.unassignedBags === 1 ? 'bag needs' : 'bags need'} a buyer`
                : 'Complete bag allocations to continue'}
            </div>
          )}
          <button
            type="button"
            className="btn btn-primary lot-section-next-btn"
            onClick={onContinue}
            disabled={!isAllocationComplete}
          >
            <span>Next: Goods & Fees</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
      )}

      {/* Add New Person Modal */}
      {personEditorTarget && (
        <div className="fb-modal-backdrop" onClick={() => setPersonEditorTarget(null)}>
          <div className="fb-modal-card" onClick={(e) => e.stopPropagation()}>
            <PersonEditor
              title="Add Person"
              description="Add a member to the workspace directory to assign bags or shares."
              error={personEditorError}
              saving={personEditorSaving}
              submitLabel="Add Person"
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
          description="Are you sure you want to remove this coffee and its bag allocations? This action cannot be undone."
          confirmText="Delete Coffee"
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
        .coffee-section-stack {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
          max-width: 920px;
          margin: 0 auto;
        }

        .lot-card-panel {
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          background: var(--color-surface);
          box-shadow: var(--shadow-xs);
          padding: 0;
          overflow: hidden;
          transition: border-color var(--transition-fast);
        }

        .lot-card-panel:hover {
          border-color: color-mix(in srgb, var(--color-accent) 30%, var(--color-border));
        }

        .lot-card-body {
          padding: var(--space-4) var(--space-5);
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

        .lot-card-top-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: var(--space-3);
          flex-wrap: wrap;
        }

        .lot-name-group {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          flex-wrap: wrap;
        }

        .lot-name {
          font-size: 1.0625rem;
          font-weight: 700;
          color: var(--color-text-primary);
          margin: 0;
        }

        .lot-spec-tags {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.8125rem;
          color: var(--color-text-muted);
        }

        .spec-dot {
          color: var(--color-border);
        }

        .lot-actions {
          display: flex;
          align-items: center;
          gap: var(--space-1);
        }

        .btn-xs {
          padding: 3px 8px;
          font-size: 0.75rem;
          font-weight: 600;
          border-radius: var(--radius-sm);
        }

        .btn-danger-text {
          color: var(--color-unpaid, #dc2626);
        }

        /* Allocation Row */
        .lot-allocation-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-3);
          padding: 8px 12px;
          background: var(--color-surface-raised);
          border-radius: var(--radius-sm);
          border: 1px solid var(--color-border);
          flex-wrap: wrap;
        }

        .lot-allocation-summary-block {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          flex: 1;
          min-width: 220px;
        }

        .allocation-headline-row {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          flex-wrap: wrap;
        }

        .allocation-headline-text {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--color-text-primary);
        }

        .allocation-status-chip {
          font-size: 0.6875rem;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 999px;
          text-transform: uppercase;
        }

        .allocation-status-chip.is-complete {
          background: #d1fae5;
          color: #065f46;
        }

        .allocation-status-chip.is-pending {
          background: #fef3c7;
          color: #92400e;
        }

        /* Quick Assign Chips Row */
        .quick-assign-row {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          flex-wrap: wrap;
          padding-top: 2px;
        }

        .quick-assign-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--color-text-muted);
        }

        .buyer-chips-wrap {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }

        .buyer-chip {
          padding: 3px 9px;
          border-radius: 999px;
          border: 1px solid var(--color-border);
          background: var(--color-surface);
          color: var(--color-text-secondary);
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          transition: all var(--transition-fast);
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .buyer-chip:hover {
          background: var(--color-surface-raised);
          border-color: color-mix(in srgb, var(--color-accent) 40%, var(--color-border));
        }

        .buyer-chip.is-selected {
          background: var(--color-accent-light);
          color: var(--color-accent);
          border-color: color-mix(in srgb, var(--color-accent) 50%, transparent);
          font-weight: 700;
        }

        .buyer-chip-add {
          border-style: dashed;
          color: var(--color-text-muted);
        }

        /* Adjuster Panel */
        .lot-adjuster-panel {
          border-top: 1px solid var(--color-border);
          background: var(--color-surface-raised);
          padding: var(--space-4) var(--space-5);
        }

        .adjuster-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--space-3);
        }

        .adjuster-title {
          font-size: 0.8125rem;
          font-weight: 700;
          color: var(--color-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .adjuster-bags-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

        /* Bag Adjuster Card */
        .bag-adjuster-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          padding: var(--space-3) var(--space-4);
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

        .bag-adjuster-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-2);
          flex-wrap: wrap;
        }

        .bag-index-badge {
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--color-text-muted);
          background: var(--color-surface-raised);
          border: 1px solid var(--color-border);
          padding: 2px 7px;
          border-radius: var(--radius-sm);
        }

        .bag-mode-pills {
          display: inline-flex;
          background: var(--color-surface-raised);
          padding: 2px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--color-border);
          gap: 2px;
        }

        .bag-mode-pill {
          padding: 3px 8px;
          font-size: 0.6875rem;
          font-weight: 600;
          border: none;
          background: transparent;
          color: var(--color-text-muted);
          border-radius: 3px;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .bag-mode-pill.is-active {
          background: var(--color-surface);
          color: var(--color-accent);
          font-weight: 700;
          box-shadow: var(--shadow-xs);
        }

        .bag-adjuster-buyers {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          flex-wrap: wrap;
        }

        .lot-section-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: var(--space-4);
          padding-top: var(--space-2);
          margin-top: var(--space-2);
        }

        .lot-section-footer-hint {
          font-size: 0.8125rem;
          color: var(--color-text-muted);
          font-weight: 500;
        }

        .lot-section-next-btn {
          min-width: 200px;
        }

        @media (max-width: 640px) {
          .lot-card-body {
            padding: var(--space-3);
          }
          .lot-adjuster-panel {
            padding: var(--space-3);
          }
          .lot-card-top-row {
            flex-direction: column;
            align-items: flex-start;
          }
          .lot-actions {
            width: 100%;
            justify-content: flex-end;
          }
          .lot-allocation-row {
            flex-direction: column;
            align-items: flex-start;
          }
          .lot-allocation-row button {
            align-self: flex-end;
          }
          .lot-section-footer {
            flex-direction: column;
            align-items: stretch;
            gap: var(--space-2);
          }
          .lot-section-footer-hint {
            text-align: center;
          }
          .lot-section-next-btn {
            width: 100%;
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
  people: Person[];
  personNameMap: Record<string, string>;
  onChange: (form: LotFormState) => void;
  onSave: () => void;
  onCancel: () => void;
  onAddNewPerson: () => void;
}

function LotEditorForm({
  form,
  error,
  isNew,
  people,
  personNameMap,
  onChange,
  onSave,
  onCancel,
  onAddNewPerson,
}: LotEditorFormProps) {
  function setField(key: keyof LotFormState) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      const nextForm = { ...form, [key]: val };

      // Live inference sync when bag count or grams change
      if (key === 'initialBagCount' || key === 'gramsPerBag') {
        const bagCount = parseInt(key === 'initialBagCount' ? val : form.initialBagCount, 10) || 1;
        const grams = parseInt(key === 'gramsPerBag' ? val : form.gramsPerBag, 10) || 250;
        const resizedBags = form.bags.length < bagCount
          ? [...form.bags, ...createEmptyBags(bagCount - form.bags.length)]
          : form.bags.slice(0, bagCount);
        nextForm.bags = syncLotWithSelectedBuyers(resizedBags, form.selectedBuyerIds, grams);
      }

      onChange(nextForm);
    };
  }

  function handleToggleBuyer(personId: string) {
    const isSelected = form.selectedBuyerIds.includes(personId);
    const nextBuyers = isSelected
      ? form.selectedBuyerIds.filter((id) => id !== personId)
      : [...form.selectedBuyerIds, personId];

    const bagCount = parseInt(form.initialBagCount, 10) || 1;
    const grams = parseInt(form.gramsPerBag, 10) || 250;
    const resizedBags = form.bags.length < bagCount
      ? [...form.bags, ...createEmptyBags(bagCount - form.bags.length)]
      : form.bags.slice(0, bagCount);

    const nextBags = syncLotWithSelectedBuyers(resizedBags, nextBuyers, grams);
    onChange({
      ...form,
      selectedBuyerIds: nextBuyers,
      bags: nextBags,
    });
  }

  const bagCount = parseInt(form.initialBagCount, 10) || 1;
  const grams = parseInt(form.gramsPerBag, 10) || 250;
  const compactSummary = formatCompactAllocationSummary(form.bags, grams, personNameMap);

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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 'var(--space-3)' }}>
        <div className="field">
          <label className="field-label">List Price *</label>
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
          <label className="field-label">Grams / Bag *</label>
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

        <div className="field">
          <label className="field-label">Bags *</label>
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
      </div>

      {/* Buyers Selector */}
      <div className="field" style={{ margin: 0 }}>
        <label className="field-label" style={{ marginBottom: '6px' }}>Buyers</label>
        <div className="buyer-chips-wrap">
          {people.map((p) => {
            const isSelected = form.selectedBuyerIds.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                className={`buyer-chip ${isSelected ? 'is-selected' : ''}`}
                onClick={() => handleToggleBuyer(p.id)}
              >
                {isSelected ? '✓ ' : '+ '}
                {p.name}
              </button>
            );
          })}
          <button
            type="button"
            className="buyer-chip buyer-chip-add"
            onClick={onAddNewPerson}
          >
            + Add Person
          </button>
        </div>

        {/* Live Inferred Allocation Preview */}
        <div style={{
          marginTop: 'var(--space-2)',
          padding: '6px 10px',
          background: 'var(--color-surface-raised)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.8125rem',
          color: 'var(--color-text-secondary)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          <span style={{ fontWeight: 700, color: 'var(--color-accent)' }}>Allocation:</span>
          <span>{bagCount} × {formatGrams(grams)} · {compactSummary}</span>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginTop: 'var(--space-1)' }}>
        <button type="button" className="btn btn-primary" onClick={onSave}>
          {isNew ? 'Create Coffee' : 'Save Changes'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Bag Adjuster Row Component ───
interface BagAdjusterRowProps {
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

function BagAdjusterRow({
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
}: BagAdjusterRowProps) {
  const currentBuyerIds = bag.buyers.map((b) => b.personId).filter(Boolean);

  function handleModeChange(newMode: BagSplitMode) {
    if (newMode === 'full') {
      const firstBuyer = currentBuyerIds[0] || people[0]?.id || '';
      onAssignFull(firstBuyer);
    } else if (newMode === 'equal') {
      const splitBuyers = currentBuyerIds.length >= 2 ? currentBuyerIds : people.slice(0, 2).map((p) => p.id);
      onSplitEqual(splitBuyers);
    } else if (newMode === 'custom') {
      onOpenCustomSplit();
    }
  }

  function handleTogglePerson(personId: string) {
    if (bag.splitMode === 'full' || bag.splitMode === 'unassigned') {
      if (currentBuyerIds.includes(personId)) {
        onAssignFull('');
      } else {
        onAssignFull(personId);
      }
    } else {
      // Split mode
      let nextIds: string[];
      if (currentBuyerIds.includes(personId)) {
        nextIds = currentBuyerIds.filter((id) => id !== personId);
      } else {
        nextIds = [...currentBuyerIds, personId];
      }
      if (nextIds.length === 1) {
        onAssignFull(nextIds[0]);
      } else {
        onSplitEqual(nextIds);
      }
    }
  }

  return (
    <div className="bag-adjuster-card">
      <div className="bag-adjuster-top">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="bag-index-badge">Bag {bagIndex + 1} ({formatGrams(gramsPerBag)})</span>
          <div className="bag-mode-pills">
            <button
              type="button"
              className={`bag-mode-pill ${bag.splitMode === 'full' || bag.splitMode === 'unassigned' ? 'is-active' : ''}`}
              onClick={() => handleModeChange('full')}
            >
              Whole Bag
            </button>
            <button
              type="button"
              className={`bag-mode-pill ${bag.splitMode === 'equal' ? 'is-active' : ''}`}
              onClick={() => handleModeChange('equal')}
            >
              Equal Split
            </button>
            <button
              type="button"
              className={`bag-mode-pill ${bag.splitMode === 'custom' ? 'is-active' : ''}`}
              onClick={() => handleModeChange('custom')}
            >
              Custom Grams
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {bag.splitMode === 'custom' && (
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={onOpenCustomSplit}
            >
              Edit Grams
            </button>
          )}
          {totalBagsInLot > 1 && (
            <button
              type="button"
              className="btn btn-ghost btn-xs btn-danger-text"
              onClick={onRemoveBag}
              title="Remove this bag"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="bag-adjuster-buyers">
        {people.map((p) => {
          const isSelected = currentBuyerIds.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              className={`buyer-chip ${isSelected ? 'is-selected' : ''}`}
              onClick={() => handleTogglePerson(p.id)}
            >
              {isSelected ? '✓ ' : '+ '}
              {p.name}
              {isSelected && bag.splitMode === 'custom' && (
                <span style={{ fontSize: '0.6875rem', opacity: 0.8 }}>
                  ({bag.buyers.find((b) => b.personId === p.id)?.grams}g)
                </span>
              )}
            </button>
          );
        })}
        <button
          type="button"
          className="buyer-chip buyer-chip-add"
          onClick={onAddNewPerson}
        >
          + Add Person
        </button>
      </div>
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
      <div className="fb-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <h3 className="fb-modal-title">Custom Gram Split</h3>
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
                      className="btn btn-ghost btn-xs"
                      style={{ color: 'var(--color-text-muted)' }}
                      onClick={() => handleRemovePersonFromSplit(personId)}
                      title="Remove person"
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

        {/* Balance indicator */}
        <div style={{
          padding: '8px 12px',
          borderRadius: 'var(--radius-sm)',
          background: isValid ? '#ecfdf5' : '#fffbeb',
          border: `1px solid ${isValid ? '#a7f3d0' : '#fde68a'}`,
          fontSize: '0.8125rem',
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
