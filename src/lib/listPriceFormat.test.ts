import { describe, expect, it } from 'vitest';
import { calculate } from './calculations';
import { formatListPrice, getListCurrencySymbol } from './listPriceFormat';
import type { CoffeeLot, Fee } from '../types';

describe('listPriceFormat helper', () => {
  it('formats EUR correctly with Euro symbol', () => {
    expect(formatListPrice(18.5, 'EUR')).toBe('€18.50');
    expect(formatListPrice(20, 'EUR')).toBe('€20.00');
  });

  it('formats GBP correctly with Pound symbol', () => {
    expect(formatListPrice(18.5, 'GBP')).toBe('£18.50');
    expect(formatListPrice(25, 'GBP')).toBe('£25.00');
  });

  it('formats USD correctly with Dollar symbol', () => {
    expect(formatListPrice(18.5, 'USD')).toBe('$18.50');
  });

  it('formats ZAR correctly with Rand symbol', () => {
    expect(formatListPrice(18.5, 'ZAR')).toBe('R 18.50');
  });

  it('formats zero-decimal currencies like JPY with no decimal digits', () => {
    expect(formatListPrice(2500, 'JPY')).toBe('¥2,500');
    expect(formatListPrice(2500.8, 'JPY')).toBe('¥2,501');
  });

  it('handles unknown codes gracefully with code prefix', () => {
    expect(formatListPrice(18.5, 'XYZ')).toBe('XYZ 18.50');
    expect(formatListPrice(10, 'UNKNOWN')).toBe('UNKNOWN 10');
  });

  it('preserves plain unlabelled numbers when currencyCode is null, undefined, or empty', () => {
    expect(formatListPrice(18.5, undefined)).toBe('18.50');
    expect(formatListPrice(20, null)).toBe('20');
    expect(formatListPrice(15, '')).toBe('15');
  });

  it('returns appropriate currency symbol or fallback', () => {
    expect(getListCurrencySymbol('EUR')).toBe('€');
    expect(getListCurrencySymbol('GBP')).toBe('£');
    expect(getListCurrencySymbol('USD')).toBe('$');
    expect(getListCurrencySymbol('ZAR')).toBe('R');
    expect(getListCurrencySymbol('JPY')).toBe('¥');
    expect(getListCurrencySymbol('XYZ')).toBe('XYZ');
    expect(getListCurrencySymbol(null)).toBe('');
  });

  it('proves a currency change alters NO calculated amounts in calculations.ts', () => {
    const lots: CoffeeLot[] = [
      {
        id: 'lot-1',
        name: 'Ethiopia Yirgacheffe',
        foreignPricePerBag: 20, // 20 units
        gramsPerBag: 250,
        quantity: 2,
        bags: [
          {
            id: 'b-1',
            splitMode: 'full',
            buyers: [{ id: 'buyer-1', personId: 'p-1', grams: 250 }],
          },
          {
            id: 'b-2',
            splitMode: 'equal',
            buyers: [
              { id: 'buyer-2', personId: 'p-1', grams: 125 },
              { id: 'buyer-3', personId: 'p-2', grams: 125 },
            ],
          },
        ],
        shares: [
          { id: 's-1', personId: 'p-1', shareGrams: 375 },
          { id: 's-2', personId: 'p-2', shareGrams: 125 },
        ],
      },
      {
        id: 'lot-2',
        name: 'Colombia Huila',
        foreignPricePerBag: 30, // 30 units
        gramsPerBag: 250,
        quantity: 1,
        bags: [
          {
            id: 'b-3',
            splitMode: 'full',
            buyers: [{ id: 'buyer-4', personId: 'p-2', grams: 250 }],
          },
        ],
        shares: [{ id: 's-3', personId: 'p-2', shareGrams: 250 }],
      },
    ];

    const fees: Fee[] = [
      {
        id: 'fee-1',
        label: 'Shipping',
        amountZar: 150,
        allocationType: 'proportional_by_value',
      },
    ];

    const totalZarPaid = 1200;
    const payerId = 'p-1';
    const participants = ['p-1', 'p-2'];
    const payments = {};
    const personNames = { 'p-1': 'Alice', 'p-2': 'Bob' };

    const orderBase = {
      id: 'order-1',
      workspaceId: 'ws-1',
      name: 'Batch 1',
      orderDate: '2026-03-20',
      roasterId: null,
      roasterSnapshot: null,
      payerId,
      payerBank: { bankName: '', accountNumber: '', beneficiary: '' },
      referenceTemplate: 'REF',
      goodsTotalZar: totalZarPaid,
      lots,
      fees,
      payments,
      isArchived: false,
      createdAt: '2026-03-20T00:00:00Z',
      updatedAt: '2026-03-20T00:00:00Z',
    };

    // Calculation run 1: interpreted under EUR
    const resultWithEur = calculate({ ...orderBase, listCurrency: 'EUR' }, personNames);

    // Calculation run 2: interpreted under USD
    const resultWithUsd = calculate({ ...orderBase, listCurrency: 'USD' }, personNames);

    // Calculation run 3: interpreted under JPY
    const resultWithJpy = calculate({ ...orderBase, listCurrency: 'JPY' }, personNames);

    expect(resultWithEur).toEqual(resultWithUsd);
    expect(resultWithUsd).toEqual(resultWithJpy);
    expect(resultWithEur.isValid).toBe(true);
    expect(resultWithEur.totalOrderZar).toBe(1350);
  });
});
