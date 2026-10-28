import * as fs from 'fs';
import * as path from 'path';
import { calculate } from '../src/lib/calculations';
import {
  createInvoicePDFDocument,
  createOrderInvoicePDFDocument,
  determineOrderInvoiceTier,
} from '../src/lib/pdf';
import { ALL_SCENARIOS } from '../src/lib/testData/pdfScenarios';
import type { Theme } from '../src/types';

const THEMES: Theme[] = ['emerald', 'yinmn'];

async function main() {
  console.log('Rendering PDFs for all scenarios in both themes...');

  for (const theme of THEMES) {
    const outDir = path.resolve(process.cwd(), `design/pdf/${theme}`);
    fs.mkdirSync(outDir, { recursive: true });

    for (const scenario of ALL_SCENARIOS) {
      const { id, order, people } = scenario;
      const personNames = Object.fromEntries(people.map((p) => [p.id, p.name]));
      const result = calculate(order, personNames);

      const tier = determineOrderInvoiceTier(order, people, result);

      // 1. Order PDF
      const { doc: orderDoc } = await createOrderInvoicePDFDocument(order, people, result, theme);
      const orderPages = orderDoc.getNumberOfPages();
      const orderBuf = Buffer.from(orderDoc.output('arraybuffer'));
      const orderPdfPath = path.join(outDir, `${id}-order.pdf`);
      fs.writeFileSync(orderPdfPath, orderBuf);
      console.log(`[${theme}] ${id}-order: ${orderPages} page(s), tier: ${tier}`);

      // 2. Person PDF (person 0)
      const person = people[0];
      const payer = people.find((p) => p.id === order.payerId) ?? people[0];
      const personCalc = result.personCalcs[person.id];
      const { doc: personDoc } = await createInvoicePDFDocument(order, person, payer, personCalc, theme);
      const personPages = personDoc.getNumberOfPages();
      const personBuf = Buffer.from(personDoc.output('arraybuffer'));
      const personPdfPath = path.join(outDir, `${id}-person.pdf`);
      fs.writeFileSync(personPdfPath, personBuf);
      console.log(`[${theme}] ${id}-person: ${personPages} page(s)`);
    }
  }

  console.log('All PDFs successfully generated!');
}

await main();
