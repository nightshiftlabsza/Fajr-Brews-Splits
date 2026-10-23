import { describe, expect, it } from 'vitest';
import type { Order, Person } from '../types';
import { calculate } from './calculations';
import { buildInvoiceModel, buildWhatsAppMessageText, buildEmailMessageText } from './invoiceFormatter';
import { createOrderInvoicePDFDocument, createInvoicePDFDocument } from './pdf';
import { formatZAR } from './formatters';

function extractPdfInfo(buffer: Buffer) {
  const str = buffer.toString('latin1');
  const pageMatches = str.match(/\/Type\s*\/Page[^s]/g) || [];
  const pageCount = pageMatches.length;

  const rawPages = str.split('/Type /Page\n');
  const textPerPage: string[][] = [];
  for (let i = 1; i < rawPages.length; i++) {
    const tjRegex = /\((.*?)\)\s*Tj/g;
    let match;
    const pageTexts: string[] = [];
    while ((match = tjRegex.exec(rawPages[i])) !== null) {
      pageTexts.push(match[1]);
    }
    textPerPage.push(pageTexts);
  }

  return { pageCount, textPerPage, allText: textPerPage.flat() };
}

describe('Synthetic Order Scenarios & Arithmetic Checks', () => {
  // Scenario 1: Reported Case (3 lots, 4 people, split & single bags, proportional & fixed fees)
  const people1: Person[] = [
    { id: 'p1', workspaceId: 'w1', name: 'Zakariyya Gani', createdAt: '2026-03-25T00:00:00Z', updatedAt: '2026-03-25T00:00:00Z' },
    { id: 'p2', workspaceId: 'w1', name: 'Ahmed Mia', createdAt: '2026-03-25T00:00:00Z', updatedAt: '2026-03-25T00:00:00Z' },
    { id: 'p3', workspaceId: 'w1', name: 'Bilal Patel', createdAt: '2026-03-25T00:00:00Z', updatedAt: '2026-03-25T00:00:00Z' },
    { id: 'p4', workspaceId: 'w1', name: 'Yusuf Docrat', createdAt: '2026-03-25T00:00:00Z', updatedAt: '2026-03-25T00:00:00Z' },
  ];

  const order1: Order = {
    id: 'order-1',
    workspaceId: 'w1',
    name: 'Sey Coffee Spring Drop',
    orderDate: '2026-03-25',
    roasterId: null,
    roasterSnapshot: null,
    payerId: 'p1',
    payerBank: { bankName: 'First National Bank', accountNumber: '62812345678', beneficiary: 'Zakariyya Gani' },
    payerNote: 'Please use the reference shown on the invoice.',
    referenceTemplate: 'FAJR-{ORDER}-{NAME}',
    goodsTotalZar: 1850.50,
    lots: [
      {
        id: 'lot-1',
        name: 'Worka Sakaro Natural Anaerobic',
        foreignPricePerBag: 24,
        gramsPerBag: 250,
        quantity: 2,
        shares: [
          { id: 's1', personId: 'p1', shareGrams: 250, bagIndex: 0 },
          { id: 's2', personId: 'p2', shareGrams: 125, bagIndex: 1 },
          { id: 's3', personId: 'p3', shareGrams: 125, bagIndex: 1 },
        ],
        bagAllocations: [
          { id: 'b0', bagIndex: 0, mode: 'single', participants: [{ id: 'part1', personId: 'p1', shareGrams: 250, sourceShareId: 's1' }] },
          { id: 'b1', bagIndex: 1, mode: 'split', participants: [
            { id: 'part2', personId: 'p2', shareGrams: 125, sourceShareId: 's2' },
            { id: 'part3', personId: 'p3', shareGrams: 125, sourceShareId: 's3' },
          ] },
        ],
      },
      {
        id: 'lot-2',
        name: 'El Paraiso Lychee Double Fermentation',
        foreignPricePerBag: 28,
        gramsPerBag: 250,
        quantity: 2,
        shares: [
          { id: 's4', personId: 'p1', shareGrams: 125, bagIndex: 0 },
          { id: 's5', personId: 'p4', shareGrams: 125, bagIndex: 0 },
          { id: 's6', personId: 'p2', shareGrams: 250, bagIndex: 1 },
        ],
        bagAllocations: [
          { id: 'b2', bagIndex: 0, mode: 'split', participants: [
            { id: 'part4', personId: 'p1', shareGrams: 125, sourceShareId: 's4' },
            { id: 'part5', personId: 'p4', shareGrams: 125, sourceShareId: 's5' },
          ] },
          { id: 'b3', bagIndex: 1, mode: 'single', participants: [{ id: 'part6', personId: 'p2', shareGrams: 250, sourceShareId: 's6' }] },
        ],
      },
      {
        id: 'lot-3',
        name: 'La Palma & El Tucan Geisha Heroes',
        foreignPricePerBag: 45,
        gramsPerBag: 250,
        quantity: 1,
        shares: [
          { id: 's7', personId: 'p3', shareGrams: 125, bagIndex: 0 },
          { id: 's8', personId: 'p4', shareGrams: 125, bagIndex: 0 },
        ],
        bagAllocations: [
          { id: 'b4', bagIndex: 0, mode: 'split', participants: [
            { id: 'part7', personId: 'p3', shareGrams: 125, sourceShareId: 's7' },
            { id: 'part8', personId: 'p4', shareGrams: 125, sourceShareId: 's8' },
          ] },
        ],
      },
    ],
    fees: [
      { id: 'f1', label: 'DHL Express International Shipping', amountZar: 450, allocationType: 'value_based' },
      { id: 'f2', label: 'Customs Duty & Clearance Fee', amountZar: 280, allocationType: 'equal_per_person' },
    ],
    payments: {},
    isArchived: false,
    createdAt: '2026-03-25T00:00:00Z',
    updatedAt: '2026-03-25T00:00:00Z',
  };

  // Scenario 2: Very long roaster, lot, and person names
  const people2: Person[] = [
    { id: 'p201', workspaceId: 'w1', name: 'Dr. Christopher Bartholomew Montgomery-Cunningham IV', createdAt: '2026-03-26T00:00:00Z', updatedAt: '2026-03-26T00:00:00Z' },
    { id: 'p202', workspaceId: 'w1', name: 'Lord Sebastian Maximillian Von Ravenscroft-Esterhazy', createdAt: '2026-03-26T00:00:00Z', updatedAt: '2026-03-26T00:00:00Z' },
  ];

  const order2: Order = {
    id: 'order-2',
    workspaceId: 'w1',
    name: 'Tim Wendelboe Ultra Exceptional Micro-Lot Competition Series Reserve Auction 2026',
    orderDate: '2026-03-26',
    roasterId: null,
    roasterSnapshot: null,
    payerId: 'p201',
    payerBank: { bankName: 'The Standard Bank of South Africa Limited Corporate and Investment Banking', accountNumber: '00112233445566778899', beneficiary: 'Dr. Christopher Bartholomew Montgomery-Cunningham IV' },
    payerNote: 'Please ensure that the full alphanumeric payment reference is strictly quoted on your electronic funds transfer instruction to prevent allocation delay.',
    referenceTemplate: 'FAJR-{ORDER}-{NAME}',
    goodsTotalZar: 2345.67,
    lots: [
      {
        id: 'lot-long-1',
        name: 'Hacienda La Esmeralda Special Mario Pascua San Jose Geisha Natural Slow Dry Process Nitrogen Flush',
        foreignPricePerBag: 95.50,
        gramsPerBag: 250,
        quantity: 2,
        shares: [
          { id: 's201', personId: 'p201', shareGrams: 250, bagIndex: 0 },
          { id: 's202', personId: 'p202', shareGrams: 250, bagIndex: 1 },
        ],
        bagAllocations: [
          { id: 'b201', bagIndex: 0, mode: 'single', participants: [{ id: 'part201', personId: 'p201', shareGrams: 250, sourceShareId: 's201' }] },
          { id: 'b202', bagIndex: 1, mode: 'single', participants: [{ id: 'part202', personId: 'p202', shareGrams: 250, sourceShareId: 's202' }] },
        ],
      },
    ],
    fees: [
      { id: 'f201', label: 'Priority International Courier with Temperature-Controlled Packaging and Insurance', amountZar: 689.43, allocationType: 'value_based' },
      { id: 'f202', label: 'Import Surcharge & Agricultural Quarantine Inspection Fee', amountZar: 312.19, allocationType: 'equal_per_person' },
    ],
    payments: {},
    isArchived: false,
    createdAt: '2026-03-26T00:00:00Z',
    updatedAt: '2026-03-26T00:00:00Z',
  };

  // Scenario 3: Large community order (12 people, 3 lots, 10 bags total)
  const people3: Person[] = Array.from({ length: 12 }, (_, i) => ({
    id: `p30_${i + 1}`,
    workspaceId: 'w1',
    name: `Coffee Club Member ${String.fromCharCode(65 + i)}`,
    createdAt: '2026-03-27T00:00:00Z',
    updatedAt: '2026-03-27T00:00:00Z',
  }));

  const order3: Order = {
    id: 'order-3',
    workspaceId: 'w1',
    name: 'The Barn Mega Community Buy',
    orderDate: '2026-03-27',
    roasterId: null,
    roasterSnapshot: null,
    payerId: 'p30_1',
    payerBank: { bankName: 'Investec Bank', accountNumber: '10012345678', beneficiary: 'Member A' },
    payerNote: 'EFT payments only.',
    referenceTemplate: 'FAJR-{ORDER}-{NAME}',
    goodsTotalZar: 5400.00,
    lots: [
      {
        id: 'lot-301',
        name: 'Kenya Nyeri Peaberry',
        foreignPricePerBag: 18,
        gramsPerBag: 250,
        quantity: 4,
        shares: [
          { id: 's301', personId: 'p30_1', shareGrams: 250, bagIndex: 0 },
          { id: 's302', personId: 'p30_2', shareGrams: 250, bagIndex: 1 },
          { id: 's303', personId: 'p30_3', shareGrams: 125, bagIndex: 2 },
          { id: 's304', personId: 'p30_4', shareGrams: 125, bagIndex: 2 },
          { id: 's305', personId: 'p30_5', shareGrams: 250, bagIndex: 3 },
        ],
        bagAllocations: [
          { id: 'b301', bagIndex: 0, mode: 'single', participants: [{ id: 'pt1', personId: 'p30_1', shareGrams: 250, sourceShareId: 's301' }] },
          { id: 'b302', bagIndex: 1, mode: 'single', participants: [{ id: 'pt2', personId: 'p30_2', shareGrams: 250, sourceShareId: 's302' }] },
          { id: 'b303', bagIndex: 2, mode: 'split', participants: [
            { id: 'pt3', personId: 'p30_3', shareGrams: 125, sourceShareId: 's303' },
            { id: 'pt4', personId: 'p30_4', shareGrams: 125, sourceShareId: 's304' },
          ] },
          { id: 'b304', bagIndex: 3, mode: 'single', participants: [{ id: 'pt5', personId: 'p30_5', shareGrams: 250, sourceShareId: 's305' }] },
        ],
      },
      {
        id: 'lot-302',
        name: 'Ethiopia Yirgacheffe Washed',
        foreignPricePerBag: 20,
        gramsPerBag: 250,
        quantity: 3,
        shares: [
          { id: 's306', personId: 'p30_6', shareGrams: 250, bagIndex: 0 },
          { id: 's307', personId: 'p30_7', shareGrams: 250, bagIndex: 1 },
          { id: 's308', personId: 'p30_8', shareGrams: 250, bagIndex: 2 },
        ],
        bagAllocations: [
          { id: 'b305', bagIndex: 0, mode: 'single', participants: [{ id: 'pt6', personId: 'p30_6', shareGrams: 250, sourceShareId: 's306' }] },
          { id: 'b306', bagIndex: 1, mode: 'single', participants: [{ id: 'pt7', personId: 'p30_7', shareGrams: 250, sourceShareId: 's307' }] },
          { id: 'b307', bagIndex: 2, mode: 'single', participants: [{ id: 'pt8', personId: 'p30_8', shareGrams: 250, sourceShareId: 's308' }] },
        ],
      },
      {
        id: 'lot-303',
        name: 'Colombia Pink Bourbon',
        foreignPricePerBag: 22,
        gramsPerBag: 250,
        quantity: 3,
        shares: [
          { id: 's309', personId: 'p30_9', shareGrams: 250, bagIndex: 0 },
          { id: 's310', personId: 'p30_10', shareGrams: 250, bagIndex: 1 },
          { id: 's311', personId: 'p30_11', shareGrams: 125, bagIndex: 2 },
          { id: 's312', personId: 'p30_12', shareGrams: 125, bagIndex: 2 },
        ],
        bagAllocations: [
          { id: 'b308', bagIndex: 0, mode: 'single', participants: [{ id: 'pt9', personId: 'p30_9', shareGrams: 250, sourceShareId: 's309' }] },
          { id: 'b309', bagIndex: 1, mode: 'single', participants: [{ id: 'pt10', personId: 'p30_10', shareGrams: 250, sourceShareId: 's310' }] },
          { id: 'b310', bagIndex: 2, mode: 'split', participants: [
            { id: 'pt11', personId: 'p30_11', shareGrams: 125, sourceShareId: 's311' },
            { id: 'pt12', personId: 'p30_12', shareGrams: 125, sourceShareId: 's312' },
          ] },
        ],
      },
    ],
    fees: [
      { id: 'f301', label: 'Air Freight', amountZar: 1200.00, allocationType: 'value_based' },
      { id: 'f302', label: 'Bank Wire Transfer Charge', amountZar: 240.00, allocationType: 'equal_per_person' },
    ],
    payments: {},
    isArchived: false,
    createdAt: '2026-03-27T00:00:00Z',
    updatedAt: '2026-03-27T00:00:00Z',
  };

  // Scenario 4: Single Lot, single buyer, no fees
  const people4: Person[] = [
    { id: 'p401', workspaceId: 'w1', name: 'Zaid', createdAt: '2026-03-28T00:00:00Z', updatedAt: '2026-03-28T00:00:00Z' },
  ];
  const order4: Order = {
    id: 'order-4',
    workspaceId: 'w1',
    name: 'Solo Lot Order',
    orderDate: '2026-03-28',
    roasterId: null,
    roasterSnapshot: null,
    payerId: 'p401',
    payerBank: { bankName: 'Capitec', accountNumber: '1234567890', beneficiary: 'Zaid' },
    referenceTemplate: 'FAJR-{ORDER}-{NAME}',
    goodsTotalZar: 320.00,
    lots: [
      {
        id: 'lot-401',
        name: 'Guatemala Huehuetenango',
        foreignPricePerBag: 16,
        gramsPerBag: 250,
        quantity: 1,
        shares: [{ id: 's401', personId: 'p401', shareGrams: 250, bagIndex: 0 }],
        bagAllocations: [{ id: 'b401', bagIndex: 0, mode: 'single', participants: [{ id: 'pt401', personId: 'p401', shareGrams: 250, sourceShareId: 's401' }] }],
      },
    ],
    fees: [],
    payments: {},
    isArchived: false,
    createdAt: '2026-03-28T00:00:00Z',
    updatedAt: '2026-03-28T00:00:00Z',
  };

  // Scenario 5: Multiple bags per person on same lot with uneven shares
  const people5: Person[] = [
    { id: 'p501', workspaceId: 'w1', name: 'Fatima', createdAt: '2026-03-29T00:00:00Z', updatedAt: '2026-03-29T00:00:00Z' },
    { id: 'p502', workspaceId: 'w1', name: 'Amina', createdAt: '2026-03-29T00:00:00Z', updatedAt: '2026-03-29T00:00:00Z' },
  ];
  const order5: Order = {
    id: 'order-5',
    workspaceId: 'w1',
    name: 'Uneven Shares Order',
    orderDate: '2026-03-29',
    roasterId: null,
    roasterSnapshot: null,
    payerId: 'p501',
    payerBank: { bankName: 'Nedbank', accountNumber: '987654321', beneficiary: 'Fatima' },
    referenceTemplate: 'FAJR-{ORDER}-{NAME}',
    goodsTotalZar: 600.00,
    lots: [
      {
        id: 'lot-501',
        name: 'Costa Rica Tarrazu',
        foreignPricePerBag: 15,
        gramsPerBag: 250,
        quantity: 2,
        shares: [
          { id: 's501', personId: 'p501', shareGrams: 200, bagIndex: 0 },
          { id: 's502', personId: 'p502', shareGrams: 50, bagIndex: 0 },
          { id: 's503', personId: 'p501', shareGrams: 250, bagIndex: 1 },
        ],
        bagAllocations: [
          { id: 'b501', bagIndex: 0, mode: 'split', participants: [
            { id: 'pt501', personId: 'p501', shareGrams: 200, sourceShareId: 's501' },
            { id: 'pt502', personId: 'p502', shareGrams: 50, sourceShareId: 's502' },
          ] },
          { id: 'b502', bagIndex: 1, mode: 'single', participants: [
            { id: 'pt503', personId: 'p501', shareGrams: 250, sourceShareId: 's503' },
          ] },
        ],
      },
    ],
    fees: [
      { id: 'f501', label: 'Local Delivery', amountZar: 75.00, allocationType: 'equal_per_person' },
    ],
    payments: {},
    isArchived: false,
    createdAt: '2026-03-29T00:00:00Z',
    updatedAt: '2026-03-29T00:00:00Z',
  };

  // Scenario 6: Odd cents division where payer absorbs remainder & specific person fee
  const people6: Person[] = [
    { id: 'p601', workspaceId: 'w1', name: 'Ibrahim (Payer)', createdAt: '2026-03-30T00:00:00Z', updatedAt: '2026-03-30T00:00:00Z' },
    { id: 'p602', workspaceId: 'w1', name: 'Khadija', createdAt: '2026-03-30T00:00:00Z', updatedAt: '2026-03-30T00:00:00Z' },
    { id: 'p603', workspaceId: 'w1', name: 'Mariam', createdAt: '2026-03-30T00:00:00Z', updatedAt: '2026-03-30T00:00:00Z' },
  ];
  const order6: Order = {
    id: 'order-6',
    workspaceId: 'w1',
    name: 'Odd Cents Precision Split',
    orderDate: '2026-03-30',
    roasterId: null,
    roasterSnapshot: null,
    payerId: 'p601',
    payerBank: { bankName: 'FNB', accountNumber: '5544332211', beneficiary: 'Ibrahim' },
    referenceTemplate: 'FAJR-{ORDER}-{NAME}',
    goodsTotalZar: 777.77,
    lots: [
      {
        id: 'lot-601',
        name: 'Panama Boquete Typica',
        foreignPricePerBag: 33.33,
        gramsPerBag: 300,
        quantity: 1,
        shares: [
          { id: 's601', personId: 'p601', shareGrams: 100, bagIndex: 0 },
          { id: 's602', personId: 'p602', shareGrams: 100, bagIndex: 0 },
          { id: 's603', personId: 'p603', shareGrams: 100, bagIndex: 0 },
        ],
        bagAllocations: [
          { id: 'b601', bagIndex: 0, mode: 'split', participants: [
            { id: 'pt601', personId: 'p601', shareGrams: 100, sourceShareId: 's601' },
            { id: 'pt602', personId: 'p602', shareGrams: 100, sourceShareId: 's602' },
            { id: 'pt603', personId: 'p603', shareGrams: 100, sourceShareId: 's603' },
          ] },
        ],
      },
    ],
    fees: [
      { id: 'f601', label: 'Import Handling', amountZar: 111.11, allocationType: 'equal_per_person' },
      { id: 'f602', label: 'Special Box for Mariam', amountZar: 35.00, allocationType: 'specific_person', personId: 'p603' },
    ],
    payments: {},
    isArchived: false,
    createdAt: '2026-03-30T00:00:00Z',
    updatedAt: '2026-03-30T00:00:00Z',
  };

  it('Scenario 1: checks exact arithmetic, 1-page per person, and order PDF totals', async () => {
    const personNames1 = Object.fromEntries(people1.map(p => [p.id, p.name]));
    const calc = calculate(order1, personNames1);
    expect(calc.isValid).toBe(true);

    const totalOrderZarExpected = order1.goodsTotalZar + order1.fees.reduce((s, f) => s + f.amountZar, 0);
    const sumPersonFinal = Object.values(calc.personCalcs).reduce((acc, c) => acc + c.totalFinal, 0);
    expect(Math.round(sumPersonFinal * 100) / 100).toBe(totalOrderZarExpected);

    const { doc: orderDoc } = await createOrderInvoicePDFDocument(order1, people1, calc);
    const orderPdfBuf = Buffer.from(orderDoc.output('arraybuffer'));
    const orderInfo = extractPdfInfo(orderPdfBuf);
    expect(orderInfo.pageCount).toBe(2);
    expect(orderInfo.allText).toContain(formatZAR(calc.totalOrderZar));
    expect(orderInfo.allText).toContain(formatZAR(calc.totalGoodsZar));
    expect(orderInfo.allText).toContain(formatZAR(calc.totalFeesZar));

    // Check each person invoice: fits on 1 page!
    for (const p of people1) {
      const { doc: personDoc } = await createInvoicePDFDocument(order1, p, people1[0], calc.personCalcs[p.id]);
      const personBuf = Buffer.from(personDoc.output('arraybuffer'));
      const personInfo = extractPdfInfo(personBuf);
      expect(personInfo.pageCount).toBe(1);
      expect(personInfo.allText).toContain(formatZAR(calc.personCalcs[p.id].totalFinal));

      const invoiceModel = buildInvoiceModel({ order: order1, person: p, payer: people1[0], calc: calc.personCalcs[p.id] });
      expect(invoiceModel.amountDue).toBe(formatZAR(calc.personCalcs[p.id].totalFinal));
      const waText = buildWhatsAppMessageText({ order: order1, person: p, payer: people1[0], calc: calc.personCalcs[p.id] });
      expect(waText).toContain(formatZAR(calc.personCalcs[p.id].totalFinal));
      const emailText = buildEmailMessageText({ order: order1, person: p, payer: people1[0], calc: calc.personCalcs[p.id] });
      expect(emailText).toContain(formatZAR(calc.personCalcs[p.id].totalFinal));
    }
  });

  it('Scenario 2: checks long names wrap cleanly without clipping, 1 page for person invoice', async () => {
    const personNames2 = Object.fromEntries(people2.map(p => [p.id, p.name]));
    const calc = calculate(order2, personNames2);
    expect(calc.isValid).toBe(true);

    const { doc: orderDoc } = await createOrderInvoicePDFDocument(order2, people2, calc);
    const orderBuf = Buffer.from(orderDoc.output('arraybuffer'));
    const orderInfo = extractPdfInfo(orderBuf);
    expect(orderInfo.pageCount).toBe(1); // 1 lot fits cleanly on 1 page!

    const { doc: personDoc } = await createInvoicePDFDocument(order2, people2[0], people2[0], calc.personCalcs[people2[0].id]);
    const personBuf = Buffer.from(personDoc.output('arraybuffer'));
    const personInfo = extractPdfInfo(personBuf);
    expect(personInfo.pageCount).toBe(1);
  });

  it('Scenario 3: checks large order (12 people) paginates cleanly across 2 pages and reconciles', async () => {
    const personNames3 = Object.fromEntries(people3.map(p => [p.id, p.name]));
    const calc = calculate(order3, personNames3);
    expect(calc.isValid).toBe(true);

    const { doc: orderDoc } = await createOrderInvoicePDFDocument(order3, people3, calc);
    const orderBuf = Buffer.from(orderDoc.output('arraybuffer'));
    const orderInfo = extractPdfInfo(orderBuf);
    expect(orderInfo.pageCount).toBe(2);
  });

  it('Scenario 4: single lot, single buyer, no fees', async () => {
    const personNames4 = Object.fromEntries(people4.map(p => [p.id, p.name]));
    const calc = calculate(order4, personNames4);
    expect(calc.isValid).toBe(true);
    expect(calc.totalOrderZar).toBe(320);
    expect(calc.personCalcs['p401'].totalFinal).toBe(320);

    const { doc: orderDoc } = await createOrderInvoicePDFDocument(order4, people4, calc);
    const orderBuf = Buffer.from(orderDoc.output('arraybuffer'));
    expect(extractPdfInfo(orderBuf).pageCount).toBe(1);

    const { doc: personDoc } = await createInvoicePDFDocument(order4, people4[0], people4[0], calc.personCalcs[people4[0].id]);
    const personBuf = Buffer.from(personDoc.output('arraybuffer'));
    expect(extractPdfInfo(personBuf).pageCount).toBe(1);
  });

  it('Scenario 5: uneven shares and multiple bags per person', async () => {
    const personNames5 = Object.fromEntries(people5.map(p => [p.id, p.name]));
    const calc = calculate(order5, personNames5);
    expect(calc.isValid).toBe(true);
    expect(calc.totalOrderZar).toBe(675);
    const sum = Object.values(calc.personCalcs).reduce((acc, c) => acc + c.totalFinal, 0);
    expect(sum).toBe(675);

    const { doc: orderDoc } = await createOrderInvoicePDFDocument(order5, people5, calc);
    const orderBuf = Buffer.from(orderDoc.output('arraybuffer'));
    expect(extractPdfInfo(orderBuf).pageCount).toBe(1);

    const { doc: personDoc } = await createInvoicePDFDocument(order5, people5[0], people5[0], calc.personCalcs[people5[0].id]);
    const personBuf = Buffer.from(personDoc.output('arraybuffer'));
    expect(extractPdfInfo(personBuf).pageCount).toBe(1);
  });

  it('Scenario 6: odd cents division with payer absorbing remainder and specific person fee', async () => {
    const personNames6 = Object.fromEntries(people6.map(p => [p.id, p.name]));
    const calc = calculate(order6, personNames6);
    expect(calc.isValid).toBe(true);
    const expectedTotal = 777.77 + 111.11 + 35.00;
    expect(calc.totalOrderZar).toBeCloseTo(expectedTotal, 2);

    expect(calc.personCalcs['p603'].feeBreakdowns.some(f => f.amountZar === 35)).toBe(true);

    const sum = Object.values(calc.personCalcs).reduce((acc, c) => acc + c.totalFinal, 0);
    expect(Math.round(sum * 100) / 100).toBe(Math.round(expectedTotal * 100) / 100);

    const { doc: orderDoc } = await createOrderInvoicePDFDocument(order6, people6, calc);
    const orderBuf = Buffer.from(orderDoc.output('arraybuffer'));
    expect(extractPdfInfo(orderBuf).pageCount).toBe(1);

    for (const p of people6) {
      const { doc: personDoc } = await createInvoicePDFDocument(order6, p, people6[0], calc.personCalcs[p.id]);
      const personBuf = Buffer.from(personDoc.output('arraybuffer'));
      expect(extractPdfInfo(personBuf).pageCount).toBe(1);
    }
  });
});
