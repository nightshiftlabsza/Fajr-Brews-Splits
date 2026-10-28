/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentStatusChip } from './PaymentStatusChip';
import type { PaymentStatus } from '../../types';

describe('PaymentStatusChip', () => {
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

  it('renders each status with distinct label and tone', () => {
    const statuses: { status: PaymentStatus; expectedLabel: string; expectedTone: string }[] = [
      { status: 'unpaid', expectedLabel: 'Unpaid', expectedTone: 'is-unpaid' },
      { status: 'partial', expectedLabel: 'Partly paid', expectedTone: 'is-partial' },
      { status: 'paid', expectedLabel: 'Paid', expectedTone: 'is-paid' },
    ];

    for (const { status, expectedLabel, expectedTone } of statuses) {
      act(() => {
        root.render(<PaymentStatusChip status={status} readOnly={true} />);
      });

      const chip = container.querySelector('.fb-status-chip');
      expect(chip?.textContent).toContain(expectedLabel);
      expect(chip?.classList.contains(expectedTone)).toBe(true);
    }
  });

  it('opens a menu on click and allows selecting a new status', () => {
    const onStatusChange = vi.fn();

    act(() => {
      root.render(
        <PaymentStatusChip
          status="unpaid"
          onStatusChange={onStatusChange}
          personName="Zak"
        />
      );
    });

    const triggerBtn = container.querySelector('.fb-status-chip-btn') as HTMLButtonElement;
    expect(triggerBtn).toBeTruthy();
    expect(triggerBtn.getAttribute('aria-expanded')).toBe('false');

    // Click trigger to open menu
    act(() => {
      triggerBtn.click();
    });

    expect(triggerBtn.getAttribute('aria-expanded')).toBe('true');
    const menu = container.querySelector('[role="menu"]');
    expect(menu).toBeTruthy();

    const menuItems = menu?.querySelectorAll('[role="menuitem"]');
    expect(menuItems).toHaveLength(3);

    // Click "Paid" (3rd item)
    act(() => {
      (menuItems?.[2] as HTMLButtonElement).click();
    });

    expect(onStatusChange).toHaveBeenCalledWith('paid');
    // Menu should close
    expect(container.querySelector('[role="menu"]')).toBeNull();
  });

  it('closes menu on Escape key press', () => {
    const onStatusChange = vi.fn();

    act(() => {
      root.render(
        <PaymentStatusChip
          status="partial"
          onStatusChange={onStatusChange}
        />
      );
    });

    const triggerBtn = container.querySelector('.fb-status-chip-btn') as HTMLButtonElement;
    act(() => {
      triggerBtn.click();
    });

    const menu = container.querySelector('[role="menu"]') as HTMLDivElement;
    expect(menu).toBeTruthy();

    act(() => {
      menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(container.querySelector('[role="menu"]')).toBeNull();
    expect(onStatusChange).not.toHaveBeenCalled();
  });
});
