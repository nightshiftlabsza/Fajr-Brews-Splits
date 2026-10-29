import { getCurrency } from '../data/currencies';

/**
 * Formats a coffee's price per bag in the roaster's chosen currency.
 * This is used ONLY to label the roaster's catalog prices.
 *
 * It never alters or converts amounts; goods totals and invoices always remain in ZAR.
 * When currencyCode is not specified, plain numbers are preserved as in previous releases.
 */
export function formatListPrice(price: number, currencyCode?: string | null): string {
  if (currencyCode === undefined || currencyCode === null || currencyCode === '') {
    if (!Number.isFinite(price)) return '0';
    return Number.isInteger(price) ? String(price) : price.toFixed(2);
  }

  const cleanCode = currencyCode.toUpperCase().trim();
  if (!cleanCode) {
    if (!Number.isFinite(price)) return '0';
    return Number.isInteger(price) ? String(price) : price.toFixed(2);
  }

  try {
    const formatted = new Intl.NumberFormat('en', {
      style: 'currency',
      currency: cleanCode,
      currencyDisplay: 'narrowSymbol',
    }).format(price);

    // Normalize any non-breaking spaces or narrow non-breaking spaces from Intl
    return formatted.replace(/[\u00A0\u202F]/g, ' ');
  } catch {
    // Unknown or non-ISO currency code fallback: CODE + price
    const numPart = Number.isFinite(price)
      ? Number.isInteger(price) ? String(price) : price.toFixed(2)
      : '0';
    return `${cleanCode} ${numPart}`;
  }
}

/**
 * Returns the short display symbol or code for a roaster currency.
 */
export function getListCurrencySymbol(currencyCode?: string | null): string {
  if (!currencyCode) return '';
  const known = getCurrency(currencyCode);
  if (known) return known.symbol;

  try {
    const parts = new Intl.NumberFormat('en', {
      style: 'currency',
      currency: currencyCode.toUpperCase().trim(),
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(0);
    const symbolPart = parts.find((p) => p.type === 'currency');
    return symbolPart ? symbolPart.value : currencyCode.toUpperCase().trim();
  } catch {
    return currencyCode.toUpperCase().trim();
  }
}
