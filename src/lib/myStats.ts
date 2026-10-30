import { normalizeFeeAllocationType } from './invoiceFormatter';
import type { Order, PersonLinkResolution, Roaster } from '../types';
import type { ResolvedOrderRoaster } from './roasters';
import {
  type CountedOrderEntry,
  type StatsDateRange,
  type StatsRangePreset,
  type RangeValidationStatus,
  getCountedOrders,
  isOrderInDateRange,
  summarisePeriod,
} from './yearInCoffee';

export type {
  CountedOrderEntry,
  FavouriteRoasterSummary,
  CameBackToRoaster,
  TopCoffeeSummary,
  StyleOfYear,
  PeriodSummary,
  PeriodComparison,
  StatsRangePreset,
  StatsDateRange,
  RangeValidationStatus,
} from './yearInCoffee';

export {
  getLocalTodayString,
  parseDateParts,
  isLeapYear,
  daysInMonth,
  subtractCalendarMonths,
  validateStatsDateRange,
  isOrderInDateRange,
  resolveCanonicalRoaster,
  countBagsSharedIn,
  getCountedOrders,
  getCountedYears,
  summarisePeriod,
  compareSamePeriod,
} from './yearInCoffee';

export type ParticipantOrderMatch = CountedOrderEntry;

export interface FavoriteRoasterStat extends ResolvedOrderRoaster {
  bagCount: number;
  grams?: number;
  share?: number;
  orderCount?: number;
}

export interface MyStatsSummary {
  totalGrams: number;
  totalSpent: number;
  totalBags: number;
  averageCostPer250g: number | null;
  favoriteRoaster: FavoriteRoasterStat | null;
  bagsSharedIn: number;
  roastersTried: number;
  coffeesTried: number;
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

  const inLots = order.lots.some((lot) => (
    lot.shares.some((share) => share.personId === personId) ||
    lot.bags?.some((bag) => bag.buyers.some((buyer) => buyer.personId === personId)) ||
    lot.bagAllocations?.some((bag) => bag.participants.some((participant) => participant.personId === personId))
  ));
  if (inLots) {
    return true;
  }

  const inFees = order.fees.some((fee) => (
    normalizeFeeAllocationType(fee.allocationType) === 'specific_person' &&
    fee.personId === personId
  ));
  if (inFees) {
    return true;
  }

  if (Boolean(order.payments && personId in order.payments)) {
    return true;
  }

  return false;
}

export function getParticipantScopedOrders(orders: Order[], personId: string | null): Order[] {
  if (!personId) {
    return [];
  }

  return orders.filter((order) => orderIncludesPerson(order, personId));
}

export function isOrderInStatsRange(orderDate: string, range: StatsDateRange, today?: string): boolean {
  return isOrderInDateRange(orderDate, range, today).inRange;
}

export function getParticipantFinalizedOrders(
  orders: Order[],
  personId: string | null,
  personNames: Record<string, string>,
  roasters: Roaster[],
): ParticipantOrderMatch[] {
  const { entries } = getCountedOrders(orders, personId, personNames, roasters);
  return entries;
}

export function filterParticipantOrdersByRange(
  orders: ParticipantOrderMatch[],
  range: StatsDateRange,
  today?: string,
): ParticipantOrderMatch[] {
  return orders.filter((entry) => isOrderInDateRange(entry.order.orderDate, range, today).inRange);
}

export function calculateMyStatsSummary(orders: ParticipantOrderMatch[]): MyStatsSummary {
  const summary = summarisePeriod(orders);
  const favRoasterName = summary.favouriteRoaster?.name;
  const favBagCount = favRoasterName
    ? orders
        .filter((o) => o.canonicalRoaster?.name === favRoasterName)
        .reduce((sum, o) => sum + o.bagsSharedIn, 0)
    : 0;

  return {
    totalGrams: summary.gramsTaken,
    totalSpent: summary.totalSpentZar,
    totalBags: summary.bagsSharedIn,
    averageCostPer250g: null,
    favoriteRoaster: summary.favouriteRoaster
      ? {
          id: summary.favouriteRoaster.id,
          name: summary.favouriteRoaster.name,
          logoUrl: summary.favouriteRoaster.logoUrl,
          bagCount: favBagCount,
          grams: summary.favouriteRoaster.grams,
          share: summary.favouriteRoaster.share,
          orderCount: summary.favouriteRoaster.orderCount,
        }
      : null,
    bagsSharedIn: summary.bagsSharedIn,
    roastersTried: summary.roastersTried,
    coffeesTried: summary.coffeesTried,
  };
}
