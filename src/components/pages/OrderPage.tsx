import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { OrderSetup } from '../order/OrderSetup';
import { CoffeeLotsSection } from '../order/CoffeeLotsSection';
import { GoodsAndFees } from '../order/GoodsAndFees';
import { OrderSummary } from '../order/OrderSummary';
import { getActiveOrders, getPreferredActiveOrderId } from '../../lib/orderLifecycle';
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
import { formatDateShort, todayISO } from '../../lib/formatters';

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
  const { orders, currentOrderId, createOrder, setCurrentOrderId, setOrderWizardStep, sessionUi } = useAppStore();
  const activeOrders = useMemo(() => getActiveOrders(orders), [orders]);
  const currentOrder = useMemo(
    () => activeOrders.find((order) => order.id === currentOrderId) ?? activeOrders[0] ?? null,
    [activeOrders, currentOrderId],
  );
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const commitStepRef = useRef<(() => Promise<void>) | null>(null);
  const currentStep = currentOrder
    ? sessionUi.orderWizardSteps[currentOrder.id] ?? getSuggestedWizardStep(currentOrder)
    : 'setup';
  const savedStep = currentOrder ? sessionUi.orderWizardSteps[currentOrder.id] : undefined;

  useEffect(() => {
    if (!currentOrder || savedStep) {
      return;
    }
    setOrderWizardStep(currentOrder.id, getSuggestedWizardStep(currentOrder));
  }, [currentOrder?.id, savedStep, setOrderWizardStep]);

  useEffect(() => {
    const preferredOrderId = getPreferredActiveOrderId(orders, currentOrderId);
    if (preferredOrderId !== currentOrderId) {
      setCurrentOrderId(preferredOrderId);
    }
  }, [orders, currentOrderId, setCurrentOrderId]);

  async function handleNewOrder() {
    setCreating(true);
    setCreateError(null);
    try {
      const order = await createOrder({
        name: 'New Order',
        orderDate: todayISO(),
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
        setOrderWizardStep(order.id, 'setup');
      }
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Failed to create order. Please try again.');
    } finally {
      setCreating(false);
    }
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
      <div className="page-container wizard-page">
        <div className="wizard-empty-panel">
          <div className="empty-state" style={{ paddingTop: 'var(--space-16)' }}>
            <div className="empty-state-icon">📋</div>
            <h3>No active order</h3>
            <p>Create a new order to start the guided four-step flow.</p>
            <button className="btn btn-primary btn-lg" onClick={handleNewOrder} disabled={creating}>
              {creating ? <span className="spinner" style={{ width: 18, height: 18 }} /> : 'New order'}
            </button>
            {createError && (
              <div className="alert alert-warning" style={{ marginTop: 'var(--space-3)', textAlign: 'left' }}>
                {createError}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const maxUnlockedStepIndex = getMaxUnlockedStepIndex(currentOrder);
  const currentStepIndex = STEP_INDEX[currentStep];
  const orderId = currentOrder.id;
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
    const { orders: latestOrders, currentOrderId: latestCurrentOrderId } = useAppStore.getState();
    const freshOrder = getActiveOrders(latestOrders).find((order) => order.id === latestCurrentOrderId) ?? getActiveOrders(latestOrders)[0] ?? null;
    const freshErrors = getStepErrors(freshOrder, currentStep);
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
      <div className="wizard-shell">
        {activeOrders.length > 1 && (
          <section className="wizard-panel wizard-panel-muted">
            <div className="wizard-card-header">
              <div>
                <div className="wizard-card-title">Active orders</div>
                <p className="wizard-card-copy">Switch between draft and in-progress orders without leaving the workbench.</p>
              </div>
            </div>

            <div className="wizard-chip-row" style={{ marginTop: 'var(--space-4)' }}>
              {activeOrders.map((order) => (
                <button
                  key={order.id}
                  className={`btn btn-sm ${currentOrder?.id === order.id ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setCurrentOrderId(order.id)}
                >
                  {order.name || 'Untitled order'}
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="wizard-hero">
          <div className="wizard-hero-top">
            <div>
              <div className="wizard-kicker">Order creation</div>
              <h2 className="wizard-page-title">{currentOrder.name || 'Untitled order'}</h2>
              <p className="wizard-page-copy">
                {formatDateShort(currentOrder.orderDate)} • move from setup into coffees, then fees, then final review.
              </p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={handleNewOrder} disabled={creating}>
              {creating ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'New order'}
            </button>
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
                  onClick={() => goToStep(step.id)}
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

        <div className="wizard-footer">
          <div className="wizard-footer-copy">
            {validationErrors.length > 0 ? validationErrors[0] : ORDER_WIZARD_STEPS[currentStepIndex].label}
          </div>

          <div className="wizard-footer-actions">
            <button className="btn btn-ghost" onClick={handleBack} disabled={currentStepIndex === 0}>
              Back
            </button>

            {currentStep !== 'summary' ? (
              <button
                className="btn btn-primary"
                onClick={handleNext}
                disabled={validationErrors.length > 0}
              >
                {currentStep === 'goods' ? 'Review summary' : 'Continue'}
              </button>
            ) : (
              <button className="btn btn-primary" onClick={() => setOrderWizardStep(orderId, 'coffees')}>
                Edit coffees
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
