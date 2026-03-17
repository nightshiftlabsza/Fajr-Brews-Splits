import type {
  Order,
  CoffeeLot,
  Fee,
  PersonCalculation,
  CalculationResult,
  LotPersonBreakdown,
  FeePersonBreakdown,
} from '../types';

// ─── Validation ───────────────────────────────────────────────

function validateOrder(order: Order): string[] {
  const errors: string[] = [];

  if (!order.lots || order.lots.length === 0) {
    errors.push('Order has no coffee lots.');
    return errors;
  }

  const totalListForeign = order.lots.reduce(
    (sum, lot) => sum + lot.foreignPricePerBag * lot.quantity,
    0
  );

  if (totalListForeign === 0) {
    errors.push('Total foreign list price is zero — cannot allocate goods.');
  }

  if (!order.goodsTotalZar || order.goodsTotalZar <= 0) {
    errors.push('Goods total (ZAR) must be greater than zero.');
  }

  for (const lot of order.lots) {
    if (!lot.gramsPerBag || lot.gramsPerBag < 1 || !Number.isInteger(lot.gramsPerBag)) {
      errors.push(`"${lot.name}": grams per bag must be an integer ≥ 1.`);
    }
    if (!lot.quantity || lot.quantity < 1 || !Number.isInteger(lot.quantity)) {
      errors.push(`"${lot.name}": quantity must be an integer ≥ 1.`);
    }
    if (!lot.foreignPricePerBag || lot.foreignPricePerBag <= 0) {
      errors.push(`"${lot.name}": foreign price per bag must be > 0.`);
    }

    const lotTotalGrams = lot.gramsPerBag * lot.quantity;
    const shareSum = lot.shares.reduce((s, sh) => s + sh.shareGrams, 0);

    if (shareSum !== lotTotalGrams) {
      errors.push(
        `"${lot.name}": share grams sum (${shareSum}g) ≠ lot total (${lotTotalGrams}g).`
      );
    }

    for (const share of lot.shares) {
      if (!Number.isInteger(share.shareGrams) || share.shareGrams < 1) {
        errors.push(`"${lot.name}": each share must be an integer ≥ 1g.`);
      }
    }
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
      isValid: false,
      validationErrors,
    };
  }

  // ── A. Lot foreign totals ────────────────────────────────────
  const totalListForeignAll = order.lots.reduce(
    (sum, lot) => sum + lot.foreignPricePerBag * lot.quantity,
    0
  );

  // lotId → allocated goods ZAR (full precision)
  const lotGoodsZar: Record<string, number> = {};
  for (const lot of order.lots) {
    const lotTotalForeign = lot.foreignPricePerBag * lot.quantity;
    lotGoodsZar[lot.id] = (lotTotalForeign / totalListForeignAll) * order.goodsTotalZar;
  }

  // ── B. Collect all participating person IDs ──────────────────
  const personIdSet = new Set<string>();
  for (const lot of order.lots) {
    for (const share of lot.shares) {
      if (share.shareGrams > 0) personIdSet.add(share.personId);
    }
  }
  const personIds = Array.from(personIdSet);

  // ── B. Per-person accumulators (full precision) ──────────────
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
    const lotTotalGrams = lot.gramsPerBag * lot.quantity;
    const lotTotalForeign = lot.foreignPricePerBag * lot.quantity;
    const lotGoodsZarForThisLot = lotGoodsZar[lot.id];

    for (const share of lot.shares) {
      const pid = share.personId;
      if (!personIds.includes(pid)) continue;

      // B. Goods ZAR for this share
      const shareGoodsZar = (share.shareGrams / lotTotalGrams) * lotGoodsZarForThisLot;
      personGoods[pid] += shareGoodsZar;
      personTotalGrams[pid] += share.shareGrams;

      // C. Coffee value foreign (for value_based fees)
      const shareForeign = (share.shareGrams / lotTotalGrams) * lotTotalForeign;
      personCoffeeValueForeign[pid] += shareForeign;

      // Build lot breakdown for invoices
      const otherSharers = lot.shares
        .filter((s) => s.personId !== pid && s.shareGrams > 0)
        .map((s) => personNames[s.personId] || 'Unknown');

      personLotBreakdowns[pid].push({
        lotId: lot.id,
        lotName: lot.name,
        shareGrams: share.shareGrams,
        gramsPerBag: lot.gramsPerBag,
        lotQuantity: lot.quantity,
        goodsZar: shareGoodsZar,
        valueBasedFeesZar: 0, // will be updated below
        splitWith: otherSharers,
      });
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

  // Track total value-based fee amount to distribute to lots
  let totalValueBasedFeesZarAcrossOrder = 0;

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
      totalValueBasedFeesZarAcrossOrder += fee.amountZar;
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

  // Distribute value-based fees to person lot breakdowns
  for (const pid of personIds) {
    const pValueShare = coffeeValueForeignShare[pid];
    if (pValueShare === 0 || totalValueBasedFeesZarAcrossOrder === 0) continue;

    for (const lb of personLotBreakdowns[pid]) {
      const lot = order.lots.find(l => l.id === lb.lotId);
      if (!lot) continue;

      const lotTotalGrams = lot.gramsPerBag * lot.quantity;
      const lotTotalForeign = lot.foreignPricePerBag * lot.quantity;
      const totalOrderForeign = order.lots.reduce((s, l) => s + l.foreignPricePerBag * l.quantity, 0);

      const shareForeign = (lb.shareGrams / lotTotalGrams) * lotTotalForeign;
      const shareValueBasedFee = (shareForeign / totalOrderForeign) * totalValueBasedFeesZarAcrossOrder;
      lb.valueBasedFeesZar = shareValueBasedFee;
    }
  }

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
    // Payer is not in the order (unusual but possible)
    // Just round normally
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
    isValid: true,
    validationErrors: [],
  };
}

// ─── Helpers ──────────────────────────────────────────────────

/** Returns remaining grams for a lot (lot total − sum of shares) */
export function remainingGrams(lot: CoffeeLot): number {
  const lotTotal = lot.gramsPerBag * lot.quantity;
  const allocated = lot.shares.reduce((s, sh) => s + (sh.shareGrams || 0), 0);
  return lotTotal - allocated;
}

/** True if shares for every lot sum exactly to lot total grams */
export function allLotsBalanced(lots: CoffeeLot[]): boolean {
  return lots.every((lot) => {
    const lotTotal = lot.gramsPerBag * lot.quantity;
    const allocated = lot.shares.reduce((s, sh) => s + (sh.shareGrams || 0), 0);
    return allocated === lotTotal;
  });
}

/** Sum of all fee amounts */
export function totalFees(fees: Fee[]): number {
  return fees.reduce((s, f) => s + (f.amountZar || 0), 0);
}
