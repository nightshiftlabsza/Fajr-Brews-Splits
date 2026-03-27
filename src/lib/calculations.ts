import type {
  Order,
  CoffeeLot,
  Fee,
  PersonCalculation,
  CalculationResult,
  LotPersonBreakdown,
  FeePersonBreakdown,
  LotCalculation,
  BagSplitMode,
} from '../types';
import { normalizeLotToBags } from './orderWizard';

// ─── Validation ───────────────────────────────────────────────

function validateOrder(order: Order): string[] {
  const errors: string[] = [];

  if (!order.lots || order.lots.length === 0) {
    errors.push('Order has no coffee lots.');
    return errors;
  }

  for (const lot of order.lots) {
    const bags = normalizeLotToBags(lot);
    const quantity = bags.length;
    const totalListForeignForLot = lot.foreignPricePerBag * quantity;

    if (!lot.gramsPerBag || lot.gramsPerBag < 1 || !Number.isInteger(lot.gramsPerBag)) {
      errors.push(`"${lot.name}": grams per bag must be an integer ≥ 1.`);
    }
    if (quantity < 1) {
      errors.push(`"${lot.name}": quantity must be an integer ≥ 1.`);
    }
    if (!lot.foreignPricePerBag || lot.foreignPricePerBag <= 0) {
      errors.push(`"${lot.name}": foreign price per bag must be > 0.`);
    }

    const lotTotalGrams = lot.gramsPerBag * quantity;
    const buyerGramsSum = bags.reduce(
      (s, bag) => s + bag.buyers.reduce((bs, b) => bs + b.grams, 0),
      0,
    );

    if (buyerGramsSum !== lotTotalGrams) {
      errors.push(
        `"${lot.name}": buyer grams sum (${buyerGramsSum}g) ≠ lot total (${lotTotalGrams}g).`
      );
    }

    for (const bag of bags) {
      for (const buyer of bag.buyers) {
        if (!Number.isInteger(buyer.grams) || buyer.grams < 1) {
          errors.push(`"${lot.name}": each buyer share must be an integer ≥ 1g.`);
        }
      }
    }
  }

  const totalListForeign = order.lots.reduce((sum, lot) => {
    const quantity = normalizeLotToBags(lot).length;
    return sum + lot.foreignPricePerBag * quantity;
  }, 0);

  if (totalListForeign === 0) {
    errors.push('Total foreign list price is zero — cannot allocate goods.');
  }

  if (!order.goodsTotalZar || order.goodsTotalZar <= 0) {
    errors.push('Goods total (ZAR) must be greater than zero.');
  }

  return errors;
}

// ─── Core Calculation Engine ──────────────────────────────────

export function calculate(
  order: Order,
  personNames: Record<string, string>  // personId → name (for split-with display)
): CalculationResult {
  const validationErrors = validateOrder(order);
  const isValid = validationErrors.length === 0;

  if (!isValid) {
    return {
      personIds: [],
      personCalcs: {},
      totalOrderZar: 0,
      totalGoodsZar: 0,
      totalFeesZar: 0,
      roundingAbsorbed: 0,
      lotGoodsZar: {},
      lotCalcs: [],
      isValid: false,
      validationErrors,
    };
  }

  // ── A. Lot foreign totals ────────────────────────────────────
  const lotBagsCache = new Map<string, ReturnType<typeof normalizeLotToBags>>();
  for (const lot of order.lots) {
    lotBagsCache.set(lot.id, normalizeLotToBags(lot));
  }

  const totalListForeignAll = order.lots.reduce((sum, lot) => {
    const quantity = lotBagsCache.get(lot.id)!.length;
    return sum + lot.foreignPricePerBag * quantity;
  }, 0);

  // lotId → allocated goods ZAR (full precision)
  const lotGoodsZar: Record<string, number> = {};
  for (const lot of order.lots) {
    const quantity = lotBagsCache.get(lot.id)!.length;
    const lotTotalForeign = lot.foreignPricePerBag * quantity;
    lotGoodsZar[lot.id] = (lotTotalForeign / totalListForeignAll) * order.goodsTotalZar;
  }

  // ── B. Collect all participating person IDs ──────────────────
  const personIdSet = new Set<string>();
  for (const lot of order.lots) {
    for (const bag of lotBagsCache.get(lot.id)!) {
      for (const buyer of bag.buyers) {
        if (buyer.personId.trim() && buyer.grams > 0) {
          personIdSet.add(buyer.personId);
        }
      }
    }
  }
  const personIds = Array.from(personIdSet);

  // ── Per-person accumulators (full precision) ──────────────
  const personGoods: Record<string, number> = {};
  const personCoffeeValueForeign: Record<string, number> = {};
  const personLotBreakdowns: Record<string, LotPersonBreakdown[]> = {};
  const personTotalGrams: Record<string, number> = {};

  for (const pid of personIds) {
    personGoods[pid] = 0;
    personCoffeeValueForeign[pid] = 0;
    personLotBreakdowns[pid] = [];
    personTotalGrams[pid] = 0;
  }

  for (const lot of order.lots) {
    const bags = lotBagsCache.get(lot.id)!;
    const quantity = bags.length;
    const lotTotalGrams = lot.gramsPerBag * quantity;
    const lotTotalForeign = lot.foreignPricePerBag * quantity;
    const lotGoodsZarForThisLot = lotGoodsZar[lot.id];

    for (let bagIndex = 0; bagIndex < bags.length; bagIndex++) {
      const bag = bags[bagIndex];

      const bagSplitWith = bag.buyers
        .filter((buyer) => buyer.personId.trim().length > 0 && buyer.grams > 0)
        .map((buyer) => buyer.personId);

      // Map BagSplitMode to the breakdown's bagMode
      const bagMode: BagSplitMode = bag.splitMode;

      for (const buyer of bag.buyers) {
        const pid = buyer.personId;
        if (!pid || buyer.grams <= 0 || !personIds.includes(pid)) continue;

        // Goods ZAR for this share
        const shareGoodsZar = (buyer.grams / lotTotalGrams) * lotGoodsZarForThisLot;
        personGoods[pid] += shareGoodsZar;
        personTotalGrams[pid] += buyer.grams;

        // Coffee value foreign (for value_based fees)
        const shareForeign = (buyer.grams / lotTotalGrams) * lotTotalForeign;
        personCoffeeValueForeign[pid] += shareForeign;

        const otherSharers = bagSplitWith
          .filter((buyerId) => buyerId !== pid)
          .map((buyerId) => personNames[buyerId] || 'Unknown');

        personLotBreakdowns[pid].push({
          id: `${lot.id}-${bagIndex}-${buyer.id}`,
          lotId: lot.id,
          lotName: lot.name,
          bagIndex,
          bagMode,
          shareGrams: buyer.grams,
          gramsPerBag: lot.gramsPerBag,
          lotQuantity: quantity,
          goodsZar: shareGoodsZar,
          feesZar: 0,
          totalZar: shareGoodsZar,
          splitWith: otherSharers,
        });
      }
    }
  }

  // ── C. Ratios for fee allocation ─────────────────────────────
  const totalCoffeeValueForeign = personIds.reduce(
    (s, pid) => s + personCoffeeValueForeign[pid],
    0
  );

  const coffeeValueForeignShare: Record<string, number> = {};

  for (const pid of personIds) {
    coffeeValueForeignShare[pid] =
      totalCoffeeValueForeign > 0 ? personCoffeeValueForeign[pid] / totalCoffeeValueForeign : 0;
  }

  // ── E. Fee allocation ─────────────────────────────────────────
  const eligiblePeople = personIds.filter((pid) => personTotalGrams[pid] > 0);
  const personFees: Record<string, number> = {};
  for (const pid of personIds) personFees[pid] = 0;

  const personFeeBreakdowns: Record<string, FeePersonBreakdown[]> = {};
  for (const pid of personIds) personFeeBreakdowns[pid] = [];

  for (const fee of order.fees) {
    const feeBreakdownForLater: Record<string, number> = {};

    if (fee.allocationType === 'fixed_shared') {
      if (eligiblePeople.length === 0) continue; // guard: no participants
      const perPerson = fee.amountZar / eligiblePeople.length;
      for (const pid of eligiblePeople) {
        personFees[pid] += perPerson;
        feeBreakdownForLater[pid] = perPerson;
      }
    } else if (fee.allocationType === 'value_based') {
      for (const pid of personIds) {
        const share = coffeeValueForeignShare[pid] * fee.amountZar;
        personFees[pid] += share;
        feeBreakdownForLater[pid] = share;
      }
    }

    // Add fee breakdown to each person's record
    for (const pid of personIds) {
      const amt = feeBreakdownForLater[pid];
      if (amt !== undefined) {
        personFeeBreakdowns[pid].push({
          feeId: fee.id,
          label: fee.label,
          allocationType: fee.allocationType,
          amountZar: amt,
        });
      }
    }
  }

  // Distribute each person's already-allocated fees down to their coffee lines.
  for (const pid of personIds) {
    const lineItems = personLotBreakdowns[pid];
    if (lineItems.length === 0 || personGoods[pid] <= 0) {
      continue;
    }

    for (const feeBreakdown of personFeeBreakdowns[pid]) {
      for (const lb of lineItems) {
        const lineShare = lb.goodsZar / personGoods[pid];
        const lineFee = lineShare * feeBreakdown.amountZar;
        lb.feesZar += lineFee;
      }
    }

    for (const lb of lineItems) {
      lb.totalZar = lb.goodsZar + lb.feesZar;
    }
  }

  const lotCalcMap = new Map<string, LotCalculation>();
  for (const lot of order.lots) {
    const quantity = lotBagsCache.get(lot.id)!.length;
    lotCalcMap.set(lot.id, {
      lotId: lot.id,
      lotName: lot.name,
      quantity,
      gramsPerBag: lot.gramsPerBag,
      totalGrams: lot.gramsPerBag * quantity,
      goodsZar: 0,
      feesZar: 0,
      totalZar: 0,
      finalZarPerBag: 0,
    });
  }

  for (const pid of personIds) {
    for (const lb of personLotBreakdowns[pid]) {
      const lotCalc = lotCalcMap.get(lb.lotId);
      if (!lotCalc) continue;
      lotCalc.goodsZar += lb.goodsZar;
      lotCalc.feesZar += lb.feesZar;
      lotCalc.totalZar += lb.totalZar;
    }
  }

  const lotCalcs = order.lots
    .map((lot) => {
      const quantity = lotBagsCache.get(lot.id)!.length;
      const lotCalc = lotCalcMap.get(lot.id);
      if (!lotCalc) {
        return {
          lotId: lot.id,
          lotName: lot.name,
          quantity,
          gramsPerBag: lot.gramsPerBag,
          totalGrams: lot.gramsPerBag * quantity,
          goodsZar: 0,
          feesZar: 0,
          totalZar: 0,
          finalZarPerBag: 0,
        };
      }

      return {
        ...lotCalc,
        finalZarPerBag: quantity > 0 ? lotCalc.totalZar / quantity : 0,
      };
    });

  // ── F. Totals pre-round (full precision) ──────────────────────
  const personTotalsPreRound: Record<string, number> = {};
  for (const pid of personIds) {
    personTotalsPreRound[pid] = personGoods[pid] + personFees[pid];
  }

  const totalOrderZar =
    order.goodsTotalZar + order.fees.reduce((s, f) => s + f.amountZar, 0);
  const totalFeesZar = order.fees.reduce((s, f) => s + f.amountZar, 0);

  // ── G. Rounding — non-payer floored, payer absorbs remainder ──
  const personTotalsFinal: Record<string, number> = {};
  let sumNonPayer = 0;

  const payerId = order.payerId;

  for (const pid of personIds) {
    if (pid !== payerId) {
      // Floor to 2 decimal places — never overcharge
      const floored = Math.floor(personTotalsPreRound[pid] * 100) / 100;
      personTotalsFinal[pid] = floored;
      sumNonPayer += floored;
    }
  }

  if (payerId && personIds.includes(payerId)) {
    // Payer absorbs any remainder
    personTotalsFinal[payerId] =
      Math.round((totalOrderZar - sumNonPayer) * 100) / 100;
  } else if (payerId && !personIds.includes(payerId)) {
    personTotalsFinal[payerId ?? ''] = 0;
  }

  const roundingAbsorbed = payerId
    ? (personTotalsFinal[payerId] ?? 0) - (personTotalsPreRound[payerId] ?? 0)
    : 0;

  // ── Build PersonCalculation objects ──────────────────────────
  const personCalcs: Record<string, PersonCalculation> = {};

  for (const pid of personIds) {
    personCalcs[pid] = {
      personId: pid,
      totalGrams: personTotalGrams[pid],
      goodsZar: personGoods[pid],
      feesZar: personFees[pid],
      totalPreRound: personTotalsPreRound[pid],
      totalFinal: personTotalsFinal[pid],
      coffeeValueForeignShare: coffeeValueForeignShare[pid],
      lotBreakdowns: personLotBreakdowns[pid],
      feeBreakdowns: personFeeBreakdowns[pid],
    };
  }

  return {
    personIds,
    personCalcs,
    totalOrderZar,
    totalGoodsZar: order.goodsTotalZar,
    totalFeesZar,
    roundingAbsorbed,
    lotGoodsZar,
    lotCalcs,
    isValid: true,
    validationErrors: [],
  };
}

// ─── Helpers ──────────────────────────────────────────────────

/** Returns remaining grams for a lot (lot total − sum of buyer grams) */
export function remainingGrams(lot: CoffeeLot): number {
  const bags = normalizeLotToBags(lot);
  const lotTotal = lot.gramsPerBag * bags.length;
  const allocated = bags.reduce(
    (s, bag) => s + bag.buyers.reduce((bs, b) => bs + (b.grams || 0), 0),
    0,
  );
  return lotTotal - allocated;
}

/** True if buyer grams for every lot sum exactly to lot total grams */
export function allLotsBalanced(lots: CoffeeLot[]): boolean {
  return lots.every((lot) => {
    const bags = normalizeLotToBags(lot);
    const lotTotal = lot.gramsPerBag * bags.length;
    const allocated = bags.reduce(
      (s, bag) => s + bag.buyers.reduce((bs, b) => bs + (b.grams || 0), 0),
      0,
    );
    return allocated === lotTotal;
  });
}

/** Sum of all fee amounts */
export function totalFees(fees: Fee[]): number {
  return fees.reduce((s, f) => s + (f.amountZar || 0), 0);
}
