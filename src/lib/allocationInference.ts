import type { Bag, BagBuyer, BagSplitMode, CoffeeLot, Person } from '../types';
import { formatGrams } from './formatters';

function genId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

/**
 * Deterministically splits grams among `count` buyers.
 * Remainder is added to the last buyer.
 */
export function calculateEqualSplitGrams(gramsPerBag: number, buyerCount: number): number[] {
  if (buyerCount <= 0) return [];
  if (buyerCount === 1) return [gramsPerBag];
  const base = Math.floor(gramsPerBag / buyerCount);
  const remainder = gramsPerBag - base * buyerCount;
  return Array.from({ length: buyerCount }, (_, i) => (i === buyerCount - 1 ? base + remainder : base));
}

/**
 * Creates a brand new unassigned bag.
 */
export function createEmptyBag(): Bag {
  return {
    id: genId(),
    splitMode: 'unassigned',
    buyers: [],
  };
}

/**
 * Creates N unassigned bags.
 */
export function createEmptyBags(count: number): Bag[] {
  return Array.from({ length: Math.max(1, count) }, () => createEmptyBag());
}

/**
 * Non-destructively assigns a single buyer to a full bag.
 * Leaves all other bags untouched.
 */
export function assignFullBag(bag: Bag, personId: string, gramsPerBag: number): Bag {
  if (!personId) {
    return { ...bag, splitMode: 'unassigned', buyers: [] };
  }
  return {
    ...bag,
    splitMode: 'full',
    buyers: [{ id: bag.buyers[0]?.id || genId(), personId, grams: gramsPerBag }],
  };
}

/**
 * Non-destructively sets up an equal split for a bag among a list of person IDs.
 * Automatically distributes grams equally with deterministic remainder handling.
 */
export function splitBagEqually(bag: Bag, personIds: string[], gramsPerBag: number): Bag {
  const validPersonIds = personIds.filter(Boolean);
  if (validPersonIds.length === 0) {
    return { ...bag, splitMode: 'unassigned', buyers: [] };
  }
  if (validPersonIds.length === 1) {
    return assignFullBag(bag, validPersonIds[0], gramsPerBag);
  }

  const splitGrams = calculateEqualSplitGrams(gramsPerBag, validPersonIds.length);
  const existingBuyerMap = new Map(bag.buyers.map((b) => [b.personId, b.id]));

  const buyers: BagBuyer[] = validPersonIds.map((personId, index) => ({
    id: existingBuyerMap.get(personId) || genId(),
    personId,
    grams: splitGrams[index],
  }));

  return {
    ...bag,
    splitMode: 'equal',
    buyers,
  };
}

/**
 * Sets a custom split for a bag with explicit grams per buyer.
 */
export function setCustomSplit(bag: Bag, buyers: { personId: string; grams: number }[]): Bag {
  const existingBuyerMap = new Map(bag.buyers.map((b) => [b.personId, b.id]));
  return {
    ...bag,
    splitMode: 'custom',
    buyers: buyers.map((b) => ({
      id: existingBuyerMap.get(b.personId) || genId(),
      personId: b.personId,
      grams: b.grams,
    })),
  };
}

/**
 * Non-destructively appends a new bag to a list of bags.
 * Leaves all existing bags completely intact.
 */
export function addBagToBags(bags: Bag[]): Bag[] {
  return [...bags, createEmptyBag()];
}

/**
 * Removes a specific bag by ID from a list of bags.
 * Leaves other bags untouched.
 */
export function removeBagFromBags(bags: Bag[], bagId: string): Bag[] {
  if (bags.length <= 1) return bags; // Keep at least 1 bag
  return bags.filter((b) => b.id !== bagId);
}

/**
 * Proposes an initial or default allocation for a lot when given a set of selected buyers.
 * CRITICAL RULE: This is NON-DESTRUCTIVE to already configured bags.
 * If all bags are unassigned, it applies smart inference (Scenarios 1-6).
 * If some bags are already assigned, it ONLY allocates the unassigned bags.
 */
export function proposeAllocationForLot(
  existingBags: Bag[],
  selectedPersonIds: string[],
  gramsPerBag: number,
): Bag[] {
  const validPersonIds = selectedPersonIds.filter(Boolean);
  if (validPersonIds.length === 0) {
    return existingBags;
  }

  // Check if ALL bags are unassigned (fresh lot scenario)
  const allUnassigned = existingBags.every((b) => b.splitMode === 'unassigned' || b.buyers.length === 0);

  if (allUnassigned) {
    const bagCount = existingBags.length;

    // Scenario 1: 1 bag, 1 buyer -> full bag
    if (bagCount === 1 && validPersonIds.length === 1) {
      return [assignFullBag(existingBags[0], validPersonIds[0], gramsPerBag)];
    }

    // Scenario 2 & 3: 1 bag, multiple buyers -> equal split
    if (bagCount === 1 && validPersonIds.length >= 2) {
      return [splitBagEqually(existingBags[0], validPersonIds, gramsPerBag)];
    }

    // Scenario 4 & 5: N bags, N buyers -> 1 bag each
    if (bagCount === validPersonIds.length) {
      return existingBags.map((bag, i) => assignFullBag(bag, validPersonIds[i], gramsPerBag));
    }

    // Scenario 6: N bags, K buyers (N > K) -> distribute bags greedily to buyers
    if (bagCount > validPersonIds.length) {
      const result: Bag[] = [];
      let buyerIdx = 0;
      for (let i = 0; i < bagCount; i++) {
        const personId = validPersonIds[buyerIdx % validPersonIds.length];
        result.push(assignFullBag(existingBags[i], personId, gramsPerBag));
        buyerIdx++;
      }
      return result;
    }

    // Scenario: N bags, K buyers (N < K) on 1 bag -> equal split
    if (bagCount < validPersonIds.length && bagCount === 1) {
      return [splitBagEqually(existingBags[0], validPersonIds, gramsPerBag)];
    }
  }

  // Partial allocation: only fill unassigned bags with unrepresented buyers
  const assignedPersonIds = new Set<string>();
  for (const b of existingBags) {
    for (const buyer of b.buyers) {
      if (buyer.personId) assignedPersonIds.add(buyer.personId);
    }
  }

  const unassignedBuyers = validPersonIds.filter((id) => !assignedPersonIds.has(id));
  let unassignedBuyerIdx = 0;

  return existingBags.map((bag) => {
    if (bag.splitMode !== 'unassigned' && bag.buyers.length > 0) {
      return bag; // PRESERVE EXISTING ALLOCATION INTACT
    }
    if (unassignedBuyerIdx < unassignedBuyers.length) {
      const nextBuyerId = unassignedBuyers[unassignedBuyerIdx++];
      return assignFullBag(bag, nextBuyerId, gramsPerBag);
    }
    return bag;
  });
}

/**
 * Formats a clean human-readable summary of a single bag.
 */
export function formatBagSummary(bag: Bag, gramsPerBag: number, personNameMap: Record<string, string>): string {
  if (bag.splitMode === 'unassigned' || bag.buyers.length === 0) {
    return 'Unassigned';
  }

  const buyerNames = bag.buyers
    .filter((b) => b.personId)
    .map((b) => personNameMap[b.personId] || 'Unknown');

  if (bag.splitMode === 'full') {
    return `${buyerNames[0] || 'Unassigned'} · Full bag (${formatGrams(gramsPerBag)})`;
  }

  if (bag.splitMode === 'equal') {
    const gramEach = bag.buyers[0]?.grams ?? Math.round(gramsPerBag / bag.buyers.length);
    return `${buyerNames.join(' + ')} · Split equally (${formatGrams(gramEach)} each)`;
  }

  // Custom split
  const parts = bag.buyers.map((b) => `${personNameMap[b.personId] || 'Unknown'} (${formatGrams(b.grams)})`);
  return `${parts.join(' + ')} · Custom split`;
}

/**
 * Formats a high-level human-readable summary of an entire coffee lot.
 */
export function formatLotAllocationSummary(
  bags: Bag[],
  gramsPerBag: number,
  personNameMap: Record<string, string>,
): {
  headline: string;
  subtext: string;
  isComplete: boolean;
  unassignedCount: number;
} {
  const totalBags = bags.length;
  const unassignedBags = bags.filter((b) => b.splitMode === 'unassigned' || b.buyers.length === 0);
  const unassignedCount = unassignedBags.length;
  const isComplete = unassignedCount === 0 && bags.every((b) => {
    if (b.splitMode === 'full') return b.buyers.length === 1 && b.buyers[0].grams === gramsPerBag;
    if (b.splitMode === 'equal' || b.splitMode === 'custom') {
      const sum = b.buyers.reduce((s, x) => s + x.grams, 0);
      return b.buyers.length >= 2 && sum === gramsPerBag;
    }
    return false;
  });

  if (unassignedCount === totalBags) {
    return {
      headline: `${totalBags} ${totalBags === 1 ? 'bag' : 'bags'} · Unassigned`,
      subtext: 'Select who is taking this coffee.',
      isComplete: false,
      unassignedCount,
    };
  }

  if (totalBags === 1) {
    const bag = bags[0];
    const summary = formatBagSummary(bag, gramsPerBag, personNameMap);
    return {
      headline: summary,
      subtext: bag.splitMode === 'equal' ? 'Split equally across buyers' : bag.splitMode === 'custom' ? 'Custom gram breakdown' : 'Whole bag allocated',
      isComplete,
      unassignedCount,
    };
  }

  // Multi-bag analysis
  const fullBags = bags.filter((b) => b.splitMode === 'full' && b.buyers.length === 1);
  const splitBags = bags.filter((b) => b.splitMode === 'equal' || b.splitMode === 'custom');

  // Count bags per person for full bags
  const bagsPerPerson: Record<string, number> = {};
  for (const b of fullBags) {
    const pid = b.buyers[0]?.personId;
    if (pid) bagsPerPerson[pid] = (bagsPerPerson[pid] || 0) + 1;
  }

  const distinctBuyerIds = Object.keys(bagsPerPerson);

  // If all bags are whole bags and 1 bag each
  if (fullBags.length === totalBags && distinctBuyerIds.length === totalBags) {
    const names = distinctBuyerIds.map((id) => personNameMap[id] || 'Unknown');
    return {
      headline: `${totalBags} bags · 1 bag each`,
      subtext: names.join(', '),
      isComplete: true,
      unassignedCount: 0,
    };
  }

  // If some buyers have multiple full bags
  if (fullBags.length === totalBags) {
    const parts = Object.entries(bagsPerPerson).map(
      ([id, count]) => `${personNameMap[id] || 'Unknown'} (${count} ${count === 1 ? 'bag' : 'bags'})`,
    );
    return {
      headline: `${totalBags} bags · Allocated`,
      subtext: parts.join(', '),
      isComplete: true,
      unassignedCount: 0,
    };
  }

  // Mixed or incomplete
  const completeCount = totalBags - unassignedCount;
  const statusText = unassignedCount > 0
    ? `${completeCount} of ${totalBags} bags assigned (${unassignedCount} need buyers)`
    : `${totalBags} bags assigned (${splitBags.length} shared)`;

  return {
    headline: statusText,
    subtext: `${fullBags.length} whole, ${splitBags.length} shared`,
    isComplete,
    unassignedCount,
  };
}
