/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Order, Person } from '../../types';

const mockStoreState = {
  people: [] as Person[],
  orders: [] as Order[],
  updateOrder: vi.fn(),
  setCurrentOrderId: vi.fn(),
};

vi.mock('../../store/appStore', () => ({
  useAppStore: Object.assign(
    () => mockStoreState,
    {
      getState: vi.fn(() => mockStoreState),
    },
  ),
}));

vi.mock('./SettlementPacks', () => ({
  SettlementPacks: () => <div data-testid="settlement-packs">Settlement packs mounted</div>,
}));

import { OrderSummary } from './OrderSummary';

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

function clickButtonByText(container: HTMLElement, label: string) {
  const button = Array.from(container.querySelectorAll('button')).find((candidate) => candidate.textContent?.trim() === label);
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
    mockStoreState.setCurrentOrderId = vi.fn();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  it('renders the settlement action hub inside the summary step', () => {
    act(() => {
      root.render(
        <OrderSummary
          order={makeOrder()}
          onJumpToStep={() => undefined}
          onFinalize={() => undefined}
        />,
      );
    });

    expect(container.textContent).toContain('Summary');
    expect(container.textContent).toContain('Settlement packs mounted');
    expect(container.textContent).toContain('Save to Past Orders');
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

    clickButtonByText(container, 'Save to Past Orders');
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockStoreState.updateOrder).toHaveBeenCalledWith('order-1', { isArchived: true });
    expect(mockStoreState.setCurrentOrderId).toHaveBeenCalledWith('order-2');
    expect(onFinalize).toHaveBeenCalledTimes(1);
  });
});
