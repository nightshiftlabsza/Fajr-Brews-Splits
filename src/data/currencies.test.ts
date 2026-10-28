import { describe, expect, it } from 'vitest';
import {
  CURRENCIES,
  getAllCurrencies,
  getCurrency,
  getSuggestedCurrencies,
  isSuggestedCurrency,
  SUGGESTED_CURRENCY_CODES,
} from './currencies';

describe('currencies dataset', () => {
  it('has between 40 and 60 currencies with unique codes', () => {
    expect(CURRENCIES.length).toBeGreaterThanOrEqual(40);
    expect(CURRENCIES.length).toBeLessThanOrEqual(60);
    const codes = CURRENCIES.map((c) => c.code);
    const uniqueCodes = new Set(codes);
    expect(uniqueCodes.size).toBe(codes.length);
  });

  it('provides Suggested currencies in exact required order: EUR, GBP, USD, ZAR', () => {
    const suggested = getSuggestedCurrencies();
    expect(suggested.map((c) => c.code)).toEqual(['EUR', 'GBP', 'USD', 'ZAR']);
    expect(suggested[0].name).toBe('Euro');
    expect(suggested[1].name).toBe('Pound sterling');
    expect(suggested[2].name).toBe('US dollar');
    expect(suggested[3].name).toBe('South African rand');
  });

  it('marks suggested currencies accurately with isSuggestedCurrency', () => {
    for (const code of SUGGESTED_CURRENCY_CODES) {
      const currency = getCurrency(code);
      expect(currency).toBeDefined();
      expect(isSuggestedCurrency(currency!)).toBe(true);
    }
    const jpy = getCurrency('JPY')!;
    expect(isSuggestedCurrency(jpy)).toBe(false);
  });

  it('looks up currency case-insensitively and returns undefined for unknown codes', () => {
    expect(getCurrency('eur')?.name).toBe('Euro');
    expect(getCurrency('Zar')?.symbol).toBe('R');
    expect(getCurrency('UNKNOWN')).toBeUndefined();
    expect(getCurrency(null)).toBeUndefined();
    expect(getCurrency(undefined)).toBeUndefined();
  });

  it('sorts getAllCurrencies alphabetically by name', () => {
    const all = getAllCurrencies();
    expect(all.length).toBe(CURRENCIES.length);
    for (let i = 1; i < all.length; i++) {
      expect(all[i].name.localeCompare(all[i - 1].name)).toBeGreaterThanOrEqual(0);
    }
  });

  it('includes searchable country keywords for major regions', () => {
    const zar = getCurrency('ZAR');
    expect(zar?.countries).toContain('South Africa');

    const gbp = getCurrency('GBP');
    expect(gbp?.countries).toContain('United Kingdom');
    expect(gbp?.countries).toContain('England');

    const usd = getCurrency('USD');
    expect(usd?.countries).toContain('America');

    const eur = getCurrency('EUR');
    expect(eur?.countries).toContain('Germany');
    expect(eur?.countries).toContain('France');
  });
});
