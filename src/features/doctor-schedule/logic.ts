// Doctor Today + schedule — pure presentation/domain logic.
//
// Deliberately free of React/React Native imports so the whole module is
// unit-testable in the fast Node jest environment (see
// __tests__/doctor-schedule.test.ts).

import type { Language } from '@/i18n/types';

import type {
  BlockScheduleBody,
  DoctorUpcomingAppointment,
  MyScheduleSlot,
  PublishScheduleBody,
} from './types';

// ── Status → StatusPill tone ────────────────────────────────────────────

/** Mirrors src/ui/StatusPill's StatusTone union (kept as literals here so
 *  this module never imports React Native). Same mapping the patient
 *  appointments feature uses — one visual language across personas. */
export type ScheduleTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export function appointmentStatusTone(status: string): ScheduleTone {
  switch (status) {
    case 'SCHEDULED':
    case 'CHECKED_IN':
      return 'info';
    case 'CONFIRMED':
      return 'success';
    case 'IN_PROGRESS':
    case 'NO_SHOW':
      return 'warning';
    case 'CANCELLED':
      return 'danger';
    case 'COMPLETED':
    default:
      return 'neutral';
  }
}

// ── Dhaka day / time math ───────────────────────────────────────────────
//
// Bangladesh is UTC+6 with no DST, so fixed-offset conversion is exact —
// the same convention the backend's Dhaka-weekday expansion uses.

export const DHAKA_UTC_OFFSET_MS = 6 * 60 * 60 * 1000;

/** Dhaka-local YYYY-MM-DD for an epoch-ms instant. */
export function dhakaDayKeyOfMs(ms: number): string {
  const d = new Date(ms + DHAKA_UTC_OFFSET_MS);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

/** Dhaka-local YYYY-MM-DD for an ISO timestamp; null when unparseable. */
export function dhakaDayKey(iso: string): string | null {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return dhakaDayKeyOfMs(ms);
}

/** Dhaka-local minute-of-day (0..1439) for an ISO timestamp; null when
 *  unparseable. */
export function dhakaMinuteOfDay(iso: string): number | null {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  const d = new Date(ms + DHAKA_UTC_OFFSET_MS);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/** Minute-of-day (Dhaka local) → localized clock label, e.g. "09:30".
 *  Same convention as the patient appointments slot picker. */
export function formatMinuteOfDay(minuteOfDay: number, lang: Language): string {
  const h = Math.floor(minuteOfDay / 60) % 24;
  const m = minuteOfDay % 60;
  return new Date(Date.UTC(2000, 0, 1, h, m)).toLocaleTimeString(
    lang === 'bn' ? 'bn-BD' : 'en-GB',
    { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' },
  );
}

/** Locale-aware plain number (Bangla numerals for bn). */
export function formatNumber(value: number, lang: Language): string {
  return value.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-GB');
}

// ── Today filter (doctor landing) ───────────────────────────────────────

/** Appointments falling on TODAY (Dhaka calendar day of `nowMs`), sorted
 *  by scheduledAt ASC. The upcoming endpoint already restricts to
 *  future-dated SCHEDULED/CONFIRMED rows, so this is "remaining today". */
export function filterTodays<T extends Pick<DoctorUpcomingAppointment, 'scheduledAt'>>(
  appointments: readonly T[],
  nowMs: number,
): T[] {
  const todayKey = dhakaDayKeyOfMs(nowMs);
  return appointments
    .filter((a) => dhakaDayKey(a.scheduledAt) === todayKey)
    .sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt));
}

/** Short, clearly-labelled patient reference (first 8 id chars) — the
 *  upcoming projection carries NO display name; a truncated real id keeps
 *  rows distinguishable without fabricating one. Null for absent ids. */
export function shortPatientRef(patientId: string | undefined): string | null {
  if (patientId === undefined || patientId.length === 0) return null;
  return patientId.slice(0, 8);
}

// ── Weekly template grouping ────────────────────────────────────────────

/** Backend canonical week order (doctor-profile DAYS_OF_WEEK). */
export const WEEK_ORDER: readonly string[] = Object.freeze([
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
]);

export interface ScheduleDayGroup {
  day: string;
  slots: MyScheduleSlot[];
}

/** Group slots by weekday in canonical order (days with no slots omitted);
 *  slots inside a day sort by start minute. Unknown day values group last,
 *  in first-seen order — shown honestly rather than dropped. */
export function groupSlotsByDay(
  slots: readonly MyScheduleSlot[],
): ScheduleDayGroup[] {
  const byDay = new Map<string, MyScheduleSlot[]>();
  for (const slot of slots) {
    const list = byDay.get(String(slot.dayOfWeek));
    if (list) {
      list.push(slot);
    } else {
      byDay.set(String(slot.dayOfWeek), [slot]);
    }
  }
  const orderedDays = [
    ...WEEK_ORDER.filter((d) => byDay.has(d)),
    ...[...byDay.keys()].filter((d) => !WEEK_ORDER.includes(d)),
  ];
  return orderedDays.map((day) => ({
    day,
    slots: (byDay.get(day) ?? []).sort(
      (a, b) => a.startMinuteOfDay - b.startMinuteOfDay,
    ),
  }));
}

/** Publish body for the recurring endpoint with one slot removed —
 *  POST /doctors/me/schedule/recurring REPLACES the whole weekly set, so
 *  "remove" republishes the remaining slots. Null when `removeId` is not
 *  in the set (nothing to do — avoids an accidental no-op full republish). */
export function buildRemoveSlotBody(
  slots: readonly MyScheduleSlot[],
  removeId: string,
): PublishScheduleBody | null {
  if (!slots.some((s) => s.id === removeId)) return null;
  return {
    slots: slots
      .filter((s) => s.id !== removeId)
      .map((s) => ({
        dayOfWeek: s.dayOfWeek,
        startMinuteOfDay: s.startMinuteOfDay,
        endMinuteOfDay: s.endMinuteOfDay,
        facilityId: s.facilityId ?? null,
      })),
  };
}

// ── Block form (Dhaka wall-clock ⇄ ISO) ─────────────────────────────────

/** Mirrors the backend BlockScheduleSlotsHandler.MAX_BLOCK_RANGE_DAYS. */
export const MAX_BLOCK_RANGE_DAYS = 90;

/** Mirrors blockScheduleSlotsBodySchema's reason cap. */
export const MAX_BLOCK_REASON_CHARS = 200;

export interface BlockDraftValues {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  reason: string;
}

/** Dhaka-local { date: YYYY-MM-DD, time: HH:MM } parts for an instant. */
export function dhakaDateTimeParts(now: Date): { date: string; time: string } {
  const d = new Date(now.getTime() + DHAKA_UTC_OFFSET_MS);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const h = String(d.getUTCHours()).padStart(2, '0');
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  return { date: `${y}-${mo}-${day}`, time: `${h}:${mi}` };
}

/** Fresh block draft: from now (Dhaka) to the same wall-clock tomorrow. */
export function makeEmptyBlockDraft(now: Date): BlockDraftValues {
  const start = dhakaDateTimeParts(now);
  const end = dhakaDateTimeParts(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  return {
    startDate: start.date,
    startTime: start.time,
    endDate: end.date,
    endTime: end.time,
    reason: '',
  };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Epoch ms for a Dhaka-local (YYYY-MM-DD, HH:MM); null when invalid
 *  (bad format, or a non-existent calendar day like 2026-02-30). */
export function parseDhakaDateTimeMs(date: string, time: string): number | null {
  const dt = date.trim();
  const tm = time.trim();
  if (!DATE_RE.test(dt) || !TIME_RE.test(tm)) return null;
  const ms = Date.parse(`${dt}T${tm}:00+06:00`);
  if (Number.isNaN(ms)) return null;
  // Round-trip guard: a rolled-over calendar day (engine-dependent) must
  // not silently shift the block to a different date.
  if (dhakaDayKeyOfMs(ms) !== dt) return null;
  return ms;
}

export type BlockFormIssue =
  | { kind: 'START_INVALID' }
  | { kind: 'END_INVALID' }
  | { kind: 'END_NOT_AFTER_START' }
  | { kind: 'RANGE_TOO_LONG' }
  | { kind: 'REASON_TOO_LONG' };

export type BuildBlockOutcome =
  | { ok: true; body: BlockScheduleBody }
  | { ok: false; issue: BlockFormIssue };

/** Validate the block draft and build the POST body. Mirrors the backend
 *  guards (startsAt < endsAt, range ≤ 90 days, reason ≤ 200 chars) so the
 *  doctor gets a local, localized error instead of a 400 round-trip. */
export function buildBlockBody(draft: BlockDraftValues): BuildBlockOutcome {
  const startMs = parseDhakaDateTimeMs(draft.startDate, draft.startTime);
  if (startMs === null) return { ok: false, issue: { kind: 'START_INVALID' } };
  const endMs = parseDhakaDateTimeMs(draft.endDate, draft.endTime);
  if (endMs === null) return { ok: false, issue: { kind: 'END_INVALID' } };
  if (endMs <= startMs) {
    return { ok: false, issue: { kind: 'END_NOT_AFTER_START' } };
  }
  if (endMs - startMs > MAX_BLOCK_RANGE_DAYS * 24 * 60 * 60 * 1000) {
    return { ok: false, issue: { kind: 'RANGE_TOO_LONG' } };
  }
  const reason = draft.reason.trim();
  if (reason.length > MAX_BLOCK_REASON_CHARS) {
    return { ok: false, issue: { kind: 'REASON_TOO_LONG' } };
  }
  return {
    ok: true,
    body: {
      startsAt: new Date(startMs).toISOString(),
      endsAt: new Date(endMs).toISOString(),
      ...(reason.length > 0 ? { reason } : {}),
    },
  };
}

// ── Chamber-name resolution ─────────────────────────────────────────────

/** Display name for a slot's facilityId given the doctor's chambers.
 *  Returns null for a null/undefined facilityId (universal/telemedicine
 *  default — the caller shows its own label) and a short id reference for
 *  an unresolvable id (honest — never fabricates a name). */
export function chamberDisplayName(
  facilityId: string | null | undefined,
  chambers: readonly { id: string; name?: string }[],
): { kind: 'universal' } | { kind: 'named'; name: string } | { kind: 'unresolved'; shortId: string } {
  if (facilityId === null || facilityId === undefined) return { kind: 'universal' };
  const chamber = chambers.find((c) => c.id === facilityId);
  if (chamber?.name !== undefined && chamber.name.length > 0) {
    return { kind: 'named', name: chamber.name };
  }
  return { kind: 'unresolved', shortId: facilityId.slice(0, 8) };
}
