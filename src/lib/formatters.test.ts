import { describe, expect, it } from 'vitest';
import {
  cleanFirstNamePart,
  cleanRoasterPart,
  formatMonthYear,
  generatePaymentReference,
  parseMoneyInput,
  resolveReference,
} from './formatters';

describe('Payment Reference Generation', () => {
  it('generates ROASTER-MONYY-FIRSTNAME in uppercase when <= 20 characters', () => {
    const ref = generatePaymentReference(
      {
        name: 'Seven Weeks Coffee',
        orderDate: '2026-04-15',
        roasterSnapshot: { name: 'Seven' },
      },
      'Zafar Harnekar'
    );
    expect(ref).toBe('SEVEN-APR26-ZAFAR');
    expect(ref.length).toBe(17);
    expect(ref.length).toBeLessThanOrEqual(20);
  });

  it('generates DAK-AUG26-ZAFAR for short roasters', () => {
    const ref = generatePaymentReference(
      {
        name: 'DAK',
        orderDate: '2026-08-10',
        roasterSnapshot: { name: 'DAK' },
      },
      'Zafar Harnekar'
    );
    expect(ref).toBe('DAK-AUG26-ZAFAR');
    expect(ref.length).toBe(15);
    expect(ref.length).toBeLessThanOrEqual(20);
  });

  it('handles the exact 20-character boundary', () => {
    // ROSETTA (7) + - (1) + AUG26 (5) + - (1) + ZAKARY (6) = 20
    const ref = generatePaymentReference(
      {
        name: 'Rosetta',
        orderDate: '2026-08-01',
        roasterSnapshot: { name: 'Rosetta' },
      },
      'Zakary Smith'
    );
    expect(ref).toBe('ROSETTA-AUG26-ZAKARY');
    expect(ref.length).toBe(20);
    expect(ref.length).toBeLessThanOrEqual(20);
  });

  it('falls back to FIRSTNAME-MONYY when preferred format is 21 characters (BLUEBERRY-AUG26-ZAFAR boundary)', () => {
    // BLUEBERRY (9) + - (1) + AUG26 (5) + - (1) + ZAFAR (5) = 21 > 20
    const ref = generatePaymentReference(
      {
        name: 'Blueberry Roasters',
        orderDate: '2026-08-15',
        roasterSnapshot: { name: 'Blueberry Roasters' },
      },
      'Zafar Harnekar'
    );
    expect(ref).toBe('ZAFAR-AUG26');
    expect(ref.length).toBe(11);
    expect(ref.length).toBeLessThanOrEqual(20);
  });

  it('falls back to FIRSTNAME-MONYY when preferred format is 21 characters (ORIGIN-DEC26-ABDULLAH boundary)', () => {
    // ORIGIN (6) + - (1) + DEC26 (5) + - (1) + ABDULLAH (8) = 21 > 20
    const ref = generatePaymentReference(
      {
        name: 'Origin Coffee Roasting',
        orderDate: '2026-12-01',
        roasterSnapshot: { name: 'Origin Coffee Roasting' },
      },
      'Abdullah Bin Tariq'
    );
    expect(ref).toBe('ABDULLAH-DEC26');
    expect(ref.length).toBe(14);
    expect(ref.length).toBeLessThanOrEqual(20);
  });

  it('shortens first name when FIRSTNAME-MONYY exceeds 20 characters for significantly long names', () => {
    // Bartholomewchristopher (23) + - (1) + AUG26 (5) = 29 > 20
    const ref = generatePaymentReference(
      {
        name: 'Extremely Long Coffee Roastery Name',
        orderDate: '2026-08-01',
      },
      'Bartholomewchristopher'
    );
    expect(ref).toBe('BARTHOLOMEWCHR-AUG26');
    expect(ref.length).toBe(20);
    expect(ref.length).toBeLessThanOrEqual(20);
  });

  it('normalizes accents and strips punctuation', () => {
    const ref = generatePaymentReference(
      {
        name: 'Café Météor',
        orderDate: '2026-05-10',
        roasterSnapshot: { name: 'Café Météor' },
      },
      'René & François'
    );
    // CAFEMETEOR (10) + - (1) + MAY26 (5) + - (1) + RENE (4) = 21 > 20 -> Fallback RENE-MAY26
    expect(ref).toBe('RENE-MAY26');
    expect(ref.length).toBeLessThanOrEqual(20);
  });

  it('cleans roaster name noise words', () => {
    expect(cleanRoasterPart('Blueberry Roasters')).toBe('BLUEBERRY');
    expect(cleanRoasterPart('Father Coffee (Pty) Ltd')).toBe('FATHER');
    expect(cleanRoasterPart('Origin Coffee Roasting')).toBe('ORIGIN');
    expect(cleanRoasterPart('Coffee')).toBe('COFFEE');
  });

  it('cleans person name into first name only', () => {
    expect(cleanFirstNamePart('Zafar Harnekar')).toBe('ZAFAR');
    expect(cleanFirstNamePart('Abdullah Bin Tariq')).toBe('ABDULLAH');
    expect(cleanFirstNamePart('René François')).toBe('RENE');
    expect(cleanFirstNamePart('')).toBe('FRIEND');
  });

  it('formats month and 2-digit year correctly', () => {
    expect(formatMonthYear('2026-01-15')).toBe('JAN26');
    expect(formatMonthYear('2026-08-20')).toBe('AUG26');
    expect(formatMonthYear('2026-12-31')).toBe('DEC26');
    expect(formatMonthYear('2025-04-05')).toBe('APR25');
  });

  it('resolveReference delegates to generatePaymentReference', () => {
    const ref = resolveReference('FAJR-{ORDER}-{NAME}', 'Seven', 'Zafar', '2026-04-15');
    expect(ref).toBe('SEVEN-APR26-ZAFAR');
  });
});

describe('parseMoneyInput (BUG-EDGE-04)', () => {
  it('parses comma decimals correctly without truncating cents', () => {
    expect(parseMoneyInput('12,50')).toBe(12.5);
    expect(parseMoneyInput('1250,50')).toBe(1250.5);
    expect(parseMoneyInput('1250,75')).toBe(1250.75);
    expect(parseMoneyInput('0,99')).toBe(0.99);
  });

  it('parses standard dot decimals correctly', () => {
    expect(parseMoneyInput('12.50')).toBe(12.5);
    expect(parseMoneyInput('1250.75')).toBe(1250.75);
    expect(parseMoneyInput('0.05')).toBe(0.05);
  });

  it('normalizes currency symbols and trailing ZAR', () => {
    expect(parseMoneyInput('R12,50')).toBe(12.5);
    expect(parseMoneyInput('R 1250,50')).toBe(1250.5);
    expect(parseMoneyInput('r 99.95')).toBe(99.95);
    expect(parseMoneyInput('ZAR 450,00')).toBe(450);
    expect(parseMoneyInput('1250,50 ZAR')).toBe(1250.5);
    expect(parseMoneyInput('$19.99')).toBe(19.99);
    expect(parseMoneyInput('€25,50')).toBe(25.5);
    expect(parseMoneyInput('£10.00')).toBe(10);
  });

  it('handles thousands grouping separators (spaces, commas, and dots)', () => {
    expect(parseMoneyInput('1 250,50')).toBe(1250.5);
    expect(parseMoneyInput('1,250.50')).toBe(1250.5);
    expect(parseMoneyInput('1.250,50')).toBe(1250.5);
    expect(parseMoneyInput('10 000,00')).toBe(10000);
    expect(parseMoneyInput('1,000,000')).toBe(1000000);
  });

  it('handles whitespace around inputs', () => {
    expect(parseMoneyInput('   12,50   ')).toBe(12.5);
    expect(parseMoneyInput(' \t  R 350,25 \n ')).toBe(350.25);
  });

  it('handles negative numbers', () => {
    expect(parseMoneyInput('-15,50')).toBe(-15.5);
    expect(parseMoneyInput('- 120.00')).toBe(-120);
    expect(parseMoneyInput('-R50,25')).toBe(-50.25);
  });

  it('passes numbers through directly if finite', () => {
    expect(parseMoneyInput(100)).toBe(100);
    expect(parseMoneyInput(12.5)).toBe(12.5);
    expect(parseMoneyInput(0)).toBe(0);
    expect(parseMoneyInput(-42.5)).toBe(-42.5);
  });

  it('handles empty, null, undefined, and non-numeric inputs safely', () => {
    expect(parseMoneyInput(null)).toBe(0);
    expect(parseMoneyInput(undefined)).toBe(0);
    expect(parseMoneyInput('')).toBe(0);
    expect(parseMoneyInput('   ')).toBe(0);
    expect(parseMoneyInput('R ')).toBe(0);
    expect(parseMoneyInput('abc')).toBe(0);
    expect(parseMoneyInput(NaN)).toBe(0);
    expect(parseMoneyInput(Infinity)).toBe(0);
    expect(parseMoneyInput(-Infinity)).toBe(0);
  });
});
