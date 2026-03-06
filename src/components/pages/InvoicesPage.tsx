import { useState } from 'react';
import { useAppStore, getCurrentOrder } from '../../store/appStore';
import { InvoiceView } from '../invoice/InvoiceView';
import { InvoiceActions } from '../invoice/InvoiceActions';
import { calculate } from '../../lib/calculations';

interface Props {
  onNavigateToOrder: () => void;
}

export function InvoicesPage({ onNavigateToOrder }: Props) {
  const { people } = useAppStore();
  const currentOrder = useAppStore(getCurrentOrder);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);

  if (!currentOrder) {
    return (
      <div className="page-container">
        <div className="empty-state" style={{ paddingTop: 'var(--space-16)' }}>
          <div className="empty-state-icon">🧾</div>
          <h3>No active order</h3>
          <p>Open or create an order first, then come back here for invoices.</p>
          <button className="btn btn-primary" onClick={onNavigateToOrder}>
            Go to Order
          </button>
        </div>
      </div>
    );
  }

  const personNames = Object.fromEntries(people.map((p) => [p.id, p.name]));
  const result = calculate(currentOrder, personNames);

  if (!result.isValid) {
    return (
      <div className="page-container">
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <h2 style={{ marginBottom: 4 }}>Invoices</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{currentOrder.name}</p>
        </div>
        <div className="alert alert-warning">
          <strong>Order not ready for invoicing.</strong>
          <ul style={{ marginTop: 8, marginLeft: 16, listStyleType: 'disc' }}>
            {result.validationErrors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
          <button className="btn btn-secondary btn-sm mt-3" onClick={onNavigateToOrder}>
            Fix in Order tab
          </button>
        </div>
      </div>
    );
  }

  const payer = people.find((p) => p.id === currentOrder.payerId);
  const activePerson = selectedPersonId
    ? people.find((p) => p.id === selectedPersonId) ?? people.find((p) => p.id === result.personIds[0])
    : people.find((p) => p.id === result.personIds[0]);

  const activePersonId = activePerson?.id ?? result.personIds[0];

  return (
    <div className="page-container">
      <div style={{ marginBottom: 'var(--space-5)' }}>
        <h2 style={{ marginBottom: 4 }}>Invoices</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{currentOrder.name}</p>
      </div>

      {/* Person selector tabs */}
      <div style={{
        display: 'flex',
        gap: 'var(--space-2)',
        marginBottom: 'var(--space-5)',
        overflowX: 'auto',
        paddingBottom: 4,
        scrollbarWidth: 'thin',
      }}>
        {result.personIds.map((pid) => {
          const person = people.find((p) => p.id === pid);
          if (!person) return null;
          const payment = currentOrder.payments[pid];
          const status = payment?.status || 'unpaid';
          const isActive = (selectedPersonId ?? result.personIds[0]) === pid;

          return (
            <button
              key={pid}
              onClick={() => setSelectedPersonId(pid)}
              style={{
                flexShrink: 0,
                padding: '8px 16px',
                borderRadius: 'var(--radius-sm)',
                border: `1.5px solid ${isActive ? 'var(--color-accent)' : 'var(--color-border)'}`,
                background: isActive ? 'var(--color-accent)' : 'var(--color-surface)',
                color: isActive ? 'var(--color-text-inverse)' : 'var(--color-text-primary)',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'all var(--transition-fast)',
              }}
            >
              {person.name}
              <span style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: status === 'paid' ? 'var(--color-paid)' :
                            status === 'partial' ? 'var(--color-partial)' :
                            isActive ? 'rgba(255,255,255,0.5)' : 'var(--color-text-muted)',
              }} />
            </button>
          );
        })}
      </div>

      {/* Invoice */}
      {activePerson && activePersonId && result.personCalcs[activePersonId] && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <InvoiceActions
            order={currentOrder}
            person={activePerson}
            payer={payer}
            calc={result.personCalcs[activePersonId]}
          />
          <InvoiceView
            order={currentOrder}
            person={activePerson}
            payer={payer}
            calc={result.personCalcs[activePersonId]}
          />
        </div>
      )}
    </div>
  );
}
