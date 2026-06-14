// Language store + resolver. One language at a time (web Wave 59 rule:
// never both side by side). Preference persists in the secure prefs store.

import { create } from 'zustand';

import { pick, type Language, type Localized } from './types';

export * from './types';
export * from './formatters';
export { COMMON } from './strings';

interface LanguageState {
  lang: Language;
  setLang: (lang: Language) => void;
  toggle: () => void;
}

export const useLanguage = create<LanguageState>((set, get) => ({
  lang: 'en',
  setLang: (lang) => set({ lang }),
  toggle: () => set({ lang: get().lang === 'en' ? 'bn' : 'en' }),
}));

/** Hook returning a translator bound to the active language. */
export function useT(): {
  lang: Language;
  t: (value: Localized) => string;
} {
  const lang = useLanguage((s) => s.lang);
  return { lang, t: (value: Localized) => pick(value, lang) };
}
