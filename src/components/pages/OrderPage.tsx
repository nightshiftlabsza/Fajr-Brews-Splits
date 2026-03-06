import { useState } from 'react';
import { useAppStore, getCurrentOrder } from '../../store/appStore';
import { OrderSetup } from '../order/OrderSetup';
import { CoffeeLotsSection } from '../order/CoffeeLotsSection';
import { GoodsAndFees } from '../order/GoodsAndFees';
import { OrderSummary } from '../order/OrderSummary';
import { allLotsBalanced } from '../../lib/calculations';
import { todayISO, formatDateShort } from '../../lib/formatters';

type Section = 'setup' | 'lots' | 'goods' | 'summary';

interface ChevronProps { open: boolean }
function Chevron({ open }: ChevronProps) {
  return (
    <svg
      width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      style={{ transition: 'transform 200ms ease', transform: open ? 'rotate(180deg)' : 'none' }}
    >
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  );
}

export function OrderPage() {
  const { people, createOrder, setCurrentOrderId } = useAppStore();
  const currentOrder = useAppStore(getCurrentOrder);
  const [open, setOpen] = useState<Section>('setup');
  const [creating, setCreating] = useState(false);

  function toggle(section: Section) {
    setOpen((prev) => (prev === section ? 'setup' : section));
  }

  async function handleNewOrder() {
    setCreating(true);
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
      if (order) setCurrentOrderId(order.id);
    } finally {
      setCreating(false);
    }
  }

  if (!currentOrder) {
    return (
      <div className="page-container">
        <div className="empty-state" style={{ paddingTop: 'var(--space-16)' }}>
          <div className="empty-state-icon">📋</div>
          <h3>No active order</h3>
          <p>Create a new order to start splitting coffee costs, or open an existing order from History.</p>
          <button className="btn btn-primary btn-lg" onClick={handleNewOrder} disabled={creating}>
            {creating ? <span className="spinner" style={{ width: 18, height: 18 }} /> : 'New Order'}
          </button>
        </div>
      </div>
    );
  }

  const lotsOk = currentOrder.lots.length > 0 && allLotsBalanced(currentOrder.lots);
  const goodsOk = currentOrder.goodsTotalZar > 0;
  const setupOk = !!currentOrder.name && !!currentOrder.payerId && !!currentOrder.payerBank?.bankName;

  return (
    <div className="page-container">
      {/* Order title bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-5)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>{currentOrder.name || 'Untitled Order'}</h2>
          <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
            {formatDateShort(currentOrder.orderDate)}
            &nbsp;·&nbsp;
            {currentOrder.lots.length} lot{currentOrder.lots.length !== 1 ? 's' : ''}
            &nbsp;·&nbsp;
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span className="realtime-dot" style={{ width: 6, height: 6 }} />
              Live
            </span>
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={handleNewOrder} disabled={creating}>
          New order
        </button>
      </div>

      {/* Accordion sections */}
      <AccordionSection
        id="setup"
        title="Order Setup"
        open={open === 'setup'}
        onToggle={() => toggle('setup')}
        complete={setupOk}
        badge={setupOk ? currentOrder.name : undefined}
      >
        <OrderSetup order={currentOrder} />
      </AccordionSection>

      <AccordionSection
        id="lots"
        title="Coffee Lots"
        open={open === 'lots'}
        onToggle={() => toggle('lots')}
        complete={lotsOk}
        badge={lotsOk ? `${currentOrder.lots.length} lot${currentOrder.lots.length !== 1 ? 's' : ''} · balanced` : currentOrder.lots.length > 0 ? `${currentOrder.lots.length} lot${currentOrder.lots.length !== 1 ? 's' : ''}` : undefined}
      >
        <CoffeeLotsSection order={currentOrder} />
      </AccordionSection>

      <AccordionSection
        id="goods"
        title="Goods & Fees"
        open={open === 'goods'}
        onToggle={() => toggle('goods')}
        complete={goodsOk}
        badge={goodsOk ? `R${currentOrder.goodsTotalZar.toFixed(2)} + ${currentOrder.fees.length} fee${currentOrder.fees.length !== 1 ? 's' : ''}` : undefined}
      >
        <GoodsAndFees order={currentOrder} />
      </AccordionSection>

      <AccordionSection
        id="summary"
        title="Summary"
        open={open === 'summary'}
        onToggle={() => toggle('summary')}
        complete={false}
      >
        <OrderSummary order={currentOrder} />
      </AccordionSection>
    </div>
  );
}

// ─── Accordion Section ────────────────────────────────────────

interface AccordionSectionProps {
  id: Section;
  title: string;
  open: boolean;
  onToggle: () => void;
  complete: boolean;
  badge?: string;
  children: React.ReactNode;
}

function AccordionSection({ title, open, onToggle, complete, badge, children }: AccordionSectionProps) {
  return (
    <div className="accordion" style={{ marginBottom: 'var(--space-3)' }}>
      <button className="accordion-trigger" onClick={onToggle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flex: 1, minWidth: 0 }}>
          <span style={{
            width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: complete ? 'var(--color-paid-bg)' : 'var(--color-surface-raised)',
            color: complete ? 'var(--color-paid)' : 'var(--color-text-muted)',
            fontSize: '0.75rem', fontWeight: 700,
          }}>
            {complete ? '✓' : '○'}
          </span>
          <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--color-text-primary)' }}>
            {title}
          </span>
          {badge && !open && (
            <span style={{
              fontSize: '0.75rem', color: 'var(--color-text-muted)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              marginLeft: 'var(--space-1)',
            }}>
              · {badge}
            </span>
          )}
        </div>
        <Chevron open={open} />
      </button>

      {open && (
        <div className="accordion-content">
          {children}
        </div>
      )}
    </div>
  );
}
