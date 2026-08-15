/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import type { Bag, Order, Person } from '../../types';

const mockStoreState = {
  people: [] as Person[],
  addPerson: vi.fn(),
  updateOrder: vi.fn(),
};

vi.mock('../../store/appStore', () => ({
  useAppStore: Object.assign(
    () => mockStoreState,
    {
      getState: vi.fn(),
      setState: vi.fn(),
    },
  ),
}));

import { CoffeeLotsSection } from './CoffeeLotsSection';

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
  {
    id: 'person-3',
    workspaceId: 'workspace-1',
    name: 'Cara',
    createdAt: '2026-03-18T00:00:00.000Z',
    updatedAt: '2026-03-18T00:00:00.000Z',
  },
];

function makeOrder(lots: Order['lots']): Order {
  return {
    id: 'order-1',
    workspaceId: 'workspace-1',
    name: 'March Drop',
    orderDate: '2026-03-18',
    roasterId: null,
    roasterSnapshot: null,
    payerId: 'person-1',
    payerBank: { bankName: '', accountNumber: '', beneficiary: '' },
    referenceTemplate: 'FAJR-{ORDER}-{NAME}',
    goodsTotalZar: 0,
    lots,
    fees: [],
    payments: {},
    isArchived: false,
    createdAt: '2026-03-18T00:00:00.000Z',
    updatedAt: '2026-03-18T00:00:00.000Z',
  };
}

function makeLot(orderLotOverrides: Partial<Order['lots'][number]> = {}): Order['lots'][number] {
  return {
    id: orderLotOverrides.id || 'lot-1',
    name: orderLotOverrides.name || 'Kenya AA',
    foreignPricePerBag: orderLotOverrides.foreignPricePerBag ?? 18.5,
    gramsPerBag: orderLotOverrides.gramsPerBag ?? 250,
    quantity: orderLotOverrides.quantity ?? 1,
    shares: orderLotOverrides.shares ?? [{ id: 'share-1', personId: 'person-1', shareGrams: 250, bagIndex: 0 }],
    bags: orderLotOverrides.bags ?? [
      {
        id: 'bag-0',
        splitMode: 'full',
        buyers: [{ id: 'buyer-1', personId: 'person-1', grams: 250 }],
      },
    ],
    bagAllocations: orderLotOverrides.bagAllocations ?? [
      {
        id: 'bag-0',
        bagIndex: 0,
        mode: 'single',
        participants: [{ id: 'bp-1', personId: 'person-1', shareGrams: 250, sourceShareId: 'share-1' }],
      },
    ],
  };
}

function CoffeeLotsHarness({ initialOrder }: { initialOrder: Order }) {
  const [order, setOrder] = useState(initialOrder);

  return (
    <CoffeeLotsSection
      order={order}
      onOrderChange={(patch: Partial<Order>) => {
        mockStoreState.updateOrder(order.id, patch);
        setOrder((current) => ({ ...current, ...patch }));
      }}
    />
  );
}

function clickButtonByText(container: HTMLElement, label: string, within?: Element) {
  const scope = within ?? container;
  const button = Array.from(scope.querySelectorAll('button')).find((candidate) => candidate.textContent?.trim() === label);
  if (!button) {
    throw new Error(`Could not find button with label "${label}".`);
  }

  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

describe('CoffeeLotsSection', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    mockStoreState.people = people;
    mockStoreState.addPerson = vi.fn();
    mockStoreState.updateOrder = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders coffee lots with inline allocation', () => {
    act(() => {
      root.render(<CoffeeLotsHarness initialOrder={makeOrder([
        makeLot({
          id: 'lot-1',
          name: 'Kenya AA',
          bags: [{ id: 'bag-1', splitMode: 'full', buyers: [{ id: 'b-1', personId: 'person-1', grams: 250 }] }],
        }),
      ])} />);
    });

    expect(container.textContent).toContain('Kenya AA');
    expect(container.textContent).toContain('Alice (250g)');
    expect(container.textContent).toContain('✓ Allocated');
  });

  it('assigns unassigned coffee with quick buyer chip', () => {
    act(() => {
      root.render(<CoffeeLotsHarness initialOrder={makeOrder([
        makeLot({
          id: 'lot-1',
          name: 'Kenya AA',
          bags: [{ id: 'bag-1', splitMode: 'unassigned', buyers: [] }],
        }),
      ])} />);
    });

    expect(container.textContent).toContain('Unassigned');
    expect(container.textContent).toContain('+ Bilal');

    clickButtonByText(container, '+ Bilal');

    expect(mockStoreState.updateOrder).toHaveBeenCalled();
  });

  it('opens new coffee lot form when + Add Coffee is clicked', () => {
    act(() => {
      root.render(<CoffeeLotsHarness initialOrder={makeOrder([])} />);
    });

    expect(container.textContent).toContain('No coffees added yet');
    clickButtonByText(container, 'Add Coffee');

    expect(container.textContent).toContain('New Coffee');
  });

  it('renders disabled Next button with unassigned hint when bags are not yet allocated', () => {
    const onContinue = vi.fn();
    act(() => {
      root.render(
        <CoffeeLotsSection
          order={makeOrder([
            makeLot({
              id: 'lot-1',
              name: 'Kenya AA',
              bags: [{ id: 'bag-1', splitMode: 'unassigned', buyers: [] }],
            }),
          ])}
          onContinue={onContinue}
        />
      );
    });

    expect(container.textContent).toContain('1 bag needs a buyer');
    const nextBtn = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Next: Goods & Fees')
    );
    expect(nextBtn).toBeTruthy();
    expect(nextBtn?.disabled).toBe(true);

    if (nextBtn) {
      act(() => {
        nextBtn.click();
      });
    }
    expect(onContinue).not.toHaveBeenCalled();
  });

  it('renders enabled Next button when all bags are allocated and triggers onContinue', () => {
    const onContinue = vi.fn();
    act(() => {
      root.render(
        <CoffeeLotsSection
          order={makeOrder([
            makeLot({
              id: 'lot-1',
              name: 'Kenya AA',
              bags: [{ id: 'bag-1', splitMode: 'full', buyers: [{ id: 'b-1', personId: 'person-1', grams: 250 }] }],
            }),
            makeLot({
              id: 'lot-2',
              name: 'Pastel Hour',
              bags: [
                {
                  id: 'bag-2',
                  splitMode: 'equal',
                  buyers: [
                    { id: 'b-2', personId: 'person-1', grams: 125 },
                    { id: 'b-3', personId: 'person-2', grams: 125 },
                  ],
                },
              ],
            }),
          ])}
          onContinue={onContinue}
        />
      );
    });

    const nextBtn = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Next: Goods & Fees')
    );
    expect(nextBtn).toBeTruthy();
    expect(nextBtn?.disabled).toBe(false);
    expect(container.textContent).not.toContain('needs a buyer');

    act(() => {
      nextBtn?.click();
    });

    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('does not render bottom Next button when no coffee lots exist', () => {
    const onContinue = vi.fn();
    act(() => {
      root.render(
        <CoffeeLotsSection
          order={makeOrder([])}
          onContinue={onContinue}
        />
      );
    });

    const nextBtn = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Next: Goods & Fees')
    );
    expect(nextBtn).toBeUndefined();
  });
});
