import { describe, expect, it } from 'vitest';
import type { Order, Person } from '../types';
import { calculate } from './calculations';
import { buildInvoiceModel, buildPaymentSummaryText } from './invoiceFormatter';

const abdul: Person = {
  id: 'abdul',
  workspaceId: 'workspace-1',
  name: 'Abdul',
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
};

const ahmed: Person = {
  id: 'ahmed',
  workspaceId: 'workspace-1',
  name: 'Ahmed',
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
};

function makeOrder(): Order {
  return {
    id: 'order-1',
    workspaceId: 'workspace-1',
    name: 'March Drop',
    orderDate: '2026-03-01',
    roasterId: null,
    roasterSnapshot: null,
    payerId: abdul.id,
    payerBank: { bankName: 'Fajr Bank', accountNumber: '12345', beneficiary: 'Abdul' },
    referenceTemplate: 'FAJR-{ORDER}-{NAME}',
    goodsTotalZar: 200,
    lots: [
      {
        id: 'lot-1',
        name: 'Pastel Hour',
        foreignPricePerBag: 20,
        gramsPerBag: 250,
        quantity: 1,
        shares: [
          { id: 'share-abdul', personId: abdul.id, shareGrams: 125, bagIndex: 0 },
          { id: 'share-ahmed', personId: ahmed.id, shareGrams: 125, bagIndex: 0 },
        ],
        bags: [
          {
            id: 'bag-1',
            splitMode: 'equal',
            buyers: [
              { id: 'buyer-abdul', personId: abdul.id, grams: 125 },
              { id: 'buyer-ahmed', personId: ahmed.id, grams: 125 },
            ],
          },
        ],
      },
    ],
    fees: [
      { id: 'fee-import', label: 'DHL disbursement', amountZar: 150, allocationType: 'equal_per_person' },
      { id: 'fee-pudo', label: 'PUDO courier', amountZar: 60, allocationType: 'specific_person', personId: ahmed.id },
    ],
    payments: {},
    isArchived: true,
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
  };
}

describe('invoiceFormatter', () => {
  it('uses correct shared wording for split bags, equal fees, and person-specific fees', () => {
    const order = makeOrder();
    const peopleById = { [abdul.id]: abdul.name, [ahmed.id]: ahmed.name };
    const result = calculate(order, peopleById);
    const ahmedCalc = result.personCalcs[ahmed.id];

    const invoice = buildInvoiceModel({ order, person: ahmed, payer: abdul, calc: ahmedCalc });
    const summary = buildPaymentSummaryText({ order, person: ahmed, payer: abdul, calc: ahmedCalc });

    expect(invoice.coffeeLines[0]).toMatchObject({
      name: 'Pastel Hour',
      detail: 'Bag 1: 125g from 250g bag',
      splitWith: ['Abdul'],
    });
    expect(invoice.feeLines).toEqual([
      expect.objectContaining({ label: 'DHL disbursement', methodLabel: 'Equal per person' }),
      expect.objectContaining({ label: 'PUDO courier to Ahmed', methodLabel: 'Specific person' }),
    ]);
    expect(summary).toContain('PUDO courier to Ahmed (Specific person)');
    expect(summary.toLowerCase()).not.toContain('per gram');
  });
});
