/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockStoreState = {
  user: { email: 'owner@example.com' },
  signOut: vi.fn(),
};

vi.mock('../../store/appStore', () => ({
  useAppStore: () => mockStoreState,
}));

import { Header } from './Header';

describe('Header navigation', () => {
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
    mockStoreState.signOut = vi.fn();
  });

  it('shows Orders and Past Orders without a separate invoice tab', () => {
    act(() => {
      root.render(<Header currentTab="order" onTabChange={() => undefined} />);
    });

    const labels = Array.from(container.querySelectorAll('button'))
      .map((button) => button.textContent?.trim())
      .filter(Boolean);

    expect(labels).toContain('Order');
    expect(labels).toContain('Past Orders');
    expect(labels).not.toContain('Invoices');
  });

  it('opens the profile menu in the top-right and signs out from there', async () => {
    act(() => {
      root.render(<Header currentTab="order" onTabChange={() => undefined} />);
    });

    const trigger = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('owner@example.com'));
    expect(trigger).toBeTruthy();

    act(() => {
      trigger!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const logoutButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Logout');
    expect(logoutButton).toBeTruthy();

    act(() => {
      logoutButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(mockStoreState.signOut).toHaveBeenCalledTimes(1);
  });
});
