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
export type PdfDoc = InstanceType<Awaited<ReturnType<typeof getJsPDF>>>;

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
  doc.roundedRect(20, y, 170, 6.5, 1, 1, 'F');
  setTextColor(doc, MID);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text(label.toUpperCase(), 24, y + 4.5);
  return y + 10;
}

function row(
  doc: PdfDoc,
  label: string,
  value: string,
  y: number,
  bold = false,
  xRight = 186
): number {
  setTextColor(doc, bold ? DARK : MID);
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setFontSize(8.8);
  doc.text(label, 24, y);
  doc.text(value, xRight, y, { align: 'right' });
  return y + 5.2;
}

function ensurePageSpace(doc: PdfDoc, y: number, needed = 20, topMargin = 22): number {
  if (y + needed <= 276) {
    return y;
  }
  doc.addPage();
  return topMargin;
}

export async function createInvoicePDFDocument(
  order: Order,
  person: Person,
  payer: Person | undefined,
  calc: PersonCalculation
): Promise<{ doc: PdfDoc; filename: string }> {
  const JsPDF = await getJsPDF();
  const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageW = 210;
  const roundingAdjustment = calc.totalFinal - calc.totalPreRound;
  const invoice = buildInvoiceModel({ order, person, payer, calc });

  // ── Header Banner ──────────────────────────────────────────
  setFill(doc, ACCENT);
  doc.rect(0, 0, pageW, 26, 'F');

  setTextColor(doc, WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('SPLITS', 20, 11);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text('BY FAJR BREWS  ·  INVOICE', 20, 17);

  // Amount due — top right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(invoice.amountDue, 190, 11, { align: 'right' });
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('AMOUNT DUE', 190, 16, { align: 'right' });

  let y = 33;

  // ── Person & Order Info ────────────────────────────────────
  setTextColor(doc, DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  const personNameLines = doc.splitTextToSize(invoice.personName, 105);
  doc.text(personNameLines, 20, y);

  // Right-aligned order metadata
  setTextColor(doc, MID);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const orderMetaLines = doc.splitTextToSize(`${invoice.orderName}  ·  ${invoice.orderDate}`, 65);
  doc.text(orderMetaLines, 190, y, { align: 'right' });

  const leftInfoHeight = personNameLines.length * 5;
  const rightInfoHeight = orderMetaLines.length * 4.2;
  y += Math.max(leftInfoHeight, rightInfoHeight) + 1;

  setTextColor(doc, DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(`Ref: ${invoice.reference}`, 20, y);
  y += 7;

  hLine(doc, y);
  y += 5;

  // ── Coffee Lots ───────────────────────────────────────────
  if (invoice.coffeeLines.length > 0) {
    y = sectionHeader(doc, 'Coffee Shares', y);

    for (const line of invoice.coffeeLines) {
      const estimatedHeight = line.splitWith.length > 0 ? 21 : 16;
      y = ensurePageSpace(doc, y, estimatedHeight);

      setTextColor(doc, DARK);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      const nameWithGrams = `${line.name} · ${formatGrams(line.shareGrams)}`;
      const titleLines = doc.splitTextToSize(nameWithGrams, 125);
      doc.text(titleLines, 24, y);
      doc.text(line.totalAmount, 186, y, { align: 'right' });
      y += titleLines.length * 4.2;

      setTextColor(doc, MID);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      const breakdownLines = doc.splitTextToSize(`(${line.breakdownSummary})`, 160);
      doc.text(breakdownLines, 24, y);
      y += breakdownLines.length * 3.8;

      if (line.splitWith.length > 0) {
        setTextColor(doc, MID);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        const splitLines = doc.splitTextToSize(`Split with: ${line.splitWith.join(', ')}`, 160);
        doc.text(splitLines, 24, y);
        y += splitLines.length * 3.8;
      }

      y += 1.5;
      hLine(doc, y, 24, 186);
      y += 4.5;
    }
  }

  // If person has only standalone fees without coffee
  if (invoice.coffeeLines.length === 0 && calc.feeBreakdowns.length > 0) {
    y = sectionHeader(doc, 'Additional Charges', y);
    for (const fee of invoice.feeLines) {
      y = ensurePageSpace(doc, y, 10);
      setTextColor(doc, MID);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      const feeLabelLines = doc.splitTextToSize(`${fee.label} (${fee.methodLabel})`, 125);
      doc.text(feeLabelLines, 24, y);
      setTextColor(doc, DARK);
      doc.text(fee.amount, 186, y, { align: 'right' });
      y += Math.max(feeLabelLines.length * 4.5, 5.5);
    }
    y += 2;
  }

  // ── Totals & Summary ──────────────────────────────────────
  y = ensurePageSpace(doc, y, 32);
  hLine(doc, y);
  y += 5;

  y = sectionHeader(doc, 'Summary', y);
  y = row(doc, 'Coffee + allocated fees', formatZAR(calc.totalPreRound), y);
  if (Math.abs(roundingAdjustment) > 0.001) {
    y = row(doc, 'Rounding adjustment', formatZAR(roundingAdjustment), y);
  }

  y += 1;
  hLine(doc, y);
  y += 5;

  setFill(doc, ACCENT);
  doc.rect(20, y - 2, 170, 8.5, 'F');
  setTextColor(doc, WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('TOTAL DUE', 24, y + 3.8);
  doc.text(invoice.amountDue, 186, y + 3.8, { align: 'right' });
  y += 13;

  // ── Payment Instructions ──────────────────────────────────
  const bankRows: [string, string][] = [
    ['Beneficiary', order.payerBank.beneficiary || payer?.name || '—'],
    ['Bank', order.payerBank.bankName],
    ['Account', order.payerBank.accountNumber],
  ];
  if (order.payerBank.branch) {
    bankRows.push(['Branch', order.payerBank.branch]);
  }
  bankRows.push(['Reference', invoice.reference]);

  let noteLines: string[] = [];
  if (order.payerNote && typeof order.payerNote === 'string') {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.8);
    noteLines = doc.splitTextToSize(order.payerNote, 160);
  }

  const paymentSectionHeight = 12 + bankRows.length * 5.2 + (noteLines.length > 0 ? noteLines.length * 4 + 4 : 0);
  y = ensurePageSpace(doc, y, paymentSectionHeight);

  y = sectionHeader(doc, 'Payment Instructions', y);
  for (const [label, value] of bankRows) {
    y = row(doc, label, value, y);
  }

  if (noteLines.length > 0) {
    y += 2;
    setTextColor(doc, MID);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.8);
    doc.text(noteLines, 24, y);
    y += noteLines.length * 4;
  }

  // ── Footer on all pages ───────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    setTextColor(doc, BORDER);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    const footerText = totalPages > 1
      ? `Generated by Splits, by Fajr Brews  ·  Page ${p} of ${totalPages}`
      : 'Generated by Splits, by Fajr Brews';
    doc.text(footerText, pageW / 2, 287, { align: 'center' });
  }

  return { doc, filename: pdfFilename(order.name, person.name) };
}

export async function generateInvoicePDF(
  order: Order,
  person: Person,
  payer: Person | undefined,
  calc: PersonCalculation
): Promise<void> {
  const { doc, filename } = await createInvoicePDFDocument(order, person, payer, calc);
  doc.save(filename);
}

export async function createOrderInvoicePDFDocument(
  order: Order,
  people: Person[],
  result: CalculationResult
): Promise<{ doc: PdfDoc; filename: string }> {
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

  // ── Header Banner ──────────────────────────────────────────
  setFill(doc, ACCENT);
  doc.rect(0, 0, pageW, 26, 'F');

  setTextColor(doc, WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('SPLITS', 20, 11);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text('BY FAJR BREWS  ·  FULL ORDER INVOICE', 20, 17);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(formatZAR(result.totalOrderZar), 190, 11, { align: 'right' });
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('ORDER TOTAL', 190, 16, { align: 'right' });

  let y = 33;

  setTextColor(doc, DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  const orderTitleLines = doc.splitTextToSize(order.name, 170);
  doc.text(orderTitleLines, 20, y);
  y += orderTitleLines.length * 5 + 1;

  setTextColor(doc, MID);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`${formatDate(order.orderDate)} · ${result.personIds.length} people · ${result.lotCalcs.length} coffee lots`, 20, y);
  y += 4.2;
  doc.text('Generated for the whole order summary', 20, y);
  y += 7;

  hLine(doc, y);
  y += 5;

  for (const { lotCalc, allocations } of lotAllocations) {
    y = ensurePageSpace(doc, y, 35);
    y = sectionHeader(doc, lotCalc.lotName, y);

    y = row(doc, 'Bean cost', formatZAR(lotCalc.goodsZar), y);
    y = row(doc, 'Allocated fees', formatZAR(lotCalc.feesZar), y);
    y = row(doc, 'Lot total', formatZAR(lotCalc.totalZar), y, true);
    y = row(doc, 'Per bag final cost', formatZAR(lotCalc.finalZarPerBag), y);
    y += 1;

    setTextColor(doc, MID);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('ALLOCATIONS', 24, y);
    y += 4.5;

    if (allocations.length === 0) {
      setTextColor(doc, MID);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('No participant allocations were recorded for this coffee.', 24, y);
      y += 6;
    } else {
      for (const allocation of allocations) {
        y = ensurePageSpace(doc, y, 11);
        setTextColor(doc, DARK);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        const labelLines = doc.splitTextToSize(allocation.label, 125);
        doc.text(labelLines, 24, y);
        doc.text(formatZAR(allocation.total), 186, y, { align: 'right' });
        y += labelLines.length * 3.8 + 0.5;

        setTextColor(doc, MID);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        const detailLines = doc.splitTextToSize(allocation.detail, 150);
        doc.text(detailLines, 28, y);
        y += detailLines.length * 3.6 + 2;
      }
    }

    hLine(doc, y, 24, 186);
    y += 6;
  }

  if (order.fees.length > 0) {
    y = ensurePageSpace(doc, y, 16 + order.fees.length * 5.5);
    y = sectionHeader(doc, 'Additional fees', y);
    for (const fee of order.fees) {
      y = ensurePageSpace(doc, y, 8);
      const feeLabel = formatFeeForOwner(fee, peopleById);
      const feeLines = doc.splitTextToSize(feeLabel, 125);
      setTextColor(doc, MID);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text(feeLines, 24, y);
      setTextColor(doc, DARK);
      doc.text(formatZAR(fee.amountZar), 186, y, { align: 'right' });
      y += Math.max(feeLines.length * 4.5, 5.2);
    }
    y += 2;
  }

  y = ensurePageSpace(doc, y, 28);
  hLine(doc, y);
  y += 5;
  y = sectionHeader(doc, 'Summary', y);
  y = row(doc, 'Goods total', formatZAR(result.totalGoodsZar), y);
  y = row(doc, 'Extra fees', formatZAR(result.totalFeesZar), y);

  y += 1;
  hLine(doc, y);
  y += 5;

  setFill(doc, ACCENT);
  doc.rect(20, y - 2, 170, 8.5, 'F');
  setTextColor(doc, WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('ORDER TOTAL', 24, y + 3.8);
  doc.text(formatZAR(result.totalOrderZar), 186, y + 3.8, { align: 'right' });
  y += 12;

  // ── Footer on all pages ───────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    setTextColor(doc, BORDER);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    const footerText = totalPages > 1
      ? `Generated by Splits, by Fajr Brews  ·  Page ${p} of ${totalPages}`
      : 'Generated by Splits, by Fajr Brews';
    doc.text(footerText, pageW / 2, 287, { align: 'center' });
  }

  return { doc, filename: orderPdfFilename(order.name) };
}

export async function generateOrderInvoicePDF(
  order: Order,
  people: Person[],
  result: CalculationResult
): Promise<void> {
  const { doc, filename } = await createOrderInvoicePDFDocument(order, people, result);
  doc.save(filename);
}
