// Patient notifications — local wire types mirrored from the rx.bd backend.
//
// Sources (READ-ONLY mirrors; do not import backend code):
//   - GET /api/v1/notifications/me → ListMyNotificationsResult
//     (src/modules/notification/application/queries/
//     ListMyNotificationsHandler.ts — MyNotificationView rows, newest
//     first, plus unreadCount / unreadCritical).
//   - POST /api/v1/notifications/{id}/read → MarkNotificationReadResult
//     (MarkNotificationReadHandler.ts).
//   - GET /api/v1/me/notifications/preferences →
//     NotificationPreferenceResult (src/app/api/v1/me/notifications/
//     preferences/route.ts).
//   - PATCH /api/v1/me/notifications/digest-mode → DigestModeResult
//     (digest-mode/route.ts).
//   - PATCH /api/v1/me/notifications/quiet-hours → QuietHoursResult
//     (quiet-hours/route.ts).
//   - PATCH /api/v1/me/notifications/opt-out → EventTypeOptOutResult;
//     POST /api/v1/me/notifications/opt-out →
//     OptOutFromNotificationsResult (opt-out/route.ts +
//     src/modules/identity/application/commands/
//     OptOutFromNotificationsHandler.ts).
//   - GET /api/v1/me/notifications/opt-outs → ListMyOptOutsResult
//     (src/modules/identity/application/queries/ListMyOptOutsHandler.ts).
//
// Only fields this feature renders are declared; everything the server
// merely *may* send is marked optional/nullable defensively. Backend
// Date fields arrive as ISO strings over JSON.

/** Mirror of NotificationLevel (reference union; read-side fields stay
 *  plain strings so unknown future values degrade gracefully). */
export type NotificationLevel = 'ROUTINE' | 'CRITICAL';

/** One inbox row — mirror of MyNotificationView. `title`/`body` are
 *  stored single-language on the server (`/// @phi @encrypted`); there
 *  is no `{ en, bn }` pair to pick from, so they render as sent. */
export interface NotificationItem {
  id: string;
  type?: string;
  title?: string;
  body?: string;
  /** Legacy web link (older rows). */
  link?: string | null;
  /** RT-314 — in-app deep link; takes precedence over `link`. */
  deepLink?: string | null;
  level?: string;
  /** ISO timestamp; null while unread. */
  readAt?: string | null;
  /** ISO timestamp. */
  createdAt?: string;
}

/** Mirror of ListMyNotificationsResult. */
export interface InboxPayload {
  notifications?: NotificationItem[];
  /** Unread tally across ALL rows (not just the returned page). */
  unreadCount?: number;
  /** Unread CRITICAL rows (separate sub-list; may overlap the page). */
  unreadCritical?: NotificationItem[];
}

/** Mirror of MarkNotificationReadResult. */
export interface MarkReadResult {
  notificationId?: string;
  readAt?: string;
}

// ── Preferences ──────────────────────────────────────────────────────────────

export type DigestMode = 'REALTIME' | 'DAILY' | 'WEEKLY' | 'NEVER';

/** One opted-out cell of the event-type × channel matrix. */
export interface EventOptOutTuple {
  eventType: string;
  channel: string;
}

/** Mirror of NotificationPreferenceResult (defaults are served when no
 *  preference row exists yet). */
export interface NotificationPreferences {
  eventTypeOptOuts?: EventOptOutTuple[];
  /** "HH:mm" Asia/Dhaka. */
  quietHoursStart?: string;
  quietHoursEnd?: string;
  suppressNonCritical?: boolean;
  digestMode?: string;
}

/** Event types accepted by PATCH /me/notifications/opt-out (zod enum). */
export type EventTypeKey =
  | 'booking_confirmed'
  | 'refill_ready'
  | 'lab_critical'
  | 'billing_invoice'
  | 'marketing';

/** Channels accepted by the per-event-type matrix (zod enum). */
export type MatrixChannel = 'SMS' | 'EMAIL' | 'PUSH' | 'IN_APP';

/** PATCH /me/notifications/opt-out body. */
export interface EventOptOutBody {
  eventType: EventTypeKey;
  channel: MatrixChannel;
  optOut: boolean;
}

/** Mirror of EventTypeOptOutResult. */
export interface EventOptOutResult {
  updated?: boolean;
  eventType?: string;
  channel?: string;
  optOut?: boolean;
}

/** PATCH /me/notifications/quiet-hours body (strict "HH:mm", 2-digit). */
export interface QuietHoursBody {
  quietHoursStart: string;
  quietHoursEnd: string;
  suppressNonCritical: boolean;
}

/** Mirror of QuietHoursResult. */
export interface QuietHoursResult {
  updated?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  suppressNonCritical?: boolean;
}

/** PATCH /me/notifications/digest-mode body. */
export interface DigestModeBody {
  digestMode: DigestMode;
}

/** Mirror of DigestModeResult. */
export interface DigestModeResult {
  updated?: boolean;
  digestMode?: string;
}

// ── Channel-wide opt-out registry (TCPA / GDPR Art. 21) ─────────────────────

/** Channels accepted by POST /me/notifications/opt-out
 *  (optOutFromNotificationsSchema — note: no IN_APP here). */
export type OptOutChannel = 'SMS' | 'EMAIL' | 'PUSH';

/** POST /me/notifications/opt-out body. */
export interface ChannelOptOutBody {
  channel: OptOutChannel;
}

/** Mirror of OptOutFromNotificationsResult. The registry is append-only
 *  (Wave 53 design): there is NO self-service opt-in/restore endpoint. */
export interface ChannelOptOutResult {
  channel?: string;
  /** ISO timestamp. */
  optedOutAt?: string;
  /** False when the opt-out already existed (idempotent repeat). */
  isNew?: boolean;
}

/** One row of GET /me/notifications/opt-outs (mirror of MyOptOutView). */
export interface ChannelOptOutView {
  channel?: string;
  /** 'USER_REQUEST' | 'STOP_KEYWORD' | 'ADMIN_OVERRIDE' (open string). */
  source?: string;
  /** ISO timestamp. */
  optedOutAt?: string;
}

/** Mirror of ListMyOptOutsResult. */
export interface OptOutsPayload {
  optOuts?: ChannelOptOutView[];
}
