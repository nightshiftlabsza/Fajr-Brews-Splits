import { describe, expect, it } from 'vitest';
import {
  addBagToBags,
  assignFullBag,
  calculateEqualSplitGrams,
  createEmptyBag,
  createEmptyBags,
  formatBagSummary,
  formatLotAllocationSummary,
  proposeAllocationForLot,
  removeBagFromBags,
  setCustomSplit,
  splitBagEqually,
} from './allocationInference';
import type { Bag } from '../types';

describe('allocationInference', () => {
  describe('calculateEqualSplitGrams', () => {
    it('splits 250g equally among 2 buyers', () => {
      expect(calculateEqualSplitGrams(250, 2)).toEqual([125, 125]);
    });

    it('splits 250g among 3 buyers with deterministic remainder to last buyer', () => {
      const split = calculateEqualSplitGrams(250, 3);
      expect(split).toEqual([83, 83, 84]);
      expect(split.reduce((a, b) => a + b, 0)).toBe(250);
      expect(split.every((g) => Number.isInteger(g))).toBe(true);
    });

    it('splits 250g among 7 buyers with integers reconciling exactly to 250g', () => {
      const split = calculateEqualSplitGrams(250, 7);
      expect(split.reduce((a, b) => a + b, 0)).toBe(250);
      expect(split.every((g) => Number.isInteger(g))).toBe(true);
      expect(split).toEqual([35, 35, 35, 35, 35, 35, 40]);
    });

    it('splits 1000g among 4 buyers', () => {
      expect(calculateEqualSplitGrams(1000, 4)).toEqual([250, 250, 250, 250]);
    });

    it('handles 1 buyer and 0 buyers gracefully', () => {
      expect(calculateEqualSplitGrams(250, 1)).toEqual([250]);
      expect(calculateEqualSplitGrams(250, 0)).toEqual([]);
    });
  });

  describe('proposeAllocationForLot - Scenarios 1-6', () => {
    it('Scenario 1: 1 bag, 1 buyer -> assigns full bag', () => {
      const bags = createEmptyBags(1);
      const result = proposeAllocationForLot(bags, ['abdul'], 250);
      expect(result).toHaveLength(1);
      expect(result[0].splitMode).toBe('full');
      expect(result[0].buyers).toEqual([{ id: expect.any(String), personId: 'abdul', grams: 250 }]);
    });

    it('Scenario 2: 1 bag, 2 buyers -> auto equal split (125/125)', () => {
      const bags = createEmptyBags(1);
      const result = proposeAllocationForLot(bags, ['abdul', 'ahmed'], 250);
      expect(result).toHaveLength(1);
      expect(result[0].splitMode).toBe('equal');
      expect(result[0].buyers).toHaveLength(2);
      expect(result[0].buyers[0].grams).toBe(125);
      expect(result[0].buyers[1].grams).toBe(125);
    });

    it('Scenario 3: 1 bag, 3 buyers -> auto equal split (83/83/84)', () => {
      const bags = createEmptyBags(1);
      const result = proposeAllocationForLot(bags, ['abdul', 'ahmed', 'yusuf'], 250);
      expect(result).toHaveLength(1);
      expect(result[0].splitMode).toBe('equal');
      expect(result[0].buyers[0].grams).toBe(83);
      expect(result[0].buyers[1].grams).toBe(83);
      expect(result[0].buyers[2].grams).toBe(84);
    });

    it('Scenario 4: 2 bags, 2 buyers -> 1 bag each', () => {
      const bags = createEmptyBags(2);
      const result = proposeAllocationForLot(bags, ['abdul', 'ahmed'], 250);
      expect(result).toHaveLength(2);
      expect(result[0].splitMode).toBe('full');
      expect(result[0].buyers[0].personId).toBe('abdul');
      expect(result[0].buyers[0].grams).toBe(250);
      expect(result[1].splitMode).toBe('full');
      expect(result[1].buyers[0].personId).toBe('ahmed');
      expect(result[1].buyers[0].grams).toBe(250);
    });

    it('Scenario 5: 3 bags, 3 buyers -> 1 bag each', () => {
      const bags = createEmptyBags(3);
      const result = proposeAllocationForLot(bags, ['abdul', 'ahmed', 'yusuf'], 250);
      expect(result).toHaveLength(3);
      expect(result[0].buyers[0].personId).toBe('abdul');
      expect(result[1].buyers[0].personId).toBe('ahmed');
      expect(result[2].buyers[0].personId).toBe('yusuf');
    });

    it('Scenario 6: 3 bags, 2 buyers -> distributes whole bags', () => {
      const bags = createEmptyBags(3);
      const result = proposeAllocationForLot(bags, ['abdul', 'ahmed'], 250);
      expect(result).toHaveLength(3);
      expect(result[0].buyers[0].personId).toBe('abdul');
      expect(result[1].buyers[0].personId).toBe('ahmed');
      expect(result[2].buyers[0].personId).toBe('abdul');
    });
  });

  describe('Non-destructive preservation & safety', () => {
    it('adding a 4th bag to 3 already-allocated bags leaves Bags 1-3 untouched', () => {
      const initialBags: Bag[] = [
        { id: 'b1', splitMode: 'full', buyers: [{ id: 'bb1', personId: 'abdul', grams: 250 }] },
        { id: 'b2', splitMode: 'full', buyers: [{ id: 'bb2', personId: 'ahmed', grams: 250 }] },
        { id: 'b3', splitMode: 'full', buyers: [{ id: 'bb3', personId: 'yusuf', grams: 250 }] },
      ];

      const withNewBag = addBagToBags(initialBags);
      expect(withNewBag).toHaveLength(4);
      expect(withNewBag[0]).toEqual(initialBags[0]);
      expect(withNewBag[1]).toEqual(initialBags[1]);
      expect(withNewBag[2]).toEqual(initialBags[2]);
      expect(withNewBag[3].splitMode).toBe('unassigned');
    });

    it('custom split (200g/50g) is preserved and never overwritten by proposeAllocation', () => {
      const customBag: Bag = {
        id: 'b1',
        splitMode: 'custom',
        buyers: [
          { id: 'cb1', personId: 'abdul', grams: 200 },
          { id: 'cb2', personId: 'ahmed', grams: 50 },
        ],
      };
      const unassignedBag = createEmptyBag();

      const existingBags = [customBag, unassignedBag];

      // Propose allocation when a new buyer 'yusuf' is added to the lot
      const result = proposeAllocationForLot(existingBags, ['abdul', 'ahmed', 'yusuf'], 250);

      // Bag 1 must remain exactly the custom 200g/50g split
      expect(result[0]).toEqual(customBag);
      expect(result[0].buyers[0].grams).toBe(200);
      expect(result[0].buyers[1].grams).toBe(50);

      // Bag 2 gets the unassigned buyer 'yusuf'
      expect(result[1].splitMode).toBe('full');
      expect(result[1].buyers[0].personId).toBe('yusuf');
    });

    it('editing one bag does not affect other bags', () => {
      const bag1: Bag = { id: 'b1', splitMode: 'full', buyers: [{ id: 'bb1', personId: 'abdul', grams: 250 }] };
      const bag2: Bag = { id: 'b2', splitMode: 'full', buyers: [{ id: 'bb2', personId: 'ahmed', grams: 250 }] };

      // Split bag 1 into equal split with a 3rd person
      const modifiedBag1 = splitBagEqually(bag1, ['abdul', 'yusuf'], 250);
      const bags = [modifiedBag1, bag2];

      expect(bags[0].splitMode).toBe('equal');
      expect(bags[0].buyers).toHaveLength(2);
      expect(bags[1]).toEqual(bag2); // Bag 2 unchanged
    });

    it('removing a bag does not alter remaining bag allocations', () => {
      const bag1: Bag = { id: 'b1', splitMode: 'full', buyers: [{ id: 'bb1', personId: 'abdul', grams: 250 }] };
      const bag2: Bag = { id: 'b2', splitMode: 'custom', buyers: [{ id: 'cb1', personId: 'ahmed', grams: 150 }, { id: 'cb2', personId: 'yusuf', grams: 100 }] };
      const bag3: Bag = { id: 'b3', splitMode: 'full', buyers: [{ id: 'bb3', personId: 'zayd', grams: 250 }] };

      const afterRemoval = removeBagFromBags([bag1, bag2, bag3], 'b1');
      expect(afterRemoval).toHaveLength(2);
      expect(afterRemoval[0]).toEqual(bag2);
      expect(afterRemoval[1]).toEqual(bag3);
    });
  });

  describe('Summaries & Human formatting', () => {
    const names = { abdul: 'Abdul', ahmed: 'Ahmed', yusuf: 'Yusuf' };

    it('formats single full bag summary', () => {
      const bag = assignFullBag(createEmptyBag(), 'abdul', 250);
      expect(formatBagSummary(bag, 250, names)).toBe('Abdul · Full bag (250g)');
    });

    it('formats equal split summary', () => {
      const bag = splitBagEqually(createEmptyBag(), ['abdul', 'ahmed'], 250);
      expect(formatBagSummary(bag, 250, names)).toBe('Abdul + Ahmed · Split equally (125g each)');
    });

    it('formats custom split summary', () => {
      const bag = setCustomSplit(createEmptyBag(), [
        { personId: 'abdul', grams: 200 },
        { personId: 'ahmed', grams: 50 },
      ]);
      expect(formatBagSummary(bag, 250, names)).toBe('Abdul (200g) + Ahmed (50g) · Custom split');
    });

    it('formats lot allocation summary for 2 bags 2 buyers', () => {
      const bags = [
        assignFullBag(createEmptyBag(), 'abdul', 250),
        assignFullBag(createEmptyBag(), 'ahmed', 250),
      ];
      const summary = formatLotAllocationSummary(bags, 250, names);
      expect(summary.headline).toBe('2 bags · 1 bag each');
      expect(summary.subtext).toBe('Abdul, Ahmed');
      expect(summary.isComplete).toBe(true);
    });
  });
});
