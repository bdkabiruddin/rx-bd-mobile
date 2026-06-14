// Bilingual primitives — mirrors the rx.bd web `{ en, bn }` convention.

export type Language = 'en' | 'bn';

/** A string available in both supported languages. */
export interface Localized {
  en: string;
  bn: string;
}

/** Resolve a Localized value for the active language. */
export function pick(value: Localized, lang: Language): string {
  return value[lang];
}
