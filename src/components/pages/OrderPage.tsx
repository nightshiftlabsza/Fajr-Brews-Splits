import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { OrderSetup } from '../order/OrderSetup';
import { CoffeeLotsSection } from '../order/CoffeeLotsSection';
import { GoodsAndFees } from '../order/GoodsAndFees';
import { OrderSummary } from '../order/OrderSummary';
import { SettlementPacks } from '../order/SettlementPacks';
import { getActiveOrders, getOrderLifecycleLabel, getPreferredActiveOrderId, normalizeOrderStatus } from '../../lib/orderLifecycle';
import { getPastOrderSummary } from '../../lib/pastOrderSummary';
import { calculate } from '../../lib/calculations';
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
import { formatDateShort, formatZAR, todayISO } from '../../lib/formatters';
import { resolveOrderRoaster } from '../../lib/roasters';
import { RoasterAvatar } from '../roaster/RoasterAvatar';
import type { Order, OrderStatus } from '../../types';

const STEP_INDEX: Record<OrderWizardStep, number> = {
  setup: 0,
  coffees: 1,
  goods: 2,
  summary: 3,
};

interface Props {
  onNavigateToHistory: () => void;
}

export function OrderPage({ onNavigateToHistory }: Props) {
  const {
    orders,
    people,
    roasters,
    user,
    currentOrderId,
    createOrder,
    updateOrderStatus,
    updateOrder,
    setCurrentOrderId,
    setOrderWizardStep,
    sessionUi,
    linkedPersonId,
  } = useAppStore();

  const activeOrders = useMemo(() => getActiveOrders(orders), [orders]);
  const [activeDetailOrderId, setActiveDetailOrderId] = useState<string | null>(() => currentOrderId || activeOrders[0]?.id || null);
  const [detailSubTab, setDetailSubTab] = useState<'order' | 'invoices'>('order');
  const [shareCopySuccess, setShareCopySuccess] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const commitStepRef = useRef<(() => Promise<void>) | null>(null);

  const personNames = useMemo(
    () => Object.fromEntries(people.map((person) => [person.id, person.name])),
    [people],
  );

  const currentOrder = useMemo(
    () => (activeDetailOrderId ? activeOrders.find((order) => order.id === activeDetailOrderId) ?? null : null),
    [activeOrders, activeDetailOrderId],
  );

  useEffect(() => {
    if (currentOrderId && activeOrders.some((o) => o.id === currentOrderId) && currentOrderId !== activeDetailOrderId) {
      setActiveDetailOrderId(currentOrderId);
    }
  }, [currentOrderId, activeOrders]);

  const currentStep = currentOrder
    ? sessionUi.orderWizardSteps[currentOrder.id] ?? getSuggestedWizardStep(currentOrder)
    : 'setup';
  const savedStep = currentOrder ? sessionUi.orderWizardSteps[currentOrder.id] : undefined;

  useEffect(() => {
    if (!currentOrder || savedStep) return;
    setOrderWizardStep(currentOrder.id, getSuggestedWizardStep(currentOrder));
  }, [currentOrder?.id, savedStep, setOrderWizardStep]);

  async function handleNewOrder() {
    setCreating(true);
    setCreateError(null);
    try {
      const order = await createOrder({
        name: 'New Coffee Order',
        orderDate: todayISO(),
        status: 'planning',
        roasterId: null,
        roasterSnapshot: null,
        payerId: null,
        payerBank: { bankName: '', accountNumber: '', beneficiary: '' },
        referenceTemplate: 'FAJR-{ORDER}-{NAME}',
        goodsTotalZar: 0,
        lots: [],
        fees: [],
        payments: {},
      });
      if (order) {
        setCurrentOrderId(order.id);
        setActiveDetailOrderId(order.id);
        setOrderWizardStep(order.id, 'setup');
        setDetailSubTab('order');
      }
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Failed to create order. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  async function handleDuplicate(order: Order) {
    const duplicated = await createOrder({
      ...order,
      name: `${order.name} (copy)`,
      orderDate: todayISO(),
      status: 'planning',
      payments: {},
    });
    if (duplicated) {
      setCurrentOrderId(duplicated.id);
      setActiveDetailOrderId(duplicated.id);
    }
  }

  async function handleArchiveOrder(order: Order) {
    if (confirm(`Archive "${order.name}"? It will move into Past Orders.`)) {
      await updateOrderStatus(order.id, 'archived');
      if (activeDetailOrderId === order.id) {
        setActiveDetailOrderId(null);
      }
    }
  }

  function handleShareLink(order: Order) {
    const joinUrl = `${window.location.origin}${window.location.pathname}?joinOrder=${order.id}`;
    navigator.clipboard.writeText(joinUrl).then(
      () => {
        setShareCopySuccess(order.id);
        setTimeout(() => setShareCopySuccess(null), 3000);
      },
      () => {
        alert(`Join link: ${joinUrl}`);
      },
    );
  }

  function getStepErrors(order: typeof currentOrder, step: OrderWizardStep): string[] {
    if (!order) return [];
    if (step === 'setup') return validateSetupStep(order);
    if (step === 'coffees') return validateCoffeeStep(order);
    if (step === 'goods') return validateGoodsStep(order);
    return [];
  }

  const validationErrors = useMemo(() => {
    return getStepErrors(currentOrder, currentStep);
  }, [currentOrder, currentStep]);

  if (!currentOrder) {
    return (
      <div className="page-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
          <div>
            <h2 style={{ marginBottom: 4 }}>Active Orders</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
              Manage multiple in-progress orders simultaneously.
            </p>
          </div>

          <button className="btn btn-primary btn-lg" onClick={() => void handleNewOrder()} disabled={creating}>
            {creating ? <span className="spinner" style={{ width: 18, height: 18 }} /> : '+ New Active Order'}
          </button>
        </div>

        {createError && <div className="alert alert-warning" style={{ marginBottom: 'var(--space-4)' }}>{createError}</div>}

        {activeOrders.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">☕</div>
            <h3>No active orders</h3>
            <p>Start a new order to plan coffees, gather participants, and split bags.</p>
            <button className="btn btn-primary" onClick={() => void handleNewOrder()} disabled={creating}>
              Create New Order
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
            {activeOrders.map((order) => {
              const summary = getPastOrderSummary(order, personNames);
              const roaster = resolveOrderRoaster(order, roasters);
              const status = normalizeOrderStatus(order.status, order.isArchived);

              return (
                <div key={order.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div className="card-padded">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        {roaster && <RoasterAvatar name={roaster.name} logoUrl={roaster.logoUrl} size={38} />}
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '1.0625rem', color: 'var(--color-text-primary)' }}>{order.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{formatDateShort(order.orderDate)}</div>
                        </div>
                      </div>
                      <StatusBadge status={status} />
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 'var(--space-4)', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                      <div><strong>{summary.participantCount}</strong> participants</div>
                      <div><strong>{summary.lotCount}</strong> lots</div>
                      <div><strong>{formatZAR(summary.totalZar)}</strong> est. total</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', borderTop: '1px solid var(--color-border)', padding: 'var(--space-3)', background: 'var(--color-surface-raised)', borderBottomLeftRadius: 'var(--radius-md)', borderBottomRightRadius: 'var(--radius-md)', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ flex: 1 }}
                      onClick={() => {
                        setCurrentOrderId(order.id);
                        setActiveDetailOrderId(order.id);
                        setDetailSubTab('order');
                      }}
                    >
                      Open Order →
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => void handleDuplicate(order)}>
                      Duplicate
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => void handleArchiveOrder(order)}>
                      Archive
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const maxUnlockedStepIndex = getMaxUnlockedStepIndex(currentOrder);
  const currentStepIndex = STEP_INDEX[currentStep];
  const orderId = currentOrder.id;
  const isOwner = !currentOrder.ownerId || currentOrder.ownerId === user?.id;
  const resolvedRoaster = resolveOrderRoaster(currentOrder, roasters);
  const orderResult = calculate(currentOrder, personNames);
  const stepCompleteMap: Record<OrderWizardStep, boolean> = {
    setup: isStepComplete(currentOrder, 'setup'),
    coffees: isStepComplete(currentOrder, 'coffees'),
    goods: isStepComplete(currentOrder, 'goods'),
    summary: isStepComplete(currentOrder, 'summary'),
  };

  async function flushCurrentStep() {
    if (commitStepRef.current) {
      await commitStepRef.current();
    }
  }

  async function goToStep(step: OrderWizardStep) {
    if (STEP_INDEX[step] <= maxUnlockedStepIndex || step === currentStep) {
      if (step !== currentStep) {
        await flushCurrentStep();
      }
      setOrderWizardStep(orderId, step);
    }
  }

  async function handleNext() {
    if (currentStep === 'summary') return;
    await flushCurrentStep();
    const freshErrors = getStepErrors(currentOrder, currentStep);
    if (freshErrors.length > 0) return;
    const nextStep = ORDER_WIZARD_STEPS[currentStepIndex + 1]?.id;
    if (nextStep) setOrderWizardStep(orderId, nextStep);
  }

  async function handleBack() {
    await flushCurrentStep();
    const previousStep = ORDER_WIZARD_STEPS[currentStepIndex - 1]?.id;
    if (previousStep) setOrderWizardStep(orderId, previousStep);
  }

  return (
    <div className="page-container wizard-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setActiveDetailOrderId(null)}
        >
          ← Back to Active Orders
        </button>

        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Status:</label>
          <select
            className="input"
            style={{ width: 'auto', padding: '4px 8px', fontSize: '0.8125rem' }}
            value={normalizeOrderStatus(currentOrder.status, currentOrder.isArchived)}
            onChange={(e) => void updateOrderStatus(currentOrder.id, e.target.value as OrderStatus)}
          >
            <option value="planning">Planning</option>
            <option value="locked">Locked</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => handleShareLink(currentOrder)}
          >
            {shareCopySuccess === currentOrder.id ? '✓ Link Copied!' : '🔗 Share / Invite'}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            {resolvedRoaster && <RoasterAvatar name={resolvedRoaster.name} logoUrl={resolvedRoaster.logoUrl} size={48} />}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0 }}>{currentOrder.name}</h2>
                <StatusBadge status={normalizeOrderStatus(currentOrder.status, currentOrder.isArchived)} />
              </div>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                Date: {formatDateShort(currentOrder.orderDate)} · Roaster: {resolvedRoaster?.name || 'Unspecified'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
            <button
              className={`btn btn-sm ${detailSubTab === 'order' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ borderRadius: 0 }}
              onClick={() => setDetailSubTab('order')}
            >
              Order Details
            </button>
            <button
              className={`btn btn-sm ${detailSubTab === 'invoices' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ borderRadius: 0 }}
              onClick={() => setDetailSubTab('invoices')}
            >
              Invoices
            </button>
          </div>
        </div>
      </div>

      {detailSubTab === 'order' && (
        <div className="wizard-shell">
          <section className="wizard-hero">
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
                    <span className="wizard-progress-index">{complete ? '✓' : index + 1}</span>
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
            {currentStep === 'setup' && <OrderSetup order={currentOrder} registerCommit={(commit) => { commitStepRef.current = commit; }} />}
            {currentStep === 'coffees' && <CoffeeLotsSection order={currentOrder} />}
            {currentStep === 'goods' && <GoodsAndFees order={currentOrder} registerCommit={(commit) => { commitStepRef.current = commit; }} />}
            {currentStep === 'summary' && (
              <OrderSummary
                order={currentOrder}
                onJumpToStep={(step) => setOrderWizardStep(orderId, step)}
                onFinalize={onNavigateToHistory}
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
      )}

      {detailSubTab === 'invoices' && (
        <div style={{ marginTop: 'var(--space-4)' }}>
          {orderResult.isValid ? (
            <SettlementPacks
              order={currentOrder}
              people={people}
              result={orderResult}
              title="Order Invoices"
              description={isOwner ? 'Viewing all participant invoices for this order.' : 'Viewing your personal invoice.'}
              visiblePersonIds={!isOwner && linkedPersonId ? [linkedPersonId] : undefined}
              onPaymentChange={(personId, record) => updateOrder(currentOrder.id, {
                payments: { ...currentOrder.payments, [personId]: record },
              })}
              paymentEditingEnabled={isOwner}
            />
          ) : (
            <div className="alert alert-warning">
              Complete coffee allocation and fee setup to view generated invoices.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const label = status === 'planning' ? 'Planning' : status === 'locked' ? 'Locked' : status === 'completed' ? 'Completed' : 'Archived';
  const badgeClass = status === 'planning' ? 'wizard-badge-info' : status === 'locked' ? 'wizard-badge-warning' : status === 'completed' ? 'wizard-badge-accent' : 'wizard-badge';
  return <span className={`wizard-badge ${badgeClass}`}>{label}</span>;
}
