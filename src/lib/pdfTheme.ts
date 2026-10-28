import type { Theme } from '../types';

export type RGB = readonly [number, number, number];

export interface PdfThemePalette {
  theme: Theme;
  primary: RGB;
  secondary: RGB;
  muted: RGB;
  border: RGB;
  surfaceRaised: RGB;
  accent: RGB;
  accentRightHalf: RGB;
  hex: {
    primary: string;
    secondary: string;
    muted: string;
    border: string;
    surfaceRaised: string;
    accent: string;
  };
  fonts: {
    display: string;
    body: string;
    bodyBold: string;
    attribution: string;
  };
  fallbackFonts: {
    display: string;
    body: string;
    bodyBold: string;
    attribution: string;
  };
}

export function hexToRgb(hex: string): RGB {
  const clean = hex.replace('#', '').trim();
  const num = parseInt(clean, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return [r, g, b] as const;
}

/**
 * Mix an RGB color with white at a given opacity factor (0..1).
 * Used to compute the 42% opacity right half of the Splits mark as solid RGB.
 */
export function mixWithWhite(rgb: RGB, opacity: number = 0.42): RGB {
  const r = Math.round(rgb[0] * opacity + 255 * (1 - opacity));
  const g = Math.round(rgb[1] * opacity + 255 * (1 - opacity));
  const b = Math.round(rgb[2] * opacity + 255 * (1 - opacity));
  return [r, g, b] as const;
}

export const PDF_THEMES: Record<Theme, PdfThemePalette> = {
  emerald: {
    theme: 'emerald',
    accent: [27, 94, 64],
    primary: [13, 26, 16],
    secondary: [58, 82, 64],
    muted: [84, 115, 95],
    border: [200, 218, 200],
    surfaceRaised: [235, 240, 231],
    accentRightHalf: mixWithWhite([27, 94, 64], 0.42),
    hex: {
      accent: '#1B5E40',
      primary: '#0D1A10',
      secondary: '#3A5240',
      muted: '#54735F',
      border: '#C8DAC8',
      surfaceRaised: '#EBF0E7',
    },
    fonts: {
      display: 'Fraunces',
      body: 'Manrope',
      bodyBold: 'Manrope',
      attribution: 'Fraunces',
    },
    fallbackFonts: {
      display: 'times',
      body: 'times',
      bodyBold: 'times',
      attribution: 'times',
    },
  },
  yinmn: {
    theme: 'yinmn',
    accent: [46, 77, 170],
    primary: [17, 24, 39],
    secondary: [55, 65, 81],
    muted: [84, 93, 110],
    border: [200, 208, 232],
    surfaceRaised: [228, 232, 244],
    accentRightHalf: mixWithWhite([46, 77, 170], 0.42),
    hex: {
      accent: '#2E4DAA',
      primary: '#111827',
      secondary: '#374151',
      muted: '#545D6E',
      border: '#C8D0E8',
      surfaceRaised: '#E4E8F4',
    },
    fonts: {
      display: 'HankenGrotesk',
      body: 'HankenGrotesk',
      bodyBold: 'HankenGrotesk',
      attribution: 'HankenGrotesk',
    },
    fallbackFonts: {
      display: 'helvetica',
      body: 'helvetica',
      bodyBold: 'helvetica',
      attribution: 'helvetica',
    },
  },
};

export function getPdfTheme(theme: Theme): PdfThemePalette {
  return PDF_THEMES[theme] ?? PDF_THEMES.emerald;
}
