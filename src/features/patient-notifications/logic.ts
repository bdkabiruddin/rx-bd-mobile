// Patient notifications — pure presentation/mapping logic. No React, no
// React Native imports: this module is unit-tested in a Node jest
// environment (__tests__/patient-notifications.test.ts).

import type { EventOptOutTuple, NotificationItem } from './types';

/** Same literal union as src/ui/StatusPill's StatusTone — duplicated so
 *  this module stays free of react-native imports. */
export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

/** Canonicalize an open-string notification type for matching: producers
 *  use mixed casings ('MESSAGE_RECEIVED', 'appointment_reminder', …). */
export function normalizeType(type: string | undefined): string {
  return (type ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

/**
 * Notification row → pill tone. CRITICAL level always wins (locked
 * danger treatment); otherwise a small known-type map; unknown types
 * stay neutral.
 */
export function notificationTone(level: string | undefined, type: string | undefined): Tone {
  if (level === 'CRITICAL') return 'danger';
  switch (normalizeType(type)) {
    case 'lab_result_critical':
      return 'danger';
    case 'prescription_dispensed':
    case 'refill_ready':
      return 'success';
    case 'appointment_reminder':
    case 'booking_confirmed':
      return 'info';
    case 'billing_invoice':
      return 'warning';
    default:
      return 'neutral';
  }
}

/**
 * Map a backend web deep-link (e.g. '/dashboard/patient/prescriptions/{id}',
 * produced by RT-314 crons) onto a patient-persona mobile route. Only
 * routes that exist in the app are mapped; anything else returns null and
 * the row tap just marks the notification read (honest no-op — never
 * navigate somewhere that doesn't exist).
 */
export function mapDeepLinkToRoute(
  deepLink: string | null | undefined,
  link: string | null | undefined,
): string | null {
  // deepLink takes precedence over the legacy `link` (RT-314 contract).
  const raw = (deepLink ?? link ?? '').trim();
  if (!raw.startsWith('/')) return null;

  const segments = raw.split('?')[0]?.split('/').filter(Boolean) ?? [];
  // Expected web shape: dashboard / patient / <section> / <id?>
  if (segments[0] !== 'dashboard' || segments[1] !== 'patient') return null;

  const section = segments[2];
  const id = segments[3];

  switch (section) {
    case 'prescriptions':
      return id ? `/(patient)/meds/${id}` : '/(patient)/meds';
    case 'appointments':
      return id ? `/(patient)/appointments/${id}` : '/(patient)/appointments';
    case 'labs':
    case 'lab-results':
      return id ? `/(patient)/labs/${id}` : '/(patient)/labs';
    case 'vitals':
      return '/(patient)/vitals';
    case 'queue':
      return '/(patient)/queue';
    default:
      return null;
  }
}

/** Defensive newest-first ordering (server already returns desc; keep the
 *  UI deterministic even if a cached page interleaves). Missing dates sink
 *  to the bottom. Non-mutating. */
export function sortNewestFirst(items: NotificationItem[]): NotificationItem[] {
  return [...items].sort((a, b) => {
    const ta = a.createdAt ? Date.parse(a.createdAt) : Number.NaN;
    const tb = b.createdAt ? Date.parse(b.createdAt) : Number.NaN;
    const va = Number.isNaN(ta) ? -Infinity : ta;
    const vb = Number.isNaN(tb) ? -Infinity : tb;
    return vb - va;
  });
}

/** True when the notification has not been read yet. */
export function isUnread(item: NotificationItem): boolean {
  return item.readAt === null || item.readAt === undefined;
}

// ── Event-type × channel matrix ──────────────────────────────────────────────

/** True when the given cell is currently opted OUT (i.e. toggle is off). */
export function isCellOptedOut(
  optOuts: EventOptOutTuple[] | undefined,
  eventType: string,
  channel: string,
): boolean {
  return (optOuts ?? []).some((o) => o.eventType === eventType && o.channel === channel);
}

/** Pure add/remove of a matrix cell — mirrors the backend upsert logic
 *  (idempotent: adding an existing tuple or removing a missing one is a
 *  no-op). Non-mutating. */
export function toggleTuple(
  optOuts: EventOptOutTuple[] | undefined,
  eventType: string,
  channel: string,
  optOut: boolean,
): EventOptOutTuple[] {
  const current = optOuts ?? [];
  if (optOut) {
    return isCellOptedOut(current, eventType, channel)
      ? [...current]
      : [...current, { eventType, channel }];
  }
  return current.filter((o) => !(o.eventType === eventType && o.channel === channel));
}

/** lab_critical × IN_APP is locked always-on — clinical safety (mirrors
 *  the web EventTypeMatrix): critical lab values bypass all opt-outs. */
export function isCellLocked(eventType: string, channel: string): boolean {
  return eventType === 'lab_critical' && channel === 'IN_APP';
}

// ── Quiet hours ──────────────────────────────────────────────────────────────

/**
 * Normalize a user-typed time to the backend's strict "HH:mm" shape
 * (2-digit hours — the quiet-hours zod regex is ^\d{2}:\d{2}$, stricter
 * than the reminders route). Returns null when not a valid time.
 */
export function normalizeQuietTime(raw: string): string | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(raw.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

// ── Channel-wide opt-out registry ────────────────────────────────────────────

/** True when the subject is already opted out of the given channel. */
export function isChannelOptedOut(
  optOuts: { channel?: string }[] | undefined,
  channel: string,
): boolean {
  return (optOuts ?? []).some((o) => o.channel === channel);
}
