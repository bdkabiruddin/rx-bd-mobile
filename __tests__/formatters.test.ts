import {
  formatFreshness,
  formatPaisa,
  formatPhoneBd,
} from '@/i18n/formatters';

describe('formatPaisa', () => {
  it('formats paisa as ৳ with two decimals', () => {
    expect(formatPaisa('123456', 'en')).toBe('৳1,234.56');
    expect(formatPaisa('5', 'en')).toBe('৳0.05');
    expect(formatPaisa('100', 'en')).toBe('৳1.00');
    expect(formatPaisa(0n, 'en')).toBe('৳0.00');
  });

  it('handles negatives and very large BigInt values', () => {
    expect(formatPaisa('-2550', 'en')).toBe('−৳25.50');
    expect(formatPaisa('100000000000000', 'en')).toBe('৳1,000,000,000,000.00');
  });
});

describe('formatPhoneBd', () => {
  it('normalizes BD mobile numbers to +880 E.164', () => {
    expect(formatPhoneBd('01712345678')).toBe('+8801712345678');
    expect(formatPhoneBd('8801712345678')).toBe('+8801712345678');
    expect(formatPhoneBd('+880 1712-345678')).toBe('+8801712345678');
    expect(formatPhoneBd('1712345678')).toBe('+8801712345678');
  });
});

describe('formatFreshness', () => {
  const base = 1_700_000_000_000;
  it('labels recent data as Live', () => {
    expect(formatFreshness(base, 'en', base + 5_000)).toBe('Live');
  });
  it('labels minutes and hours', () => {
    expect(formatFreshness(base, 'en', base + 120_000)).toBe('Updated 2m ago');
    expect(formatFreshness(base, 'en', base + 2 * 3_600_000)).toBe('Updated 2h ago');
  });
});
