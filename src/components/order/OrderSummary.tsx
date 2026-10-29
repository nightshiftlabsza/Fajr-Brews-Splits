import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Order, PaymentRecord } from '../../types';
import { useAppStore } from '../../store/appStore';
import { calculate } from '../../lib/calculations';
import { formatZAR } from '../../lib/formatters';
import type { OrderWizardStep } from '../../lib/orderWizard';
import { getNextActiveOrderId } from '../../lib/orderLifecycle';
import { resolveOrderRoaster } from '../../lib/roasters';
import { SettlementPacks } from './SettlementPacks';
import { CoffeeCostSummary } from './CoffeeCostSummary';
import { RoasterAvatar } from '../roaster/RoasterAvatar';
import { ConfirmModal } from '../ui/ConfirmModal';
import { Icon } from '../ui/Icon';

interface Props {
  order: Order;
  onJumpToStep: (step: Extract<OrderWizardStep, 'setup' | 'coffees' | 'goods'>) => void;
  onFinalize: () => void;
}

export function OrderSummary({ order, onJumpToStep, onFinalize }: Props) {
  const { people, roasters, orders, updateOrder, setCurrentOrderId, flushOrderWrites, user, memberRole } = useAppStore(
    useShallow((s) => ({
      people: s.people,
      roasters: s.roasters,
      orders: s.orders,
      updateOrder: s.updateOrder,
      setCurrentOrderId: s.setCurrentOrderId,
      flushOrderWrites: s.flushOrderWrites,
      user: s.user,
      memberRole: s.memberRole,
    }))
  );
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false);

  const personNames = Object.fromEntries(people.map((person) => [person.id, person.name]));
  const result = calculate(order, personNames);

  if (!result.isValid) {
    return (
      <div className="wizard-step-stack">
        <section className="wizard-panel">
          <div className="wizard-card-title">Summary is waiting for earlier details</div>
          <p className="wizard-card-copy summary-card-copy">
            Fix the highlighted issues below to review the final order totals and payments.
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
      await flushOrderWrites(order.id);

      const latestOrder = useAppStore.getState().orders.find((candidate) => candidate.id === order.id) ?? order;
      const latestPersonNames = Object.fromEntries(useAppStore.getState().people.map((person) => [person.id, person.name]));
      const latestResult = calculate(latestOrder, latestPersonNames);

      if (!latestResult.isValid) {
        throw new Error(latestResult.validationErrors[0] ?? 'This order still has unsaved or incomplete data.');
      }

      if (order.isArchived) {
        onFinalize();
        return;
      }

      await updateOrder(order.id, { isArchived: true });
      await flushOrderWrites(order.id);
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
  const orderRoaster = resolveOrderRoaster(order, roasters);
  const orderStatus = getOrderStatus(order, result);
  const savingPastOrder = order.isArchived;
  const isWorkspaceManager = memberRole === 'owner' || memberRole === 'admin';
  const isOwner = !order.ownerId || order.ownerId === user?.id || isWorkspaceManager;

  return (
    <div className="order-cockpit">
      <div className="order-cockpit-grid">
        {/* Main Left Workspace Column */}
        <div className="cockpit-main-column">
          {/* Grand total hero card */}
          <section className="fb-summary-hero-card">
            <div className="fb-summary-hero-label">Grand total</div>
            <div className="fb-summary-hero-amount num-cell">{formatZAR(result.totalOrderZar)}</div>
            <div className="fb-summary-hero-sub">
              <span>Goods: {formatZAR(result.totalGoodsZar)}</span>
              <span>·</span>
              <span>Fees: {formatZAR(result.totalFeesZar)}</span>
              <span>·</span>
              <span>{result.personIds.length} {result.personIds.length === 1 ? 'person' : 'people'}</span>
            </div>
            {Math.abs(result.roundingAbsorbed) > 0.001 && (
              <div className="rounding-absorption-badge" style={{ marginTop: 'var(--space-3)' }}>
                <span className="rounding-badge-icon" aria-hidden="true">
                  <Icon name="info" size={14} />
                </span>
                <span>
                  Rounding absorbed by <strong>{payer?.name || 'payer'}</strong>: <strong className="num-cell">{formatZAR(Math.abs(result.roundingAbsorbed))}</strong>
                  {result.roundingAbsorbed > 0 ? ' (payer pays more)' : ' (payer pays less)'}
                </span>
              </div>
            )}
          </section>

          <SettlementPacks
            order={order}
            people={people}
            result={result}
            title="Who owes what"
            onPaymentChange={updatePayment}
            paymentEditingEnabled={isOwner}
          />

          <details className="fb-cost-accordion">
            <summary className="fb-cost-accordion-summary">
              <span>How the cost was worked out</span>
              <Icon name="chevron-down" size={16} />
            </summary>
            <div className="fb-cost-accordion-body">
              <CoffeeCostSummary result={result} />
            </div>
          </details>
        </div>

        {/* Desktop Sticky Financial & Action Cockpit Sidebar */}
        <aside className="cockpit-sidebar-column">
          <section className="cockpit-card">
            <div className="section-label cockpit-section-label">Order total</div>
            <div className="cockpit-hero-total">
              <span className="cockpit-hero-total-label">Grand total</span>
              <span className="cockpit-hero-total-amount num-cell">{formatZAR(result.totalOrderZar)}</span>
            </div>
            <div className="cockpit-line-items">
              <div className="cockpit-line-item">
                <span>Goods subtotal</span>
                <strong className="num-cell">{formatZAR(result.totalGoodsZar)}</strong>
              </div>
              <div className="cockpit-line-item">
                <span>Fees subtotal</span>
                <strong className="num-cell">{formatZAR(result.totalFeesZar)}</strong>
              </div>
              <div className="cockpit-line-item">
                <span>People charged</span>
                <strong className="num-cell">{result.personIds.length}</strong>
              </div>
            </div>

            {Math.abs(result.roundingAbsorbed) > 0.001 && (
              <div className="rounding-absorption-badge cockpit-badge-margin">
                <span className="rounding-badge-icon" aria-hidden="true">
                  <Icon name="info" size={14} />
                </span>
                <span>
                  Rounding absorbed by <strong>{payer?.name || 'payer'}</strong>: <strong className="num-cell">{formatZAR(Math.abs(result.roundingAbsorbed))}</strong>
                </span>
              </div>
            )}

            <div className="divider cockpit-divider" />

            <div className="cockpit-actions">
              <button
                type="button"
                className="btn btn-primary btn-lg w-full"
                onClick={() => {
                  if (savingPastOrder) {
                    void handleFinalizeOrder();
                  } else {
                    setConfirmArchiveOpen(true);
                  }
                }}
                disabled={finalizing}
              >
                {finalizing ? (
                  <span className="spinner spinner-btn-primary" />
                ) : savingPastOrder ? (
                  'Save changes'
                ) : (
                  'Move to past orders'
                )}
              </button>
            </div>

            {finalizeError && (
              <div className="alert alert-error alert-error-margin" role="alert">
                {finalizeError}
              </div>
            )}
          </section>
        </aside>
      </div>

      {/* Mobile Sticky Action Bar */}
      <div className="summary-sticky-bar" role="region" aria-label="Finalize order">
        <span className="sr-only">Finalize order</span>
        {finalizeError && (
          <div className="alert alert-error summary-sticky-alert" role="alert">
            {finalizeError}
          </div>
        )}
        <div className="summary-sticky-status-group">
          <span className="summary-sticky-status-label">{savingPastOrder ? 'Past order' : 'Finalize order'}</span>
          <span className="summary-sticky-status-dot">·</span>
          <strong className="summary-sticky-status-total num-cell">{formatZAR(result.totalOrderZar)}</strong>
        </div>

        <div className="summary-sticky-actions">
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={() => {
              if (savingPastOrder) {
                void handleFinalizeOrder();
              } else {
                setConfirmArchiveOpen(true);
              }
            }}
            disabled={finalizing}
          >
            {finalizing ? (
              <span className="spinner spinner-btn-primary" />
            ) : savingPastOrder ? (
              'Save changes'
            ) : (
              'Move to past orders'
            )}
          </button>
        </div>
      </div>

      {/* Move to Past Orders Confirmation Modal */}
      {confirmArchiveOpen && (
        <ConfirmModal
          isOpen={true}
          title={`Move "${order.name}" to past orders?`}
          description="This order will leave the active list and live under Past orders. You can still inspect it, print invoices, or duplicate it anytime from Past orders."
          confirmText="Move to past orders"
          cancelText="Cancel"
          variant="warning"
          isLoading={finalizing}
          onConfirm={async () => {
            setConfirmArchiveOpen(false);
            await handleFinalizeOrder();
          }}
          onCancel={() => setConfirmArchiveOpen(false)}
        />
      )}

      <style>{`
        .summary-card-copy {
          margin-top: var(--space-2);
        }

        .overview-section-label {
          margin-bottom: var(--space-2);
        }

        .roaster-hint {
          margin-top: var(--space-2);
        }

        .cockpit-section-label {
          margin-bottom: var(--space-3);
        }

        .cockpit-badge-margin {
          margin-bottom: var(--space-4);
        }

        .cockpit-divider {
          margin: var(--space-4) 0;
        }

        .spinner-btn-primary {
          width: 16px;
          height: 16px;
        }

        .spinner-btn-sm {
          width: 14px;
          height: 14px;
        }

        .btn-danger-ghost {
          color: var(--color-unpaid);
        }

        .alert-error-margin {
          margin-top: var(--space-3);
        }

        .summary-sticky-alert {
          width: 100%;
          margin-bottom: var(--space-2);
        }

        .rounding-absorption-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: var(--radius-sm);
          background: var(--color-surface-raised);
          border: 1px solid var(--color-border);
          font-size: 0.8125rem;
          color: var(--color-text-secondary);
          font-variant-numeric: tabular-nums;
        }

        .rounding-badge-icon {
          font-weight: 700;
          color: var(--color-accent);
          flex-shrink: 0;
        }

        @media (min-width: 1024px) {
          .order-cockpit-grid {
            display: grid;
            grid-template-columns: minmax(0, 1.4fr) minmax(320px, 380px);
            gap: var(--space-6);
            align-items: start;
          }

          .cockpit-sidebar-column {
            display: flex;
            flex-direction: column;
            gap: var(--space-4);
            position: sticky;
            top: calc(var(--nav-top-height, 64px) + var(--space-4));
          }

          .cockpit-mobile-summary-card {
            display: none !important;
          }

          .summary-sticky-bar {
            display: none !important;
          }
        }
      `}</style>
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
