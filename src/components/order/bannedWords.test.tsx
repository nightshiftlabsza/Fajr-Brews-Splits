/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Order, Person } from '../../types';
import { OrderSetup } from './OrderSetup';
import { CoffeeLotsSection } from './CoffeeLotsSection';
import { GoodsAndFees } from './GoodsAndFees';
import { OrderSummary } from './OrderSummary';
import { StepTabs } from './StepTabs';
import { SettlementPacks } from './SettlementPacks';
import { CoffeeCostSummary } from './CoffeeCostSummary';
import { calculate } from '../../lib/calculations';

const mockStoreState = {
  people: [] as Person[],
  roasters: [],
  orders: [] as Order[],
  user: { id: 'user-1', email: 'alice@example.com' },
  linkedPersonId: 'person-1',
  memberRole: 'owner',
  accessStatus: 'member',
  roasterFeatureStatus: 'ready',
  roasterFeatureMessage: null,
  updateOrder: vi.fn().mockResolvedValue(undefined),
  deleteOrder: vi.fn().mockResolvedValue(undefined),
  addPerson: vi.fn().mockResolvedValue({ id: 'person-new', name: 'New Person' }),
  createRoaster: vi.fn(),
  setCurrentOrderId: vi.fn(),
  flushOrderWrites: vi.fn().mockResolvedValue(undefined),
};

vi.mock('../../store/appStore', () => ({
  useAppStore: Object.assign(
    () => mockStoreState,
    {
      getState: vi.fn(() => mockStoreState),
      setState: vi.fn(),
    },
  ),
}));

const people: Person[] = [
  {
    id: 'person-1',
    workspaceId: 'ws-1',
    name: 'Alice',
    email: 'alice@example.com',
    createdAt: '2026-03-18T00:00:00.000Z',
    updatedAt: '2026-03-18T00:00:00.000Z',
  },
  {
    id: 'person-2',
    workspaceId: 'ws-1',
    name: 'Bilal',
    email: 'bilal@example.com',
    createdAt: '2026-03-18T00:00:00.000Z',
    updatedAt: '2026-03-18T00:00:00.000Z',
  },
];

function makeTestOrder(): Order {
  return {
    id: 'order-1',
    workspaceId: 'ws-1',
    name: 'March Drop',
    orderDate: '2026-03-18',
    roasterId: null,
    roasterSnapshot: null,
    payerId: 'person-1',
    payerBank: { bankName: 'FNB', accountNumber: '12345', beneficiary: 'Alice' },
    referenceTemplate: 'FAJR-{ORDER}-{NAME}',
    goodsTotalZar: 450,
    lots: [
      {
        id: 'lot-1',
        name: 'Kenya Nyeri AA',
        foreignPricePerBag: 18.5,
        gramsPerBag: 250,
        quantity: 1,
        shares: [{ id: 's-1', personId: 'person-1', shareGrams: 250, bagIndex: 0 }],
        bags: [
          {
            id: 'b-1',
            splitMode: 'full',
            buyers: [{ id: 'buyer-1', personId: 'person-1', grams: 250 }],
          },
        ],
        bagAllocations: [
          {
            id: 'ba-1',
            bagIndex: 0,
            mode: 'single',
            participants: [{ id: 'p-1', personId: 'person-1', shareGrams: 250, sourceShareId: 's-1' }],
          },
        ],
      },
    ],
    fees: [
      {
        id: 'fee-1',
        label: 'Shipping',
        amountZar: 50,
        allocationType: 'proportional_by_value',
      },
    ],
    payments: {},
    isArchived: false,
    createdAt: '2026-03-18T00:00:00.000Z',
    updatedAt: '2026-03-18T00:00:00.000Z',
  };
}

const BANNED_PATTERNS = [
  { name: 'list price share', regex: /list\s+price\s+share/i },
  { name: 'lot (as standalone word)', regex: /\b(lot|lots)\b/i },
  { name: 'ratio', regex: /\bratio\b/i },
  { name: 'allocation', regex: /\b(allocation|allocations|allocated)\b/i },
  { name: 'snapshot', regex: /\bsnapshot\b/i },
  { name: 'settlement', regex: /\b(settlement|settlements)\b/i },
  { name: 'projection', regex: /\bprojection\b/i },
  { name: 'auto', regex: /\bauto\b/i },
  { name: 'reconcile', regex: /\breconcile\b/i },
  { name: 'per-gram price', regex: /(\/\s*g\b|per\s+gram)/i },
];

function extractVisibleText(rootElement: HTMLElement): string {
  // Clone element, remove style tags, script tags
  const clone = rootElement.cloneNode(true) as HTMLElement;
  const styles = clone.querySelectorAll('style, script');
  styles.forEach((s) => s.remove());
  return clone.textContent || '';
}

function assertNoBannedWords(componentName: string, text: string) {
  for (const { name, regex } of BANNED_PATTERNS) {
    const match = text.match(regex);
    if (match) {
      throw new Error(
        `Banned wording "${name}" (matched "${match[0]}") was found in rendered ${componentName}:\n"${text.slice(Math.max(0, match.index! - 40), match.index! + 60)}"`
      );
    }
  }
}

describe('Banned words in rendered order components', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    mockStoreState.people = people;
    mockStoreState.orders = [makeTestOrder()];
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('StepTabs does not render banned words', () => {
    const order = makeTestOrder();
    act(() => {
      root.render(
        <StepTabs
          order={order}
          currentStep="setup"
          onSelectStep={vi.fn()}
        />
      );
    });
    const text = extractVisibleText(container);
    assertNoBannedWords('StepTabs', text);
  });

  it('OrderSetup does not render banned words', () => {
    const order = makeTestOrder();
    act(() => {
      root.render(<OrderSetup order={order} />);
    });
    const text = extractVisibleText(container);
    assertNoBannedWords('OrderSetup', text);
  });

  it('CoffeeLotsSection does not render banned words', () => {
    const order = makeTestOrder();
    act(() => {
      root.render(<CoffeeLotsSection order={order} onContinue={vi.fn()} />);
    });
    const text = extractVisibleText(container);
    assertNoBannedWords('CoffeeLotsSection', text);
  });

  it('GoodsAndFees does not render banned words', () => {
    const order = makeTestOrder();
    act(() => {
      root.render(<GoodsAndFees order={order} />);
    });
    const text = extractVisibleText(container);
    assertNoBannedWords('GoodsAndFees', text);
  });

  it('CoffeeCostSummary does not render banned words', () => {
    const order = makeTestOrder();
    const result = calculate(order, { 'person-1': 'Alice', 'person-2': 'Bilal' });
    act(() => {
      root.render(<CoffeeCostSummary result={result} />);
    });
    const text = extractVisibleText(container);
    assertNoBannedWords('CoffeeCostSummary', text);
  });

  it('SettlementPacks does not render banned words', () => {
    const order = makeTestOrder();
    const result = calculate(order, { 'person-1': 'Alice', 'person-2': 'Bilal' });
    act(() => {
      root.render(
        <SettlementPacks
          order={order}
          people={people}
          result={result}
          paymentEditingEnabled={true}
        />
      );
    });
    const text = extractVisibleText(container);
    assertNoBannedWords('SettlementPacks', text);
  });

  it('OrderSummary does not render banned words', () => {
    const order = makeTestOrder();
    act(() => {
      root.render(
        <OrderSummary
          order={order}
          onJumpToStep={vi.fn()}
          onFinalize={vi.fn()}
        />
      );
    });
    const text = extractVisibleText(container);
    assertNoBannedWords('OrderSummary', text);
  });
});
