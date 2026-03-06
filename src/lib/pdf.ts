import type { Order, Person, PersonCalculation } from '../types';
import { formatZAR, formatDate, resolveReference, effectivePricePerGram, pdfFilename } from './formatters';

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

function setFill(doc: InstanceType<Awaited<ReturnType<typeof getJsPDF>>>, rgb: RGB) {
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
}
function setTextColor(doc: InstanceType<Awaited<ReturnType<typeof getJsPDF>>>, rgb: RGB) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}
function setDrawColor(doc: InstanceType<Awaited<ReturnType<typeof getJsPDF>>>, rgb: RGB) {
  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
}

function hLine(
  doc: InstanceType<Awaited<ReturnType<typeof getJsPDF>>>,
  y: number,
  x1 = 20,
  x2 = 190
) {
  setDrawColor(doc, BORDER);
  doc.setLineWidth(0.3);
  doc.line(x1, y, x2, y);
}

function sectionHeader(
  doc: InstanceType<Awaited<ReturnType<typeof getJsPDF>>>,
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
  doc: InstanceType<Awaited<ReturnType<typeof getJsPDF>>>,
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

export async function generateInvoicePDF(
  order: Order,
  person: Person,
  payer: Person | undefined,
  calc: PersonCalculation
): Promise<void> {
  const JsPDF = await getJsPDF();
  const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const ref = resolveReference(
    order.referenceTemplate,
    order.name,
    person.name,
    order.orderDate
  );

  let y = 20;
  const pageW = 210;

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
  doc.text(formatZAR(calc.totalFinal), 190, 12, { align: 'right' });
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('AMOUNT DUE', 190, 17, { align: 'right' });

  y = 36;

  // ── Order / Person Info ───────────────────────────────────
  setTextColor(doc, DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(person.name, 20, y);
  y += 6;

  setTextColor(doc, MID);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`${order.name}  ·  ${formatDate(order.orderDate)}`, 20, y);
  y += 4;
  doc.text(`Ref: ${ref}`, 20, y);
  y += 10;

  hLine(doc, y);
  y += 6;

  // ── Coffee Lots ───────────────────────────────────────────
  y = sectionHeader(doc, 'Coffee Shares', y);

  for (const lb of calc.lotBreakdowns) {
    // Lot name
    setTextColor(doc, DARK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(lb.lotName, 24, y);
    y += 5;

    // Grams detail line
    setTextColor(doc, MID);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const gramsLine = `${lb.shareGrams}g · from ${lb.gramsPerBag}g bag`;
    doc.text(gramsLine, 24, y);

    if (lb.splitWith.length > 0) {
      doc.text(`Split with: ${lb.splitWith.join(', ')}`, 24, y + 4.5);
      y += 4.5;
    }
    y += 5;

    // Amount and per-gram
    setTextColor(doc, DARK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(formatZAR(lb.goodsZar), 186, y - 1, { align: 'right' });

    setTextColor(doc, MID);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    const epg = effectivePricePerGram(lb.goodsZar, lb.shareGrams);
    if (epg) {
      doc.text(`Effective price: ${epg}`, 24, y);
    }
    y += 5;

    hLine(doc, y, 24, 186);
    y += 5;
  }

  y += 2;

  // ── Fees Summary ──────────────────────────────────────────
  if (calc.feeBreakdowns.length > 0) {
    y = sectionHeader(doc, 'Fees', y);

    for (const fb of calc.feeBreakdowns) {
      setTextColor(doc, MID);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text(fb.label, 24, y);
      setTextColor(doc, DARK);
      doc.text(formatZAR(fb.amountZar), 186, y, { align: 'right' });
      y += 5.5;
    }
    y += 4;
  }

  // ── Totals ────────────────────────────────────────────────
  hLine(doc, y);
  y += 6;

  y = sectionHeader(doc, 'Summary', y);

  y = row(doc, 'Coffee subtotal', formatZAR(calc.goodsZar), y);
  if (calc.feesZar > 0) {
    y = row(doc, 'Fees subtotal', formatZAR(calc.feesZar), y);
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
  doc.text(formatZAR(calc.totalFinal), 186, y + 4, { align: 'right' });
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
  bankRows.push(['Reference', ref]);

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
