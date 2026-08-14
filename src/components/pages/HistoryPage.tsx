import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import type { Order } from '../../types';
import { formatDateShort, formatZAR, todayISO } from '../../lib/formatters';
import { calculate } from '../../lib/calculations';
import { getActiveOrders, getPastOrders } from '../../lib/orderLifecycle';
import { getPastOrderSummary } from '../../lib/pastOrderSummary';
import { SettlementPacks } from '../order/SettlementPacks';
import { OrderSetup } from '../order/OrderSetup';
import { CoffeeLotsSection } from '../order/CoffeeLotsSection';
import { GoodsAndFees } from '../order/GoodsAndFees';
import { CoffeeCostSummary } from '../order/CoffeeCostSummary';
import { generateOrderInvoicePDF } from '../../lib/pdf';
import { getParticipantScopedOrders } from '../../lib/myStats';
import { resolveOrderRoaster } from '../../lib/roasters';
import { RoasterAvatar } from '../roaster/RoasterAvatar';
import { ConfirmModal } from '../ui/ConfirmModal';
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
    roasters,
    linkedPersonId,
    linkResolution,
    deleteOrder,
    createOrder,
    exportJSON,
    importJSON,
    setLastExportDate,
  } = useAppStore();

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [downloadingOrderInvoice, setDownloadingOrderInvoice] = useState(false);
  const [orderInvoiceError, setOrderInvoiceError] = useState<string | null>(null);
  const [deleteTargetOrder, setDeleteTargetOrder] = useState<Order | null>(null);
  const [importStatus, setImportStatus] = useState<{ text: string; tone: 'success' | 'error' } | null>(null);

  const personNames = useMemo(
    () => Object.fromEntries(people.map((person) => [person.id, person.name])),
    [people],
  );
  const participantArchiveState = participantOnly
    ? linkedPersonId
      ? 'ready'
      : linkResolution.status === 'needs-confirmation'
        ? 'needs-confirmation'
        : linkResolution.status === 'ambiguous'
          ? 'ambiguous'
          : 'unlinked'
    : 'ready';
  const scopedOrders = participantOnly ? getParticipantScopedOrders(orders, linkedPersonId) : orders;
  const activeOrders = getActiveOrders(scopedOrders);
  const pastOrders = getPastOrders(scopedOrders);
  const selectedOrder = selectedOrderId ? pastOrders.find((order) => order.id === selectedOrderId) ?? null : null;
  const editingOrder = editingOrderId ? pastOrders.find((order) => order.id === editingOrderId) ?? null : null;
  const selectedOrderSummary = selectedOrder ? getPastOrderSummary(selectedOrder, personNames) : null;
  const selectedOrderResult = selectedOrder ? calculate(selectedOrder, personNames) : null;
  const selectedOrderRoaster = selectedOrder ? resolveOrderRoaster(selectedOrder, roasters) : null;

  useEffect(() => {
    if (selectedOrderId && !pastOrders.some((order) => order.id === selectedOrderId)) {
      setSelectedOrderId(null);
    }

    if (editingOrderId && !pastOrders.some((order) => order.id === editingOrderId)) {
      setEditingOrderId(null);
    }
  }, [editingOrderId, pastOrders, selectedOrderId]);

  function openPastOrder(order: Order) {
    setSelectedOrderId(order.id);
    setEditingOrderId(null);
    setOrderInvoiceError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openPastOrderEditor(order: Order) {
    setSelectedOrderId(order.id);
    setEditingOrderId(order.id);
    setOrderInvoiceError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleOpenOrder(order: Order) {
    openPastOrder(order);
  }

  async function handleDuplicate(order: Order) {
    await createOrder({
      ...order,
      name: `${order.name} (copy)`,
      orderDate: todayISO(),
      status: 'planning',
      payments: {},
    });
  }

  async function handleEdit(order: Order) {
    openPastOrderEditor(order);
  }

  async function confirmDeleteOrder() {
    if (!deleteTargetOrder) return;
    await deleteOrder(deleteTargetOrder.id);
    if (selectedOrderId === deleteTargetOrder.id) setSelectedOrderId(null);
    if (editingOrderId === deleteTargetOrder.id) setEditingOrderId(null);
    setDeleteTargetOrder(null);
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

  async function handleDownloadOrderInvoice() {
    if (!selectedOrder || !selectedOrderResult?.isValid) {
      return;
    }

    setDownloadingOrderInvoice(true);
    setOrderInvoiceError(null);

    try {
      await generateOrderInvoicePDF(selectedOrder, people, selectedOrderResult);
    } catch (error) {
      setOrderInvoiceError(error instanceof Error ? error.message : 'Failed to generate the full order invoice.');
    } finally {
      setDownloadingOrderInvoice(false);
    }
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
        setImportStatus({ text: 'Import completed successfully.', tone: 'success' });
        setTimeout(() => setImportStatus(null), 4000);
      } catch {
        setImportStatus({ text: 'Failed to import — the JSON file format was invalid.', tone: 'error' });
        setTimeout(() => setImportStatus(null), 5000);
      }
    };
    input.click();
  }

  return (
    <div className="page-container">
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

      {importStatus && (
        <div className={`alert ${importStatus.tone === 'success' ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 'var(--space-4)' }}>
          {importStatus.text}
        </div>
      )}

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
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                  <h3 className="wizard-card-title">{selectedOrder.name}</h3>
                  <span className={`summary-status-pill is-${selectedOrderResult?.isValid ? 'complete' : 'ready'}`}>
                    {selectedOrder.isArchived ? 'Archived' : 'Saved'}
                  </span>
                </div>
                <div className="field-hint" style={{ marginTop: 'var(--space-2)' }}>
                  {formatDateShort(selectedOrder.orderDate)}
                  {selectedOrderRoaster ? ` · ${selectedOrderRoaster.name}` : ''}
                </div>
              </div>

              <div className="wizard-chip-row">
                <button className="btn btn-secondary btn-sm" onClick={() => setSelectedOrderId(null)}>
                  Close
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => void handleDownloadOrderInvoice()}
                  disabled={!selectedOrderResult?.isValid || downloadingOrderInvoice}
                >
                  {downloadingOrderInvoice ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Download full order invoice'}
                </button>
                {!participantOnly && (
                  <button className="btn btn-secondary btn-sm" onClick={() => void handleEdit(selectedOrder)}>
                    Edit order
                  </button>
                )}
                {!participantOnly && (
                  <button className="btn btn-ghost btn-sm" onClick={() => void handleDuplicate(selectedOrder)}>
                    Duplicate as new order
                  </button>
                )}
                {!participantOnly && (
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--color-unpaid)' }}
                    onClick={() => setDeleteTargetOrder(selectedOrder)}
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

            {orderInvoiceError && (
              <div className="alert alert-error" style={{ marginTop: 'var(--space-4)' }}>
                {orderInvoiceError}
              </div>
            )}

            {!participantOnly && (
              <div className="wizard-inline-note" style={{ marginTop: 'var(--space-4)' }}>
                Edit order opens this same saved order inside Past Orders, so you can correct mistakes without moving it back into the active order tab.
              </div>
            )}
          </section>

          {selectedOrderResult?.isValid && (
            <SettlementPacks
              order={selectedOrder}
              people={people}
              result={selectedOrderResult}
              title="Saved order details"
              description="Review the full settlement, payment state, and invoice/share actions exactly as saved."
              visiblePersonIds={participantOnly && linkedPersonId ? [linkedPersonId] : undefined}
            />
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
              const orderRoaster = resolveOrderRoaster(order, roasters);

              return (
                <div key={order.id} className="card">
                  <div className="card-padded" style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                        {orderRoaster && (
                          <RoasterAvatar
                            name={orderRoaster.name}
                            logoUrl={orderRoaster.logoUrl}
                            size={32}
                          />
                        )}
                        <div style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{order.name}</div>
                        <span className="wizard-badge wizard-badge-info">In progress</span>
                      </div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                        {formatDateShort(order.orderDate)} · {summary.participantCount} participant{summary.participantCount !== 1 ? 's' : ''} · {summary.lotCount} lot{summary.lotCount !== 1 ? 's' : ''}
                      </div>
                      {orderRoaster && (
                        <div className="field-hint" style={{ marginTop: 4 }}>
                          Roaster: {orderRoaster.name}
                        </div>
                      )}
                    </div>
                    <div style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{formatZAR(summary.totalZar)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {participantOnly && participantArchiveState === 'unlinked' && (
        <div className="empty-state">
          <div className="empty-state-icon">☕</div>
          <h3>Confirm your profile to see orders you joined</h3>
          <p>
            We could not match this account to a participant record yet. Once your profile is linked, finalized orders you were part of will appear here automatically.
          </p>
        </div>
      )}

      {participantOnly && participantArchiveState === 'needs-confirmation' && (
        <div className="empty-state">
          <div className="empty-state-icon">👤</div>
          <h3>We found a possible match for your account</h3>
          <p>
            Confirm your participant profile to see the finalized orders you joined. The app waits for confirmation before showing personal archive data.
          </p>
        </div>
      )}

      {participantOnly && participantArchiveState === 'ambiguous' && (
        <div className="empty-state">
          <div className="empty-state-icon">?</div>
          <h3>We found more than one possible profile</h3>
          <p>
            Choose your participant record first so the archive only shows the orders that belong to you.
          </p>
        </div>
      )}

      {participantArchiveState === 'ready' && pastOrders.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">📂</div>
          <h3>No past orders yet</h3>
          <p>{participantOnly ? 'You are linked correctly, but there are no finalized orders including you yet.' : 'Finalize an order and it will appear here as a saved record.'}</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {pastOrders.map((order) => {
          const summary = getPastOrderSummary(order, personNames);
          const orderRoaster = resolveOrderRoaster(order, roasters);
          const isSelected = selectedOrderId === order.id;
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
                        {orderRoaster && (
                          <RoasterAvatar
                            name={orderRoaster.name}
                            logoUrl={orderRoaster.logoUrl}
                            size={34}
                          />
                        )}
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text-primary)' }}>
                          {order.name}
                        </div>
                        <span className="wizard-badge wizard-badge-accent">Finalized</span>
                        {isEditing && <span className="wizard-badge wizard-badge-info">Editing</span>}
                      </div>

                      <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                        {formatDateShort(order.orderDate)} · {summary.participantCount} participant{summary.participantCount !== 1 ? 's' : ''} · {summary.lotCount} lot{summary.lotCount !== 1 ? 's' : ''}
                      </div>
                      {orderRoaster && (
                        <div className="field-hint" style={{ marginTop: 4 }}>
                          Roaster: {orderRoaster.name}
                        </div>
                      )}

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
                    Duplicate as new order
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--color-unpaid)' }}
                    onClick={() => setDeleteTargetOrder(order)}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {deleteTargetOrder && (
        <ConfirmModal
          isOpen={true}
          title={`Delete "${deleteTargetOrder.name}"?`}
          description="Are you sure you want to permanently delete this past order? This action cannot be undone."
          confirmText="Delete Order"
          cancelText="Cancel"
          variant="danger"
          onConfirm={confirmDeleteOrder}
          onCancel={() => setDeleteTargetOrder(null)}
        />
      )}
    </div>
  );
}

function PastOrderEditor({ order, onClose }: { order: Order; onClose: () => void }) {
  const { sessionUi, setOrderWizardStep, roasters, people, updateOrder, flushOrderWrites } = useAppStore();
  const commitStepRef = useRef<(() => Promise<void>) | null>(null);
  const [draftOrder, setDraftOrder] = useState<Order>(() => cloneOrder(order));
  const draftOrderRef = useRef<Order>(draftOrder);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const sourceOrderId = order.id;
  const currentStep = sessionUi.orderWizardSteps[sourceOrderId] ?? getSuggestedWizardStep(draftOrder);
  const savedStep = sessionUi.orderWizardSteps[order.id];
  const orderRoaster = resolveOrderRoaster(draftOrder, roasters);
  const personNames = useMemo(
    () => Object.fromEntries(people.map((person) => [person.id, person.name])),
    [people],
  );
  const summaryResult = useMemo(() => calculate(draftOrder, personNames), [draftOrder, personNames]);

  useEffect(() => {
    const nextDraft = cloneOrder(order);
    draftOrderRef.current = nextDraft;
    setDraftOrder(nextDraft);
    setSaveError(null);
  }, [order.id]);

  useEffect(() => {
    if (savedStep) {
      return;
    }
    setOrderWizardStep(sourceOrderId, getSuggestedWizardStep(draftOrder));
  }, [draftOrder, savedStep, setOrderWizardStep, sourceOrderId]);

  function patchDraft(patch: Partial<Order>) {
    setDraftOrder((current) => ({
      ...current,
      ...patch,
      id: sourceOrderId,
      status: 'archived',
      isArchived: true,
    }));
    draftOrderRef.current = {
      ...draftOrderRef.current,
      ...patch,
      id: sourceOrderId,
      status: 'archived',
      isArchived: true,
    };
  }

  function getStepErrors(targetOrder: Order, step: OrderWizardStep): string[] {
    if (step === 'setup') return validateSetupStep(targetOrder);
    if (step === 'coffees') return validateCoffeeStep(targetOrder);
    if (step === 'goods') return validateGoodsStep(targetOrder);
    return [];
  }

  const validationErrors = useMemo(() => getStepErrors(draftOrder, currentStep), [currentStep, draftOrder]);
  const maxUnlockedStepIndex = getMaxUnlockedStepIndex(draftOrder);
  const currentStepIndex = STEP_INDEX[currentStep];
  const stepCompleteMap: Record<OrderWizardStep, boolean> = {
    setup: isStepComplete(draftOrder, 'setup'),
    coffees: isStepComplete(draftOrder, 'coffees'),
    goods: isStepComplete(draftOrder, 'goods'),
    summary: isStepComplete(draftOrder, 'summary'),
  };

  async function flushCurrentStep() {
    if (commitStepRef.current) {
      await commitStepRef.current();
    }
  }

  async function handleCancel() {
    setDraftOrder(cloneOrder(order));
    setSaveError(null);
    onClose();
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      await flushCurrentStep();
      const latestDraft = draftOrderRef.current;
      const latestResult = calculate(latestDraft, personNames);
      if (!latestResult.isValid) {
        throw new Error(latestResult.validationErrors[0] ?? 'This saved order still has incomplete data.');
      }

      await updateOrder(sourceOrderId, {
        name: latestDraft.name,
        orderDate: latestDraft.orderDate,
        roasterId: latestDraft.roasterId,
        roasterSnapshot: latestDraft.roasterSnapshot,
        payerId: latestDraft.payerId,
        payerBank: latestDraft.payerBank,
        referenceTemplate: latestDraft.referenceTemplate,
        payerNote: latestDraft.payerNote,
        goodsTotalZar: latestDraft.goodsTotalZar,
        lots: latestDraft.lots,
        fees: latestDraft.fees,
        payments: latestDraft.payments,
        isArchived: true,
        ownerId: latestDraft.ownerId,
      });
      await flushOrderWrites(sourceOrderId);
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save this historical order.');
    } finally {
      setSaving(false);
    }
  }

  async function goToStep(step: OrderWizardStep) {
    if (STEP_INDEX[step] <= maxUnlockedStepIndex || step === currentStep) {
      if (step !== currentStep) {
        await flushCurrentStep();
      }
      setOrderWizardStep(sourceOrderId, step);
    }
  }

  async function handleNext() {
    if (currentStep === 'summary') return;
    await flushCurrentStep();
    const freshErrors = getStepErrors(draftOrderRef.current, currentStep);
    if (freshErrors.length > 0) return;
    const nextStep = ORDER_WIZARD_STEPS[currentStepIndex + 1]?.id;
    if (nextStep) setOrderWizardStep(sourceOrderId, nextStep);
  }

  async function handleBack() {
    await flushCurrentStep();
    const previousStep = ORDER_WIZARD_STEPS[currentStepIndex - 1]?.id;
    if (previousStep) setOrderWizardStep(sourceOrderId, previousStep);
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
            <button className="btn btn-secondary btn-sm" onClick={() => void handleCancel()} disabled={saving}>
              Cancel
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => void handleSave()} disabled={saving || !summaryResult.isValid}>
              {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Save changes'}
            </button>
          </div>
        </div>
      </section>

      <section className="wizard-hero">
        <div className="wizard-hero-top">
          <div>
            <div className="wizard-kicker">Past order correction</div>
            <div className="order-page-title-row">
              {orderRoaster && (
                <RoasterAvatar
                  name={orderRoaster.name}
                  logoUrl={orderRoaster.logoUrl}
                  size={48}
                />
              )}
              <div>
                <h2 className="wizard-page-title">{draftOrder.name || 'Untitled order'}</h2>
                {orderRoaster && (
                  <div className="field-hint" style={{ marginTop: 4 }}>
                    Roaster: {orderRoaster.name}
                  </div>
                )}
              </div>
            </div>
            <p className="wizard-page-copy">
              {formatDateShort(draftOrder.orderDate)} - update setup, coffees, fees, and settlement details while keeping this record finalized.
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

      {saveError && <div className="alert alert-error">{saveError}</div>}

      <div className="wizard-stage">
        {currentStep === 'setup' && <OrderSetup order={draftOrder} onOrderChange={patchDraft} registerCommit={(commit) => { commitStepRef.current = commit; }} />}
        {currentStep === 'coffees' && <CoffeeLotsSection order={draftOrder} onOrderChange={patchDraft} />}
        {currentStep === 'goods' && <GoodsAndFees order={draftOrder} onOrderChange={patchDraft} registerCommit={(commit) => { commitStepRef.current = commit; }} />}
        {currentStep === 'summary' && (
          <div className="wizard-step-stack">
            {!summaryResult.isValid ? (
              <>
                <section className="wizard-panel">
                  <div className="wizard-card-title">Summary is waiting for the earlier steps</div>
                  <p className="wizard-card-copy" style={{ marginTop: 'var(--space-2)' }}>
                    Fix the highlighted issues below, then save the historical order.
                  </p>
                </section>
                {summaryResult.validationErrors.map((error, index) => (
                  <div key={index} className="alert alert-warning">{error}</div>
                ))}
              </>
            ) : (
              <>
                <CoffeeCostSummary result={summaryResult} />
                <SettlementPacks
                  order={draftOrder}
                  people={people}
                  result={summaryResult}
                  onPaymentChange={(personId, record) => patchDraft({
                    payments: { ...draftOrder.payments, [personId]: record },
                  })}
                  paymentEditingEnabled
                />
              </>
            )}
          </div>
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
      {currentStep === 'summary' && (
        <div className="wizard-footer">
          <div className="wizard-footer-copy">
            {summaryResult.isValid ? 'Review the edited saved order before replacing the historical record.' : summaryResult.validationErrors[0]}
          </div>
          <div className="wizard-footer-actions">
            <button className="btn btn-ghost" onClick={() => void handleBack()}>Back</button>
            <button className="btn btn-secondary" onClick={() => void handleCancel()} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={() => void handleSave()} disabled={saving || !summaryResult.isValid}>
              {saving ? <span className="spinner" style={{ width: 16, height: 16 }} /> : 'Save changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function cloneOrder(order: Order): Order {
  return typeof structuredClone === 'function'
    ? structuredClone(order)
    : JSON.parse(JSON.stringify(order)) as Order;
}

function SummaryMetric({ label, value, emphasize = false }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div className={`wizard-metric ${emphasize ? 'is-emphasized' : ''}`}>
      <div className="wizard-metric-label">{label}</div>
      <div className="wizard-metric-value">{value}</div>
    </div>
  );
}
