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
import { RoasterCurrencyField } from './RoasterCurrencyField';
import { calculate } from '../../lib/calculations';
import { BagAssignPanel } from './BagAssignPanel';
import { LotEditorForm, type LotFormState } from './LotEditorForm';
import { OrderPage } from '../pages/OrderPage';
import { HistoryPage } from '../pages/HistoryPage';
import { PeoplePage } from '../pages/PeoplePage';
import { MyStatsPage } from '../pages/MyStatsPage';
import { SettingsPage } from '../pages/SettingsPage';
import { RoasterPicker } from '../roaster/RoasterPicker';
import { AuthPage } from '../auth/AuthPage';
import { PendingAccess } from '../auth/PendingAccess';

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
  createOrder: vi.fn().mockResolvedValue(undefined),
  addPerson: vi.fn().mockResolvedValue({ id: 'person-new', name: 'New Person' }),
  updatePerson: vi.fn().mockResolvedValue(undefined),
  deletePerson: vi.fn().mockResolvedValue(undefined),
  createRoaster: vi.fn(),
  setCurrentOrderId: vi.fn(),
  flushOrderWrites: vi.fn().mockResolvedValue(undefined),
  settings: {
    theme: 'emerald' as const,
    themeMode: 'light' as const,
    lastExportDate: '2026-03-20T10:00:00.000Z',
  },
  sessionUi: { orderWizardSteps: {} as Record<string, 'setup' | 'coffees' | 'goods' | 'summary' | 'invoices'> },
  currentOrderId: 'order-1',
  activeOrderIds: ['order-1'],
  linkResolution: { status: 'ready', person: null },
  fetchWorkspaceMembers: vi.fn().mockResolvedValue(undefined),
  workspaceMembers: [],
  exportJSON: vi.fn().mockReturnValue('{}'),
  importJSON: vi.fn().mockResolvedValue(undefined),
  setLastExportDate: vi.fn(),
  setTheme: vi.fn(),
  setThemeMode: vi.fn(),
  signOut: vi.fn(),
  setOrderWizardStep: vi.fn(),
  error: null,
  isSyncing: false,
};

vi.mock('../../store/appStore', () => ({
  useAppStore: Object.assign(
    (selector?: (s: typeof mockStoreState) => unknown) => (selector ? selector(mockStoreState) : mockStoreState),
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

  it('RoasterCurrencyField does not render banned words', () => {
    act(() => {
      root.render(<RoasterCurrencyField value="EUR" onChange={vi.fn()} />);
    });
    const trigger = container.querySelector('.roaster-currency-trigger') as HTMLButtonElement;
    act(() => {
      trigger.click();
    });
    const text = extractVisibleText(container);
    assertNoBannedWords('RoasterCurrencyField', text);
  });

  it('BagAssignPanel does not render banned words', () => {
    act(() => {
      root.render(
        <BagAssignPanel
          bag={{ id: 'b-1', splitMode: 'unassigned', buyers: [] }}
          bagIndex={0}
          bagSize={250}
          people={people}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      );
    });
    const text = extractVisibleText(container);
    assertNoBannedWords('BagAssignPanel', text);
  });

  it('LotEditorForm does not render banned words', () => {
    const formState: LotFormState = {
      name: 'Kenya AA',
      foreignPricePerBag: '18.50',
      gramsPerBag: '250',
      initialBagCount: '1',
      selectedBuyerIds: [],
      bags: [],
    };
    act(() => {
      root.render(
        <LotEditorForm
          form={formState}
          error=""
          isNew={true}
          currencyCode="EUR"
          onChange={vi.fn()}
          onSaveLater={vi.fn()}
          onCancel={vi.fn()}
        />
      );
    });
    const text = extractVisibleText(container);
    assertNoBannedWords('LotEditorForm', text);
  });

  it('OrderPage does not render banned words', () => {
    act(() => {
      root.render(<OrderPage onNavigateToHistory={vi.fn()} />);
    });
    const text = extractVisibleText(container);
    assertNoBannedWords('OrderPage', text);
  });

  it('HistoryPage does not render banned words', () => {
    act(() => {
      root.render(<HistoryPage />);
    });
    const text = extractVisibleText(container);
    assertNoBannedWords('HistoryPage', text);
  });

  it('PeoplePage does not render banned words', () => {
    act(() => {
      root.render(<PeoplePage />);
    });
    const text = extractVisibleText(container);
    assertNoBannedWords('PeoplePage', text);
  });

  it('MyStatsPage does not render banned words', () => {
    act(() => {
      root.render(<MyStatsPage />);
    });
    const text = extractVisibleText(container);
    assertNoBannedWords('MyStatsPage', text);
  });

  it('SettingsPage does not render banned words', () => {
    act(() => {
      root.render(<SettingsPage />);
    });
    const text = extractVisibleText(container);
    assertNoBannedWords('SettingsPage', text);
  });

  it('RoasterPicker does not render banned words', () => {
    act(() => {
      root.render(
        <RoasterPicker
          orders={[]}
          roasters={[]}
          selectedRoasterId={null}
          selectedRoasterSnapshot={null}
          featureStatus="ready"
          canManageRoasters={true}
          onSelectRoaster={vi.fn()}
          onCreateRoaster={vi.fn().mockResolvedValue({ id: 'r-1', name: 'Roaster 1' })}
        />
      );
    });
    const text = extractVisibleText(container);
    assertNoBannedWords('RoasterPicker', text);
  });

  it('AuthPage does not render banned words', () => {
    act(() => {
      root.render(<AuthPage />);
    });
    const text = extractVisibleText(container);
    assertNoBannedWords('AuthPage', text);
  });

  it('PendingAccess does not render banned words', () => {
    act(() => {
      root.render(<PendingAccess />);
    });
    const text = extractVisibleText(container);
    assertNoBannedWords('PendingAccess', text);
  });
});
