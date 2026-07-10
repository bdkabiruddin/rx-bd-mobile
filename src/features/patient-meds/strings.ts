// Patient meds — feature-local bilingual strings ({ en, bn }). One
// language renders at a time (Wave 59 rule); never both side by side.

import type { Localized } from '@/i18n/types';

export const STR = {
  // Index
  myPrescriptions: { en: 'My prescriptions', bn: 'আমার প্রেসক্রিপশন' },
  currentMedications: { en: 'Current medications', bn: 'চলমান ওষুধ' },
  noPrescriptions: {
    en: 'No prescriptions yet',
    bn: 'এখনো কোনো প্রেসক্রিপশন নেই',
  },
  noPrescriptionsHint: {
    en: 'Prescriptions your doctor writes will appear here.',
    bn: 'আপনার চিকিৎসক প্রেসক্রিপশন লিখলে তা এখানে দেখা যাবে।',
  },
  noMedications: {
    en: 'No current medications',
    bn: 'কোনো চলমান ওষুধ নেই',
  },
  remindersEntry: { en: 'Medication reminders', bn: 'ওষুধের রিমাইন্ডার' },
  remindersEntryHint: {
    en: 'Set daily dose reminder times',
    bn: 'প্রতিদিনের ডোজের রিমাইন্ডারের সময় ঠিক করুন',
  },
  prescriptionFallbackTitle: { en: 'Prescription', bn: 'প্রেসক্রিপশন' },

  // Detail
  prescriptionDetails: {
    en: 'Prescription details',
    bn: 'প্রেসক্রিপশনের বিস্তারিত',
  },
  prescriptionNotFound: {
    en: 'Prescription not found',
    bn: 'প্রেসক্রিপশন পাওয়া যায়নি',
  },
  validUntil: { en: 'Valid until', bn: 'মেয়াদ' },
  refills: { en: 'Refills used', bn: 'ব্যবহৃত রিফিল' },
  prescriber: { en: 'Prescriber', bn: 'চিকিৎসক' },
  prescriberUnavailable: {
    en: 'Prescriber details unavailable',
    bn: 'চিকিৎসকের তথ্য পাওয়া যায়নি',
  },
  medicines: { en: 'Medicines', bn: 'ওষুধসমূহ' },
  dose: { en: 'Dose', bn: 'ডোজ' },
  frequency: { en: 'Frequency', bn: 'সেবনবিধি' },
  duration: { en: 'Duration', bn: 'সময়কাল' },
  route: { en: 'Route', bn: 'সেবনের পথ' },
  instructions: { en: 'Instructions', bn: 'নির্দেশনা' },
  diagnosisCodes: { en: 'Diagnosis codes', bn: 'রোগনির্ণয় কোড' },
  notes: { en: 'Notes', bn: 'নোট' },
  viewOriginal: {
    en: 'View original prescription',
    bn: 'মূল প্রেসক্রিপশন দেখুন',
  },
  amendedNote: {
    en: 'This is an amended version of an earlier prescription.',
    bn: 'এটি আগের একটি প্রেসক্রিপশনের সংশোধিত সংস্করণ।',
  },
  requestReorder: {
    en: 'Request a re-order',
    bn: 'পুনরায় প্রেসক্রিপশনের অনুরোধ করুন',
  },
  reorderRequested: { en: 'Re-order requested', bn: 'অনুরোধ পাঠানো হয়েছে' },
  reorderConfirmTitle: {
    en: 'Request a re-order?',
    bn: 'পুনরায় প্রেসক্রিপশনের অনুরোধ করবেন?',
  },
  reorderConfirmMsg: {
    en: 'Your doctor will be asked to write a new prescription with these medicines.',
    bn: 'আপনার চিকিৎসককে এই ওষুধগুলো দিয়ে নতুন প্রেসক্রিপশন লিখতে অনুরোধ করা হবে।',
  },
  reorderSentTitle: { en: 'Request sent', bn: 'অনুরোধ পাঠানো হয়েছে' },
  reorderSentMsg: {
    en: 'Your doctor will review this request.',
    bn: 'আপনার চিকিৎসক অনুরোধটি পর্যালোচনা করবেন।',
  },

  // Reminders
  remindersTitle: { en: 'Medication reminders', bn: 'ওষুধের রিমাইন্ডার' },
  noReminders: {
    en: 'No reminders yet',
    bn: 'এখনো কোনো রিমাইন্ডার নেই',
  },
  noRemindersHint: {
    en: 'Set a reminder below so you never miss a dose.',
    bn: 'কোনো ডোজ যেন বাদ না পড়ে, নিচে একটি রিমাইন্ডার সেট করুন।',
  },
  setReminder: { en: 'Set a reminder', bn: 'রিমাইন্ডার সেট করুন' },
  setReminderHint: {
    en: 'Saving again for the same prescription updates its reminder.',
    bn: 'একই প্রেসক্রিপশনের জন্য আবার সংরক্ষণ করলে রিমাইন্ডারটি হালনাগাদ হবে।',
  },
  choosePrescription: {
    en: 'Choose a prescription',
    bn: 'প্রেসক্রিপশন বাছাই করুন',
  },
  noPrescriptionToRemind: {
    en: 'You need a prescription before you can set a reminder.',
    bn: 'রিমাইন্ডার সেট করতে আগে একটি প্রেসক্রিপশন থাকতে হবে।',
  },
  medicineName: { en: 'Medicine name', bn: 'ওষুধের নাম' },
  medicineNameHint: {
    en: 'Shown on the reminder, e.g. Napa 500 mg',
    bn: 'রিমাইন্ডারে দেখানো হবে, যেমন নাপা ৫০০ মি.গ্রা.',
  },
  reminderTimes: { en: 'Reminder times', bn: 'রিমাইন্ডারের সময়' },
  timeHint: {
    en: '24-hour HH:MM, e.g. 08:00 — up to 8 times',
    bn: '২৪ ঘণ্টার HH:MM ফরম্যাটে, যেমন 08:00 — সর্বোচ্চ ৮টি সময়',
  },
  addTime: { en: 'Add time', bn: 'সময় যোগ করুন' },
  invalidTime: {
    en: 'Enter a valid time like 08:00.',
    bn: '08:00 এর মতো একটি সঠিক সময় লিখুন।',
  },
  pickPrescriptionFirst: {
    en: 'Choose a prescription first.',
    bn: 'আগে একটি প্রেসক্রিপশন বাছাই করুন।',
  },
  labelRequired: {
    en: 'Enter the medicine name.',
    bn: 'ওষুধের নাম লিখুন।',
  },
  timesRequired: {
    en: 'Add at least one reminder time.',
    bn: 'অন্তত একটি রিমাইন্ডারের সময় যোগ করুন।',
  },
  alsoPush: {
    en: 'Also send push notifications',
    bn: 'পুশ নোটিফিকেশনও পাঠান',
  },
  saveReminder: { en: 'Save reminder', bn: 'রিমাইন্ডার সংরক্ষণ করুন' },
  reminderSavedTitle: { en: 'Reminder saved', bn: 'রিমাইন্ডার সংরক্ষিত হয়েছে' },
  pause: { en: 'Pause', bn: 'বিরতি দিন' },
  resume: { en: 'Resume', bn: 'চালু করুন' },
  deleteReminder: { en: 'Delete', bn: 'মুছে ফেলুন' },
  deleteConfirmTitle: { en: 'Delete reminder?', bn: 'রিমাইন্ডার মুছবেন?' },
  deleteConfirmMsg: {
    en: 'This medication reminder will be removed.',
    bn: 'এই ওষুধের রিমাইন্ডারটি মুছে যাবে।',
  },
  reminderRowIncomplete: {
    en: 'This reminder is missing its schedule and cannot be changed.',
    bn: 'এই রিমাইন্ডারের সময়সূচি না থাকায় এটি পরিবর্তন করা যাচ্ছে না।',
  },

  // Shared write feedback
  offlineWrite: {
    en: 'You are offline. Reconnect to make changes.',
    bn: 'আপনি অফলাইনে আছেন। পরিবর্তন করতে আবার ইন্টারনেটে সংযোগ করুন।',
  },
} satisfies Record<string, Localized>;

/** Localized label for a prescription status; raw value when unknown. */
export function prescriptionStatusLabel(status: string | undefined): Localized {
  switch (status) {
    case 'ACTIVE':
      return { en: 'Active', bn: 'চলমান' };
    case 'DISPENSED':
      return { en: 'Dispensed', bn: 'বিতরণ হয়েছে' };
    case 'EXPIRED':
      return { en: 'Expired', bn: 'মেয়াদোত্তীর্ণ' };
    case 'CANCELLED':
      return { en: 'Cancelled', bn: 'বাতিল' };
    case 'DRAFT':
      return { en: 'Draft', bn: 'খসড়া' };
    default:
      return { en: status ?? '—', bn: status ?? '—' };
  }
}

/** Localized label for a medication status; raw value when unknown. */
export function medicationStatusLabel(status: string | undefined): Localized {
  switch (status) {
    case 'ACTIVE':
      return { en: 'Taking', bn: 'চলছে' };
    case 'PAUSED':
      return { en: 'Paused', bn: 'বিরতিতে' };
    case 'DISCONTINUED':
      return { en: 'Stopped', bn: 'বন্ধ' };
    default:
      return { en: status ?? '—', bn: status ?? '—' };
  }
}

/** Localized label for a reminder status; raw value when unknown. */
export function reminderStatusLabel(status: string | undefined): Localized {
  switch (status) {
    case 'ACTIVE':
      return { en: 'On', bn: 'চালু' };
    case 'PAUSED':
      return { en: 'Paused', bn: 'বিরতিতে' };
    case 'CANCELLED':
      return { en: 'Cancelled', bn: 'বাতিল' };
    default:
      return { en: status ?? '—', bn: status ?? '—' };
  }
}

/** "3 medicines" / "৩টি ওষুধ" style count label. */
export function medicineCountLabel(count: number): Localized {
  return {
    en: count === 1 ? '1 medicine' : `${count} medicines`,
    bn: `${count}টি ওষুধ`,
  };
}

/** "Refills 1/3" style label. */
export function refillsLabel(used: number, allowed: number): Localized {
  return {
    en: `Refills ${used}/${allowed}`,
    bn: `রিফিল ${used}/${allowed}`,
  };
}

/** "N days" duration label. */
export function daysLabel(days: number): Localized {
  return { en: days === 1 ? '1 day' : `${days} days`, bn: `${days} দিন` };
}

/** Accessibility label for removing a reminder time chip. */
export function removeTimeLabel(time: string): Localized {
  return { en: `Remove ${time}`, bn: `${time} সময়টি বাদ দিন` };
}
