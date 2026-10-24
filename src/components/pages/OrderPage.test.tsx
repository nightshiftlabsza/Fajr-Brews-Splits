/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser, CoffeeLot, Order, Person, Roaster, RoasterFeatureStatus } from '../../types';

const mockStoreState = {
  orders: [] as Order[],
  people: [] as Person[],
  roasters: [] as Roaster[],
  user: { id: 'user-1', email: 'user1@example.com' } as AuthUser | null,
  memberRole: 'owner' as 'owner' | 'admin' | 'member' | null,
  currentOrderId: null as string | null,
  linkedPersonId: null as string | null,
  accessStatus: 'member' as const,
  roasterFeatureStatus: 'ready' as RoasterFeatureStatus,
  roasterFeatureMessage: null as string | null,
  createOrder: vi.fn(),
  updateOrderStatus: vi.fn(),
  updateOrder: vi.fn(),
  setCurrentOrderId: vi.fn(),
  createRoaster: vi.fn(),
  addPerson: vi.fn(),
};

vi.mock('../../store/appStore', () => ({
  useAppStore: () => mockStoreState,
}));

vi.mock('../../lib/pdf', () => ({
  generateOrderInvoicePDF: vi.fn(),
}));

import { OrderPage } from './OrderPage';

function makeValidLot(id: string, name: string): CoffeeLot {
  return {
    id,
    name,
    foreignPricePerBag: 20,
    gramsPerBag: 250,
    quantity: 1,
    shares: [{ id: `share-${id}`, personId: 'person-1', shareGrams: 250 }],
    bags: [
      {
        id: `bag-${id}`,
        splitMode: 'full',
        buyers: [{ id: `buyer-${id}`, personId: 'person-1', grams: 250 }],
      },
    ],
  };
}

function makeOrder(id: string, name: string, overrides: Partial<Order> = {}): Order {
  return {
    id,
    workspaceId: 'workspace-1',
    name,
    orderDate: '2026-03-18',
    status: overrides.status ?? 'planning',
    roasterId: overrides.roasterId ?? null,
    roasterSnapshot: overrides.roasterSnapshot ?? null,
    payerId: overrides.payerId ?? 'person-1',
    payerBank: overrides.payerBank ?? { bankName: '', accountNumber: '', beneficiary: '' },
    referenceTemplate: 'FAJR-{ORDER}-{NAME}',
    goodsTotalZar: overrides.goodsTotalZar ?? 100,
    lots: overrides.lots ?? [],
    fees: overrides.fees ?? [],
    payments: overrides.payments ?? {},
    isArchived: overrides.isArchived ?? false,
    ownerId: overrides.ownerId ?? 'user-1',
    createdAt: '2026-03-18T00:00:00.000Z',
    updatedAt: '2026-03-18T00:00:00.000Z',
  };
}

describe('OrderPage component tests', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    mockStoreState.user = { id: 'user-1', email: 'owner@example.com' };
    mockStoreState.memberRole = 'owner';
    mockStoreState.people = [
      { id: 'person-1', workspaceId: 'workspace-1', name: 'Alice', createdAt: '2026-03-18T00:00:00.000Z', updatedAt: '2026-03-18T00:00:00.000Z' },
      { id: 'person-2', workspaceId: 'workspace-1', name: 'Bilal', createdAt: '2026-03-18T00:00:00.000Z', updatedAt: '2026-03-18T00:00:00.000Z' },
    ];
    mockStoreState.roasters = [];
    mockStoreState.currentOrderId = null;
    mockStoreState.linkedPersonId = null;
    mockStoreState.createOrder = vi.fn();
    mockStoreState.updateOrderStatus = vi.fn();
    mockStoreState.updateOrder = vi.fn();
    mockStoreState.setCurrentOrderId = vi.fn((id: string | null) => {
      mockStoreState.currentOrderId = id;
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('BUG-ORD-01: auto-selects next active order when activeOrderId is archived remotely', async () => {
    const order1 = makeOrder('order-1', 'Order 1');
    const order2 = makeOrder('order-2', 'Order 2');
    mockStoreState.orders = [order1, order2];
    mockStoreState.currentOrderId = 'order-1';

    await act(async () => {
      root.render(<OrderPage onNavigateToHistory={vi.fn()} />);
    });

    expect(container.querySelector('.order-header-title')?.textContent).toBe('Order 1');

    // Simulate remote archival of order-1
    mockStoreState.orders = [
      { ...order1, status: 'archived', isArchived: true },
      order2,
    ];
    mockStoreState.currentOrderId = 'order-2';

    await act(async () => {
      root.render(<OrderPage onNavigateToHistory={vi.fn()} />);
    });

    // Instead of rendering permanent "No Active Orders", it automatically picks order-2
    expect(container.textContent).not.toContain('No Active Orders');
    expect(container.querySelector('.order-header-title')?.textContent).toBe('Order 2');
  });

  it('BUG-ORD-02: switches key with currentOrder.id across tabs', async () => {
    const order1 = makeOrder('order-1', 'Order 1');
    const order2 = makeOrder('order-2', 'Order 2');
    mockStoreState.orders = [order1, order2];
    mockStoreState.currentOrderId = 'order-1';

    await act(async () => {
      root.render(<OrderPage onNavigateToHistory={vi.fn()} />);
    });

    expect(container.querySelector('.order-header-title')?.textContent).toBe('Order 1');

    // Click tab for Order 2
    const tabs = Array.from(container.querySelectorAll('.order-tab-chip')) as HTMLButtonElement[];
    const order2Tab = tabs.find((t) => t.textContent?.includes('Order 2'));
    expect(order2Tab).toBeTruthy();

    await act(async () => {
      order2Tab?.click();
    });

    expect(container.querySelector('.order-header-title')?.textContent).toBe('Order 2');
  });

  it('BUG-ORD-12: falls back from invoices tab to coffees tab when switching to an empty order', async () => {
    const populatedOrder = makeOrder('order-1', 'Populated Order', {
      lots: [makeValidLot('lot-1', 'Geisha')],
      goodsTotalZar: 450,
    });
    const emptyOrder = makeOrder('order-2', 'Empty Order', {
      lots: [],
      goodsTotalZar: 0,
    });
    mockStoreState.orders = [populatedOrder, emptyOrder];
    mockStoreState.currentOrderId = 'order-1';

    await act(async () => {
      root.render(<OrderPage onNavigateToHistory={vi.fn()} />);
    });

    // Navigate to Invoices tab on order 1
    const invoiceTab = Array.from(container.querySelectorAll('.order-section-tab')).find(
      (btn) => btn.textContent?.includes('Invoices'),
    ) as HTMLButtonElement;
    expect(invoiceTab).toBeTruthy();

    await act(async () => {
      invoiceTab.click();
    });

    expect(container.querySelector('.order-section-tab.is-active')?.textContent).toContain('Invoices');

    // Switch to empty Order 2
    const tabs = Array.from(container.querySelectorAll('.order-tab-chip')) as HTMLButtonElement[];
    const emptyOrderTab = tabs.find((t) => t.textContent?.includes('Empty Order'));
    expect(emptyOrderTab).toBeTruthy();

    await act(async () => {
      emptyOrderTab?.click();
    });

    // Empty order should automatically fall back to Coffees tab without crashing
    expect(container.querySelector('.order-header-title')?.textContent).toBe('Empty Order');
    expect(container.querySelector('.order-section-tab.is-active')?.textContent).toContain('Coffees & Bags');
  });

  it('BUG-AUTH-05: allows workspace admin to manage invoices on order created by another member', async () => {
    const memberOrder = makeOrder('order-1', 'Member Order', {
      ownerId: 'user-regular-member',
      lots: [makeValidLot('lot-1', 'Yirgacheffe')],
      goodsTotalZar: 350,
    });

    mockStoreState.orders = [memberOrder];
    mockStoreState.currentOrderId = 'order-1';
    // Admin user who did not create the order
    mockStoreState.user = { id: 'user-admin', email: 'admin@example.com' };
    mockStoreState.memberRole = 'admin';

    await act(async () => {
      root.render(<OrderPage onNavigateToHistory={vi.fn()} />);
    });

    // Navigate to Invoices tab
    const invoiceTab = Array.from(container.querySelectorAll('.order-section-tab')).find(
      (btn) => btn.textContent?.includes('Invoices'),
    ) as HTMLButtonElement;
    await act(async () => {
      invoiceTab.click();
    });

    // Because user is workspace admin, isOwner is true -> viewing all invoices
    expect(container.textContent).toContain('Viewing all participant invoices for this order.');
  });

  it('BUG-AUTH-06 & 07: non-owner regular member cannot see status change or archive in actions dropdown', async () => {
    const ownerOrder = makeOrder('order-1', 'Drop A', {
      ownerId: 'user-other',
      status: 'planning',
    });
    mockStoreState.orders = [ownerOrder];
    mockStoreState.currentOrderId = 'order-1';
    mockStoreState.user = { id: 'user-regular', email: 'regular@example.com' };
    mockStoreState.memberRole = 'member';

    await act(async () => {
      root.render(<OrderPage onNavigateToHistory={vi.fn()} />);
    });

    // Open Actions dropdown
    const trigger = container.querySelector('.order-actions-trigger') as HTMLButtonElement;
    expect(trigger).toBeTruthy();
    await act(async () => {
      trigger.click();
    });

    // Non-owner member should see Copy Join Link and Duplicate, but NOT status change or Archive
    expect(container.textContent).toContain('Copy Join Link');
    expect(container.textContent).toContain('Duplicate Order');
    expect(container.textContent).not.toContain('Planning (Accepting changes)');
    expect(container.textContent).not.toContain('Archive Order');
  });

  it('BUG-AUTH-06 & 07: owner can see status changes and archive in actions dropdown', async () => {
    const myOrder = makeOrder('order-1', 'Drop A', {
      ownerId: 'user-1',
      status: 'planning',
    });
    mockStoreState.orders = [myOrder];
    mockStoreState.currentOrderId = 'order-1';
    mockStoreState.user = { id: 'user-1', email: 'me@example.com' };
    mockStoreState.memberRole = 'member';

    await act(async () => {
      root.render(<OrderPage onNavigateToHistory={vi.fn()} />);
    });

    // Open Actions dropdown
    const trigger = container.querySelector('.order-actions-trigger') as HTMLButtonElement;
    expect(trigger).toBeTruthy();
    await act(async () => {
      trigger.click();
    });

    // Owner should see status options and Archive Order
    expect(container.textContent).toContain('Planning (Accepting changes)');
    expect(container.textContent).toContain('Locked (Finalizing)');
    expect(container.textContent).toContain('Archive Order');
  });
});
