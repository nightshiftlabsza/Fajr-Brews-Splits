import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../store/appStore';
import type { Bag, BagSplitMode, CoffeeLot, Order } from '../../types';
import { formatGrams, parseMoneyInput } from '../../lib/formatters';
import { formatListPrice } from '../../lib/listPriceFormat';
import { isOrderLocked } from '../../lib/orderLifecycle';
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
  getLotBuyers,
  removeBagFromBags,
  splitBagEqually,
  syncLotWithSelectedBuyers,
} from '../../lib/allocationInference';
import {
  countAssignedBags,
  describeBag,
  disambiguatePersonNames,
} from '../../lib/bagAllocationEditor';
import { PersonEditor, type PersonFormValues } from '../people/PersonEditor';
import { ConfirmModal } from '../ui/ConfirmModal';
import { Sheet } from '../ui/Sheet';
import { Icon } from '../ui/Icon';
import { LotEditorForm, type LotFormState } from './LotEditorForm';
import { BagAssignPanel } from './BagAssignPanel';

function genId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

function useIsMobile(query = '(max-width: 767px)') {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia(query);
    const handler = () => setIsMobile(media.matches);
    media.addEventListener?.('change', handler);
    return () => media.removeEventListener?.('change', handler);
  }, [query]);

  return isMobile;
}

interface Props {
  order: Order;
  onOrderChange?: (patch: Partial<Order>) => void | Promise<void>;
  onContinue?: () => void;
  registerCommit?: (commit: (() => Promise<void>) | null) => void;
}

const emptyLotForm: LotFormState = {
  name: '',
  foreignPricePerBag: '',
  gramsPerBag: '250',
  initialBagCount: '1',
  selectedBuyerIds: [],
  bags: createEmptyBags(1),
};

export function CoffeeLotsSection({ order, onOrderChange, onContinue, registerCommit }: Props) {
  const { people, addPerson, updateOrder } = useAppStore(
    useShallow((s) => ({
      people: s.people,
      addPerson: s.addPerson,
      updateOrder: s.updateOrder,
    }))
  );
  const patchOrder = onOrderChange ?? ((patch: Partial<Order>) => updateOrder(order.id, patch));
  const isMobile = useIsMobile();

  const [editingLotId, setEditingLotId] = useState<string | 'new' | null>(null);
  const [activeBagTarget, setActiveBagTarget] = useState<{ lotId: string; bagIndex: number } | null>(null);
  const [lotForm, setLotForm] = useState<LotFormState>(emptyLotForm);
  const [formError, setFormError] = useState('');

  // Modals state
  const [personEditorTarget, setPersonEditorTarget] = useState<{ inForm?: boolean; lotId?: string; bagId?: string } | null>(null);
  const [personEditorError, setPersonEditorError] = useState('');
  const [personEditorSaving, setPersonEditorSaving] = useState(false);

  const [deleteLotTarget, setDeleteLotTarget] = useState<CoffeeLot | null>(null);
  const [deleteBagTarget, setDeleteBagTarget] = useState<{ lot: CoffeeLot; bag: Bag; bagIndex: number } | null>(null);
  const [bagSizeConfirmTarget, setBagSizeConfirmTarget] = useState<{
    lot: CoffeeLot;
    newGrams: number;
    nextBags: Bag[];
  } | null>(null);

  const personNameMap = useMemo(
    () => Object.fromEntries(people.map((p) => [p.id, p.name])),
    [people]
  );
  const disambiguatedNames = useMemo(() => disambiguatePersonNames(people), [people]);

  const coffeeErrors = useMemo(() => validateCoffeeStep(order), [order]);
  const isAllocationComplete = order.lots.length > 0 && coffeeErrors.length === 0;
  const isLocked = !onOrderChange && isOrderLocked(order);

  useEffect(() => {
    if (!registerCommit) return;
    registerCommit(async () => {
      if (!editingLotId || isLocked) return;
      const gramsPerBag = parseInt(lotForm.gramsPerBag, 10);
      const bagCount = parseInt(lotForm.initialBagCount, 10);
      const foreignPricePerBag = parseMoneyInput(lotForm.foreignPricePerBag);
      if (
        lotForm.name.trim() &&
        Number.isInteger(gramsPerBag) &&
        gramsPerBag >= 1 &&
        Number.isFinite(foreignPricePerBag) &&
        foreignPricePerBag > 0 &&
        Number.isInteger(bagCount) &&
        bagCount >= 1
      ) {
        await saveLot();
      }
    });
    return () => registerCommit(null);
  }, [registerCommit, editingLotId, lotForm, order, isLocked]);

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
    if (isLocked) return;
    setLotForm({
      name: '',
      foreignPricePerBag: '',
      gramsPerBag: '250',
      initialBagCount: '1',
      selectedBuyerIds: [],
      bags: createEmptyBags(1),
    });
    setFormError('');
    setActiveBagTarget(null);
    setEditingLotId('new');
  }

  function openEdit(lot: CoffeeLot) {
    if (isLocked) return;
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
    setActiveBagTarget(null);
    setEditingLotId(lot.id);
  }

  async function saveLot(openFirstBag = false): Promise<void> {
    if (isLocked) return;
    const gramsPerBag = parseInt(lotForm.gramsPerBag, 10);
    const bagCount = parseInt(lotForm.initialBagCount, 10);
    const foreignPricePerBag = parseMoneyInput(lotForm.foreignPricePerBag);

    if (!lotForm.name.trim()) return setFormError('Coffee name is required.');
    if (!Number.isInteger(gramsPerBag) || gramsPerBag < 1) {
      return setFormError('Grams per bag must be an integer ≥ 1.');
    }
    if (!Number.isFinite(foreignPricePerBag) || foreignPricePerBag <= 0) {
      return setFormError('Price per bag must be greater than zero.');
    }
    if (!Number.isInteger(bagCount) || bagCount < 1) {
      return setFormError('Bag count must be at least 1.');
    }

    let finalBags = lotForm.bags;
    if (finalBags.length !== bagCount) {
      const resizedBags =
        finalBags.length < bagCount
          ? [...finalBags, ...createEmptyBags(bagCount - finalBags.length)]
          : finalBags.slice(0, bagCount);
      finalBags = syncLotWithSelectedBuyers(resizedBags, lotForm.selectedBuyerIds, gramsPerBag);
    }

    if (editingLotId === 'new') {
      const serialized = serializeLotFromBags(finalBags);
      const newLotId = genId();
      await patchOrder({
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
      if (openFirstBag) {
        setActiveBagTarget({ lotId: newLotId, bagIndex: 0 });
      }
      return;
    }

    const existingLot = order.lots.find((lot) => lot.id === editingLotId);
    if (!existingLot) {
      setFormError('Could not find the coffee you are editing.');
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
    await patchOrder({
      lots: order.lots.map((lot) =>
        lot.id === editingLotId
          ? {
              ...lot,
              name: lotForm.name.trim(),
              foreignPricePerBag,
              gramsPerBag,
              ...serialized,
            }
          : lot
      ),
    });
    setEditingLotId(null);
    setFormError('');
  }

  async function commitBagSizeChange() {
    if (!bagSizeConfirmTarget || isLocked) return;
    const { lot, newGrams, nextBags } = bagSizeConfirmTarget;
    const serialized = serializeLotFromBags(nextBags);
    await patchOrder({
      lots: order.lots.map((l) =>
        l.id === lot.id
          ? {
              ...l,
              name: lotForm.name.trim() || l.name,
              foreignPricePerBag: parseMoneyInput(lotForm.foreignPricePerBag) || l.foreignPricePerBag,
              gramsPerBag: newGrams,
              ...serialized,
            }
          : l
      ),
    });
    setBagSizeConfirmTarget(null);
    setEditingLotId(null);
  }

  async function deleteLot(lotId: string) {
    if (isLocked) return;
    const remainingLots = order.lots.filter((lot) => lot.id !== lotId);
    await patchOrder({ lots: remainingLots });
    if (editingLotId === lotId) setEditingLotId(null);
    if (activeBagTarget?.lotId === lotId) setActiveBagTarget(null);
    setDeleteLotTarget(null);
  }

  async function updateLotBags(lotId: string, nextBags: Bag[]) {
    if (isLocked) return;
    const serialized = serializeLotFromBags(nextBags);
    await patchOrder({
      lots: order.lots.map((lot) => (lot.id === lotId ? { ...lot, ...serialized } : lot)),
    });
  }

  function handleSaveBagAssignment(
    lotId: string,
    bagIndex: number,
    buyers: { personId: string; grams: number }[],
    mode: BagSplitMode
  ) {
    const lot = order.lots.find((l) => l.id === lotId);
    if (!lot) return;
    const bags = normalizeLotToBags(lot);
    const targetBag = bags[bagIndex];
    if (!targetBag) return;

    const nextBags = bags.map((b, idx) => {
      if (idx !== bagIndex) return b;
      return {
        ...b,
        splitMode: mode,
        buyers: buyers.map((buyer) => ({
          id: genId(),
          personId: buyer.personId,
          grams: buyer.grams,
        })),
      };
    });

    updateLotBags(lotId, nextBags);
    setActiveBagTarget(null);
  }

  function handleCopyBag1(lot: CoffeeLot, targetBagIndex: number) {
    if (isLocked) return;
    const bags = normalizeLotToBags(lot);
    const bag1 = bags[0];
    if (!bag1 || bag1.buyers.length === 0) return;

    const nextBags = bags.map((b, idx) => {
      if (idx !== targetBagIndex) return b;
      return {
        ...b,
        splitMode: bag1.splitMode,
        buyers: bag1.buyers.map((buyer) => ({
          ...buyer,
          id: genId(),
        })),
      };
    });

    updateLotBags(lot.id, nextBags);
  }

  function handlePromptRemoveBag(lot: CoffeeLot, bag: Bag, bagIndex: number) {
    if (isLocked) return;
    if (bag.buyers.length > 0 && bag.splitMode !== 'unassigned') {
      setDeleteBagTarget({ lot, bag, bagIndex });
    } else {
      const bags = normalizeLotToBags(lot);
      updateLotBags(lot.id, removeBagFromBags(bags, bag.id));
    }
  }

  function handleConfirmRemoveBag() {
    if (!deleteBagTarget || isLocked) return;
    const { lot, bag } = deleteBagTarget;
    const bags = normalizeLotToBags(lot);
    updateLotBags(lot.id, removeBagFromBags(bags, bag.id));
    setDeleteBagTarget(null);
    if (activeBagTarget?.lotId === lot.id && activeBagTarget?.bagIndex === deleteBagTarget.bagIndex) {
      setActiveBagTarget(null);
    }
  }

  async function handleCreatePerson(values: PersonFormValues) {
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

      if (personEditorTarget?.inForm) {
        const nextSelected = [...lotForm.selectedBuyerIds, person.id];
        const grams = parseInt(lotForm.gramsPerBag, 10) || 250;
        const nextBags = syncLotWithSelectedBuyers(lotForm.bags, nextSelected, grams);
        setLotForm({
          ...lotForm,
          selectedBuyerIds: nextSelected,
          bags: nextBags,
        });
      } else if (personEditorTarget?.lotId) {
        const lot = order.lots.find((l) => l.id === personEditorTarget.lotId);
        if (lot) {
          const bags = normalizeLotToBags(lot);
          if (personEditorTarget.bagId) {
            const nextBags = bags.map((b) =>
              b.id === personEditorTarget.bagId ? assignFullBag(b, person.id, lot.gramsPerBag) : b
            );
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

  // Active bag target for mobile sheet
  const activeSheetLot = activeBagTarget ? order.lots.find((l) => l.id === activeBagTarget.lotId) : null;
  const activeSheetBags = activeSheetLot ? normalizeLotToBags(activeSheetLot) : [];
  const activeSheetBag = activeBagTarget && activeSheetBags[activeBagTarget.bagIndex] ? activeSheetBags[activeBagTarget.bagIndex] : null;

  return (
    <div className="coffee-section-stack">
      {/* Top Header Card */}
      <section className="wizard-panel">
        <div className="wizard-card-header">
          <div>
            <h2 className="wizard-card-title">Coffees</h2>
            <p className="wizard-card-copy">
              Enter each coffee, bag size, and count. Bags are assigned to people in whole grams.
            </p>
          </div>
          {editingLotId !== 'new' && !isLocked && (
            <button className="btn btn-primary btn-sm" onClick={openNew}>
              <Icon name="plus" size={14} /> Add coffee
            </button>
          )}
        </div>
      </section>

      {/* Empty State */}
      {order.lots.length === 0 && editingLotId !== 'new' && (
        <section className="wizard-panel">
          <div className="empty-state empty-state-padded">
            <div className="empty-state-icon">
              <Icon name="cup" size={32} />
            </div>
            <h3>No coffees added yet</h3>
            <p>Add your first coffee to assign bags and calculate shares.</p>
            {!isLocked && (
              <button className="btn btn-primary" onClick={openNew}>
                <Icon name="plus" size={14} /> Add coffee
              </button>
            )}
          </div>
        </section>
      )}

      {/* New Coffee Form */}
      {editingLotId === 'new' && (
        <section className="wizard-panel lot-form-panel">
          <div className="section-label" style={{ marginBottom: 'var(--space-3)' }}>
            New Coffee
          </div>
          <LotEditorForm
            form={lotForm}
            error={formError}
            isNew={true}
            currencyCode={order.listCurrency}
            onChange={setLotForm}
            onSaveAndAssign={() => void saveLot(true)}
            onSaveLater={() => void saveLot(false)}
            onCancel={() => setEditingLotId(null)}
          />
        </section>
      )}

      {/* Coffee Lots Ruled Ledger */}
      <div className="fb-coffee-list">
        {order.lots.map((lot) => {
          const isEditing = editingLotId === lot.id;
          const bags = normalizeLotToBags(lot);
          const assignedCount = countAssignedBags(lot);
          const isComplete = assignedCount === bags.length && bags.length > 0;
          const bag1HasBuyers = bags[0]?.buyers && bags[0].buyers.length > 0;
          const compactSummary = formatCompactAllocationSummary(bags, lot.gramsPerBag, personNameMap);

          if (isEditing) {
            return (
              <section key={lot.id} className="wizard-panel lot-form-panel">
                <div className="section-label" style={{ marginBottom: 'var(--space-3)' }}>
                  Edit Coffee
                </div>
                <LotEditorForm
                  form={lotForm}
                  error={formError}
                  isNew={false}
                  currencyCode={order.listCurrency}
                  onChange={setLotForm}
                  onSaveLater={() => void saveLot(false)}
                  onCancel={() => setEditingLotId(null)}
                />
              </section>
            );
          }

          return (
            <div key={lot.id} className="fb-coffee-group">
              {/* Coffee Header */}
              <div className="fb-coffee-group-header">
                <div className="fb-coffee-header-info">
                  <h3 className="fb-coffee-name">{lot.name}</h3>
                  <div className="fb-coffee-meta">
                    <span>
                      {bags.length} × {formatGrams(lot.gramsPerBag)}
                    </span>
                    <span className="fb-coffee-meta-dot">·</span>
                    <span>{formatListPrice(lot.foreignPricePerBag, order.listCurrency)} / bag</span>
                  </div>
                </div>

                {!isLocked && (
                  <div className="fb-coffee-header-actions">
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
                )}
              </div>

              {/* Status Bar */}
              <div className="fb-coffee-status-bar">
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  {isComplete ? (
                    <span className="fb-coffee-status-chip is-ready">
                      <Icon name="check" size={12} /> Ready
                    </span>
                  ) : (
                    <span className="fb-coffee-status-chip is-needed">
                      <Icon name="warning" size={12} /> {assignedCount} of {bags.length} bags have someone
                    </span>
                  )}
                  {compactSummary && (
                    <span style={{ color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                      · {compactSummary}
                    </span>
                  )}
                </div>

                {!isLocked && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() => updateLotBags(lot.id, addBagToBags(bags))}
                  >
                    <Icon name="plus" size={12} /> Add bag
                  </button>
                )}
              </div>

              {/* Ruled Bag Rows */}
              <div className="fb-bag-rows-list">
                {bags.map((bag, bagIdx) => {
                  const isPanelActive =
                    activeBagTarget?.lotId === lot.id && activeBagTarget?.bagIndex === bagIdx;
                  const isAssigned = bag.splitMode !== 'unassigned' && bag.buyers.length > 0;
                  const desc = describeBag(bag, lot.gramsPerBag, disambiguatedNames);

                  return (
                    <div key={bag.id} className="fb-bag-row-item">
                      <div className={`fb-bag-row ${isPanelActive ? 'is-active-editing' : ''}`}>
                        <div className="fb-bag-row-lead">
                          <span className="fb-bag-number-badge">
                            Bag {bagIdx + 1}, {formatGrams(lot.gramsPerBag)}
                          </span>
                          <span className={`fb-bag-desc ${!isAssigned ? 'is-unassigned' : ''}`}>
                            {desc}
                          </span>
                        </div>

                        {!isLocked && (
                          <div className="fb-bag-row-actions">
                            <button
                              type="button"
                              className="fb-bag-action-link"
                              onClick={() => {
                                if (isPanelActive) {
                                  setActiveBagTarget(null);
                                } else {
                                  setActiveBagTarget({ lotId: lot.id, bagIndex: bagIdx });
                                }
                              }}
                            >
                              Change
                            </button>

                            {bagIdx > 0 && bag1HasBuyers && (
                              <button
                                type="button"
                                className="fb-bag-copy-link"
                                onClick={() => handleCopyBag1(lot, bagIdx)}
                                title="Copy assignment from Bag 1"
                              >
                                Same as Bag 1
                              </button>
                            )}

                            {bags.length > 1 && (
                              <button
                                type="button"
                                className="fb-bag-remove-btn"
                                onClick={() => handlePromptRemoveBag(lot, bag, bagIdx)}
                                aria-label={`Remove Bag ${bagIdx + 1}`}
                                title="Remove bag"
                              >
                                <Icon name="close" size={12} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Desktop Inline Assignment Panel */}
                      {!isMobile && isPanelActive && !isLocked && (
                        <BagAssignPanel
                          bag={bag}
                          bagIndex={bagIdx}
                          bagSize={lot.gramsPerBag}
                          people={people}
                          onSave={(buyers, mode) =>
                            handleSaveBagAssignment(lot.id, bagIdx, buyers, mode)
                          }
                          onCancel={() => setActiveBagTarget(null)}
                          onAddNewPerson={() => {
                            setPersonEditorError('');
                            setPersonEditorTarget({ lotId: lot.id, bagId: bag.id });
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile Assignment Sheet */}
      {isMobile && activeBagTarget && activeSheetLot && activeSheetBag && (
        <Sheet
          isOpen={true}
          onClose={() => setActiveBagTarget(null)}
          title={`Bag ${activeBagTarget.bagIndex + 1}, ${formatGrams(activeSheetLot.gramsPerBag)}`}
          description={activeSheetLot.name}
          fullHeight
        >
          <div className="fb-sheet-assign-wrap">
            <BagAssignPanel
              bag={activeSheetBag}
              bagIndex={activeBagTarget.bagIndex}
              bagSize={activeSheetLot.gramsPerBag}
              people={people}
              isSheet={true}
              onSave={(buyers, mode) =>
                handleSaveBagAssignment(activeBagTarget.lotId, activeBagTarget.bagIndex, buyers, mode)
              }
              onCancel={() => setActiveBagTarget(null)}
              onAddNewPerson={() => {
                setPersonEditorError('');
                setPersonEditorTarget({ lotId: activeBagTarget.lotId, bagId: activeSheetBag.id });
              }}
            />
          </div>
        </Sheet>
      )}

      {/* Bottom Next-Step Action */}
      {order.lots.length > 0 && onContinue && (
        <div className="lot-section-footer">
          <div className="lot-section-footer-summary">
            <span className="lot-section-total-count" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {allocationStats.totalBags} {allocationStats.totalBags === 1 ? 'total bag' : 'total bags'}
            </span>
            {!isAllocationComplete && (
              <span className="lot-section-footer-hint">
                · {allocationStats.unassignedBags > 0
                  ? `${allocationStats.unassignedBags} ${allocationStats.unassignedBags === 1 ? 'bag needs' : 'bags need'} a buyer`
                  : 'Complete bag assignments to continue'}
              </span>
            )}
          </div>
          <button
            type="button"
            className="btn btn-primary lot-section-next-btn"
            onClick={onContinue}
            disabled={!isAllocationComplete}
          >
            <span>Next: Goods & fees</span>
            <Icon name="arrow-right" size={14} />
          </button>
        </div>
      )}

      {/* Add Person Modal */}
      {personEditorTarget && (
        <div className="fb-modal-backdrop" onClick={() => setPersonEditorTarget(null)}>
          <div className="fb-modal-card" onClick={(e) => e.stopPropagation()}>
            <PersonEditor
              title="Add person"
              description="Add a member to the workspace directory to assign bags or shares."
              error={personEditorError}
              saving={personEditorSaving}
              submitLabel="Add person"
              onSave={handleCreatePerson}
              onCancel={() => setPersonEditorTarget(null)}
            />
          </div>
        </div>
      )}

      {/* Delete Lot Confirm Modal */}
      {deleteLotTarget && (
        <ConfirmModal
          isOpen={true}
          title={`Delete "${deleteLotTarget.name}"?`}
          description="Are you sure you want to remove this coffee and its bags? This action cannot be undone."
          confirmText="Delete coffee"
          cancelText="Cancel"
          variant="danger"
          onConfirm={() => deleteLot(deleteLotTarget.id)}
          onCancel={() => setDeleteLotTarget(null)}
        />
      )}

      {/* Delete Bag Confirm Modal */}
      {deleteBagTarget && (
        <ConfirmModal
          isOpen={true}
          title={`Remove Bag ${deleteBagTarget.bagIndex + 1}?`}
          description={`Remove Bag ${deleteBagTarget.bagIndex + 1} of "${deleteBagTarget.lot.name}"? Anyone assigned to it will lose their share.`}
          confirmText="Remove bag"
          cancelText="Cancel"
          variant="danger"
          onConfirm={handleConfirmRemoveBag}
          onCancel={() => setDeleteBagTarget(null)}
        />
      )}

      {/* Bag Size Change Confirm Modal */}
      {bagSizeConfirmTarget && (() => {
        const clearedBags = normalizeLotToBags(bagSizeConfirmTarget.lot)
          .map((b, i) => ({ b, num: i + 1 }))
          .filter((x) => x.b.splitMode === 'custom');
        const bagNames = clearedBags.map((x) => `Bag ${x.num}`).join(', ');
        return (
          <ConfirmModal
            isOpen={true}
            title="Reset custom splits?"
            description={`Changing the bag size to ${bagSizeConfirmTarget.newGrams}g will clear ${bagNames || 'custom bags'}. You will need to choose who gets them again.`}
            confirmText="Update bag size"
            cancelText="Keep existing size"
            variant="warning"
            onConfirm={() => void commitBagSizeChange()}
            onCancel={() => setBagSizeConfirmTarget(null)}
          />
        );
      })()}
    </div>
  );
}
