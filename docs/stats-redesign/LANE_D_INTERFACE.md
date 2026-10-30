# Lane D: Statistics and Year in Coffee Return Shape

Frozen interface for Lane D (numbers layer).

```ts
export interface CountedOrderEntry {
  order: Order;
  personCalc: {
    totalGrams: number;
    totalFinal: number;
  };
  roaster: ResolvedOrderRoaster | null;
  bagsSharedIn: number;
  lotNames: string[];
}

export interface FavouriteRoasterSummary {
  id: string | null;
  name: string;
  logoUrl?: string;
  grams: number;
  share: number; // 0..1 ratio of the person's total coffee taken in the period
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
  monthlyOrders: number[]; // 12 numbers (index 0 = Jan, index 11 = Dec)
  busiestMonth: number | null; // 1..12, or null if tie or 0 orders
  newRoasters: ResolvedOrderRoaster[];
  firstOrder: CountedOrderEntry | null;
  skippedCount: number;
  unassignedRoasterOrderCount: number;
  styleOfYear: StyleOfYear | null; // null if ordersCount < 4
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

export type RangeValidationStatus = 'valid' | 'incomplete' | 'invalid';

export function getCountedYears(
  orders: Order[],
  personId: string | null,
  personNames: Record<string, string>,
  roasters: Roaster[],
): string[];

export function summarisePeriod(
  entries: CountedOrderEntry[],
  options?: {
    year?: string;
    range?: StatsDateRange;
    today?: string;
    allTimeOrders?: CountedOrderEntry[];
    skippedCount?: number;
  },
): PeriodSummary;

export function compareSamePeriod(
  currentYear: string,
  allCountedOrders: CountedOrderEntry[],
  today?: string,
): PeriodComparison | null;
```
