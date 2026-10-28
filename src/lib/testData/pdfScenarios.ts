import type { Order, Person } from '../../types';

// Scenario 1: Reported Case (3 lots, 4 people, split & single bags, proportional & fixed fees)
export const people1: Person[] = [
  { id: 'p1', workspaceId: 'w1', name: 'Zakariyya Gani', createdAt: '2026-03-25T00:00:00Z', updatedAt: '2026-03-25T00:00:00Z' },
  { id: 'p2', workspaceId: 'w1', name: 'Ahmed Mia', createdAt: '2026-03-25T00:00:00Z', updatedAt: '2026-03-25T00:00:00Z' },
  { id: 'p3', workspaceId: 'w1', name: 'Bilal Patel', createdAt: '2026-03-25T00:00:00Z', updatedAt: '2026-03-25T00:00:00Z' },
  { id: 'p4', workspaceId: 'w1', name: 'Yusuf Docrat', createdAt: '2026-03-25T00:00:00Z', updatedAt: '2026-03-25T00:00:00Z' },
];

export const order1: Order = {
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
export const people2: Person[] = [
  { id: 'p201', workspaceId: 'w1', name: 'Dr. Christopher Bartholomew Montgomery-Cunningham IV', createdAt: '2026-03-26T00:00:00Z', updatedAt: '2026-03-26T00:00:00Z' },
  { id: 'p202', workspaceId: 'w1', name: 'Lord Sebastian Maximillian Von Ravenscroft-Esterhazy', createdAt: '2026-03-26T00:00:00Z', updatedAt: '2026-03-26T00:00:00Z' },
];

export const order2: Order = {
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
export const people3: Person[] = Array.from({ length: 12 }, (_, i) => ({
  id: `p30_${i + 1}`,
  workspaceId: 'w1',
  name: `Coffee Club Member ${String.fromCharCode(65 + i)}`,
  createdAt: '2026-03-27T00:00:00Z',
  updatedAt: '2026-03-27T00:00:00Z',
}));

export const order3: Order = {
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
export const people4: Person[] = [
  { id: 'p401', workspaceId: 'w1', name: 'Zaid', createdAt: '2026-03-28T00:00:00Z', updatedAt: '2026-03-28T00:00:00Z' },
];

export const order4: Order = {
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
export const people5: Person[] = [
  { id: 'p501', workspaceId: 'w1', name: 'Fatima', createdAt: '2026-03-29T00:00:00Z', updatedAt: '2026-03-29T00:00:00Z' },
  { id: 'p502', workspaceId: 'w1', name: 'Amina', createdAt: '2026-03-29T00:00:00Z', updatedAt: '2026-03-29T00:00:00Z' },
];

export const order5: Order = {
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
export const people6: Person[] = [
  { id: 'p601', workspaceId: 'w1', name: 'Ibrahim (Payer)', createdAt: '2026-03-30T00:00:00Z', updatedAt: '2026-03-30T00:00:00Z' },
  { id: 'p602', workspaceId: 'w1', name: 'Khadija', createdAt: '2026-03-30T00:00:00Z', updatedAt: '2026-03-30T00:00:00Z' },
  { id: 'p603', workspaceId: 'w1', name: 'Mariam', createdAt: '2026-03-30T00:00:00Z', updatedAt: '2026-03-30T00:00:00Z' },
];

export const order6: Order = {
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

// Scenario 7: 5 different coffee lots, 5 people, mix of own-bag and split bags, 2 fees, realistic long-ish names with non-ASCII
export const people7: Person[] = [
  { id: 'p701', workspaceId: 'w1', name: 'Muḥammad Al-Mansoor', createdAt: '2026-03-31T00:00:00Z', updatedAt: '2026-03-31T00:00:00Z' },
  { id: 'p702', workspaceId: 'w1', name: 'Zoë Van Der Merwe', createdAt: '2026-03-31T00:00:00Z', updatedAt: '2026-03-31T00:00:00Z' },
  { id: 'p703', workspaceId: 'w1', name: 'Ayşe Demir-Kowalski', createdAt: '2026-03-31T00:00:00Z', updatedAt: '2026-03-31T00:00:00Z' },
  { id: 'p704', workspaceId: 'w1', name: 'Tariq Abdul-Rahman', createdAt: '2026-03-31T00:00:00Z', updatedAt: '2026-03-31T00:00:00Z' },
  { id: 'p705', workspaceId: 'w1', name: 'Kavitha Govender-Pillay', createdAt: '2026-03-31T00:00:00Z', updatedAt: '2026-03-31T00:00:00Z' },
];

export const order7: Order = {
  id: 'order-7',
  workspaceId: 'w1',
  name: 'Manhattan Coffee Roasters Spring Drop – Selection Series',
  orderDate: '2026-03-31',
  roasterId: null,
  roasterSnapshot: null,
  payerId: 'p701',
  payerBank: {
    bankName: 'First National Bank Private Wealth',
    accountNumber: '62098765432',
    beneficiary: 'Muḥammad Al-Mansoor',
  },
  payerNote: 'Please use your invoice reference so payments allocate automatically.',
  referenceTemplate: 'FAJR-{ORDER}-{NAME}',
  goodsTotalZar: 3450.00,
  lots: [
    {
      id: 'lot-701',
      name: 'Colombia Huila Finca El Paraiso Gesha',
      foreignPricePerBag: 32,
      gramsPerBag: 250,
      quantity: 2,
      shares: [
        { id: 's701', personId: 'p701', shareGrams: 250, bagIndex: 0 },
        { id: 's702', personId: 'p702', shareGrams: 125, bagIndex: 1 },
        { id: 's703', personId: 'p703', shareGrams: 125, bagIndex: 1 },
      ],
      bagAllocations: [
        { id: 'b701', bagIndex: 0, mode: 'single', participants: [{ id: 'pt701', personId: 'p701', shareGrams: 250, sourceShareId: 's701' }] },
        { id: 'b702', bagIndex: 1, mode: 'split', participants: [
          { id: 'pt702', personId: 'p702', shareGrams: 125, sourceShareId: 's702' },
          { id: 'pt703', personId: 'p703', shareGrams: 125, sourceShareId: 's703' },
        ] },
      ],
    },
    {
      id: 'lot-702',
      name: 'Ethiopia Guji Uraga Natural Carbonic',
      foreignPricePerBag: 26,
      gramsPerBag: 250,
      quantity: 2,
      shares: [
        { id: 's704', personId: 'p704', shareGrams: 250, bagIndex: 0 },
        { id: 's705', personId: 'p705', shareGrams: 250, bagIndex: 1 },
      ],
      bagAllocations: [
        { id: 'b703', bagIndex: 0, mode: 'single', participants: [{ id: 'pt704', personId: 'p704', shareGrams: 250, sourceShareId: 's704' }] },
        { id: 'b704', bagIndex: 1, mode: 'single', participants: [{ id: 'pt705', personId: 'p705', shareGrams: 250, sourceShareId: 's705' }] },
      ],
    },
    {
      id: 'lot-703',
      name: 'Kenya Nyeri Kamwangi Peaberry AA',
      foreignPricePerBag: 22,
      gramsPerBag: 250,
      quantity: 2,
      shares: [
        { id: 's706', personId: 'p701', shareGrams: 125, bagIndex: 0 },
        { id: 's707', personId: 'p704', shareGrams: 125, bagIndex: 0 },
        { id: 's708', personId: 'p702', shareGrams: 250, bagIndex: 1 },
      ],
      bagAllocations: [
        { id: 'b705', bagIndex: 0, mode: 'split', participants: [
          { id: 'pt706', personId: 'p701', shareGrams: 125, sourceShareId: 's706' },
          { id: 'pt707', personId: 'p704', shareGrams: 125, sourceShareId: 's707' },
        ] },
        { id: 'b706', bagIndex: 1, mode: 'single', participants: [{ id: 'pt708', personId: 'p702', shareGrams: 250, sourceShareId: 's708' }] },
      ],
    },
    {
      id: 'lot-704',
      name: 'Panama Boquete Kotowa Duncan Caturra',
      foreignPricePerBag: 24,
      gramsPerBag: 250,
      quantity: 1,
      shares: [
        { id: 's709', personId: 'p703', shareGrams: 125, bagIndex: 0 },
        { id: 's710', personId: 'p705', shareGrams: 125, bagIndex: 0 },
      ],
      bagAllocations: [
        { id: 'b707', bagIndex: 0, mode: 'split', participants: [
          { id: 'pt709', personId: 'p703', shareGrams: 125, sourceShareId: 's709' },
          { id: 'pt710', personId: 'p705', shareGrams: 125, sourceShareId: 's710' },
        ] },
      ],
    },
    {
      id: 'lot-705',
      name: 'Costa Rica Tarrazu Don Mayo White Honey',
      foreignPricePerBag: 20,
      gramsPerBag: 250,
      quantity: 2,
      shares: [
        { id: 's711', personId: 'p701', shareGrams: 250, bagIndex: 0 },
        { id: 's712', personId: 'p702', shareGrams: 125, bagIndex: 1 },
        { id: 's713', personId: 'p705', shareGrams: 125, bagIndex: 1 },
      ],
      bagAllocations: [
        { id: 'b708', bagIndex: 0, mode: 'single', participants: [{ id: 'pt711', personId: 'p701', shareGrams: 250, sourceShareId: 's711' }] },
        { id: 'b709', bagIndex: 1, mode: 'split', participants: [
          { id: 'pt712', personId: 'p702', shareGrams: 125, sourceShareId: 's712' },
          { id: 'pt713', personId: 'p705', shareGrams: 125, sourceShareId: 's713' },
        ] },
      ],
    },
  ],
  fees: [
    { id: 'f701', label: 'DHL Express International Priority', amountZar: 420.00, allocationType: 'value_based' },
    { id: 'f702', label: 'Customs Duty & Clearance Fee', amountZar: 285.00, allocationType: 'equal_per_person' },
  ],
  payments: {},
  isArchived: false,
  createdAt: '2026-03-31T00:00:00Z',
  updatedAt: '2026-03-31T00:00:00Z',
};

export const ALL_SCENARIOS = [
  { id: 'scenario-1', order: order1, people: people1 },
  { id: 'scenario-2', order: order2, people: people2 },
  { id: 'scenario-3', order: order3, people: people3 },
  { id: 'scenario-4', order: order4, people: people4 },
  { id: 'scenario-5', order: order5, people: people5 },
  { id: 'scenario-6', order: order6, people: people6 },
  { id: 'scenario-7', order: order7, people: people7 },
] as const;
