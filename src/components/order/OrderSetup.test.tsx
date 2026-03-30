/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Order, Person, Roaster } from '../../types';

const mockStoreState = {
  people: [] as Person[],
  roasters: [] as Roaster[],
  orders: [] as Order[],
  updateOrder: vi.fn(),
  createRoaster: vi.fn(),
  setOrderPin: vi.fn(),
  clearOrderPin: vi.fn(),
  sessionUi: {
    orderProtectionOpen: {} as Record<string, boolean>,
  },
  setOrderProtectionOpen: vi.fn(),
};

vi.mock('../../store/appStore', () => ({
  useAppStore: () => mockStoreState,
}));

import { OrderSetup } from './OrderSetup';

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: overrides.id ?? 'order-1',
    workspaceId: 'workspace-1',
    name: overrides.name ?? 'March Drop',
    orderDate: overrides.orderDate ?? '2026-03-18',
    roasterId: overrides.roasterId ?? null,
    roasterSnapshot: overrides.roasterSnapshot ?? null,
    payerId: overrides.payerId ?? 'person-1',
    payerBank: overrides.payerBank ?? { bankName: '', accountNumber: '', beneficiary: '' },
    referenceTemplate: overrides.referenceTemplate ?? 'FAJR-{ORDER}-{NAME}',
    goodsTotalZar: overrides.goodsTotalZar ?? 0,
    lots: overrides.lots ?? [],
    fees: overrides.fees ?? [],
    payments: overrides.payments ?? {},
    isArchived: overrides.isArchived ?? false,
    pinRequired: overrides.pinRequired ?? false,
    createdAt: overrides.createdAt ?? '2026-03-18T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-03-18T00:00:00.000Z',
  };
}

describe('OrderSetup roaster flow', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    mockStoreState.people = [
      {
        id: 'person-1',
        workspaceId: 'workspace-1',
        name: 'Amina',
        createdAt: '2026-03-18T00:00:00.000Z',
        updatedAt: '2026-03-18T00:00:00.000Z',
      },
    ];
    mockStoreState.roasters = [
      {
        id: 'roaster-1',
        workspaceId: 'workspace-1',
        name: 'Father Coffee',
        createdAt: '2026-03-18T00:00:00.000Z',
        updatedAt: '2026-03-18T00:00:00.000Z',
      },
    ];
    mockStoreState.orders = [makeOrder()];
    mockStoreState.updateOrder = vi.fn().mockResolvedValue(undefined);
    mockStoreState.createRoaster = vi.fn().mockResolvedValue({
      id: 'roaster-2',
      workspaceId: 'workspace-1',
      name: 'Rosetta',
      createdAt: '2026-03-18T00:00:00.000Z',
      updatedAt: '2026-03-18T00:00:00.000Z',
    });
    mockStoreState.setOrderPin = vi.fn().mockResolvedValue(undefined);
    mockStoreState.clearOrderPin = vi.fn().mockResolvedValue(undefined);
    mockStoreState.setOrderProtectionOpen = vi.fn();
    mockStoreState.sessionUi = {
      orderProtectionOpen: {},
    };
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  it('shows saved roasters in the setup dropdown', () => {
    act(() => {
      root.render(<OrderSetup order={makeOrder()} />);
    });

    const options = Array.from(container.querySelectorAll('option')).map((option) => option.textContent?.trim());
    expect(options).toContain('Father Coffee');
  });

  it('creates a new roaster inline and immediately links it to the order', async () => {
    act(() => {
      root.render(<OrderSetup order={makeOrder()} />);
    });

    const addButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Add roaster');
    expect(addButton).toBeTruthy();

    act(() => {
      addButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const input = container.querySelector('#create-roaster-name') as HTMLInputElement | null;
    expect(input).toBeTruthy();

    act(() => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      valueSetter?.call(input, 'Rosetta');
      input!.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const saveButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Save roaster');
    expect(saveButton).toBeTruthy();

    await act(async () => {
      saveButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(mockStoreState.createRoaster).toHaveBeenCalledWith({
      name: 'Rosetta',
      logoFile: null,
    });
    expect(mockStoreState.updateOrder).toHaveBeenCalledWith('order-1', {
      roasterId: 'roaster-2',
      roasterSnapshot: {
        id: 'roaster-2',
        name: 'Rosetta',
        logoUrl: undefined,
      },
    });
  });
});
