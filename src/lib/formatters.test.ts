import { describe, expect, it } from 'vitest';
import {
  cleanFirstNamePart,
  cleanRoasterPart,
  formatMonthYear,
  generatePaymentReference,
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
