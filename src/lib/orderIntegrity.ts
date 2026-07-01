import type { Order, Person } from '../types';
import { normalizeFeeAllocationType } from './invoiceFormatter';
import { normalizeLotToBags, serializeLotFromBags } from './orderWizard';

export function normalizeOrderForPersistence(order: Order): Order {
  return {
    ...order,
    lots: order.lots.map((lot) => {
      const bags = normalizeLotToBags(lot);
      return {
        ...lot,
        ...serializeLotFromBags(bags),
      };
    }),
    fees: Array.isArray(order.fees) ? order.fees : [],
    payments: order.payments && typeof order.payments === 'object' && !Array.isArray(order.payments)
      ? order.payments
      : {},
  };
}

export function validatePersistableOrder(
  order: Order,
  options: { people?: Person[]; strict: boolean },
): string[] {
  const errors: string[] = [];

  if (!order.id) {
    errors.push('Order is missing an ID.');
  }

  if (!options.strict) {
    return errors;
  }

  const peopleIds = new Set(options.people?.map((person) => person.id) ?? []);
  const shouldCheckDirectoryReferences = peopleIds.size > 0;

  if (!order.lots || order.lots.length === 0) {
    errors.push('Saved orders must keep at least one coffee lot.');
  }

  for (const lot of order.lots ?? []) {
    const lotLabel = lot.name || 'Coffee lot';
    const bags = normalizeLotToBags(lot);

    if (!lot.id) errors.push(`"${lotLabel}" is missing a lot ID.`);
    if (!Number.isInteger(lot.gramsPerBag) || lot.gramsPerBag < 1) {
      errors.push(`"${lotLabel}" needs valid grams per bag.`);
    }
    if (!Number.isFinite(lot.foreignPricePerBag) || lot.foreignPricePerBag <= 0) {
      errors.push(`"${lotLabel}" needs a valid foreign price per bag.`);
    }
    if (bags.length < 1) {
      errors.push(`"${lotLabel}" must have at least one bag.`);
    }

    for (const [bagIndex, bag] of bags.entries()) {
      const bagLabel = `"${lotLabel}" bag ${bagIndex + 1}`;
      if (!bag.id) errors.push(`${bagLabel} is missing a bag ID.`);
      if (bag.buyers.length < 1) {
        errors.push(`${bagLabel} must have at least one buyer.`);
      }

      const bagGrams = bag.buyers.reduce((sum, buyer) => sum + buyer.grams, 0);
      if (bagGrams !== lot.gramsPerBag) {
        errors.push(`${bagLabel} buyer grams must total ${lot.gramsPerBag}g.`);
      }

      for (const buyer of bag.buyers) {
        if (!buyer.personId) {
          errors.push(`${bagLabel} has a buyer without a person.`);
        } else if (shouldCheckDirectoryReferences && !peopleIds.has(buyer.personId)) {
          errors.push(`${bagLabel} references a person that is not in the directory.`);
        }
        if (!Number.isInteger(buyer.grams) || buyer.grams < 1) {
          errors.push(`${bagLabel} has invalid buyer grams.`);
        }
      }
    }
  }

  for (const fee of order.fees ?? []) {
    const allocationType = normalizeFeeAllocationType(fee.allocationType);
    if (allocationType === 'specific_person') {
      if (!fee.personId) {
        errors.push(`"${fee.label || 'Fee'}" needs a selected person.`);
      } else if (shouldCheckDirectoryReferences && !peopleIds.has(fee.personId)) {
        errors.push(`"${fee.label || 'Fee'}" references a person that is not in the directory.`);
      }
    }
  }

  if (!order.payments || typeof order.payments !== 'object' || Array.isArray(order.payments)) {
    errors.push('Order payments must be a valid payment record.');
  }

  return errors;
}

export function assertCanPersistOrder(
  order: Order,
  options: { people?: Person[]; strict: boolean },
): Order {
  const normalizedOrder = normalizeOrderForPersistence(order);
  const errors = validatePersistableOrder(normalizedOrder, options);

  if (errors.length > 0) {
    throw new Error(errors[0]);
  }

  return normalizedOrder;
}
