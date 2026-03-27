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

import { BagCard, CoffeeLotsSection } from './CoffeeLotsSection';

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

function makeBag(overrides: Partial<Bag> = {}): Bag {
  return {
    id: overrides.id || `bag-${Math.random().toString(36).slice(2)}`,
    splitMode: overrides.splitMode ?? 'unassigned',
    buyers: overrides.buyers ?? [],
  };
}

function Harness({ initialBags }: { initialBags: Bag[] }) {
  const [bags, setBags] = useState(initialBags);

  return (
    <div>
      {bags.map((bag, bagIndex) => (
        <BagCard
          key={bag.id}
          bag={bag}
          bags={bags}
          bagIndex={bagIndex}
          gramsPerBag={250}
          people={people}
          recentBuyerIds={[]}
          canRemove={bags.length > 1}
          onChange={(nextBags: Bag[]) => setBags(nextBags)}
          onRemove={() => undefined}
          onAddNewBuyer={() => undefined}
        />
      ))}
    </div>
  );
}

function makeOrder(lots: Order['lots']): Order {
  return {
    id: 'order-1',
    workspaceId: 'workspace-1',
    name: 'March Drop',
    orderDate: '2026-03-18',
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

  mockStoreState.people = people;
  mockStoreState.addPerson = vi.fn();
  mockStoreState.updateOrder = vi.fn(async (_orderId: string, patch: Partial<Order>) => {
    setOrder((current) => ({ ...current, ...patch }));
  });

  return <CoffeeLotsSection order={order} />;
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

function setSelectValue(select: HTMLSelectElement, value: string) {
  act(() => {
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('BagCard', () => {
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

  it('shows quick-assign buttons for unassigned bags', () => {
    act(() => {
      root.render(<Harness initialBags={[makeBag()]} />);
    });

    expect(container.textContent).toContain('Split equally');
    expect(container.textContent).toContain('Custom split');
    expect(container.querySelector('select')).toBeTruthy();
  });

  it('assigns full bag when a person is selected from the dropdown', () => {
    act(() => {
      root.render(<Harness initialBags={[makeBag()]} />);
    });

    const select = container.querySelector('select') as HTMLSelectElement;
    setSelectValue(select, 'person-1');

    // Should now show Alice as assigned (collapsed or full mode)
    expect(container.textContent).toContain('Alice');
    expect(container.textContent).toContain('Full bag');
  });

  it('starts equal split mode with two buyer slots', () => {
    act(() => {
      root.render(<Harness initialBags={[makeBag()]} />);
    });

    clickButtonByText(container, 'Split equally');

    expect(container.textContent).toContain('Equal split');
    expect(container.querySelectorAll('.buyer-row')).toHaveLength(2);
  });
});

describe('CoffeeLotsSection accordion flow', () => {
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

  it('collapses previous lots when adding a new coffee and keeps only one lot expanded at a time', () => {
    act(() => {
      root.render(<CoffeeLotsHarness initialOrder={makeOrder([
        makeLot({ id: 'lot-1', name: 'Kenya AA' }),
        makeLot({
          id: 'lot-2',
          name: 'Burundi Natural',
          shares: [{ id: 'share-2', personId: 'person-2', shareGrams: 250, bagIndex: 0 }],
          bags: [
            {
              id: 'bag-1',
              splitMode: 'full',
              buyers: [{ id: 'buyer-2', personId: 'person-2', grams: 250 }],
            },
          ],
          bagAllocations: [
            {
              id: 'bag-1',
              bagIndex: 0,
              mode: 'single',
              participants: [{ id: 'bp-2', personId: 'person-2', shareGrams: 250, sourceShareId: 'share-2' }],
            },
          ],
        }),
      ])} />);
    });

    expect(container.querySelectorAll('.bag-card')).toHaveLength(1);
    expect(container.textContent).toContain('Burundi Natural');

    clickButtonByText(container, 'Expand');

    expect(container.querySelectorAll('.bag-card')).toHaveLength(1);
    expect(container.textContent).toContain('Kenya AA');

    clickButtonByText(container, 'Add another coffee lot');

    expect(container.querySelectorAll('.bag-card')).toHaveLength(0);
    expect(container.querySelectorAll('.coffee-lot-collapsed')).toHaveLength(2);
    expect(container.textContent).toContain('New coffee lot');
    expect(container.textContent).toContain('Alice');
    expect(container.textContent).toContain('Bilal');
  });
});
