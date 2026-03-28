/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Order, Person } from '../../types';

const mockStoreState = {
  orders: [] as Order[],
  people: [] as Person[],
  deleteOrder: vi.fn(),
  createOrder: vi.fn(),
  updateOrder: vi.fn(),
  setOrderWizardStep: vi.fn(),
  setOrderProtectionOpen: vi.fn(),
  exportJSON: vi.fn(() => '{}'),
  importJSON: vi.fn(),
  setLastExportDate: vi.fn(),
  verifyOrderPin: vi.fn(),
  unlockedOrderIds: new Set<string>(),
  sessionUi: {
    orderWizardSteps: {} as Record<string, 'setup' | 'coffees' | 'goods' | 'summary'>,
    orderProtectionOpen: {} as Record<string, boolean>,
  },
};

vi.mock('../../store/appStore', () => ({
  useAppStore: () => mockStoreState,
}));

import { HistoryPage } from './HistoryPage';

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
    name: overrides.name || 'Saved March Drop',
    orderDate: overrides.orderDate || '2026-03-18',
    payerId: overrides.payerId ?? 'person-1',
    payerBank: overrides.payerBank ?? { bankName: '', accountNumber: '', beneficiary: '' },
    referenceTemplate: overrides.referenceTemplate || 'FAJR-{ORDER}-{NAME}',
    goodsTotalZar: overrides.goodsTotalZar ?? 240,
    lots: overrides.lots ?? [
      {
        id: 'lot-1',
        name: 'Kenya AA',
        foreignPricePerBag: 12,
        gramsPerBag: 250,
        quantity: 1,
        shares: [
          { id: 'share-1', personId: 'person-1', shareGrams: 125, bagIndex: 0 },
          { id: 'share-2', personId: 'person-2', shareGrams: 125, bagIndex: 0 },
        ],
        bagAllocations: [
          {
            id: 'bag-0',
            bagIndex: 0,
            mode: 'split',
            participants: [
              { id: 'participant-1', personId: 'person-1', shareGrams: 125, sourceShareId: 'share-1' },
              { id: 'participant-2', personId: 'person-2', shareGrams: 125, sourceShareId: 'share-2' },
            ],
          },
        ],
      },
    ],
    fees: overrides.fees ?? [
      { id: 'fee-1', label: 'Shipping', allocationType: 'value_based', amountZar: 60 },
    ],
    payments: overrides.payments ?? {},
    isArchived: overrides.isArchived ?? true,
    createdAt: overrides.createdAt || '2026-03-18T00:00:00.000Z',
    updatedAt: overrides.updatedAt || '2026-03-18T00:00:00.000Z',
  };
}

function clickButtonByText(container: HTMLElement, label: string, index = 0) {
  const button = Array.from(container.querySelectorAll('button')).filter((candidate) => candidate.textContent?.includes(label))[index];
  if (!button) {
    throw new Error(`Could not find button with label "${label}".`);
  }

  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

describe('HistoryPage', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.stubGlobal('scrollTo', vi.fn());
    mockStoreState.people = people;
    mockStoreState.orders = [makeOrder()];
    mockStoreState.deleteOrder = vi.fn();
    mockStoreState.createOrder = vi.fn();
    mockStoreState.updateOrder = vi.fn().mockResolvedValue(undefined);
    mockStoreState.setOrderWizardStep = vi.fn();
    mockStoreState.setOrderProtectionOpen = vi.fn();
    mockStoreState.exportJSON = vi.fn(() => '{}');
    mockStoreState.importJSON = vi.fn();
    mockStoreState.setLastExportDate = vi.fn();
    mockStoreState.verifyOrderPin = vi.fn();
    mockStoreState.unlockedOrderIds = new Set<string>();
    mockStoreState.sessionUi = {
      orderWizardSteps: {},
      orderProtectionOpen: {},
    };
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('edits the same saved past order in place without moving it back to active orders', async () => {
    act(() => {
      root.render(<HistoryPage />);
    });

    clickButtonByText(container, 'Edit order');

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Editing saved order');
    expect(mockStoreState.updateOrder).not.toHaveBeenCalledWith('order-1', { isArchived: false });
  });
});
