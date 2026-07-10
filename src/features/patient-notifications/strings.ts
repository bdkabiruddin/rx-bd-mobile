// Patient notifications — feature-local bilingual strings ({ en, bn }).
// One language renders at a time (Wave 59 rule); never both side by side.
// Bangla copy mirrors the web portal's notification-settings i18n table.

import type { Localized } from '@/i18n/types';

export const STR = {
  // Inbox
  inboxTitle: { en: 'Notifications', bn: 'নোটিফিকেশন' },
  preferences: { en: 'Preferences', bn: 'পছন্দসমূহ' },
  noNotifications: {
    en: 'No notifications yet',
    bn: 'এখনো কোনো নোটিফিকেশন নেই',
  },
  noNotificationsHint: {
    en: 'Updates about your appointments, medicines and results will appear here.',
    bn: 'আপনার অ্যাপয়েন্টমেন্ট, ওষুধ ও ফলাফলের আপডেট এখানে দেখা যাবে।',
  },
  newPill: { en: 'New', bn: 'নতুন' },
  criticalBanner: {
    en: 'You have critical alerts that need your attention.',
    bn: 'আপনার কিছু জরুরি সতর্কবার্তা রয়েছে — দয়া করে দেখুন।',
  },

  // Settings — shared
  settingsTitle: { en: 'Notification preferences', bn: 'নোটিফিকেশন পছন্দ' },
  saved: { en: 'Saved', bn: 'সংরক্ষিত হয়েছে' },
  couldNotSave: {
    en: 'Could not save — please try again.',
    bn: 'সংরক্ষণ করা যায়নি — আবার চেষ্টা করুন।',
  },
  offlineWrite: {
    en: 'You are offline. Reconnect to make changes.',
    bn: 'আপনি অফলাইনে আছেন। পরিবর্তন করতে আবার ইন্টারনেটে সংযোগ করুন।',
  },

  // Settings — digest mode (RT-313)
  digestHeading: { en: 'Email digest', bn: 'ইমেইল ডাইজেস্ট' },
  digestDesc: {
    en: 'Choose how email notifications are batched and delivered.',
    bn: 'নোটিফিকেশন কতক্ষণ পরপর একসাথে ইমেইলে পাঠানো হবে তা বেছে নিন।',
  },
  digestNote: {
    en: 'Daily and weekly digest delivery is planned for a future update.',
    bn: 'দৈনিক ও সাপ্তাহিক ডাইজেস্ট পরবর্তী আপডেটে চালু হবে।',
  },

  // Settings — quiet hours (RT-312)
  quietHeading: { en: 'Quiet hours', bn: 'নিরব সময়' },
  quietDesc: {
    en: 'SMS and push notifications are suppressed during this window. Critical lab alerts always bypass.',
    bn: 'এই সময়ে SMS ও পুশ নোটিফিকেশন স্থগিত থাকবে (জরুরি ক্লিনিক্যাল বিজ্ঞপ্তি বাদে)।',
  },
  quietFrom: { en: 'From (HH:MM)', bn: 'শুরু (HH:MM)' },
  quietTo: { en: 'To (HH:MM)', bn: 'শেষ (HH:MM)' },
  quietTimeHint: {
    en: '24-hour Dhaka time, e.g. 22:00',
    bn: '২৪ ঘণ্টার ঢাকা সময়, যেমন 22:00',
  },
  invalidTime: {
    en: 'Enter a valid time like 22:00.',
    bn: '22:00 এর মতো একটি সঠিক সময় লিখুন।',
  },
  suppressLabel: {
    en: 'Suppress non-critical notifications during quiet hours',
    bn: 'নিরব সময়ে অ-জরুরি নোটিফিকেশন বন্ধ রাখুন',
  },
  saveQuietHours: { en: 'Save quiet hours', bn: 'নিরব সময় সংরক্ষণ করুন' },
  quietSavedTitle: { en: 'Quiet hours updated', bn: 'নিরব সময় হালনাগাদ হয়েছে' },

  // Settings — event-type matrix (RT-311)
  matrixHeading: { en: 'Event type preferences', bn: 'বিজ্ঞপ্তির ধরন × চ্যানেল' },
  matrixDesc: {
    en: 'Choose which channels receive each event type.',
    bn: 'প্রতিটি বিজ্ঞপ্তির ধরনের জন্য চ্যানেল নির্বাচন করুন।',
  },
  matrixLockedNote: {
    en: 'Critical clinical alerts (e.g. dangerous lab values) are always shown in-app.',
    bn: 'জরুরি ক্লিনিক্যাল বিজ্ঞপ্তি (যেমন গুরুতর ল্যাব মান) সর্বদা ইন-অ্যাপে দেখানো হবে।',
  },
  alwaysOn: { en: 'Always on', bn: 'সর্বদা চালু' },

  // Settings — channel-wide opt-out registry (TCPA / GDPR Art. 21)
  optOutHeading: { en: 'Channel opt-out', bn: 'চ্যানেল অপ্ট-আউট' },
  optOutDesc: {
    en: 'Stop ALL notifications on a channel. This is recorded permanently and cannot be undone in the app — contact your care facility to re-enable.',
    bn: 'কোনো চ্যানেলের সব নোটিফিকেশন বন্ধ করুন। এটি স্থায়ীভাবে সংরক্ষিত হয় এবং অ্যাপ থেকে ফেরানো যায় না — আবার চালু করতে আপনার সেবাকেন্দ্রে যোগাযোগ করুন।',
  },
  optedOut: { en: 'Opted out', bn: 'অপ্ট-আউট করা আছে' },
  optOutAction: { en: 'Opt out', bn: 'অপ্ট-আউট করুন' },
  optOutConfirmTitle: { en: 'Opt out?', bn: 'অপ্ট-আউট করবেন?' },
  optOutDoneTitle: { en: 'Opt-out recorded', bn: 'অপ্ট-আউট সংরক্ষিত হয়েছে' },
} satisfies Record<string, Localized>;

/** Localized label for a notification type; humanized raw value when
 *  unknown (types are open strings on the server). */
export function typeLabel(normalizedType: string): Localized {
  switch (normalizedType) {
    case 'lab_result_critical':
      return { en: 'Critical lab result', bn: 'জরুরি ল্যাব ফলাফল' };
    case 'lab_result':
      return { en: 'Lab result', bn: 'ল্যাব ফলাফল' };
    case 'prescription_dispensed':
      return { en: 'Medicine dispensed', bn: 'ওষুধ বিতরণ হয়েছে' };
    case 'refill_ready':
      return { en: 'Refill ready', bn: 'রিফিল প্রস্তুত' };
    case 'appointment_reminder':
      return { en: 'Appointment', bn: 'অ্যাপয়েন্টমেন্ট' };
    case 'booking_confirmed':
      return { en: 'Booking confirmed', bn: 'বুকিং নিশ্চিত' };
    case 'billing_invoice':
      return { en: 'Billing', bn: 'বিল' };
    case 'message_received':
      return { en: 'Message', bn: 'বার্তা' };
    case 'marketing':
      return { en: 'Marketing', bn: 'মার্কেটিং' };
    case '':
      return { en: 'Notice', bn: 'বিজ্ঞপ্তি' };
    default: {
      const humanized = normalizedType.replace(/_/g, ' ');
      return { en: humanized, bn: humanized };
    }
  }
}

/** Localized label for a digest mode (mirrors the web copy). */
export function digestModeLabel(mode: string): Localized {
  switch (mode) {
    case 'REALTIME':
      return { en: 'Real-time', bn: 'তাৎক্ষণিক' };
    case 'DAILY':
      return { en: 'Daily digest', bn: 'দৈনিক ডাইজেস্ট' };
    case 'WEEKLY':
      return { en: 'Weekly digest', bn: 'সাপ্তাহিক ডাইজেস্ট' };
    case 'NEVER':
      return { en: 'Never', bn: 'ইমেইল নয়' };
    default:
      return { en: mode, bn: mode };
  }
}

/** Localized label for a delivery channel (mirrors the web copy). */
export function channelLabel(channel: string): Localized {
  switch (channel) {
    case 'SMS':
      return { en: 'SMS', bn: 'SMS' };
    case 'EMAIL':
      return { en: 'Email', bn: 'ইমেইল' };
    case 'PUSH':
      return { en: 'Push', bn: 'পুশ' };
    case 'IN_APP':
      return { en: 'In-app', bn: 'ইন-অ্যাপ' };
    default:
      return { en: channel, bn: channel };
  }
}

/** Localized label for an event type row (mirrors the web matrix). */
export function eventTypeLabel(eventType: string): Localized {
  switch (eventType) {
    case 'booking_confirmed':
      return { en: 'Appointment reminders', bn: 'অ্যাপয়েন্টমেন্ট রিমাইন্ডার' };
    case 'refill_ready':
      return { en: 'Refill ready', bn: 'রিফিল প্রস্তুত' };
    case 'lab_critical':
      return { en: 'Critical lab results', bn: 'জরুরি ল্যাব ফলাফল' };
    case 'billing_invoice':
      return { en: 'Billing & invoices', bn: 'বিল ও পেমেন্ট' };
    case 'marketing':
      return { en: 'Marketing', bn: 'মার্কেটিং' };
    default:
      return { en: eventType, bn: eventType };
  }
}

/** Localized label for an opt-out source. */
export function optOutSourceLabel(source: string | undefined): Localized {
  switch (source) {
    case 'USER_REQUEST':
      return { en: 'By your request', bn: 'আপনার অনুরোধে' };
    case 'STOP_KEYWORD':
      return { en: 'Via SMS STOP', bn: 'SMS-এ STOP পাঠিয়ে' };
    case 'ADMIN_OVERRIDE':
      return { en: 'By an administrator', bn: 'প্রশাসকের মাধ্যমে' };
    default:
      return { en: source ?? '—', bn: source ?? '—' };
  }
}

/** "N unread" caption for the inbox header. */
export function unreadCountLabel(count: number): Localized {
  return {
    en: count === 1 ? '1 unread' : `${count} unread`,
    bn: `${count}টি অপঠিত`,
  };
}

/** Confirmation body for the one-way channel opt-out. */
export function optOutConfirmMsg(channel: Localized): Localized {
  return {
    en: `You will stop receiving ALL ${channel.en} notifications. This cannot be undone in the app.`,
    bn: `আপনি ${channel.bn} চ্যানেলের সব নোটিফিকেশন পাওয়া বন্ধ করবেন। এটি অ্যাপ থেকে আর ফেরানো যাবে না।`,
  };
}

/** "Saved: <event> · <channel> on/off" inline confirmation. */
export function matrixSavedMsg(event: Localized, channel: Localized, optOut: boolean): Localized {
  return {
    en: `Saved: ${event.en} · ${channel.en} ${optOut ? 'off' : 'on'}`,
    bn: `সংরক্ষিত: ${event.bn} · ${channel.bn} ${optOut ? 'বন্ধ' : 'চালু'}`,
  };
}

/** "Email digest: <mode>" inline confirmation. */
export function digestSavedMsg(mode: Localized): Localized {
  return {
    en: `Email digest set to ${mode.en}`,
    bn: `ইমেইল ডাইজেস্ট: ${mode.bn}`,
  };
}

/** "22:00–07:00" window summary for the quiet-hours success alert. */
export function quietSavedMsg(start: string, end: string): Localized {
  return {
    en: `Notifications will be quiet ${start}–${end} (Dhaka time).`,
    bn: `${start}–${end} (ঢাকা সময়) পর্যন্ত নোটিফিকেশন নিরব থাকবে।`,
  };
}
