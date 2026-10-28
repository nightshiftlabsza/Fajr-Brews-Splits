import type { jsPDF } from 'jspdf';
import hanken400Url from '../../assets/pdf-fonts/HankenGrotesk-400.ttf?inline';
import hanken700Url from '../../assets/pdf-fonts/HankenGrotesk-700.ttf?inline';

function stripBase64(dataUri: string): string {
  const commaIdx = dataUri.indexOf(',');
  return commaIdx !== -1 ? dataUri.slice(commaIdx + 1) : dataUri;
}

export function registerYinmnFonts(doc: jsPDF): void {
  const hg400 = stripBase64(hanken400Url);
  doc.addFileToVFS('HankenGrotesk-400.ttf', hg400);
  doc.addFont('HankenGrotesk-400.ttf', 'HankenGrotesk', 'normal');

  const hg700 = stripBase64(hanken700Url);
  doc.addFileToVFS('HankenGrotesk-700.ttf', hg700);
  doc.addFont('HankenGrotesk-700.ttf', 'HankenGrotesk', 'bold');
}
