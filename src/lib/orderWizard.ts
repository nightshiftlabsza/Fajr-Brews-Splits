import type {
  Bag,
  BagBuyer,
  BagSplitMode,
  CoffeeLot,
  LotBagAllocation,
  LotBagParticipant,
  Order,
  ShareLine,
} from '../types';

export type OrderWizardStep = 'setup' | 'coffees' | 'goods' | 'summary';

export const ORDER_WIZARD_STEPS: { id: OrderWizardStep; label: string; shortLabel: string }[] = [
  { id: 'setup', label: 'Setup details', shortLabel: 'Setup' },
  { id: 'coffees', label: 'Add coffees & assign buyers', shortLabel: 'Coffees' },
  { id: 'goods', label: 'Goods and fees', shortLabel: 'Goods' },
  { id: 'summary', label: 'Summary', shortLabel: 'Summary' },
];

export type BagParticipantDraft = LotBagParticipant;
export type BagAllocationDraft = LotBagAllocation;

export interface LotBagStatus {
  tone: 'complete' | 'warning' | 'error';
  label: string;
  assignedBags: number;
  emptyBags: number;
  splitAttentionBags: number;
  totalBags: number;
}

function uniqueId(seed: string): string {
  return `bag-${seed}`;
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

function getBagAllocatedGrams(bag: BagAllocationDraft): number {
  return bag.participants.reduce((sum, participant) => sum + (participant.shareGrams || 0), 0);
}

function bagHasValidPeople(bag: BagAllocationDraft): boolean {
  return bag.participants.every((participant) => participant.personId.trim().length > 0);
}

function getValidSplitParticipantCount(bag: BagAllocationDraft): number {
  return bag.participants.filter((participant) => participant.personId.trim().length > 0 && participant.shareGrams > 0).length;
}

function isBagFullyAssigned(bag: BagAllocationDraft, gramsPerBag: number): boolean {
  if (!bagHasValidPeople(bag)) return false;
  if (bag.mode === 'single') {
    return (
      bag.participants.length === 1 &&
      bag.participants[0].shareGrams === gramsPerBag
    );
  }
  return (
    getValidSplitParticipantCount(bag) >= 2 &&
    bag.participants.every((participant) => Number.isInteger(participant.shareGrams) && participant.shareGrams > 0) &&
    getBagAllocatedGrams(bag) === gramsPerBag
  );
}

function normalizeParticipant(
  participant: Partial<LotBagParticipant>,
  fallbackId: string,
  fallbackShareId: string,
): BagParticipantDraft {
  return {
    id: participant.id || fallbackId,
    personId: participant.personId || '',
    shareGrams: participant.shareGrams ?? 0,
    sourceShareId: participant.sourceShareId || fallbackShareId,
  };
}

function buildLegacyBagDrafts(lot: CoffeeLot): BagAllocationDraft[] {
  const sharesWithBagIndex = lot.shares.filter((share) => typeof share.bagIndex === 'number');
  if (sharesWithBagIndex.length === lot.shares.length && sharesWithBagIndex.length > 0) {
    const sharesByBagIndex = new Map<number, ShareLine[]>();
    for (const share of sharesWithBagIndex) {
      const bagIndex = share.bagIndex ?? 0;
      const bagShares = sharesByBagIndex.get(bagIndex) ?? [];
      bagShares.push(share);
      sharesByBagIndex.set(bagIndex, bagShares);
    }

    return Array.from({ length: lot.quantity }, (_, bagIndex) => {
      const participants = (sharesByBagIndex.get(bagIndex) ?? []).map((share, participantIndex) => ({
        id: uniqueId(`${share.id}-${bagIndex}-${participantIndex}`),
        personId: share.personId,
        shareGrams: share.shareGrams,
        sourceShareId: share.id,
      }));
      const mode = participants.length === 1 && participants[0].shareGrams === lot.gramsPerBag
        ? 'single'
        : participants.length === 0
          ? 'single'
          : 'split';

      return {
        id: uniqueId(`${lot.id}-${bagIndex}`),
        bagIndex,
        mode,
        participants,
      };
    });
  }

  const bags: BagAllocationDraft[] = [];
  const shareQueue = lot.shares.map((share, shareIndex) => ({
    ...share,
    remaining: share.shareGrams,
    shareIndex,
  }));

  let queueIndex = 0;

  for (let bagIndex = 0; bagIndex < lot.quantity; bagIndex += 1) {
    let bagRemaining = lot.gramsPerBag;
    const participants: BagParticipantDraft[] = [];

    while (bagRemaining > 0 && queueIndex < shareQueue.length) {
      const currentShare = shareQueue[queueIndex];
      if (currentShare.remaining <= 0) {
        queueIndex += 1;
        continue;
      }

      const portion = Math.min(bagRemaining, currentShare.remaining);
      participants.push({
        id: uniqueId(`${currentShare.id}-${bagIndex}-${participants.length}`),
        personId: currentShare.personId,
        shareGrams: portion,
        sourceShareId: currentShare.id,
      });
      currentShare.remaining -= portion;
      bagRemaining -= portion;

      if (currentShare.remaining <= 0) {
        queueIndex += 1;
      }
    }

    const mode = participants.length === 1 && participants[0].shareGrams === lot.gramsPerBag
      ? 'single'
      : participants.length === 0
        ? 'single'
        : 'split';

    bags.push({
      id: uniqueId(`${lot.id}-${bagIndex}`),
      bagIndex,
      mode,
      participants,
    });
  }

  return bags;
}

export function expandLotToBagDrafts(lot: CoffeeLot): BagAllocationDraft[] {
  if (!lot.bagAllocations || lot.bagAllocations.length === 0) {
    return buildLegacyBagDrafts(lot);
  }

  const storedByBagIndex = new Map<number, LotBagAllocation>();
  for (const bag of lot.bagAllocations) {
    storedByBagIndex.set(bag.bagIndex, bag);
  }

  const bags: BagAllocationDraft[] = [];
  for (let bagIndex = 0; bagIndex < lot.quantity; bagIndex += 1) {
    const stored = storedByBagIndex.get(bagIndex);
    if (!stored) {
      bags.push({
        id: uniqueId(`${lot.id}-${bagIndex}`),
        bagIndex,
        mode: 'single',
        participants: [],
      });
      continue;
    }

    bags.push({
      id: stored.id || uniqueId(`${lot.id}-${bagIndex}`),
      bagIndex,
      mode: stored.mode === 'split' ? 'split' : 'single',
      participants: stored.participants.map((participant, participantIndex) =>
        normalizeParticipant(
          participant,
          uniqueId(`${stored.id || lot.id}-${bagIndex}-${participantIndex}`),
          participant.sourceShareId || participant.id || uniqueId(`${stored.id || lot.id}-share-${bagIndex}-${participantIndex}`),
        )),
    });
  }

  return bags;
}

export function collapseBagDraftsToShares(bags: BagAllocationDraft[]): ShareLine[] {
  const shares: ShareLine[] = [];
  for (const bag of bags) {
    for (const participant of bag.participants) {
      if (!participant.personId.trim() || participant.shareGrams <= 0) continue;
      shares.push({
        id: participant.sourceShareId || participant.id,
        personId: participant.personId,
        shareGrams: participant.shareGrams || 0,
        bagIndex: bag.bagIndex,
      });
    }
  }

  return shares;
}

export function serializeBagDrafts(bags: BagAllocationDraft[]): Pick<CoffeeLot, 'shares' | 'bagAllocations'> {
  return {
    shares: collapseBagDraftsToShares(bags),
    bagAllocations: bags.map((bag) => ({
      id: bag.id,
      bagIndex: bag.bagIndex,
      mode: bag.mode,
      participants: bag.participants.map((participant) => ({
        id: participant.id,
        personId: participant.personId,
        shareGrams: participant.shareGrams,
        sourceShareId: participant.sourceShareId || participant.id,
      })),
    })),
  };
}

export function validateBagDrafts(bags: BagAllocationDraft[], gramsPerBag: number): string[] {
  const errors: string[] = [];

  for (const bag of bags) {
    const bagLabel = `Bag ${bag.bagIndex + 1}`;
    if (bag.mode === 'single') {
      if (bag.participants.length === 0) {
        errors.push(`${bagLabel}: buyer is required.`);
        continue;
      }
      if (bag.participants.length !== 1 || !bag.participants[0].personId.trim()) {
        errors.push(`${bagLabel}: single-owner bags need exactly one buyer.`);
        continue;
      }
      if (bag.participants[0].shareGrams !== gramsPerBag) {
        errors.push(`${bagLabel}: single-owner bags must assign exactly ${gramsPerBag}g.`);
      }
      continue;
    }

    if (bag.participants.length === 0) {
      errors.push(`${bagLabel}: add at least one buyer to this shared bag.`);
      continue;
    }

    if (!bagHasValidPeople(bag)) {
      errors.push(`${bagLabel}: each shared-bag row needs a buyer.`);
    }
    if (getValidSplitParticipantCount(bag) < 2) {
      errors.push(`${bagLabel}: shared bags need at least two buyers.`);
    }
    if (bag.participants.some((participant) => !Number.isInteger(participant.shareGrams) || participant.shareGrams < 1)) {
      errors.push(`${bagLabel}: shared bag grams must be whole numbers greater than zero.`);
    }

    const allocated = getBagAllocatedGrams(bag);
    if (allocated !== gramsPerBag) {
      errors.push(`${bagLabel}: shared bag grams must total exactly ${gramsPerBag}g.`);
    }
  }

  return errors;
}

export function getLotBagStatus(bags: BagAllocationDraft[], gramsPerBag: number): LotBagStatus {
  const totalBags = bags.length;
  const assignedBags = bags.filter((bag) => isBagFullyAssigned(bag, gramsPerBag)).length;
  const emptyBags = bags.filter((bag) => bag.participants.length === 0).length;
  const splitAttentionBags = bags.filter((bag) => bag.participants.length > 0 && !isBagFullyAssigned(bag, gramsPerBag)).length;

  if (assignedBags === totalBags) {
    return {
      tone: 'complete',
      label: `${assignedBags} of ${totalBags} bags assigned`,
      assignedBags,
      emptyBags,
      splitAttentionBags,
      totalBags,
    };
  }

  const fragments: string[] = [];
  if (emptyBags > 0) {
    fragments.push(`${emptyBags} ${pluralize(emptyBags, 'bag')} still ${emptyBags === 1 ? 'needs' : 'need'} a buyer`);
  }
  if (splitAttentionBags > 0) {
    fragments.push(`${splitAttentionBags} shared ${pluralize(splitAttentionBags, 'bag')} ${splitAttentionBags === 1 ? 'needs' : 'need'} attention`);
  }

  return {
    tone: splitAttentionBags > 0 ? 'error' : 'warning',
    label: fragments.join(' • '),
    assignedBags,
    emptyBags,
    splitAttentionBags,
    totalBags,
  };
}

// ─── Bag-First Model ────────────────────────────────────────────

function genBagId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

/** Infer the split mode from a set of buyers and the bag size. */
export function inferSplitMode(buyers: BagBuyer[], gramsPerBag: number): BagSplitMode {
  if (buyers.length === 0) return 'unassigned';
  if (buyers.length === 1 && buyers[0].grams === gramsPerBag) return 'full';
  if (buyers.length >= 2) {
    const base = Math.floor(gramsPerBag / buyers.length);
    const remainder = gramsPerBag - base * buyers.length;
    const isEqual = buyers.every((b, i) => {
      const expected = i === buyers.length - 1 ? base + remainder : base;
      return b.grams === expected;
    });
    if (isEqual) return 'equal';
    return 'custom';
  }
  return 'custom';
}

/** Auto-fill grams for full/equal modes. Custom and unassigned are left as-is. */
export function recalculateBagGrams(bag: Bag, gramsPerBag: number): Bag {
  if (bag.splitMode === 'unassigned' || bag.buyers.length === 0) {
    return { ...bag, splitMode: 'unassigned', buyers: [] };
  }
  if (bag.splitMode === 'full') {
    if (bag.buyers.length !== 1) return bag;
    return {
      ...bag,
      buyers: [{ ...bag.buyers[0], grams: gramsPerBag }],
    };
  }
  if (bag.splitMode === 'equal') {
    const n = bag.buyers.length;
    const base = Math.floor(gramsPerBag / n);
    const remainder = gramsPerBag - base * n;
    return {
      ...bag,
      buyers: bag.buyers.map((b, i) => ({
        ...b,
        grams: i === n - 1 ? base + remainder : base,
      })),
    };
  }
  // custom: no auto-calc
  return bag;
}

/** Create a new empty bag. */
export function createUnassignedBag(): Bag {
  return { id: genBagId(), splitMode: 'unassigned', buyers: [] };
}

/** Create N unassigned bags. */
export function createUnassignedBags(count: number): Bag[] {
  return Array.from({ length: count }, () => createUnassignedBag());
}

/** Convert a legacy BagAllocationDraft into the new Bag format. */
function draftToBag(draft: BagAllocationDraft, gramsPerBag: number): Bag {
  const buyers: BagBuyer[] = draft.participants
    .filter((p) => p.personId.trim() && p.shareGrams > 0)
    .map((p) => ({
      id: p.id || genBagId(),
      personId: p.personId,
      grams: p.shareGrams,
    }));

  const splitMode = inferSplitMode(buyers, gramsPerBag);
  return { id: draft.id || genBagId(), splitMode, buyers };
}

/**
 * Normalize a CoffeeLot into Bag[] (the new model).
 * Prefers lot.bags if present; otherwise converts from legacy formats.
 */
export function normalizeLotToBags(lot: CoffeeLot): Bag[] {
  if (lot.bags && lot.bags.length > 0) return lot.bags;
  const drafts = expandLotToBagDrafts(lot);
  return drafts.map((d) => draftToBag(d, lot.gramsPerBag));
}

/**
 * Serialize Bag[] back to all CoffeeLot fields for write-through backward compat.
 * Returns bags, shares, bagAllocations, and quantity.
 */
export function serializeLotFromBags(
  bags: Bag[],
): Pick<CoffeeLot, 'bags' | 'shares' | 'bagAllocations' | 'quantity'> {
  const shares: ShareLine[] = [];
  const bagAllocations: LotBagAllocation[] = [];

  for (let bagIndex = 0; bagIndex < bags.length; bagIndex++) {
    const bag = bags[bagIndex];

    const participants: LotBagParticipant[] = bag.buyers
      .filter((b) => b.personId.trim() && b.grams > 0)
      .map((b) => ({
        id: b.id,
        personId: b.personId,
        shareGrams: b.grams,
        sourceShareId: b.id,
      }));

    for (const p of participants) {
      shares.push({
        id: p.sourceShareId,
        personId: p.personId,
        shareGrams: p.shareGrams,
        bagIndex,
      });
    }

    const legacyMode: 'single' | 'split' =
      bag.splitMode === 'full' || bag.splitMode === 'unassigned' ? 'single' : 'split';

    bagAllocations.push({
      id: bag.id,
      bagIndex,
      mode: legacyMode,
      participants,
    });
  }

  return {
    bags,
    shares,
    bagAllocations,
    quantity: bags.length,
  };
}

/** Validate Bag[] against the new model. */
export function validateBags(bags: Bag[], gramsPerBag: number): string[] {
  const errors: string[] = [];

  for (let i = 0; i < bags.length; i++) {
    const bag = bags[i];
    const label = `Bag ${i + 1}`;

    if (bag.splitMode === 'unassigned') {
      errors.push(`${label}: buyer is required.`);
      continue;
    }

    if (bag.splitMode === 'full') {
      if (bag.buyers.length !== 1 || !bag.buyers[0].personId.trim()) {
        errors.push(`${label}: full bags need exactly one buyer.`);
        continue;
      }
      if (bag.buyers[0].grams !== gramsPerBag) {
        errors.push(`${label}: full bags must assign exactly ${gramsPerBag}g.`);
      }
      continue;
    }

    // equal or custom
    if (bag.buyers.length < 2) {
      errors.push(`${label}: shared bags need at least two buyers.`);
      continue;
    }
    if (bag.buyers.some((b) => !b.personId.trim())) {
      errors.push(`${label}: each buyer row needs a selected person.`);
    }
    if (bag.buyers.some((b) => !Number.isInteger(b.grams) || b.grams < 1)) {
      errors.push(`${label}: buyer grams must be whole numbers greater than zero.`);
    }
    const total = bag.buyers.reduce((s, b) => s + b.grams, 0);
    if (total !== gramsPerBag) {
      errors.push(`${label}: buyer grams must total exactly ${gramsPerBag}g.`);
    }
  }

  return errors;
}

/** Get bag status for the new Bag[] model. */
export function getBagStatus(bags: Bag[], gramsPerBag: number): LotBagStatus {
  const totalBags = bags.length;
  const errors = validateBags(bags, gramsPerBag);
  const assignedBags = bags.filter((_, i) => {
    const bagErrors = validateBags([bags[i]], gramsPerBag);
    return bagErrors.length === 0;
  }).length;
  const emptyBags = bags.filter((b) => b.splitMode === 'unassigned').length;
  const splitAttentionBags = totalBags - assignedBags - emptyBags;

  if (assignedBags === totalBags) {
    return {
      tone: 'complete',
      label: `${assignedBags} of ${totalBags} bags assigned`,
      assignedBags,
      emptyBags,
      splitAttentionBags,
      totalBags,
    };
  }

  const fragments: string[] = [];
  if (emptyBags > 0) {
    fragments.push(`${emptyBags} ${pluralize(emptyBags, 'bag')} still ${emptyBags === 1 ? 'needs' : 'need'} a buyer`);
  }
  if (splitAttentionBags > 0) {
    fragments.push(`${splitAttentionBags} shared ${pluralize(splitAttentionBags, 'bag')} ${splitAttentionBags === 1 ? 'needs' : 'need'} attention`);
  }

  return {
    tone: splitAttentionBags > 0 ? 'error' : 'warning',
    label: fragments.length > 0 ? fragments.join(' • ') : `${assignedBags} of ${totalBags} bags assigned`,
    assignedBags,
    emptyBags,
    splitAttentionBags,
    totalBags,
  };
}

/** Copy a bag's allocation to all unassigned bags in the list. */
export function applyAllocationToBags(sourceBag: Bag, targetBags: Bag[]): Bag[] {
  return targetBags.map((bag) => {
    if (bag.splitMode !== 'unassigned') return bag;
    return {
      ...bag,
      splitMode: sourceBag.splitMode,
      buyers: sourceBag.buyers.map((b) => ({ ...b, id: genBagId() })),
    };
  });
}

/** Duplicate a bag's allocation as a new bag appended to the list. */
export function duplicateBag(sourceBag: Bag): Bag {
  return {
    id: genBagId(),
    splitMode: sourceBag.splitMode,
    buyers: sourceBag.buyers.map((b) => ({ ...b, id: genBagId() })),
  };
}

export function validateSetupStep(order: Order): string[] {
  const errors: string[] = [];
  if (!order.name.trim()) errors.push('Order name is required.');
  if (!order.orderDate) errors.push('Order date is required.');
  if (!order.payerId) errors.push('Payer is required.');
  return errors;
}

export function validateCoffeeLot(lot: CoffeeLot): string[] {
  const errors: string[] = [];
  const bags = normalizeLotToBags(lot);

  if (!lot.name.trim()) errors.push('Coffee name is required.');
  if (!Number.isInteger(lot.gramsPerBag) || lot.gramsPerBag < 1) {
    errors.push('Grams per bag must be an integer greater than zero.');
  }
  if (bags.length < 1) {
    errors.push('At least one bag is required.');
  }
  if (!Number.isFinite(lot.foreignPricePerBag) || lot.foreignPricePerBag <= 0) {
    errors.push('Foreign list price per bag must be greater than zero.');
  }

  const hasBuyers = bags.some((b) => b.buyers.length > 0);
  if (!hasBuyers) {
    errors.push('At least one buyer is required.');
  }

  errors.push(...validateBags(bags, lot.gramsPerBag));

  return errors;
}

export function validateCoffeeStep(order: Order): string[] {
  if (order.lots.length === 0) return ['Add at least one coffee lot.'];
  return order.lots.flatMap((lot) =>
    validateCoffeeLot(lot).map((error) => `"${lot.name || 'New coffee lot'}": ${error}`)
  );
}

export function validateGoodsStep(order: Order): string[] {
  const errors: string[] = [];
  if (!(order.goodsTotalZar > 0)) {
    errors.push('Goods total must be greater than zero.');
  }
  for (const fee of order.fees) {
    if (!fee.label.trim()) errors.push('Each fee needs a label.');
    if (!(fee.amountZar > 0)) errors.push(`"${fee.label || 'Fee'}" amount must be greater than zero.`);
    if (!['fixed_shared', 'value_based'].includes(fee.allocationType)) {
      errors.push(`"${fee.label || 'Fee'}" has an unsupported fee type.`);
    }
  }
  return errors;
}

export function isStepComplete(order: Order, step: OrderWizardStep): boolean {
  if (step === 'setup') return validateSetupStep(order).length === 0;
  if (step === 'coffees') return validateCoffeeStep(order).length === 0;
  if (step === 'goods') return validateGoodsStep(order).length === 0;
  return isStepComplete(order, 'setup') && isStepComplete(order, 'coffees') && isStepComplete(order, 'goods');
}

export function getSuggestedWizardStep(order: Order): OrderWizardStep {
  if (!isStepComplete(order, 'setup')) return 'setup';
  if (!isStepComplete(order, 'coffees')) return 'coffees';
  if (!isStepComplete(order, 'goods')) return 'goods';
  return 'summary';
}

export function getMaxUnlockedStepIndex(order: Order): number {
  if (!isStepComplete(order, 'setup')) return 0;
  if (!isStepComplete(order, 'coffees')) return 1;
  if (!isStepComplete(order, 'goods')) return 2;
  return 3;
}

export function getLotAssignmentMode(lot: CoffeeLot): 'unassigned' | 'own' | 'split' {
  const bags = normalizeLotToBags(lot);
  if (bags.every((bag) => bag.splitMode === 'unassigned')) return 'unassigned';
  if (bags.every((bag) => bag.splitMode === 'full')) return 'own';
  return 'split';
}

export function getInitialShareGramsForNewBuyer(lot: CoffeeLot): number {
  const bags = normalizeLotToBags(lot);
  const totalGrams = lot.gramsPerBag * bags.length;
  const allocatedGrams = bags.reduce((sum, bag) => sum + bag.buyers.reduce((s, b) => s + b.grams, 0), 0);
  return Math.max(0, totalGrams - allocatedGrams);
}
