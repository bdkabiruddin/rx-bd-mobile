// Patient live queue position — feature-local bilingual strings.
// One language renders at a time (Wave 59 rule); resolved via useT().

import type { Localized } from '@/i18n/types';

export const QUEUE_STRINGS = {
  title: { en: 'Live queue', bn: 'লাইভ সিরিয়াল' },

  // Hero
  yourTurn: { en: "It's your turn now", bn: 'এখন আপনার পালা' },
  yourPosition: { en: 'Your position', bn: 'আপনার অবস্থান' },
  youAreNext: { en: "You're next", bn: 'এরপরই আপনার পালা' },
  positionUnavailable: {
    en: 'Your live position is unavailable right now.',
    bn: 'এই মুহূর্তে আপনার লাইভ অবস্থান পাওয়া যাচ্ছে না।',
  },

  // Info rows
  doctor: { en: 'Doctor', bn: 'ডাক্তার' },
  chamber: { en: 'Chamber', bn: 'চেম্বার' },
  token: { en: 'Token', bn: 'টোকেন' },
  serial: { en: 'Serial no.', bn: 'সিরিয়াল নম্বর' },
  checkedInAt: { en: 'Checked in', bn: 'চেক-ইনের সময়' },
  estWait: { en: 'Estimated wait', bn: 'আনুমানিক অপেক্ষা' },
  minutesShort: { en: 'min', bn: 'মিনিট' },

  // Stage labels (unknown stages fall back to the raw value)
  stageCheckedIn: { en: 'Checked in', bn: 'চেক-ইন হয়েছে' },
  stageAssistantPrep: { en: 'Preparation underway', bn: 'প্রস্তুতি চলছে' },
  stageDoctorReady: { en: 'Ready for the doctor', bn: 'ডাক্তারের জন্য প্রস্তুত' },
  stageInConsultation: { en: 'In consultation', bn: 'পরামর্শ চলছে' },

  // Priority labels (NORMAL renders no pill)
  priorityUrgent: { en: 'Urgent', bn: 'জরুরি' },
  priorityEmergency: { en: 'Emergency', bn: 'অতি জরুরি' },

  // Freshness / staleness
  autoRefresh: {
    en: 'Updates automatically every 20 seconds.',
    bn: 'প্রতি ২০ সেকেন্ডে স্বয়ংক্রিয়ভাবে হালনাগাদ হয়।',
  },
  staleNotice: {
    en: 'Connection problem — showing your last known position from',
    bn: 'সংযোগে সমস্যা — দেখানো হচ্ছে সর্বশেষ জানা অবস্থান, সময়',
  },

  // Not-in-queue empty state
  notInQueueTitle: {
    en: "You're not in a queue right now",
    bn: 'আপনি এখন কোনো সিরিয়ালে নেই',
  },
  notInQueueBody: {
    en: 'After you check in at the chamber front desk, your token and live position will appear here automatically.',
    bn: 'চেম্বারের ফ্রন্ট ডেস্কে চেক-ইন করার পর আপনার টোকেন ও লাইভ অবস্থান এখানে স্বয়ংক্রিয়ভাবে দেখা যাবে।',
  },
  goBack: { en: 'Go back', bn: 'ফিরে যান' },

  // Sign-in guard (defensive — the tab group already requires a session)
  needSession: {
    en: 'Sign in to see your live queue position.',
    bn: 'আপনার লাইভ সিরিয়াল অবস্থান দেখতে সাইন ইন করুন।',
  },

  // A11y
  a11yPosition: { en: 'Queue position', bn: 'সিরিয়ালে অবস্থান' },
  a11yAhead: { en: 'people ahead of you', bn: 'জন আপনার আগে আছেন' },
} satisfies Record<string, Localized>;

/** Stage → localized label; unknown/future stages surface the raw
 *  backend value instead of a guess. */
export function stageLabel(stage: string | undefined): Localized {
  switch (stage) {
    case 'CHECKED_IN':
      return QUEUE_STRINGS.stageCheckedIn;
    case 'ASSISTANT_PREP':
      return QUEUE_STRINGS.stageAssistantPrep;
    case 'DOCTOR_READY':
      return QUEUE_STRINGS.stageDoctorReady;
    case 'IN_CONSULTATION':
      return QUEUE_STRINGS.stageInConsultation;
    default: {
      const raw = stage ?? '';
      return { en: raw, bn: raw };
    }
  }
}

/** Priority → localized label, or null when no pill should render. */
export function priorityLabel(
  priority: string | null | undefined,
): Localized | null {
  switch (priority) {
    case 'URGENT':
      return QUEUE_STRINGS.priorityUrgent;
    case 'EMERGENCY':
      return QUEUE_STRINGS.priorityEmergency;
    default:
      return null;
  }
}
