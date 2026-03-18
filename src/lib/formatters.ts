// ─── Currency ─────────────────────────────────────────────────

export function formatZAR(amount: number): string {
  return `R${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

export function formatZARShort(amount: number): string {
  if (amount >= 1000) {
    return `R${(amount / 1000).toFixed(1)}k`;
  }
  return formatZAR(amount);
}

// ─── Date ─────────────────────────────────────────────────────

export function formatDate(isoDate: string): string {
  if (!isoDate) return '';
  const d = new Date(isoDate + 'T12:00:00');
  return d.toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatDateShort(isoDate: string): string {
  if (!isoDate) return '';
  const d = new Date(isoDate + 'T12:00:00');
  return d.toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

// ─── Payment Reference ────────────────────────────────────────

/**
 * Resolves a reference template.
 * Supported tokens: {ORDER}, {NAME}, {MONTH}, {YEAR}
 */
export function resolveReference(
  template: string,
  orderName: string,
  personName: string,
  orderDate?: string
): string {
  const d = orderDate ? new Date(orderDate + 'T12:00:00') : new Date();
  const month = d.toLocaleString('default', { month: 'short' }).toUpperCase();
  const year = d.getFullYear().toString();

  return template
    .replace(/\{ORDER\}/g, slugify(orderName))
    .replace(/\{NAME\}/g, slugify(personName))
    .replace(/\{MONTH\}/g, month)
    .replace(/\{YEAR\}/g, year);
}

function slugify(text: string): string {
  return text
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ─── Grams ────────────────────────────────────────────────────

export function formatGrams(grams: number): string {
  if (grams >= 1000) {
    return `${(grams / 1000).toFixed(grams % 1000 === 0 ? 0 : 1)}kg`;
  }
  return `${grams}g`;
}

// ─── PDF-safe filename ────────────────────────────────────────

export function pdfFilename(orderName: string, personName: string): string {
  const clean = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  return `fajr-brews-invoice-${clean(orderName)}-${clean(personName)}.pdf`;
}
