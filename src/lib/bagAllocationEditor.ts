import type { Bag, CoffeeLot, Person } from '../types';
import { normalizeLotToBags } from './orderWizard';

export interface SplitBuyer {
  personId: string;
  grams: number;
}

export interface CustomSplitResult {
  allocations: Record<string, number>;
  floatingPersonIds: string[];
  balance: number;
  state: 'exact' | 'under' | 'over';
  doneAllowed: boolean;
  helpMessage: string;
  adviceMessage?: string;
}

/**
 * Distribute a bag of whole grams across people equally.
 * 1 person gets the whole bag.
 * 2+ people receive floor division with the remainder given to the last person.
 */
export function computeEqualSplit(bagSize: number, personIds: string[]): SplitBuyer[] {
  if (!personIds || personIds.length === 0 || bagSize <= 0) {
    return [];
  }

  const count = personIds.length;
  if (count === 1) {
    return [{ personId: personIds[0], grams: Math.round(bagSize) }];
  }

  const totalGrams = Math.round(bagSize);
  const baseGrams = Math.floor(totalGrams / count);
  const remainder = totalGrams - baseGrams * count;

  return personIds.map((personId, index) => ({
    personId,
    grams: index === count - 1 ? baseGrams + remainder : baseGrams,
  }));
}

/**
 * Distribute grams when some people have a fixed custom amount and others float (share the rest).
 */
export function computeCustomSplit(
  bagSize: number,
  personIds: string[],
  fixedAmounts: Record<string, number | null | undefined>
): CustomSplitResult {
  const targetGrams = Math.round(bagSize);
  if (!personIds || personIds.length === 0) {
    return {
      allocations: {},
      floatingPersonIds: [],
      balance: targetGrams,
      state: 'under',
      doneAllowed: false,
      helpMessage: `Left to give: ${targetGrams}g`,
      adviceMessage: 'Give the coffee to someone',
    };
  }

  const floatingPersonIds: string[] = [];
  const fixedAllocations: Record<string, number> = {};
  let sumFixed = 0;
  let hasUnder1gFixed = false;

  for (const personId of personIds) {
    const val = fixedAmounts[personId];
    if (val === null || val === undefined || Number.isNaN(val)) {
      floatingPersonIds.push(personId);
    } else {
      const fixed = Math.round(val);
      if (fixed < 1) {
        hasUnder1gFixed = true;
      }
      const clamped = Math.max(0, fixed);
      fixedAllocations[personId] = clamped;
      sumFixed += clamped;
    }
  }

  const remaining = targetGrams - sumFixed;
  const allocations: Record<string, number> = { ...fixedAllocations };

  if (sumFixed > targetGrams) {
    for (const fid of floatingPersonIds) {
      allocations[fid] = 0;
    }
    const overage = sumFixed - targetGrams;
    return {
      allocations,
      floatingPersonIds,
      balance: overage,
      state: 'over',
      doneAllowed: false,
      helpMessage: `Over by ${overage}g`,
      adviceMessage: `Take ${overage}g away`,
    };
  }

  if (floatingPersonIds.length > 0) {
    // If not enough grams remain to give every floating participant at least 1g
    if (remaining < floatingPersonIds.length) {
      for (const fid of floatingPersonIds) {
        allocations[fid] = 0;
      }
      const shortage = Math.max(0, targetGrams - sumFixed);
      return {
        allocations,
        floatingPersonIds,
        balance: shortage,
        state: 'under',
        doneAllowed: false,
        helpMessage: shortage > 0 ? `Left to give: ${shortage}g` : 'Left to give: 0g',
        adviceMessage: shortage > 0
          ? `Give the last ${shortage}g to someone`
          : 'Each person needs at least 1g',
      };
    }

    const base = Math.floor(remaining / floatingPersonIds.length);
    const rem = remaining - base * floatingPersonIds.length;
    floatingPersonIds.forEach((fid, idx) => {
      allocations[fid] = idx === floatingPersonIds.length - 1 ? base + rem : base;
    });

    const isExact = !hasUnder1gFixed;
    return {
      allocations,
      floatingPersonIds,
      balance: 0,
      state: isExact ? 'exact' : 'under',
      doneAllowed: isExact,
      helpMessage: isExact ? `${targetGrams}g of ${targetGrams}g` : 'Left to give: 0g',
      adviceMessage: isExact ? '' : 'Each person needs at least 1g',
    };
  }

  // All people are fixed
  if (sumFixed === targetGrams) {
    const isExact = !hasUnder1gFixed;
    return {
      allocations,
      floatingPersonIds,
      balance: 0,
      state: isExact ? 'exact' : 'under',
      doneAllowed: isExact,
      helpMessage: isExact ? `${targetGrams}g of ${targetGrams}g` : 'Left to give: 0g',
      adviceMessage: isExact ? '' : 'Each person needs at least 1g',
    };
  }

  const shortage = targetGrams - sumFixed;
  return {
    allocations,
    floatingPersonIds,
    balance: shortage,
    state: 'under',
    doneAllowed: false,
    helpMessage: `Left to give: ${shortage}g`,
    adviceMessage: `Give the last ${shortage}g to someone`,
  };
}

/**
 * Produces plain, friendly plain-text summary of a bag's assignment.
 * E.g., "Zakariyya: whole bag", "Aisha, Bilal: half each", "3 people: 83g, 83g, 84g", "Unassigned".
 */
export function describeBag(
  bag: Bag | null | undefined,
  bagSize: number,
  personNames: Record<string, string>
): string {
  if (!bag || !bag.buyers || bag.buyers.length === 0 || bag.splitMode === 'unassigned') {
    return 'Unassigned';
  }

  const buyers = bag.buyers;
  if (buyers.length === 1) {
    const name = personNames[buyers[0].personId] || 'Unknown';
    return `${name}: whole bag`;
  }

  if (buyers.length === 2) {
    const name1 = personNames[buyers[0].personId] || 'Unknown';
    const name2 = personNames[buyers[1].personId] || 'Unknown';
    const g1 = buyers[0].grams;
    const g2 = buyers[1].grams;
    if (bag.splitMode === 'equal' || (g1 === g2 && g1 + g2 === bagSize)) {
      return `${name1}, ${name2}: half each`;
    }
    return `${name1} (${g1}g), ${name2} (${g2}g)`;
  }

  if (bag.splitMode === 'equal') {
    const gramAmounts = buyers.map((b) => `${b.grams}g`).join(', ');
    return `${buyers.length} people: ${gramAmounts}`;
  }

  return buyers.map((b) => `${personNames[b.personId] || 'Unknown'} (${b.grams}g)`).join(', ');
}

/**
 * Disambiguates duplicate person names by appending the last 4 digits of phone or email.
 */
export function disambiguatePersonNames(people: Person[]): Record<string, string> {
  const counts: Record<string, number> = {};
  for (const p of people) {
    const name = p.name.trim();
    counts[name] = (counts[name] || 0) + 1;
  }

  const result: Record<string, string> = {};
  for (const p of people) {
    const name = p.name.trim();
    if (counts[name] <= 1) {
      result[p.id] = name;
      continue;
    }

    // Collision: try phone digits
    if (p.phone) {
      const digits = p.phone.replace(/\D/g, '');
      if (digits.length >= 4) {
        result[p.id] = `${name} (...${digits.slice(-4)})`;
        continue;
      }
    }

    // Try email
    if (p.email) {
      result[p.id] = `${name} (${p.email})`;
      continue;
    }

    // Fallback to ID suffix
    result[p.id] = `${name} (#${p.id.slice(-4)})`;
  }

  return result;
}

/**
 * Count how many bags in a coffee lot have someone assigned to them.
 */
export function countAssignedBags(lot: CoffeeLot): number {
  const bags = normalizeLotToBags(lot);
  return bags.filter((b) => b.splitMode !== 'unassigned' && b.buyers && b.buyers.length > 0).length;
}
