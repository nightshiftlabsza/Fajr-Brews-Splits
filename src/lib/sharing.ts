import type { Order, Person, PersonCalculation } from '../types';
import { buildInvoiceModel, buildPaymentSummaryText } from './invoiceFormatter';

interface SharePayload {
  order: Order;
  person: Person;
  payer: Person | undefined;
  calc: PersonCalculation;
}

function buildPaymentText({ order, person, payer, calc }: SharePayload): string {
  return buildPaymentSummaryText({ order, person, payer, calc });
}

export async function copyPaymentSummary(payload: SharePayload): Promise<void> {
  const text = buildPaymentText(payload);
  await navigator.clipboard.writeText(text);
}

export function openWhatsApp(payload: SharePayload): void {
  const phone = payload.person.phone;
  const text = buildPaymentText(payload);
  const encoded = encodeURIComponent(text);

  if (phone) {
    // Strip non-digits and ensure SA country code
    const digits = phone.replace(/\D/g, '');
    const e164 = digits.startsWith('0') ? '27' + digits.slice(1) : digits;
    window.open(`https://wa.me/${e164}?text=${encoded}`, '_blank');
  } else {
    // No phone — open WhatsApp without a recipient (user picks manually)
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  }
}

export function openEmail(payload: SharePayload): void {
  const email = payload.person.email;
  const ref = buildInvoiceModel(payload).reference;
  const subject = encodeURIComponent(`Fajr Brews Invoice — ${payload.order.name} — ${ref}`);
  const body = encodeURIComponent(buildPaymentText(payload));

  if (email) {
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_self');
  } else {
    window.open(`mailto:?subject=${subject}&body=${body}`, '_self');
  }
}
