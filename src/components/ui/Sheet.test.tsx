/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Sheet } from './Sheet';

describe('Sheet Component', () => {
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

  it('renders dialog with accessible attributes when open and hides when closed', () => {
    act(() => {
      root.render(
        <Sheet
          isOpen={true}
          onClose={() => {}}
          title="Select People"
          description="Choose members for this coffee bag"
        >
          <div>Sheet Content</div>
        </Sheet>
      );
    });

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.textContent).toContain('Select People');
    expect(dialog?.textContent).toContain('Choose members for this coffee bag');

    act(() => {
      root.render(
        <Sheet
          isOpen={false}
          onClose={() => {}}
          title="Select People"
        >
          <div>Sheet Content</div>
        </Sheet>
      );
    });

    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('closes on Escape key press and restores focus to triggering button', async () => {
    const onClose = vi.fn();
    const triggerBtn = document.createElement('button');
    triggerBtn.textContent = 'Open Sheet';
    document.body.appendChild(triggerBtn);
    triggerBtn.focus();
    expect(document.activeElement).toBe(triggerBtn);

    act(() => {
      root.render(
        <Sheet
          isOpen={true}
          onClose={onClose}
          title="Bottom Sheet"
        >
          <button type="button">Inside Button</button>
        </Sheet>
      );
    });

    // Press Escape
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    // Also trigger on portal element
    const portal = container.querySelector('.fb-sheet-portal');
    act(() => {
      portal?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(onClose).toHaveBeenCalled();

    // When unmounting, focus is restored to triggerBtn
    act(() => {
      root.render(
        <Sheet
          isOpen={false}
          onClose={onClose}
          title="Bottom Sheet"
        >
          <div />
        </Sheet>
      );
    });

    expect(document.activeElement).toBe(triggerBtn);
    triggerBtn.remove();
  });

  it('applies is-full-height class when fullHeight is true', () => {
    act(() => {
      root.render(
        <Sheet
          isOpen={true}
          onClose={() => {}}
          title="Full Height Sheet"
          fullHeight={true}
        >
          <div>Content</div>
        </Sheet>
      );
    });

    const surface = container.querySelector('.fb-sheet-surface');
    expect(surface?.classList.contains('is-full-height')).toBe(true);
  });
});
