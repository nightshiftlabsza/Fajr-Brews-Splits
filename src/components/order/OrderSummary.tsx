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

interface Props {
  order: Order;
  onJumpToStep: (step: Extract<OrderWizardStep, 'setup' | 'coffees' | 'goods'>) => void;
  onFinalize: () => void;
}

export function OrderSummary({ order, onJumpToStep, onFinalize }: Props) {
  const { people, roasters, orders, updateOrder, deleteOrder, setCurrentOrderId, flushOrderWrites, user, memberRole } = useAppStore(
    useShallow((s) => ({
      people: s.people,
      roasters: s.roasters,
      orders: s.orders,
      updateOrder: s.updateOrder,
      deleteOrder: s.deleteOrder,
      setCurrentOrderId: s.setCurrentOrderId,
      flushOrderWrites: s.flushOrderWrites,
      user: s.user,
      memberRole: s.memberRole,
    }))
  );
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const personNames = Object.fromEntries(people.map((person) => [person.id, person.name]));
  const result = calculate(order, personNames);

  if (!result.isValid) {
    return (
      <div className="wizard-step-stack">
        <section className="wizard-panel">
          <div className="wizard-card-title">Summary is waiting for earlier details</div>
          <p className="wizard-card-copy" style={{ marginTop: 'var(--space-2)' }}>
            Fix the highlighted issues below to review the final order totals and settlements.
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

  async function handleConfirmDelete() {
    if (order.isArchived) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      await flushOrderWrites(order.id);
      await deleteOrder(order.id);
      setConfirmDeleteOpen(false);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Failed to delete this order. Please try again.');
    } finally {
      setDeleting(false);
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
          <section className="wizard-panel order-summary-overview">
            <div className="order-summary-overview-top">
              <div>
                <div className="section-label" style={{ marginBottom: 'var(--space-2)' }}>Order overview</div>
                <div className="order-summary-title-row">
                  {orderRoaster && (
                    <RoasterAvatar
                      name={orderRoaster.name}
                      logoUrl={orderRoaster.logoUrl}
                      size={42}
                    />
                  )}
                  <h3 className="wizard-card-title">{order.name || 'Untitled order'}</h3>
                  <span className={`summary-status-pill is-${orderStatus.tone}`}>{orderStatus.label}</span>
                </div>
                {orderRoaster && (
                  <div className="field-hint" style={{ marginTop: 'var(--space-2)' }}>
                    Roaster: {orderRoaster.name}
                  </div>
                )}
              </div>

              <div className="wizard-chip-row">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => onJumpToStep('setup')}>Edit setup</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => onJumpToStep('coffees')}>Edit coffees</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => onJumpToStep('goods')}>Edit goods</button>
              </div>
            </div>
          </section>

          {/* Mobile-only Financial Summary Card */}
          <section className="wizard-panel cockpit-mobile-summary-card">
            <div className="cockpit-hero-total">
              <span className="cockpit-hero-total-label">Grand Total</span>
              <span className="cockpit-hero-total-amount">{formatZAR(result.totalOrderZar)}</span>
            </div>
            <div className="cockpit-line-items">
              <div className="cockpit-line-item">
                <span>Goods subtotal</span>
                <strong>{formatZAR(result.totalGoodsZar)}</strong>
              </div>
              <div className="cockpit-line-item">
                <span>Fees subtotal</span>
                <strong>{formatZAR(result.totalFeesZar)}</strong>
              </div>
              <div className="cockpit-line-item">
                <span>People charged</span>
                <strong>{result.personIds.length}</strong>
              </div>
            </div>
            {Math.abs(result.roundingAbsorbed) > 0.001 && (
              <div className="rounding-absorption-badge">
                <span className="rounding-badge-icon" aria-hidden="true">ℹ</span>
                <span>
                  Rounding absorbed by <strong>{payer?.name || 'payer'}</strong>: <strong>{formatZAR(Math.abs(result.roundingAbsorbed))}</strong>
                  {result.roundingAbsorbed > 0 ? ' (payer pays more)' : ' (payer pays less)'}
                </span>
              </div>
            )}
          </section>

          <CoffeeCostSummary result={result} />

          <SettlementPacks
            order={order}
            people={people}
            result={result}
            title="Participants & Invoices"
            onPaymentChange={updatePayment}
            paymentEditingEnabled={isOwner}
          />
        </div>

        {/* Desktop Sticky Financial & Action Cockpit Sidebar */}
        <aside className="cockpit-sidebar-column">
          <section className="cockpit-card">
            <div className="section-label" style={{ marginBottom: 'var(--space-3)' }}>Order Total & Finalization</div>
            <div className="cockpit-hero-total">
              <span className="cockpit-hero-total-label">Grand Total</span>
              <span className="cockpit-hero-total-amount">{formatZAR(result.totalOrderZar)}</span>
            </div>
            <div className="cockpit-line-items">
              <div className="cockpit-line-item">
                <span>Goods subtotal</span>
                <strong>{formatZAR(result.totalGoodsZar)}</strong>
              </div>
              <div className="cockpit-line-item">
                <span>Fees subtotal</span>
                <strong>{formatZAR(result.totalFeesZar)}</strong>
              </div>
              <div className="cockpit-line-item">
                <span>People charged</span>
                <strong>{result.personIds.length}</strong>
              </div>
            </div>

            {Math.abs(result.roundingAbsorbed) > 0.001 && (
              <div className="rounding-absorption-badge" style={{ marginBottom: 'var(--space-4)' }}>
                <span className="rounding-badge-icon" aria-hidden="true">ℹ</span>
                <span>
                  Rounding absorbed by <strong>{payer?.name || 'payer'}</strong>: <strong>{formatZAR(Math.abs(result.roundingAbsorbed))}</strong>
                </span>
              </div>
            )}

            <div className="divider" style={{ margin: 'var(--space-4) 0' }} />

            <div className="cockpit-actions">
              <button
                type="button"
                className="btn btn-primary btn-lg w-full"
                onClick={handleFinalizeOrder}
                disabled={finalizing || deleting}
              >
                {finalizing ? (
                  <span className="spinner" style={{ width: 16, height: 16 }} />
                ) : savingPastOrder ? (
                  'Save changes'
                ) : (
                  'Save to Past Orders'
                )}
              </button>
              {!savingPastOrder && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm w-full"
                  style={{ color: 'var(--color-unpaid)' }}
                  onClick={() => setConfirmDeleteOpen(true)}
                  disabled={deleting || finalizing}
                >
                  {deleting ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Delete order'}
                </button>
              )}
            </div>

            {finalizeError && (
              <div className="alert alert-error" role="alert" style={{ marginTop: 'var(--space-3)' }}>
                {finalizeError}
              </div>
            )}

            {deleteError && (
              <div className="alert alert-error" role="alert" style={{ marginTop: 'var(--space-3)' }}>
                {deleteError}
              </div>
            )}
          </section>
        </aside>
      </div>

      {/* Mobile Sticky Action Bar */}
      <div className="summary-sticky-bar" role="region" aria-label="Finalize order">
        <span className="sr-only">Finalize order</span>
        {finalizeError && (
          <div className="alert alert-error" role="alert" style={{ width: '100%', marginBottom: 'var(--space-2)' }}>
            {finalizeError}
          </div>
        )}
        {deleteError && (
          <div className="alert alert-error" role="alert" style={{ width: '100%', marginBottom: 'var(--space-2)' }}>
            {deleteError}
          </div>
        )}
        <div className="summary-sticky-status-group">
          <span className="summary-sticky-status-label">{savingPastOrder ? 'Past Order' : 'Finalize order'}</span>
          <span className="summary-sticky-status-dot">·</span>
          <strong className="summary-sticky-status-total">{formatZAR(result.totalOrderZar)}</strong>
        </div>

        <div className="summary-sticky-actions">
          {!savingPastOrder && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => setConfirmDeleteOpen(true)}
              disabled={deleting || finalizing}
            >
              {deleting ? <span className="spinner" style={{ width: 16, height: 16 }} /> : 'Delete order'}
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={handleFinalizeOrder}
            disabled={finalizing || deleting}
          >
            {finalizing ? (
              <span className="spinner" style={{ width: 16, height: 16 }} />
            ) : savingPastOrder ? (
              'Save changes'
            ) : (
              'Save to Past Orders'
            )}
          </button>
        </div>
      </div>

      {/* Custom Delete Confirmation Modal */}
      {confirmDeleteOpen && (
        <ConfirmModal
          isOpen={true}
          title={`Delete "${order.name}"?`}
          description="This action cannot be undone. This order and all of its allocations will be permanently removed."
          confirmText="Delete Order"
          cancelText="Cancel"
          variant="danger"
          isLoading={deleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDeleteOpen(false)}
        />
      )}

      <style>{`
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
