/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoffeeLot, Order, Person } from '../../types';

const mockStoreState = {
  people: [] as Person[],
  orders: [] as Order[],
  addPerson: vi.fn().mockResolvedValue(undefined),
  updatePerson: vi.fn().mockResolvedValue(undefined),
  deletePerson: vi.fn().mockResolvedValue(undefined),
};

vi.mock('../../store/appStore', () => ({
  useAppStore: () => mockStoreState,
}));

import { PeoplePage } from './PeoplePage';

function makePerson(id: string, name: string): Person {
  return {
    id,
    workspaceId: 'workspace-1',
    name,
    createdAt: '2026-03-18T00:00:00.000Z',
    updatedAt: '2026-03-18T00:00:00.000Z',
  };
}

function makeLot(id: string, overrides: Partial<CoffeeLot> = {}): CoffeeLot {
  return {
    id,
    name: 'Test Coffee',
    foreignPricePerBag: 25,
    gramsPerBag: 250,
    quantity: 1,
    shares: [],
    ...overrides,
  };
}

function makeOrder(id: string, name: string, overrides: Partial<Order> = {}): Order {
  return {
    id,
    workspaceId: 'workspace-1',
    name,
    orderDate: overrides.orderDate || '2026-03-18',
    status: overrides.status ?? 'planning',
    roasterId: overrides.roasterId ?? null,
    roasterSnapshot: overrides.roasterSnapshot ?? null,
    payerId: overrides.payerId ?? 'other-person',
    payerBank: overrides.payerBank ?? { bankName: '', accountNumber: '', beneficiary: '' },
    referenceTemplate: overrides.referenceTemplate || 'FAJR-{ORDER}-{NAME}',
    goodsTotalZar: overrides.goodsTotalZar ?? 240,
    lots: overrides.lots ?? [],
    fees: overrides.fees ?? [],
    payments: overrides.payments ?? {},
    isArchived: overrides.isArchived ?? false,
    createdAt: overrides.createdAt || '2026-03-18T00:00:00.000Z',
    updatedAt: overrides.updatedAt || '2026-03-18T00:00:00.000Z',
    ...overrides,
  };
}

describe('PeoplePage deletion guards (BUG-ORD-09 / BUG-EDGE-05)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    mockStoreState.people = [];
    mockStoreState.orders = [];
    mockStoreState.addPerson = vi.fn().mockResolvedValue(undefined);
    mockStoreState.updatePerson = vi.fn().mockResolvedValue(undefined);
    mockStoreState.deletePerson = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  it('attempting to delete a person who is payer of an active order shows the error banner and blocks deletion', async () => {
    const alice = makePerson('alice-1', 'Alice');
    mockStoreState.people = [alice];
    mockStoreState.orders = [
      makeOrder('order-1', 'March Collective Drop', {
        payerId: 'alice-1',
        isArchived: false,
        status: 'planning',
      }),
    ];

    await act(async () => {
      root.render(<PeoplePage />);
      await Promise.resolve();
    });

    const removeBtn = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent === 'Remove',
    );
    expect(removeBtn).toBeTruthy();

    await act(async () => {
      removeBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    const errorAlert = container.querySelector('.alert-error');
    expect(errorAlert).toBeTruthy();
    expect(errorAlert?.textContent).toContain('Cannot remove "Alice" because they are the designated payer for active order "March Collective Drop"');

    // Confirm modal should not be opened
    expect(container.querySelector('.fb-modal-card')).toBeNull();
    // deletePerson should not have been called
    expect(mockStoreState.deletePerson).not.toHaveBeenCalled();
  });

  it('attempting to delete a person who holds shares in an active order shows the error banner and blocks deletion', async () => {
    const bob = makePerson('bob-1', 'Bob');
    mockStoreState.people = [bob];
    mockStoreState.orders = [
      makeOrder('order-1', 'April Batch', {
        payerId: 'someone-else',
        isArchived: false,
        status: 'locked',
        lots: [
          makeLot('lot-1', {
            shares: [{ id: 'share-1', personId: 'bob-1', shareGrams: 250 }],
          }),
        ],
      }),
    ];

    await act(async () => {
      root.render(<PeoplePage />);
      await Promise.resolve();
    });

    const removeBtn = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent === 'Remove',
    );
    expect(removeBtn).toBeTruthy();

    await act(async () => {
      removeBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    const errorAlert = container.querySelector('.alert-error');
    expect(errorAlert).toBeTruthy();
    expect(errorAlert?.textContent).toContain('Cannot remove "Bob" because they have assigned shares or allocations in active order "April Batch"');

    // Confirm modal should not be opened
    expect(container.querySelector('.fb-modal-card')).toBeNull();
    // deletePerson should not have been called
    expect(mockStoreState.deletePerson).not.toHaveBeenCalled();
  });

  it('attempting to delete a person who holds bag allocations in an active order shows the error banner and blocks deletion', async () => {
    const charlie = makePerson('charlie-1', 'Charlie');
    mockStoreState.people = [charlie];
    mockStoreState.orders = [
      makeOrder('order-2', 'May Roaster Special', {
        payerId: 'someone-else',
        isArchived: false,
        status: 'planning',
        lots: [
          makeLot('lot-2', {
            bagAllocations: [
              {
                id: 'bag-alloc-1',
                bagIndex: 0,
                mode: 'single',
                participants: [
                  {
                    id: 'part-1',
                    personId: 'charlie-1',
                    shareGrams: 250,
                    sourceShareId: 'share-orig',
                  },
                ],
              },
            ],
          }),
        ],
      }),
    ];

    await act(async () => {
      root.render(<PeoplePage />);
      await Promise.resolve();
    });

    const removeBtn = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent === 'Remove',
    );
    expect(removeBtn).toBeTruthy();

    await act(async () => {
      removeBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    const errorAlert = container.querySelector('.alert-error');
    expect(errorAlert).toBeTruthy();
    expect(errorAlert?.textContent).toContain('Cannot remove "Charlie" because they have assigned shares or allocations in active order "May Roaster Special"');

    expect(container.querySelector('.fb-modal-card')).toBeNull();
    expect(mockStoreState.deletePerson).not.toHaveBeenCalled();
  });

  it('deleting an unallocated person proceeds to delete confirmation', async () => {
    const diana = makePerson('diana-1', 'Diana');
    mockStoreState.people = [diana];
    mockStoreState.orders = [
      makeOrder('order-1', 'Active Order', {
        payerId: 'other-person',
        isArchived: false,
        status: 'planning',
        lots: [
          makeLot('lot-1', {
            shares: [{ id: 's-1', personId: 'other-person', shareGrams: 250 }],
          }),
        ],
      }),
    ];

    await act(async () => {
      root.render(<PeoplePage />);
      await Promise.resolve();
    });

    const removeBtn = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent === 'Remove',
    );
    expect(removeBtn).toBeTruthy();

    await act(async () => {
      removeBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    // No error banner
    expect(container.querySelector('.alert-error')).toBeNull();

    // Confirmation modal is shown
    const modal = container.querySelector('.fb-modal-card');
    expect(modal).toBeTruthy();
    expect(container.querySelector('.fb-modal-title')?.textContent).toContain('Remove "Diana"?');

    // Confirm button inside modal
    const confirmButton = Array.from(modal?.querySelectorAll('button') ?? []).find(
      (btn) => btn.textContent?.includes('Remove Person'),
    );
    expect(confirmButton).toBeTruthy();

    await act(async () => {
      confirmButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(mockStoreState.deletePerson).toHaveBeenCalledWith('diana-1');
  });

  it('allows deleting a person whose only associations are in archived orders', async () => {
    const evan = makePerson('evan-1', 'Evan');
    mockStoreState.people = [evan];
    mockStoreState.orders = [
      makeOrder('order-archived', 'Archived Last Year Drop', {
        payerId: 'evan-1',
        isArchived: true,
        status: 'archived',
        lots: [
          makeLot('lot-archived', {
            shares: [{ id: 's-archived', personId: 'evan-1', shareGrams: 250 }],
          }),
        ],
      }),
    ];

    await act(async () => {
      root.render(<PeoplePage />);
      await Promise.resolve();
    });

    const removeBtn = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent === 'Remove',
    );
    expect(removeBtn).toBeTruthy();

    await act(async () => {
      removeBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    // No error banner
    expect(container.querySelector('.alert-error')).toBeNull();

    // Modal is opened
    expect(container.querySelector('.fb-modal-card')).toBeTruthy();
    expect(container.querySelector('.fb-modal-title')?.textContent).toContain('Remove "Evan"?');
  });
});
