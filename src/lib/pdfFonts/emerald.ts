import type { jsPDF } from 'jspdf';
import fraunces600Url from '../../assets/pdf-fonts/Fraunces-600.ttf?inline';
import frauncesItalicUrl from '../../assets/pdf-fonts/Fraunces-Italic.ttf?inline';
import manrope400Url from '../../assets/pdf-fonts/Manrope-400.ttf?inline';
import manrope700Url from '../../assets/pdf-fonts/Manrope-700.ttf?inline';

function stripBase64(dataUri: string): string {
  const commaIdx = dataUri.indexOf(',');
  return commaIdx !== -1 ? dataUri.slice(commaIdx + 1) : dataUri;
}

export function registerEmeraldFonts(doc: jsPDF): void {
  const f600 = stripBase64(fraunces600Url);
  doc.addFileToVFS('Fraunces-600.ttf', f600);
  doc.addFont('Fraunces-600.ttf', 'Fraunces', 'normal');
  doc.addFont('Fraunces-600.ttf', 'Fraunces', 'bold');

  const fItalic = stripBase64(frauncesItalicUrl);
  doc.addFileToVFS('Fraunces-Italic.ttf', fItalic);
  doc.addFont('Fraunces-Italic.ttf', 'Fraunces', 'italic');
  doc.addFont('Fraunces-Italic.ttf', 'FrauncesItalic', 'normal');
  doc.addFont('Fraunces-Italic.ttf', 'FrauncesItalic', 'italic');

  const m400 = stripBase64(manrope400Url);
  doc.addFileToVFS('Manrope-400.ttf', m400);
  doc.addFont('Manrope-400.ttf', 'Manrope', 'normal');

  const m700 = stripBase64(manrope700Url);
  doc.addFileToVFS('Manrope-700.ttf', m700);
  doc.addFont('Manrope-700.ttf', 'Manrope', 'bold');
}
