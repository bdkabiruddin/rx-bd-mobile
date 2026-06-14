// Shared, app-wide bilingual strings. Per-feature screens keep their own
// tables co-located; this holds the cross-cutting shell copy.

import type { Localized } from './types';

export const COMMON = {
  appName: { en: 'rx.bd', bn: 'rx.bd' },
  loading: { en: 'Loading…', bn: 'লোড হচ্ছে…' },
  retry: { en: 'Retry', bn: 'আবার চেষ্টা করুন' },
  cancel: { en: 'Cancel', bn: 'বাতিল' },
  confirm: { en: 'Confirm', bn: 'নিশ্চিত করুন' },
  offline: { en: 'Offline', bn: 'অফলাইন' },
  pendingSync: { en: 'Pending sync', bn: 'সিঙ্ক বাকি' },
  signIn: { en: 'Sign in', bn: 'সাইন ইন' },
  signOut: { en: 'Sign out', bn: 'সাইন আউট' },
  unlock: { en: 'Unlock', bn: 'আনলক' },
  unlockPrompt: { en: 'Unlock rx.bd', bn: 'rx.bd আনলক করুন' },
  genericError: {
    en: 'Something went wrong. Please try again.',
    bn: 'কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।',
  },
  networkError: {
    en: 'No connection. Showing your last synced data.',
    bn: 'সংযোগ নেই। সর্বশেষ সিঙ্ক করা তথ্য দেখানো হচ্ছে।',
  },
  noData: { en: 'Nothing here yet.', bn: 'এখানে এখনো কিছু নেই।' },
  sessionExpired: {
    en: 'Your session expired. Please sign in again.',
    bn: 'আপনার সেশন শেষ হয়েছে। আবার সাইন ইন করুন।',
  },
} satisfies Record<string, Localized>;

export type CommonKey = keyof typeof COMMON;
