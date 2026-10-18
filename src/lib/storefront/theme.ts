/**
 * Storefront v1 theming engine.
 *
 * The merchant picks ONE hex color. Everything else is derived so the
 * locked design stays consistent (spec section 6):
 *
 *   --brand       merchant color          buttons, active nav, links
 *   --brand-soft  same hue, ~92% light    chips, add-to-cart, hero tint
 *   --brand-deep  same hue, ~16% light    headings, icons, logo letter
 *   --on-brand    white or dark (readable)text on brand buttons
 *
 * If the merchant color fails 4.5:1 against its button text the text color
 * flips automatically. Very pale colors are rejected outright.
 */

export interface StorefrontTheme {
  /** Merchant brand color (#RRGGBB). */
  brand: string;
  /** Pale tint for active chips / soft buttons / hero. */
  brandSoft: string;
  /** Near-black tint of the hue for headings and icons. */
  brandDeep: string;
  /** Readable text color on solid brand buttons (WCAG ≥ 4.5:1 preferred). */
  onBrand: string;
  /** False when the chosen color is too pale to use. */
  valid: boolean;
  /** Merchant-facing message when `valid` is false. */
  message?: string;
}

const FALLBACK_BRAND = "#16A34A";

/* ------------------------------- color math ------------------------------ */

interface RGB {
  r: number;
  g: number;
  b: number;
}

export function normalizeHex(input: string | null | undefined): string | null {
  if (typeof input !== "string") return null;
  const raw = input.trim();
  const short = raw.match(/^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (short) {
    return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toUpperCase();
  }
  const full = raw.match(/^#?([0-9a-f]{6})$/i);
  if (full) return `#${full[1].toUpperCase()}`;
  return null;
}

export function hexToRgb(hex: string): RGB | null {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  };
}

export function rgbToHsl({ r, g, b }: RGB): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h: h * 360, s, l };
}

export function hslToHex(h: number, s: number, l: number): string {
  const hn = ((h % 360) + 360) % 360;
  const sn = Math.min(1, Math.max(0, s));
  const ln = Math.min(1, Math.max(0, l));
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((hn / 60) % 2) - 1));
  const m = ln - c / 2;
  let rgb: RGB;
  if (hn < 60) rgb = { r: c, g: x, b: 0 };
  else if (hn < 120) rgb = { r: x, g: c, b: 0 };
  else if (hn < 180) rgb = { r: 0, g: c, b: x };
  else if (hn < 240) rgb = { r: 0, g: x, b: c };
  else if (hn < 300) rgb = { r: x, g: 0, b: c };
  else rgb = { r: c, g: 0, b: x };
  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0")
      .toUpperCase();
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

function relativeLuminance({ r, g, b }: RGB): number {
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2.x contrast ratio between two hex colors (1–21). */
export function contrastRatio(a: string, b: string): number {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  if (!ra || !rb) return 1;
  const la = relativeLuminance(ra);
  const lb = relativeLuminance(rb);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

const DARK_TEXT = "#0F172A";
const WHITE = "#FFFFFF";

/* ------------------------------ derivation ------------------------------- */

export function deriveThemeTokens(brandInput: string | null | undefined): StorefrontTheme {
  const brand = normalizeHex(brandInput) || FALLBACK_BRAND;
  const rgb = hexToRgb(brand)!;
  const { h, s, l } = rgbToHsl(rgb);

  // Very pale colors are rejected: they cannot carry buttons or white text.
  const luminance = relativeLuminance(rgb);
  if (luminance > 0.72) {
    return {
      brand,
      brandSoft: hslToHex(h, Math.min(s, 0.35), 0.96),
      brandDeep: hslToHex(h, Math.min(s, 0.5), 0.3),
      onBrand: DARK_TEXT,
      valid: false,
      message:
        "That colour is too light — pick a darker shade so buttons and text stay readable.",
    };
  }

  // Soft tint: same hue, desaturated, ~92% lightness.
  const brandSoft = hslToHex(h, Math.min(s, 0.42), 0.93);
  // Deep tint: same hue, ~16% lightness (headings / icons / logo letter).
  const brandDeep = hslToHex(h, Math.min(s, 0.65), 0.16);

  // Button text flips automatically to keep the strongest contrast.
  const whiteContrast = contrastRatio(brand, WHITE);
  const darkContrast = contrastRatio(brand, DARK_TEXT);
  const onBrand =
    whiteContrast >= darkContrast
      ? whiteContrast >= 4.5
        ? WHITE
        : darkContrast > whiteContrast
          ? DARK_TEXT
          : WHITE
      : darkContrast >= 4.5
        ? DARK_TEXT
        : whiteContrast >= darkContrast
          ? WHITE
          : DARK_TEXT;

  return { brand, brandSoft, brandDeep, onBrand, valid: true };
}

/** CSS custom properties for the renderer. */
export function themeToCssVars(theme: StorefrontTheme): Record<string, string> {
  return {
    "--brand": theme.brand,
    "--brand-soft": theme.brandSoft,
    "--brand-deep": theme.brandDeep,
    "--on-brand": theme.onBrand,
  };
}