import { calculate } from './calculations';
import { normalizeRoasterName, resolveOrderRoaster, type ResolvedOrderRoaster } from './roasters';
import type { CoffeeLot, Order, Roaster } from '../types';

export interface PersonLotGrams {
  name: string;
  grams: number;
}

export interface CountedOrderEntry {
  order: Order;
  personCalc: {
    totalGrams: number;
    totalFinal: number;
  };
  roaster: ResolvedOrderRoaster | null;
  canonicalRoaster: CanonicalRoaster | null;
  bagsSharedIn: number;
  lotNames: string[];
  personLots?: PersonLotGrams[];
}

export interface CanonicalRoaster {
  key: string;
  name: string;
  id: string | null;
  logoUrl?: string;
}

export interface FavouriteRoasterSummary {
  id: string | null;
  name: string;
  logoUrl?: string;
  grams: number;
  share: number;
  orderCount: number;
}

export interface CameBackToRoaster {
  id: string | null;
  name: string;
  logoUrl?: string;
  orderCount: number;
  grams: number;
}

export interface TopCoffeeSummary {
  name: string;
  grams: number;
  orderCount: number;
  roasterName?: string;
}

export interface StyleOfYear {
  type: 'Loyalist' | 'Explorer' | 'Steady';
  detail: string;
}

export interface PeriodSummary {
  kgTaken: number;
  gramsTaken: number;
  ordersCount: number;
  bagsSharedIn: number;
  roastersTried: number;
  coffeesTried: number;
  favouriteRoaster: FavouriteRoasterSummary | null;
  runnerUpRoaster: FavouriteRoasterSummary | null;
  cameBackTo: CameBackToRoaster[];
  monthlyOrders: number[];
  busiestMonth: number | null;
  newRoasters: ResolvedOrderRoaster[];
  firstOrder: CountedOrderEntry | null;
  skippedCount: number;
  unassignedRoasterOrderCount: number;
  styleOfYear: StyleOfYear | null;
  topCoffees: TopCoffeeSummary[];
  rangeStatus: RangeValidationStatus;
  entries: CountedOrderEntry[];
}

export interface PeriodComparison {
  currentYear: string;
  previousYear: string;
  samePeriodCurrentOrders: number;
  samePeriodPreviousOrders: number;
  samePeriodCurrentKg: number;
  samePeriodPreviousKg: number;
  hasPreviousYearOrders: boolean;
}

export type StatsRangePreset = 'all' | '3m' | '6m' | '12m' | 'custom';

export interface StatsDateRange {
  preset: StatsRangePreset;
  startDate?: string;
  endDate?: string;
}

export type RangeValidationStatus = 'valid' | 'incomplete' | 'invalid';

export function getLocalTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateParts(dateStr: string): {
  year: number;
  month: number;
  day: number;
  yearStr: string;
  monthStr: string;
  dayStr: string;
} {
  const parts = dateStr.split('-');
  const yearStr = parts[0] ?? '1970';
  const monthStr = parts[1] ?? '01';
  const dayStr = parts[2] ?? '01';
  return {
    year: Number.parseInt(yearStr, 10) || 1970,
    month: Number.parseInt(monthStr, 10) || 1,
    day: Number.parseInt(dayStr, 10) || 1,
    yearStr,
    monthStr,
    dayStr,
  };
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  if ([4, 6, 9, 11].includes(month)) {
    return 30;
  }
  return 31;
}

export function subtractCalendarMonths(dateStr: string, monthsToSubtract: number): string {
  const { year, month, day } = parseDateParts(dateStr);
  let targetMonth = month - monthsToSubtract;
  let targetYear = year;

  while (targetMonth <= 0) {
    targetMonth += 12;
    targetYear -= 1;
  }

  const maxDay = daysInMonth(targetYear, targetMonth);
  const clampedDay = Math.min(day, maxDay);

  const yStr = String(targetYear);
  const mStr = String(targetMonth).padStart(2, '0');
  const dStr = String(clampedDay).padStart(2, '0');
  return `${yStr}-${mStr}-${dStr}`;
}

export function validateStatsDateRange(
  range: StatsDateRange,
): { status: RangeValidationStatus; startDate?: string; endDate?: string } {
  if (range.preset === 'all') {
    return { status: 'valid' };
  }

  if (range.preset === 'custom') {
    const start = range.startDate?.trim();
    const end = range.endDate?.trim();

    if (!start || !end) {
      return { status: 'incomplete' };
    }

    if (start > end) {
      return { status: 'invalid', startDate: start, endDate: end };
    }

    return { status: 'valid', startDate: start, endDate: end };
  }

  return { status: 'valid' };
}

export function isOrderInDateRange(
  orderDate: string,
  range: StatsDateRange,
  today: string = getLocalTodayString(),
): { inRange: boolean; status: RangeValidationStatus } {
  const validation = validateStatsDateRange(range);
  if (validation.status !== 'valid') {
    return { inRange: false, status: validation.status };
  }

  if (range.preset === 'all') {
    return { inRange: true, status: 'valid' };
  }

  if (range.preset === 'custom') {
    if (!validation.startDate || !validation.endDate) {
      return { inRange: false, status: 'incomplete' };
    }
    const inRange = orderDate >= validation.startDate && orderDate <= validation.endDate;
    return { inRange, status: 'valid' };
  }

  const months = range.preset === '3m' ? 3 : range.preset === '6m' ? 6 : 12;
  const startDate = subtractCalendarMonths(today, months);
  const inRange = orderDate >= startDate && orderDate <= today;
  return { inRange, status: 'valid' };
}

export function resolveCanonicalRoaster(
  roaster: ResolvedOrderRoaster | null,
  roasters: Roaster[],
): CanonicalRoaster | null {
  if (!roaster || !roaster.name?.trim()) {
    return null;
  }

  const normalized = normalizeRoasterName(roaster.name);
  const match = roasters.find(
    (candidate) =>
      (roaster.id && candidate.id === roaster.id) ||
      normalizeRoasterName(candidate.name) === normalized,
  );

  if (match) {
    return {
      key: normalizeRoasterName(match.name),
      name: match.name,
      id: match.id,
      logoUrl: match.logoUrl || roaster.logoUrl,
    };
  }

  return {
    key: normalized,
    name: roaster.name.trim(),
    id: roaster.id ?? null,
    logoUrl: roaster.logoUrl,
  };
}

export function countBagsSharedIn(order: Order, personId: string): number {
  let bagCount = 0;

  for (const lot of order.lots) {
    if (lot.bags && lot.bags.length > 0) {
      const matchingBags = lot.bags.filter((bag) =>
        bag.buyers.some((buyer) => buyer.personId === personId && buyer.grams > 0),
      );
      bagCount += matchingBags.length;
    } else if (lot.bagAllocations && lot.bagAllocations.length > 0) {
      const distinctBags = new Set<string | number>();
      for (const allocation of lot.bagAllocations) {
        if (
          allocation.participants.some(
            (participant) => participant.personId === personId && participant.shareGrams > 0,
          )
        ) {
          distinctBags.add(allocation.bagIndex ?? allocation.id);
        }
      }
      bagCount += distinctBags.size;
    } else if (lot.shares && lot.shares.some((share) => typeof share.bagIndex === 'number')) {
      const distinctBags = new Set<number>();
      for (const share of lot.shares) {
        if (share.personId === personId && share.shareGrams > 0 && typeof share.bagIndex === 'number') {
          distinctBags.add(share.bagIndex);
        }
      }
      bagCount += distinctBags.size;
    } else {
      const personLotGrams = (lot.shares ?? []).reduce((sum, share) => {
        return share.personId === personId ? sum + (share.shareGrams || 0) : sum;
      }, 0);
      if (personLotGrams > 0) {
        const bagSize = lot.gramsPerBag || 250;
        bagCount += Math.ceil(personLotGrams / bagSize);
      }
    }
  }

  return bagCount;
}

export function getPersonGramsInLot(lot: CoffeeLot, personId: string): number {
  if (lot.bags && lot.bags.length > 0) {
    return lot.bags.reduce((sum, bag) => {
      const buyer = bag.buyers.find((b) => b.personId === personId);
      return sum + (buyer && buyer.grams > 0 ? buyer.grams : 0);
    }, 0);
  }
  if (lot.bagAllocations && lot.bagAllocations.length > 0) {
    return lot.bagAllocations.reduce((sum, alloc) => {
      const part = alloc.participants.find((p) => p.personId === personId);
      return sum + (part && part.shareGrams > 0 ? part.shareGrams : 0);
    }, 0);
  }
  return (lot.shares ?? []).reduce((sum, share) => {
    return share.personId === personId && share.shareGrams > 0 ? sum + share.shareGrams : sum;
  }, 0);
}

export function getCountedOrders(
  orders: Order[],
  personId: string | null,
  personNames: Record<string, string>,
  roasters: Roaster[],
): { entries: CountedOrderEntry[]; skippedCount: number } {
  if (!personId) {
    return { entries: [], skippedCount: 0 };
  }

  const entries: CountedOrderEntry[] = [];
  let skippedCount = 0;

  const eligibleOrders = orders.filter(
    (order) => order.status === 'completed' || order.status === 'archived' || order.isArchived,
  );

  for (const order of eligibleOrders) {
    const rawGrams = order.lots.reduce((total, lot) => {
      return total + getPersonGramsInLot(lot, personId);
    }, 0);

    if (rawGrams <= 0) {
      continue;
    }

    const calcResult = calculate(order, personNames);
    if (calcResult.isValid) {
      const personCalc = calcResult.personCalcs[personId];
      if (personCalc && personCalc.totalGrams > 0) {
        const roaster = resolveOrderRoaster(order, roasters);
        const canonicalRoaster = resolveCanonicalRoaster(roaster, roasters);
        const bagsSharedIn = countBagsSharedIn(order, personId);
        const personLots: PersonLotGrams[] = [];
        for (const lot of order.lots) {
          const g = getPersonGramsInLot(lot, personId);
          if (g > 0) {
            personLots.push({
              name: lot.name.trim() || 'Coffee',
              grams: g,
            });
          }
        }
        const lotNames = personLots.map((p) => p.name);

        entries.push({
          order,
          personCalc: {
            totalGrams: personCalc.totalGrams,
            totalFinal: personCalc.totalFinal,
          },
          roaster,
          canonicalRoaster,
          bagsSharedIn,
          lotNames,
          personLots,
        });
        continue;
      }
    }

    const hasOtherBuyers = order.lots.some(
      (lot) =>
        lot.bags?.some((b) => b.buyers.some((buyer) => buyer.personId !== personId && buyer.grams > 0)) ||
        lot.shares?.some((s) => s.personId !== personId && s.shareGrams > 0),
    );

    if (!hasOtherBuyers && rawGrams > 0) {
      const projectedOrder: Order = {
        ...order,
        payerId: order.payerId || personId,
        lots: order.lots.map((lot) => ({
          ...lot,
          quantity: lot.bags && lot.bags.length > 0 ? lot.bags.length : 1,
        })),
      };
      const projectedCalc = calculate(projectedOrder, personNames);
      if (projectedCalc.isValid && projectedCalc.personCalcs[personId]) {
        const pCalc = projectedCalc.personCalcs[personId];
        const roaster = resolveOrderRoaster(order, roasters);
        const canonicalRoaster = resolveCanonicalRoaster(roaster, roasters);
        const bagsSharedIn = countBagsSharedIn(order, personId);
        const personLots: PersonLotGrams[] = [];
        for (const lot of projectedOrder.lots) {
          const g = getPersonGramsInLot(lot, personId);
          if (g > 0) {
            personLots.push({
              name: lot.name.trim() || 'Coffee',
              grams: g,
            });
          }
        }
        const lotNames = personLots.map((p) => p.name);

        entries.push({
          order,
          personCalc: {
            totalGrams: pCalc.totalGrams,
            totalFinal: pCalc.totalFinal,
          },
          roaster,
          canonicalRoaster,
          bagsSharedIn,
          lotNames,
          personLots,
        });
        continue;
      }
    }

    skippedCount++;
  }

  entries.sort((a, b) => {
    if (b.order.orderDate !== a.order.orderDate) {
      return b.order.orderDate.localeCompare(a.order.orderDate);
    }
    return (b.order.id || '').localeCompare(a.order.id || '');
  });

  return { entries, skippedCount };
}

export function getCountedYears(
  orders: Order[],
  personId: string | null,
  personNames: Record<string, string>,
  roasters: Roaster[],
): string[] {
  const { entries } = getCountedOrders(orders, personId, personNames, roasters);
  const years = new Set<string>();

  for (const entry of entries) {
    const yearStr = entry.order.orderDate.split('-')[0];
    if (yearStr && yearStr.length === 4) {
      years.add(yearStr);
    }
  }

  return Array.from(years).sort((a, b) => b.localeCompare(a));
}

export function summarisePeriod(
  allEntries: CountedOrderEntry[],
  options?: {
    year?: string;
    range?: StatsDateRange;
    today?: string;
    allTimeOrders?: CountedOrderEntry[];
    skippedCount?: number;
  },
): PeriodSummary {
  const today = options?.today ?? getLocalTodayString();
  const allTimeList = options?.allTimeOrders ?? allEntries;
  const skippedCount = options?.skippedCount ?? 0;
  const rangeStatus = options?.range ? validateStatsDateRange(options.range).status : 'valid';

  let filteredEntries: CountedOrderEntry[];

  if (options?.year) {
    const targetYear = options.year;
    filteredEntries = allEntries.filter((entry) => entry.order.orderDate.split('-')[0] === targetYear);
  } else if (options?.range) {
    const range = options.range;
    filteredEntries = allEntries.filter((entry) => isOrderInDateRange(entry.order.orderDate, range, today).inRange);
  } else {
    filteredEntries = [...allEntries];
  }

  const ordersCount = filteredEntries.length;
  let gramsTaken = 0;
  let bagsSharedIn = 0;
  let unassignedRoasterOrderCount = 0;

  const roastersMap = new Map<
    string,
    {
      canonical: CanonicalRoaster;
      grams: number;
      orderCount: number;
      latestOrderDate: string;
    }
  >();

  const coffeesMap = new Map<
    string,
    {
      displayName: string;
      grams: number;
      orderCount: number;
      roasterName?: string;
    }
  >();

  const monthlyOrders = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  for (const entry of filteredEntries) {
    gramsTaken += entry.personCalc.totalGrams;
    bagsSharedIn += entry.bagsSharedIn;

    const { month } = parseDateParts(entry.order.orderDate);
    if (month >= 1 && month <= 12) {
      monthlyOrders[month - 1] += 1;
    }

    if (!entry.canonicalRoaster) {
      unassignedRoasterOrderCount += 1;
    } else {
      const roasterKey = entry.canonicalRoaster.key;
      const existing = roastersMap.get(roasterKey);
      if (!existing) {
        roastersMap.set(roasterKey, {
          canonical: entry.canonicalRoaster,
          grams: entry.personCalc.totalGrams,
          orderCount: 1,
          latestOrderDate: entry.order.orderDate,
        });
      } else {
        existing.grams += entry.personCalc.totalGrams;
        existing.orderCount += 1;
        if (entry.order.orderDate > existing.latestOrderDate) {
          existing.latestOrderDate = entry.order.orderDate;
        }
      }
    }

    const lotsToCount: PersonLotGrams[] =
      entry.personLots && entry.personLots.length > 0
        ? entry.personLots
        : entry.lotNames.map((name) => ({
            name,
            grams:
              entry.personCalc.totalGrams > 0 && entry.lotNames.length > 0
                ? Math.round(entry.personCalc.totalGrams / entry.lotNames.length)
                : entry.personCalc.totalGrams,
          }));

    for (const lot of lotsToCount) {
      const rawName = lot.name.trim();
      if (!rawName) continue;
      const normalizedLotName = rawName.toLowerCase().replace(/\s+/g, ' ');
      const existingCoffee = coffeesMap.get(normalizedLotName);

      if (!existingCoffee) {
        coffeesMap.set(normalizedLotName, {
          displayName: rawName,
          grams: lot.grams,
          orderCount: 1,
          roasterName: entry.roaster?.name,
        });
      } else {
        existingCoffee.grams += lot.grams;
        existingCoffee.orderCount += 1;
        if (!existingCoffee.roasterName && entry.roaster?.name) {
          existingCoffee.roasterName = entry.roaster.name;
        }
      }
    }
  }

  const sortedRoasters = Array.from(roastersMap.values()).sort((a, b) => {
    if (b.grams !== a.grams) {
      return b.grams - a.grams;
    }
    if (b.orderCount !== a.orderCount) {
      return b.orderCount - a.orderCount;
    }
    if (b.latestOrderDate !== a.latestOrderDate) {
      return b.latestOrderDate.localeCompare(a.latestOrderDate);
    }
    return a.canonical.name.localeCompare(b.canonical.name);
  });

  const topRoaster = sortedRoasters[0];
  const favouriteRoaster: FavouriteRoasterSummary | null =
    topRoaster
      ? {
          id: topRoaster.canonical.id,
          name: topRoaster.canonical.name,
          logoUrl: topRoaster.canonical.logoUrl,
          grams: topRoaster.grams,
          share: gramsTaken > 0 ? topRoaster.grams / gramsTaken : 0,
          orderCount: topRoaster.orderCount,
        }
      : null;

  const secondRoaster = sortedRoasters[1];
  const runnerUpRoaster: FavouriteRoasterSummary | null =
    secondRoaster
      ? {
          id: secondRoaster.canonical.id,
          name: secondRoaster.canonical.name,
          logoUrl: secondRoaster.canonical.logoUrl,
          grams: secondRoaster.grams,
          share: gramsTaken > 0 ? secondRoaster.grams / gramsTaken : 0,
          orderCount: secondRoaster.orderCount,
        }
      : null;

  const cameBackTo: CameBackToRoaster[] = sortedRoasters
    .filter((r) => r.orderCount >= 2)
    .map((r) => ({
      id: r.canonical.id,
      name: r.canonical.name,
      logoUrl: r.canonical.logoUrl,
      orderCount: r.orderCount,
      grams: r.grams,
    }));

  const maxMonthOrders = Math.max(...monthlyOrders);
  let busiestMonth: number | null = null;
  if (maxMonthOrders > 0) {
    const highestMonths = monthlyOrders
      .map((count, index) => ({ count, month: index + 1 }))
      .filter((m) => m.count === maxMonthOrders);
    const topMonth = highestMonths[0];
    if (highestMonths.length === 1 && topMonth) {
      busiestMonth = topMonth.month;
    }
  }

  const targetYear = options?.year ?? (filteredEntries[0] ? filteredEntries[0].order.orderDate.split('-')[0] : null);
  const newRoasters: ResolvedOrderRoaster[] = [];
  if (targetYear) {
    const earliestRoasterYears = new Map<string, { year: string; roaster: ResolvedOrderRoaster }>();
    for (const entry of allTimeList) {
      if (!entry.canonicalRoaster) continue;
      const y = entry.order.orderDate.split('-')[0] ?? '';
      const key = entry.canonicalRoaster.key;
      const prev = earliestRoasterYears.get(key);
      if (!prev || y < prev.year) {
        earliestRoasterYears.set(key, {
          year: y,
          roaster: {
            id: entry.canonicalRoaster.id,
            name: entry.canonicalRoaster.name,
            logoUrl: entry.canonicalRoaster.logoUrl,
          },
        });
      }
    }
    for (const [, info] of earliestRoasterYears.entries()) {
      if (info.year === targetYear && roastersMap.has(normalizeRoasterName(info.roaster.name))) {
        newRoasters.push(info.roaster);
      }
    }
  }

  const topCoffees: TopCoffeeSummary[] = Array.from(coffeesMap.values())
    .sort((a, b) => {
      if (b.grams !== a.grams) {
        return b.grams - a.grams;
      }
      return a.displayName.localeCompare(b.displayName);
    })
    .slice(0, 5)
    .map((c) => ({
      name: c.displayName,
      grams: c.grams,
      orderCount: c.orderCount,
      roasterName: c.roasterName,
    }));

  let styleOfYear: StyleOfYear | null = null;
  if (ordersCount >= 4) {
    const favOrders = favouriteRoaster?.orderCount ?? 0;
    const roastersCount = sortedRoasters.length;
    if (favouriteRoaster && favOrders / ordersCount >= 0.6) {
      styleOfYear = {
        type: 'Loyalist',
        detail: `${favOrders} of your ${ordersCount} orders came from ${favouriteRoaster.name}`,
      };
    } else if (roastersCount >= Math.ceil(ordersCount / 2)) {
      styleOfYear = {
        type: 'Explorer',
        detail: `${roastersCount} roasters across ${ordersCount} orders`,
      };
    } else {
      styleOfYear = {
        type: 'Steady',
        detail: `${ordersCount} orders across ${roastersCount} roasters`,
      };
    }
  }

  const firstOrder =
    filteredEntries.length > 0 ? (filteredEntries[filteredEntries.length - 1] ?? null) : null;

  return {
    kgTaken: Number((gramsTaken / 1000).toFixed(3)),
    gramsTaken,
    ordersCount,
    bagsSharedIn,
    roastersTried: sortedRoasters.length,
    coffeesTried: coffeesMap.size,
    favouriteRoaster,
    runnerUpRoaster,
    cameBackTo,
    monthlyOrders,
    busiestMonth,
    newRoasters,
    firstOrder,
    skippedCount,
    unassignedRoasterOrderCount,
    styleOfYear,
    topCoffees,
    rangeStatus,
    entries: filteredEntries,
  };
}

export function compareSamePeriod(
  currentYear: string,
  allCountedOrders: CountedOrderEntry[],
  today: string = getLocalTodayString(),
): PeriodComparison | null {
  const prevYearNum = Number.parseInt(currentYear, 10) - 1;
  const previousYear = String(prevYearNum);

  const prevYearEntries = allCountedOrders.filter(
    (e) => e.order.orderDate.split('-')[0] === previousYear,
  );
  if (prevYearEntries.length === 0) {
    return null;
  }

  const { year: currentCalYear, month, day } = parseDateParts(today);
  const isCurrentYear = currentYear === String(currentCalYear);

  const currentStart = `${currentYear}-01-01`;
  const currentEnd = isCurrentYear
    ? `${currentYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    : `${currentYear}-12-31`;

  const prevStart = `${previousYear}-01-01`;
  const prevMaxDay = daysInMonth(prevYearNum, month);
  const prevClampedDay = Math.min(day, prevMaxDay);
  const prevEnd = isCurrentYear
    ? `${previousYear}-${String(month).padStart(2, '0')}-${String(prevClampedDay).padStart(2, '0')}`
    : `${previousYear}-12-31`;

  const currentPeriodEntries = allCountedOrders.filter(
    (e) => e.order.orderDate >= currentStart && e.order.orderDate <= currentEnd,
  );
  const prevPeriodEntries = allCountedOrders.filter(
    (e) => e.order.orderDate >= prevStart && e.order.orderDate <= prevEnd,
  );

  const currentGrams = currentPeriodEntries.reduce((s, e) => s + e.personCalc.totalGrams, 0);
  const prevGrams = prevPeriodEntries.reduce((s, e) => s + e.personCalc.totalGrams, 0);

  return {
    currentYear,
    previousYear,
    samePeriodCurrentOrders: currentPeriodEntries.length,
    samePeriodPreviousOrders: prevPeriodEntries.length,
    samePeriodCurrentKg: Number((currentGrams / 1000).toFixed(3)),
    samePeriodPreviousKg: Number((prevGrams / 1000).toFixed(3)),
    hasPreviousYearOrders: true,
  };
}
