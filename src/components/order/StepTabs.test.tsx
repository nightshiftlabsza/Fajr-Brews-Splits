/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StepTabs } from './StepTabs';
import type { Order } from '../../types';

function createDummyOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'ord-1',
    workspaceId: 'ws-1',
    name: 'October Coffee Drop',
    orderDate: '2026-10-28',
    roasterId: null,
    roasterSnapshot: null,
    payerId: 'p-1',
    payerBank: { bankName: '', accountNumber: '', beneficiary: '' },
    referenceTemplate: 'FAJR-{ORDER}-{NAME}',
    goodsTotalZar: 1500,
    lots: [
      {
        id: 'lot-1',
        name: 'Gesha Village',
        gramsPerBag: 250,
        foreignPricePerBag: 20,
        quantity: 1,
        bags: [
          {
            id: 'b-1',
            splitMode: 'full',
            buyers: [{ id: 'bb-1', personId: 'p-1', grams: 250 }],
          },
        ],
        bagAllocations: [
          {
            id: 'ba-1',
            bagIndex: 0,
            mode: 'single',
            participants: [{ id: 'bp-1', personId: 'p-1', shareGrams: 250, sourceShareId: 's-1' }],
          },
        ],
        shares: [{ id: 's-1', personId: 'p-1', shareGrams: 250, bagIndex: 0 }],
      },
    ],
    fees: [],
    payments: {},
    isArchived: false,
    createdAt: '2026-10-28T00:00:00Z',
    updatedAt: '2026-10-28T00:00:00Z',
    ...overrides,
  };
}

describe('StepTabs', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('marks done steps with a check and underlines the current active step', () => {
    const order = createDummyOrder();
    const onSelectStep = vi.fn();

    act(() => {
      root.render(
        <StepTabs
          currentStep="goods"
          order={order}
          onSelectStep={onSelectStep}
        />
      );
    });

    const setupTab = container.querySelector('[data-section="setup"]');
    const coffeesTab = container.querySelector('[data-section="coffees"]');
    const goodsTab = container.querySelector('[data-section="goods"]');

    // Setup and coffees are done and not current -> has check icon
    expect(setupTab?.querySelector('.is-check')).toBeTruthy();
    expect(coffeesTab?.querySelector('.is-check')).toBeTruthy();

    // Goods is current -> has is-active and aria-current="step"
    expect(goodsTab?.classList.contains('is-active')).toBe(true);
    expect(goodsTab?.getAttribute('aria-current')).toBe('step');
  });

  it('displays lock icon and reason on locked steps, and does not silently ignore clicks', () => {
    // Incomplete order: no name, no coffees, no goods total
    const incompleteOrder = createDummyOrder({
      name: '',
      lots: [],
      goodsTotalZar: 0,
    });
    const onSelectStep = vi.fn();

    act(() => {
      root.render(
        <StepTabs
          currentStep="setup"
          order={incompleteOrder}
          onSelectStep={onSelectStep}
        />
      );
    });

    const coffeesTab = container.querySelector('[data-section="coffees"]') as HTMLButtonElement;
    expect(coffeesTab).toBeTruthy();
    expect(coffeesTab.getAttribute('aria-disabled')).toBe('true');
    expect(coffeesTab.querySelector('.is-lock')).toBeTruthy();

    // Reason tooltip is present in DOM and associated with aria-describedby
    const reasonId = coffeesTab.getAttribute('aria-describedby');
    expect(reasonId).toBeTruthy();
    const tooltip = container.querySelector(`#${reasonId}`);
    expect(tooltip?.textContent).toContain('Complete setup first');

    // Clicking locked tab does not silently ignore: it activates tooltip / announcement, but does NOT call onSelectStep
    act(() => {
      coffeesTab.click();
    });

    expect(onSelectStep).not.toHaveBeenCalled();
    expect(tooltip?.classList.contains('is-visible')).toBe(true);

    const announcement = container.querySelector('[role="status"]');
    expect(announcement?.textContent).toContain('Complete setup first');
  });

  it('navigates when clicking an unlocked step', () => {
    const order = createDummyOrder();
    const onSelectStep = vi.fn();

    act(() => {
      root.render(
        <StepTabs
          currentStep="setup"
          order={order}
          onSelectStep={onSelectStep}
        />
      );
    });

    const coffeesTab = container.querySelector('[data-section="coffees"]') as HTMLButtonElement;
    act(() => {
      coffeesTab.click();
    });

    expect(onSelectStep).toHaveBeenCalledWith('coffees');
  });

  it('supports keyboard navigation with arrow keys', () => {
    const order = createDummyOrder();
    const onSelectStep = vi.fn();

    act(() => {
      root.render(
        <StepTabs
          currentStep="setup"
          order={order}
          onSelectStep={onSelectStep}
        />
      );
    });

    const setupTab = container.querySelector('[data-section="setup"]') as HTMLButtonElement;
    setupTab.focus();

    act(() => {
      setupTab.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });

    const coffeesTab = container.querySelector('[data-section="coffees"]') as HTMLButtonElement;
    expect(document.activeElement).toBe(coffeesTab);
  });
});
