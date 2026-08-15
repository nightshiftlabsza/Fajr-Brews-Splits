/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Order, Person, PersonLinkResolution } from '../../types';
import { generateOrderInvoicePDF } from '../../lib/pdf';

const mockStoreState = {
  orders: [] as Order[],
  people: [] as Person[],
  roasters: [],
  currentOrderId: null as string | null,
  linkedPersonId: null as string | null,
  linkResolution: {
    status: 'none',
    linkedPersonId: null,
    matchedBy: null,
    person: null,
    candidates: [],
  } as PersonLinkResolution,
  deleteOrder: vi.fn(),
  createOrder: vi.fn(),
  addPerson: vi.fn(),
  updateOrder: vi.fn(),
  flushOrderWrites: vi.fn(),
  setOrderWizardStep: vi.fn(),
  exportJSON: vi.fn(() => '{}'),
  importJSON: vi.fn(),
  setLastExportDate: vi.fn(),
  sessionUi: {
    orderWizardSteps: {} as Record<string, 'setup' | 'coffees' | 'goods' | 'summary'>,
  },
};

vi.mock('../../store/appStore', () => ({
  useAppStore: () => mockStoreState,
}));

vi.mock('../../lib/pdf', () => ({
  generateOrderInvoicePDF: vi.fn(),
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
    roasterId: overrides.roasterId ?? null,
    roasterSnapshot: overrides.roasterSnapshot ?? null,
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

function clickExactButtonByText(container: HTMLElement, label: string, index = 0) {
  const button = Array.from(container.querySelectorAll('button')).filter((candidate) => candidate.textContent?.trim() === label)[index];
  if (!button) {
    throw new Error(`Could not find button with exact label "${label}".`);
  }

  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function setInputValue(input: HTMLInputElement, value: string) {
  act(() => {
    const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    valueSetter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function setSelectValue(select: HTMLSelectElement, value: string) {
  act(() => {
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
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
    mockStoreState.roasters = [];
    mockStoreState.currentOrderId = null;
    mockStoreState.linkedPersonId = null;
    mockStoreState.linkResolution = {
      status: 'none',
      linkedPersonId: null,
      matchedBy: null,
      person: null,
      candidates: [],
    };
    mockStoreState.orders = [makeOrder()];
    mockStoreState.deleteOrder = vi.fn();
    mockStoreState.createOrder = vi.fn();
    mockStoreState.addPerson = vi.fn();
    mockStoreState.updateOrder = vi.fn().mockResolvedValue(undefined);
    mockStoreState.flushOrderWrites = vi.fn().mockResolvedValue(undefined);
    mockStoreState.setOrderWizardStep = vi.fn();
    mockStoreState.exportJSON = vi.fn(() => '{}');
    mockStoreState.importJSON = vi.fn();
    mockStoreState.setLastExportDate = vi.fn();
    mockStoreState.sessionUi = {
      orderWizardSteps: {},
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

  it('saves a historical edit back to the same order with coffee lots and bag allocations intact', async () => {
    const originalOrder = makeOrder();
    mockStoreState.orders = [originalOrder, makeOrder({ id: 'active-order', isArchived: false, name: 'Current Draft' })];

    act(() => {
      root.render(<HistoryPage />);
    });

    clickButtonByText(container, 'Edit order');
    clickButtonByText(container, 'Save changes');

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockStoreState.updateOrder).toHaveBeenCalledTimes(1);
    expect(mockStoreState.updateOrder).toHaveBeenCalledWith(
      'order-1',
      expect.objectContaining({
        isArchived: true,
        lots: expect.arrayContaining([
          expect.objectContaining({
            id: 'lot-1',
            bagAllocations: expect.arrayContaining([
              expect.objectContaining({
                id: 'bag-0',
                participants: expect.arrayContaining([
                  expect.objectContaining({ personId: 'person-1', shareGrams: 125 }),
                ]),
              }),
            ]),
          }),
        ]),
      }),
    );
    expect(mockStoreState.createOrder).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain('order has no coffee lots');
  });

  it('keeps lots and the current draft intact when adding a person while editing a historical order', async () => {
    const abdul: Person = {
      id: 'person-abdul',
      workspaceId: 'workspace-1',
      name: 'Abdul',
      createdAt: '2026-03-18T00:00:00.000Z',
      updatedAt: '2026-03-18T00:00:00.000Z',
    };
    const ahmed: Person = {
      id: 'person-ahmed',
      workspaceId: 'workspace-1',
      name: 'Ahmed',
      createdAt: '2026-03-18T00:00:00.000Z',
      updatedAt: '2026-03-18T00:00:00.000Z',
    };
    const savedOrder = makeOrder({
      id: 'saved-order',
      name: 'Saved Pastel Hour',
      payerId: 'person-abdul',
      lots: [
        {
          id: 'lot-pastel',
          name: 'Pastel Hour',
          foreignPricePerBag: 20,
          gramsPerBag: 250,
          quantity: 1,
          shares: [{ id: 'share-abdul', personId: 'person-abdul', shareGrams: 250, bagIndex: 0 }],
          bags: [
            {
              id: 'bag-pastel-1',
              splitMode: 'full',
              buyers: [{ id: 'buyer-abdul', personId: 'person-abdul', grams: 250 }],
            },
          ],
          bagAllocations: [
            {
              id: 'bag-pastel-1',
              bagIndex: 0,
              mode: 'single',
              participants: [{ id: 'participant-abdul', personId: 'person-abdul', shareGrams: 250, sourceShareId: 'share-abdul' }],
            },
          ],
        },
      ],
      fees: [],
      payments: { 'person-abdul': { status: 'paid', amountPaid: 300 } },
    });
    const currentDraft = makeOrder({ id: 'current-draft', name: 'Current Draft', isArchived: false });
    mockStoreState.people = [abdul];
    mockStoreState.orders = [savedOrder, currentDraft];
    mockStoreState.currentOrderId = currentDraft.id;
    mockStoreState.sessionUi = { orderWizardSteps: { 'saved-order': 'coffees' } };
    mockStoreState.addPerson = vi.fn(async () => {
      mockStoreState.people = [abdul, ahmed];
      return ahmed;
    });
    mockStoreState.updateOrder = vi.fn(async (orderId: string, patch: Partial<Order>) => {
      mockStoreState.orders = mockStoreState.orders.map((order) => (
        order.id === orderId ? { ...order, ...patch } : order
      ));
    });

    const currentDraftBefore = mockStoreState.orders.find((order) => order.id === currentDraft.id);

    act(() => {
      root.render(<HistoryPage />);
    });

    clickButtonByText(container, 'Edit order');
    clickButtonByText(container, 'Adjust allocation ⚙');
    clickExactButtonByText(container, '+ Add Person');

    const nameInput = container.querySelector('input[placeholder="Full name"]') as HTMLInputElement;
    setInputValue(nameInput, 'Ahmed');
    clickExactButtonByText(container, 'Add Person');

    await act(async () => {
      await Promise.resolve();
    });

    clickButtonByText(container, 'Save changes');

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockStoreState.addPerson).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ahmed' }));
    expect(mockStoreState.updateOrder).toHaveBeenCalledWith(
      'saved-order',
      expect.objectContaining({
        isArchived: true,
        lots: [
          expect.objectContaining({
            id: 'lot-pastel',
            name: 'Pastel Hour',
            bags: [
              expect.objectContaining({
                id: 'bag-pastel-1',
                buyers: [expect.objectContaining({ personId: 'person-ahmed', grams: 250 })],
              }),
            ],
            bagAllocations: [
              expect.objectContaining({
                participants: [expect.objectContaining({ personId: 'person-ahmed', shareGrams: 250 })],
              }),
            ],
          }),
        ],
      }),
    );
    expect(mockStoreState.createOrder).not.toHaveBeenCalled();
    expect(mockStoreState.currentOrderId).toBe('current-draft');
    expect(mockStoreState.orders.find((order) => order.id === currentDraft.id)).toBe(currentDraftBefore);
    expect(container.textContent).not.toContain('Order has no coffee lots');
  });

  it('adds a bag to a historical order in place without touching the current draft', async () => {
    const savedOrder = makeOrder({ id: 'saved-order', isArchived: true });
    const currentDraft = makeOrder({ id: 'current-draft', name: 'Current Draft', isArchived: false });
    mockStoreState.orders = [savedOrder, currentDraft];
    mockStoreState.currentOrderId = currentDraft.id;
    mockStoreState.sessionUi = { orderWizardSteps: { 'saved-order': 'coffees' } };
    mockStoreState.updateOrder = vi.fn(async (orderId: string, patch: Partial<Order>) => {
      mockStoreState.orders = mockStoreState.orders.map((order) => (
        order.id === orderId ? { ...order, ...patch } : order
      ));
    });
    const currentDraftBefore = mockStoreState.orders.find((order) => order.id === currentDraft.id);

    act(() => {
      root.render(<HistoryPage />);
    });

    clickButtonByText(container, 'Edit order');
    clickButtonByText(container, 'Adjust allocation ⚙');
    clickExactButtonByText(container, '+ Add Bag');

    clickButtonByText(container, '+ Alice');
    clickButtonByText(container, 'Save changes');

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockStoreState.updateOrder).toHaveBeenCalledWith(
      'saved-order',
      expect.objectContaining({
        isArchived: true,
        lots: [
          expect.objectContaining({
            id: 'lot-1',
            bags: expect.arrayContaining([
              expect.objectContaining({ buyers: expect.arrayContaining([expect.objectContaining({ personId: 'person-1' })]) }),
            ]),
            quantity: 2,
          }),
        ],
      }),
    );
    const savedPatch = mockStoreState.updateOrder.mock.calls[0][1] as Partial<Order>;
    expect(savedPatch.lots?.[0].bags).toHaveLength(2);
    expect(mockStoreState.createOrder).not.toHaveBeenCalled();
    expect(mockStoreState.currentOrderId).toBe('current-draft');
    expect(mockStoreState.orders.find((order) => order.id === currentDraft.id)).toBe(currentDraftBefore);
  });

  it('duplicates a saved order only through the explicit new-order action', async () => {
    const originalOrder = makeOrder({
      id: 'saved-order',
      name: 'Saved March Drop',
      payments: { 'person-1': { status: 'paid', amountPaid: 200 } },
    });
    mockStoreState.orders = [originalOrder];

    act(() => {
      root.render(<HistoryPage />);
    });

    clickButtonByText(container, 'Duplicate as new order');

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockStoreState.createOrder).toHaveBeenCalledTimes(1);
    expect(mockStoreState.createOrder).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Saved March Drop (copy)',
      status: 'planning',
      payments: {},
    }));
    expect(mockStoreState.updateOrder).not.toHaveBeenCalled();
    expect(mockStoreState.orders[0]).toBe(originalOrder);
  });

  it('removes the coffee summary card from past-order details and shows the full order invoice action', async () => {
    act(() => {
      root.render(<HistoryPage />);
    });

    clickButtonByText(container, 'Open order');

    expect(container.textContent).not.toContain('Saved coffee totals');
    expect(container.textContent).toContain('Download full order invoice');
  });

  it('opens a finalized order directly without showing a PIN prompt', () => {
    act(() => {
      root.render(<HistoryPage />);
    });

    clickButtonByText(container, 'Open order');

    expect(container.textContent).toContain('Saved order');
    expect(container.textContent).not.toContain('Enter PIN');
    expect(container.textContent).not.toContain('Unlock');
  });

  it('downloads the full order invoice from past-order details', async () => {
    act(() => {
      root.render(<HistoryPage />);
    });

    clickButtonByText(container, 'Open order');
    clickButtonByText(container, 'Download full order invoice');

    await act(async () => {
      await Promise.resolve();
    });

    expect(generateOrderInvoicePDF).toHaveBeenCalledTimes(1);
    expect(generateOrderInvoicePDF).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'order-1' }),
      people,
      expect.objectContaining({
        totalOrderZar: expect.any(Number),
      }),
    );
  });

  it('keeps participant-only history scoped to the linked person record', () => {
    mockStoreState.linkedPersonId = 'person-1';
    mockStoreState.linkResolution = {
      status: 'linked',
      linkedPersonId: 'person-1',
      matchedBy: 'email',
      person: null,
      candidates: [],
    };
    mockStoreState.orders = [
      makeOrder({ id: 'order-1', isArchived: true }),
      makeOrder({
        id: 'order-2',
        name: 'Hidden Order',
        isArchived: true,
        payerId: 'person-2',
        lots: [
          {
            id: 'lot-2',
            name: 'Other',
            foreignPricePerBag: 12,
            gramsPerBag: 250,
            quantity: 1,
            shares: [{ id: 'share-3', personId: 'person-2', shareGrams: 250, bagIndex: 0 }],
          },
        ],
      }),
    ];

    act(() => {
      root.render(<HistoryPage participantOnly />);
    });

    expect(container.textContent).toContain('Saved March Drop');
    expect(container.textContent).not.toContain('Hidden Order');
  });

  it('shows linking guidance instead of a misleading empty archive when participant access is unresolved', () => {
    act(() => {
      root.render(<HistoryPage participantOnly />);
    });

    expect(container.textContent).toContain('Confirm your profile to see orders you joined');
    expect(container.textContent).not.toContain('Completed orders you were included in will appear here automatically.');
  });

  it('shows confirmation guidance for a single safe name match', () => {
    mockStoreState.linkResolution = {
      status: 'needs-confirmation',
      linkedPersonId: null,
      matchedBy: 'name',
      person: null,
      candidates: [
        {
          personId: 'person-1',
          name: 'Alice',
          matchReason: 'name',
        },
      ],
    };

    act(() => {
      root.render(<HistoryPage participantOnly />);
    });

    expect(container.textContent).toContain('We found a possible match for your account');
  });

  it('shows ambiguity guidance instead of guessing the participant profile', () => {
    mockStoreState.linkResolution = {
      status: 'ambiguous',
      linkedPersonId: null,
      matchedBy: null,
      person: null,
      candidates: [
        {
          personId: 'person-1',
          name: 'Alice',
          matchReason: 'name',
        },
        {
          personId: 'person-2',
          name: 'Alicia',
          matchReason: 'name',
        },
      ],
    };

    act(() => {
      root.render(<HistoryPage participantOnly />);
    });

    expect(container.textContent).toContain('We found more than one possible profile');
  });
});
