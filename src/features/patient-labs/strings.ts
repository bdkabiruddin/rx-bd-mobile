// Patient labs — feature-local bilingual strings ({ en, bn }). One
// language renders at a time (Wave 59 rule); never both side by side.

import type { Localized } from '@/i18n/types';

export const STR = {
  // Index — my lab orders
  myLabTests: { en: 'My lab tests', bn: 'আমার ল্যাব পরীক্ষা' },
  noLabOrders: {
    en: 'No lab tests yet',
    bn: 'এখনো কোনো ল্যাব পরীক্ষা নেই',
  },
  noLabOrdersHint: {
    en: 'Tests ordered by your doctor or diagnostic centre will appear here.',
    bn: 'আপনার চিকিৎসক বা ডায়াগনস্টিক সেন্টার পরীক্ষার অর্ডার দিলে তা এখানে দেখা যাবে।',
  },
  orderFallbackTitle: { en: 'Lab tests', bn: 'ল্যাব পরীক্ষা' },

  // Detail — order + results
  orderDetails: { en: 'Lab order', bn: 'ল্যাব অর্ডার' },
  orderNotFound: {
    en: 'Lab order not found',
    bn: 'ল্যাব অর্ডারটি পাওয়া যায়নি',
  },
  orderedOn: { en: 'Ordered on', bn: 'অর্ডারের তারিখ' },
  priority: { en: 'Priority', bn: 'অগ্রাধিকার' },
  notes: { en: 'Notes', bn: 'নোট' },
  results: { en: 'Results', bn: 'ফলাফল' },
  noResultsYet: {
    en: 'No results released yet',
    bn: 'এখনো কোনো ফলাফল প্রকাশিত হয়নি',
  },
  noResultsYetHint: {
    en: 'Only results released by the lab appear here. Check back once your report is ready.',
    bn: 'ল্যাব থেকে প্রকাশিত ফলাফলই কেবল এখানে দেখা যায়। রিপোর্ট তৈরি হলে আবার দেখুন।',
  },
  reportedOn: { en: 'Reported', bn: 'রিপোর্টের তারিখ' },
  releasedOn: { en: 'Released', bn: 'প্রকাশের তারিখ' },
  resultFallbackTitle: { en: 'Result', bn: 'ফলাফল' },
  refRange: { en: 'Ref. range', bn: 'স্বাভাবিক মাত্রা' },
  unsupportedFormat: {
    en: 'This report cannot be displayed in detail here. Please contact your diagnostic centre for the full report.',
    bn: 'এই রিপোর্টটি এখানে বিস্তারিত দেখানো যাচ্ছে না। সম্পূর্ণ রিপোর্টের জন্য আপনার ডায়াগনস্টিক সেন্টারে যোগাযোগ করুন।',
  },
} satisfies Record<string, Localized>;

/** Localized label for a lab-order status; raw value when unknown. */
export function orderStatusLabel(status: string | undefined): Localized {
  switch (status) {
    case 'PENDING':
      return { en: 'Ordered', bn: 'অর্ডার হয়েছে' };
    case 'IN_PROGRESS':
      return { en: 'In progress', bn: 'প্রক্রিয়াধীন' };
    case 'COMPLETED':
      return { en: 'Completed', bn: 'সম্পন্ন' };
    case 'CANCELLED':
      return { en: 'Cancelled', bn: 'বাতিল' };
    default:
      return { en: status ?? '—', bn: status ?? '—' };
  }
}

/** Localized label for a lab-result verification state. */
export function resultStatusLabel(status: string | undefined): Localized {
  switch (status) {
    case 'RELEASED':
      return { en: 'Released', bn: 'প্রকাশিত' };
    case 'PRELIMINARY':
      return { en: 'Preliminary', bn: 'প্রাথমিক' };
    default:
      return { en: status ?? '—', bn: status ?? '—' };
  }
}

/** Localized label for a lab-order priority; raw value when unknown. */
export function priorityLabel(priority: string | undefined): Localized {
  switch (priority) {
    case 'ROUTINE':
      return { en: 'Routine', bn: 'সাধারণ' };
    case 'URGENT':
      return { en: 'Urgent', bn: 'জরুরি' };
    case 'STAT':
      return { en: 'STAT — immediate', bn: 'স্ট্যাট — অতি জরুরি' };
    default:
      return { en: priority ?? '—', bn: priority ?? '—' };
  }
}

/** Localized label for a backend abnormality flag; raw when unknown. */
export function flagLabel(flag: string): Localized {
  switch (flag) {
    case 'normal':
      return { en: 'Normal', bn: 'স্বাভাবিক' };
    case 'low':
      return { en: 'Low', bn: 'কম' };
    case 'high':
      return { en: 'High', bn: 'বেশি' };
    case 'critical-low':
      return { en: 'Critically low', bn: 'বিপজ্জনক রকম কম' };
    case 'critical-high':
      return { en: 'Critically high', bn: 'বিপজ্জনক রকম বেশি' };
    case 'abnormal':
      return { en: 'Abnormal', bn: 'অস্বাভাবিক' };
    default:
      return { en: flag, bn: flag };
  }
}

/** "3 tests" / "৩টি পরীক্ষা" style count label. */
export function testCountLabel(count: number): Localized {
  return {
    en: count === 1 ? '1 test' : `${count} tests`,
    bn: `${count}টি পরীক্ষা`,
  };
}
