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

export function formatCurrency(amount: number): string {
  return formatZAR(amount);
}

export function formatNumber(value: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat('en-ZA', {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value);
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
 * Generates a short, human-friendly payment reference.
 * Preferred format: {ROASTER}-{MON}{YY}-{FIRSTNAME} (<= 20 characters)
 * If preferred format exceeds 20 characters, falls back to {FIRSTNAME}-{MON}{YY}.
 * If {FIRSTNAME}-{MON}{YY} exceeds 20 characters, shortens first name to fit <= 20 characters.
 * All components are uppercase for clear typing into banking apps.
 */
export function generatePaymentReference(
  order: { roasterSnapshot?: { name?: string | null } | null; roasterId?: string | null; name?: string; orderDate?: string },
  personName: string
): string {
  const roasterRaw = order.roasterSnapshot?.name || order.name || 'COFFEE';
  const roasterClean = cleanRoasterPart(roasterRaw);
  const firstNameClean = cleanFirstNamePart(personName);
  const monYY = formatMonthYear(order.orderDate);

  // 1. Preferred format: ROASTER-MONYY-FIRSTNAME
  const preferred = `${roasterClean}-${monYY}-${firstNameClean}`;
  if (preferred.length <= 20) {
    return preferred;
  }

  // 2. Fallback format: FIRSTNAME-MONYY
  let fallback = `${firstNameClean}-${monYY}`;
  if (fallback.length <= 20) {
    return fallback;
  }

  // 3. Shorten first name if FIRSTNAME-MONYY exceeds 20 characters
  const maxNameLen = Math.max(1, 20 - 1 - monYY.length);
  const shortenedName = firstNameClean.slice(0, maxNameLen);
  fallback = `${shortenedName}-${monYY}`;

  return fallback.slice(0, 20);
}

export function cleanRoasterPart(name: string): string {
  const normalized = (name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  const stripped = normalized
    .replace(/\b(pty|ltd|coffee|roasters|roastery|roasting|brews|co)\b/gi, '')
    .trim();

  const chosen = stripped.length > 0 ? stripped : normalized;
  const clean = chosen.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return clean.length > 0 ? clean : 'COFFEE';
}

export function cleanFirstNamePart(personName: string): string {
  const normalized = (personName || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  const firstWord = normalized.split(/[\s,._\-/\\&]+/)[0] || '';
  const clean = firstWord.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return clean.length > 0 ? clean : 'FRIEND';
}

export function formatMonthYear(orderDate?: string): string {
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  if (orderDate && /^\d{4}-\d{2}-\d{2}/.test(orderDate)) {
    const parts = orderDate.split('-');
    const yearNum = parseInt(parts[0], 10);
    const monthNum = parseInt(parts[1], 10) - 1;
    if (!isNaN(monthNum) && monthNum >= 0 && monthNum <= 11 && !isNaN(yearNum)) {
      return `${MONTHS[monthNum]}${String(yearNum).slice(-2)}`;
    }
  }
  const d = new Date();
  return `${MONTHS[d.getMonth()]}${String(d.getFullYear()).slice(-2)}`;
}

export function resolveReference(
  _template: string,
  orderName: string,
  personName: string,
  orderDate?: string
): string {
  return generatePaymentReference({ name: orderName, orderDate }, personName);
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
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  return `fajr-brews-invoice-${clean(orderName)}-${clean(personName)}.pdf`;
}

export function orderPdfFilename(orderName: string): string {
  const clean = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  return `fajr-brews-order-invoice-${clean(orderName)}.pdf`;
}
