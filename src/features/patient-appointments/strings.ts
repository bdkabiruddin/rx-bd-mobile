// Patient appointments — feature-local bilingual strings.
// One language renders at a time (Wave 59 rule); resolved via useT().

import type { Localized } from '@/i18n/types';

export const APPT_STRINGS = {
  // Screen titles
  appointments: { en: 'Appointments', bn: 'অ্যাপয়েন্টমেন্ট' },
  appointmentDetail: { en: 'Appointment details', bn: 'অ্যাপয়েন্টমেন্টের বিবরণ' },
  bookAppointment: { en: 'Book appointment', bn: 'অ্যাপয়েন্টমেন্ট বুক করুন' },

  // Segments
  upcoming: { en: 'Upcoming', bn: 'আসন্ন' },
  past: { en: 'Past', bn: 'পূর্ববর্তী' },
  noUpcoming: {
    en: 'No upcoming appointments',
    bn: 'কোনো আসন্ন অ্যাপয়েন্টমেন্ট নেই',
  },
  noPast: {
    en: 'No past appointments',
    bn: 'কোনো পূর্ববর্তী অ্যাপয়েন্টমেন্ট নেই',
  },
  bookFirstHint: {
    en: 'Book a visit with a doctor to get started.',
    bn: 'শুরু করতে একজন ডাক্তারের সাথে ভিজিট বুক করুন।',
  },

  // Detail fields
  dateTime: { en: 'Date & time', bn: 'তারিখ ও সময়' },
  duration: { en: 'Duration', bn: 'সময়কাল' },
  minutes: { en: 'minutes', bn: 'মিনিট' },
  visitType: { en: 'Visit type', bn: 'ভিজিটের ধরন' },
  doctor: { en: 'Doctor', bn: 'ডাক্তার' },
  chamber: { en: 'Chamber', bn: 'চেম্বার' },
  facility: { en: 'Facility', bn: 'সুবিধা কেন্দ্র' },
  reasonForVisit: { en: 'Reason for visit', bn: 'ভিজিটের কারণ' },
  notes: { en: 'Notes', bn: 'নোট' },
  status: { en: 'Status', bn: 'অবস্থা' },
  notFound: {
    en: 'This appointment could not be found.',
    bn: 'এই অ্যাপয়েন্টমেন্টটি খুঁজে পাওয়া যায়নি।',
  },

  // Cancel flow
  cancelAppointment: { en: 'Cancel appointment', bn: 'অ্যাপয়েন্টমেন্ট বাতিল করুন' },
  cancelReasonLabel: { en: 'Cancellation reason', bn: 'বাতিলের কারণ' },
  cancelReasonHint: {
    en: 'Required — at least 3 characters.',
    bn: 'আবশ্যক — কমপক্ষে ৩ অক্ষর।',
  },
  cancelConfirmTitle: { en: 'Cancel this appointment?', bn: 'অ্যাপয়েন্টমেন্টটি বাতিল করবেন?' },
  cancelConfirmBody: {
    en: 'This cannot be undone. You will need to book again.',
    bn: 'এটি আর ফেরানো যাবে না। আবার বুক করতে হবে।',
  },
  keepAppointment: { en: 'Keep appointment', bn: 'অ্যাপয়েন্টমেন্ট রাখুন' },
  cancelled: { en: 'Appointment cancelled.', bn: 'অ্যাপয়েন্টমেন্ট বাতিল হয়েছে।' },

  // Reschedule flow
  reschedule: { en: 'Reschedule', bn: 'সময় পরিবর্তন করুন' },
  rescheduleTitle: { en: 'Pick a new time', bn: 'নতুন সময় বেছে নিন' },
  rescheduleReasonLabel: { en: 'Reason for rescheduling', bn: 'সময় পরিবর্তনের কারণ' },
  rescheduleConfirmTitle: { en: 'Reschedule appointment?', bn: 'অ্যাপয়েন্টমেন্টের সময় পরিবর্তন করবেন?' },
  rescheduled: { en: 'Appointment rescheduled.', bn: 'অ্যাপয়েন্টমেন্টের সময় পরিবর্তন হয়েছে।' },
  noSlotsForDoctor: {
    en: 'No bookable times published for this doctor right now.',
    bn: 'এই ডাক্তারের জন্য এখন কোনো বুকিংযোগ্য সময় প্রকাশিত নেই।',
  },
  rescheduleNeedsDoctor: {
    en: 'This appointment has no assigned doctor, so times cannot be picked here. Please contact the facility.',
    bn: 'এই অ্যাপয়েন্টমেন্টে কোনো নির্ধারিত ডাক্তার নেই, তাই এখানে সময় বাছাই করা যাবে না। অনুগ্রহ করে কেন্দ্রের সাথে যোগাযোগ করুন।',
  },

  // Booking wizard
  stepOf: { en: 'Step', bn: 'ধাপ' },
  chooseSpecialty: { en: 'Choose a specialty', bn: 'বিশেষত্ব নির্বাচন করুন' },
  searchSpecialty: { en: 'Search specialties', bn: 'বিশেষত্ব খুঁজুন' },
  doctorsCount: { en: 'doctors', bn: 'জন ডাক্তার' },
  chooseDoctor: { en: 'Choose a doctor', bn: 'ডাক্তার নির্বাচন করুন' },
  noDoctors: {
    en: 'No doctors available for this specialty yet.',
    bn: 'এই বিশেষত্বে এখনো কোনো ডাক্তার নেই।',
  },
  yearsExperience: { en: 'years of experience', bn: 'বছরের অভিজ্ঞতা' },
  consultationFee: { en: 'Consultation fee', bn: 'পরামর্শ ফি' },
  chooseTime: { en: 'Pick a date & time', bn: 'তারিখ ও সময় বেছে নিন' },
  videoConsultation: { en: 'Video consultation', bn: 'ভিডিও পরামর্শ' },
  visitDetails: { en: 'Visit details', bn: 'ভিজিটের বিবরণ' },
  reasonHint: {
    en: 'Briefly describe the problem (required).',
    bn: 'সংক্ষেপে সমস্যাটি লিখুন (আবশ্যক)।',
  },
  confirmBooking: { en: 'Confirm booking', bn: 'বুকিং নিশ্চিত করুন' },
  // EN copy matches e2e/flows/02's exact-text assertion.
  bookingConfirmed: { en: 'Booking confirmed', bn: 'বুকিং নিশ্চিত হয়েছে।' },
  back: { en: 'Back', bn: 'পেছনে' },
  selectedTime: { en: 'Selected time', bn: 'নির্বাচিত সময়' },
  reasonTooShort: {
    en: 'Please write a longer reason.',
    bn: 'অনুগ্রহ করে কারণটি আরেকটু বিস্তারিত লিখুন।',
  },

  // Write-path errors
  // EN copy matches e2e/flows/02's exact-text assertion.
  offlineWrite: {
    en: 'Reconnect to make changes',
    bn: 'পরিবর্তন করতে আবার সংযুক্ত হোন',
  },
  slotTaken: {
    en: 'That time is no longer available. Please pick another slot.',
    bn: 'এই সময়টি আর খালি নেই। অনুগ্রহ করে অন্য একটি সময় বেছে নিন।',
  },
} satisfies Record<string, Localized>;

/** Appointment status labels (server enum → localized). */
export const STATUS_LABELS: Record<string, Localized> = {
  SCHEDULED: { en: 'Scheduled', bn: 'নির্ধারিত' },
  CONFIRMED: { en: 'Confirmed', bn: 'নিশ্চিত' },
  CHECKED_IN: { en: 'Checked in', bn: 'চেক-ইন হয়েছে' },
  IN_PROGRESS: { en: 'In progress', bn: 'চলছে' },
  COMPLETED: { en: 'Completed', bn: 'সম্পন্ন' },
  NO_SHOW: { en: 'No show', bn: 'অনুপস্থিত' },
  CANCELLED: { en: 'Cancelled', bn: 'বাতিল' },
};

/** Appointment type labels (server enum → localized). */
export const TYPE_LABELS: Record<string, Localized> = {
  CONSULTATION: { en: 'Consultation', bn: 'পরামর্শ' },
  FOLLOW_UP: { en: 'Follow-up', bn: 'ফলো-আপ' },
  LAB_VISIT: { en: 'Lab visit', bn: 'ল্যাব ভিজিট' },
  PRESCRIPTION_REFILL: { en: 'Prescription refill', bn: 'প্রেসক্রিপশন রিফিল' },
  TELEMEDICINE: { en: 'Telemedicine', bn: 'টেলিমেডিসিন' },
  OTHER: { en: 'Other', bn: 'অন্যান্য' },
};

/** Facility type labels (server enum → localized). */
export const FACILITY_LABELS: Record<string, Localized> = {
  HOSPITAL: { en: 'Hospital', bn: 'হাসপাতাল' },
  DIAGNOSTIC_CENTRE: { en: 'Diagnostic centre', bn: 'ডায়াগনস্টিক সেন্টার' },
  PHARMACY: { en: 'Pharmacy', bn: 'ফার্মেসি' },
  TELEMEDICINE: { en: 'Telemedicine', bn: 'টেলিমেডিসিন' },
};

/** Safe label lookup — falls back to the raw enum text (honest data). */
export function labelFor(
  table: Record<string, Localized>,
  key: string | undefined | null,
): Localized {
  const hit = key ? table[key] : undefined;
  if (hit) return hit;
  const raw = key ?? '—';
  return { en: raw, bn: raw };
}
