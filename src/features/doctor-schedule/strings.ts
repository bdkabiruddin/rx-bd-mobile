// Doctor Today + schedule — feature-local bilingual strings ({ en, bn }).
// One language renders at a time (Wave 59 rule); never both side by side.

import type { Localized } from '@/i18n/types';

export const SCHED_STR = {
  // Today (doctor landing)
  todayTitle: { en: 'Today', bn: 'আজ' },
  remainingToday: {
    en: 'Remaining appointments today',
    bn: 'আজকের বাকি অ্যাপয়েন্টমেন্ট',
  },
  freeDay: {
    en: 'No more appointments today',
    bn: 'আজ আর কোনো অ্যাপয়েন্টমেন্ট নেই',
  },
  freeDayHint: {
    en: 'Booked and confirmed visits that are still ahead will appear here.',
    bn: 'সামনে থাকা বুক করা ও নিশ্চিত ভিজিটগুলো এখানে দেখা যাবে।',
  },
  viewQueue: { en: 'View queue', bn: 'সিরিয়াল দেখুন' },
  myPatients: { en: 'My patients', bn: 'আমার রোগী' },
  manageSchedule: { en: 'Manage schedule', bn: 'শিডিউল ব্যবস্থাপনা' },
  patientRef: { en: 'Patient ID', bn: 'রোগী আইডি' },
  minutesSuffix: { en: 'min', bn: 'মিনিট' },

  // Schedule screen
  scheduleTitle: { en: 'My schedule', bn: 'আমার শিডিউল' },
  weeklyTemplate: { en: 'Weekly schedule', bn: 'সাপ্তাহিক শিডিউল' },
  weeklyTemplateHint: {
    en: 'Your published recurring chamber hours. Patients book within these windows.',
    bn: 'আপনার প্রকাশিত নিয়মিত চেম্বার সময়সূচি। রোগীরা এই সময়ের মধ্যেই অ্যাপয়েন্টমেন্ট নেন।',
  },
  noProfile: {
    en: 'No doctor profile yet',
    bn: 'এখনো কোনো ডাক্তার প্রোফাইল নেই',
  },
  noProfileHint: {
    en: 'Submit your doctor profile from the web portal first, then publish your schedule.',
    bn: 'আগে ওয়েব পোর্টাল থেকে আপনার ডাক্তার প্রোফাইল জমা দিন, তারপর শিডিউল প্রকাশ করুন।',
  },
  noSlots: {
    en: 'No published schedule',
    bn: 'কোনো প্রকাশিত শিডিউল নেই',
  },
  noSlotsHint: {
    en: 'Publish your weekly chamber hours from the web portal to accept bookings.',
    bn: 'বুকিং নিতে ওয়েব পোর্টাল থেকে আপনার সাপ্তাহিক চেম্বার সময় প্রকাশ করুন।',
  },
  allChambers: {
    en: 'All chambers / telemedicine',
    bn: 'সব চেম্বার / টেলিমেডিসিন',
  },
  chamberRef: { en: 'Chamber', bn: 'চেম্বার' },
  removeSlot: { en: 'Remove', bn: 'বাদ দিন' },
  removeSlotTitle: { en: 'Remove this slot?', bn: 'এই স্লটটি বাদ দেবেন?' },
  removeSlotBody: {
    en: 'The weekly window will be removed from your published schedule. Patients will no longer be able to book it.',
    bn: 'সাপ্তাহিক সময়টি আপনার প্রকাশিত শিডিউল থেকে বাদ যাবে। রোগীরা আর এই সময়ে বুক করতে পারবেন না।',
  },
  slotRemoved: { en: 'Slot removed', bn: 'স্লট বাদ দেওয়া হয়েছে' },

  // Block form
  blockSection: { en: 'Block time off', bn: 'সময় ব্লক করুন' },
  blockHint: {
    en: 'Away for a while? Blocking a range removes the affected weekly slots; republish when you are back.',
    bn: 'কিছুদিন থাকবেন না? একটি সময়সীমা ব্লক করলে সেই দিনের সাপ্তাহিক স্লটগুলো বাদ যায়; ফিরে এসে আবার প্রকাশ করবেন।',
  },
  blockFrom: { en: 'From', bn: 'শুরু' },
  blockTo: { en: 'To', bn: 'শেষ' },
  dateLabel: { en: 'Date (YYYY-MM-DD)', bn: 'তারিখ (YYYY-MM-DD)' },
  timeLabel: { en: 'Time (HH:MM)', bn: 'সময় (HH:MM)' },
  reasonLabel: { en: 'Reason (optional)', bn: 'কারণ (ঐচ্ছিক)' },
  reasonHint: {
    en: 'e.g. annual leave, conference',
    bn: 'যেমন: বার্ষিক ছুটি, কনফারেন্স',
  },
  applyBlock: { en: 'Apply block', bn: 'ব্লক প্রয়োগ করুন' },
  confirmBlockTitle: { en: 'Block this range?', bn: 'এই সময়সীমা ব্লক করবেন?' },
  confirmBlockBody: {
    en: 'Recurring weekly slots on the affected days will be removed from your published schedule.',
    bn: 'প্রভাবিত দিনগুলোর নিয়মিত সাপ্তাহিক স্লট আপনার প্রকাশিত শিডিউল থেকে বাদ যাবে।',
  },
  blockApplied: { en: 'Block applied', bn: 'ব্লক প্রয়োগ হয়েছে' },
  blockAppliedDetail: {
    en: 'Weekly slots removed',
    bn: 'যতগুলো সাপ্তাহিক স্লট বাদ গেছে',
  },

  // Block validation
  startInvalid: {
    en: 'Enter a valid start date and time (YYYY-MM-DD and HH:MM).',
    bn: 'সঠিক শুরুর তারিখ ও সময় লিখুন (YYYY-MM-DD এবং HH:MM)।',
  },
  endInvalid: {
    en: 'Enter a valid end date and time (YYYY-MM-DD and HH:MM).',
    bn: 'সঠিক শেষের তারিখ ও সময় লিখুন (YYYY-MM-DD এবং HH:MM)।',
  },
  endNotAfterStart: {
    en: 'The end must be after the start.',
    bn: 'শেষ সময় অবশ্যই শুরুর পরে হতে হবে।',
  },
  rangeTooLong: {
    en: 'A block can cover at most 90 days.',
    bn: 'একটি ব্লক সর্বোচ্চ ৯০ দিনের হতে পারে।',
  },
  reasonTooLong: {
    en: 'The reason can be at most 200 characters.',
    bn: 'কারণ সর্বোচ্চ ২০০ অক্ষরের হতে পারে।',
  },

  // Block history
  blockHistory: { en: 'Block history', bn: 'ব্লকের ইতিহাস' },
  noBlocks: { en: 'No blocks applied yet', bn: 'এখনো কোনো ব্লক প্রয়োগ হয়নি' },
  noBlocksHint: {
    en: 'Time you block off will be listed here.',
    bn: 'আপনি যে সময় ব্লক করবেন তা এখানে দেখা যাবে।',
  },
  blockRemovalUnsupported: {
    en: 'Applied blocks cannot be removed here yet — republish your weekly schedule to restore hours.',
    bn: 'প্রয়োগ করা ব্লক এখান থেকে এখনো মুছে ফেলা যায় না — সময় ফিরিয়ে আনতে সাপ্তাহিক শিডিউল আবার প্রকাশ করুন।',
  },

  // Shared
  offlineWrite: {
    en: 'You are offline. Reconnect to make changes.',
    bn: 'আপনি অফলাইনে আছেন। পরিবর্তন করতে আবার সংযোগ করুন।',
  },
  back: { en: 'Back', bn: 'ফিরে যান' },
} satisfies Record<string, Localized>;

/** "N slots removed" label for a block-history row (count pre-formatted
 *  with locale numerals by the caller). */
export function slotsRemovedLabel(countText: string): Localized {
  return {
    en: `${countText} slots removed`,
    bn: `${countText}টি স্লট বাদ`,
  };
}

/** Localized weekday label (backend DayOfWeek enum value). */
export function dayOfWeekLabel(day: string): Localized {
  switch (day) {
    case 'MONDAY':
      return { en: 'Monday', bn: 'সোমবার' };
    case 'TUESDAY':
      return { en: 'Tuesday', bn: 'মঙ্গলবার' };
    case 'WEDNESDAY':
      return { en: 'Wednesday', bn: 'বুধবার' };
    case 'THURSDAY':
      return { en: 'Thursday', bn: 'বৃহস্পতিবার' };
    case 'FRIDAY':
      return { en: 'Friday', bn: 'শুক্রবার' };
    case 'SATURDAY':
      return { en: 'Saturday', bn: 'শনিবার' };
    case 'SUNDAY':
      return { en: 'Sunday', bn: 'রবিবার' };
    default:
      return { en: day, bn: day };
  }
}

/** Localized appointment-status label; unknown values pass through. */
export function appointmentStatusLabel(status: string): Localized {
  switch (status) {
    case 'SCHEDULED':
      return { en: 'Scheduled', bn: 'নির্ধারিত' };
    case 'CONFIRMED':
      return { en: 'Confirmed', bn: 'নিশ্চিত' };
    case 'CHECKED_IN':
      return { en: 'Checked in', bn: 'চেক-ইন হয়েছে' };
    case 'IN_PROGRESS':
      return { en: 'In progress', bn: 'চলছে' };
    case 'COMPLETED':
      return { en: 'Completed', bn: 'সম্পন্ন' };
    case 'NO_SHOW':
      return { en: 'No show', bn: 'অনুপস্থিত' };
    case 'CANCELLED':
      return { en: 'Cancelled', bn: 'বাতিল' };
    default:
      return { en: status, bn: status };
  }
}

/** Localized appointment-type label; unknown values pass through. */
export function appointmentTypeLabel(type: string): Localized {
  switch (type) {
    case 'CONSULTATION':
      return { en: 'Consultation', bn: 'পরামর্শ' };
    case 'FOLLOW_UP':
      return { en: 'Follow-up', bn: 'ফলো-আপ' };
    case 'LAB_VISIT':
      return { en: 'Lab visit', bn: 'ল্যাব ভিজিট' };
    case 'PRESCRIPTION_REFILL':
      return { en: 'Prescription refill', bn: 'প্রেসক্রিপশন রিফিল' };
    case 'TELEMEDICINE':
      return { en: 'Telemedicine', bn: 'টেলিমেডিসিন' };
    case 'OTHER':
      return { en: 'Other', bn: 'অন্যান্য' };
    default:
      return { en: type, bn: type };
  }
}

/** Localized facility-type label; unknown values pass through. */
export function facilityTypeLabel(type: string): Localized {
  switch (type) {
    case 'HOSPITAL':
      return { en: 'Hospital', bn: 'হাসপাতাল' };
    case 'DIAGNOSTIC_CENTRE':
      return { en: 'Diagnostic centre', bn: 'ডায়াগনস্টিক সেন্টার' };
    case 'PHARMACY':
      return { en: 'Pharmacy', bn: 'ফার্মেসি' };
    case 'TELEMEDICINE':
      return { en: 'Telemedicine', bn: 'টেলিমেডিসিন' };
    default:
      return { en: type, bn: type };
  }
}
