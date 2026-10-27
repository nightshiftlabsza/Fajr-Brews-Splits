import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { OrderSetup } from '../order/OrderSetup';
import { CoffeeLotsSection } from '../order/CoffeeLotsSection';
import { GoodsAndFees } from '../order/GoodsAndFees';
import { OrderSummary } from '../order/OrderSummary';
import { SettlementPacks } from '../order/SettlementPacks';
import { ConfirmModal } from '../ui/ConfirmModal';
import { getActiveOrders, normalizeOrderStatus } from '../../lib/orderLifecycle';
import { calculate } from '../../lib/calculations';
import { formatDateShort, formatZAR, todayISO } from '../../lib/formatters';
import { resolveOrderRoaster } from '../../lib/roasters';
import { RoasterAvatar } from '../roaster/RoasterAvatar';
import { createDuplicatedOrderPayload } from '../../lib/orderWizard';
import type { Order, OrderStatus } from '../../types';

export type OrderSection = 'setup' | 'coffees' | 'goods' | 'summary' | 'invoices';

interface Props {
  onNavigateToHistory: () => void;
}

function getDeleteDescription(order: Order): string {
  const base = 'This permanently deletes the order and cannot be undone. To keep a record, archive it instead.';
  const paymentCount = Object.values(order.payments).filter((p) => p.status !== 'unpaid').length;
  if (paymentCount === 0) return base;
  return `${base} ${paymentCount} recorded ${paymentCount === 1 ? 'payment' : 'payments'} will be lost too.`;
}

export function OrderPage({ onNavigateToHistory }: Props) {
  const {
    orders,
    people,
    roasters,
    user,
    memberRole,
    currentOrderId,
    createOrder,
    updateOrderStatus,
    deleteOrder,
    updateOrder,
    setCurrentOrderId,
    linkedPersonId,
  } = useAppStore();

  const activeOrders = useMemo(() => getActiveOrders(orders), [orders]);

  const [activeOrderId, setActiveOrderId] = useState<string | null>(() => {
    if (currentOrderId && activeOrders.some((o) => o.id === currentOrderId)) {
      return currentOrderId;
    }
    return activeOrders[0]?.id || null;
  });

  const [activeSection, setActiveSection] = useState<OrderSection>('coffees');
  const [orderSections, setOrderSections] = useState<Record<string, OrderSection>>({});
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [archiveTargetOrder, setArchiveTargetOrder] = useState<Order | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [deleteTargetOrder, setDeleteTargetOrder] = useState<Order | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [shareCopySuccess, setShareCopySuccess] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const commitStepRef = useRef<(() => Promise<void>) | null>(null);
  const sectionNavRef = useRef<HTMLElement | null>(null);

  // Auto-scroll active section tab into view within horizontal overflow container
  useEffect(() => {
    const nav = sectionNavRef.current;
    if (!nav) return;
    const activeTab = nav.querySelector<HTMLElement>(`[data-section="${activeSection}"]`);
    if (!activeTab) return;

    const scrollActiveTab = () => {
      if (typeof activeTab.scrollIntoView === 'function') {
        const prefersReducedMotion =
          typeof window !== 'undefined' &&
          window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        activeTab.scrollIntoView({
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
          block: 'nearest',
          inline: 'center',
        });
      }
    };

    scrollActiveTab();

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => {
        scrollActiveTab();
      });
      ro.observe(nav);
      ro.observe(activeTab);
      return () => ro.disconnect();
    }
  }, [activeSection, currentOrderId]);

  // Sync active order if activeOrderId is invalid or currentOrderId changes from outside
  useEffect(() => {
    const isCurrentActive = Boolean(currentOrderId && activeOrders.some((o) => o.id === currentOrderId));
    const isActiveOrderValid = Boolean(activeOrderId && activeOrders.some((o) => o.id === activeOrderId));

    if (!isActiveOrderValid) {
      const nextId = isCurrentActive ? currentOrderId : (activeOrders[0]?.id ?? null);
      setActiveOrderId(nextId);
      if (nextId && nextId !== currentOrderId) {
        setCurrentOrderId(nextId);
      }
    } else if (isCurrentActive && currentOrderId !== activeOrderId) {
      setActiveOrderId(currentOrderId);
    }
  }, [currentOrderId, activeOrders, activeOrderId, setCurrentOrderId]);

  // Click outside to close actions menu
  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setActionsMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const personNames = useMemo(
    () => Object.fromEntries(people.map((person) => [person.id, person.name])),
    [people],
  );

  const currentOrder = useMemo(
    () => (activeOrderId ? activeOrders.find((order) => order.id === activeOrderId) ?? null : null),
    [activeOrders, activeOrderId],
  );

  // Safely fallback to 'coffees' if the currently viewed order has no lots and section is on invoices or summary
  useEffect(() => {
    if (currentOrder && currentOrder.lots.length === 0 && (activeSection === 'invoices' || activeSection === 'summary')) {
      setActiveSection('coffees');
    }
  }, [currentOrder?.id, currentOrder?.lots.length, activeSection]);

  async function handleSelectOrder(orderId: string) {
    if (commitStepRef.current) {
      await commitStepRef.current();
    }
    if (activeOrderId) {
      setOrderSections((prev) => ({ ...prev, [activeOrderId]: activeSection }));
    }
    const nextOrder = activeOrders.find((o) => o.id === orderId);
    const targetSection = orderSections[orderId];
    if (targetSection) {
      if ((targetSection === 'invoices' || targetSection === 'summary') && (nextOrder?.lots.length ?? 0) === 0) {
        setActiveSection('coffees');
      } else {
        setActiveSection(targetSection);
      }
    } else if ((activeSection === 'invoices' || activeSection === 'summary') && (nextOrder?.lots.length ?? 0) === 0) {
      setActiveSection('coffees');
    }
    setActiveOrderId(orderId);
    setCurrentOrderId(orderId);
  }

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
        setActiveOrderId(order.id);
        setActiveSection('setup');
      }
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Failed to create order. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  async function handleDuplicate(order: Order) {
    setActionsMenuOpen(false);
    const duplicated = await createOrder(createDuplicatedOrderPayload(order, todayISO()));
    if (duplicated) {
      setCurrentOrderId(duplicated.id);
      setActiveOrderId(duplicated.id);
    }
  }

  async function confirmArchiveOrder() {
    if (!archiveTargetOrder) return;
    setArchiving(true);
    try {
      await updateOrderStatus(archiveTargetOrder.id, 'archived');
      setArchiveTargetOrder(null);
      const remaining = activeOrders.filter((o) => o.id !== archiveTargetOrder.id);
      if (remaining.length > 0) {
        setActiveOrderId(remaining[0].id);
        setCurrentOrderId(remaining[0].id);
      } else {
        setActiveOrderId(null);
      }
    } finally {
      setArchiving(false);
    }
  }

  async function confirmDeleteOrder() {
    if (!deleteTargetOrder) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteOrder(deleteTargetOrder.id);
      const remaining = activeOrders.filter((o) => o.id !== deleteTargetOrder.id);
      setActiveOrderId(remaining[0]?.id ?? null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Failed to delete this order. Please try again.');
    } finally {
      setDeleting(false);
      setDeleteTargetOrder(null);
    }
  }

  function handleShareLink(order: Order) {
    setActionsMenuOpen(false);
    const joinUrl = `${window.location.origin}${window.location.pathname}?joinOrder=${order.id}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(joinUrl).then(() => {
        setShareCopySuccess(true);
        setTimeout(() => setShareCopySuccess(false), 2500);
      }).catch(() => {
        setShareCopySuccess(true);
        setTimeout(() => setShareCopySuccess(false), 2500);
      });
    }
  }

  async function handleSectionChange(section: OrderSection) {
    if (commitStepRef.current) {
      await commitStepRef.current();
    }
    if (activeOrderId) {
      setOrderSections((prev) => ({ ...prev, [activeOrderId]: section }));
    }
    setActiveSection(section);
  }

  // ── Render Empty State ──
  if (activeOrders.length === 0 || !currentOrder) {
    return (
      <div className="page-container">
        <div className="empty-state" style={{ margin: 'var(--space-8) 0', padding: 'var(--space-8)' }}>
          <div className="empty-state-icon">☕</div>
          <h2 style={{ marginBottom: 'var(--space-2)' }}>No Active Orders</h2>
          <p style={{ maxWidth: 460, margin: '0 auto var(--space-6)', color: 'var(--color-text-secondary)' }}>
            Start a new coffee drop to plan coffees, assign bags among friends, and automatically calculate shares.
          </p>
          <button className="btn btn-primary btn-lg" onClick={() => void handleNewOrder()} disabled={creating}>
            {creating ? <span className="spinner" style={{ width: 18, height: 18 }} /> : '+ Start a Coffee Order'}
          </button>
        </div>
      </div>
    );
  }

  const isWorkspaceManager = memberRole === 'owner' || memberRole === 'admin';
  const isOwner = !currentOrder.ownerId || currentOrder.ownerId === user?.id || isWorkspaceManager;
  const resolvedRoaster = resolveOrderRoaster(currentOrder, roasters);
  const orderResult = calculate(currentOrder, personNames);
  const currentStatus = normalizeOrderStatus(currentOrder.status, currentOrder.isArchived);

  return (
    <div className="page-container active-order-container">
      {/* ── 1. ACTIVE ORDERS WORKSPACE TABS ── */}
      <div className="active-orders-bar">
        <div className="active-orders-strip" role="tablist" aria-label="Active Coffee Orders">
          {activeOrders.map((order) => {
            const isActive = order.id === currentOrder.id;
            const roaster = resolveOrderRoaster(order, roasters);
            const orderStatus = normalizeOrderStatus(order.status, order.isArchived);
            return (
              <button
                key={order.id}
                role="tab"
                aria-selected={isActive}
                className={`order-tab-chip ${isActive ? 'is-active' : ''}`}
                onClick={() => void handleSelectOrder(order.id)}
              >
                {roaster ? (
                  <span className="order-tab-roaster" title={`Roaster: ${roaster.name}`}>
                    {roaster.logoUrl ? (
                      <img src={roaster.logoUrl} alt="" className="order-tab-roaster-logo" />
                    ) : (
                      <span className="order-tab-roaster-initials">
                        {roaster.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="order-tab-dot" aria-hidden="true">☕</span>
                )}
                {isActive && <span className="order-tab-active-dot" aria-hidden="true" />}
                <span className="order-tab-title">{order.name || 'Untitled Order'}</span>
                <span className={`order-tab-status status-${orderStatus}`}>
                  {orderStatus === 'planning' ? 'Planning' : orderStatus === 'locked' ? 'Locked' : 'Completed'}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            className="order-tab-chip order-tab-new"
            onClick={() => void handleNewOrder()}
            disabled={creating}
            title="Create a new active coffee order"
          >
            {creating ? <span className="spinner" style={{ width: 14, height: 14 }} /> : '+ New Order'}
          </button>
        </div>
      </div>

      {deleteError && <div className="alert alert-error" role="alert" style={{ marginBottom: 'var(--space-4)' }}>{deleteError}</div>}
      {createError && <div className="alert alert-warning" style={{ marginBottom: 'var(--space-4)' }}>{createError}</div>}
      {shareCopySuccess && (
        <div className="alert alert-success" style={{ marginBottom: 'var(--space-4)' }}>
          ✓ Join link copied to clipboard! Share it with anyone who wants to view or join this order.
        </div>
      )}

      {/* ── 2. ORDER HEADER & STATUS ── */}
      <div className="order-header-surface">
        <div className="order-header-primary">
          {resolvedRoaster && (
            <RoasterAvatar name={resolvedRoaster.name} logoUrl={resolvedRoaster.logoUrl} size={48} />
          )}
          <div className="order-header-info">
            <div className="order-header-title-row">
              <h1 className="order-header-title">{currentOrder.name}</h1>
              <span className={`status-pill status-${currentStatus}`}>
                {currentStatus === 'planning' ? 'Planning' : currentStatus === 'locked' ? 'Locked' : 'Completed'}
              </span>
            </div>
            <div className="order-header-meta">
              <span>{formatDateShort(currentOrder.orderDate)}</span>
              <span>·</span>
              <span>{resolvedRoaster?.name || 'Roaster unspecified'}</span>
              <span>·</span>
              <span>{currentOrder.lots.length} {currentOrder.lots.length === 1 ? 'coffee lot' : 'coffee lots'}</span>
            </div>
          </div>
        </div>

        <div className="order-header-actions" ref={menuRef}>
          <button
            type="button"
            className="btn btn-secondary btn-sm order-actions-trigger"
            onClick={() => setActionsMenuOpen((open) => !open)}
            aria-haspopup="true"
            aria-expanded={actionsMenuOpen}
          >
            <span>Order Actions</span>
            <span aria-hidden="true">▾</span>
          </button>

          {actionsMenuOpen && (
            <div className="order-actions-dropdown">
              {isOwner && (
                <>
                  <div className="dropdown-label">Order Status</div>
                  <button
                    type="button"
                    className={`dropdown-item ${currentStatus === 'planning' ? 'is-selected' : ''}`}
                    onClick={() => {
                      void updateOrderStatus(currentOrder.id, 'planning');
                      setActionsMenuOpen(false);
                    }}
                  >
                    ● Planning (Accepting changes)
                  </button>
                  <button
                    type="button"
                    className={`dropdown-item ${currentStatus === 'locked' ? 'is-selected' : ''}`}
                    onClick={() => {
                      void updateOrderStatus(currentOrder.id, 'locked');
                      setActionsMenuOpen(false);
                    }}
                  >
                    ● Locked (Finalizing)
                  </button>
                  <button
                    type="button"
                    className={`dropdown-item ${currentStatus === 'completed' ? 'is-selected' : ''}`}
                    onClick={() => {
                      void updateOrderStatus(currentOrder.id, 'completed');
                      setActionsMenuOpen(false);
                    }}
                  >
                    ● Completed
                  </button>

                  <div className="dropdown-divider" />
                </>
              )}

              <button
                type="button"
                className="dropdown-item"
                onClick={() => handleShareLink(currentOrder)}
              >
                🔗 Copy Join Link
              </button>

              <button
                type="button"
                className="dropdown-item"
                onClick={() => void handleDuplicate(currentOrder)}
              >
                📋 Duplicate Order
              </button>

              {isOwner && (
                <>
                  <div className="dropdown-divider" />

                  <button
                    type="button"
                    className="dropdown-item dropdown-item-danger"
                    onClick={() => {
                      setActionsMenuOpen(false);
                      setArchiveTargetOrder(currentOrder);
                    }}
                  >
                    📦 Archive Order
                  </button>

                  <button
                    type="button"
                    className="dropdown-item dropdown-item-danger"
                    onClick={() => {
                      setActionsMenuOpen(false);
                      setDeleteTargetOrder(currentOrder);
                    }}
                  >
                    🗑 Delete Order
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── 3. NON-RIGID SECTION NAVIGATION TABS ── */}
      <nav
        ref={sectionNavRef}
        className="order-section-nav"
        role="tablist"
        aria-label="Order sections"
      >
        <button
          type="button"
          role="tab"
          data-section="setup"
          aria-selected={activeSection === 'setup'}
          className={`order-section-tab ${activeSection === 'setup' ? 'is-active' : ''}`}
          onClick={() => void handleSectionChange('setup')}
        >
          1. Setup
        </button>
        <button
          type="button"
          role="tab"
          data-section="coffees"
          aria-selected={activeSection === 'coffees'}
          className={`order-section-tab ${activeSection === 'coffees' ? 'is-active' : ''}`}
          onClick={() => void handleSectionChange('coffees')}
        >
          2. Coffees & Bags
          {currentOrder.lots.length > 0 && <span className="nav-counter">{currentOrder.lots.length}</span>}
        </button>
        <button
          type="button"
          role="tab"
          data-section="goods"
          aria-selected={activeSection === 'goods'}
          className={`order-section-tab ${activeSection === 'goods' ? 'is-active' : ''}`}
          onClick={() => void handleSectionChange('goods')}
        >
          3. Goods & Fees
          {currentOrder.fees.length > 0 && <span className="nav-counter">{currentOrder.fees.length}</span>}
        </button>
        <button
          type="button"
          role="tab"
          data-section="summary"
          aria-selected={activeSection === 'summary'}
          className={`order-section-tab ${activeSection === 'summary' ? 'is-active' : ''}`}
          onClick={() => void handleSectionChange('summary')}
        >
          4. Summary
        </button>
        <button
          type="button"
          role="tab"
          data-section="invoices"
          aria-selected={activeSection === 'invoices'}
          className={`order-section-tab ${activeSection === 'invoices' ? 'is-active' : ''}`}
          onClick={() => void handleSectionChange('invoices')}
        >
          Invoices
        </button>
      </nav>

      {/* ── 4. ACTIVE SECTION VIEW ── */}
      <div className="order-section-stage">
        {activeSection === 'setup' && (
          <OrderSetup
            key={currentOrder.id}
            order={currentOrder}
            registerCommit={(commit) => { commitStepRef.current = commit; }}
          />
        )}

        {activeSection === 'coffees' && (
          <CoffeeLotsSection
            key={currentOrder.id}
            order={currentOrder}
            registerCommit={(commit) => { commitStepRef.current = commit; }}
            onContinue={() => void handleSectionChange('goods')}
          />
        )}

        {activeSection === 'goods' && (
          <GoodsAndFees
            key={currentOrder.id}
            order={currentOrder}
            registerCommit={(commit) => { commitStepRef.current = commit; }}
          />
        )}

        {activeSection === 'summary' && (
          <OrderSummary
            key={currentOrder.id}
            order={currentOrder}
            onJumpToStep={(step) => void handleSectionChange(step)}
            onFinalize={onNavigateToHistory}
          />
        )}

        {activeSection === 'invoices' && (
          <div key={currentOrder.id} style={{ marginTop: 'var(--space-4)' }}>
            {orderResult.isValid ? (
              <SettlementPacks
                key={currentOrder.id}
                order={currentOrder}
                people={people}
                result={orderResult}
                title="Participant Invoices & Payments"
                description={isOwner ? 'Viewing all participant invoices for this order.' : 'Viewing your personal invoice.'}
                visiblePersonIds={!isOwner && linkedPersonId ? [linkedPersonId] : undefined}
                onPaymentChange={(personId, record) => updateOrder(currentOrder.id, {
                  payments: { ...currentOrder.payments, [personId]: record },
                })}
                paymentEditingEnabled={isOwner}
              />
            ) : (
              <div className="alert alert-warning">
                Complete coffee bag allocation and goods total to view settlement invoices.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 5. ARCHIVE CONFIRMATION MODAL ── */}
      {archiveTargetOrder && (
        <ConfirmModal
          isOpen={true}
          title={`Archive "${archiveTargetOrder.name}"?`}
          description="This order will be moved into Past Orders. You can still inspect it, print invoices, or duplicate it anytime from Past Orders."
          confirmText="Archive Order"
          cancelText="Cancel"
          variant="warning"
          isLoading={archiving}
          onConfirm={confirmArchiveOrder}
          onCancel={() => setArchiveTargetOrder(null)}
        />
      )}

      {deleteTargetOrder && (
        <ConfirmModal
          isOpen={true}
          title={`Delete "${deleteTargetOrder.name}"?`}
          description={getDeleteDescription(deleteTargetOrder)}
          confirmText="Delete Order"
          cancelText="Cancel"
          variant="danger"
          isLoading={deleting}
          onConfirm={confirmDeleteOrder}
          onCancel={() => setDeleteTargetOrder(null)}
        />
      )}

      {/* ── STYLES ── */}
      <style>{`
        .active-order-container {
          max-width: 1200px;
          margin: 0 auto;
        }

        /* Top Workspace Tabs */
        .active-orders-bar {
          margin-bottom: var(--space-4);
          overflow-x: auto;
          scrollbar-width: thin;
          -webkit-overflow-scrolling: touch;
          padding-bottom: 4px;
        }

        .active-orders-strip {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          min-width: max-content;
        }

        .order-tab-chip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          border-radius: 999px;
          border: 1px solid var(--color-border);
          background: var(--color-surface);
          color: var(--color-text-secondary);
          font-size: 0.8125rem;
          font-weight: 600;
          cursor: pointer;
          transition: all var(--transition-fast);
          white-space: nowrap;
        }

        .order-tab-chip:hover {
          background: var(--color-surface-raised);
          color: var(--color-text-primary);
          border-color: color-mix(in srgb, var(--color-accent) 30%, var(--color-border));
        }

        .order-tab-chip.is-active {
          background: var(--color-accent-light);
          color: var(--color-accent);
          border-color: var(--color-accent);
          font-weight: 700;
          box-shadow: var(--shadow-xs);
        }

        .order-tab-active-dot {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: var(--color-accent);
          flex-shrink: 0;
        }

        .order-tab-roaster {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .order-tab-roaster-logo {
          width: 18px;
          height: 18px;
          border-radius: 999px;
          object-fit: cover;
          border: 1px solid var(--color-border);
        }

        .order-tab-roaster-initials {
          width: 18px;
          height: 18px;
          border-radius: 999px;
          background: var(--color-surface-raised);
          border: 1px solid var(--color-border);
          font-size: 0.5625rem;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--color-text-secondary);
          line-height: 1;
        }

        .order-tab-status {
          font-size: 0.625rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          padding: 1px 6px;
          border-radius: 999px;
        }

        .order-tab-status.status-planning {
          background: var(--color-surface-raised);
          color: var(--color-text-secondary);
          border: 1px solid var(--color-border);
        }

        .order-tab-status.status-locked {
          background: var(--color-warning-bg);
          color: var(--color-warning);
          border: 1px solid color-mix(in srgb, var(--color-warning) 30%, transparent);
        }

        .order-tab-status.status-completed {
          background: var(--color-paid-bg);
          color: var(--color-paid);
          border: 1px solid color-mix(in srgb, var(--color-paid) 30%, transparent);
        }

        .order-tab-new {
          border-style: dashed;
          background: transparent;
          color: var(--color-text-muted);
        }

        .order-tab-new:hover {
          border-style: solid;
          color: var(--color-accent);
        }

        .order-tab-dot {
          font-size: 0.875rem;
          line-height: 1;
        }

        .order-tab-title {
          max-width: 180px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* Order Header Surface */
        .order-header-surface {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-4);
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: var(--space-5) var(--space-6);
          margin-bottom: var(--space-4);
          box-shadow: var(--shadow-xs);
          flex-wrap: wrap;
        }

        .order-header-primary {
          display: flex;
          align-items: center;
          gap: var(--space-4);
          min-width: 0;
          flex: 1;
        }

        .order-header-info {
          min-width: 0;
        }

        .order-header-title-row {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          flex-wrap: wrap;
        }

        .order-header-title {
          font-size: 1.375rem;
          font-weight: 700;
          margin: 0;
          color: var(--color-text-primary);
          overflow-wrap: anywhere;
          word-break: break-word;
          min-width: 0;
        }

        .order-header-meta {
          display: flex;
          gap: 6px;
          align-items: center;
          font-size: 0.8125rem;
          color: var(--color-text-muted);
          margin-top: 4px;
          flex-wrap: wrap;
        }

        .status-pill {
          display: inline-flex;
          align-items: center;
          padding: 2px 8px;
          border-radius: 999px;
          font-size: 0.6875rem;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .status-planning {
          background: var(--color-surface-raised);
          color: var(--color-text-secondary);
          border: 1px solid var(--color-border);
        }

        .status-locked {
          background: color-mix(in srgb, var(--color-warning) 16%, var(--color-surface));
          color: var(--color-warning);
        }

        .status-completed {
          background: color-mix(in srgb, var(--color-accent) 16%, var(--color-surface));
          color: var(--color-accent);
        }

        .order-header-actions {
          position: relative;
          flex-shrink: 0;
        }

        .order-actions-trigger {
          display: inline-flex;
          align-items: center;
          gap: var(--space-2);
        }

        .order-actions-dropdown {
          position: absolute;
          top: calc(100% + 6px);
          right: 0;
          z-index: var(--z-header);
          min-width: 220px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-lg);
          padding: 6px 0;
        }

        .dropdown-label {
          padding: 6px 12px 4px;
          font-size: 0.6875rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--color-text-muted);
        }

        .dropdown-item {
          width: 100%;
          text-align: left;
          padding: 8px 14px;
          background: transparent;
          border: none;
          font-size: 0.8125rem;
          color: var(--color-text-primary);
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .dropdown-item:hover {
          background: var(--color-surface-raised);
        }

        .dropdown-item.is-selected {
          font-weight: 700;
          color: var(--color-accent);
        }

        .dropdown-item-danger {
          color: var(--color-unpaid);
        }

        .dropdown-divider {
          height: 1px;
          background: var(--color-border);
          margin: 4px 0;
        }

        /* Section Navigation Tabs */
        .order-section-nav {
          display: flex;
          align-items: flex-end;
          gap: var(--space-2);
          border-bottom: 1px solid var(--color-border);
          margin-bottom: var(--space-6);
          overflow-x: auto;
          overflow-y: hidden;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
          scroll-padding: 0 var(--space-3);
          padding: 0 var(--space-1);
        }

        .order-section-nav::-webkit-scrollbar {
          display: none;
        }

        .order-section-tab {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
          min-height: 44px;
          min-width: 44px;
          padding: 12px 16px;
          background: transparent;
          border: none;
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
          color: var(--color-text-muted);
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all var(--transition-fast);
          white-space: nowrap;
          position: relative;
          z-index: 1;
          box-sizing: border-box;
        }

        .order-section-tab:hover {
          color: var(--color-text-primary);
        }

        .order-section-tab.is-active {
          color: var(--color-accent);
          border-bottom: 2px solid var(--color-accent);
          border-bottom-color: var(--color-accent);
          font-weight: 700;
        }

        .nav-counter {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 1px 6px;
          border-radius: 999px;
          background: var(--color-surface-raised);
          font-size: 0.6875rem;
          font-weight: 700;
        }

        .order-section-tab.is-active .nav-counter {
          background: var(--color-accent-light);
          color: var(--color-accent);
        }

        @media (max-width: 768px) {
          .order-tab-chip {
            min-height: 44px;
            min-width: 44px;
            box-sizing: border-box;
          }
        }

        @media (max-width: 640px) {
          .order-header-surface {
            padding: var(--space-4);
          }
          .order-header-primary {
            width: 100%;
          }
          .order-header-actions {
            width: 100%;
            margin-top: var(--space-2);
          }
          .order-actions-trigger {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
