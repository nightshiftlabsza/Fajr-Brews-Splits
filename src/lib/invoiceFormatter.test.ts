import { describe, expect, it } from 'vitest';
import type { Order, Person } from '../types';
import { calculate } from './calculations';
import {
  buildEmailMessageText,
  buildInvoiceModel,
  buildPaymentSummaryText,
  buildWhatsAppMessageText,
} from './invoiceFormatter';

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
    name: 'Blueberry Roasters',
    orderDate: '2026-08-15',
    roasterId: null,
    roasterSnapshot: { name: 'Blueberry Roasters' },
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
    expect(summary).toContain('Pastel Hour · 125g — R235.00');
    expect(summary).toContain('(R100.00 coffee + R75.00 dhl disbursement + R60.00 pudo courier)');
    expect(summary).toContain('Total due: R235.00');
    expect(summary.toLowerCase()).not.toContain('per gram');
  });

  it('formats WhatsApp message with requested greeting and *bold* / _italic_ syntax', () => {
    const order = makeOrder();
    const peopleById = { [abdul.id]: abdul.name, [ahmed.id]: ahmed.name };
    const result = calculate(order, peopleById);
    const ahmedCalc = result.personCalcs[ahmed.id];

    const whatsapp = buildWhatsAppMessageText({ order, person: ahmed, payer: abdul, calc: ahmedCalc });

    expect(whatsapp).toContain('Assalamualaykum Brother. Hope you are well. Attached are the amounts for the *Blueberry Roasters* order - shukran.');
    expect(whatsapp).toContain('*Your coffee:*');
    expect(whatsapp).toContain('*Pastel Hour · 125g* — *R235.00*');
    expect(whatsapp).toContain('_(R100.00 coffee + R75.00 dhl disbursement + R60.00 pudo courier)_');
    expect(whatsapp).toContain('*Total due: R235.00*');
    expect(whatsapp).toContain('*Payment reference: AHMED-AUG26*');
    expect(whatsapp).toContain('*Pay to:* Fajr Bank 12345 (Abdul)');
  });

  it('formats Email message with plain text', () => {
    const order = makeOrder();
    const peopleById = { [abdul.id]: abdul.name, [ahmed.id]: ahmed.name };
    const result = calculate(order, peopleById);
    const ahmedCalc = result.personCalcs[ahmed.id];

    const email = buildEmailMessageText({ order, person: ahmed, payer: abdul, calc: ahmedCalc });

    expect(email).toContain('Assalamualaykum Brother. Hope you are well. Attached are the amounts for the Blueberry Roasters order - shukran.');
    expect(email).toContain('Your coffee:');
    expect(email).toContain('Pastel Hour · 125g — R235.00');
    expect(email).toContain('(R100.00 coffee + R75.00 dhl disbursement + R60.00 pudo courier)');
    expect(email).toContain('Total due: R235.00');
    expect(email).toContain('Payment reference: AHMED-AUG26');
  });
});
