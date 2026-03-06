import { useAppStore, getCurrentOrder } from '../../store/appStore';
import type { Order } from '../../types';
import { formatDateShort, formatZAR, todayISO } from '../../lib/formatters';
import { calculate } from '../../lib/calculations';

interface Props {
  onNavigateToOrder: () => void;
}

export function HistoryPage({ onNavigateToOrder }: Props) {
  const { orders, people, deleteOrder, setCurrentOrderId, createOrder, exportJSON, importJSON, setLastExportDate } = useAppStore();
  const currentOrder = useAppStore(getCurrentOrder);

  const personNames = Object.fromEntries(people.map((p) => [p.id, p.name]));

  async function handleLoad(order: Order) {
    setCurrentOrderId(order.id);
    onNavigateToOrder();
  }

  async function handleDuplicate(order: Order) {
    const newOrder = await createOrder({
      ...order,
      name: `${order.name} (copy)`,
      orderDate: todayISO(),
      payments: {},
    });
    if (newOrder) {
      setCurrentOrderId(newOrder.id);
      onNavigateToOrder();
    }
  }

  async function handleDelete(order: Order) {
    if (!confirm(`Delete "${order.name}"? This cannot be undone.`)) return;
    await deleteOrder(order.id);
  }

  function handleExport() {
    const json = exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fajr-brews-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setLastExportDate(new Date().toISOString());
  }

  async function handleImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        await importJSON(text);
        alert('Import complete.');
      } catch {
        alert('Failed to import — invalid JSON file.');
      }
    };
    input.click();
  }

  const sortedOrders = [...orders].sort(
    (a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()
  );

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>Order History</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
            All Fajr Brews orders — shared across the workspace.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className="btn btn-secondary btn-sm" onClick={handleExport}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            Export JSON
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleImport}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
            Import JSON
          </button>
        </div>
      </div>

      {sortedOrders.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">📂</div>
          <h3>No orders yet</h3>
          <p>Create your first order in the Order tab.</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {sortedOrders.map((order) => {
          const isCurrent = currentOrder?.id === order.id;
          const result = calculate(order, personNames);
          const participantCount = result.personIds.length;
          const paidCount = result.personIds.filter((pid) => order.payments[pid]?.status === 'paid').length;

          return (
            <div
              key={order.id}
              className="card"
              style={isCurrent ? { borderColor: 'var(--color-accent)', boxShadow: '0 0 0 2px color-mix(in srgb, var(--color-accent) 15%, transparent)' } : {}}
            >
              <div className="card-padded">
                <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 4 }}>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {order.name}
                      </div>
                      {isCurrent && (
                        <span style={{
                          fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.1em',
                          textTransform: 'uppercase', color: 'var(--color-accent)',
                          background: 'var(--color-accent-light)', padding: '2px 8px', borderRadius: 'var(--radius-full)',
                          flexShrink: 0,
                        }}>
                          Active
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                      {formatDateShort(order.orderDate)} &nbsp;·&nbsp;
                      {participantCount} participant{participantCount !== 1 ? 's' : ''} &nbsp;·&nbsp;
                      {order.lots.length} lot{order.lots.length !== 1 ? 's' : ''}
                    </div>
                    {result.isValid && (
                      <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: 4 }}>
                        {formatZAR(result.totalOrderZar)} total &nbsp;·&nbsp;
                        <span style={{ color: paidCount === participantCount && participantCount > 0 ? 'var(--color-paid)' : 'var(--color-text-muted)' }}>
                          {paidCount}/{participantCount} paid
                        </span>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 'var(--space-2)', flexShrink: 0, flexWrap: 'wrap' }}>
                    {!isCurrent && (
                      <button className="btn btn-primary btn-sm" onClick={() => handleLoad(order)}>
                        Open
                      </button>
                    )}
                    <button className="btn btn-secondary btn-sm" onClick={() => handleDuplicate(order)}>
                      Duplicate
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--color-unpaid)' }}
                      onClick={() => handleDelete(order)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
