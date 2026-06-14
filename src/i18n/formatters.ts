// Locale-aware formatters — Asia/Dhaka, ৳ (paisa), +880, Bangla numerals.
// Money is handled as stringified-BigInt paisa end-to-end (matches the
// backend), never as floats.

import type { Language } from './types';

const DHAKA = 'Asia/Dhaka';

const localeOf = (lang: Language): string => (lang === 'bn' ? 'bn-BD' : 'en-GB');

/** Format an ISO timestamp in Asia/Dhaka. */
export function formatDateTime(iso: string | number | Date, lang: Language): string {
  return new Date(iso).toLocaleString(localeOf(lang), {
    timeZone: DHAKA,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(iso: string | number | Date, lang: Language): string {
  return new Date(iso).toLocaleDateString(localeOf(lang), {
    timeZone: DHAKA,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Stringified-BigInt paisa → "৳1,234.56". Safe for arbitrarily large values. */
export function formatPaisa(paisa: string | bigint, lang: Language): string {
  const n = typeof paisa === 'bigint' ? paisa : BigInt(paisa);
  const negative = n < 0n;
  const abs = negative ? -n : n;
  const whole = abs / 100n;
  const frac = (abs % 100n).toString().padStart(2, '0');
  const grouped = whole.toLocaleString(localeOf(lang));
  return `${negative ? '−' : ''}৳${grouped}.${frac}`;
}

/** Normalize a Bangladeshi mobile number to +880 E.164 (best-effort). */
export function formatPhoneBd(raw: string): string {
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.startsWith('880')) return `+${digits}`;
  if (digits.startsWith('0')) return `+880${digits.slice(1)}`;
  if (digits.startsWith('1') && digits.length === 10) return `+880${digits}`;
  return raw.trim();
}

/** Relative freshness label for the offline cache badge. */
export function formatFreshness(
  fetchedAt: number,
  lang: Language,
  now: number = Date.now(),
): string {
  const seconds = Math.max(0, Math.floor((now - fetchedAt) / 1000));
  const t = (en: string, bn: string) => (lang === 'bn' ? bn : en);
  if (seconds < 30) return t('Live', 'লাইভ');
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    return t(`Updated ${m}m ago`, `${m} মিনিট আগে হালনাগাদ`);
  }
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600);
    return t(`Updated ${h}h ago`, `${h} ঘণ্টা আগে হালনাগাদ`);
  }
  return t(`Last synced ${formatDate(fetchedAt, lang)}`, `সর্বশেষ সিঙ্ক ${formatDate(fetchedAt, lang)}`);
}
