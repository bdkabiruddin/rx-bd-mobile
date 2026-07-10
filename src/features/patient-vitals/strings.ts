// Patient vitals — feature-local bilingual strings ({ en, bn }). One
// language renders at a time (Wave 59 rule); never both side by side.

import type { Localized } from '@/i18n/types';

export const VITALS_STR = {
  // Diary (index)
  diaryTitle: { en: 'Vitals diary', bn: 'ভাইটাল ডায়েরি' },
  addReading: { en: 'Add reading', bn: 'রিডিং যোগ করুন' },
  filterAll: { en: 'All', bn: 'সব' },
  noReadings: { en: 'No readings yet', bn: 'এখনো কোনো রিডিং নেই' },
  noReadingsHint: {
    en: 'Track your blood pressure, sugar, weight and more — add your first reading.',
    bn: 'আপনার রক্তচাপ, সুগার, ওজন এবং আরও অনেক কিছুর হিসাব রাখুন — প্রথম রিডিংটি যোগ করুন।',
  },
  noReadingsOfType: {
    en: 'No readings of this type',
    bn: 'এই ধরনের কোনো রিডিং নেই',
  },
  showAll: { en: 'Show all readings', bn: 'সব রিডিং দেখুন' },

  // Add form
  readingType: { en: 'Reading type', bn: 'রিডিংয়ের ধরন' },
  valueLabel: { en: 'Value', bn: 'মান' },
  painValueLabel: { en: 'Pain (0–10)', bn: 'ব্যথা (০–১০)' },
  painHint: {
    en: '0 means no pain, 10 means the worst pain.',
    bn: '০ মানে ব্যথা নেই, ১০ মানে সবচেয়ে তীব্র ব্যথা।',
  },
  systolic: { en: 'Systolic (mmHg)', bn: 'সিস্টোলিক (mmHg)' },
  diastolic: { en: 'Diastolic (mmHg)', bn: 'ডায়াস্টোলিক (mmHg)' },
  measuredAt: { en: 'When was it measured?', bn: 'কখন মাপা হয়েছে?' },
  dateLabel: { en: 'Date (YYYY-MM-DD)', bn: 'তারিখ (YYYY-MM-DD)' },
  timeLabel: { en: 'Time (HH:MM)', bn: 'সময় (HH:MM)' },
  setToNow: { en: 'Set to now', bn: 'এখনকার সময় দিন' },
  notesLabel: { en: 'Notes (optional)', bn: 'নোট (ঐচ্ছিক)' },
  notesHint: {
    en: 'e.g. after a meal, before medicine',
    bn: 'যেমন: খাওয়ার পরে, ওষুধের আগে',
  },
  selfReportedNote: {
    en: 'This will be saved in your record as self-reported.',
    bn: 'এটি আপনার রেকর্ডে নিজের দেওয়া তথ্য হিসেবে সংরক্ষিত হবে।',
  },
  saveReading: { en: 'Save reading', bn: 'রিডিং সংরক্ষণ করুন' },
  readingSaved: { en: 'Reading saved', bn: 'রিডিং সংরক্ষিত হয়েছে' },
  back: { en: 'Back', bn: 'ফিরে যান' },

  // Validation
  valueRequired: { en: 'Enter a value.', bn: 'একটি মান লিখুন।' },
  valueInvalid: {
    en: 'Enter a valid number.',
    bn: 'একটি সঠিক সংখ্যা লিখুন।',
  },
  diastolicRequired: {
    en: 'Enter both the systolic and diastolic numbers.',
    bn: 'সিস্টোলিক ও ডায়াস্টোলিক দুটি সংখ্যাই লিখুন।',
  },
  datetimeInvalid: {
    en: 'Enter a valid date and time (YYYY-MM-DD and HH:MM).',
    bn: 'সঠিক তারিখ ও সময় লিখুন (YYYY-MM-DD এবং HH:MM)।',
  },
  datetimeFuture: {
    en: 'The measurement time cannot be in the future.',
    bn: 'মাপার সময় ভবিষ্যতের হতে পারে না।',
  },

  // Shared write feedback
  offlineWrite: {
    en: 'You are offline. Reconnect to save your reading.',
    bn: 'আপনি অফলাইনে আছেন। রিডিং সংরক্ষণ করতে আবার ইন্টারনেটে সংযোগ করুন।',
  },
} satisfies Record<string, Localized>;

/** Localized label for a vital type; raw value when unknown. */
export function vitalTypeLabel(vitalType: string): Localized {
  switch (vitalType) {
    case 'BLOOD_PRESSURE':
      return { en: 'Blood pressure', bn: 'রক্তচাপ' };
    case 'HEART_RATE':
      return { en: 'Heart rate', bn: 'হৃদস্পন্দন' };
    case 'TEMPERATURE':
      return { en: 'Temperature', bn: 'তাপমাত্রা' };
    case 'BLOOD_GLUCOSE':
      return { en: 'Blood sugar', bn: 'রক্তের সুগার' };
    case 'WEIGHT':
      return { en: 'Weight', bn: 'ওজন' };
    case 'HEIGHT':
      return { en: 'Height', bn: 'উচ্চতা' };
    case 'OXYGEN_SATURATION':
      return { en: 'Oxygen (SpO₂)', bn: 'অক্সিজেন (SpO₂)' };
    case 'RESPIRATORY_RATE':
      return { en: 'Breathing rate', bn: 'শ্বাস-প্রশ্বাসের হার' };
    case 'PAIN_SCORE':
      return { en: 'Pain score', bn: 'ব্যথার মাত্রা' };
    case 'GCS':
      return { en: 'Consciousness (GCS)', bn: 'চেতনার মাত্রা (GCS)' };
    case 'MUAC':
      return { en: 'Arm circumference (MUAC)', bn: 'বাহুর বেড় (MUAC)' };
    case 'BMI':
      return { en: 'BMI', bn: 'বিএমআই' };
    default:
      return { en: vitalType, bn: vitalType };
  }
}

/** Localized label for a reading source — patient-entered rows are clearly
 *  marked self-reported (mirrors the backend's data-lineage distinction). */
export function vitalSourceLabel(source: string): Localized {
  switch (source) {
    case 'PATIENT':
      return { en: 'Self-reported', bn: 'নিজে রেকর্ড করা' };
    case 'CLINICAL_STAFF':
      return { en: 'Clinic-recorded', bn: 'ক্লিনিকে রেকর্ড করা' };
    case 'DEVICE':
      return { en: 'From device', bn: 'ডিভাইস থেকে' };
    default:
      return { en: source, bn: source };
  }
}

/** Localized label for a reading status; raw value when unknown. */
export function vitalStatusLabel(status: string): Localized {
  switch (status) {
    case 'RECORDED':
      return { en: 'Recorded', bn: 'রেকর্ডকৃত' };
    case 'AMENDED':
      return { en: 'Corrected', bn: 'সংশোধিত' };
    case 'OBSERVED_OUT_OF_RANGE':
      return { en: 'Out of range', bn: 'সীমার বাইরে' };
    default:
      return { en: status, bn: status };
  }
}

/** Localized out-of-range message. min/max/unit arrive preformatted so the
 *  caller can localize numerals. */
export function rangeErrorLabel(min: string, max: string, unitSym: string): Localized {
  const range = unitSym.length > 0 ? `${min}–${max} ${unitSym}` : `${min}–${max}`;
  return {
    en: `Outside the accepted range (${range}). Please check the value.`,
    bn: `গ্রহণযোগ্য সীমার (${range}) বাইরে। মানটি আবার দেখে নিন।`,
  };
}

/** "Showing latest N of M readings" footer when the history is truncated. */
export function showingLatestLabel(shown: string, total: string): Localized {
  return {
    en: `Showing the latest ${shown} of ${total} readings.`,
    bn: `মোট ${total}টি রিডিংয়ের মধ্যে সাম্প্রতিক ${shown}টি দেখানো হচ্ছে।`,
  };
}
