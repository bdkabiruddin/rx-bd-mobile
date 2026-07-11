// Doctor patient search + summary — feature-local bilingual strings
// ({ en, bn }). One language renders at a time (Wave 59 rule); never both
// side by side.

import type { Localized } from '@/i18n/types';

export const DP_STR = {
  // Patients tab (search + panel list)
  patientsTitle: { en: 'Patients', bn: 'রোগী' },
  searchLabel: { en: 'Search by patient ID', bn: 'রোগীর আইডি দিয়ে খুঁজুন' },
  searchHint: {
    en: 'Matches only patients in your own panel — search is consent-gated.',
    bn: 'শুধু আপনার নিজের প্যানেলের রোগীদের মধ্যে খোঁজা হয় — খোঁজ সম্মতি-নিয়ন্ত্রিত।',
  },
  searchResults: { en: 'Search results', bn: 'খোঁজার ফলাফল' },
  myPatients: { en: 'My patients', bn: 'আমার রোগী' },
  noResults: { en: 'No matching patients', bn: 'মিলে যাওয়া কোনো রোগী নেই' },
  noResultsHint: {
    en: 'Only patients you have treated appear here. Check the ID and try again.',
    bn: 'শুধু আপনার চিকিৎসা নেওয়া রোগীরাই এখানে দেখা যান। আইডি মিলিয়ে আবার চেষ্টা করুন।',
  },
  emptyPanel: { en: 'No patients yet', bn: 'এখনো কোনো রোগী নেই' },
  emptyPanelHint: {
    en: 'Patients appear here after their first appointment or prescription with you.',
    bn: 'আপনার সঙ্গে প্রথম অ্যাপয়েন্টমেন্ট বা প্রেসক্রিপশনের পর রোগীরা এখানে দেখা যাবেন।',
  },
  patientRef: { en: 'Patient', bn: 'রোগী' },
  age: { en: 'Age', bn: 'বয়স' },
  lastVisit: { en: 'Last visit', bn: 'সর্বশেষ ভিজিট' },
  noVisitYet: { en: 'No visit recorded', bn: 'কোনো ভিজিট নথিভুক্ত নেই' },
  breakGlass: { en: 'Break-glass', bn: 'জরুরি প্রবেশাধিকার' },

  // Tablet detail pane placeholder
  selectPatient: { en: 'Select a patient', bn: 'একজন রোগী নির্বাচন করুন' },
  selectPatientHint: {
    en: 'Choose a patient from the list to see their summary.',
    bn: 'সারাংশ দেখতে তালিকা থেকে একজন রোগী বেছে নিন।',
  },

  // Summary screen
  summaryTitle: { en: 'Patient summary', bn: 'রোগীর সারাংশ' },
  notFound: { en: 'Patient not found', bn: 'রোগী পাওয়া যায়নি' },
  back: { en: 'Go back', bn: 'ফিরে যান' },

  // Locked / consent states (honest — never disguised as a generic error)
  sectionLocked: { en: 'Access locked', bn: 'প্রবেশাধিকার নেই' },
  sectionLockedHint: {
    en: 'The patient has not granted consent for this part of their record.',
    bn: 'রোগী তাঁর রেকর্ডের এই অংশ দেখার সম্মতি দেননি।',
  },
  // Per-section freshness (audit M7 — stale clinical data must not look current)
  sectionUpdated: { en: 'Updated', bn: 'হালনাগাদ' },
  sectionRefreshFailed: {
    en: "Couldn't refresh — showing saved data",
    bn: 'রিফ্রেশ করা যায়নি — সংরক্ষিত তথ্য দেখানো হচ্ছে',
  },
  recordLocked: {
    en: 'This patient record is restricted',
    bn: 'এই রোগীর রেকর্ডটি সীমাবদ্ধ',
  },
  recordLockedHint: {
    en: 'You are not currently authorized to view this chart. Ask the patient to grant treatment consent.',
    bn: 'বর্তমানে এই চার্ট দেখার অনুমতি আপনার নেই। রোগীকে চিকিৎসা-সম্মতি দেওয়ার অনুরোধ করুন।',
  },

  // Demographics header
  gender: { en: 'Gender', bn: 'লিঙ্গ' },
  bloodType: { en: 'Blood group', bn: 'রক্তের গ্রুপ' },
  deceasedNotice: {
    en: 'Deceased patient — new clinical entries are locked.',
    bn: 'মৃত রোগী — নতুন ক্লিনিক্যাল এন্ট্রি বন্ধ।',
  },

  // Allergies (clinical safety — first and prominent)
  allergies: { en: 'Allergies', bn: 'অ্যালার্জি' },
  noAllergiesRecorded: {
    en: 'No allergies recorded',
    bn: 'কোনো অ্যালার্জি নথিভুক্ত নেই',
  },
  noAllergiesHint: {
    en: 'No structured allergy record exists. This does not confirm the patient has no allergies.',
    bn: 'কোনো কাঠামোবদ্ধ অ্যালার্জি রেকর্ড নেই। এর মানে এই নয় যে রোগীর কোনো অ্যালার্জি নেই।',
  },
  freeTextAllergies: {
    en: 'Noted on profile',
    bn: 'প্রোফাইলে উল্লেখ আছে',
  },
  reaction: { en: 'Reaction', bn: 'প্রতিক্রিয়া' },

  // Conditions
  conditions: { en: 'Active conditions', bn: 'চলমান স্বাস্থ্য সমস্যা' },
  noConditions: {
    en: 'No active conditions recorded',
    bn: 'কোনো চলমান স্বাস্থ্য সমস্যা নথিভুক্ত নেই',
  },

  // Medications
  medications: { en: 'Current medications', bn: 'বর্তমান ওষুধ' },
  noMedications: {
    en: 'No current medications recorded',
    bn: 'কোনো চলমান ওষুধ নথিভুক্ত নেই',
  },
  medsNotedOnProfile: {
    en: 'Noted on profile',
    bn: 'প্রোফাইলে উল্লেখ আছে',
  },

  // Vitals
  vitals: { en: 'Recent vitals', bn: 'সাম্প্রতিক ভাইটাল' },
  noVitals: { en: 'No vitals recorded', bn: 'কোনো ভাইটাল নথিভুক্ত নেই' },

  // Prescriptions
  prescriptions: { en: 'Recent prescriptions', bn: 'সাম্প্রতিক প্রেসক্রিপশন' },
  noPrescriptions: {
    en: 'No prescriptions yet',
    bn: 'এখনো কোনো প্রেসক্রিপশন নেই',
  },

  // Lab orders
  labOrders: { en: 'Recent lab orders', bn: 'সাম্প্রতিক ল্যাব অর্ডার' },
  noLabOrders: { en: 'No lab orders yet', bn: 'এখনো কোনো ল্যাব অর্ডার নেই' },

  // Actions
  prescribe: { en: 'Prescribe', bn: 'প্রেসক্রিপশন লিখুন' },
  newLabOrder: { en: 'New lab order', bn: 'নতুন ল্যাব অর্ডার' },
} satisfies Record<string, Localized>;

// ─── Enum label tables (fallback: raw wire value, never fabricated) ─────────

export const ALLERGY_SEVERITY_LABELS: Record<string, Localized> = {
  MILD: { en: 'Mild', bn: 'মৃদু' },
  MODERATE: { en: 'Moderate', bn: 'মাঝারি' },
  SEVERE: { en: 'Severe', bn: 'তীব্র' },
  ANAPHYLAXIS: { en: 'Anaphylaxis', bn: 'অ্যানাফাইল্যাক্সিস' },
};

export const GENDER_LABELS: Record<string, Localized> = {
  male: { en: 'Male', bn: 'পুরুষ' },
  female: { en: 'Female', bn: 'নারী' },
  other: { en: 'Other', bn: 'অন্যান্য' },
  unknown: { en: 'Unknown', bn: 'অজানা' },
};

export const CONDITION_STATUS_LABELS: Record<string, Localized> = {
  ACTIVE: { en: 'Active', bn: 'চলমান' },
  IN_REMISSION: { en: 'In remission', bn: 'উপশমে' },
  RESOLVED: { en: 'Resolved', bn: 'নিরাময় হয়েছে' },
};

export const CONDITION_SEVERITY_LABELS: Record<string, Localized> = {
  MILD: { en: 'Mild', bn: 'মৃদু' },
  MODERATE: { en: 'Moderate', bn: 'মাঝারি' },
  SEVERE: { en: 'Severe', bn: 'তীব্র' },
};

export const MEDICATION_STATUS_LABELS: Record<string, Localized> = {
  ACTIVE: { en: 'Active', bn: 'চলমান' },
  PAUSED: { en: 'Paused', bn: 'স্থগিত' },
  DISCONTINUED: { en: 'Discontinued', bn: 'বন্ধ করা হয়েছে' },
};

export const PRESCRIPTION_STATUS_LABELS: Record<string, Localized> = {
  DRAFT: { en: 'Draft', bn: 'খসড়া' },
  ACTIVE: { en: 'Active', bn: 'চলমান' },
  EXPIRED: { en: 'Expired', bn: 'মেয়াদোত্তীর্ণ' },
  CANCELLED: { en: 'Cancelled', bn: 'বাতিল' },
  DISPENSED: { en: 'Dispensed', bn: 'বিতরণ হয়েছে' },
};

export const LAB_ORDER_STATUS_LABELS: Record<string, Localized> = {
  PENDING: { en: 'Pending', bn: 'অপেক্ষমাণ' },
  IN_PROGRESS: { en: 'In progress', bn: 'চলছে' },
  COMPLETED: { en: 'Completed', bn: 'সম্পন্ন' },
  CANCELLED: { en: 'Cancelled', bn: 'বাতিল' },
};

export const LAB_ORDER_PRIORITY_LABELS: Record<string, Localized> = {
  ROUTINE: { en: 'Routine', bn: 'সাধারণ' },
  URGENT: { en: 'Urgent', bn: 'জরুরি' },
  STAT: { en: 'STAT', bn: 'স্ট্যাট' },
};

export const VITAL_TYPE_LABELS: Record<string, Localized> = {
  BLOOD_PRESSURE: { en: 'Blood pressure', bn: 'রক্তচাপ' },
  HEART_RATE: { en: 'Heart rate', bn: 'হৃদস্পন্দন' },
  TEMPERATURE: { en: 'Temperature', bn: 'তাপমাত্রা' },
  BLOOD_GLUCOSE: { en: 'Blood glucose', bn: 'রক্তে গ্লুকোজ' },
  WEIGHT: { en: 'Weight', bn: 'ওজন' },
  HEIGHT: { en: 'Height', bn: 'উচ্চতা' },
  OXYGEN_SATURATION: { en: 'Oxygen saturation', bn: 'অক্সিজেন স্যাচুরেশন' },
  RESPIRATORY_RATE: { en: 'Respiratory rate', bn: 'শ্বাস-প্রশ্বাসের হার' },
  PAIN_SCORE: { en: 'Pain score', bn: 'ব্যথার মাত্রা' },
  GCS: { en: 'GCS', bn: 'জিসিএস' },
  MUAC: { en: 'MUAC', bn: 'মধ্য-বাহু পরিধি (MUAC)' },
  BMI: { en: 'BMI', bn: 'বিএমআই' },
};

/** Resolve a wire enum value to its Localized label; fall back to the raw
 *  value (honest — never invent a label for an unknown future variant). */
export function labelFor(
  table: Record<string, Localized>,
  key: string | undefined | null,
): Localized {
  const hit = key ? table[key] : undefined;
  if (hit) return hit;
  const raw = key ?? '—';
  return { en: raw, bn: raw };
}
