import { describe, expect, it } from 'vitest';
import type { Order, Roaster } from '../types';
import {
  compareSamePeriod,
  countBagsSharedIn,
  daysInMonth,
  getCountedOrders,
  getCountedYears,
  isLeapYear,
  isOrderInDateRange,
  parseDateParts,
  resolveCanonicalRoaster,
  subtractCalendarMonths,
  summarisePeriod,
  validateStatsDateRange,
} from './yearInCoffee';

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

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: overrides.id ?? 'order-1',
    workspaceId: 'workspace-1',
    name: overrides.name ?? 'Saved Order',
    orderDate: overrides.orderDate ?? '2026-03-01',
    roasterId: 'roasterId' in overrides ? overrides.roasterId! : 'roaster-1',
    roasterSnapshot: 'roasterSnapshot' in overrides ? overrides.roasterSnapshot! : {
      id: 'roaster-1',
      name: 'Father Coffee',
      logoUrl: 'https://example.com/father.png',
    },
    payerId: overrides.payerId ?? 'person-1',
    payerBank: overrides.payerBank ?? { bankName: '', accountNumber: '', beneficiary: '' },
    referenceTemplate: overrides.referenceTemplate ?? 'FAJR-{ORDER}-{NAME}',
    goodsTotalZar: overrides.goodsTotalZar ?? 500,
    lots: overrides.lots ?? [
      {
        id: 'lot-1',
        name: 'Kenya AA',
        foreignPricePerBag: 15,
        gramsPerBag: 250,
        quantity: 1,
        shares: [
          { id: 'share-1', personId: 'person-1', shareGrams: 250, bagIndex: 0 },
        ],
        bags: [
          {
            id: 'bag-0',
            splitMode: 'full',
            buyers: [
              { id: 'buyer-1', personId: 'person-1', grams: 250 },
            ],
          },
        ],
      },
    ],
    fees: overrides.fees ?? [],
    payments: overrides.payments ?? {},
    status: overrides.status ?? 'completed',
    isArchived: overrides.isArchived ?? false,
    createdAt: overrides.createdAt ?? '2026-03-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-03-01T00:00:00.000Z',
  };
}

describe('yearInCoffee - Lane D metric calculations & audit fixes', () => {
  it('1. Month-end range: subtractCalendarMonths clamps days and avoids JS Date month rollover', () => {
    // 31 May minus 3 months in 2026 lands on 28 Feb (not early March)
    expect(subtractCalendarMonths('2026-05-31', 3)).toBe('2026-02-28');
    // Leap year 2024: 31 May minus 3 months lands on 29 Feb
    expect(subtractCalendarMonths('2024-05-31', 3)).toBe('2024-02-29');
    // 31 March minus 1 month lands on 28 Feb
    expect(subtractCalendarMonths('2026-03-31', 1)).toBe('2026-02-28');
    // 31 August minus 2 months lands on 30 June
    expect(subtractCalendarMonths('2026-08-31', 2)).toBe('2026-06-30');
    // Year boundary: 15 Jan minus 2 months lands in November previous year
    expect(subtractCalendarMonths('2026-01-15', 2)).toBe('2025-11-15');
  });

  it('2. A 1 kg bag shared by 4 people = 1 bag shared in and 250g taken', () => {
    const order = makeOrder({
      id: 'order-1kg',
      lots: [
        {
          id: 'lot-1kg',
          name: 'Colombia Geisha 1kg',
          foreignPricePerBag: 60,
          gramsPerBag: 1000,
          quantity: 1,
          shares: [
            { id: 's1', personId: 'person-1', shareGrams: 250, bagIndex: 0 },
            { id: 's2', personId: 'person-2', shareGrams: 250, bagIndex: 0 },
            { id: 's3', personId: 'person-3', shareGrams: 250, bagIndex: 0 },
            { id: 's4', personId: 'person-4', shareGrams: 250, bagIndex: 0 },
          ],
          bags: [
            {
              id: 'bag-1kg-0',
              splitMode: 'equal',
              buyers: [
                { id: 'b1', personId: 'person-1', grams: 250 },
                { id: 'b2', personId: 'person-2', grams: 250 },
                { id: 'b3', personId: 'person-3', grams: 250 },
                { id: 'b4', personId: 'person-4', grams: 250 },
              ],
            },
          ],
        },
      ],
    });

    const bagsShared = countBagsSharedIn(order, 'person-1');
    expect(bagsShared).toBe(1);

    const { entries } = getCountedOrders([order], 'person-1', { 'person-1': 'Amina' }, roasters);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.bagsSharedIn).toBe(1);
    expect(entries[0]!.personCalc.totalGrams).toBe(250);

    const summary = summarisePeriod(entries);
    expect(summary.bagsSharedIn).toBe(1);
    expect(summary.gramsTaken).toBe(250);
  });

  it('3. Old orders without bag detail round up grams / bag size', () => {
    const legacyOrder = makeOrder({
      id: 'order-legacy',
      lots: [
        {
          id: 'lot-legacy',
          name: 'Ethiopia Yirgacheffe',
          foreignPricePerBag: 20,
          gramsPerBag: 500,
          quantity: 1,
          shares: [
            { id: 's1', personId: 'person-1', shareGrams: 250 },
            { id: 's2', personId: 'person-2', shareGrams: 250 },
          ],
        },
      ],
    });

    const bagsShared = countBagsSharedIn(legacyOrder, 'person-1');
    expect(bagsShared).toBe(1);

    const fullOrder = makeOrder({
      id: 'order-legacy-2',
      lots: [
        {
          id: 'lot-legacy-2',
          name: 'Kenya Nyeri',
          foreignPricePerBag: 20,
          gramsPerBag: 250,
          quantity: 2,
          shares: [
            { id: 's3', personId: 'person-1', shareGrams: 500 },
          ],
        },
      ],
    });
    expect(countBagsSharedIn(fullOrder, 'person-1')).toBe(2);
  });

  it('4. Same roaster as id and as name snapshot merges correctly', () => {
    const orderWithId = makeOrder({
      id: 'order-with-id',
      orderDate: '2026-01-10',
      roasterId: 'roaster-1',
      roasterSnapshot: null,
    });
    const orderWithName = makeOrder({
      id: 'order-with-name',
      orderDate: '2026-02-15',
      roasterId: null,
      roasterSnapshot: { id: null, name: 'Father Coffee', logoUrl: 'https://example.com/father.png' },
    });

    const canonical1 = resolveCanonicalRoaster({ id: 'roaster-1', name: 'Father Coffee' }, roasters);
    const canonical2 = resolveCanonicalRoaster({ id: null, name: 'father coffee' }, roasters);

    expect(canonical1?.key).toBe('father coffee');
    expect(canonical2?.key).toBe('father coffee');

    const { entries } = getCountedOrders([orderWithId, orderWithName], 'person-1', { 'person-1': 'Amina' }, roasters);
    const summary = summarisePeriod(entries);

    expect(summary.roastersTried).toBe(1);
    expect(summary.favouriteRoaster?.name).toBe('Father Coffee');
    expect(summary.favouriteRoaster?.orderCount).toBe(2);
    expect(summary.favouriteRoaster?.share).toBe(1);
    expect(summary.cameBackTo).toHaveLength(1);
  });

  it('5. Favourite tie-break: grams -> order count -> latest order date -> alphabetical', () => {
    // Both roasters have 500g, but Rosetta has 2 orders vs Father Coffee 1 order
    const order1 = makeOrder({
      id: 'o-1',
      orderDate: '2026-03-01',
      roasterId: 'roaster-1',
      roasterSnapshot: { id: 'roaster-1', name: 'Father Coffee' },
      lots: [
        {
          id: 'l-1',
          name: 'Blend A',
          foreignPricePerBag: 10,
          gramsPerBag: 500,
          quantity: 1,
          shares: [{ id: 's1', personId: 'person-1', shareGrams: 500, bagIndex: 0 }],
          bags: [{ id: 'b1', splitMode: 'full', buyers: [{ id: 'bb1', personId: 'person-1', grams: 500 }] }],
        },
      ],
    });
    const order2 = makeOrder({
      id: 'o-2',
      orderDate: '2026-02-01',
      roasterId: 'roaster-2',
      roasterSnapshot: { id: 'roaster-2', name: 'Rosetta' },
      lots: [
        {
          id: 'l-2',
          name: 'Blend B',
          foreignPricePerBag: 10,
          gramsPerBag: 250,
          quantity: 1,
          shares: [{ id: 's2', personId: 'person-1', shareGrams: 250, bagIndex: 0 }],
          bags: [{ id: 'b2', splitMode: 'full', buyers: [{ id: 'bb2', personId: 'person-1', grams: 250 }] }],
        },
      ],
    });
    const order3 = makeOrder({
      id: 'o-3',
      orderDate: '2026-02-15',
      roasterId: 'roaster-2',
      roasterSnapshot: { id: 'roaster-2', name: 'Rosetta' },
      lots: [
        {
          id: 'l-3',
          name: 'Blend C',
          foreignPricePerBag: 10,
          gramsPerBag: 250,
          quantity: 1,
          shares: [{ id: 's3', personId: 'person-1', shareGrams: 250, bagIndex: 0 }],
          bags: [{ id: 'b3', splitMode: 'full', buyers: [{ id: 'bb3', personId: 'person-1', grams: 250 }] }],
        },
      ],
    });

    const { entries } = getCountedOrders([order1, order2, order3], 'person-1', { 'person-1': 'Amina' }, roasters);
    const summary = summarisePeriod(entries);

    // Rosetta wins on order count tie-break (2 orders vs 1 order)
    expect(summary.favouriteRoaster?.name).toBe('Rosetta');
    expect(summary.runnerUpRoaster?.name).toBe('Father Coffee');

    // Test date tie-break when grams and order count are equal
    const orderDateTieA = makeOrder({
      id: 'o-a',
      orderDate: '2026-01-01',
      roasterId: 'roaster-1',
      roasterSnapshot: { id: 'roaster-1', name: 'Father Coffee' },
    });
    const orderDateTieB = makeOrder({
      id: 'o-b',
      orderDate: '2026-01-20',
      roasterId: 'roaster-2',
      roasterSnapshot: { id: 'roaster-2', name: 'Rosetta' },
    });
    const entriesDateTie = getCountedOrders([orderDateTieA, orderDateTieB], 'person-1', { 'person-1': 'Amina' }, roasters).entries;
    const summaryDateTie = summarisePeriod(entriesDateTie);
    // Rosetta ordered on 20 Jan > Father Coffee on 1 Jan
    expect(summaryDateTie.favouriteRoaster?.name).toBe('Rosetta');
  });

  it('6. Orders with no roaster: counted in coffee taken, tracked in unassignedRoasterOrderCount', () => {
    const roasterOrder = makeOrder({ id: 'o-with-roaster', roasterId: 'roaster-1', roasterSnapshot: { id: 'roaster-1', name: 'Father Coffee' } });
    const noRoasterOrder = makeOrder({
      id: 'o-no-roaster',
      roasterId: null,
      roasterSnapshot: null,
    });

    const { entries } = getCountedOrders([roasterOrder, noRoasterOrder], 'person-1', { 'person-1': 'Amina' }, roasters);
    const summary = summarisePeriod(entries);

    expect(summary.ordersCount).toBe(2);
    expect(summary.gramsTaken).toBe(500);
    expect(summary.unassignedRoasterOrderCount).toBe(1);
    expect(summary.favouriteRoaster?.name).toBe('Father Coffee');
    // Favourite share denominator is total coffee taken: 250g / 500g = 0.5
    expect(summary.favouriteRoaster?.share).toBe(0.5);
  });

  it('7. 31 Dec to 1 Jan and 29 Feb string dates do not shift under timezones', () => {
    // In extreme negative timezone (e.g. UTC-11 / Pago Pago), converting UTC midnight string 2026-01-01T00:00:00Z shifts to 2025!
    const utcMidnight = '2026-01-01T00:00:00Z';
    const offsetMsUtcMinus11 = -11 * 60 * 60 * 1000;
    const shiftedToPrevYear = new Date(new Date(utcMidnight).getTime() + offsetMsUtcMinus11);
    expect(shiftedToPrevYear.getUTCFullYear()).toBe(2025);

    // In extreme positive timezone (e.g. UTC+14 / Line Islands), 2025-12-31T12:00:00Z shifts to 2026!
    const offsetMsUtcPlus14 = 14 * 60 * 60 * 1000;
    const shiftedToNextYear = new Date(new Date('2025-12-31T12:00:00Z').getTime() + offsetMsUtcPlus14);
    expect(shiftedToNextYear.getUTCFullYear()).toBe(2026);

    // But text-based date parsing in yearInCoffee is strictly invariant:
    expect(parseDateParts('2025-12-31')).toEqual({
      year: 2025,
      month: 12,
      day: 31,
      yearStr: '2025',
      monthStr: '12',
      dayStr: '31',
    });
    expect(parseDateParts('2026-01-01')).toEqual({
      year: 2026,
      month: 1,
      day: 1,
      yearStr: '2026',
      monthStr: '01',
      dayStr: '01',
    });
    expect(parseDateParts('2024-02-29')).toEqual({
      year: 2024,
      month: 2,
      day: 29,
      yearStr: '2024',
      monthStr: '02',
      dayStr: '29',
    });
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2026)).toBe(false);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
  });

  it('8. Empty year returns 0 counts and null optional properties without NaN', () => {
    const summary = summarisePeriod([], { year: '2026' });
    expect(summary.ordersCount).toBe(0);
    expect(summary.kgTaken).toBe(0);
    expect(summary.gramsTaken).toBe(0);
    expect(summary.bagsSharedIn).toBe(0);
    expect(summary.roastersTried).toBe(0);
    expect(summary.coffeesTried).toBe(0);
    expect(summary.favouriteRoaster).toBeNull();
    expect(summary.runnerUpRoaster).toBeNull();
    expect(summary.cameBackTo).toHaveLength(0);
    expect(summary.busiestMonth).toBeNull();
    expect(summary.styleOfYear).toBeNull();
    expect(summary.monthlyOrders).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('9. One-order year has clean recap with no came-back-to and null style of year', () => {
    const singleOrder = makeOrder({ orderDate: '2026-04-10' });
    const { entries } = getCountedOrders([singleOrder], 'person-1', { 'person-1': 'Amina' }, roasters);
    const summary = summarisePeriod(entries, { year: '2026' });

    expect(summary.ordersCount).toBe(1);
    expect(summary.gramsTaken).toBe(250);
    expect(summary.cameBackTo).toHaveLength(0);
    expect(summary.styleOfYear).toBeNull();
    expect(summary.busiestMonth).toBe(4);
    expect(summary.runnerUpRoaster).toBeNull();
  });

  it('10. Style of year: below 4 orders returns null, 4+ orders calculates Loyalist / Explorer / Steady with numbers', () => {
    const orders3 = [
      makeOrder({ id: 'o1', orderDate: '2026-01-01' }),
      makeOrder({ id: 'o2', orderDate: '2026-02-01' }),
      makeOrder({ id: 'o3', orderDate: '2026-03-01' }),
    ];
    const { entries: entries3 } = getCountedOrders(orders3, 'person-1', { 'person-1': 'Amina' }, roasters);
    expect(summarisePeriod(entries3).styleOfYear).toBeNull();

    // 4 orders, all Father Coffee: 4/4 = 100% >= 60% -> Loyalist
    const ordersLoyalist = [
      ...orders3,
      makeOrder({ id: 'o4', orderDate: '2026-04-01' }),
    ];
    const { entries: entriesLoyalist } = getCountedOrders(ordersLoyalist, 'person-1', { 'person-1': 'Amina' }, roasters);
    const summaryLoyalist = summarisePeriod(entriesLoyalist);
    expect(summaryLoyalist.styleOfYear?.type).toBe('Loyalist');
    expect(summaryLoyalist.styleOfYear?.detail).toContain('4 of your 4 orders came from Father Coffee');

    // 4 orders with 3 different roasters: 3 roasters >= 4/2 (2) -> Explorer
    const ordersExplorer = [
      makeOrder({ id: 'oe1', roasterId: 'roaster-1', roasterSnapshot: { id: 'roaster-1', name: 'Father Coffee' } }),
      makeOrder({ id: 'oe2', roasterId: 'roaster-2', roasterSnapshot: { id: 'roaster-2', name: 'Rosetta' } }),
      makeOrder({ id: 'oe3', roasterId: null, roasterSnapshot: { id: null, name: 'Subtext' } }),
      makeOrder({ id: 'oe4', roasterId: 'roaster-1', roasterSnapshot: { id: 'roaster-1', name: 'Father Coffee' } }),
    ];
    const { entries: entriesExplorer } = getCountedOrders(ordersExplorer, 'person-1', { 'person-1': 'Amina' }, roasters);
    const summaryExplorer = summarisePeriod(entriesExplorer);
    expect(summaryExplorer.styleOfYear?.type).toBe('Explorer');
    expect(summaryExplorer.styleOfYear?.detail).toContain('3 roasters across 4 orders');
  });

  it('11. Same-dates comparison on 29 Feb clamps correctly to 28 Feb on non-leap year', () => {
    const orders2023 = [
      makeOrder({ id: 'o-2023', orderDate: '2023-01-15' }),
      makeOrder({ id: 'o-2023-late', orderDate: '2023-08-20' }),
    ];
    const orders2024 = [
      makeOrder({ id: 'o-2024-feb', orderDate: '2024-02-29' }),
    ];

    const { entries } = getCountedOrders([...orders2023, ...orders2024], 'person-1', { 'person-1': 'Amina' }, roasters);

    // Today is leap day 2024-02-29
    const comparison = compareSamePeriod('2024', entries, '2024-02-29');
    expect(comparison).not.toBeNull();
    expect(comparison?.currentYear).toBe('2024');
    expect(comparison?.previousYear).toBe('2023');
    expect(comparison?.samePeriodCurrentOrders).toBe(1);
    expect(comparison?.samePeriodPreviousOrders).toBe(1); // Only the Jan 15 order is in 1 Jan - 28 Feb
  });

  it('12. A person seeing a reduced copy of an order gets the same numbers as from the full order', () => {
    const fullOrder = makeOrder({
      id: 'order-full',
      payerId: 'person-admin',
      lots: [
        {
          id: 'lot-full',
          name: 'Panama Geisha',
          foreignPricePerBag: 40,
          gramsPerBag: 250,
          quantity: 2,
          shares: [
            { id: 's-amina', personId: 'person-1', shareGrams: 250, bagIndex: 0 },
            { id: 's-bilal', personId: 'person-2', shareGrams: 250, bagIndex: 1 },
          ],
          bags: [
            {
              id: 'bag-0',
              splitMode: 'full',
              buyers: [{ id: 'bb-amina', personId: 'person-1', grams: 250 }],
            },
            {
              id: 'bag-1',
              splitMode: 'full',
              buyers: [{ id: 'bb-bilal', personId: 'person-2', grams: 250 }],
            },
          ],
        },
      ],
      fees: [{ id: 'f1', label: 'Shipping', amountZar: 100, allocationType: 'fixed_shared' }],
    });

    // Reduced copy as sent by get_my_participant_orders: Bilal is stripped out
    const reducedOrder: Order = {
      ...fullOrder,
      payerId: null,
      goodsTotalZar: 250,
      lots: [
        {
          id: 'lot-full',
          name: 'Panama Geisha',
          foreignPricePerBag: 40,
          gramsPerBag: 250,
          quantity: 2,
          shares: [
            { id: 's-amina', personId: 'person-1', shareGrams: 250, bagIndex: 0 },
          ],
          bags: [
            {
              id: 'bag-0',
              splitMode: 'full',
              buyers: [{ id: 'bb-amina', personId: 'person-1', grams: 250 }],
            },
          ],
        },
      ],
      fees: [{ id: 'f1', label: 'Shipping', amountZar: 50, allocationType: 'fixed_shared' }],
    };

    const fullResult = getCountedOrders([fullOrder], 'person-1', { 'person-1': 'Amina', 'person-2': 'Bilal' }, roasters);
    const reducedResult = getCountedOrders([reducedOrder], 'person-1', { 'person-1': 'Amina' }, roasters);

    expect(fullResult.entries).toHaveLength(1);
    expect(reducedResult.entries).toHaveLength(1);
    expect(reducedResult.skippedCount).toBe(0);

    const fullSummary = summarisePeriod(fullResult.entries);
    const reducedSummary = summarisePeriod(reducedResult.entries);

    expect(reducedSummary.gramsTaken).toBe(fullSummary.gramsTaken);
    expect(reducedSummary.kgTaken).toBe(fullSummary.kgTaken);
    expect(reducedSummary.bagsSharedIn).toBe(fullSummary.bagsSharedIn);
    expect(reducedSummary.roastersTried).toBe(fullSummary.roastersTried);
    expect(reducedSummary.coffeesTried).toBe(fullSummary.coffeesTried);
    expect(reducedSummary.favouriteRoaster?.name).toBe(fullSummary.favouriteRoaster?.name);
  });

  it('13. Custom date ranges: incomplete and invalid ranges reported explicitly', () => {
    expect(validateStatsDateRange({ preset: 'custom' }).status).toBe('incomplete');
    expect(validateStatsDateRange({ preset: 'custom', startDate: '2026-01-01' }).status).toBe('incomplete');
    expect(validateStatsDateRange({ preset: 'custom', endDate: '2026-03-01' }).status).toBe('incomplete');
    expect(validateStatsDateRange({ preset: 'custom', startDate: '2026-05-01', endDate: '2026-02-01' }).status).toBe('invalid');
    expect(validateStatsDateRange({ preset: 'custom', startDate: '2026-01-01', endDate: '2026-03-01' }).status).toBe('valid');
  });

  it('14. Orders that cannot be counted are tracked in skippedCount', () => {
    const brokenOrder = makeOrder({
      id: 'order-broken',
      lots: [
        {
          id: 'lot-broken',
          name: 'Broken Lot',
          foreignPricePerBag: 0, // invalid price <= 0
          gramsPerBag: 250,
          quantity: 1,
          shares: [{ id: 's1', personId: 'person-1', shareGrams: 250 }],
          bags: [{ id: 'b1', splitMode: 'full', buyers: [{ id: 'bb1', personId: 'person-1', grams: 250 }] }],
        },
      ],
    });

    const result = getCountedOrders([brokenOrder], 'person-1', { 'person-1': 'Amina' }, roasters);
    expect(result.entries).toHaveLength(0);
    expect(result.skippedCount).toBe(1);
  });

  it('15. Sorting inside the library: orders are always sorted newest first', () => {
    const oldOrder = makeOrder({ id: 'old', orderDate: '2025-01-01' });
    const midOrder = makeOrder({ id: 'mid', orderDate: '2026-01-01' });
    const newestOrder = makeOrder({ id: 'newest', orderDate: '2026-06-01' });

    const { entries } = getCountedOrders([oldOrder, newestOrder, midOrder], 'person-1', { 'person-1': 'Amina' }, roasters);
    expect(entries[0]!.order.id).toBe('newest');
    expect(entries[1]!.order.id).toBe('mid');
    expect(entries[2]!.order.id).toBe('old');
  });

  it('16. getCountedYears lists only years with counted orders, newest first', () => {
    const o2024 = makeOrder({ id: 'o-24', orderDate: '2024-05-01' });
    const o2026 = makeOrder({ id: 'o-26', orderDate: '2026-02-01' });
    const uncountedPlanningOrder = makeOrder({ id: 'o-plan', orderDate: '2025-01-01', status: 'planning', isArchived: false });

    const years = getCountedYears([o2024, o2026, uncountedPlanningOrder], 'person-1', { 'person-1': 'Amina' }, roasters);
    expect(years).toEqual(['2026', '2024']);
  });

  it('17. Multi-lot orders accurately track user personal grams per lot and distinct coffees', () => {
    const multiLotOrder = makeOrder({
      id: 'order-multi-lot',
      lots: [
        {
          id: 'lot-1',
          name: 'Kenya AA',
          foreignPricePerBag: 20,
          gramsPerBag: 250,
          quantity: 1,
          shares: [{ id: 's1', personId: 'person-1', shareGrams: 250, bagIndex: 0 }],
          bags: [{ id: 'b1', splitMode: 'full', buyers: [{ id: 'bb1', personId: 'person-1', grams: 250 }] }],
        },
        {
          id: 'lot-2',
          name: 'Ethiopia Guji',
          foreignPricePerBag: 30,
          gramsPerBag: 500,
          quantity: 1,
          shares: [{ id: 's2', personId: 'person-1', shareGrams: 500, bagIndex: 0 }],
          bags: [{ id: 'b2', splitMode: 'full', buyers: [{ id: 'bb2', personId: 'person-1', grams: 500 }] }],
        },
        {
          id: 'lot-3',
          name: 'Colombia Huila',
          foreignPricePerBag: 25,
          gramsPerBag: 250,
          quantity: 1,
          shares: [{ id: 's3', personId: 'person-2', shareGrams: 250, bagIndex: 0 }],
          bags: [{ id: 'b3', splitMode: 'full', buyers: [{ id: 'bb3', personId: 'person-2', grams: 250 }] }],
        },
      ],
    });

    const { entries } = getCountedOrders(
      [multiLotOrder],
      'person-1',
      { 'person-1': 'Amina', 'person-2': 'Bilal' },
      roasters,
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]!.lotNames).toEqual(['Kenya AA', 'Ethiopia Guji']);
    expect(entries[0]!.personLots).toEqual([
      { name: 'Kenya AA', grams: 250 },
      { name: 'Ethiopia Guji', grams: 500 },
    ]);

    const summary = summarisePeriod(entries);
    // User only tried 2 coffees, not 3 (Colombia Huila was taken by person-2)
    expect(summary.coffeesTried).toBe(2);
    expect(summary.topCoffees).toHaveLength(2);
    expect(summary.topCoffees[0]!.name).toBe('Ethiopia Guji');
    expect(summary.topCoffees[0]!.grams).toBe(500);
    expect(summary.topCoffees[1]!.name).toBe('Kenya AA');
    expect(summary.topCoffees[1]!.grams).toBe(250);
  });

  it('18. summarisePeriod reports rangeStatus for incomplete and invalid ranges', () => {
    const order = makeOrder({ orderDate: '2026-03-01' });
    const { entries } = getCountedOrders([order], 'person-1', { 'person-1': 'Amina' }, roasters);

    const incompleteSummary = summarisePeriod(entries, {
      range: { preset: 'custom', startDate: '2026-01-01', endDate: '' },
    });
    expect(incompleteSummary.rangeStatus).toBe('incomplete');
    expect(incompleteSummary.ordersCount).toBe(0);

    const invalidSummary = summarisePeriod(entries, {
      range: { preset: 'custom', startDate: '2026-05-01', endDate: '2026-02-01' },
    });
    expect(invalidSummary.rangeStatus).toBe('invalid');
    expect(invalidSummary.ordersCount).toBe(0);

    const validSummary = summarisePeriod(entries, {
      range: { preset: 'custom', startDate: '2026-01-01', endDate: '2026-04-01' },
    });
    expect(validSummary.rangeStatus).toBe('valid');
    expect(validSummary.ordersCount).toBe(1);
  });
});
