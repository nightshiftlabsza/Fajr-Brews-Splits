import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { hexToRgb, PDF_THEMES } from './pdfTheme';

function getLuminance([r, g, b]: readonly [number, number, number]): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastRatio(rgb1: readonly [number, number, number], rgb2: readonly [number, number, number]): number {
  const lum1 = getLuminance(rgb1);
  const lum2 = getLuminance(rgb2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

describe('pdfTheme tokens drift and contrast', () => {
  const tokensCssPath = path.resolve(__dirname, '../styles/tokens.css');
  const tokensCss = fs.readFileSync(tokensCssPath, 'utf-8');

  function extractToken(theme: 'emerald' | 'yinmn', prop: string): string {
    // Match within [data-theme="..."] section
    const themeSectionRegex = new RegExp(`\\[data-theme="${theme}"\\]\\s*\\{([\\s\\S]*?)\\}`, 'm');
    const match = tokensCss.match(themeSectionRegex);
    if (!match) throw new Error(`Could not find [data-theme="${theme}"] section in tokens.css`);

    const propRegex = new RegExp(`${prop}:\\s*([^;]+);`);
    const propMatch = match[1].match(propRegex);
    if (!propMatch) throw new Error(`Could not find ${prop} in ${theme} section of tokens.css`);

    return propMatch[1].trim();
  }

  it('matches tokens.css values for emerald theme', () => {
    const emerald = PDF_THEMES.emerald;
    expect(emerald.hex.accent.toUpperCase()).toBe(extractToken('emerald', '--color-accent').toUpperCase());
    expect(emerald.hex.primary.toUpperCase()).toBe(extractToken('emerald', '--color-text-primary').toUpperCase());
    expect(emerald.hex.secondary.toUpperCase()).toBe(extractToken('emerald', '--color-text-secondary').toUpperCase());
    expect(emerald.hex.muted.toUpperCase()).toBe(extractToken('emerald', '--color-text-muted').toUpperCase());
    expect(emerald.hex.border.toUpperCase()).toBe(extractToken('emerald', '--color-border').toUpperCase());
    expect(emerald.hex.surfaceRaised.toUpperCase()).toBe(extractToken('emerald', '--color-surface-raised').toUpperCase());

    // Verify RGB matches hex
    expect(emerald.accent).toEqual(hexToRgb(emerald.hex.accent));
    expect(emerald.primary).toEqual(hexToRgb(emerald.hex.primary));
    expect(emerald.secondary).toEqual(hexToRgb(emerald.hex.secondary));
    expect(emerald.muted).toEqual(hexToRgb(emerald.hex.muted));
    expect(emerald.border).toEqual(hexToRgb(emerald.hex.border));
    expect(emerald.surfaceRaised).toEqual(hexToRgb(emerald.hex.surfaceRaised));
  });

  it('matches tokens.css values for yinmn theme', () => {
    const yinmn = PDF_THEMES.yinmn;
    expect(yinmn.hex.accent.toUpperCase()).toBe(extractToken('yinmn', '--color-accent').toUpperCase());
    expect(yinmn.hex.primary.toUpperCase()).toBe(extractToken('yinmn', '--color-text-primary').toUpperCase());
    expect(yinmn.hex.secondary.toUpperCase()).toBe(extractToken('yinmn', '--color-text-secondary').toUpperCase());
    expect(yinmn.hex.muted.toUpperCase()).toBe(extractToken('yinmn', '--color-text-muted').toUpperCase());
    expect(yinmn.hex.border.toUpperCase()).toBe(extractToken('yinmn', '--color-border').toUpperCase());
    expect(yinmn.hex.surfaceRaised.toUpperCase()).toBe(extractToken('yinmn', '--color-surface-raised').toUpperCase());

    // Verify RGB matches hex
    expect(yinmn.accent).toEqual(hexToRgb(yinmn.hex.accent));
    expect(yinmn.primary).toEqual(hexToRgb(yinmn.hex.primary));
    expect(yinmn.secondary).toEqual(hexToRgb(yinmn.hex.secondary));
    expect(yinmn.muted).toEqual(hexToRgb(yinmn.hex.muted));
    expect(yinmn.border).toEqual(hexToRgb(yinmn.hex.border));
    expect(yinmn.surfaceRaised).toEqual(hexToRgb(yinmn.hex.surfaceRaised));
  });

  it('guarantees muted text contrast on white is at least 4.5:1', () => {
    const white: [number, number, number] = [255, 255, 255];
    const emeraldContrast = getContrastRatio(PDF_THEMES.emerald.muted, white);
    const yinmnContrast = getContrastRatio(PDF_THEMES.yinmn.muted, white);

    expect(emeraldContrast).toBeGreaterThanOrEqual(4.5);
    expect(yinmnContrast).toBeGreaterThanOrEqual(4.5);
  });
});
