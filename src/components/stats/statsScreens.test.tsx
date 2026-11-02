/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Order, Person, PersonLinkResolution, Roaster } from '../../types';
import { YearInCoffee } from './YearInCoffee';
import { YearPicker } from './YearPicker';
import { MonthlyChart } from './MonthlyChart';
import { CameBackToList } from './CameBackToList';
import { MyStatsPage } from '../pages/MyStatsPage';
import { summarisePeriod } from '../../lib/yearInCoffee';
import { calculateMyStatsSummary } from '../../lib/myStats';

const mockStoreState = {
  orders: [] as Order[],
  roasters: [] as Roaster[],
  people: [] as Person[],
  linkedPersonId: 'person-1' as string | null,
  linkResolution: {
    status: 'linked',
    linkedPersonId: 'person-1',
    matchedBy: 'manual',
    person: { personId: 'person-1', name: 'Amina', matchReason: 'email' },
    candidates: [],
  } as PersonLinkResolution,
  isLoading: false,
};

vi.mock('../../store/appStore', () => ({
  useAppStore: () => mockStoreState,
}));

const roasters: Roaster[] = [
  {
    id: 'roaster-1',
    workspaceId: 'workspace-1',
    name: 'Father Coffee',
    logoUrl: 'https://example.com/father.png',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'roaster-2',
    workspaceId: 'workspace-1',
    name: 'Rosetta',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
];

const personNames = { 'person-1': 'Amina' };

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: overrides.id ?? 'order-1',
    workspaceId: 'workspace-1',
    name: overrides.name ?? 'Order 1',
    orderDate: overrides.orderDate ?? '2026-03-10',
    roasterId: 'roasterId' in overrides ? overrides.roasterId! : 'roaster-1',
    roasterSnapshot: 'roasterSnapshot' in overrides ? overrides.roasterSnapshot! : {
      id: 'roaster-1',
      name: 'Father Coffee',
      logoUrl: 'https://example.com/father.png',
    },
    payerId: overrides.payerId ?? 'person-1',
    payerBank: overrides.payerBank ?? { bankName: '', accountNumber: '', beneficiary: '' },
    referenceTemplate: overrides.referenceTemplate ?? 'FAJR-{ORDER}-{NAME}',
    goodsTotalZar: overrides.goodsTotalZar ?? 300,
    lots: overrides.lots ?? [
      {
        id: 'l-1',
        name: 'Kenya AA',
        foreignPricePerBag: 15,
        gramsPerBag: 250,
        quantity: 1,
        shares: [{ id: 's1', personId: 'person-1', shareGrams: 250, bagIndex: 0 }],
        bags: [{ id: 'b1', splitMode: 'full', buyers: [{ id: 'bb1', personId: 'person-1', grams: 250 }] }],
      },
    ],
    fees: overrides.fees ?? [],
    payments: overrides.payments ?? {},
    status: overrides.status ?? 'completed',
    isArchived: overrides.isArchived ?? false,
    createdAt: overrides.createdAt ?? '2026-03-10T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-03-10T00:00:00.000Z',
  };
}

const STATS_BANNED_WORDS = [
  { name: 'finalized', regex: /\bfinalized\b/i },
  { name: 'ZAR share', regex: /ZAR\s+share/i },
  { name: 'lot (standalone)', regex: /\b(lot|lots)\b/i },
  { name: '250g eq', regex: /250g\s+eq/i },
  { name: 'participated', regex: /\bparticipated\b/i },
  { name: 'settled by the organiser', regex: /settled\s+by\s+the\s+organiser/i },
  { name: 'ledger', regex: /\bledger\b/i },
  { name: 'allocated', regex: /\b(allocation|allocations|allocated)\b/i },
];

function assertNoStatsBannedWords(componentName: string, text: string) {
  for (const { name, regex } of STATS_BANNED_WORDS) {
    const match = text.match(regex);
    if (match) {
      throw new Error(
        `Banned word "${name}" (matched "${match[0]}") was found in ${componentName}:\n"${text.slice(Math.max(0, match.index! - 40), match.index! + 60)}"`,
      );
    }
  }
}

describe('Lane T: Stats Screens & Wording Test Suite', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    mockStoreState.linkedPersonId = 'person-1';
    mockStoreState.orders = [];
    mockStoreState.roasters = roasters;
    mockStoreState.people = [{ id: 'person-1', name: 'Amina', workspaceId: 'w-1', createdAt: '', updatedAt: '' }];
    mockStoreState.isLoading = false;
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('1. YearPicker lists only years with counted orders, newest first', () => {
    act(() => {
      root.render(
        <YearPicker
          years={['2026', '2025', '2023']}
          selectedRange={{ preset: 'all' }}
          currentYear="2026"
          orderCountByYear={{ '2026': 4, '2025': 2, '2023': 1 }}
          totalOrdersCount={7}
          onSelectYear={vi.fn()}
          onSelectRange={vi.fn()}
        />,
      );
    });

    // Open dropdown
    const trigger = container.querySelector('.stats-picker-trigger') as HTMLButtonElement;
    act(() => {
      trigger.click();
    });

    const rows = container.querySelectorAll('.stats-sheet-row');
    const texts = Array.from(rows).map((r) => r.textContent || '');

    expect(texts[0]).toContain('All time');
    expect(texts[1]).toContain('2026');
    expect(texts[1]).toContain('so far');
    expect(texts[2]).toContain('2025');
    expect(texts[3]).toContain('2023');
  });

  it('2. YearPicker selection updates selected year and changes numbers', () => {
    const handleSelect = vi.fn();
    act(() => {
      root.render(
        <YearPicker
          years={['2026', '2025']}
          selectedRange={{ preset: 'all' }}
          currentYear="2026"
          totalOrdersCount={5}
          onSelectYear={handleSelect}
          onSelectRange={vi.fn()}
        />,
      );
    });

    const trigger = container.querySelector('.stats-picker-trigger') as HTMLButtonElement;
    act(() => {
      trigger.click();
    });

    const year2025Btn = Array.from(container.querySelectorAll('.stats-sheet-row')).find((b) =>
      b.textContent?.includes('2025'),
    ) as HTMLButtonElement;
    expect(year2025Btn).toBeTruthy();

    act(() => {
      year2025Btn.click();
    });

    expect(handleSelect).toHaveBeenCalledWith('2025');
  });

  it('2b. YearPicker with selectedYear displays year in trigger and marks that year active with checkmark', () => {
    act(() => {
      root.render(
        <YearPicker
          years={['2026', '2025']}
          selectedRange={{ preset: 'all' }}
          selectedYear="2025"
          currentYear="2026"
          totalOrdersCount={5}
          onSelectYear={vi.fn()}
          onSelectRange={vi.fn()}
        />,
      );
    });

    const trigger = container.querySelector('.stats-picker-trigger') as HTMLButtonElement;
    expect(trigger.textContent).toContain('2025');

    act(() => {
      trigger.click();
    });

    const allTimeRow = Array.from(container.querySelectorAll('.stats-sheet-row')).find((b) =>
      b.textContent?.includes('All time'),
    );
    expect(allTimeRow?.classList.contains('is-active')).toBe(false);

    const year2025Btn = Array.from(container.querySelectorAll('.stats-sheet-row')).find((b) =>
      b.textContent?.includes('2025'),
    );
    expect(year2025Btn?.classList.contains('is-active')).toBe(true);
    expect(year2025Btn?.textContent).toContain('✓');
  });

  it('3. YearInCoffee renders all 5 chapters for a multi-order year', () => {
    const multiOrders = [
      makeOrder({ id: 'o1', orderDate: '2026-01-15' }),
      makeOrder({ id: 'o2', orderDate: '2026-03-20', roasterId: 'roaster-2', roasterSnapshot: { id: 'roaster-2', name: 'Rosetta' } }),
      makeOrder({ id: 'o3', orderDate: '2026-05-10' }),
      makeOrder({ id: 'o4', orderDate: '2026-07-22' }),
    ];

    act(() => {
      root.render(
        <YearInCoffee
          orders={multiOrders}
          personId="person-1"
          personNames={personNames}
          roasters={roasters}
          initialYear="2026"
          onBack={vi.fn()}
        />,
      );
    });

    expect(container.querySelector('#chapter-1')).toBeTruthy();
    expect(container.querySelector('#chapter-2')).toBeTruthy();
    expect(container.querySelector('#chapter-3')).toBeTruthy();
    expect(container.querySelector('#chapter-4')).toBeTruthy();
    expect(container.querySelector('#chapter-5')).toBeTruthy();
    expect(container.textContent).toContain('01 · Your year');
    expect(container.textContent).toContain('02 · Your favourite roaster');
    expect(container.textContent).toContain('03 · Coffees you tried');
    expect(container.textContent).toContain('04 · Your months');
    expect(container.textContent).toContain('05 · Milestones');
  });

  it('4. Chapters omitted correctly for a one-order year', () => {
    const singleOrder = [makeOrder({ id: 'o-single', orderDate: '2026-02-14' })];

    act(() => {
      root.render(
        <YearInCoffee
          orders={singleOrder}
          personId="person-1"
          personNames={personNames}
          roasters={roasters}
          initialYear="2026"
          onBack={vi.fn()}
        />,
      );
    });

    expect(container.querySelector('#chapter-1')).toBeTruthy();
    // Chapters 2, 3, 4 are omitted for a 1-order year
    expect(container.querySelector('#chapter-2')).toBeNull();
    expect(container.querySelector('#chapter-3')).toBeNull();
    expect(container.querySelector('#chapter-4')).toBeNull();
    // No "most" wording
    expect(container.textContent).not.toContain('You took the most coffee from them');
  });

  it('5. Monthly rhythm omits busiest month naming on tie', () => {
    // Jan has 2 orders, March has 2 orders -> tie!
    const tiedOrders = [2, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    act(() => {
      root.render(<MonthlyChart monthlyOrders={tiedOrders} busiestMonth={null} />);
    });

    expect(container.querySelector('.stats-badge-pill')).toBeNull();
    expect(container.textContent).not.toContain('Busiest:');
  });

  it('6. Monthly rhythm names busiest month when not tied', () => {
    const singleBestMonth = [1, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    act(() => {
      root.render(<MonthlyChart monthlyOrders={singleBestMonth} busiestMonth={3} />);
    });

    const pill = container.querySelector('.stats-badge-pill');
    expect(pill).toBeTruthy();
    expect(pill?.textContent).toContain('Busiest: March');
  });

  it('6b. MonthlyChart supports keyboard interaction (Enter / Space to select and show value)', () => {
    act(() => {
      root.render(<MonthlyChart monthlyOrders={[2, 4, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]} busiestMonth={2} />);
    });

    const marchCol = container.querySelector('[aria-label="March: 1 order"]') as HTMLDivElement;
    expect(marchCol).toBeTruthy();

    act(() => {
      marchCol.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(container.querySelector('.stats-month-inspector')?.textContent).toContain('March: 1 order');
  });

  it('7. Both Classic (emerald) and Modern (yinmn) themes render properly', () => {
    const orders = [makeOrder()];

    // Test Classic emerald
    document.documentElement.setAttribute('data-theme', 'emerald');
    document.documentElement.setAttribute('data-mode', 'light');

    act(() => {
      root.render(
        <YearInCoffee
          orders={orders}
          personId="person-1"
          personNames={personNames}
          roasters={roasters}
          onBack={vi.fn()}
        />,
      );
    });
    expect(container.textContent).toContain('What you took from the orders this year.');

    // Test Modern yinmn dark
    document.documentElement.setAttribute('data-theme', 'yinmn');
    document.documentElement.setAttribute('data-mode', 'dark');

    act(() => {
      root.render(
        <YearInCoffee
          orders={orders}
          personId="person-1"
          personNames={personNames}
          roasters={roasters}
          onBack={vi.fn()}
        />,
      );
    });
    expect(container.textContent).toContain('What you took from the orders this year.');
  });

  it('8. Every control in stats screens has an accessible name', () => {
    mockStoreState.orders = [
      makeOrder({ id: 'o-1' }),
      makeOrder({ id: 'o-2', orderDate: '2026-04-10' }),
    ];

    act(() => {
      root.render(<MyStatsPage />);
    });

    const buttons = container.querySelectorAll('button');
    buttons.forEach((btn) => {
      const name = btn.textContent?.trim() || btn.getAttribute('aria-label') || btn.getAttribute('title');
      expect(Boolean(name)).toBe(true);
    });
  });

  it('9. No banned words in any stats component', () => {
    const testOrders = [
      makeOrder({ id: 'o-1', name: 'Kenya AA Harvest' }),
      makeOrder({ id: 'o-2', orderDate: '2026-05-10', name: 'Ethiopia Guji Drop' }),
    ];

    // Check MyStatsPage
    mockStoreState.orders = testOrders;
    act(() => {
      root.render(<MyStatsPage />);
    });
    assertNoStatsBannedWords('MyStatsPage', container.textContent || '');

    // Check YearInCoffee
    act(() => {
      root.render(
        <YearInCoffee
          orders={testOrders}
          personId="person-1"
          personNames={personNames}
          roasters={roasters}
          onBack={vi.fn()}
        />,
      );
    });
    assertNoStatsBannedWords('YearInCoffee', container.textContent || '');

    // Check YearPicker
    act(() => {
      root.render(
        <YearPicker
          years={['2026']}
          selectedRange={{ preset: 'all' }}
          currentYear="2026"
          totalOrdersCount={2}
          onSelectYear={vi.fn()}
          onSelectRange={vi.fn()}
        />,
      );
    });
    assertNoStatsBannedWords('YearPicker', container.textContent || '');

    // Check MonthlyChart
    act(() => {
      root.render(<MonthlyChart monthlyOrders={[1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]} busiestMonth={2} />);
    });
    assertNoStatsBannedWords('MonthlyChart', container.textContent || '');

    // Check CameBackToList
    act(() => {
      root.render(
        <CameBackToList
          roasters={[{ id: 'r1', name: 'Father Coffee', orderCount: 2, grams: 500 }]}
        />,
      );
    });
    assertNoStatsBannedWords('CameBackToList', container.textContent || '');
  });

  it('10. MonthlyChart letters are rendered in their own row below bars and busiest month is bold', () => {
    act(() => {
      root.render(<MonthlyChart monthlyOrders={[1, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0]} busiestMonth={3} />);
    });

    const monthCols = container.querySelectorAll('.stats-month-col');
    expect(monthCols).toHaveLength(12);

    // Each column has bar-wrap first, then month-label below it
    monthCols.forEach((col) => {
      const children = Array.from(col.children);
      expect(children).toHaveLength(2);
      expect(children[0]?.classList.contains('stats-month-bar-wrap')).toBe(true);
      expect(children[1]?.classList.contains('stats-month-label')).toBe(true);
    });

    // March is busiest (index 2)
    const marchCol = monthCols[2];
    expect(marchCol?.classList.contains('is-busiest')).toBe(true);
    const marchLabel = marchCol?.querySelector('.stats-month-label');
    expect(marchLabel?.textContent).toBe('M');
  });

  it('11. YearInCoffee Chapter 1 uses plain text hairline rows (no nested shaded box)', () => {
    const orders = [
      makeOrder({ id: 'o-1', orderDate: '2026-01-10' }),
      makeOrder({ id: 'o-2', orderDate: '2026-03-15' }),
      makeOrder({ id: 'o-3', orderDate: '2026-05-20' }),
      makeOrder({ id: 'o-4', orderDate: '2026-07-25' }),
    ];

    act(() => {
      root.render(
        <YearInCoffee
          orders={orders}
          personId="person-1"
          personNames={personNames}
          roasters={roasters}
          onBack={vi.fn()}
        />,
      );
    });

    const ch1 = container.querySelector('#chapter-1');
    expect(ch1).toBeTruthy();
    expect(ch1?.querySelector('.yic-summary-plain-row')).toBeTruthy();
    expect(ch1?.querySelector('.yic-style-plain-row')).toBeTruthy();
    expect(ch1?.textContent).toContain('kg of coffee taken');
    expect(ch1?.textContent).toContain('Loyalist');
  });

  it('12. No non-null assertions (!) in stats source code files', () => {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');

    const filesToCheck = [
      path.resolve(__dirname, '../../lib/yearInCoffee.ts'),
      path.resolve(__dirname, 'MonthlyChart.tsx'),
      path.resolve(__dirname, 'YearInCoffee.tsx'),
      path.resolve(__dirname, 'YearPicker.tsx'),
      path.resolve(__dirname, '../pages/MyStatsPage.tsx'),
    ];

    // Regex matching non-null assertion ! (excluding !=, !==, !<variable>)
    const nonNullAssertionRegex = /([a-zA-Z0-9_\]\)])!/g;

    for (const filePath of filesToCheck) {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, lineIdx) => {
        // Strip string literals and comments
        const cleanLine = line.replace(/(['"`]).*?\1/g, '').replace(/\/\/.*$/, '');
        const matches = cleanLine.match(nonNullAssertionRegex);
        if (matches) {
          throw new Error(
            `Non-null assertion (!) found in ${path.basename(filePath)} at line ${lineIdx + 1}: "${line.trim()}"`,
          );
        }
      });
    }
  });

  it('13. totalSpent and totalSpentZar are completely removed from summaries', () => {
    const summary = summarisePeriod([]);
    expect('totalSpentZar' in summary).toBe(false);

    const myStats = calculateMyStatsSummary([]);
    expect('totalSpent' in myStats).toBe(false);
  });
});
