import type { CalculationResult, Order, Person, PersonCalculation } from '../types';
import { formatGrams, formatZAR, formatDate, orderPdfFilename, pdfFilename } from './formatters';
import { buildInvoiceModel, formatFeeForOwner } from './invoiceFormatter';

// Dynamic import to keep initial bundle smaller
async function getJsPDF() {
  const { jsPDF } = await import('jspdf');
  return jsPDF;
}

const DARK = [26, 18, 8] as const;    // near-black
const MID = [107, 94, 78] as const;  // secondary text
const LIGHT = [245, 242, 238] as const; // surface
const ACCENT = [61, 90, 62] as const; // deep forest (porcelain accent - neutral for all themes)
const WHITE = [255, 255, 255] as const;
const BORDER = [229, 221, 212] as const;

type RGB = readonly [number, number, number];
type PdfDoc = InstanceType<Awaited<ReturnType<typeof getJsPDF>>>;

function setFill(doc: PdfDoc, rgb: RGB) {
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
}
function setTextColor(doc: PdfDoc, rgb: RGB) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}
function setDrawColor(doc: PdfDoc, rgb: RGB) {
  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
}

function hLine(
  doc: PdfDoc,
  y: number,
  x1 = 20,
  x2 = 190
) {
  setDrawColor(doc, BORDER);
  doc.setLineWidth(0.3);
  doc.line(x1, y, x2, y);
}

function sectionHeader(
  doc: PdfDoc,
  label: string,
  y: number
): number {
  setFill(doc, LIGHT);
  doc.roundedRect(20, y, 170, 7, 1, 1, 'F');
  setTextColor(doc, MID);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text(label.toUpperCase(), 24, y + 4.8);
  return y + 11;
}

function row(
  doc: PdfDoc,
  label: string,
  value: string,
  y: number,
  bold = false
): number {
  setTextColor(doc, bold ? DARK : MID);
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setFontSize(9);
  doc.text(label, 24, y);
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.text(value, 186, y, { align: 'right' });
  return y + 5.5;
}

function ensurePageSpace(doc: PdfDoc, y: number, needed = 24): number {
  if (y + needed <= 280) {
    return y;
  }
  doc.addPage();
  return 20;
}

export async function generateInvoicePDF(
  order: Order,
  person: Person,
  payer: Person | undefined,
  calc: PersonCalculation
): Promise<void> {
  const JsPDF = await getJsPDF();
  const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  let y = 20;
  const pageW = 210;
  const roundingAdjustment = calc.totalFinal - calc.totalPreRound;
  const invoice = buildInvoiceModel({ order, person, payer, calc });

  // ── Header ────────────────────────────────────────────────
  setFill(doc, ACCENT);
  doc.rect(0, 0, pageW, 28, 'F');

  setTextColor(doc, WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('FAJR BREWS', 20, 12);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('COFFEE SPLITTER  ·  INVOICE', 20, 18);

  // Amount due — top right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(invoice.amountDue, 190, 12, { align: 'right' });
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('AMOUNT DUE', 190, 17, { align: 'right' });

  y = 36;

  // ── Order / Person Info ───────────────────────────────────
  setTextColor(doc, DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(invoice.personName, 20, y);
  y += 6;

  setTextColor(doc, MID);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`${invoice.orderName}  ·  ${invoice.orderDate}`, 20, y);
  y += 4;
  doc.text(`Ref: ${invoice.reference}`, 20, y);
  y += 10;

  hLine(doc, y);
  y += 6;

  // ── Coffee Lots ───────────────────────────────────────────
  y = sectionHeader(doc, 'Coffee Shares', y);

  for (const line of invoice.coffeeLines) {
    // Primary line: Coffee Name · Grams on left, Total amount on right
    setTextColor(doc, DARK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(`${line.name} · ${formatGrams(line.shareGrams)}`, 24, y);
    doc.text(line.totalAmount, 186, y, { align: 'right' });
    y += 4.5;

    // Subordinate breakdown line: (R345.23 coffee + R42.10 fees)
    setTextColor(doc, MID);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.text(`(${line.breakdownSummary})`, 24, y);

    y += 5;

    hLine(doc, y, 24, 186);
    y += 5;
  }

  // If person has only standalone fees without coffee
  if (invoice.coffeeLines.length === 0 && calc.feeBreakdowns.length > 0) {
    y = sectionHeader(doc, 'Additional Charges', y);
    for (const fee of invoice.feeLines) {
      setTextColor(doc, MID);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text(`${fee.label} (${fee.methodLabel})`, 24, y);
      setTextColor(doc, DARK);
      doc.text(fee.amount, 186, y, { align: 'right' });
      y += 5.5;
    }
    y += 4;
  }

  // ── Totals ────────────────────────────────────────────────
  hLine(doc, y);
  y += 6;

  y = sectionHeader(doc, 'Summary', y);

  y = row(doc, 'Coffee + allocated fees', formatZAR(calc.totalPreRound), y);
  if (Math.abs(roundingAdjustment) > 0.001) {
    y = row(doc, 'Rounding adjustment', formatZAR(roundingAdjustment), y);
  }

  y += 2;
  hLine(doc, y);
  y += 6;

  setFill(doc, ACCENT);
  doc.rect(20, y - 2, 170, 9, 'F');
  setTextColor(doc, WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('TOTAL DUE', 24, y + 4);
  doc.text(invoice.amountDue, 186, y + 4, { align: 'right' });
  y += 14;

  // ── Payment Instructions ──────────────────────────────────
  y = sectionHeader(doc, 'Payment Instructions', y);

  const bankRows: [string, string][] = [
    ['Beneficiary', order.payerBank.beneficiary || payer?.name || '—'],
    ['Bank', order.payerBank.bankName],
    ['Account', order.payerBank.accountNumber],
  ];
  if (order.payerBank.branch) {
    bankRows.push(['Branch', order.payerBank.branch]);
  }
  bankRows.push(['Reference', invoice.reference]);

  for (const [label, value] of bankRows) {
    y = row(doc, label, value, y);
  }

  if (order.payerNote && typeof order.payerNote === 'string') {
    y += 4;
    setTextColor(doc, MID);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    const noteLines = doc.splitTextToSize(order.payerNote, 160);
    doc.text(noteLines, 24, y);
    y += noteLines.length * 4.5;
  }

  // ── Footer ────────────────────────────────────────────────
  setTextColor(doc, BORDER);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(
    `Generated by Fajr Brews — Coffee Splitter`,
    pageW / 2,
    287,
    { align: 'center' }
  );

  doc.save(pdfFilename(order.name, person.name));
}

export async function generateOrderInvoicePDF(
  order: Order,
  people: Person[],
  result: CalculationResult
): Promise<void> {
  const JsPDF = await getJsPDF();
  const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const peopleById = new Map(people.map((person) => [person.id, person]));

  const lotAllocations = result.lotCalcs.map((lotCalc) => {
    const allocations = result.personIds
      .flatMap((personId) => {
        const person = peopleById.get(personId);
        const personCalc = result.personCalcs[personId];
        if (!person || !personCalc) {
          return [];
        }

        return personCalc.lotBreakdowns
          .filter((breakdown) => breakdown.lotId === lotCalc.lotId)
          .map((breakdown) => ({
            key: breakdown.id,
            label: `${person.name} · Bag ${breakdown.bagIndex + 1} · ${breakdown.shareGrams}g`,
            detail:
              breakdown.splitWith.length > 0
                ? `${breakdown.bagMode === 'full' ? 'Own bag' : 'Split bag'} · Split with ${breakdown.splitWith.join(', ')}`
                : breakdown.bagMode === 'full'
                  ? 'Own bag'
                  : breakdown.bagMode === 'unassigned'
                    ? 'Unassigned bag'
                    : 'Split bag',
            total: breakdown.totalZar,
            bagIndex: breakdown.bagIndex,
          }));
      })
      .sort((left, right) => left.bagIndex - right.bagIndex || left.label.localeCompare(right.label));

    return { lotCalc, allocations };
  });

  let y = 20;

  setFill(doc, ACCENT);
  doc.rect(0, 0, pageW, 28, 'F');

  setTextColor(doc, WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('FAJR BREWS', 20, 12);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('COFFEE SPLITTER  ·  FULL ORDER INVOICE', 20, 18);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(formatZAR(result.totalOrderZar), 190, 12, { align: 'right' });
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('ORDER TOTAL', 190, 17, { align: 'right' });

  y = 36;

  setTextColor(doc, DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(order.name, 20, y);
  y += 6;

  setTextColor(doc, MID);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`${formatDate(order.orderDate)} · ${result.personIds.length} people · ${result.lotCalcs.length} coffee lots`, 20, y);
  y += 4.5;
  doc.text(`Generated for the whole order summary`, 20, y);
  y += 10;

  hLine(doc, y);
  y += 6;

  for (const { lotCalc, allocations } of lotAllocations) {
    y = ensurePageSpace(doc, y, 42 + allocations.length * 10);
    y = sectionHeader(doc, lotCalc.lotName, y);

    y = row(doc, 'Bean cost', formatZAR(lotCalc.goodsZar), y);
    y = row(doc, 'Allocated fees', formatZAR(lotCalc.feesZar), y);
    y = row(doc, 'Lot total', formatZAR(lotCalc.totalZar), y, true);
    y = row(doc, 'Per bag final cost', formatZAR(lotCalc.finalZarPerBag), y);
    y += 2;

    setTextColor(doc, MID);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('ALLOCATIONS', 24, y);
    y += 5;

    if (allocations.length === 0) {
      setTextColor(doc, MID);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text('No participant allocations were recorded for this coffee.', 24, y);
      y += 7;
    } else {
      for (const allocation of allocations) {
        y = ensurePageSpace(doc, y, 12);
        setTextColor(doc, DARK);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.8);
        doc.text(allocation.label, 24, y);
        doc.text(formatZAR(allocation.total), 186, y, { align: 'right' });
        y += 4.2;

        setTextColor(doc, MID);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.8);
        const detailLines = doc.splitTextToSize(allocation.detail, 150);
        doc.text(detailLines, 28, y);
        y += detailLines.length * 4.1 + 2;
      }
    }

    hLine(doc, y, 24, 186);
    y += 7;
  }

  if (order.fees.length > 0) {
    y = ensurePageSpace(doc, y, 18 + order.fees.length * 6);
    y = sectionHeader(doc, 'Additional fees', y);
    for (const fee of order.fees) {
      y = row(
        doc,
        formatFeeForOwner(fee, peopleById),
        formatZAR(fee.amountZar),
        y,
      );
    }
    y += 4;
  }

  y = ensurePageSpace(doc, y, 28);
  hLine(doc, y);
  y += 6;
  y = sectionHeader(doc, 'Summary', y);
  y = row(doc, 'Goods total', formatZAR(result.totalGoodsZar), y);
  y = row(doc, 'Extra fees', formatZAR(result.totalFeesZar), y);

  y += 2;
  hLine(doc, y);
  y += 6;

  setFill(doc, ACCENT);
  doc.rect(20, y - 2, 170, 9, 'F');
  setTextColor(doc, WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('ORDER TOTAL', 24, y + 4);
  doc.text(formatZAR(result.totalOrderZar), 186, y + 4, { align: 'right' });
  y += 14;

  setTextColor(doc, BORDER);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(
    'Generated by Fajr Brews — Coffee Splitter',
    pageW / 2,
    287,
    { align: 'center' }
  );

  doc.save(orderPdfFilename(order.name));
}
