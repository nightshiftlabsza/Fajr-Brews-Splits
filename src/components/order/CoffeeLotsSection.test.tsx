/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import type { Order, Person } from '../../types';
import type { BagAllocationDraft } from '../../lib/orderWizard';

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

import { BagAssignmentCard, CoffeeLotsSection } from './CoffeeLotsSection';

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

function makeBag(overrides: Partial<BagAllocationDraft> = {}): BagAllocationDraft {
  return {
    id: overrides.id || `bag-${overrides.bagIndex ?? 0}`,
    bagIndex: overrides.bagIndex ?? 0,
    mode: overrides.mode ?? 'single',
    participants: overrides.participants ?? [],
  };
}

function Harness({ initialBags }: { initialBags: BagAllocationDraft[] }) {
  const [bags, setBags] = useState(initialBags);

  return (
    <div>
      {bags.map((bag, bagIndex) => (
        <BagAssignmentCard
          key={bag.id}
          bag={bag}
          bags={bags}
          bagIndex={bagIndex}
          gramsPerBag={250}
          people={people}
          recentBuyerIds={[]}
          onChange={(nextBags) => setBags(nextBags)}
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

function setInputValue(input: HTMLInputElement, value: string) {
  act(() => {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('BagAssignmentCard', () => {
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

  it('shows the split editor on the first click', () => {
    act(() => {
      root.render(<Harness initialBags={[makeBag({ bagIndex: 0 })]} />);
    });

    clickButtonByText(container, 'Split bag');

    expect(container.textContent).toContain('Back to single owner');
    expect(container.querySelectorAll('.buyer-row')).toHaveLength(1);
  });

  it('keeps split allocations while editing other bags in the same lot', () => {
    act(() => {
      root.render(<Harness initialBags={[makeBag({ bagIndex: 0 }), makeBag({ bagIndex: 1 })]} />);
    });

    const bagCards = container.querySelectorAll('.bag-card');
    const firstBag = bagCards[0];
    const secondBag = bagCards[1];

    clickButtonByText(container, 'Split bag', firstBag);

    let firstBagRows = firstBag.querySelectorAll('.buyer-row');
    setSelectValue(firstBagRows[0].querySelector('select') as HTMLSelectElement, 'person-1');
    clickButtonByText(container, 'Add buyer', firstBag);
    clickButtonByText(container, 'Split equally', firstBag);

    clickButtonByText(container, 'Split bag', secondBag);

    const persistedRows = firstBag.querySelectorAll('.buyer-row');
    const firstSelects = firstBag.querySelectorAll('select');
    const firstInputs = firstBag.querySelectorAll('input');

    expect(persistedRows).toHaveLength(2);
    expect((firstSelects[0] as HTMLSelectElement).value).toBe('person-1');
    expect((firstSelects[1] as HTMLSelectElement).value).toBe('person-2');
    expect((firstInputs[0] as HTMLInputElement).value).toBe('125');
    expect((firstInputs[1] as HTMLInputElement).value).toBe('125');
  });

  it('returns cleanly to single-owner mode after editing a split bag', () => {
    act(() => {
      root.render(<Harness initialBags={[makeBag({ bagIndex: 0 })]} />);
    });

    clickButtonByText(container, 'Split bag');

    let rows = container.querySelectorAll('.buyer-row');
    setSelectValue(rows[0].querySelector('select') as HTMLSelectElement, 'person-1');
    setInputValue(rows[0].querySelector('input') as HTMLInputElement, '125');
    clickButtonByText(container, 'Add buyer');

    rows = container.querySelectorAll('.buyer-row');
    setInputValue(rows[1].querySelector('input') as HTMLInputElement, '125');
    clickButtonByText(container, 'Back to single owner');

    expect(container.textContent).not.toContain('Back to single owner');
    expect(container.querySelectorAll('.buyer-row')).toHaveLength(0);
    expect((container.querySelector('select') as HTMLSelectElement).value).toBe('');
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
