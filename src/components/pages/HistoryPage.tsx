import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import type { Order } from '../../types';
import { formatDateShort, formatZAR, todayISO } from '../../lib/formatters';
import { calculate } from '../../lib/calculations';
import { getActiveOrders, getPastOrders } from '../../lib/orderLifecycle';
import { getPastOrderSummary } from '../../lib/pastOrderSummary';
import { SettlementPacks } from '../order/SettlementPacks';
import { CoffeeCostSummary } from '../order/CoffeeCostSummary';
import { OrderSetup } from '../order/OrderSetup';
import { CoffeeLotsSection } from '../order/CoffeeLotsSection';
import { GoodsAndFees } from '../order/GoodsAndFees';
import { OrderSummary } from '../order/OrderSummary';
import {
  ORDER_WIZARD_STEPS,
  type OrderWizardStep,
  getMaxUnlockedStepIndex,
  getSuggestedWizardStep,
  isStepComplete,
  validateCoffeeStep,
  validateGoodsStep,
  validateSetupStep,
} from '../../lib/orderWizard';

interface Props {
  participantOnly?: boolean;
}

interface PinRequest {
  orderId: string;
  action: 'view' | 'edit';
}

const STEP_INDEX: Record<OrderWizardStep, number> = {
  setup: 0,
  coffees: 1,
  goods: 2,
  summary: 3,
};

export function HistoryPage({ participantOnly = false }: Props) {
  const {
    orders,
    people,
    deleteOrder,
    createOrder,
    exportJSON,
    importJSON,
    setLastExportDate,
    verifyOrderPin,
    unlockedOrderIds,
  } = useAppStore();

  const [pinRequest, setPinRequest] = useState<PinRequest | null>(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinAttempts, setPinAttempts] = useState(0);
  const [pinVerifying, setPinVerifying] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

  const personNames = useMemo(
    () => Object.fromEntries(people.map((person) => [person.id, person.name])),
    [people],
  );
  const activeOrders = getActiveOrders(orders);
  const pastOrders = getPastOrders(orders);
  const pinOrder = pinRequest ? pastOrders.find((order) => order.id === pinRequest.orderId) ?? null : null;
  const selectedOrder = selectedOrderId ? pastOrders.find((order) => order.id === selectedOrderId) ?? null : null;
  const editingOrder = editingOrderId ? pastOrders.find((order) => order.id === editingOrderId) ?? null : null;
  const selectedOrderSummary = selectedOrder ? getPastOrderSummary(selectedOrder, personNames) : null;
  const selectedOrderResult = selectedOrder ? calculate(selectedOrder, personNames) : null;

  useEffect(() => {
    if (selectedOrderId && !pastOrders.some((order) => order.id === selectedOrderId)) {
      setSelectedOrderId(null);
    }

    if (editingOrderId && !pastOrders.some((order) => order.id === editingOrderId)) {
      setEditingOrderId(null);
    }
  }, [editingOrderId, pastOrders, selectedOrderId]);

  function resetPinPrompt() {
    setPin('');
    setPinError('');
    setPinAttempts(0);
  }

  function openPastOrder(order: Order) {
    setSelectedOrderId(order.id);
    setEditingOrderId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openPastOrderEditor(order: Order) {
    setSelectedOrderId(order.id);
    setEditingOrderId(order.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function requestPastOrderAccess(order: Order, action: PinRequest['action']) {
    if (order.pinRequired && !unlockedOrderIds.has(order.id)) {
      setPinRequest({ orderId: order.id, action });
      resetPinPrompt();
      return;
    }

    if (action === 'edit') {
      openPastOrderEditor(order);
      return;
    }

    openPastOrder(order);
  }

  async function handleOpenOrder(order: Order) {
    requestPastOrderAccess(order, 'view');
  }

  async function handlePinSubmit() {
    if (!pinRequest) return;
    if (pinAttempts >= 5) return;
    if (pin.length < 4 || pin.length > 6) {
      setPinError('PIN must be 4-6 digits.');
      return;
    }

    setPinVerifying(true);
    setPinError('');

    try {
      const ok = await verifyOrderPin(pinRequest.orderId, pin);
      if (ok) {
        const unlockedOrder = pastOrders.find((order) => order.id === pinRequest.orderId);
        const nextRequest = pinRequest;
        setPinRequest(null);

        if (unlockedOrder) {
          if (nextRequest.action === 'edit') {
            openPastOrderEditor(unlockedOrder);
          } else {
            openPastOrder(unlockedOrder);
          }
        }
      } else {
        const nextAttempts = pinAttempts + 1;
        setPinAttempts(nextAttempts);
        setPinError(
          nextAttempts >= 5
            ? 'Too many incorrect attempts. Please try again later.'
            : `Incorrect PIN. ${5 - nextAttempts} attempt${5 - nextAttempts === 1 ? '' : 's'} remaining.`,
        );
        setPin('');
      }
    } catch {
      setPinError('Verification failed. Please try again.');
    } finally {
      setPinVerifying(false);
    }
  }

  async function handleDuplicate(order: Order) {
    await createOrder({
      ...order,
      name: `${order.name} (copy)`,
      orderDate: todayISO(),
      payments: {},
      pinRequired: false,
    });
  }

  async function handleEdit(order: Order) {
    requestPastOrderAccess(order, 'edit');
  }

  async function handleDelete(order: Order) {
    if (!confirm(`Delete "${order.name}"? This cannot be undone.`)) return;
    await deleteOrder(order.id);
    setSelectedOrderId((current) => (current === order.id ? null : current));
    setEditingOrderId((current) => (current === order.id ? null : current));
  }

  function handleExport() {
    const json = exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `fajr-brews-backup-${todayISO()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setLastExportDate(new Date().toISOString());
  }

  async function handleImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        await importJSON(text);
        alert('Import complete.');
      } catch {
        alert('Failed to import - invalid JSON file.');
      }
    };
    input.click();
  }

  return (
    <div className="page-container">
      {pinRequest && pinOrder && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 'var(--space-4)',
        }}>
          <div className="card card-padded" style={{ width: '100%', maxWidth: 380 }}>
            <div style={{ textAlign: 'center', marginBottom: 'var(--space-4)' }}>
              <div style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>🔒</div>
              <div style={{ fontWeight: 700, fontSize: '1.0625rem', color: 'var(--color-text-primary)' }}>
                Enter PIN
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                "{pinOrder.name}" requires a PIN to {pinRequest.action === 'edit' ? 'edit' : 'view'}.
              </div>
            </div>

            <div className="field" style={{ marginBottom: 'var(--space-4)' }}>
              <input
                className="input"
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Enter 4-6 digit PIN"
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(event) => event.key === 'Enter' && !pinVerifying && pinAttempts < 5 && handlePinSubmit()}
                autoFocus
                style={{ textAlign: 'center', fontSize: '1.25rem', letterSpacing: '0.3em' }}
                disabled={pinAttempts >= 5 || pinVerifying}
              />
            </div>

            {pinError && (
              <div className="alert alert-error" style={{ marginBottom: 'var(--space-4)', fontSize: '0.8125rem' }}>
                {pinError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={() => void handlePinSubmit()}
                disabled={pinVerifying || pinAttempts >= 5 || pin.length < 4}
              >
                {pinVerifying ? <span className="spinner" style={{ width: 16, height: 16 }} /> : 'Unlock'}
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setPinRequest(null);
                  resetPinPrompt();
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>{participantOnly ? 'My Orders' : 'Past Orders'}</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
            {participantOnly
              ? 'Saved orders you were part of stay here as finished records.'
              : 'Completed orders, payment tracking, and invoice actions all live together here for quick follow-up.'}
          </p>
        </div>

        {!participantOnly && (
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button className="btn btn-secondary btn-sm" onClick={handleExport}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
              Export JSON
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => void handleImport()}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
              Import JSON
            </button>
          </div>
        )}
      </div>

      {editingOrder && !participantOnly && (
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <PastOrderEditor
            order={editingOrder}
            onClose={() => {
              setEditingOrderId(null);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </div>
      )}

      {!editingOrder && selectedOrder && selectedOrderSummary && (
        <div style={{ marginBottom: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <section className="wizard-panel">
            <div className="wizard-card-header" style={{ alignItems: 'flex-start', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
              <div>
                <div className="section-label" style={{ marginBottom: 'var(--space-2)' }}>Saved order</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  <div className="wizard-card-title">{selectedOrder.name}</div>
                  <span className="wizard-badge wizard-badge-accent">Finalized</span>
                </div>
                <p className="wizard-card-copy" style={{ marginTop: 'var(--space-2)' }}>
                  Finalized on {formatDateShort(selectedOrder.orderDate)}.
                </p>
              </div>

              <div className="wizard-chip-row">
                <button className="btn btn-secondary btn-sm" onClick={() => setSelectedOrderId(null)}>
                  Back to list
                </button>
                {!participantOnly && (
                  <button className="btn btn-primary btn-sm" onClick={() => void handleEdit(selectedOrder)}>
                    Edit order
                  </button>
                )}
                {!participantOnly && (
                  <button className="btn btn-ghost btn-sm" onClick={() => void handleDuplicate(selectedOrder)}>
                    Duplicate as copy
                  </button>
                )}
                {!participantOnly && (
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--color-unpaid)' }}
                    onClick={() => void handleDelete(selectedOrder)}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>

            <div className="wizard-summary-grid">
              <SummaryMetric label="Participants" value={String(selectedOrderSummary.participantCount)} />
              <SummaryMetric label="Coffee lots" value={String(selectedOrderSummary.lotCount)} />
              <SummaryMetric label="Grand total" value={formatZAR(selectedOrderSummary.totalZar)} emphasize />
              <SummaryMetric
                label="Payments"
                value={`${selectedOrderSummary.paidCount}/${selectedOrderSummary.participantCount || 0} paid`}
              />
            </div>

            {!selectedOrderSummary.isValid && (
              <div className="alert alert-warning" style={{ marginTop: 'var(--space-4)' }}>
                This saved order is missing some finalized detail fields, so the archive is showing the best available snapshot.
              </div>
            )}

            {!participantOnly && (
              <div className="wizard-inline-note" style={{ marginTop: 'var(--space-4)' }}>
                Edit order opens this same saved order inside Past Orders, so you can correct mistakes without moving it back into the active order tab.
              </div>
            )}
          </section>

          {selectedOrderResult?.isValid && (
            <>
              <CoffeeCostSummary
                result={selectedOrderResult}
                title="Saved coffee totals"
                description="Each coffee keeps its fee-inclusive final cost, including the per-bag amount saved with this order."
              />
              <SettlementPacks
                order={selectedOrder}
                people={people}
                result={selectedOrderResult}
                title="Saved order details"
                description="Review the full settlement, payment state, and invoice/share actions exactly as saved."
              />
            </>
          )}
        </div>
      )}

      {participantOnly && activeOrders.length > 0 && (
        <section style={{ marginBottom: 'var(--space-6)' }}>
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <div className="section-label" style={{ marginBottom: 4 }}>Active Orders</div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
              Orders you are already included in, before they move into the saved archive.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {activeOrders.map((order) => {
              const summary = getPastOrderSummary(order, personNames);

              return (
                <div key={order.id} className="card">
                  <div className="card-padded" style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                        <div style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{order.name}</div>
                        <span className="wizard-badge wizard-badge-info">In progress</span>
                      </div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                        {formatDateShort(order.orderDate)} · {summary.participantCount} participant{summary.participantCount !== 1 ? 's' : ''} · {summary.lotCount} lot{summary.lotCount !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{formatZAR(summary.totalZar)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {pastOrders.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">📂</div>
          <h3>No past orders yet</h3>
          <p>{participantOnly ? 'Completed orders you were included in will appear here automatically.' : 'Finalize an order and it will appear here as a saved record.'}</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {pastOrders.map((order) => {
          const summary = getPastOrderSummary(order, personNames);
          const isSelected = selectedOrderId === order.id;
          const isLocked = order.pinRequired && !unlockedOrderIds.has(order.id);
          const isEditing = editingOrderId === order.id;

          return (
            <div
              key={order.id}
              className="card"
              style={isSelected ? { borderColor: 'var(--color-accent)', boxShadow: '0 0 0 2px color-mix(in srgb, var(--color-accent) 15%, transparent)' } : {}}
            >
              <button
                type="button"
                onClick={() => void handleOpenOrder(order)}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div className="card-padded">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 6 }}>
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text-primary)' }}>
                          {order.name}
                        </div>
                        <span className="wizard-badge wizard-badge-accent">Finalized</span>
                        {isEditing && <span className="wizard-badge wizard-badge-info">Editing</span>}
                        {isLocked && <span title="PIN protected" style={{ fontSize: '0.875rem' }}>🔒</span>}
                      </div>

                      <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                        {formatDateShort(order.orderDate)} · {summary.participantCount} participant{summary.participantCount !== 1 ? 's' : ''} · {summary.lotCount} lot{summary.lotCount !== 1 ? 's' : ''}
                      </div>

                      <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', marginTop: 'var(--space-3)', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                        <span><strong>{formatZAR(summary.totalZar)}</strong> total</span>
                        <span>{summary.paidCount}/{summary.participantCount} paid</span>
                        {summary.partialCount > 0 && <span>{summary.partialCount} partial</span>}
                        {!summary.isValid && <span style={{ color: 'var(--color-warning)' }}>Needs review</span>}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', fontWeight: 700, color: 'var(--color-accent)' }}>
                      Open order
                    </div>
                  </div>
                </div>
              </button>

              {!participantOnly && (
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', padding: '0 var(--space-4) var(--space-4)' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => void handleEdit(order)}>
                    Edit order
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => void handleDuplicate(order)}>
                    Duplicate as copy
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--color-unpaid)' }}
                    onClick={() => void handleDelete(order)}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PastOrderEditor({ order, onClose }: { order: Order; onClose: () => void }) {
  const { sessionUi, setOrderWizardStep } = useAppStore();
  const commitStepRef = useRef<(() => Promise<void>) | null>(null);
  const currentStep = sessionUi.orderWizardSteps[order.id] ?? getSuggestedWizardStep(order);
  const savedStep = sessionUi.orderWizardSteps[order.id];

  useEffect(() => {
    if (savedStep) {
      return;
    }
    setOrderWizardStep(order.id, getSuggestedWizardStep(order));
  }, [order.id, savedStep, setOrderWizardStep]);

  function getStepErrors(targetOrder: Order, step: OrderWizardStep): string[] {
    if (step === 'setup') return validateSetupStep(targetOrder);
    if (step === 'coffees') return validateCoffeeStep(targetOrder);
    if (step === 'goods') return validateGoodsStep(targetOrder);
    return [];
  }

  const validationErrors = useMemo(() => getStepErrors(order, currentStep), [currentStep, order]);
  const maxUnlockedStepIndex = getMaxUnlockedStepIndex(order);
  const currentStepIndex = STEP_INDEX[currentStep];
  const stepCompleteMap: Record<OrderWizardStep, boolean> = {
    setup: isStepComplete(order, 'setup'),
    coffees: isStepComplete(order, 'coffees'),
    goods: isStepComplete(order, 'goods'),
    summary: isStepComplete(order, 'summary'),
  };

  async function flushCurrentStep() {
    if (commitStepRef.current) {
      await commitStepRef.current();
    }
  }

  async function handleClose() {
    await flushCurrentStep();
    onClose();
  }

  async function goToStep(step: OrderWizardStep) {
    if (STEP_INDEX[step] <= maxUnlockedStepIndex || step === currentStep) {
      if (step !== currentStep) {
        await flushCurrentStep();
      }
      setOrderWizardStep(order.id, step);
    }
  }

  async function handleNext() {
    if (currentStep === 'summary') return;
    await flushCurrentStep();
    const latestOrder = useAppStore.getState().orders.find((candidate) => candidate.id === order.id) ?? order;
    const freshErrors = getStepErrors(latestOrder, currentStep);
    if (freshErrors.length > 0) return;
    const nextStep = ORDER_WIZARD_STEPS[currentStepIndex + 1]?.id;
    if (nextStep) setOrderWizardStep(order.id, nextStep);
  }

  async function handleBack() {
    await flushCurrentStep();
    const previousStep = ORDER_WIZARD_STEPS[currentStepIndex - 1]?.id;
    if (previousStep) setOrderWizardStep(order.id, previousStep);
  }

  return (
    <div className="wizard-shell">
      <section className="wizard-panel wizard-panel-muted">
        <div className="wizard-card-header" style={{ alignItems: 'flex-start', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
          <div>
            <div className="section-label" style={{ marginBottom: 'var(--space-2)' }}>Past Orders</div>
            <div className="wizard-card-title">Editing saved order</div>
            <p className="wizard-card-copy" style={{ marginTop: 'var(--space-2)' }}>
              Correct this order here without moving it back into the active order tab.
            </p>
          </div>

          <div className="wizard-chip-row">
            <button className="btn btn-secondary btn-sm" onClick={() => void handleClose()}>
              Back to details
            </button>
          </div>
        </div>
      </section>

      <section className="wizard-hero">
        <div className="wizard-hero-top">
          <div>
            <div className="wizard-kicker">Past order correction</div>
            <h2 className="wizard-page-title">{order.name || 'Untitled order'}</h2>
            <p className="wizard-page-copy">
              {formatDateShort(order.orderDate)} - update setup, coffees, fees, and settlement details while keeping this record finalized.
            </p>
          </div>
          <span className="wizard-badge wizard-badge-accent">Finalized</span>
        </div>

        <div className="wizard-progress">
          {ORDER_WIZARD_STEPS.map((step, index) => {
            const unlocked = index <= maxUnlockedStepIndex || step.id === currentStep;
            const complete = stepCompleteMap[step.id];
            const active = step.id === currentStep;
            return (
              <button
                key={step.id}
                className={`wizard-progress-step ${active ? 'is-active' : ''} ${complete ? 'is-complete' : ''}`}
                onClick={() => void goToStep(step.id)}
                disabled={!unlocked}
              >
                <span className="wizard-progress-index">{complete ? 'v' : index + 1}</span>
                <span className="wizard-progress-text">
                  <span className="wizard-progress-label">{step.shortLabel}</span>
                  <span className="wizard-progress-subtitle">{step.label}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="wizard-stage">
        {currentStep === 'setup' && <OrderSetup order={order} registerCommit={(commit) => { commitStepRef.current = commit; }} />}
        {currentStep === 'coffees' && <CoffeeLotsSection order={order} />}
        {currentStep === 'goods' && <GoodsAndFees order={order} registerCommit={(commit) => { commitStepRef.current = commit; }} />}
        {currentStep === 'summary' && (
          <OrderSummary
            order={order}
            onJumpToStep={(step) => setOrderWizardStep(order.id, step)}
            onFinalize={onClose}
          />
        )}
      </div>

      {currentStep !== 'summary' && (
        <div className="wizard-footer">
          <div className="wizard-footer-copy">
            {validationErrors.length > 0 ? validationErrors[0] : ORDER_WIZARD_STEPS[currentStepIndex].label}
          </div>

          <div className="wizard-footer-actions">
            <button className="btn btn-ghost" onClick={() => void handleBack()} disabled={currentStepIndex === 0}>
              Back
            </button>

            <button
              className="btn btn-primary"
              onClick={() => void handleNext()}
              disabled={validationErrors.length > 0}
            >
              {currentStep === 'goods' ? 'Review summary' : 'Continue'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryMetric({ label, value, emphasize = false }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div className={`wizard-metric ${emphasize ? 'is-emphasized' : ''}`}>
      <div className="wizard-metric-label">{label}</div>
      <div className="wizard-metric-value">{value}</div>
    </div>
  );
}
