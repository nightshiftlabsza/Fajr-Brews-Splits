import { calculate } from './calculations';
import { normalizeFeeAllocationType } from './invoiceFormatter';
import { resolveOrderRoaster, type ResolvedOrderRoaster } from './roasters';
import type { Order, PersonCalculation, PersonLinkResolution, Roaster } from '../types';

export type StatsRangePreset = 'all' | '3m' | '6m' | '12m' | 'custom';

export interface StatsDateRange {
  preset: StatsRangePreset;
  startDate?: string;
  endDate?: string;
}

export interface ParticipantOrderMatch {
  order: Order;
  personCalc: PersonCalculation;
  roaster: ResolvedOrderRoaster | null;
}

export interface FavoriteRoasterStat extends ResolvedOrderRoaster {
  bagCount: number;
}

export interface MyStatsSummary {
  totalGrams: number;
  totalSpent: number;
  totalBags: number;
  averageCostPer250g: number | null;
  favoriteRoaster: FavoriteRoasterStat | null;
}

export type MyStatsAccessState = 'ready' | 'unlinked' | 'ambiguous';

export interface LinkedStatsPerson {
  state: MyStatsAccessState;
  personId: string | null;
}

export function resolveLinkedStatsPerson(
  linkedPersonId: string | null,
  linkResolution: PersonLinkResolution,
): LinkedStatsPerson {
  if (linkedPersonId) {
    return {
      state: 'ready',
      personId: linkedPersonId,
    };
  }

  if (linkResolution.status === 'ambiguous' || linkResolution.status === 'needs-confirmation') {
    return {
      state: 'ambiguous',
      personId: null,
    };
  }

  return {
    state: 'unlinked',
    personId: null,
  };
}

export function orderIncludesPerson(order: Order, personId: string): boolean {
  if (order.payerId === personId) {
    return true;
  }

  return order.lots.some((lot) => (
    lot.shares.some((share) => share.personId === personId && share.shareGrams > 0) ||
    lot.bags?.some((bag) => bag.buyers.some((buyer) => buyer.personId === personId && buyer.grams > 0))
  )) ||
  order.fees.some((fee) => (
    normalizeFeeAllocationType(fee.allocationType) === 'specific_person' &&
    fee.personId === personId &&
    fee.amountZar > 0
  )) ||
  Boolean(order.payments[personId] && order.payments[personId].status !== 'unpaid');
}

export function getParticipantScopedOrders(orders: Order[], personId: string | null): Order[] {
  if (!personId) {
    return [];
  }

  return orders.filter((order) => orderIncludesPerson(order, personId));
}

function subtractMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() - months);
  return next;
}

export function isOrderInStatsRange(orderDate: string, range: StatsDateRange): boolean {
  if (range.preset === 'all') {
    return true;
  }

  const orderTime = new Date(`${orderDate}T00:00:00`).getTime();
  if (Number.isNaN(orderTime)) {
    return false;
  }

  if (range.preset === 'custom') {
    if (!range.startDate || !range.endDate) {
      return true;
    }

    const start = new Date(`${range.startDate}T00:00:00`).getTime();
    const end = new Date(`${range.endDate}T23:59:59`).getTime();
    return orderTime >= start && orderTime <= end;
  }

  const now = new Date();
  const start = range.preset === '3m'
    ? subtractMonths(now, 3)
    : range.preset === '6m'
      ? subtractMonths(now, 6)
      : subtractMonths(now, 12);

  return orderTime >= start.getTime() && orderTime <= now.getTime();
}

export function getParticipantFinalizedOrders(
  orders: Order[],
  personId: string | null,
  personNames: Record<string, string>,
  roasters: Roaster[],
): ParticipantOrderMatch[] {
  if (!personId) {
    return [];
  }

  return orders
    .filter((order) => order.isArchived)
    .map((order) => {
      const result = calculate(order, personNames);
      if (!result.isValid) {
        return null;
      }

      const personCalc = result.personCalcs[personId];
      if (!personCalc) {
        return null;
      }

      return {
        order,
        personCalc,
        roaster: resolveOrderRoaster(order, roasters),
      };
    })
    .filter((entry): entry is ParticipantOrderMatch => entry !== null);
}

export function filterParticipantOrdersByRange(
  orders: ParticipantOrderMatch[],
  range: StatsDateRange,
): ParticipantOrderMatch[] {
  return orders.filter((entry) => isOrderInStatsRange(entry.order.orderDate, range));
}

export function calculateMyStatsSummary(orders: ParticipantOrderMatch[]): MyStatsSummary {
  const totalGrams = orders.reduce((sum, entry) => sum + entry.personCalc.totalGrams, 0);
  const totalSpent = orders.reduce((sum, entry) => sum + entry.personCalc.totalFinal, 0);
  const totalBags = totalGrams / 250;

  const roasterTotals = new Map<string, FavoriteRoasterStat & { latestOrderDate: string }>();

  for (const entry of orders) {
    if (!entry.roaster) {
      continue;
    }

    const key = entry.roaster.id ?? entry.roaster.name.toLowerCase();
    const current = roasterTotals.get(key);
    const bagCount = entry.personCalc.totalGrams / 250;

    if (!current) {
      roasterTotals.set(key, {
        ...entry.roaster,
        bagCount,
        latestOrderDate: entry.order.orderDate,
      });
      continue;
    }

    current.bagCount += bagCount;
    if (entry.order.orderDate > current.latestOrderDate) {
      current.latestOrderDate = entry.order.orderDate;
      current.logoUrl = entry.roaster.logoUrl;
      current.name = entry.roaster.name;
      current.id = entry.roaster.id;
    }
  }

  const favoriteRoaster = Array.from(roasterTotals.values())
    .sort((left, right) => {
      if (left.bagCount !== right.bagCount) {
        return right.bagCount - left.bagCount;
      }
      if (left.latestOrderDate !== right.latestOrderDate) {
        return right.latestOrderDate.localeCompare(left.latestOrderDate);
      }
      return left.name.localeCompare(right.name);
    })[0] ?? null;

  return {
    totalGrams,
    totalSpent,
    totalBags,
    averageCostPer250g: totalGrams > 0 ? (totalSpent / totalGrams) * 250 : null,
    favoriteRoaster: favoriteRoaster
      ? {
        id: favoriteRoaster.id,
        name: favoriteRoaster.name,
        logoUrl: favoriteRoaster.logoUrl,
        bagCount: favoriteRoaster.bagCount,
      }
      : null,
  };
}
