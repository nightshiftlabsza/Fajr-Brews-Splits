import type {
  Fee,
  FeeAllocationType,
  FeePersonBreakdown,
  Order,
  Person,
  PersonCalculation,
} from '../types';
import { formatDate, formatGrams, formatZAR, generatePaymentReference } from './formatters';

export type CanonicalFeeAllocationType =
  | 'equal_per_person'
  | 'proportional_by_value'
  | 'specific_person';

export interface InvoiceCoffeeLine {
  id: string;
  name: string;
  detail: string;
  shareGrams: number;
  splitWith: string[];
  beansAmount: string;
  feesAmount: string | null;
  totalAmount: string;
  breakdownSummary: string;
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

export function buildLineBreakdownSummary(
  line: { goodsZar: number; feesZar: number },
  personGoodsZar: number,
  feeBreakdowns: FeePersonBreakdown[]
): string {
  const baseText = `${formatZAR(line.goodsZar)} coffee`;
  if (line.feesZar <= 0 || feeBreakdowns.length === 0) {
    return baseText;
  }
  if (feeBreakdowns.length === 1) {
    const rawLabel = feeBreakdowns[0].label.trim();
    const label = rawLabel.toLowerCase() === 'fees' ? 'fees' : rawLabel.toLowerCase();
    return `${baseText} + ${formatZAR(line.feesZar)} ${label}`;
  }
  const components = feeBreakdowns.map((fee) => {
    const share = personGoodsZar > 0 ? (line.goodsZar / personGoodsZar) * fee.amountZar : 0;
    return `${formatZAR(share)} ${fee.label.toLowerCase()}`;
  });
  return `${baseText} + ${components.join(' + ')}`;
}

export function buildInvoiceModel({ order, person, payer, calc }: InvoicePayload): InvoiceModel {
  const reference = generatePaymentReference(order, person.name);
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
    shareGrams: line.shareGrams,
    splitWith: line.splitWith,
    beansAmount: formatZAR(line.goodsZar),
    feesAmount: line.feesZar > 0 ? formatZAR(line.feesZar) : null,
    totalAmount: formatZAR(line.totalZar),
    breakdownSummary: buildLineBreakdownSummary(line, calc.goodsZar, calc.feeBreakdowns),
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

export function buildWhatsAppMessageText(payload: InvoicePayload): string {
  const { order } = payload;
  const invoice = buildInvoiceModel(payload);
  const roasterName = order.roasterSnapshot?.name || order.name || 'coffee';

  const lines: string[] = [
    `Assalamualaykum Brother. Hope you are well. Attached are the amounts for the *${roasterName}* order - shukran.`,
    '',
    '*Your coffee:*',
    '',
  ];

  if (invoice.coffeeLines.length > 0) {
    for (const line of invoice.coffeeLines) {
      lines.push(`*${line.name} · ${formatGrams(line.shareGrams)}* — *${line.totalAmount}*`);
      lines.push(`_(${line.breakdownSummary})_`);
      if (line.splitWith.length > 0) {
        lines.push(`_Split with: ${line.splitWith.join(', ')}_`);
      }
      lines.push('');
    }
  } else if (invoice.feeLines.length > 0) {
    lines.push('*Fees:*');
    for (const fee of invoice.feeLines) {
      lines.push(`- ${fee.label}: ${fee.amount}`);
    }
    lines.push('');
  }

  lines.push(`*Total due: ${invoice.amountDue}*`);
  lines.push(`*Payment reference: ${invoice.reference}*`);

  if (order.payerBank.accountNumber && order.payerBank.bankName) {
    lines.push('');
    const beneficiary = order.payerBank.beneficiary ? ` (${order.payerBank.beneficiary})` : '';
    lines.push(`*Pay to:* ${order.payerBank.bankName} ${order.payerBank.accountNumber}${beneficiary}`);
  }

  return lines.join('\n').trim();
}

export function buildEmailMessageText(payload: InvoicePayload): string {
  const { order } = payload;
  const invoice = buildInvoiceModel(payload);
  const roasterName = order.roasterSnapshot?.name || order.name || 'coffee';

  const lines: string[] = [
    `Assalamualaykum Brother. Hope you are well. Attached are the amounts for the ${roasterName} order - shukran.`,
    '',
    'Your coffee:',
    '',
  ];

  if (invoice.coffeeLines.length > 0) {
    for (const line of invoice.coffeeLines) {
      lines.push(`${line.name} · ${formatGrams(line.shareGrams)} — ${line.totalAmount}`);
      lines.push(`(${line.breakdownSummary})`);
      if (line.splitWith.length > 0) {
        lines.push(`Split with: ${line.splitWith.join(', ')}`);
      }
      lines.push('');
    }
  } else if (invoice.feeLines.length > 0) {
    lines.push('Fees:');
    for (const fee of invoice.feeLines) {
      lines.push(`- ${fee.label}: ${fee.amount}`);
    }
    lines.push('');
  }

  lines.push(`Total due: ${invoice.amountDue}`);
  lines.push(`Payment reference: ${invoice.reference}`);

  if (invoice.paymentLines.length > 0) {
    lines.push('');
    lines.push('Pay to:');
    for (const [label, value] of invoice.paymentLines) {
      lines.push(`  ${label}: ${value}`);
    }
  }

  return lines.join('\n').trim();
}

export function buildPaymentSummaryText(payload: InvoicePayload): string {
  return buildEmailMessageText(payload);
}

export function formatFeeBreakdownLine(fee: FeePersonBreakdown): string {
  return `${fee.label} (${getFeeAllocationLabel(fee.allocationType)})`;
}
