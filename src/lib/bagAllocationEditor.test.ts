import { describe, expect, it } from 'vitest';
import type { Bag, CoffeeLot, Person } from '../types';
import {
  computeCustomSplit,
  computeEqualSplit,
  countAssignedBags,
  describeBag,
  disambiguatePersonNames,
} from './bagAllocationEditor';

describe('bagAllocationEditor', () => {
  describe('computeEqualSplit', () => {
    it('returns empty array when no people or invalid bag size', () => {
      expect(computeEqualSplit(250, [])).toEqual([]);
      expect(computeEqualSplit(0, ['p-1'])).toEqual([]);
      expect(computeEqualSplit(-10, ['p-1'])).toEqual([]);
    });

    it('assigns whole bag (100%) to 1 person', () => {
      expect(computeEqualSplit(250, ['p-1'])).toEqual([
        { personId: 'p-1', grams: 250 },
      ]);
    });

    it('splits equally (50% each) between 2 people', () => {
      expect(computeEqualSplit(250, ['p-1', 'p-2'])).toEqual([
        { personId: 'p-1', grams: 125 },
        { personId: 'p-2', grams: 125 },
      ]);
    });

    it('splits with floor division and remainder to the last person for 3 people (83g, 83g, 84g)', () => {
      const split = computeEqualSplit(250, ['p-1', 'p-2', 'p-3']);
      expect(split).toEqual([
        { personId: 'p-1', grams: 83 },
        { personId: 'p-2', grams: 83 },
        { personId: 'p-3', grams: 84 },
      ]);
      const total = split.reduce((acc, curr) => acc + curr.grams, 0);
      expect(total).toBe(250);
    });

    it('splits with remainder to the last person for 4 people on 250g (62g, 62g, 62g, 64g)', () => {
      const split = computeEqualSplit(250, ['p-1', 'p-2', 'p-3', 'p-4']);
      expect(split).toEqual([
        { personId: 'p-1', grams: 62 },
        { personId: 'p-2', grams: 62 },
        { personId: 'p-3', grams: 62 },
        { personId: 'p-4', grams: 64 },
      ]);
      expect(split.reduce((acc, curr) => acc + curr.grams, 0)).toBe(250);
    });
  });

  describe('computeCustomSplit', () => {
    it('returns under state when personIds is empty', () => {
      const result = computeCustomSplit(250, [], {});
      expect(result.state).toBe('under');
      expect(result.balance).toBe(250);
      expect(result.doneAllowed).toBe(false);
      expect(result.helpMessage).toBe('Left to give: 250g');
    });

    it('splits remaining grams across floating people when one is fixed', () => {
      // 250g bag, Alice fixed at 100g, Bob and Cara floating (share remaining 150g = 75g each)
      const result = computeCustomSplit(250, ['alice', 'bob', 'cara'], {
        alice: 100,
        bob: null,
        cara: undefined,
      });

      expect(result.state).toBe('exact');
      expect(result.balance).toBe(0);
      expect(result.doneAllowed).toBe(true);
      expect(result.allocations).toEqual({
        alice: 100,
        bob: 75,
        cara: 75,
      });
      expect(result.helpMessage).toBe('250g of 250g');
    });

    it('absorbs remainder to last floating person when remaining is not divisible', () => {
      // 250g bag, Alice fixed at 100g, Bob and Cara and Dave floating (share remaining 150g -> 50g each)
      // If Alice fixed at 101g, remaining is 149g across 3 -> 49, 49, 51
      const result = computeCustomSplit(250, ['alice', 'bob', 'cara', 'dave'], {
        alice: 101,
      });
      expect(result.allocations).toEqual({
        alice: 101,
        bob: 49,
        cara: 49,
        dave: 51,
      });
      expect(result.allocations.alice + result.allocations.bob + result.allocations.cara + result.allocations.dave).toBe(250);
      expect(result.doneAllowed).toBe(true);
    });

    it('detects over-allocated bags', () => {
      const result = computeCustomSplit(250, ['alice', 'bob'], {
        alice: 150,
        bob: 120, // 270g total = 20g over
      });
      expect(result.state).toBe('over');
      expect(result.balance).toBe(20);
      expect(result.doneAllowed).toBe(false);
      expect(result.helpMessage).toBe('Over by 20g');
      expect(result.adviceMessage).toBe('Take 20g away');
    });

    it('detects under-allocated bags when no one is floating', () => {
      const result = computeCustomSplit(250, ['alice', 'bob'], {
        alice: 100,
        bob: 100, // 200g total = 50g under
      });
      expect(result.state).toBe('under');
      expect(result.balance).toBe(50);
      expect(result.doneAllowed).toBe(false);
      expect(result.helpMessage).toBe('Left to give: 50g');
      expect(result.adviceMessage).toBe('Give the last 50g to someone');
    });

    it('confirms exact match when all are fixed and sum matches bagSize', () => {
      const result = computeCustomSplit(250, ['alice', 'bob'], {
        alice: 150,
        bob: 100,
      });
      expect(result.state).toBe('exact');
      expect(result.balance).toBe(0);
      expect(result.doneAllowed).toBe(true);
      expect(result.helpMessage).toBe('250g of 250g');
    });

    it('disallows done when adding a person while in custom mode but not enough grams remain for floating person (>= 1g required)', () => {
      // Alice fixed at 250g, Bob joins floating. Remaining is 0g.
      // Bob cannot get 0g in a shared bag! Done must be false.
      const result = computeCustomSplit(250, ['alice', 'bob'], {
        alice: 250,
        bob: null,
      });
      expect(result.doneAllowed).toBe(false);
      expect(result.state).toBe('under');
      expect(result.adviceMessage).toBe('Each person needs at least 1g');
    });

    it('disallows done when fixed amount is less than 1g', () => {
      const result = computeCustomSplit(250, ['alice', 'bob'], {
        alice: 0,
        bob: 250,
      });
      expect(result.doneAllowed).toBe(false);
      expect(result.adviceMessage).toBe('Each person needs at least 1g');
    });
  });

  describe('describeBag', () => {
    const names = {
      'p-1': 'Zakariyya',
      'p-2': 'Aisha',
      'p-3': 'Bilal',
      'p-4': 'Cara',
    };

    it('handles unassigned bags or empty buyers', () => {
      expect(describeBag(null, 250, names)).toBe('Unassigned');
      expect(
        describeBag(
          { id: 'b-1', splitMode: 'unassigned', buyers: [] },
          250,
          names
        )
      ).toBe('Unassigned');
    });

    it('formats single person as whole bag', () => {
      const bag: Bag = {
        id: 'b-1',
        splitMode: 'full',
        buyers: [{ id: 'buyer-1', personId: 'p-1', grams: 250 }],
      };
      expect(describeBag(bag, 250, names)).toBe('Zakariyya: whole bag');
    });

    it('formats two people equal split as "half each"', () => {
      const bag: Bag = {
        id: 'b-1',
        splitMode: 'equal',
        buyers: [
          { id: 'buyer-1', personId: 'p-2', grams: 125 },
          { id: 'buyer-2', personId: 'p-3', grams: 125 },
        ],
      };
      expect(describeBag(bag, 250, names)).toBe('Aisha, Bilal: half each');
    });

    it('formats two people custom split with gram amounts', () => {
      const bag: Bag = {
        id: 'b-1',
        splitMode: 'custom',
        buyers: [
          { id: 'buyer-1', personId: 'p-2', grams: 150 },
          { id: 'buyer-2', personId: 'p-3', grams: 100 },
        ],
      };
      expect(describeBag(bag, 250, names)).toBe('Aisha (150g), Bilal (100g)');
    });

    it('formats 3+ people equal split with grams', () => {
      const bag: Bag = {
        id: 'b-1',
        splitMode: 'equal',
        buyers: [
          { id: 'buyer-1', personId: 'p-1', grams: 83 },
          { id: 'buyer-2', personId: 'p-2', grams: 83 },
          { id: 'buyer-3', personId: 'p-3', grams: 84 },
        ],
      };
      expect(describeBag(bag, 250, names)).toBe('3 people: 83g, 83g, 84g');
    });
  });

  describe('disambiguatePersonNames', () => {
    it('returns original names when no collisions exist', () => {
      const people: Person[] = [
        { id: 'p-1', workspaceId: 'w-1', name: 'Alice', createdAt: '', updatedAt: '' },
        { id: 'p-2', workspaceId: 'w-1', name: 'Bob', createdAt: '', updatedAt: '' },
      ];
      expect(disambiguatePersonNames(people)).toEqual({
        'p-1': 'Alice',
        'p-2': 'Bob',
      });
    });

    it('disambiguates identical names using phone ending or email', () => {
      const people: Person[] = [
        {
          id: 'p-1',
          workspaceId: 'w-1',
          name: 'Zakariyya',
          phone: '+27 82 123 4567',
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'p-2',
          workspaceId: 'w-1',
          name: 'Zakariyya',
          email: 'zak@example.com',
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'p-3',
          workspaceId: 'w-1',
          name: 'Zakariyya',
          createdAt: '',
          updatedAt: '',
        },
      ];
      const names = disambiguatePersonNames(people);
      expect(names['p-1']).toBe('Zakariyya (...4567)');
      expect(names['p-2']).toBe('Zakariyya (zak@example.com)');
      expect(names['p-3']).toBe('Zakariyya (#p-3)');
    });
  });

  describe('countAssignedBags', () => {
    it('counts only bags with buyers assigned', () => {
      const lot: CoffeeLot = {
        id: 'lot-1',
        name: 'Kenya AA',
        foreignPricePerBag: 18.5,
        gramsPerBag: 250,
        quantity: 2,
        shares: [],
        bags: [
          { id: 'b-1', splitMode: 'full', buyers: [{ id: 'buyer-1', personId: 'p-1', grams: 250 }] },
          { id: 'b-2', splitMode: 'unassigned', buyers: [] },
        ],
      };
      expect(countAssignedBags(lot)).toBe(1);
    });
  });
});
