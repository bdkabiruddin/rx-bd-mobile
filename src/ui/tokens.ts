// Design tokens — faithful port of src/styles/themes/rx-bd.css.
//
// Two layers, same names as web:
//   1. Reference palette — rxbdTeal/rxbdCoral/rxbdGray (the raw scale)
//   2. Semantic theme     — bg/fg/accent/status, light + dark
//
// RULES (mirrored from web):
//   - Tenants may override ONLY the accent family.
//   - Status + clinicalCritical colors are LOCKED (patient safety, AAA) and
//     never tenant-brandable.
//
// This file is the hand-authored source of truth for v1; a
// scripts/generate-tokens.mjs can regenerate it from the CSS to stay in
// lockstep (see package.json `tokens:generate`).

export const palette = {
  teal: {
    50: '#ecfeff', 100: '#cffafe', 200: '#a5f3fc', 300: '#67e8f9', 400: '#22d3ee',
    500: '#0ea5b7', 600: '#0c8ea0', 700: '#0e7382', 800: '#155a66', 900: '#164e58',
  },
  coral: { 300: '#fda29b', 500: '#f97066', 600: '#d92d20' },
  gray: {
    50: '#f9fafb', 100: '#f3f4f6', 200: '#e5e7eb', 300: '#d1d5db', 400: '#9ca3af',
    500: '#6b7280', 600: '#4b5563', 700: '#374151', 800: '#1f2937', 900: '#111827', 950: '#0b1220',
  },
} as const;

// Locked safety colors — chip/fill values identical across light/dark, never
// branded. `warningText` is the amber used when a warning is rendered as TEXT
// directly on the theme background (not on a *Soft chip): it must meet WCAG AA
// on that background, so it stays dark on light but LIGHTENS on dark. The base
// `warning` (dark amber) still reads AA as text on the light `warningSoft` chip.
const statusBase = {
  success: '#15803d', successFg: '#ffffff', successSoft: '#dcfce7',
  warning: '#b45309', warningFg: '#ffffff', warningSoft: '#fef3c7',
  danger: '#b91c1c', dangerFg: '#ffffff', dangerSoft: '#fee2e2',
  info: '#1d4ed8', infoFg: '#ffffff', infoSoft: '#dbeafe', infoStrong: '#1e3a8a',
  clinicalCritical: '#7f1d1d', clinicalCriticalFg: '#ffffff',
} as const;
// warningText darkens on light / lightens on dark so the clinical safety +
// staleness disclosures meet WCAG AA on the theme background in BOTH schemes.
// (not `as const`: warningText differs per scheme, so it must widen to string.)
const lightStatus = { ...statusBase, warningText: statusBase.warning }; // #b45309 on #fff ≈ 5.8:1
const darkStatus = { ...statusBase, warningText: '#fbbf24' }; //          amber-400 on #0b1220 ≈ 11:1

// Status values are consumed as ColorValue strings; widen the per-scheme
// literals so light/dark share one shape (warningText differs between them).
type StatusTokens = { readonly [K in keyof typeof lightStatus]: string };

export interface Theme {
  scheme: 'light' | 'dark';
  bg: string; bgSoft: string; bgMuted: string; bgElevated: string;
  fg: string; fgMuted: string; fgSubtle: string;
  line: string; lineStrong: string; inputBorder: string;
  accent: string; accentHover: string; accentFg: string; accentSoft: string;
  status: StatusTokens;
  /** Semi-transparent backdrop behind modals / action sheets. */
  scrim: string;
}

export const lightTheme: Theme = {
  scheme: 'light',
  bg: '#ffffff',
  bgSoft: palette.gray[50],
  bgMuted: palette.gray[100],
  bgElevated: '#ffffff',
  fg: palette.gray[950],
  fgMuted: palette.gray[700],
  fgSubtle: palette.gray[600],
  line: palette.gray[200],
  lineStrong: palette.gray[300],
  inputBorder: palette.gray[500],
  accent: palette.teal[700],
  accentHover: palette.teal[800],
  accentFg: '#ffffff',
  accentSoft: palette.teal[50],
  status: lightStatus,
  scrim: 'rgba(11,18,32,0.45)',
};

export const darkTheme: Theme = {
  scheme: 'dark',
  bg: palette.gray[950],
  bgSoft: palette.gray[900],
  bgMuted: palette.gray[800],
  bgElevated: palette.gray[900],
  fg: palette.gray[50],
  fgMuted: palette.gray[300],
  fgSubtle: palette.gray[400],
  line: palette.gray[800],
  lineStrong: palette.gray[700],
  inputBorder: palette.gray[400],
  accent: palette.teal[400],
  accentHover: palette.teal[300],
  accentFg: palette.gray[950],
  accentSoft: palette.gray[800],
  status: darkStatus,
  scrim: 'rgba(0,0,0,0.6)',
};

// Type scale + spacing (8pt grid) — minimal, extend as primitives land.
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 6, md: 10, lg: 16, pill: 999 } as const;
export const fontSize = {
  caption: 12, bodySm: 14, body: 16, h3: 20, h2: 24, h1: 30,
} as const;
// Minimum touch target — shared ward tablets, gloved hands (a11y gate).
export const MIN_TOUCH_TARGET = 48;
