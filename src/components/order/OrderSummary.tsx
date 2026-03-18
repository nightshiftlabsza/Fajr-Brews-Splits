import { useState } from 'react';
import type { Order, PaymentRecord } from '../../types';
import { useAppStore } from '../../store/appStore';
import { calculate } from '../../lib/calculations';
import { formatZAR } from '../../lib/formatters';
import { ORDER_WIZARD_STEPS, type OrderWizardStep } from '../../lib/orderWizard';
import { getNextActiveOrderId } from '../../lib/orderLifecycle';
import { SettlementPacks } from './SettlementPacks';

interface Props {
  order: Order;
  onJumpToStep: (step: Extract<OrderWizardStep, 'setup' | 'coffees' | 'goods'>) => void;
  onFinalize: () => void;
}

export function OrderSummary({ order, onJumpToStep, onFinalize }: Props) {
  const { people, orders, updateOrder, setCurrentOrderId } = useAppStore();
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);

  const personNames = Object.fromEntries(people.map((person) => [person.id, person.name]));
  const result = calculate(order, personNames);

  if (!result.isValid) {
    return (
      <div className="wizard-step-stack">
        <section className="wizard-panel">
          <div className="wizard-card-title">Summary is waiting for the earlier steps</div>
          <p className="wizard-card-copy" style={{ marginTop: 'var(--space-2)' }}>
            Fix the highlighted issues below, then come back here for the final review.
          </p>
        </section>
        {result.validationErrors.map((error, index) => (
          <div key={index} className="alert alert-warning">{error}</div>
        ))}
      </div>
    );
  }

  function updatePayment(personId: string, record: PaymentRecord) {
    void updateOrder(order.id, {
      payments: { ...order.payments, [personId]: record },
    });
  }

  async function handleFinalizeOrder() {
    setFinalizing(true);
    setFinalizeError(null);
    try {
      await updateOrder(order.id, { isArchived: true });
      const nextActiveOrderId = getNextActiveOrderId(useAppStore.getState().orders, order.id);
      setCurrentOrderId(nextActiveOrderId);
      onFinalize();
    } catch (error) {
      setFinalizeError(error instanceof Error ? error.message : 'Failed to finalize this order. Please try again.');
    } finally {
      setFinalizing(false);
    }
  }

  const payer = people.find((person) => person.id === order.payerId);
  const activeOrderCount = orders.filter((candidate) => !candidate.isArchived && candidate.id !== order.id).length;
  const orderStatus = getOrderStatus(order, result);

  return (
    <div className="wizard-step-stack">
      <section className="wizard-panel order-summary-overview">
        <div className="order-summary-overview-top">
          <div>
            <div className="section-label" style={{ marginBottom: 'var(--space-2)' }}>Order overview</div>
            <div className="order-summary-title-row">
              <h3 className="wizard-card-title">{order.name || 'Untitled order'}</h3>
              <span className={`summary-status-pill is-${orderStatus.tone}`}>{orderStatus.label}</span>
            </div>
          </div>

          <div className="wizard-chip-row">
            <button className="btn btn-secondary btn-sm" onClick={() => onJumpToStep('setup')}>Edit setup</button>
            <button className="btn btn-secondary btn-sm" onClick={() => onJumpToStep('coffees')}>Edit coffees</button>
            <button className="btn btn-secondary btn-sm" onClick={() => onJumpToStep('goods')}>Edit goods</button>
          </div>
        </div>

        <div className="summary-progress-compact" aria-label="Order progress">
          {ORDER_WIZARD_STEPS.map((step, index) => (
            <div
              key={step.id}
              className={`summary-progress-item ${index < ORDER_WIZARD_STEPS.length - 1 ? 'is-complete' : 'is-active'}`}
            >
              <span className="summary-progress-index">{index < ORDER_WIZARD_STEPS.length - 1 ? index + 1 : index + 1}</span>
              <span className="summary-progress-label">{step.shortLabel}</span>
            </div>
          ))}
        </div>

        <div className="wizard-summary-grid order-summary-metrics">
          <SummaryMetric label="Goods subtotal" value={formatZAR(result.totalGoodsZar)} />
          <SummaryMetric label="Fees subtotal" value={formatZAR(result.totalFeesZar)} />
          <SummaryMetric label="Grand total" value={formatZAR(result.totalOrderZar)} emphasize />
          <SummaryMetric label="People charged" value={String(result.personIds.length)} />
        </div>

        {Math.abs(result.roundingAbsorbed) > 0.001 && (
          <div className="wizard-inline-note order-summary-note">
            Rounding absorbed by {payer?.name || 'payer'}: {formatZAR(Math.abs(result.roundingAbsorbed))}
            {result.roundingAbsorbed > 0 ? ' (payer pays more)' : ' (payer pays less)'}
          </div>
        )}
      </section>

      <SettlementPacks
        order={order}
        people={people}
        result={result}
        onPaymentChange={updatePayment}
        paymentEditingEnabled
      />

      <section className="wizard-panel order-finalize-panel">
        <div className="wizard-card-header">
          <div>
            <div className="wizard-card-title">Finalize order</div>
            <p className="wizard-card-copy">
              Save this order into Past Orders when the settlement is ready to leave the active workspace.
            </p>
          </div>
        </div>

        <div className="wizard-inline-note">
          {activeOrderCount > 0
            ? `Finalizing now will move this order to Past Orders and return you to your remaining ${activeOrderCount} active ${activeOrderCount === 1 ? 'order' : 'orders'}.`
            : 'Finalizing now will move this order to Past Orders and clear it from the active drafting workspace.'}
        </div>

        {finalizeError && (
          <div className="alert alert-error" style={{ marginTop: 'var(--space-4)' }}>
            {finalizeError}
          </div>
        )}

        <div className="wizard-inline-actions" style={{ marginTop: 'var(--space-4)' }}>
          <button className="btn btn-primary" onClick={handleFinalizeOrder} disabled={finalizing}>
            {finalizing ? <span className="spinner" style={{ width: 16, height: 16 }} /> : 'Save to Past Orders'}
          </button>
        </div>
      </section>
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

function getOrderStatus(order: Order, result: ReturnType<typeof calculate>) {
  if (order.isArchived) {
    return { label: 'Finalized', tone: 'complete' as const };
  }

  const statuses = result.personIds.map((personId) => order.payments[personId]?.status || 'unpaid');
  if (statuses.length > 0 && statuses.every((status) => status === 'paid')) {
    return { label: 'Paid in full', tone: 'complete' as const };
  }
  if (statuses.some((status) => status === 'paid' || status === 'partial')) {
    return { label: 'Collecting payments', tone: 'active' as const };
  }

  return { label: 'Ready to finalize', tone: 'ready' as const };
}
