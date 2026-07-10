// Doctor lab orders + results inbox — feature-local bilingual strings
// ({ en, bn }). One language renders at a time (Wave 59 rule); never both
// side by side.

import type { Localized } from '@/i18n/types';

export const ORD_STR = {
  // ── Orders index ─────────────────────────────────────────────────────
  ordersTitle: { en: 'Lab orders', bn: 'ল্যাব অর্ডার' },
  myOrders: { en: 'My lab orders', bn: 'আমার ল্যাব অর্ডার' },
  newOrder: { en: 'New lab order', bn: 'নতুন ল্যাব অর্ডার' },
  noOrders: { en: 'No lab orders yet', bn: 'এখনো কোনো ল্যাব অর্ডার নেই' },
  noOrdersHint: {
    en: 'Lab orders you place will appear here.',
    bn: 'আপনি যে ল্যাব অর্ডার দেবেন তা এখানে দেখা যাবে।',
  },
  patientRef: { en: 'Patient ID', bn: 'রোগী আইডি' },
  orderedPrefix: { en: 'Ordered', bn: 'অর্ডার' },

  // Inbox link card on the index
  inboxLink: { en: 'Results inbox', bn: 'ফলাফল ইনবক্স' },
  inboxLinkHint: {
    en: 'Released results awaiting your review',
    bn: 'প্রকাশিত ফলাফল আপনার পর্যালোচনার অপেক্ষায়',
  },
  inboxAllReviewed: {
    en: 'No results waiting for review',
    bn: 'পর্যালোচনার জন্য কোনো ফলাফল অপেক্ষায় নেই',
  },
  inboxCountUnknown: {
    en: 'Could not check for new results',
    bn: 'নতুন ফলাফল যাচাই করা যায়নি',
  },

  // ── Results inbox ────────────────────────────────────────────────────
  inboxTitle: { en: 'Results inbox', bn: 'ফলাফল ইনবক্স' },
  inboxHint: {
    en: 'Results on orders you placed. Critical reports are listed first.',
    bn: 'আপনার দেওয়া অর্ডারের ফলাফল। গুরুতর রিপোর্ট আগে দেখানো হয়।',
  },
  inboxEmpty: { en: 'No results to review', bn: 'পর্যালোচনার কোনো ফলাফল নেই' },
  inboxEmptyHint: {
    en: 'New lab reports on your orders will appear here.',
    bn: 'আপনার অর্ডারের নতুন ল্যাব রিপোর্ট এখানে আসবে।',
  },
  critical: { en: 'Critical', bn: 'গুরুতর' },
  reportedPrefix: { en: 'Reported', bn: 'রিপোর্ট' },
  openResult: { en: 'Open result', bn: 'ফলাফল খুলুন' },
  selectResult: { en: 'Select a result', bn: 'একটি ফলাফল নির্বাচন করুন' },
  selectResultHint: {
    en: 'Choose a report from the list to review it.',
    bn: 'পর্যালোচনা করতে তালিকা থেকে একটি রিপোর্ট বেছে নিন।',
  },

  // ── Result detail ────────────────────────────────────────────────────
  resultTitle: { en: 'Lab result', bn: 'ল্যাব ফলাফল' },
  criticalBanner: {
    en: 'Critical value — review and act on this report immediately.',
    bn: 'গুরুতর মান — এই রিপোর্টটি এখনই পর্যালোচনা করে ব্যবস্থা নিন।',
  },
  testsLabel: { en: 'Tests', bn: 'পরীক্ষা' },
  valuesTitle: { en: 'Result values', bn: 'ফলাফলের মান' },
  rangeLabel: { en: 'Range', bn: 'রেফারেন্স সীমা' },
  orderNotes: { en: 'Clinical notes on the order', bn: 'অর্ডারের ক্লিনিক্যাল নোট' },
  unstructured: {
    en: 'This report cannot be displayed in the app',
    bn: 'এই রিপোর্টটি অ্যাপে দেখানো সম্ভব নয়',
  },
  unstructuredHint: {
    en: 'The result format is not supported here yet. Review it on the web portal.',
    bn: 'এই ফলাফলের ফরম্যাট এখনো এখানে সমর্থিত নয়। ওয়েব পোর্টালে দেখুন।',
  },
  resultNotFound: { en: 'Result not found', bn: 'ফলাফল পাওয়া যায়নি' },
  resultForbidden: {
    en: 'Only the ordering doctor can view this result.',
    bn: 'শুধুমাত্র অর্ডারকারী ডাক্তার এই ফলাফল দেখতে পারবেন।',
  },

  // Acknowledge flow
  ackStatusDone: { en: 'Acknowledged', bn: 'পর্যালোচিত' },
  ackStatusPending: { en: 'Awaiting review', bn: 'পর্যালোচনা বাকি' },
  ackButton: { en: 'Acknowledge result', bn: 'ফলাফল পর্যালোচিত নিশ্চিত করুন' },
  ackConfirmTitle: {
    en: 'Acknowledge this result?',
    bn: 'এই ফলাফলটি পর্যালোচিত হিসেবে চিহ্নিত করবেন?',
  },
  ackConfirmBody: {
    en: 'This records that you have reviewed this report. It will leave your inbox.',
    bn: 'এতে নথিভুক্ত হবে যে আপনি রিপোর্টটি পর্যালোচনা করেছেন। এটি আপনার ইনবক্স থেকে সরে যাবে।',
  },
  ackDone: { en: 'Result acknowledged', bn: 'ফলাফল পর্যালোচিত হয়েছে' },
  doctorNoteLabel: {
    en: 'Note for the patient (optional)',
    bn: 'রোগীর জন্য নোট (ঐচ্ছিক)',
  },
  doctorNoteHint: {
    en: 'Shared with the patient along with the report.',
    bn: 'রিপোর্টের সাথে রোগীকে জানানো হবে।',
  },
  yourNote: { en: 'Your note', bn: 'আপনার নোট' },

  // ── New order form ───────────────────────────────────────────────────
  newOrderTitle: { en: 'New lab order', bn: 'নতুন ল্যাব অর্ডার' },
  patientSection: { en: 'Patient', bn: 'রোগী' },
  searchPatientLabel: { en: 'Search by patient ID', bn: 'রোগী আইডি দিয়ে খুঁজুন' },
  searchPatientHint: {
    en: 'Searches only within your own patient panel.',
    bn: 'শুধু আপনার নিজের রোগী তালিকার মধ্যে খোঁজা হয়।',
  },
  noPatientsFound: { en: 'No matching patients', bn: 'কোনো মিল পাওয়া যায়নি' },
  noPatientsFoundHint: {
    en: 'Search matches patients in your panel by ID only.',
    bn: 'শুধু আপনার তালিকার রোগীদের আইডি দিয়ে খোঁজা যায়।',
  },
  lastVisit: { en: 'Last visit', bn: 'শেষ ভিজিট' },
  changePatient: { en: 'Change', bn: 'পরিবর্তন' },
  selectPatientFirst: {
    en: 'Select a patient to start the order.',
    bn: 'অর্ডার শুরু করতে একজন রোগী নির্বাচন করুন।',
  },

  testsSection: { en: 'Tests', bn: 'পরীক্ষা' },
  searchTestsLabel: { en: 'Search the test catalog', bn: 'পরীক্ষার তালিকায় খুঁজুন' },
  searchTestsHint: {
    en: 'e.g. CBC, HbA1c, RBS',
    bn: 'যেমন: CBC, HbA1c, RBS',
  },
  noTestsFound: { en: 'No matching tests', bn: 'কোনো পরীক্ষা পাওয়া যায়নি' },
  noTestsFoundHint: {
    en: 'Try a different name or code from the catalog.',
    bn: 'তালিকা থেকে অন্য নাম বা কোড দিয়ে চেষ্টা করুন।',
  },
  catalogUnavailable: {
    en: 'Could not load the test catalog',
    bn: 'পরীক্ষার তালিকা লোড করা যায়নি',
  },
  selectedTests: { en: 'Selected tests', bn: 'নির্বাচিত পরীক্ষা' },
  addTest: { en: 'Add', bn: 'যোগ করুন' },
  removeTest: { en: 'Remove', bn: 'বাদ দিন' },
  selectedPill: { en: 'Selected', bn: 'নির্বাচিত' },

  centreSection: { en: 'Diagnostic centre', bn: 'ডায়াগনস্টিক সেন্টার' },
  centreFilterLabel: { en: 'Filter centres', bn: 'সেন্টার খুঁজুন' },
  noCentres: { en: 'No active diagnostic centres', bn: 'কোনো সক্রিয় ডায়াগনস্টিক সেন্টার নেই' },
  noCentresHint: {
    en: 'An order needs an active centre. Contact your administrator.',
    bn: 'অর্ডার দিতে একটি সক্রিয় সেন্টার লাগবে। আপনার অ্যাডমিনিস্ট্রেটরের সাথে যোগাযোগ করুন।',
  },
  moreCentresHint: {
    en: 'More centres available — refine the filter.',
    bn: 'আরও সেন্টার আছে — খোঁজা আরও নির্দিষ্ট করুন।',
  },
  changeCentre: { en: 'Change', bn: 'পরিবর্তন' },

  prioritySection: { en: 'Priority', bn: 'অগ্রাধিকার' },
  notesLabel: { en: 'Clinical notes (optional)', bn: 'ক্লিনিক্যাল নোট (ঐচ্ছিক)' },
  notesHint: {
    en: 'Indication / context for the lab — visible to centre staff.',
    bn: 'পরীক্ষার কারণ / প্রসঙ্গ — সেন্টারের স্টাফ দেখতে পাবেন।',
  },

  placeOrder: { en: 'Place order', bn: 'অর্ডার দিন' },
  confirmOrderTitle: { en: 'Place this lab order?', bn: 'এই ল্যাব অর্ডারটি দেবেন?' },
  orderPlaced: { en: 'Lab order placed', bn: 'ল্যাব অর্ডার দেওয়া হয়েছে' },

  // Validation
  needTests: { en: 'Add at least one test.', bn: 'অন্তত একটি পরীক্ষা যোগ করুন।' },
  needCentre: {
    en: 'Select a diagnostic centre.',
    bn: 'একটি ডায়াগনস্টিক সেন্টার নির্বাচন করুন।',
  },
  needPatient: { en: 'Select a patient first.', bn: 'আগে একজন রোগী নির্বাচন করুন।' },
  notesTooLong: {
    en: 'Notes can be at most 2000 characters.',
    bn: 'নোট সর্বোচ্চ ২০০০ অক্ষরের হতে পারে।',
  },

  // Shared
  offlineWrite: {
    en: 'You are offline. Reconnect to make changes.',
    bn: 'আপনি অফলাইনে আছেন। পরিবর্তন করতে আবার সংযোগ করুন।',
  },
  back: { en: 'Back', bn: 'ফিরে যান' },
} satisfies Record<string, Localized>;

// ── Label helpers (unknown values pass through honestly) ─────────────────────

/** Lab order lifecycle label. */
export function orderStatusLabel(status: string | undefined): Localized {
  switch (status) {
    case 'PENDING':
      return { en: 'Pending', bn: 'অপেক্ষমাণ' };
    case 'IN_PROGRESS':
      return { en: 'In progress', bn: 'চলছে' };
    case 'COMPLETED':
      return { en: 'Completed', bn: 'সম্পন্ন' };
    case 'CANCELLED':
      return { en: 'Cancelled', bn: 'বাতিল' };
    default:
      return { en: status ?? '', bn: status ?? '' };
  }
}

/** Order priority label. */
export function priorityLabel(priority: string | undefined): Localized {
  switch (priority) {
    case 'ROUTINE':
      return { en: 'Routine', bn: 'সাধারণ' };
    case 'URGENT':
      return { en: 'Urgent', bn: 'জরুরি' };
    case 'STAT':
      return { en: 'STAT', bn: 'স্ট্যাট (অতি জরুরি)' };
    default:
      return { en: priority ?? '', bn: priority ?? '' };
  }
}

/** Abnormality flag / interpretation label (see logic.flagTone for the
 *  vocabulary union). Unknown non-empty flags pass through verbatim. */
export function flagLabel(flag: string): Localized {
  switch (flag) {
    case 'N':
    case 'normal':
      return { en: 'Normal', bn: 'স্বাভাবিক' };
    case 'H':
    case 'high':
      return { en: 'High', bn: 'উচ্চ' };
    case 'L':
    case 'low':
      return { en: 'Low', bn: 'নিম্ন' };
    case 'A':
    case 'abnormal':
      return { en: 'Abnormal', bn: 'অস্বাভাবিক' };
    case 'C-H':
    case 'critical-high':
      return { en: 'Critically high', bn: 'গুরুতর উচ্চ' };
    case 'C-L':
    case 'critical-low':
      return { en: 'Critically low', bn: 'গুরুতর নিম্ন' };
    default:
      return { en: flag, bn: flag };
  }
}

/** "N to review" pill/subtitle text (count pre-formatted with locale
 *  numerals by the caller). */
export function awaitingReviewLabel(countText: string): Localized {
  return {
    en: `${countText} to review`,
    bn: `${countText}টি পর্যালোচনা বাকি`,
  };
}
