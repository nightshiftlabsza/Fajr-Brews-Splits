import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Order, Person } from '../types';
import { calculate } from './calculations';

const docMock = {
  addPage: vi.fn(),
  line: vi.fn(),
  rect: vi.fn(),
  roundedRect: vi.fn(),
  save: vi.fn(),
  setDrawColor: vi.fn(),
  setFillColor: vi.fn(),
  setFont: vi.fn(),
  setFontSize: vi.fn(),
  setLineWidth: vi.fn(),
  setTextColor: vi.fn(),
  splitTextToSize: vi.fn((text: string) => [text]),
  text: vi.fn(),
};

vi.mock('jspdf', () => ({
  jsPDF: vi.fn(() => docMock),
}));

function makePeople(): Person[] {
  return [
    {
      id: 'person-1',
      workspaceId: 'workspace-1',
      name: 'Alice',
      createdAt: '2026-03-18T00:00:00.000Z',
      updatedAt: '2026-03-18T00:00:00.000Z',
    },
    {
      id: 'person-2',
      workspaceId: 'workspace-1',
      name: 'Bilal',
      createdAt: '2026-03-18T00:00:00.000Z',
      updatedAt: '2026-03-18T00:00:00.000Z',
    },
  ];
}

function makeOrder(): Order {
  return {
    id: 'order-1',
    workspaceId: 'workspace-1',
    name: 'Saved March Drop',
    orderDate: '2026-03-18',
    roasterId: null,
    roasterSnapshot: null,
    payerId: 'person-1',
    payerBank: { bankName: 'Fajr Bank', accountNumber: '12345', beneficiary: 'Alice' },
    referenceTemplate: 'FAJR-{ORDER}-{NAME}',
    goodsTotalZar: 240,
    lots: [
      {
        id: 'lot-1',
        name: 'Kenya AA',
        foreignPricePerBag: 12,
        gramsPerBag: 250,
        quantity: 1,
        shares: [
          { id: 'share-1', personId: 'person-1', shareGrams: 125, bagIndex: 0 },
          { id: 'share-2', personId: 'person-2', shareGrams: 125, bagIndex: 0 },
        ],
        bagAllocations: [
          {
            id: 'bag-0',
            bagIndex: 0,
            mode: 'split',
            participants: [
              { id: 'participant-1', personId: 'person-1', shareGrams: 125, sourceShareId: 'share-1' },
              { id: 'participant-2', personId: 'person-2', shareGrams: 125, sourceShareId: 'share-2' },
            ],
          },
        ],
      },
    ],
    fees: [
      { id: 'fee-1', label: 'Shipping', allocationType: 'value_based', amountZar: 60 },
    ],
    payments: {},
    isArchived: true,
    createdAt: '2026-03-18T00:00:00.000Z',
    updatedAt: '2026-03-18T00:00:00.000Z',
  };
}

describe('generateOrderInvoicePDF', () => {
  beforeEach(() => {
    Object.values(docMock).forEach((value) => {
      if (typeof value === 'function' && 'mockClear' in value) {
        value.mockClear();
      }
    });
  });

  it('includes coffee totals, extra fees, and buyer allocations in the full order PDF', async () => {
    const people = makePeople();
    const order = makeOrder();
    const personNames = Object.fromEntries(people.map((person) => [person.id, person.name]));
    const result = calculate(order, personNames);
    const { generateOrderInvoicePDF } = await import('./pdf');

    await generateOrderInvoicePDF(order, people, result);

    const textCalls = docMock.text.mock.calls.flatMap(([value]) => Array.isArray(value) ? value : [value]);

    expect(textCalls).toContain('Saved March Drop');
    expect(textCalls).toContain('KENYA AA');
    expect(textCalls).toContain('Shipping (value-based)');
    expect(textCalls).toContain('Alice · Bag 1 · 125g');
    expect(textCalls).toContain('Bilal · Bag 1 · 125g');
    expect(textCalls).toContain('Split bag · Split with Bilal');
    expect(textCalls).toContain('Split bag · Split with Alice');
    expect(docMock.save).toHaveBeenCalledWith('fajr-brews-order-invoice-saved-march-drop.pdf');
  });
});
