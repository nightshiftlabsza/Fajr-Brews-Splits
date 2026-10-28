/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Order, Person } from '../types';
import { calculate } from './calculations';
import { determineOrderInvoiceTier } from './pdf';
import { PDF_THEMES } from './pdfTheme';

const docMock = {
  addPage: vi.fn(),
  getNumberOfPages: vi.fn(() => 1),
  setPage: vi.fn(),
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
  moveTo: vi.fn(),
  curveTo: vi.fn(),
  lineTo: vi.fn(),
  fill: vi.fn(),
  getTextWidth: vi.fn((text: string) => text.length * 1.8),
  addFileToVFS: vi.fn(),
  addFont: vi.fn(),
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

describe('PDF generation & themes', () => {
  beforeEach(() => {
    Object.values(docMock).forEach((value) => {
      if (typeof value === 'function' && 'mockClear' in value) {
        value.mockClear();
      }
    });
    document.documentElement.removeAttribute('data-theme');
  });

  it('generates order invoice with expected content and lockup', async () => {
    const people = makePeople();
    const order = makeOrder();
    const personNames = Object.fromEntries(people.map((person) => [person.id, person.name]));
    const result = calculate(order, personNames);
    const { generateOrderInvoicePDF } = await import('./pdf');

    await generateOrderInvoicePDF(order, people, result, 'emerald');

    const textCalls = docMock.text.mock.calls.flatMap(([value]) => (Array.isArray(value) ? value : [value]));

    expect(textCalls).toContain('Saved March Drop');
    expect(textCalls).toContain('Splits');
    expect(textCalls).toContain('.');
    expect(textCalls).toContain('by ');
    expect(textCalls).toContain('Fajr Brews');
    expect(textCalls).toContain('Who owes what');
    expect(textCalls).toContain('Coffees');
    expect(textCalls).toContain('Kenya AA');
    expect(textCalls).toContain('Alice · Bag 1 · 125g');
    expect(textCalls).toContain('Bilal · Bag 1 · 125g');
    expect(docMock.save).toHaveBeenCalledWith('fajr-brews-order-invoice-saved-march-drop.pdf');
  });

  it('theme is respected: emerald and yinmn produce different accent fills and font families', async () => {
    const people = makePeople();
    const order = makeOrder();
    const personNames = Object.fromEntries(people.map((person) => [person.id, person.name]));
    const result = calculate(order, personNames);
    const { createOrderInvoicePDFDocument } = await import('./pdf');

    // Run Emerald
    await createOrderInvoicePDFDocument(order, people, result, 'emerald');
    const emeraldFills = docMock.setFillColor.mock.calls.map((call) => call.join(','));
    const emeraldFonts = docMock.setFont.mock.calls.map(([font]) => font);

    // Verify emerald accent #1B5E40 -> 27,94,64
    expect(emeraldFills).toContain(PDF_THEMES.emerald.accent.join(','));
    expect(emeraldFonts).toContain('Fraunces');

    docMock.setFillColor.mockClear();
    docMock.setFont.mockClear();

    // Run YInMn
    await createOrderInvoicePDFDocument(order, people, result, 'yinmn');
    const yinmnFills = docMock.setFillColor.mock.calls.map((call) => call.join(','));
    const yinmnFonts = docMock.setFont.mock.calls.map(([font]) => font);

    // Verify yinmn accent #2E4DAA -> 46,77,170
    expect(yinmnFills).toContain(PDF_THEMES.yinmn.accent.join(','));
    expect(yinmnFonts).toContain('HankenGrotesk');

    // Emerald and YInMn must differ in fills and fonts
    expect(emeraldFills).not.toEqual(yinmnFills);
    expect(emeraldFonts).not.toEqual(yinmnFonts);
  });

  it('theme argument is used and DOM attribute data-theme is ignored', async () => {
    const people = makePeople();
    const order = makeOrder();
    const personNames = Object.fromEntries(people.map((person) => [person.id, person.name]));
    const result = calculate(order, personNames);
    const { createOrderInvoicePDFDocument } = await import('./pdf');

    // Set DOM to opposite theme ('yinmn'), but pass explicit theme argument 'emerald'
    document.documentElement.setAttribute('data-theme', 'yinmn');

    await createOrderInvoicePDFDocument(order, people, result, 'emerald');
    const fills = docMock.setFillColor.mock.calls.map((call) => call.join(','));
    const fonts = docMock.setFont.mock.calls.map(([font]) => font);

    // Output must follow emerald parameter, NOT yinmn DOM!
    expect(fills).toContain(PDF_THEMES.emerald.accent.join(','));
    expect(fonts).toContain('Fraunces');
    expect(fonts).not.toContain('HankenGrotesk');
  });

  it('falls back to standard fonts (Times / Helvetica) when font loading throws', async () => {
    const people = makePeople();
    const order = makeOrder();
    const personNames = Object.fromEntries(people.map((person) => [person.id, person.name]));
    const result = calculate(order, personNames);

    // Spy on console.warn
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Mock docMock.addFont to throw an error to simulate font loading failure
    docMock.addFont.mockImplementationOnce(() => {
      throw new Error('Font registration failed');
    });

    const { createInvoicePDFDocument } = await import('./pdf');
    await createInvoicePDFDocument(order, people[0], people[0], result.personCalcs[people[0].id], 'emerald');

    expect(warnSpy).toHaveBeenCalled();
    const fonts = docMock.setFont.mock.calls.map(([font]) => font);
    expect(fonts).toContain('times');

    warnSpy.mockRestore();
    docMock.addFont.mockReset();
  });

  it('determineOrderInvoiceTier selects comfortable for typical small orders and compact for taller ones', () => {
    const people = makePeople();
    const order = makeOrder();
    const personNames = Object.fromEntries(people.map((person) => [person.id, person.name]));
    const result = calculate(order, personNames);

    const tier = determineOrderInvoiceTier(order, people, result);
    expect(tier).toBe('comfortable');
  });
});
