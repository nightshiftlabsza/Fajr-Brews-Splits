/** @vitest-environment jsdom */

import fs from 'node:fs';
import path from 'node:path';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Order, Person } from '../../types';
import { OrderSummary } from './OrderSummary';
import { todayISO } from '../../lib/formatters';

const mockStoreState = {
  people: [] as Person[],
  roasters: [],
  orders: [] as Order[],
  updateOrder: vi.fn(),
  deleteOrder: vi.fn(),
  setCurrentOrderId: vi.fn(),
  flushOrderWrites: vi.fn(),
};

vi.mock('../../store/appStore', () => ({
  useAppStore: Object.assign(
    () => mockStoreState,
    {
      getState: vi.fn(() => mockStoreState),
    },
  ),
}));

const people: Person[] = [
  {
    id: 'person-1',
    workspaceId: 'workspace-1',
    name: 'Alice',
    createdAt: '2026-03-18T00:00:00.000Z',
    updatedAt: '2026-03-18T00:00:00.000Z',
  },
  {
    id: 'person-2',
    workspaceId: 'workspace-1',
    name: 'Bilal',
    createdAt: '2026-03-18T00:00:00.000Z',
    updatedAt: '2026-03-18T00:00:00.000Z',
  },
];

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: overrides.id || 'order-1',
    workspaceId: 'workspace-1',
    name: overrides.name || 'March Drop',
    orderDate: overrides.orderDate || '2026-03-18',
    roasterId: overrides.roasterId ?? null,
    roasterSnapshot: overrides.roasterSnapshot ?? null,
    payerId: overrides.payerId ?? 'person-1',
    payerBank: overrides.payerBank ?? { bankName: '', accountNumber: '', beneficiary: '' },
    referenceTemplate: overrides.referenceTemplate || 'FAJR-{ORDER}-{NAME}',
    goodsTotalZar: overrides.goodsTotalZar ?? 150,
    lots: overrides.lots ?? [
      {
        id: 'lot-1',
        name: 'Kenya AA',
        foreignPricePerBag: 12,
        gramsPerBag: 250,
        quantity: 1,
        shares: [
          { id: 'share-1', personId: 'person-2', shareGrams: 250, bagIndex: 0 },
        ],
        bagAllocations: [
          {
            id: 'bag-0',
            bagIndex: 0,
            mode: 'single',
            participants: [
              { id: 'participant-1', personId: 'person-2', shareGrams: 250, sourceShareId: 'share-1' },
            ],
          },
        ],
      },
    ],
    fees: overrides.fees ?? [],
    payments: overrides.payments ?? {},
    isArchived: overrides.isArchived ?? false,
    createdAt: overrides.createdAt || '2026-03-18T00:00:00.000Z',
    updatedAt: overrides.updatedAt || '2026-03-18T00:00:00.000Z',
  };
}

function clickButtonByText(container: HTMLElement, label: string, index = 0) {
  const button = Array.from(container.querySelectorAll('button')).filter((candidate) => candidate.textContent?.trim() === label)[index];
  if (!button) {
    throw new Error(`Could not find button with label "${label}".`);
  }

  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

describe('OrderSummary', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    mockStoreState.people = people;
    mockStoreState.orders = [makeOrder(), makeOrder({ id: 'order-2', name: 'April Drop' })];
    mockStoreState.updateOrder = vi.fn().mockResolvedValue(undefined);
    mockStoreState.deleteOrder = vi.fn().mockResolvedValue(undefined);
    mockStoreState.setCurrentOrderId = vi.fn();
    mockStoreState.flushOrderWrites = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders the summary step as the three-zone settlement hub', () => {
    act(() => {
      root.render(
        <OrderSummary
          order={makeOrder()}
          onJumpToStep={() => undefined}
          onFinalize={() => undefined}
        />,
      );
    });

    expect(container.textContent).toContain('Order overview');


    expect(container.textContent).toContain('Participants & invoices');
    expect(container.textContent).toContain('Finalize order');
    expect(container.textContent).toContain('Save to past orders');
    expect(container.textContent).toContain('Delete order');
    expect(container.textContent).not.toContain('Payment state');
    expect(container.textContent).not.toContain('Invoices and sharing');
  });

  it('keeps invoice previews collapsed by default and reveals them when expanded', () => {
    act(() => {
      root.render(
        <OrderSummary
          order={makeOrder()}
          onJumpToStep={() => undefined}
          onFinalize={() => undefined}
        />,
      );
    });

    expect(container.textContent).not.toContain('Payment Instructions');

    clickButtonByText(container, 'View details');

    expect(container.textContent).toContain('Payment Instructions');
    expect(container.textContent).toContain('Download PDF');
    expect(container.textContent).toContain('WhatsApp');
    expect(container.textContent).toContain('Email');
    expect(container.textContent).toContain('Copy payment summary');
  });

  it('updates payment status from the per-person settlement row', async () => {
    act(() => {
      root.render(
        <OrderSummary
          order={makeOrder()}
          onJumpToStep={() => undefined}
          onFinalize={() => undefined}
        />,
      );
    });

    clickButtonByText(container, 'Unpaid');
    clickButtonByText(container, 'Paid');

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockStoreState.updateOrder).toHaveBeenCalledWith('order-1', {
      payments: {
        'person-2': {
          status: 'paid',
          amountPaid: 150,
          datePaid: todayISO(),
        },
      },
    });
  });

  it('supports partial payment quick-edit controls without expanding details first', async () => {
    act(() => {
      root.render(
        <OrderSummary
          order={makeOrder()}
          onJumpToStep={() => undefined}
          onFinalize={() => undefined}
        />,
      );
    });

    clickButtonByText(container, 'Unpaid');
    clickButtonByText(container, 'Partly paid');

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockStoreState.updateOrder).toHaveBeenCalledWith('order-1', {
      payments: {
        'person-2': {
          status: 'partial',
          amountPaid: 0,
          datePaid: todayISO(),
        },
      },
    });

    act(() => {
      root.render(
        <OrderSummary
          order={makeOrder({
            payments: {
              'person-2': {
                status: 'partial',
                amountPaid: 25,
                datePaid: todayISO(),
              },
            },
          })}
          onJumpToStep={() => undefined}
          onFinalize={() => undefined}
        />,
      );
    });

    expect(container.textContent).toContain('Amount paid (ZAR)');
    expect(container.textContent).toContain('Outstanding:');
    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement | null;
    expect(dateInput?.value).toBe(todayISO());
    expect(container.querySelector('input[type="number"]')).toBeTruthy();
  });

  it('finalizes the order into Past Orders and advances to the next active order', async () => {
    const onFinalize = vi.fn();

    act(() => {
      root.render(
        <OrderSummary
          order={makeOrder()}
          onJumpToStep={() => undefined}
          onFinalize={onFinalize}
        />,
      );
    });

    clickButtonByText(container, 'Save to past orders');
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockStoreState.updateOrder).toHaveBeenCalledWith('order-1', { isArchived: true });
    expect(mockStoreState.flushOrderWrites).toHaveBeenCalledWith('order-1');
    expect(mockStoreState.setCurrentOrderId).toHaveBeenCalledWith('order-2');
    expect(onFinalize).toHaveBeenCalledTimes(1);
  });

  it('deletes the active order from the main summary after confirmation', async () => {
    act(() => {
      root.render(
        <OrderSummary
          order={makeOrder()}
          onJumpToStep={() => undefined}
          onFinalize={() => undefined}
        />,
      );
    });

    clickButtonByText(container, 'Delete order');

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Delete "March Drop"?');
    const modalConfirmBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('.fb-modal-actions button')).find((b) =>
      b.textContent?.includes('Delete order')
    );
    expect(modalConfirmBtn).toBeTruthy();
    act(() => {
      modalConfirmBtn?.click();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockStoreState.flushOrderWrites).toHaveBeenCalledWith('order-1');
    expect(mockStoreState.deleteOrder).toHaveBeenCalledWith('order-1');
  });

  it('saves archived past-order corrections without unarchiving the order', async () => {
    const onFinalize = vi.fn();

    act(() => {
      root.render(
        <OrderSummary
          order={makeOrder({ isArchived: true })}
          onJumpToStep={() => undefined}
          onFinalize={onFinalize}
        />,
      );
    });

    expect(container.textContent).toContain('Save changes');
    expect(container.textContent).not.toContain('Delete order');
    clickButtonByText(container, 'Save changes');

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockStoreState.flushOrderWrites).toHaveBeenCalledWith('order-1');
    expect(mockStoreState.updateOrder).not.toHaveBeenCalledWith('order-1', { isArchived: true });
    expect(mockStoreState.setCurrentOrderId).not.toHaveBeenCalled();
    expect(onFinalize).toHaveBeenCalledTimes(1);
  });

  it('renders the desktop 2-column cockpit grid with main column and sticky sidebar column', () => {
    act(() => {
      root.render(
        <OrderSummary
          order={makeOrder({
            goodsTotalZar: 200,
            fees: [{ id: 'fee-1', label: 'Shipping', amountZar: 50, allocationType: 'equal_per_person' }],
          })}
          onJumpToStep={() => undefined}
          onFinalize={() => undefined}
        />,
      );
    });

    const cockpitGrid = container.querySelector('.order-cockpit-grid');
    expect(cockpitGrid).toBeTruthy();

    const mainCol = cockpitGrid?.querySelector('.cockpit-main-column');
    expect(mainCol).toBeTruthy();
    expect(mainCol?.querySelector('.order-summary-overview')).toBeTruthy();

    const sidebarCol = cockpitGrid?.querySelector('.cockpit-sidebar-column');
    expect(sidebarCol).toBeTruthy();

    const heroLabel = sidebarCol?.querySelector('.cockpit-hero-total-label');
    expect(heroLabel?.textContent).toBe('Grand total');

    const heroAmount = sidebarCol?.querySelector('.cockpit-hero-total-amount');
    expect(heroAmount?.textContent).toBe('R250.00');

    const lineItems = sidebarCol?.querySelectorAll('.cockpit-line-item');
    expect(lineItems?.length).toBeGreaterThanOrEqual(3); // Goods, Fees, People charged

    // Mobile summary card is also present in DOM for small screen collapse
    expect(container.querySelector('.cockpit-mobile-summary-card')).toBeTruthy();
  });

  it('includes desktop defense-in-depth hiding rules for summary-sticky-bar and cockpit-mobile-summary-card in inline style', () => {
    act(() => {
      root.render(
        <OrderSummary
          order={makeOrder()}
          onJumpToStep={() => undefined}
          onFinalize={() => undefined}
        />,
      );
    });

    const styleTags = Array.from(container.querySelectorAll('style'));
    const summaryStyle = styleTags.find((s) => s.textContent?.includes('.rounding-absorption-badge'));
    expect(summaryStyle?.textContent).toContain('.summary-sticky-bar');
    expect(summaryStyle?.textContent).toContain('display: none !important');
    expect(summaryStyle?.textContent).toContain('.cockpit-mobile-summary-card');
  });

  it('renders finalize error in both desktop sidebar and mobile sticky bar when order finalization fails', async () => {
    mockStoreState.flushOrderWrites = vi.fn().mockRejectedValue(new Error('Network error syncing final order'));

    act(() => {
      root.render(
        <OrderSummary
          order={makeOrder()}
          onJumpToStep={() => undefined}
          onFinalize={() => undefined}
        />,
      );
    });

    clickButtonByText(container, 'Save to past orders');
    await act(async () => {
      await Promise.resolve();
    });

    const sidebarAlert = container.querySelector('.cockpit-sidebar-column .alert.alert-error');
    const stickyAlert = container.querySelector('.summary-sticky-bar .alert.alert-error');
    expect(sidebarAlert).toBeTruthy();
    expect(stickyAlert).toBeTruthy();
    expect(sidebarAlert?.textContent).toContain('Network error syncing final order');
    expect(stickyAlert?.textContent).toContain('Network error syncing final order');
  });

  it('renders delete error in both desktop sidebar and mobile sticky bar when order deletion fails', async () => {
    mockStoreState.deleteOrder = vi.fn().mockRejectedValue(new Error('Failed to delete order from database'));

    act(() => {
      root.render(
        <OrderSummary
          order={makeOrder()}
          onJumpToStep={() => undefined}
          onFinalize={() => undefined}
        />,
      );
    });

    clickButtonByText(container, 'Delete order');
    await act(async () => {
      await Promise.resolve();
    });

    clickButtonByText(container, 'Delete order');
    await act(async () => {
      await Promise.resolve();
    });

    // In ConfirmModal
    const modalConfirmBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('.fb-modal-actions button')).find((b) =>
      b.textContent?.includes('Delete order')
    );
    expect(modalConfirmBtn).toBeTruthy();
    act(() => {
      modalConfirmBtn?.click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    const sidebarAlert = container.querySelector('.cockpit-sidebar-column .alert.alert-error');
    const stickyAlert = container.querySelector('.summary-sticky-bar .alert.alert-error');
    expect(sidebarAlert).toBeTruthy();
    expect(stickyAlert).toBeTruthy();
    expect(sidebarAlert?.textContent).toContain('Failed to delete order from database');
    expect(stickyAlert?.textContent).toContain('Failed to delete order from database');
  });

  it('verifies globals.css defines .sr-only and hides summary-sticky-bar on desktop', () => {
    const cssPath = path.resolve(__dirname, '../../styles/globals.css');
    const css = fs.readFileSync(cssPath, 'utf8');
    expect(css).toContain('.sr-only');
    expect(css).toContain('clip: rect(0, 0, 0, 0)');
    expect(css).toMatch(/@media\s*\(min-width:\s*1024px\)\s*\{[\s\S]*?\.summary-sticky-bar\s*\{[^}]*display:\s*none\s*!important/);
    expect(css).toMatch(/@media\s*\(max-width:\s*767px\)\s*\{[\s\S]*?\.order-cockpit\s*\{[^}]*padding-bottom:\s*calc\(160px\s*\+\s*env\(safe-area-inset-bottom,\s*0px\)\);/);
    expect(css).toMatch(/@media\s*\(max-width:\s*767px\)\s*\{[\s\S]*?\.summary-sticky-bar\s*\{[^}]*position:\s*fixed;/);
    expect(css).toMatch(/@media\s*\(min-width:\s*768px\)\s*and\s*\(max-width:\s*1023px\)\s*\{[\s\S]*?\.summary-sticky-bar\s*\{[^}]*position:\s*sticky;/);
    expect(css).toMatch(/@media\s*\(min-width:\s*768px\)\s*and\s*\(max-width:\s*1023px\)\s*\{[\s\S]*?\.summary-sticky-bar\s*\{[^}]*bottom:\s*calc\(var\(--space-4\)\s*\+\s*env\(safe-area-inset-bottom,\s*0px\)\);/);
  });
});

