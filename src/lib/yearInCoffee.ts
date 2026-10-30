import { calculate } from './calculations';
import { normalizeRoasterName, resolveOrderRoaster, type ResolvedOrderRoaster } from './roasters';
import type { Order, Roaster } from '../types';

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
  totalSpentZar: number;
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
    const hasStart = Boolean(range.startDate && range.startDate.trim());
    const hasEnd = Boolean(range.endDate && range.endDate.trim());

    if (!hasStart || !hasEnd) {
      return { status: 'incomplete' };
    }

    const start = range.startDate!.trim();
    const end = range.endDate!.trim();

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
    const inRange = orderDate >= validation.startDate! && orderDate <= validation.endDate!;
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
      let lotGrams = 0;
      if (lot.bags && lot.bags.length > 0) {
        lotGrams = lot.bags.reduce((bSum, bag) => {
          const buyer = bag.buyers.find((b) => b.personId === personId);
          return bSum + (buyer ? buyer.grams : 0);
        }, 0);
      } else if (lot.bagAllocations && lot.bagAllocations.length > 0) {
        lotGrams = lot.bagAllocations.reduce((aSum, alloc) => {
          const part = alloc.participants.find((p) => p.personId === personId);
          return aSum + (part ? part.shareGrams : 0);
        }, 0);
      } else {
        lotGrams = (lot.shares ?? []).reduce((sSum, share) => {
          return share.personId === personId ? sSum + (share.shareGrams || 0) : sSum;
        }, 0);
      }
      return total + lotGrams;
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
        const lotNames = order.lots
          .filter((lot) => {
            const inBags = lot.bags?.some((b) => b.buyers.some((buyer) => buyer.personId === personId && buyer.grams > 0));
            const inShares = lot.shares?.some((s) => s.personId === personId && s.shareGrams > 0);
            return inBags || inShares;
          })
          .map((lot) => lot.name.trim())
          .filter(Boolean);

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
        const lotNames = order.lots.map((lot) => lot.name.trim()).filter(Boolean);

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

  let filteredEntries: CountedOrderEntry[];

  if (options?.year) {
    const targetYear = options.year;
    filteredEntries = allEntries.filter((entry) => entry.order.orderDate.split('-')[0] === targetYear);
  } else if (options?.range) {
    filteredEntries = allEntries.filter((entry) => isOrderInDateRange(entry.order.orderDate, options.range!, today).inRange);
  } else {
    filteredEntries = [...allEntries];
  }

  const ordersCount = filteredEntries.length;
  let gramsTaken = 0;
  let bagsSharedIn = 0;
  let totalSpentZar = 0;
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
    totalSpentZar += entry.personCalc.totalFinal;

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

    for (const lot of entry.order.lots) {
      const rawName = lot.name.trim();
      if (!rawName) continue;

      let lotGrams = 0;
      if (lot.bags && lot.bags.length > 0) {
        lotGrams = lot.bags.reduce((bSum, bag) => {
          const buyersGrams = bag.buyers.reduce((sum, buyer) => {
            return buyer.personId === entry.order.payerId ||
              lot.shares.some((s) => s.personId === buyer.personId)
              ? sum + buyer.grams
              : sum;
          }, 0);
          return bSum + buyersGrams;
        }, 0);
      }

      const pGrams = entry.personCalc.totalGrams > 0 ? entry.personCalc.totalGrams : lotGrams;
      const normalizedLotName = rawName.toLowerCase().replace(/\s+/g, ' ');
      const existingCoffee = coffeesMap.get(normalizedLotName);

      if (!existingCoffee) {
        coffeesMap.set(normalizedLotName, {
          displayName: rawName,
          grams: pGrams,
          orderCount: 1,
          roasterName: entry.roaster?.name,
        });
      } else {
        existingCoffee.grams += pGrams;
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

  const favouriteRoaster: FavouriteRoasterSummary | null =
    sortedRoasters.length > 0
      ? {
          id: sortedRoasters[0]!.canonical.id,
          name: sortedRoasters[0]!.canonical.name,
          logoUrl: sortedRoasters[0]!.canonical.logoUrl,
          grams: sortedRoasters[0]!.grams,
          share: gramsTaken > 0 ? sortedRoasters[0]!.grams / gramsTaken : 0,
          orderCount: sortedRoasters[0]!.orderCount,
        }
      : null;

  const runnerUpRoaster: FavouriteRoasterSummary | null =
    sortedRoasters.length > 1
      ? {
          id: sortedRoasters[1]!.canonical.id,
          name: sortedRoasters[1]!.canonical.name,
          logoUrl: sortedRoasters[1]!.canonical.logoUrl,
          grams: sortedRoasters[1]!.grams,
          share: gramsTaken > 0 ? sortedRoasters[1]!.grams / gramsTaken : 0,
          orderCount: sortedRoasters[1]!.orderCount,
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
    if (highestMonths.length === 1) {
      busiestMonth = highestMonths[0]!.month;
    }
  }

  const targetYear = options?.year ?? (filteredEntries[0] ? filteredEntries[0].order.orderDate.split('-')[0] : null);
  const newRoasters: ResolvedOrderRoaster[] = [];
  if (targetYear) {
    const earliestRoasterYears = new Map<string, { year: string; roaster: ResolvedOrderRoaster }>();
    for (const entry of allTimeList) {
      if (!entry.canonicalRoaster) continue;
      const y = entry.order.orderDate.split('-')[0]!;
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
    if (favOrders / ordersCount >= 0.6) {
      styleOfYear = {
        type: 'Loyalist',
        detail: `${favOrders} of your ${ordersCount} orders came from ${favouriteRoaster!.name}`,
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
    filteredEntries.length > 0 ? filteredEntries[filteredEntries.length - 1]! : null;

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
    totalSpentZar,
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

  const { month, day } = parseDateParts(today);
  const currentStart = `${currentYear}-01-01`;
  const currentEnd = `${currentYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const prevStart = `${previousYear}-01-01`;
  const prevMaxDay = daysInMonth(prevYearNum, month);
  const prevClampedDay = Math.min(day, prevMaxDay);
  const prevEnd = `${previousYear}-${String(month).padStart(2, '0')}-${String(prevClampedDay).padStart(2, '0')}`;

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
