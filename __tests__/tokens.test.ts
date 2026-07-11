import { darkTheme, lightTheme } from '@/ui/tokens';

// WCAG 2.1 relative luminance + contrast ratio (pure, so it runs in Node).
function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const chan = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = chan.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!;
}
function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const AA_NORMAL = 4.5; // WCAG AA for normal-size text

// Regression guard for the dark-mode clinical-warning contrast fix: the amber
// used for warning TEXT on the theme background (allergy/med-source honesty
// disclosures, queue staleness notices) must read AA in BOTH schemes — it was
// 3.5:1 in dark mode before `warningText` was split from the chip `warning`.
describe('status.warningText meets WCAG AA on the theme background', () => {
  it('light: warningText on bg', () => {
    expect(contrast(lightTheme.status.warningText, lightTheme.bg)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('dark: warningText on bg', () => {
    expect(contrast(darkTheme.status.warningText, darkTheme.bg)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('dark: warningText on bgElevated (prescribe cards + queue notices)', () => {
    expect(contrast(darkTheme.status.warningText, darkTheme.bgElevated)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('dark scheme lightens warningText away from the chip-only base warning', () => {
    expect(darkTheme.status.warningText).not.toBe(darkTheme.status.warning);
  });

  it('base warning still reads AA as text on its own warningSoft chip (unchanged)', () => {
    expect(contrast(darkTheme.status.warning, darkTheme.status.warningSoft)).toBeGreaterThanOrEqual(AA_NORMAL);
  });
});
