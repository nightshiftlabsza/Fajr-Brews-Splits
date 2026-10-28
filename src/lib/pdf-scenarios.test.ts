import { describe, expect, it } from 'vitest';
import type { Theme } from '../types';
import { calculate } from './calculations';
import {
  buildEmailMessageText,
  buildInvoiceModel,
  buildWhatsAppMessageText,
} from './invoiceFormatter';
import { createInvoicePDFDocument, createOrderInvoicePDFDocument } from './pdf';
import { formatZAR } from './formatters';
import { ALL_SCENARIOS } from './testData/pdfScenarios';

const THEMES: Theme[] = ['emerald', 'yinmn'];

function extractPdfInfo(buffer: Buffer): { pageCount: number; allText: string[] } {
  const str = buffer.toString('latin1');
  const pageMatches = str.match(/\/Type\s*\/Page[^s]/g) || [];
  const pageCount = pageMatches.length;

  const objects = new Map<number, string>();
  const objRegex = /(\d+)\s+0\s+obj\s*([\s\S]*?)endobj/g;
  let om;
  while ((om = objRegex.exec(str)) !== null) {
    objects.set(parseInt(om[1], 10), om[2]);
  }

  const cmaps = new Map<number, Record<string, string>>();
  for (const [id, body] of objects) {
    if (body.includes('beginbfchar') || body.includes('beginbfrange')) {
      const map: Record<string, string> = {};
      const bfcharBlocks = body.match(/beginbfchar([\s\S]*?)endbfchar/g) || [];
      for (const block of bfcharBlocks) {
        const bfchar = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g;
        let m;
        while ((m = bfchar.exec(block)) !== null) {
          map[m[1].toLowerCase().padStart(4, '0')] = String.fromCodePoint(parseInt(m[2], 16));
        }
      }
      const bfrangeBlocks = body.match(/beginbfrange([\s\S]*?)endbfrange/g) || [];
      for (const block of bfrangeBlocks) {
        const bfrange = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g;
        let m;
        while ((m = bfrange.exec(block)) !== null) {
          let startCode = parseInt(m[3], 16);
          for (let g = parseInt(m[1], 16); g <= parseInt(m[2], 16); g++) {
            map[g.toString(16).toLowerCase().padStart(4, '0')] = String.fromCodePoint(startCode++);
          }
        }
      }
      cmaps.set(id, map);
    }
  }

  const fontAliasMap = new Map<string, Record<string, string>>();
  for (const [_, body] of objects) {
    const fontDict = body.match(/\/Font\s*<<([\s\S]*?)>>/);
    if (fontDict) {
      const fRegex = /\/([a-zA-Z0-9_]+)\s+(\d+)\s+0\s+R/g;
      let fm;
      while ((fm = fRegex.exec(fontDict[1])) !== null) {
        const alias = fm[1];
        const fontObjId = parseInt(fm[2], 10);
        const fontBody = objects.get(fontObjId) || '';
        const tu = fontBody.match(/\/ToUnicode\s+(\d+)\s+0\s+R/);
        if (tu) {
          const cmapId = parseInt(tu[1], 10);
          if (cmaps.has(cmapId)) {
            fontAliasMap.set(alias, cmaps.get(cmapId)!);
          }
        }
      }
    }
  }

  const allText: string[] = [];
  for (const [_, body] of objects) {
    const streamMatch = body.match(/stream([\s\S]*?)endstream/);
    if (streamMatch) {
      const content = streamMatch[1].trim();
      let currentCMap: Record<string, string> = {};
      const tokenRegex = /\/([a-zA-Z0-9_]+)\s+[\d.]+\s+Tf|(<[0-9a-fA-F\s]+>|\(.*?\))\s*(Tj|'|")|\[(.*?)\]\s*TJ/g;
      let tm;
      while ((tm = tokenRegex.exec(content)) !== null) {
        if (tm[1]) {
          currentCMap = fontAliasMap.get(tm[1]) || {};
        } else if (tm[2]) {
          const item = tm[2];
          if (item.startsWith('<')) {
            const hex = item.slice(1, -1).replace(/\s+/g, '');
            let s = '';
            for (let i = 0; i < hex.length; i += 4) {
              const glyph = hex.slice(i, i + 4).toLowerCase().padStart(4, '0');
              s += currentCMap[glyph] || '';
            }
            if (s) allText.push(s);
          } else if (item.startsWith('(')) {
            allText.push(item.slice(1, -1));
          }
        }
      }
    }
  }

  return { pageCount, allText };
}

describe('Synthetic Order Scenarios & PDF Redesign Acceptance Tests', () => {
  describe('Global Arithmetic & Reconciliations across Scenarios 1 to 7', () => {
    for (const scenario of ALL_SCENARIOS) {
      it(`${scenario.id}: sum of personCalcs[].totalFinal equals totalOrderZar to the cent`, () => {
        const personNames = Object.fromEntries(scenario.people.map((p) => [p.id, p.name]));
        const calc = calculate(scenario.order, personNames);
        expect(calc.isValid).toBe(true);

        const expectedTotal =
          scenario.order.goodsTotalZar + scenario.order.fees.reduce((s, f) => s + f.amountZar, 0);
        const sumPersonFinal = Object.values(calc.personCalcs).reduce(
          (acc, c) => acc + c.totalFinal,
          0
        );

        expect(Math.round(sumPersonFinal * 100) / 100).toBe(Math.round(expectedTotal * 100) / 100);
        expect(Math.round(calc.totalOrderZar * 100) / 100).toBe(Math.round(expectedTotal * 100) / 100);

        // Check beans + fees on invoice lines equals pre-round total for each person
        for (const p of scenario.people) {
          const pCalc = calc.personCalcs[p.id];
          const lineBeansSum = pCalc.lotBreakdowns.reduce((s, l) => s + l.goodsZar, 0);
          const lineFeesSum = pCalc.lotBreakdowns.reduce((s, l) => s + l.feesZar, 0);
          const linesTotal =
            pCalc.lotBreakdowns.length > 0
              ? lineBeansSum + lineFeesSum
              : pCalc.feeBreakdowns.reduce((s, f) => s + f.amountZar, 0);

          expect(linesTotal).toBeCloseTo(pCalc.totalPreRound, 2);
        }
      });
    }
  });

  for (const theme of THEMES) {
    describe(`PDF Generation & Layout: Theme "${theme}"`, () => {
      it('Scenario 1: 1 page for order PDF, 1 page for each person invoice, exact totals', async () => {
        const s = ALL_SCENARIOS.find((x) => x.id === 'scenario-1')!;
        const personNames = Object.fromEntries(s.people.map((p) => [p.id, p.name]));
        const calc = calculate(s.order, personNames);

        // Order PDF
        const { doc: orderDoc } = await createOrderInvoicePDFDocument(s.order, s.people, calc, theme);
        const orderPdfBuf = Buffer.from(orderDoc.output('arraybuffer'));
        const orderInfo = extractPdfInfo(orderPdfBuf);

        expect(orderInfo.pageCount).toBe(1);
        expect(orderInfo.allText).toContain(formatZAR(calc.totalOrderZar));
        expect(orderInfo.allText).toContain(formatZAR(calc.totalGoodsZar));
        expect(orderInfo.allText).toContain(formatZAR(calc.totalFeesZar));
        expect(orderInfo.allText).toContain('Sey Coffee Spring Drop');

        // Check person invoices
        for (const p of s.people) {
          const payer = s.people.find((x) => x.id === s.order.payerId) ?? s.people[0];
          const pCalc = calc.personCalcs[p.id];
          const { doc: personDoc } = await createInvoicePDFDocument(s.order, p, payer, pCalc, theme);
          const personPdfBuf = Buffer.from(personDoc.output('arraybuffer'));
          const personInfo = extractPdfInfo(personPdfBuf);

          expect(personInfo.pageCount).toBe(1);
          expect(personInfo.allText).toContain(formatZAR(pCalc.totalFinal));
          expect(personInfo.allText).toContain(p.name);

          const invoiceModel = buildInvoiceModel({ order: s.order, person: p, payer, calc: pCalc });
          expect(invoiceModel.amountDue).toBe(formatZAR(pCalc.totalFinal));

          const waText = buildWhatsAppMessageText({ order: s.order, person: p, payer, calc: pCalc });
          expect(waText).toContain(formatZAR(pCalc.totalFinal));

          const emailText = buildEmailMessageText({ order: s.order, person: p, payer, calc: pCalc });
          expect(emailText).toContain(formatZAR(pCalc.totalFinal));
        }
      });

      it('Scenario 2: very long names wrap without clipping, 1 page for order and person', async () => {
        const s = ALL_SCENARIOS.find((x) => x.id === 'scenario-2')!;
        const personNames = Object.fromEntries(s.people.map((p) => [p.id, p.name]));
        const calc = calculate(s.order, personNames);

        const { doc: orderDoc } = await createOrderInvoicePDFDocument(s.order, s.people, calc, theme);
        const orderInfo = extractPdfInfo(Buffer.from(orderDoc.output('arraybuffer')));
        expect(orderInfo.pageCount).toBe(1);

        const payer = s.people[0];
        const { doc: personDoc } = await createInvoicePDFDocument(
          s.order,
          payer,
          payer,
          calc.personCalcs[payer.id],
          theme
        );
        const personInfo = extractPdfInfo(Buffer.from(personDoc.output('arraybuffer')));
        expect(personInfo.pageCount).toBe(1);
        expect(personInfo.allText).toContain(formatZAR(calc.personCalcs[payer.id].totalFinal));
      });

      it('Scenario 3: large order (12 people) paginates cleanly across 2 pages at comfortable tier', async () => {
        const s = ALL_SCENARIOS.find((x) => x.id === 'scenario-3')!;
        const personNames = Object.fromEntries(s.people.map((p) => [p.id, p.name]));
        const calc = calculate(s.order, personNames);

        const { doc: orderDoc } = await createOrderInvoicePDFDocument(s.order, s.people, calc, theme);
        const orderInfo = extractPdfInfo(Buffer.from(orderDoc.output('arraybuffer')));
        expect(orderInfo.pageCount).toBe(2);
        expect(orderInfo.allText).toContain('Page 1 of 2');
        expect(orderInfo.allText).toContain('Page 2 of 2');
        expect(orderInfo.allText).toContain(formatZAR(calc.totalOrderZar));
      });

      it('Scenario 4: single lot, single buyer, no fees fits on 1 page', async () => {
        const s = ALL_SCENARIOS.find((x) => x.id === 'scenario-4')!;
        const personNames = Object.fromEntries(s.people.map((p) => [p.id, p.name]));
        const calc = calculate(s.order, personNames);

        const { doc: orderDoc } = await createOrderInvoicePDFDocument(s.order, s.people, calc, theme);
        const orderInfo = extractPdfInfo(Buffer.from(orderDoc.output('arraybuffer')));
        expect(orderInfo.pageCount).toBe(1);
        expect(orderInfo.allText).toContain(formatZAR(calc.totalOrderZar));

        const payer = s.people[0];
        const { doc: personDoc } = await createInvoicePDFDocument(
          s.order,
          payer,
          payer,
          calc.personCalcs[payer.id],
          theme
        );
        const personInfo = extractPdfInfo(Buffer.from(personDoc.output('arraybuffer')));
        expect(personInfo.pageCount).toBe(1);
      });

      it('Scenario 5: uneven shares and multiple bags per person fits on 1 page', async () => {
        const s = ALL_SCENARIOS.find((x) => x.id === 'scenario-5')!;
        const personNames = Object.fromEntries(s.people.map((p) => [p.id, p.name]));
        const calc = calculate(s.order, personNames);

        const { doc: orderDoc } = await createOrderInvoicePDFDocument(s.order, s.people, calc, theme);
        const orderInfo = extractPdfInfo(Buffer.from(orderDoc.output('arraybuffer')));
        expect(orderInfo.pageCount).toBe(1);

        const payer = s.people[0];
        const { doc: personDoc } = await createInvoicePDFDocument(
          s.order,
          payer,
          payer,
          calc.personCalcs[payer.id],
          theme
        );
        const personInfo = extractPdfInfo(Buffer.from(personDoc.output('arraybuffer')));
        expect(personInfo.pageCount).toBe(1);
      });

      it('Scenario 6: odd cents precision split fits on 1 page', async () => {
        const s = ALL_SCENARIOS.find((x) => x.id === 'scenario-6')!;
        const personNames = Object.fromEntries(s.people.map((p) => [p.id, p.name]));
        const calc = calculate(s.order, personNames);

        const { doc: orderDoc } = await createOrderInvoicePDFDocument(s.order, s.people, calc, theme);
        const orderInfo = extractPdfInfo(Buffer.from(orderDoc.output('arraybuffer')));
        expect(orderInfo.pageCount).toBe(1);
        expect(orderInfo.allText).toContain(formatZAR(calc.totalOrderZar));

        for (const p of s.people) {
          const payer = s.people[0];
          const { doc: personDoc } = await createInvoicePDFDocument(
            s.order,
            p,
            payer,
            calc.personCalcs[p.id],
            theme
          );
          const personInfo = extractPdfInfo(Buffer.from(personDoc.output('arraybuffer')));
          expect(personInfo.pageCount).toBe(1);
        }
      });

      it('Scenario 7: 5 coffee lots, 5 people, non-ASCII names fits on 1 page', async () => {
        const s = ALL_SCENARIOS.find((x) => x.id === 'scenario-7')!;
        const personNames = Object.fromEntries(s.people.map((p) => [p.id, p.name]));
        const calc = calculate(s.order, personNames);

        // Order invoice fits on 1 page
        const { doc: orderDoc } = await createOrderInvoicePDFDocument(s.order, s.people, calc, theme);
        const orderInfo = extractPdfInfo(Buffer.from(orderDoc.output('arraybuffer')));
        expect(orderInfo.pageCount).toBe(1);
        expect(orderInfo.allText).toContain(formatZAR(calc.totalOrderZar));
        expect(orderInfo.allText.some((t) => t.includes('Muḥammad Al-Mansoor'))).toBe(true);
        expect(orderInfo.allText).toContain('Zoë Van Der Merwe');
        expect(orderInfo.allText).toContain('Ayşe Demir-Kowalski');

        // Person invoices fit on 1 page
        for (const p of s.people) {
          const payer = s.people[0];
          const { doc: personDoc } = await createInvoicePDFDocument(
            s.order,
            p,
            payer,
            calc.personCalcs[p.id],
            theme
          );
          const personInfo = extractPdfInfo(Buffer.from(personDoc.output('arraybuffer')));
          expect(personInfo.pageCount).toBe(1);
          expect(personInfo.allText).toContain(formatZAR(calc.personCalcs[p.id].totalFinal));
        }
      });
    });
  }
});
