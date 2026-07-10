// Doctor chamber queue — feature-local bilingual strings.
// One language renders at a time (Wave 59 rule); resolved via useT().

import type { Localized } from '@/i18n/types';

import { formatNumber } from './logic';

export const DOCTOR_QUEUE_STRINGS = {
  title: { en: 'Chamber queue', bn: 'চেম্বারের সিরিয়াল' },
  chamber: { en: 'Chamber', bn: 'চেম্বার' },

  // Now-serving card
  nowServing: { en: 'Now serving', bn: 'এখন দেখা হচ্ছে' },
  noOneInConsult: {
    en: 'No patient is in consultation right now.',
    bn: 'এই মুহূর্তে কোনো রোগীর পরামর্শ চলছে না।',
  },
  inConsultation: { en: 'In consultation', bn: 'পরামর্শ চলছে' },
  prepNotes: { en: 'Assistant prep notes', bn: 'সহকারীর প্রস্তুতি নোট' },
  openChart: { en: 'Open patient chart', bn: 'রোগীর চার্ট খুলুন' },

  // Actions
  callNext: { en: 'Call next patient', bn: 'পরবর্তী রোগী ডাকুন' },
  complete: { en: 'Complete consult', bn: 'পরামর্শ সম্পন্ন' },
  noShow: { en: 'Mark no-show', bn: 'অনুপস্থিত চিহ্নিত করুন' },

  // Confirmations
  confirmCompleteTitle: {
    en: 'Complete this consultation?',
    bn: 'এই পরামর্শ সম্পন্ন করবেন?',
  },
  confirmCompleteBody: {
    en: 'The patient will be marked completed and leave the queue.',
    bn: 'রোগীকে সম্পন্ন হিসেবে চিহ্নিত করা হবে এবং তিনি সিরিয়াল থেকে বাদ পড়বেন।',
  },
  confirmNoShowTitle: {
    en: 'Mark as no-show?',
    bn: 'অনুপস্থিত হিসেবে চিহ্নিত করবেন?',
  },
  confirmNoShowBody: {
    en: 'Use this only if the patient did not appear after being called.',
    bn: 'ডাকার পরেও রোগী না এলে কেবল তখনই এটি ব্যবহার করুন।',
  },
  confirmCallTitle: {
    en: 'A patient is still in consultation',
    bn: 'একজন রোগীর পরামর্শ এখনো চলছে',
  },
  confirmCallBody: {
    en: 'Calling the next patient will not complete the current consultation. Continue?',
    bn: 'পরবর্তী রোগী ডাকলে বর্তমান পরামর্শ সম্পন্ন হবে না। চালিয়ে যাবেন?',
  },

  // Call-next outcomes
  callNextEmptyTitle: { en: 'No one to call', bn: 'ডাকার মতো কেউ নেই' },
  callNextEmptyBody: {
    en: 'No patient is ready for the doctor right now.',
    bn: 'এই মুহূর্তে কোনো রোগী ডাক্তারের জন্য প্রস্তুত নেই।',
  },

  // Next-up list
  nextUp: { en: 'Next up', bn: 'অপেক্ষমাণ তালিকা' },
  readyForDoctor: { en: 'Ready for doctor', bn: 'ডাক্তারের জন্য প্রস্তুত' },
  token: { en: 'Token', bn: 'টোকেন' },
  serial: { en: 'Serial', bn: 'সিরিয়াল' },
  checkedIn: { en: 'Checked in', bn: 'চেক-ইন' },
  walkIn: { en: 'Walk-in', bn: 'ওয়াক-ইন' },
  noneWaitingTitle: { en: 'No one waiting', bn: 'অপেক্ষায় কেউ নেই' },
  noneWaitingBody: {
    en: 'Patients appear here once the assistant marks them ready for you.',
    bn: 'সহকারী রোগীকে আপনার জন্য প্রস্তুত চিহ্নিত করলে তাঁদের এখানে দেখা যাবে।',
  },

  // Chamber / setup states
  noChamberTitle: { en: 'No active chamber', bn: 'কোনো সক্রিয় চেম্বার নেই' },
  noChamberBody: {
    en: 'Set up a chamber from the rx.bd web portal to run a live queue.',
    bn: 'লাইভ সিরিয়াল চালাতে rx.bd ওয়েব পোর্টাল থেকে একটি চেম্বার চালু করুন।',
  },

  // Freshness / staleness
  autoRefresh: {
    en: 'Updates automatically every 15 seconds.',
    bn: 'প্রতি ১৫ সেকেন্ডে স্বয়ংক্রিয়ভাবে হালনাগাদ হয়।',
  },
  staleNotice: {
    en: 'Connection problem — showing the queue as of',
    bn: 'সংযোগে সমস্যা — সিরিয়ালের সর্বশেষ জানা অবস্থা দেখানো হচ্ছে, সময়',
  },

  // Writes
  offlineWrite: {
    en: 'You are offline. Reconnect to make changes.',
    bn: 'আপনি অফলাইনে আছেন। পরিবর্তন করতে আবার সংযোগ করুন।',
  },

  // Priority pills (NORMAL renders no pill)
  priorityUrgent: { en: 'Urgent', bn: 'জরুরি' },
  priorityEmergency: { en: 'Emergency', bn: 'অতি জরুরি' },

  // Sign-in guard (defensive — the tab group already requires a session)
  needSession: {
    en: 'Sign in as a doctor to see your chamber queue.',
    bn: 'চেম্বারের সিরিয়াল দেখতে ডাক্তার হিসেবে সাইন ইন করুন।',
  },
} satisfies Record<string, Localized>;

/** Priority → localized label, or null when no pill should render. */
export function priorityLabel(
  priority: string | null | undefined,
): Localized | null {
  switch (priority) {
    case 'URGENT':
      return DOCTOR_QUEUE_STRINGS.priorityUrgent;
    case 'EMERGENCY':
      return DOCTOR_QUEUE_STRINGS.priorityEmergency;
    default:
      return null;
  }
}

/** Short waiting-time badge ("32m" / "৩২ মি"). */
export function waitShortLabel(minutes: number): Localized {
  return {
    en: `${formatNumber(minutes, 'en')}m`,
    bn: `${formatNumber(minutes, 'bn')} মি`,
  };
}

/** Now-serving status line; falls back to the plain label when the
 *  backend sent no usable start time. */
export function inConsultLabel(minutes: number | null): Localized {
  if (minutes === null) return DOCTOR_QUEUE_STRINGS.inConsultation;
  return {
    en: `In consultation · ${formatNumber(minutes, 'en')} min`,
    bn: `পরামর্শ চলছে · ${formatNumber(minutes, 'bn')} মিনিট`,
  };
}
