import type { jsPDF } from 'jspdf';
import type {
  CalculationResult,
  Fee,
  Order,
  Person,
  PersonCalculation,
  Theme,
} from '../types';
import { formatDate, formatGrams, formatZAR, orderPdfFilename, pdfFilename } from './formatters';
import { buildInvoiceModel, formatFeeForOwner, type InvoiceModel } from './invoiceFormatter';
import { getPdfTheme, type PdfThemePalette, type RGB } from './pdfTheme';

// Dynamic import to keep initial bundle small
async function getJsPDF() {
  const { jsPDF } = await import('jspdf');
  return jsPDF;
}

export type PdfDoc = InstanceType<Awaited<ReturnType<typeof getJsPDF>>>;

export type DensityTier = 'comfortable' | 'compact';

interface LoadedTheme {
  theme: Theme;
  palette: PdfThemePalette;
  usingCustomFonts: boolean;
  displayFont: string;
  bodyFont: string;
  attributionFont: string;
  attributionStyle: 'italic' | 'normal' | 'bold';
}

function setFill(doc: jsPDF, rgb: RGB) {
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
}

function setTextColor(doc: jsPDF, rgb: RGB) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}

function setDrawColor(doc: jsPDF, rgb: RGB) {
  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
}

async function setupPdfTheme(doc: jsPDF, theme: Theme): Promise<LoadedTheme> {
  const palette = getPdfTheme(theme);
  let usingCustomFonts = false;

  try {
    if (theme === 'emerald') {
      const { registerEmeraldFonts } = await import('./pdfFonts/emerald');
      registerEmeraldFonts(doc);
    } else {
      const { registerYinmnFonts } = await import('./pdfFonts/yinmn');
      registerYinmnFonts(doc);
    }
    usingCustomFonts = true;
  } catch (err) {
    console.warn(`[PDF] Failed to load custom fonts for theme "${theme}", falling back to standard fonts:`, err);
  }

  if (usingCustomFonts) {
    return {
      theme,
      palette,
      usingCustomFonts: true,
      displayFont: palette.fonts.display,
      bodyFont: palette.fonts.body,
      attributionFont: theme === 'emerald' ? 'Fraunces' : 'HankenGrotesk',
      attributionStyle: theme === 'emerald' ? 'italic' : 'bold',
    };
  }

  const isEmerald = theme === 'emerald';
  return {
    theme,
    palette,
    usingCustomFonts: false,
    displayFont: isEmerald ? 'times' : 'helvetica',
    bodyFont: isEmerald ? 'times' : 'helvetica',
    attributionFont: isEmerald ? 'times' : 'helvetica',
    attributionStyle: isEmerald ? 'italic' : 'bold',
  };
}

function drawSplitsLockup(
  doc: jsPDF,
  loaded: LoadedTheme,
  orderDateStr: string,
  startX = 20,
  startY = 18
) {
  const { palette, displayFont, bodyFont, attributionFont, attributionStyle, usingCustomFonts } = loaded;
  const s = 7 / 32; // 0.21875 mm per SVG unit (7mm height total)

  // Left half: solid accent
  setFill(doc, palette.accent);
  doc.moveTo(startX + 15 * s, startY + 3.1 * s);
  doc.curveTo(
    startX + 8.4 * s, startY + 3.6 * s,
    startX + 3.5 * s, startY + 9.2 * s,
    startX + 3.5 * s, startY + 16 * s
  );
  doc.curveTo(
    startX + 3.5 * s, startY + 22.8 * s,
    startX + 8.4 * s, startY + 28.4 * s,
    startX + 15 * s, startY + 28.9 * s
  );
  doc.lineTo(startX + 15 * s, startY + 3.1 * s);
  doc.fill();

  // Right half: accent mixed with white at 42% (solid RGB)
  setFill(doc, palette.accentRightHalf);
  doc.moveTo(startX + 17 * s, startY + 3.1 * s);
  doc.lineTo(startX + 17 * s, startY + 28.9 * s);
  doc.curveTo(
    startX + 23.6 * s, startY + 28.4 * s,
    startX + 28.5 * s, startY + 22.8 * s,
    startX + 28.5 * s, startY + 16 * s
  );
  doc.curveTo(
    startX + 28.5 * s, startY + 9.2 * s,
    startX + 23.6 * s, startY + 3.6 * s,
    startX + 17 * s, startY + 3.1 * s
  );
  doc.fill();

  // Typography beside mark
  const textX = startX + 9.5;

  // "Splits" + "." in accent at 16pt
  doc.setFont(displayFont, usingCustomFonts ? (loaded.theme === 'emerald' ? 'normal' : 'bold') : 'bold');
  doc.setFontSize(16);
  setTextColor(doc, palette.primary);
  doc.text('Splits', textX, startY + 4.6);
  const splitsWidth = doc.getTextWidth('Splits');

  setTextColor(doc, palette.accent);
  doc.text('.', textX + splitsWidth, startY + 4.6);

  // "by Fajr Brews" at 8pt
  doc.setFontSize(8);
  doc.setFont(bodyFont, 'normal');
  setTextColor(doc, palette.muted);
  const byPrefix = 'by ';
  doc.text(byPrefix, textX, startY + 8.2);
  const byWidth = doc.getTextWidth(byPrefix);

  setTextColor(doc, palette.primary);
  doc.setFont(attributionFont, attributionStyle);
  doc.text('Fajr Brews', textX + byWidth, startY + 8.2);

  // Top right: order date in secondary 8.5pt
  if (orderDateStr) {
    doc.setFont(bodyFont, 'normal');
    doc.setFontSize(8.5);
    setTextColor(doc, palette.secondary);
    doc.text(orderDateStr, 190, startY + 4.6, { align: 'right' });
  }
}

function drawSectionHeading(doc: jsPDF, loaded: LoadedTheme, title: string, y: number): number {
  const isClassic = loaded.theme === 'emerald';
  if (isClassic) {
    doc.setFont(loaded.displayFont, loaded.usingCustomFonts ? 'normal' : 'bold');
    doc.setFontSize(12);
    setTextColor(doc, loaded.palette.accent);
    doc.text(title, 20, y);
    const lineY = y + 2.2;
    setDrawColor(doc, loaded.palette.border);
    doc.setLineWidth(0.25);
    doc.line(20, lineY, 190, lineY);
    return lineY + 5;
  }

  // Modern (yinmn)
  setDrawColor(doc, loaded.palette.accent);
  doc.setLineWidth(0.4);
  doc.line(20, y, 190, y);
  doc.setFont(loaded.displayFont, 'bold');
  doc.setFontSize(9);
  setTextColor(doc, loaded.palette.accent);
  const textY = y + 4.5;
  doc.text(title, 20, textY);
  return textY + 4.5;
}

function drawPageFooters(doc: jsPDF, loaded: LoadedTheme) {
  const pageCount = doc.getNumberOfPages();
  if (pageCount <= 1) return;

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont(loaded.bodyFont, 'normal');
    doc.setFontSize(8);
    setTextColor(doc, loaded.palette.muted);
    doc.text('Splits, by Fajr Brews', 20, 285);
    doc.text(`Page ${i} of ${pageCount}`, 190, 285, { align: 'right' });
  }
}

// ─────────────────────────────────────────────────────────────
// Person Invoice
// ─────────────────────────────────────────────────────────────

export async function createInvoicePDFDocument(
  orderOrInvoice: Order | InvoiceModel,
  personOrTheme: Person | Theme,
  payer?: Person,
  calc?: PersonCalculation,
  themeArg?: Theme
): Promise<{ doc: PdfDoc; filename: string }> {
  let invoice: InvoiceModel;
  let theme: Theme;
  let filename: string;
  let orderDateFormatted: string;

  if ('amountDue' in orderOrInvoice && 'summaryLines' in orderOrInvoice) {
    invoice = orderOrInvoice;
    theme = personOrTheme as Theme;
    filename = `invoice-${invoice.personName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`;
    orderDateFormatted = invoice.orderDate;
  } else {
    const order = orderOrInvoice;
    const person = personOrTheme as Person;
    invoice = buildInvoiceModel({ order, person, payer, calc: calc! });
    theme = themeArg!;
    filename = pdfFilename(order.name, person.name);
    orderDateFormatted = formatDate(order.orderDate);
  }

  const JsPDF = await getJsPDF();
  const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const loaded = await setupPdfTheme(doc, theme);
  const { palette, displayFont, bodyFont, usingCustomFonts } = loaded;

  // Header lockup
  drawSplitsLockup(doc, loaded, orderDateFormatted, 20, 18);

  // 1. Title block (starts ~16mm below lockup -> y = 34mm)
  let y = 34;

  // Order name (secondary 9.5pt, max 2 lines wrapped)
  doc.setFont(bodyFont, 'normal');
  doc.setFontSize(9.5);
  setTextColor(doc, palette.secondary);
  const orderLines = doc.splitTextToSize(invoice.orderName, 105) as string[];
  const visibleOrderLines = orderLines.slice(0, 2);
  for (const line of visibleOrderLines) {
    doc.text(line, 20, y);
    y += 4.5;
  }

  // Person's name (display font 20pt, wrapped max 2 lines; if long, 16pt)
  let personFontSize = 20;
  doc.setFont(displayFont, usingCustomFonts ? (theme === 'emerald' ? 'normal' : 'bold') : 'bold');
  doc.setFontSize(personFontSize);
  let personLines = doc.splitTextToSize(invoice.personName, 105) as string[];
  if (personLines.length > 2) {
    personFontSize = 16;
    doc.setFontSize(personFontSize);
    personLines = doc.splitTextToSize(invoice.personName, 105) as string[];
  }
  const personNameStartY = y + 1.5;
  setTextColor(doc, palette.primary);
  for (let i = 0; i < personLines.length; i++) {
    doc.text(personLines[i], 20, personNameStartY + i * (personFontSize * 0.38));
  }

  // Right side: Status label & Hero amount
  doc.setFont(bodyFont, 'normal');
  doc.setFontSize(8.5);
  setTextColor(doc, palette.muted);
  doc.text(invoice.paymentStatusLabel, 190, 32, { align: 'right' });

  doc.setFont(displayFont, usingCustomFonts ? (theme === 'emerald' ? 'normal' : 'bold') : 'bold');
  doc.setFontSize(26);
  setTextColor(doc, palette.accent);
  doc.text(invoice.amountDue, 190, 42.5, { align: 'right' });

  // Advance y past title block
  y = Math.max(personNameStartY + personLines.length * (personFontSize * 0.38) + 6, 48);

  // 2. Coffee table (or fallback if no coffees)
  const hasCoffees = invoice.coffeeLines.length > 0;
  const sectionTitle = hasCoffees ? 'Your coffee' : 'Additional charges';
  y = drawSectionHeading(doc, loaded, sectionTitle, y);

  if (hasCoffees) {
    // Column headers at 8.5pt muted sentence case
    doc.setFont(bodyFont, 'normal');
    doc.setFontSize(8.5);
    setTextColor(doc, palette.muted);
    doc.text('Coffee', 20, y);
    doc.text('Beans', 140, y, { align: 'right' });
    doc.text('Fees', 165, y, { align: 'right' });
    doc.text('Amount', 190, y, { align: 'right' });
    y += 2.5;

    setDrawColor(doc, palette.border);
    doc.setLineWidth(0.2);
    doc.line(20, y, 190, y);
    y += 4;

    for (const line of invoice.coffeeLines) {
      const rowStartY = y;

      // Line 1: coffee name in bold body (9.5pt)
      doc.setFont(bodyFont, 'bold');
      doc.setFontSize(9.5);
      setTextColor(doc, palette.primary);
      const nameLines = doc.splitTextToSize(line.name, 98) as string[];
      for (const nl of nameLines) {
        doc.text(nl, 20, y);
        y += 4.2;
      }

      // Line 2: grams and split detail in secondary (8.5pt)
      const detailParts: string[] = [];
      if (line.shareGrams) detailParts.push(formatGrams(line.shareGrams));
      if (line.splitWith && line.splitWith.length > 0) {
        detailParts.push(`Split with ${line.splitWith.join(', ')}`);
      }
      if (detailParts.length > 0) {
        doc.setFont(bodyFont, 'normal');
        doc.setFontSize(8.5);
        setTextColor(doc, palette.secondary);
        const detailStr = detailParts.join(' · ');
        const detailLines = doc.splitTextToSize(detailStr, 98) as string[];
        for (const dl of detailLines) {
          doc.text(dl, 20, y);
          y += 3.8;
        }
      }

      // Numbers on right edge: beansAmount, feesAmount, totalAmount
      doc.setFont(bodyFont, 'normal');
      doc.setFontSize(9.5);
      setTextColor(doc, palette.primary);
      doc.text(line.beansAmount, 140, rowStartY, { align: 'right' });
      doc.text(line.feesAmount || '–', 165, rowStartY, { align: 'right' });
      doc.text(line.totalAmount, 190, rowStartY, { align: 'right' });

      // Hairline below row
      y += 1.5;
      setDrawColor(doc, palette.border);
      doc.setLineWidth(0.2);
      doc.line(20, y, 190, y);
      y += 3.5;
    }
  }

  y += 2;

  // 3. Totals block
  // Summary lines
  for (const sl of invoice.summaryLines) {
    doc.setFont(bodyFont, 'normal');
    doc.setFontSize(9);
    setTextColor(doc, palette.secondary);
    doc.text(sl.label, 140, y, { align: 'right' });
    setTextColor(doc, palette.primary);
    doc.text(sl.amount, 190, y, { align: 'right' });
    y += 4.5;
  }

  // Fees included above (if any)
  if (invoice.feeLines.length > 0) {
    y += 1;
    doc.setFont(bodyFont, 'normal');
    doc.setFontSize(8.5);
    setTextColor(doc, palette.muted);
    doc.text('Fees included above', 190, y, { align: 'right' });
    y += 4;

    for (const fl of invoice.feeLines) {
      doc.setFont(bodyFont, 'normal');
      doc.setFontSize(8.5);
      setTextColor(doc, palette.muted);
      const feeLabelLines = doc.splitTextToSize(`${fl.label} (${fl.methodLabel})`, 110) as string[];
      doc.text(feeLabelLines, 140, y, { align: 'right' });
      setTextColor(doc, palette.secondary);
      doc.text(fl.amount, 190, y, { align: 'right' });
      y += feeLabelLines.length * 4;
    }
  }

  y += 2;

  // Final Total Due row
  const isClassic = theme === 'emerald';
  if (isClassic) {
    setDrawColor(doc, palette.border);
    doc.setLineWidth(0.25);
    doc.line(20, y, 190, y);
    y += 5.5;

    doc.setFont(displayFont, usingCustomFonts ? 'normal' : 'bold');
    doc.setFontSize(13);
    setTextColor(doc, palette.primary);
    doc.text('Total due', 140, y, { align: 'right' });
    doc.text(invoice.amountDue, 190, y, { align: 'right' });

    y += 2.5;
    doc.line(20, y, 190, y);
    y += 7;
  } else {
    // Modern: 10mm surface-raised band across full content width
    setFill(doc, palette.surfaceRaised);
    doc.rect(20, y, 170, 10, 'F');

    doc.setFont(displayFont, 'bold');
    doc.setFontSize(12);
    setTextColor(doc, palette.primary);
    const bandTextY = y + 6.5;
    doc.text('Total due', 25, bandTextY);
    doc.text(invoice.amountDue, 185, bandTextY, { align: 'right' });

    y += 14;
  }

  // 4. Pay-to block
  y = drawSectionHeading(doc, loaded, 'Pay to', y);

  for (const [label, value] of invoice.paymentLines) {
    // Label muted 8.5pt at x = 20
    doc.setFont(bodyFont, 'normal');
    doc.setFontSize(8.5);
    setTextColor(doc, palette.muted);
    doc.text(label, 20, y);

    // Value body 9.5pt at x = 55 (bold for reference)
    const isReference = label.toLowerCase().includes('reference');
    doc.setFont(bodyFont, isReference ? 'bold' : 'normal');
    doc.setFontSize(9.5);
    setTextColor(doc, palette.primary);
    doc.text(value, 55, y);

    y += 4.8;
  }

  // Payer note if present
  if (invoice.payerNote) {
    y += 2;
    doc.setFont(bodyFont, 'normal');
    doc.setFontSize(8.5);
    setTextColor(doc, palette.secondary);
    const noteLines = doc.splitTextToSize(invoice.payerNote, 170) as string[];
    for (const nl of noteLines) {
      doc.text(nl, 20, y);
      y += 4;
    }
  }

  drawPageFooters(doc, loaded);
  return { doc, filename };
}

export async function generateInvoicePDF(
  order: Order,
  person: Person,
  payer: Person | undefined,
  calc: PersonCalculation,
  theme: Theme
): Promise<void> {
  const { doc, filename } = await createInvoicePDFDocument(order, person, payer, calc, theme);
  doc.save(filename);
}

// ─────────────────────────────────────────────────────────────
// Order Invoice: Density tier measurement
// ─────────────────────────────────────────────────────────────

function calculateOrderInvoiceHeight(
  order: Order,
  result: CalculationResult,
  tier: DensityTier
): number {
  const isComfortable = tier === 'comfortable';
  const rowPitch = isComfortable ? 5.2 : 4.6;
  const lotGap = isComfortable ? 5.0 : 3.5;
  const sectionGap = isComfortable ? 8.0 : 5.0;
  const titleBlockHeight = isComfortable ? 22 : 18;
  const headingHeight = isComfortable ? 12 : 10;
  const finalRowHeight = isComfortable ? 18 : 16;
  const lotHeaderHeight = isComfortable ? 9.5 : 8.5;

  let y = 18; // Top margin
  y += 17;    // Lockup header
  y += titleBlockHeight;

  // 1. "Who owes what" section
  y += sectionGap;
  y += headingHeight;
  y += result.personIds.length * rowPitch;
  y += isComfortable ? 11 : 10; // Subtotals
  y += finalRowHeight;

  // 2. "Coffees" section
  y += sectionGap;
  y += headingHeight;
  for (let i = 0; i < order.lots.length; i++) {
    const lot = order.lots[i];
    y += lotHeaderHeight;
    let allocCount = 0;
    const bags = lot.bagAllocations ?? [];
    for (const bag of bags) {
      allocCount += bag.participants.length;
    }
    y += allocCount * rowPitch;
    if (i < order.lots.length - 1) {
      y += lotGap;
    }
  }

  // 3. "Fees" section
  if (order.fees && order.fees.length > 0) {
    y += sectionGap;
    y += headingHeight;
    y += order.fees.length * (isComfortable ? 5.0 : 4.5);
  }

  return y;
}

export function determineOrderInvoiceTier(
  order: Order,
  _people: Person[],
  result: CalculationResult
): DensityTier {
  // Beyond a typical order (up to 5 coffee lots and 6 people with normal splits),
  // a multi-page document does not need compact density; let it breathe.
  if (result.personIds.length > 6 || order.lots.length > 5) {
    return 'comfortable';
  }

  // Max available y on 1 page is 275mm (bottom margin = 18mm, total 297mm)
  const heightComfortable = calculateOrderInvoiceHeight(order, result, 'comfortable');
  if (heightComfortable <= 275) {
    return 'comfortable';
  }

  // Compact layout check
  const heightCompact = calculateOrderInvoiceHeight(order, result, 'compact');
  if (heightCompact <= 275) {
    return 'compact';
  }

  // If it still does not fit on one page at compact, paginate at comfortable!
  return 'comfortable';
}

// ─────────────────────────────────────────────────────────────
// Order Invoice
// ─────────────────────────────────────────────────────────────

export async function createOrderInvoicePDFDocument(
  order: Order,
  people: Person[],
  result: CalculationResult,
  theme: Theme
): Promise<{ doc: PdfDoc; filename: string }> {
  const JsPDF = await getJsPDF();
  const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const loaded = await setupPdfTheme(doc, theme);
  const { palette, displayFont, bodyFont, usingCustomFonts } = loaded;

  const peopleMap = new Map(people.map((p) => [p.id, p]));
  const tier = determineOrderInvoiceTier(order, people, result);

  const isComfortable = tier === 'comfortable';
  const bodySize = isComfortable ? 9.5 : 9.0;
  const secondarySize = 8.5;
  const rowPitch = isComfortable ? 5.2 : 4.6;
  const lotGap = isComfortable ? 5.0 : 3.5;
  const sectionGap = isComfortable ? 8.0 : 5.0;
  const titleNameSize = isComfortable ? 18 : 16;

  let y = 18;

  // Header lockup
  drawSplitsLockup(doc, loaded, formatDate(order.orderDate), 20, y);
  y += 17;

  // Title block
  // Left: Order name
  doc.setFont(displayFont, usingCustomFonts ? (theme === 'emerald' ? 'normal' : 'bold') : 'bold');
  doc.setFontSize(titleNameSize);
  setTextColor(doc, palette.primary);
  const orderNameLines = doc.splitTextToSize(order.name, 105) as string[];
  const visibleOrderNameLines = orderNameLines.slice(0, 2);
  const titleStartY = y;
  for (const line of visibleOrderNameLines) {
    doc.text(line, 20, y);
    y += titleNameSize * 0.35 + 1;
  }

  // Subtitle: Date · N people · M coffee lots
  doc.setFont(bodyFont, 'normal');
  doc.setFontSize(secondarySize);
  setTextColor(doc, palette.secondary);
  const lotsCount = order.lots.length;
  const peopleCount = result.personIds.length;
  const subtitle = `${formatDate(order.orderDate)} · ${peopleCount} people · ${lotsCount} coffee lot${lotsCount === 1 ? '' : 's'}`;
  doc.text(subtitle, 20, y + 1);

  // Right: Hero order total
  doc.setFont(bodyFont, 'normal');
  doc.setFontSize(8.5);
  setTextColor(doc, palette.muted);
  doc.text('Order total', 190, titleStartY, { align: 'right' });

  doc.setFont(displayFont, usingCustomFonts ? (theme === 'emerald' ? 'normal' : 'bold') : 'bold');
  doc.setFontSize(24);
  setTextColor(doc, palette.accent);
  doc.text(formatZAR(result.totalOrderZar), 190, titleStartY + 8.5, { align: 'right' });

  y = Math.max(y + 6, titleStartY + 14) + sectionGap;

  // Pagination helper
  const checkPageBreak = (neededHeight: number): void => {
    if (y + neededHeight > 275) {
      doc.addPage();
      y = 20;
    }
  };

  // 2. "Who owes what" section
  checkPageBreak(25);
  y = drawSectionHeading(doc, loaded, 'Who owes what', y);

  for (const personId of result.personIds) {
    checkPageBreak(rowPitch);
    const person = peopleMap.get(personId);
    const personName = person?.name ?? personId;
    const calc = result.personCalcs[personId];

    doc.setFont(bodyFont, 'normal');
    doc.setFontSize(bodySize);
    setTextColor(doc, palette.primary);
    doc.text(personName, 20, y);
    doc.text(formatZAR(calc.totalFinal), 190, y, { align: 'right' });

    y += rowPitch;
  }

  // Goods total and Extra fees
  y += 1;
  checkPageBreak(12);
  doc.setFont(bodyFont, 'normal');
  doc.setFontSize(secondarySize);
  setTextColor(doc, palette.secondary);
  doc.text('Goods total', 140, y, { align: 'right' });
  setTextColor(doc, palette.primary);
  doc.text(formatZAR(result.totalGoodsZar), 190, y, { align: 'right' });
  y += 4.5;

  setTextColor(doc, palette.secondary);
  doc.text('Extra fees', 140, y, { align: 'right' });
  setTextColor(doc, palette.primary);
  doc.text(formatZAR(result.totalFeesZar), 190, y, { align: 'right' });
  y += 5.5;

  // Final Order Total row
  const isClassic = theme === 'emerald';
  if (isClassic) {
    checkPageBreak(10);
    setDrawColor(doc, palette.border);
    doc.setLineWidth(0.25);
    doc.line(20, y, 190, y);
    y += 5;

    doc.setFont(displayFont, usingCustomFonts ? 'normal' : 'bold');
    doc.setFontSize(13);
    setTextColor(doc, palette.primary);
    doc.text('Order total', 140, y, { align: 'right' });
    doc.text(formatZAR(result.totalOrderZar), 190, y, { align: 'right' });

    y += 2.5;
    doc.line(20, y, 190, y);
    y += sectionGap;
  } else {
    checkPageBreak(14);
    setFill(doc, palette.surfaceRaised);
    doc.rect(20, y, 170, 10, 'F');

    doc.setFont(displayFont, 'bold');
    doc.setFontSize(12);
    setTextColor(doc, palette.primary);
    const bandTextY = y + 6.5;
    doc.text('Order total', 25, bandTextY);
    doc.text(formatZAR(result.totalOrderZar), 185, bandTextY, { align: 'right' });

    y += 10 + sectionGap;
  }

  // 3. "Coffees" section: ONE continuous list
  checkPageBreak(25);
  y = drawSectionHeading(doc, loaded, 'Coffees', y);

  for (let lotIdx = 0; lotIdx < order.lots.length; lotIdx++) {
    const lot = order.lots[lotIdx];
    const lotCalc = result.lotCalcs.find((lc) => lc.lotId === lot.id) ?? result.lotCalcs[lotIdx];

    // Ensure lot heading and at least its first row are never orphaned
    checkPageBreak(18);

    // Heading row: lot name bold left, lot total right
    doc.setFont(bodyFont, 'bold');
    doc.setFontSize(bodySize);
    setTextColor(doc, palette.primary);
    const lotNameLines = doc.splitTextToSize(lot.name, 130) as string[];
    const lotTotalStr = formatZAR(lotCalc?.totalZar ?? 0);
    doc.text(lotTotalStr, 190, y, { align: 'right' });

    for (const lnl of lotNameLines) {
      doc.text(lnl, 20, y);
      y += 4.2;
    }

    // Line 2: Beans R... · Fees R... · R... per bag
    doc.setFont(bodyFont, 'normal');
    doc.setFontSize(secondarySize);
    setTextColor(doc, palette.secondary);
    const beansStr = formatZAR(lotCalc?.goodsZar ?? 0);
    const feesStr = formatZAR(lotCalc?.feesZar ?? 0);
    const perBagStr = formatZAR(lotCalc?.finalZarPerBag ?? 0);
    const lotStats = `Beans ${beansStr} · Fees ${feesStr} · ${perBagStr} per bag`;
    doc.text(lotStats, 20, y);
    y += 4.5;

    // Collect all allocations for this lot from personCalcs
    const lotAllocations = result.personIds
      .flatMap((personId) => {
        const person = peopleMap.get(personId);
        const personCalc = result.personCalcs[personId];
        if (!person || !personCalc) return [];

        return personCalc.lotBreakdowns
          .filter((breakdown) => breakdown.lotId === lot.id)
          .map((breakdown) => {
            const detail =
              breakdown.splitWith.length > 0
                ? `Split with ${breakdown.splitWith.join(', ')}`
                : breakdown.bagMode === 'full'
                  ? 'Own bag'
                  : breakdown.bagMode === 'unassigned'
                    ? 'Unassigned bag'
                    : 'Split bag';

            return {
              key: breakdown.id,
              personName: person.name,
              bagIndex: breakdown.bagIndex,
              shareGrams: breakdown.shareGrams,
              detail,
              totalZar: breakdown.totalZar,
            };
          });
      })
      .sort((a, b) => a.bagIndex - b.bagIndex || a.personName.localeCompare(b.personName));

    // Print allocations
    for (const alloc of lotAllocations) {
      checkPageBreak(rowPitch);

      const leftText = `${alloc.personName} · Bag ${alloc.bagIndex + 1} · ${formatGrams(alloc.shareGrams)}`;
      const amountStr = formatZAR(alloc.totalZar);

      doc.setFont(bodyFont, 'normal');
      doc.setFontSize(bodySize);
      setTextColor(doc, palette.primary);
      doc.text(amountStr, 190, y, { align: 'right' });
      doc.text(leftText, 20, y);

      const leftWidth = doc.getTextWidth(leftText);
      const appendDetail = ` · ${alloc.detail}`;
      doc.setFontSize(secondarySize);
      setTextColor(doc, palette.secondary);
      const detailWidth = doc.getTextWidth(appendDetail);

      // Single line if fits without encroaching on amount
      if (20 + leftWidth + detailWidth < 155) {
        doc.text(appendDetail, 20 + leftWidth, y);
        y += rowPitch;
      } else {
        y += 3.8;
        doc.text(alloc.detail, 25, y);
        y += rowPitch;
      }
    }

    // Hairline between lots only
    if (lotIdx < order.lots.length - 1) {
      y += 1;
      setDrawColor(doc, palette.border);
      doc.setLineWidth(0.2);
      doc.line(20, y, 190, y);
      y += lotGap;
    }
  }

  // 4. "Fees" section (if order.fees exist)
  if (order.fees && order.fees.length > 0) {
    y += sectionGap;
    checkPageBreak(15);
    y = drawSectionHeading(doc, loaded, 'Fees', y);

    for (const fee of order.fees as Fee[]) {
      doc.setFont(bodyFont, 'normal');
      doc.setFontSize(bodySize);
      const feeLabelLines = doc.splitTextToSize(formatFeeForOwner(fee, peopleMap), 150) as string[];
      checkPageBreak(feeLabelLines.length * 4.5);
      setTextColor(doc, palette.primary);
      doc.text(feeLabelLines, 20, y);
      doc.text(formatZAR(fee.amountZar), 190, y, { align: 'right' });
      y += feeLabelLines.length * 4.5;
    }
  }

  drawPageFooters(doc, loaded);
  const filename = orderPdfFilename(order.name);
  return { doc, filename };
}

export async function generateOrderInvoicePDF(
  order: Order,
  people: Person[],
  result: CalculationResult,
  theme: Theme
): Promise<void> {
  const { doc, filename } = await createOrderInvoicePDFDocument(order, people, result, theme);
  doc.save(filename);
}
