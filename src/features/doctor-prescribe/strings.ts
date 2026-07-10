// Doctor prescribe + e-sign — bilingual copy. One language renders at a
// time (Wave 59 rule); safety wording is unambiguous in BOTH languages.

import type { Localized } from '@/i18n/types';

import type { ItemIssue, SignBlockReason } from './logic';

export const STR = {
  title: { en: 'Write prescription', bn: 'প্রেসক্রিপশন লিখুন' },
  invalidPatient: {
    en: 'No patient selected.',
    bn: 'কোনো রোগী নির্বাচন করা হয়নি।',
  },

  // Allergy banner
  allergiesTitle: { en: 'Patient allergies', bn: 'রোগীর অ্যালার্জি' },
  allergyLoadFailed: {
    en: 'Allergy records could not be loaded. Do NOT assume the patient has no allergies — retry before prescribing.',
    bn: 'অ্যালার্জির রেকর্ড লোড করা যায়নি। রোগীর অ্যালার্জি নেই — এমনটা ধরে নেবেন না; প্রেসক্রাইব করার আগে আবার চেষ্টা করুন।',
  },
  noAllergies: {
    en: 'No allergies on record',
    bn: 'কোনো অ্যালার্জি নথিভুক্ত নেই',
  },

  // Medications
  medications: { en: 'Medications', bn: 'ওষুধসমূহ' },
  addMedication: { en: 'Add medication', bn: 'ওষুধ যোগ করুন' },
  maxItemsReached: {
    en: 'A prescription can have at most 20 items.',
    bn: 'একটি প্রেসক্রিপশনে সর্বোচ্চ ২০টি ওষুধ রাখা যায়।',
  },
  noItemsYet: {
    en: 'No medications added yet.',
    bn: 'এখনো কোনো ওষুধ যোগ করা হয়নি।',
  },
  drugLabel: { en: 'Drug (generic name)', bn: 'ওষুধ (জেনেরিক নাম)' },
  drugHint: {
    en: 'Type at least 2 letters to search the catalog.',
    bn: 'ক্যাটালগে খুঁজতে অন্তত ২টি অক্ষর লিখুন।',
  },
  strengthLabel: { en: 'Strength (e.g. 500 mg)', bn: 'শক্তি (যেমন 500 mg)' },
  doseLabel: { en: 'Dose (e.g. 500 mg)', bn: 'ডোজ (যেমন 500 mg)' },
  frequencyLabel: { en: 'Frequency', bn: 'সেবনবিধি' },
  durationLabel: { en: 'Duration (days)', bn: 'সময়কাল (দিন)' },
  routeLabel: { en: 'Route (e.g. oral)', bn: 'সেবনের পথ (যেমন মুখে)' },
  instructionsLabel: { en: 'Instructions', bn: 'নির্দেশনা' },
  removeItem: { en: 'Remove', bn: 'বাদ দিন' },
  removeConfirmTitle: { en: 'Remove medication?', bn: 'ওষুধটি বাদ দেবেন?' },
  removeConfirmMsg: {
    en: 'This row will be removed from the prescription.',
    bn: 'এই ওষুধটি প্রেসক্রিপশন থেকে বাদ যাবে।',
  },

  // Diagnosis / notes / meta
  detailsTitle: { en: 'Diagnosis & notes', bn: 'রোগনির্ণয় ও নোট' },
  diagnosisLabel: {
    en: 'Diagnosis codes (ICD-10, comma separated)',
    bn: 'রোগনির্ণয় কোড (ICD-10, কমা দিয়ে আলাদা করুন)',
  },
  diagnosisHint: { en: 'e.g. J45.20, I10', bn: 'যেমন J45.20, I10' },
  notesLabel: { en: 'Notes', bn: 'নোট' },
  refillsLabel: { en: 'Refills allowed (0–12)', bn: 'রিফিল সংখ্যা (০–১২)' },
  validDaysLabel: { en: 'Valid for (days)', bn: 'মেয়াদ (দিন)' },

  // Templates
  templatesTitle: { en: 'My templates', bn: 'আমার টেমপ্লেট' },
  templatesEmpty: {
    en: 'No templates yet.',
    bn: 'এখনো কোনো টেমপ্লেট নেই।',
  },
  applyTemplate: { en: 'Apply', bn: 'প্রয়োগ করুন' },
  templateApplied: {
    en: 'Template applied. Review every field before signing.',
    bn: 'টেমপ্লেট প্রয়োগ হয়েছে। স্বাক্ষরের আগে প্রতিটি ঘর যাচাই করুন।',
  },
  templateApplyFailed: {
    en: 'Could not apply the template.',
    bn: 'টেমপ্লেটটি প্রয়োগ করা যায়নি।',
  },

  // Dry run (safety check)
  dryRunTitle: { en: 'Safety check', bn: 'নিরাপত্তা যাচাই' },
  runDryRun: { en: 'Run safety check', bn: 'নিরাপত্তা যাচাই চালান' },
  dryRunExplain: {
    en: 'Every medication is checked against the patient’s allergies, current medicines, interactions and dose limits before signing.',
    bn: 'স্বাক্ষরের আগে প্রতিটি ওষুধ রোগীর অ্যালার্জি, চলমান ওষুধ, ওষুধ-মিথস্ক্রিয়া ও ডোজ-সীমার সাথে যাচাই করা হয়।',
  },
  dryRunStale: {
    en: 'Medications changed — run the safety check again.',
    bn: 'ওষুধ পরিবর্তন হয়েছে — নিরাপত্তা যাচাই আবার চালান।',
  },
  dryRunItemFailed: {
    en: 'Check failed for this drug — run the safety check again.',
    bn: 'এই ওষুধের যাচাই সম্পন্ন হয়নি — নিরাপত্তা যাচাই আবার চালান।',
  },
  noFindings: {
    en: 'No safety findings',
    bn: 'কোনো নিরাপত্তা সমস্যা পাওয়া যায়নি',
  },
  tierAbsolute: {
    en: 'BLOCKED — cannot be overridden',
    bn: 'নিষিদ্ধ — কোনোভাবেই অগ্রাহ্য করা যাবে না',
  },
  tierBlocking: { en: 'BLOCKED', bn: 'বাধাপ্রাপ্ত' },
  tierAdvisory: { en: 'Warning', bn: 'সতর্কবার্তা' },
  allergySourceUnavailable: {
    en: 'Structured allergy records could not be checked — extra caution advised.',
    bn: 'কাঠামোবদ্ধ অ্যালার্জি রেকর্ড যাচাই করা যায়নি — অতিরিক্ত সতর্কতা প্রয়োজন।',
  },
  medSourceUnavailable: {
    en: 'The current medication list could not be checked — extra caution advised.',
    bn: 'চলমান ওষুধের তালিকা যাচাই করা যায়নি — অতিরিক্ত সতর্কতা প্রয়োজন।',
  },
  ackLabel: {
    en: 'I have reviewed the warnings above and take clinical responsibility for prescribing despite them.',
    bn: 'আমি উপরের সতর্কবার্তাগুলো পর্যালোচনা করেছি এবং তা সত্ত্বেও প্রেসক্রাইব করার ক্লিনিক্যাল দায়িত্ব নিচ্ছি।',
  },
  blockedNote: {
    en: 'Signing is blocked. Resolve the finding by changing the medication — blocking findings cannot be dismissed from this app.',
    bn: 'স্বাক্ষর বন্ধ আছে। ওষুধ পরিবর্তন করে সমস্যাটির সমাধান করুন — বাধাপ্রাপ্ত ফলাফল এই অ্যাপ থেকে উপেক্ষা করা যায় না।',
  },
  serverBlockTitle: {
    en: 'The server refused to sign',
    bn: 'সার্ভার স্বাক্ষর প্রত্যাখ্যান করেছে',
  },

  // Draft
  saveDraft: { en: 'Save draft', bn: 'খসড়া সংরক্ষণ করুন' },
  draftSavedTitle: { en: 'Draft saved', bn: 'খসড়া সংরক্ষিত হয়েছে' },
  draftSavedMsg: {
    en: 'You can resume this prescription later.',
    bn: 'পরে এই প্রেসক্রিপশনটি আবার চালিয়ে যেতে পারবেন।',
  },
  draftSaveFailed: {
    en: 'The draft could not be saved.',
    bn: 'খসড়াটি সংরক্ষণ করা যায়নি।',
  },

  // Sign
  sign: { en: 'Sign prescription', bn: 'প্রেসক্রিপশনে স্বাক্ষর করুন' },
  signConfirmTitle: { en: 'Sign prescription?', bn: 'প্রেসক্রিপশনে স্বাক্ষর করবেন?' },
  signConfirmMsg: {
    en: 'Once signed, this prescription becomes active and can be dispensed at a pharmacy.',
    bn: 'স্বাক্ষরের পর প্রেসক্রিপশনটি কার্যকর হবে এবং ফার্মেসি থেকে ওষুধ দেওয়া যাবে।',
  },
  signPrompt: {
    en: 'Confirm your identity to sign this prescription',
    bn: 'প্রেসক্রিপশনে স্বাক্ষর করতে আপনার পরিচয় নিশ্চিত করুন',
  },
  signedTitle: { en: 'Prescription signed', bn: 'প্রেসক্রিপশন স্বাক্ষরিত হয়েছে' },
  signedMsg: {
    en: 'The prescription is now active.',
    bn: 'প্রেসক্রিপশনটি এখন কার্যকর।',
  },
  offlineWrite: {
    en: 'You are offline. Reconnect to continue.',
    bn: 'আপনি অফলাইনে আছেন। চালিয়ে যেতে ইন্টারনেটে সংযুক্ত হোন।',
  },
} satisfies Record<string, Localized>;

/** Sign-gate reason → user-facing sentence. */
export function signBlockLabel(reason: SignBlockReason): Localized {
  switch (reason) {
    case 'no-items':
      return {
        en: 'Add at least one medication to sign.',
        bn: 'স্বাক্ষর করতে অন্তত একটি ওষুধ যোগ করুন।',
      };
    case 'incomplete-item':
      return {
        en: 'Complete every medication (drug, strength, dose, frequency, duration, route).',
        bn: 'প্রতিটি ওষুধের তথ্য সম্পূর্ণ করুন (ওষুধ, শক্তি, ডোজ, সেবনবিধি, সময়কাল, সেবনের পথ)।',
      };
    case 'diagnosis':
      return {
        en: 'Enter at least one valid ICD-10 diagnosis code (e.g. J45.20).',
        bn: 'অন্তত একটি সঠিক ICD-10 রোগনির্ণয় কোড দিন (যেমন J45.20)।',
      };
    case 'dry-run':
      return {
        en: 'Run the safety check on the current medications before signing.',
        bn: 'স্বাক্ষরের আগে বর্তমান ওষুধগুলোর নিরাপত্তা যাচাই চালান।',
      };
    case 'safety-block':
      return STR.blockedNote;
    case 'ack':
      return {
        en: 'Review and acknowledge the warnings to enable signing.',
        bn: 'স্বাক্ষর সক্রিয় করতে সতর্কবার্তাগুলো পর্যালোচনা করে সম্মতি দিন।',
      };
  }
}

/** Per-field completeness message shown on a medication row. */
export function itemIssueLabel(issue: ItemIssue): Localized {
  switch (issue) {
    case 'drugName':
      return { en: 'Drug name is required.', bn: 'ওষুধের নাম আবশ্যক।' };
    case 'strength':
      return {
        en: 'Strength is required (e.g. 500 mg).',
        bn: 'শক্তি আবশ্যক (যেমন 500 mg)।',
      };
    case 'dose':
      return { en: 'Dose is required.', bn: 'ডোজ আবশ্যক।' };
    case 'frequency':
      return {
        en: 'Choose a frequency code.',
        bn: 'একটি সেবনবিধি নির্বাচন করুন।',
      };
    case 'durationDays':
      return {
        en: 'Duration must be 1–365 days.',
        bn: 'সময়কাল ১–৩৬৫ দিনের মধ্যে হতে হবে।',
      };
    case 'route':
      return { en: 'Route is required.', bn: 'সেবনের পথ আবশ্যক।' };
  }
}

/** Allergy severity label (mirrors the allergy module enum). */
export function severityLabel(severity: string | undefined): Localized {
  switch (severity) {
    case 'ANAPHYLAXIS':
      return { en: 'Anaphylaxis', bn: 'অ্যানাফাইল্যাক্সিস' };
    case 'SEVERE':
      return { en: 'Severe', bn: 'তীব্র' };
    case 'MODERATE':
      return { en: 'Moderate', bn: 'মাঝারি' };
    case 'MILD':
      return { en: 'Mild', bn: 'মৃদু' };
    default:
      return { en: 'Unknown severity', bn: 'অজানা তীব্রতা' };
  }
}

/** "Medication N" row heading. */
export function itemTitle(n: number, lang: 'en' | 'bn'): string {
  const num = n.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-GB');
  return lang === 'bn' ? `ওষুধ ${num}` : `Medication ${num}`;
}
