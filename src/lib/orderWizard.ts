import type { CoffeeLot, Order } from '../types';

export type OrderWizardStep = 'setup' | 'coffees' | 'goods' | 'summary';

export const ORDER_WIZARD_STEPS: { id: OrderWizardStep; label: string; shortLabel: string }[] = [
  { id: 'setup', label: 'Setup details', shortLabel: 'Setup' },
  { id: 'coffees', label: 'Add coffees & assign buyers', shortLabel: 'Coffees' },
  { id: 'goods', label: 'Goods and fees', shortLabel: 'Goods' },
  { id: 'summary', label: 'Summary', shortLabel: 'Summary' },
];

export function validateSetupStep(order: Order): string[] {
  const errors: string[] = [];
  if (!order.name.trim()) errors.push('Order name is required.');
  if (!order.orderDate) errors.push('Order date is required.');
  if (!order.payerId) errors.push('Payer is required.');
  return errors;
}

export function validateCoffeeLot(lot: CoffeeLot): string[] {
  const errors: string[] = [];
  const totalGrams = lot.gramsPerBag * lot.quantity;
  const allocatedGrams = lot.shares.reduce((sum, share) => sum + (share.shareGrams || 0), 0);

  if (!lot.name.trim()) errors.push('Coffee name is required.');
  if (!Number.isInteger(lot.gramsPerBag) || lot.gramsPerBag < 1) {
    errors.push('Grams per bag must be an integer greater than zero.');
  }
  if (!Number.isInteger(lot.quantity) || lot.quantity < 1) {
    errors.push('Quantity must be an integer greater than zero.');
  }
  if (!Number.isFinite(lot.foreignPricePerBag) || lot.foreignPricePerBag <= 0) {
    errors.push('Foreign list price per bag must be greater than zero.');
  }
  if (lot.shares.length === 0) {
    errors.push('At least one buyer is required.');
  }
  if (allocatedGrams !== totalGrams) {
    errors.push(`Buyer grams must total exactly ${totalGrams}g.`);
  }
  if (lot.shares.some((share) => !Number.isInteger(share.shareGrams) || share.shareGrams < 0)) {
    errors.push('Buyer grams must be integers.');
  }
  if (lot.shares.some((share) => !share.personId)) {
    errors.push('Each buyer row must have a selected buyer.');
  }

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
  const positiveShares = lot.shares.filter((share) => share.shareGrams > 0);
  if (positiveShares.length === 0) return 'unassigned';
  if (positiveShares.length === 1 && positiveShares[0].shareGrams === lot.gramsPerBag * lot.quantity) {
    return 'own';
  }
  return 'split';
}

export function getInitialShareGramsForNewBuyer(lot: CoffeeLot): number {
  const totalGrams = lot.gramsPerBag * lot.quantity;
  const allocatedGrams = lot.shares.reduce((sum, share) => sum + (share.shareGrams || 0), 0);
  return Math.max(0, totalGrams - allocatedGrams);
}
