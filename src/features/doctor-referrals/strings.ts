// Doctor referrals + medical certificates — feature-local bilingual strings
// ({ en, bn }). One language renders at a time (Wave 59 rule); never both
// side by side.

import type { Localized } from '@/i18n/types';

export const REF_STR = {
  // ── Referrals list ─────────────────────────────────────────────────────
  referralsTitle: { en: 'Referrals', bn: 'রেফারেল' },
  referralsHint: {
    en: 'Referral letters you have issued.',
    bn: 'আপনার ইস্যু করা রেফারেল চিঠিগুলো।',
  },
  newReferral: { en: 'New referral', bn: 'নতুন রেফারেল' },
  noReferrals: { en: 'No referrals yet', bn: 'এখনো কোনো রেফারেল নেই' },
  noReferralsHint: {
    en: 'Referrals you issue will appear here.',
    bn: 'আপনি রেফারেল ইস্যু করলে তা এখানে দেখা যাবে।',
  },
  patientRef: { en: 'Patient', bn: 'রোগী' },
  issuedOn: { en: 'Issued', bn: 'ইস্যু' },
  validDays: { en: 'days valid', bn: 'দিন বৈধ' },

  // Cancel referral
  cancelReferral: { en: 'Cancel', bn: 'বাতিল করুন' },
  cancelReferralTitle: {
    en: 'Cancel this referral?',
    bn: 'এই রেফারেলটি বাতিল করবেন?',
  },
  cancelReferralBody: {
    en: 'The receiving side will no longer be able to act on it. This cannot be undone.',
    bn: 'গ্রহণকারী পক্ষ আর এটির ভিত্তিতে কিছু করতে পারবে না। এটি আর ফেরানো যাবে না।',
  },
  referralCancelled: { en: 'Referral cancelled', bn: 'রেফারেল বাতিল হয়েছে' },

  // ── New referral form ──────────────────────────────────────────────────
  newReferralTitle: { en: 'New referral', bn: 'নতুন রেফারেল' },
  referralTypeLabel: { en: 'Referral type', bn: 'রেফারেলের ধরন' },
  urgencyLabel: { en: 'Urgency', bn: 'জরুরি মাত্রা' },
  specialtyLabel: {
    en: 'Destination specialty (optional)',
    bn: 'গন্তব্য বিশেষত্ব (ঐচ্ছিক)',
  },
  specialtyHint: {
    en: 'e.g. Cardiology, Orthopaedics',
    bn: 'যেমন: কার্ডিওলজি, অর্থোপেডিকস',
  },
  reasonLabel: { en: 'Reason for referral', bn: 'রেফারেলের কারণ' },
  reasonHint: {
    en: 'The clinical indication — the receiving clinician will read this.',
    bn: 'ক্লিনিক্যাল কারণ — গ্রহণকারী চিকিৎসক এটি পড়বেন।',
  },
  contextLabel: {
    en: 'Clinical context (optional)',
    bn: 'ক্লিনিক্যাল প্রেক্ষাপট (ঐচ্ছিক)',
  },
  contextHint: {
    en: 'Relevant history, findings, current treatment.',
    bn: 'প্রাসঙ্গিক ইতিহাস, পরীক্ষার ফল, চলমান চিকিৎসা।',
  },
  validityLabel: {
    en: 'Valid for (days, optional)',
    bn: 'বৈধতার মেয়াদ (দিন, ঐচ্ছিক)',
  },
  validityHint: {
    en: '1–365. Left empty, the referral is valid 30 days.',
    bn: '১–৩৬৫। খালি রাখলে রেফারেল ৩০ দিন বৈধ থাকবে।',
  },
  issueReferral: { en: 'Issue referral', bn: 'রেফারেল ইস্যু করুন' },
  confirmReferralTitle: { en: 'Issue this referral?', bn: 'এই রেফারেলটি ইস্যু করবেন?' },
  confirmReferralBody: {
    en: 'A referral letter will be issued in your name and become visible to the patient and the receiving side.',
    bn: 'আপনার নামে একটি রেফারেল চিঠি ইস্যু হবে এবং রোগী ও গ্রহণকারী পক্ষ তা দেখতে পাবে।',
  },
  referralIssued: { en: 'Referral issued', bn: 'রেফারেল ইস্যু হয়েছে' },

  // Referral validation
  refPatientRequired: {
    en: 'Select the patient this referral is for.',
    bn: 'যে রোগীর জন্য রেফারেল, তাঁকে নির্বাচন করুন।',
  },
  refTypeInvalid: {
    en: 'Choose a referral type.',
    bn: 'রেফারেলের ধরন বেছে নিন।',
  },
  refUrgencyInvalid: {
    en: 'Choose an urgency level.',
    bn: 'জরুরি মাত্রা বেছে নিন।',
  },
  refReasonRequired: {
    en: 'The reason for referral is required.',
    bn: 'রেফারেলের কারণ লেখা আবশ্যক।',
  },
  refReasonTooLong: {
    en: 'The reason can be at most 5000 characters.',
    bn: 'কারণ সর্বোচ্চ ৫০০০ অক্ষরের হতে পারে।',
  },
  refSpecialtyTooLong: {
    en: 'The specialty can be at most 200 characters.',
    bn: 'বিশেষত্ব সর্বোচ্চ ২০০ অক্ষরের হতে পারে।',
  },
  refContextTooLong: {
    en: 'The clinical context can be at most 5000 characters.',
    bn: 'ক্লিনিক্যাল প্রেক্ষাপট সর্বোচ্চ ৫০০০ অক্ষরের হতে পারে।',
  },
  refValidityInvalid: {
    en: 'Validity must be a whole number of days between 1 and 365.',
    bn: 'বৈধতার মেয়াদ ১ থেকে ৩৬৫ দিনের মধ্যে একটি পূর্ণসংখ্যা হতে হবে।',
  },

  // ── Certificates list ──────────────────────────────────────────────────
  certificatesTitle: { en: 'Medical certificates', bn: 'মেডিকেল সার্টিফিকেট' },
  certificatesHint: {
    en: 'Certificates you have issued.',
    bn: 'আপনার ইস্যু করা সার্টিফিকেটগুলো।',
  },
  newCertificate: { en: 'New certificate', bn: 'নতুন সার্টিফিকেট' },
  noCertificates: { en: 'No certificates yet', bn: 'এখনো কোনো সার্টিফিকেট নেই' },
  noCertificatesHint: {
    en: 'Medical certificates you issue will appear here.',
    bn: 'আপনি সার্টিফিকেট ইস্যু করলে তা এখানে দেখা যাবে।',
  },

  // Cancel (revoke) certificate
  cancelCertificate: { en: 'Cancel', bn: 'বাতিল করুন' },
  cancelCertificateTitle: {
    en: 'Cancel this certificate?',
    bn: 'এই সার্টিফিকেটটি বাতিল করবেন?',
  },
  cancelCertificateBody: {
    en: 'The certificate will be revoked and marked invalid wherever it is verified. This cannot be undone.',
    bn: 'সার্টিফিকেটটি প্রত্যাহার হবে এবং যাচাইয়ের সময় অবৈধ হিসেবে দেখা যাবে। এটি আর ফেরানো যাবে না।',
  },
  certificateCancelled: {
    en: 'Certificate cancelled',
    bn: 'সার্টিফিকেট বাতিল হয়েছে',
  },

  // ── New certificate form ───────────────────────────────────────────────
  newCertificateTitle: { en: 'New medical certificate', bn: 'নতুন মেডিকেল সার্টিফিকেট' },
  certTypeLabel: { en: 'Certificate type', bn: 'সার্টিফিকেটের ধরন' },
  certFromLabel: { en: 'Valid from (YYYY-MM-DD)', bn: 'বৈধতা শুরু (YYYY-MM-DD)' },
  certUntilLabel: { en: 'Valid until (YYYY-MM-DD)', bn: 'বৈধতা শেষ (YYYY-MM-DD)' },
  certDatesHint: {
    en: 'Whole days, Dhaka time — the certificate covers both dates in full.',
    bn: 'পূর্ণ দিন, ঢাকার সময় — উভয় তারিখই সম্পূর্ণভাবে সার্টিফিকেটের আওতায় থাকবে।',
  },
  certReasonLabel: { en: 'Medical reason', bn: 'চিকিৎসাগত কারণ' },
  certReasonHint: {
    en: 'e.g. acute illness requiring rest.',
    bn: 'যেমন: তীব্র অসুস্থতা, বিশ্রাম প্রয়োজন।',
  },
  certRestrictionsLabel: {
    en: 'Restrictions / remarks (optional)',
    bn: 'বিধিনিষেধ / মন্তব্য (ঐচ্ছিক)',
  },
  certRestrictionsHint: {
    en: 'e.g. light duties only, no night shifts.',
    bn: 'যেমন: শুধু হালকা কাজ, রাতের শিফট নয়।',
  },
  issueCertificate: { en: 'Issue certificate', bn: 'সার্টিফিকেট ইস্যু করুন' },
  confirmCertificateTitle: {
    en: 'Issue this certificate?',
    bn: 'এই সার্টিফিকেটটি ইস্যু করবেন?',
  },
  confirmCertificateBody: {
    en: 'A medical certificate will be issued in your name. It is a medico-legal document the patient can share.',
    bn: 'আপনার নামে একটি মেডিকেল সার্টিফিকেট ইস্যু হবে। এটি একটি চিকিৎসা-আইনি নথি, যা রোগী অন্যদের দেখাতে পারবেন।',
  },
  certificateIssued: { en: 'Certificate issued', bn: 'সার্টিফিকেট ইস্যু হয়েছে' },

  // Certificate validation
  certPatientRequired: {
    en: 'Select the patient this certificate is for.',
    bn: 'যে রোগীর জন্য সার্টিফিকেট, তাঁকে নির্বাচন করুন।',
  },
  certTypeInvalid: {
    en: 'Choose a certificate type.',
    bn: 'সার্টিফিকেটের ধরন বেছে নিন।',
  },
  certFromInvalid: {
    en: 'Enter a valid start date (YYYY-MM-DD).',
    bn: 'সঠিক শুরুর তারিখ লিখুন (YYYY-MM-DD)।',
  },
  certUntilInvalid: {
    en: 'Enter a valid end date (YYYY-MM-DD).',
    bn: 'সঠিক শেষের তারিখ লিখুন (YYYY-MM-DD)।',
  },
  certUntilBeforeFrom: {
    en: 'The end date cannot be before the start date.',
    bn: 'শেষের তারিখ শুরুর তারিখের আগে হতে পারে না।',
  },
  certReasonRequired: {
    en: 'The medical reason is required.',
    bn: 'চিকিৎসাগত কারণ লেখা আবশ্যক।',
  },
  certReasonTooLong: {
    en: 'The reason can be at most 5000 characters.',
    bn: 'কারণ সর্বোচ্চ ৫০০০ অক্ষরের হতে পারে।',
  },
  certRestrictionsTooLong: {
    en: 'Restrictions can be at most 5000 characters.',
    bn: 'বিধিনিষেধ সর্বোচ্চ ৫০০০ অক্ষরের হতে পারে।',
  },

  // ── Patient picker (shared by both forms) ─────────────────────────────
  patientPickerLabel: { en: 'Patient', bn: 'রোগী' },
  patientSearchLabel: {
    en: 'Search by patient ID',
    bn: 'রোগীর আইডি দিয়ে খুঁজুন',
  },
  patientSearchHint: {
    en: 'Matches only patients in your own panel — search is consent-gated.',
    bn: 'শুধু আপনার নিজের প্যানেলের রোগীদের মধ্যে খোঁজা হয় — খোঁজ সম্মতি-নিয়ন্ত্রিত।',
  },
  patientSelected: { en: 'Selected patient', bn: 'নির্বাচিত রোগী' },
  changePatient: { en: 'Change', bn: 'পরিবর্তন করুন' },
  noPatientMatches: { en: 'No matching patients', bn: 'মিলে যাওয়া কোনো রোগী নেই' },
  noPatientMatchesHint: {
    en: 'Only patients you have treated appear here. Check the ID and try again.',
    bn: 'শুধু আপনার চিকিৎসা নেওয়া রোগীরাই এখানে দেখা যান। আইডি মিলিয়ে আবার চেষ্টা করুন।',
  },
  searchLocked: { en: 'Access locked', bn: 'প্রবেশাধিকার নেই' },
  searchLockedHint: {
    en: 'The consent gate denied this search.',
    bn: 'সম্মতি-নিয়ন্ত্রণ এই খোঁজার অনুমতি দেয়নি।',
  },
  age: { en: 'Age', bn: 'বয়স' },

  // ── Shared ─────────────────────────────────────────────────────────────
  offlineWrite: {
    en: 'You are offline. Reconnect to make changes.',
    bn: 'আপনি অফলাইনে আছেন। পরিবর্তন করতে আবার সংযোগ করুন।',
  },
  back: { en: 'Back', bn: 'ফিরে যান' },
} satisfies Record<string, Localized>;

// ─── Enum label tables (fallback: raw wire value, never fabricated) ─────────

export function referralTypeLabel(type: string | undefined): Localized {
  switch (type) {
    case 'SPECIALIST':
      return { en: 'Specialist', bn: 'বিশেষজ্ঞ' };
    case 'DIAGNOSTIC':
      return { en: 'Diagnostic', bn: 'ডায়াগনস্টিক' };
    case 'HOSPITAL_ADMISSION':
      return { en: 'Hospital admission', bn: 'হাসপাতালে ভর্তি' };
    case 'SECOND_OPINION':
      return { en: 'Second opinion', bn: 'দ্বিতীয় মতামত' };
    default: {
      const raw = type ?? '—';
      return { en: raw, bn: raw };
    }
  }
}

export function referralUrgencyLabel(urgency: string | undefined): Localized {
  switch (urgency) {
    case 'ROUTINE':
      return { en: 'Routine', bn: 'সাধারণ' };
    case 'URGENT':
      return { en: 'Urgent', bn: 'জরুরি' };
    case 'EMERGENT':
      return { en: 'Emergent', bn: 'অতি জরুরি' };
    default: {
      const raw = urgency ?? '—';
      return { en: raw, bn: raw };
    }
  }
}

export function referralStatusLabel(status: string | undefined): Localized {
  switch (status) {
    case 'ACTIVE':
      return { en: 'Active', bn: 'চলমান' };
    case 'ACCEPTED':
      return { en: 'Accepted', bn: 'গৃহীত' };
    case 'DECLINED':
      return { en: 'Declined', bn: 'প্রত্যাখ্যাত' };
    case 'REDIRECTED':
      return { en: 'Redirected', bn: 'অন্যত্র পাঠানো হয়েছে' };
    case 'COMPLETED':
      return { en: 'Completed', bn: 'সম্পন্ন' };
    case 'FULFILLED':
      return { en: 'Fulfilled', bn: 'সম্পন্ন (পুরনো ধারা)' };
    case 'EXPIRED':
      return { en: 'Expired', bn: 'মেয়াদোত্তীর্ণ' };
    case 'CANCELLED':
      return { en: 'Cancelled', bn: 'বাতিল' };
    default: {
      const raw = status ?? '—';
      return { en: raw, bn: raw };
    }
  }
}

export function certificateTypeLabel(type: string | undefined): Localized {
  switch (type) {
    case 'SICK_LEAVE':
      return { en: 'Sick leave', bn: 'অসুস্থতাজনিত ছুটি' };
    case 'FITNESS_TO_WORK':
      return { en: 'Fitness to work', bn: 'কাজের উপযুক্ততা' };
    case 'FITNESS_TO_FLY':
      return { en: 'Fitness to fly', bn: 'বিমানভ্রমণের উপযুক্ততা' };
    case 'FITNESS_TO_DRIVE':
      return { en: 'Fitness to drive', bn: 'গাড়ি চালানোর উপযুক্ততা' };
    case 'OTHER':
      return { en: 'Other', bn: 'অন্যান্য' };
    default: {
      const raw = type ?? '—';
      return { en: raw, bn: raw };
    }
  }
}

export function certificateStatusLabel(status: string | undefined): Localized {
  switch (status) {
    case 'ACTIVE':
      return { en: 'Active', bn: 'চলমান' };
    case 'REVOKED':
      return { en: 'Revoked', bn: 'প্রত্যাহৃত' };
    default: {
      const raw = status ?? '—';
      return { en: raw, bn: raw };
    }
  }
}
