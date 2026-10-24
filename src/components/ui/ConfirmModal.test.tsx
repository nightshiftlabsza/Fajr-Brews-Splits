/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmModal } from './ConfirmModal';

describe('ConfirmModal accessibility and focus trapping', () => {
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
    vi.clearAllMocks();
  });

  it('renders with accessible dialog attributes when open', () => {
    act(() => {
      root.render(
        <ConfirmModal
          isOpen={true}
          title="Delete Confirmation"
          description="Are you sure you want to delete this item?"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />,
      );
    });

    const backdrop = container.querySelector('.fb-modal-backdrop');
    expect(backdrop).toBeTruthy();
    expect(backdrop?.getAttribute('role')).toBe('dialog');
    expect(backdrop?.getAttribute('aria-modal')).toBe('true');
    expect(backdrop?.getAttribute('aria-labelledby')).toBe('fb-modal-title');
    expect(backdrop?.getAttribute('aria-describedby')).toBe('fb-modal-description');
    expect(container.querySelector('#fb-modal-title')?.textContent).toBe('Delete Confirmation');
    expect(container.querySelector('#fb-modal-description')?.textContent).toBe('Are you sure you want to delete this item?');
  });

  it('does not render when isOpen is false', () => {
    act(() => {
      root.render(
        <ConfirmModal
          isOpen={false}
          title="Hidden Modal"
          description="Should not appear"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />,
      );
    });

    expect(container.querySelector('.fb-modal-backdrop')).toBeNull();
  });

  it('calls onCancel when Escape key is pressed', () => {
    const handleCancel = vi.fn();
    act(() => {
      root.render(
        <ConfirmModal
          isOpen={true}
          title="Escape Test"
          description="Testing escape key"
          onConfirm={vi.fn()}
          onCancel={handleCancel}
        />,
      );
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(handleCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when backdrop is clicked, but not when card is clicked', () => {
    const handleCancel = vi.fn();
    act(() => {
      root.render(
        <ConfirmModal
          isOpen={true}
          title="Backdrop Test"
          description="Testing backdrop click"
          onConfirm={vi.fn()}
          onCancel={handleCancel}
        />,
      );
    });

    const card = container.querySelector('.fb-modal-card');
    act(() => {
      card?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(handleCancel).not.toHaveBeenCalled();

    const backdrop = container.querySelector('.fb-modal-backdrop');
    act(() => {
      backdrop?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(handleCancel).toHaveBeenCalledTimes(1);
  });

  it('auto-focuses cancel button and traps Tab navigation within modal buttons', async () => {
    vi.useFakeTimers();
    act(() => {
      root.render(
        <ConfirmModal
          isOpen={true}
          title="Focus Trap Test"
          description="Testing focus trap"
          confirmText="Yes, delete"
          cancelText="No, cancel"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />,
      );
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    const buttons = container.querySelectorAll<HTMLButtonElement>('.fb-modal-actions button');
    const cancelBtn = buttons[0];
    const confirmBtn = buttons[1];

    expect(document.activeElement).toBe(cancelBtn);

    // Tab from confirm button (last element) wraps to cancel button (first element)
    confirmBtn.focus();
    expect(document.activeElement).toBe(confirmBtn);

    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    act(() => {
      window.dispatchEvent(tabEvent);
    });
    expect(document.activeElement).toBe(cancelBtn);

    // Shift+Tab from cancel button (first element) wraps to confirm button (last element)
    const shiftTabEvent = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    act(() => {
      window.dispatchEvent(shiftTabEvent);
    });
    expect(document.activeElement).toBe(confirmBtn);

    vi.useRealTimers();
  });
});
