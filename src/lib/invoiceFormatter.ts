import type {
  Fee,
  FeeAllocationType,
  FeePersonBreakdown,
  Order,
  Person,
  PersonCalculation,
} from '../types';
import { formatDate, formatGrams, formatZAR, resolveReference } from './formatters';

export type CanonicalFeeAllocationType =
  | 'equal_per_person'
  | 'proportional_by_value'
  | 'specific_person';

export interface InvoiceCoffeeLine {
  id: string;
  name: string;
  detail: string;
  splitWith: string[];
  beansAmount: string;
  feesAmount: string | null;
  totalAmount: string;
}

export interface InvoiceFeeLine {
  id: string;
  label: string;
  methodLabel: string;
  amount: string;
}

export interface InvoiceSummaryLine {
  label: string;
  amount: string;
}

export interface InvoiceModel {
  title: string;
  orderName: string;
  orderDate: string;
  personName: string;
  amountDue: string;
  reference: string;
  coffeeLines: InvoiceCoffeeLine[];
  feeLines: InvoiceFeeLine[];
  summaryLines: InvoiceSummaryLine[];
  paymentLines: [string, string][];
  paymentStatusLabel: string;
  payerNote?: string;
}

export interface InvoicePayload {
  order: Order;
  person: Person;
  payer?: Person;
  calc: PersonCalculation;
}

export function normalizeFeeAllocationType(type: FeeAllocationType): CanonicalFeeAllocationType {
  if (type === 'fixed_shared') return 'equal_per_person';
  if (type === 'value_based') return 'proportional_by_value';
  return type;
}

export function getFeeAllocationLabel(type: FeeAllocationType): string {
  const canonical = normalizeFeeAllocationType(type);
  if (canonical === 'equal_per_person') return 'Equal per person';
  if (canonical === 'proportional_by_value') return 'Proportional by order value';
  return 'Specific person';
}

export function getFeeAllocationShortLabel(type: FeeAllocationType): string {
  const canonical = normalizeFeeAllocationType(type);
  if (canonical === 'equal_per_person') return 'Equal';
  if (canonical === 'proportional_by_value') return 'Value-based';
  return 'Specific person';
}

export function formatFeeForOwner(fee: Fee, peopleById: Map<string, Person> | Record<string, Person | undefined>): string {
  const personId = fee.personId ?? null;
  const person = personId
    ? peopleById instanceof Map
      ? peopleById.get(personId)
      : peopleById[personId]
    : undefined;
  const label = getFeeAllocationLabel(fee.allocationType);
  if (normalizeFeeAllocationType(fee.allocationType) === 'specific_person') {
    return `${fee.label} (${label}${person ? `: ${person.name}` : ''})`;
  }
  return `${fee.label} (${label})`;
}

export function formatCoffeeDetail(line: {
  shareGrams: number;
  gramsPerBag: number;
  bagIndex: number;
  splitWith: string[];
}): string {
  if (line.splitWith.length > 0) {
    return `Bag ${line.bagIndex + 1}: ${formatGrams(line.shareGrams)} from ${formatGrams(line.gramsPerBag)} bag`;
  }
  if (line.shareGrams === line.gramsPerBag) {
    return `Bag ${line.bagIndex + 1}: ${formatGrams(line.gramsPerBag)} bag`;
  }
  return `Bag ${line.bagIndex + 1}: ${formatGrams(line.shareGrams)} share from ${formatGrams(line.gramsPerBag)} bag`;
}

export function buildInvoiceModel({ order, person, payer, calc }: InvoicePayload): InvoiceModel {
  const reference = resolveReference(
    order.referenceTemplate,
    order.name,
    person.name,
    order.orderDate,
  );
  const payment = order.payments[person.id];
  const roundingAdjustment = calc.totalFinal - calc.totalPreRound;

  const paymentLineCandidates: [string, string][] = [
    ['Beneficiary', order.payerBank.beneficiary || payer?.name || '-'],
    ['Bank', order.payerBank.bankName],
    ['Account number', order.payerBank.accountNumber],
    ...(order.payerBank.branch ? [['Branch', order.payerBank.branch] as [string, string]] : []),
    ['Reference', reference],
  ];
  const paymentLines = paymentLineCandidates.filter(([, value]) => Boolean(value));

  const coffeeLines = calc.lotBreakdowns.map((line): InvoiceCoffeeLine => ({
    id: line.id,
    name: line.lotName,
    detail: formatCoffeeDetail(line),
    splitWith: line.splitWith,
    beansAmount: formatZAR(line.goodsZar),
    feesAmount: line.feesZar > 0 ? formatZAR(line.feesZar) : null,
    totalAmount: formatZAR(line.totalZar),
  }));

  const feeLines = calc.feeBreakdowns.map((fee): InvoiceFeeLine => ({
    id: fee.feeId,
    label: normalizeFeeAllocationType(fee.allocationType) === 'specific_person'
      ? `${fee.label} to ${person.name}`
      : fee.label,
    methodLabel: getFeeAllocationLabel(fee.allocationType),
    amount: formatZAR(fee.amountZar),
  }));

  const summaryLines: InvoiceSummaryLine[] = [
    { label: 'Coffee + allocated fees', amount: formatZAR(calc.totalPreRound) },
  ];
  if (Math.abs(roundingAdjustment) > 0.001) {
    summaryLines.push({
      label: 'Payer rounding adjustment',
      amount: formatZAR(roundingAdjustment),
    });
  }

  return {
    title: 'Fajr Brews',
    orderName: order.name,
    orderDate: formatDate(order.orderDate),
    personName: person.name,
    amountDue: formatZAR(calc.totalFinal),
    reference,
    coffeeLines,
    feeLines,
    summaryLines,
    paymentLines,
    paymentStatusLabel: payment?.status === 'paid'
      ? 'Paid'
      : payment?.status === 'partial'
        ? 'Partial'
        : 'Amount due',
    payerNote: order.payerNote,
  };
}

export function buildPaymentSummaryText(payload: InvoicePayload): string {
  const invoice = buildInvoiceModel(payload);
  const lines: string[] = [
    'Fajr Brews - Coffee Splitter',
    `Order: ${invoice.orderName}`,
    '',
    'Coffee:',
    ...invoice.coffeeLines.map((line) => {
      const split = line.splitWith.length > 0 ? ` Split with: ${line.splitWith.join(', ')}.` : '';
      return `- ${line.name}, ${line.detail}.${split} ${line.totalAmount}`;
    }),
  ];

  if (invoice.feeLines.length > 0) {
    lines.push(
      '',
      'Fees:',
      ...invoice.feeLines.map((line) => `- ${line.label} (${line.methodLabel}): ${line.amount}`),
    );
  }

  lines.push(
    '',
    `Amount due: *${invoice.amountDue}*`,
    `Payment reference: ${invoice.reference}`,
    '',
    'Pay to:',
    ...invoice.paymentLines.map(([label, value]) => `  ${label}: ${value}`),
  );

  if (invoice.payerNote) {
    lines.push('', `Note: ${invoice.payerNote}`);
  }

  return lines.join('\n');
}

export function formatFeeBreakdownLine(fee: FeePersonBreakdown): string {
  return `${fee.label} (${getFeeAllocationLabel(fee.allocationType)})`;
}
