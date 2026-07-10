// Patient appointments — pure presentation/domain logic.
//
// Deliberately free of React/React Native imports so the whole module is
// unit-testable in the fast Node jest environment (see
// __tests__/patient-appointments.test.ts).

import type { Language } from '@/i18n/types';

import type {
  AvailableSlotWindow,
  BookedTimeRange,
  DoctorChamber,
  PatientAppointmentListItem,
} from './types';

// ── Status → StatusPill tone ────────────────────────────────────────────

/** Mirrors src/ui/StatusPill's StatusTone union (kept as literals here so
 *  this module never imports React Native). */
export type AppointmentTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export function statusTone(status: string): AppointmentTone {
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

/** Statuses a patient may still act on (cancel / reschedule) — mirrors the
 *  backend per-transition gate (PATIENT: SCHEDULED/CONFIRMED → CANCELLED;
 *  reschedule allowed pre-CHECKED_IN). */
export function isActionableStatus(status: string): boolean {
  return status === 'SCHEDULED' || status === 'CONFIRMED';
}

// ── Upcoming / past partition ───────────────────────────────────────────

const ACTIVE_STATUSES = new Set([
  'SCHEDULED',
  'CONFIRMED',
  'CHECKED_IN',
  'IN_PROGRESS',
]);

/** True when the appointment still lies ahead (active status and its time
 *  window has not fully elapsed). */
export function isUpcoming(
  item: Pick<PatientAppointmentListItem, 'scheduledAt' | 'status' | 'durationMinutes'>,
  nowMs: number,
): boolean {
  if (!ACTIVE_STATUSES.has(String(item.status))) return false;
  const startMs = Date.parse(item.scheduledAt);
  if (Number.isNaN(startMs)) return false;
  const endMs = startMs + (item.durationMinutes ?? 0) * 60_000;
  return endMs >= nowMs;
}

export function partitionAppointments<
  T extends Pick<PatientAppointmentListItem, 'scheduledAt' | 'status' | 'durationMinutes'>,
>(items: readonly T[], nowMs: number): { upcoming: T[]; past: T[] } {
  const upcoming: T[] = [];
  const past: T[] = [];
  for (const item of items) {
    (isUpcoming(item, nowMs) ? upcoming : past).push(item);
  }
  // Next visit first for upcoming; most recent first for past.
  upcoming.sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt));
  past.sort((a, b) => Date.parse(b.scheduledAt) - Date.parse(a.scheduledAt));
  return { upcoming, past };
}

// ── Dhaka slot time math ────────────────────────────────────────────────
//
// Slot windows come back as (YYYY-MM-DD Dhaka-local date, minute-of-day).
// Bangladesh is UTC+6 with no DST, so the fixed offset conversion below is
// exact — the same convention the backend's slot expansion uses.

/** Epoch ms for midnight (Dhaka) of a YYYY-MM-DD date. */
export function dhakaDayStartMs(date: string): number {
  return Date.parse(`${date}T00:00:00+06:00`);
}

/** Epoch ms for a Dhaka-local (date, minute-of-day). */
export function slotStartMs(date: string, minuteOfDay: number): number {
  return dhakaDayStartMs(date) + minuteOfDay * 60_000;
}

/** UTC ISO timestamp for a Dhaka-local (date, minute-of-day) — the value
 *  POSTed as `scheduledAt` / `newScheduledAt`. */
export function slotIso(date: string, minuteOfDay: number): string {
  return new Date(slotStartMs(date, minuteOfDay)).toISOString();
}

/** Locale-aware plain number (Bangla numerals for bn). */
export function formatNumber(value: number, lang: Language): string {
  return value.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-GB');
}

/** Minute-of-day (Dhaka local) → localized clock label, e.g. "09:30". */
export function formatMinuteOfDay(minuteOfDay: number, lang: Language): string {
  const h = Math.floor(minuteOfDay / 60) % 24;
  const m = minuteOfDay % 60;
  // The minute is already Dhaka-local; format it as a plain clock reading.
  return new Date(Date.UTC(2000, 0, 1, h, m)).toLocaleTimeString(
    lang === 'bn' ? 'bn-BD' : 'en-GB',
    { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' },
  );
}

// ── Window → bookable chunk expansion ───────────────────────────────────

/** Fallback booking grain when a chamber declares no slotDurationMinutes —
 *  the same fallback the web wizard uses; the server-side schedule-conflict
 *  gate stays authoritative either way. */
export const DEFAULT_CHUNK_MINUTES = 30;

/** Defensive cap per window so a malformed window cannot explode the UI. */
const MAX_CHUNKS_PER_WINDOW = 48;

const DAY_ENUM_TO_NUM: Readonly<Record<string, number>> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

export interface BookableSlotChunk {
  /** Dhaka-local date, YYYY-MM-DD. */
  date: string;
  startMinuteOfDay: number;
  endMinuteOfDay: number;
  /** Chamber the chunk belongs to (window.facilityId); null = doctor's
   *  universal/telemedicine default. */
  chamberId: string | null;
}

function chunkMinutesFor(
  window: AvailableSlotWindow,
  chambers: readonly DoctorChamber[],
): number {
  const chamberId = window.facilityId ?? null;
  if (chamberId !== null) {
    const chamber = chambers.find((c) => c.id === chamberId);
    const dayNum =
      window.dayOfWeek !== undefined ? DAY_ENUM_TO_NUM[window.dayOfWeek] : undefined;
    const schedules = chamber?.schedules ?? [];
    // Prefer the schedule row matching this weekday + overlapping window.
    const match =
      schedules.find(
        (s) =>
          (dayNum === undefined || s.dayOfWeek === dayNum) &&
          s.startMinuteOfDay < window.endMinuteOfDay &&
          s.endMinuteOfDay > window.startMinuteOfDay,
      ) ?? schedules.find((s) => dayNum !== undefined && s.dayOfWeek === dayNum);
    const declared = match?.slotDurationMinutes;
    if (
      typeof declared === 'number' &&
      Number.isFinite(declared) &&
      declared > 0 &&
      declared <= window.endMinuteOfDay - window.startMinuteOfDay
    ) {
      return Math.floor(declared);
    }
  }
  const windowLength = window.endMinuteOfDay - window.startMinuteOfDay;
  return Math.min(DEFAULT_CHUNK_MINUTES, Math.max(1, windowLength));
}

function overlapsBooked(
  chunkStartMs: number,
  chunkEndMs: number,
  chamberId: string | null,
  booked: readonly { startMs: number; endMs: number; facilityId: string | null }[],
): boolean {
  for (const range of booked) {
    if (range.facilityId !== chamberId) continue; // per-chamber semantics (mirrors web)
    if (chunkStartMs < range.endMs && range.startMs < chunkEndMs) return true;
  }
  return false;
}

/** Expand published schedule windows into tappable, honest booking chunks:
 *  chamber-declared grain (30-min fallback), strictly-future starts only,
 *  already-booked chunks removed (per-chamber). Sorted by (date, start). */
export function expandWindowsToChunks(opts: {
  windows: readonly AvailableSlotWindow[];
  chambers: readonly DoctorChamber[];
  bookedRanges: readonly BookedTimeRange[];
  nowMs: number;
}): BookableSlotChunk[] {
  const booked = opts.bookedRanges
    .map((r) => {
      const startMs = Date.parse(r.scheduledAt);
      return {
        startMs,
        endMs: startMs + (r.durationMinutes > 0 ? r.durationMinutes : 0) * 60_000,
        facilityId: r.facilityId ?? null,
      };
    })
    .filter((r) => !Number.isNaN(r.startMs));

  const seen = new Set<string>();
  const chunks: BookableSlotChunk[] = [];

  for (const window of opts.windows) {
    if (
      !window.date ||
      !Number.isFinite(window.startMinuteOfDay) ||
      !Number.isFinite(window.endMinuteOfDay) ||
      window.endMinuteOfDay <= window.startMinuteOfDay
    ) {
      continue;
    }
    const chamberId = window.facilityId ?? null;
    const grain = chunkMinutesFor(window, opts.chambers);

    let produced = 0;
    for (
      let start = window.startMinuteOfDay;
      start + grain <= window.endMinuteOfDay && produced < MAX_CHUNKS_PER_WINDOW;
      start += grain
    ) {
      produced += 1;
      const end = start + grain;
      const startMs = slotStartMs(window.date, start);
      if (Number.isNaN(startMs) || startMs <= opts.nowMs) continue; // strictly future
      const endMs = slotStartMs(window.date, end);
      if (overlapsBooked(startMs, endMs, chamberId, booked)) continue;
      const key = `${window.date}:${start}:${chamberId ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      chunks.push({
        date: window.date,
        startMinuteOfDay: start,
        endMinuteOfDay: end,
        chamberId,
      });
    }
  }

  chunks.sort((a, b) =>
    a.date === b.date
      ? a.startMinuteOfDay - b.startMinuteOfDay
      : a.date < b.date
        ? -1
        : 1,
  );
  return chunks;
}

/** Group sorted chunks into per-date sections for the picker UI. */
export function groupChunksByDate(
  chunks: readonly BookableSlotChunk[],
): { date: string; chunks: BookableSlotChunk[] }[] {
  const groups: { date: string; chunks: BookableSlotChunk[] }[] = [];
  for (const chunk of chunks) {
    const last = groups[groups.length - 1];
    if (last && last.date === chunk.date) {
      last.chunks.push(chunk);
    } else {
      groups.push({ date: chunk.date, chunks: [chunk] });
    }
  }
  return groups;
}

// ── Booking facility mapping (mirrors the web wizard, Wave-240 rules) ───
//
//   - TELE_CLINIC chamber      → facilityType=TELEMEDICINE, no facilityId,
//                                appointmentType pinned TELEMEDICINE
//   - chamber inside hospital  → facilityType=HOSPITAL, facilityId=hospitalId
//   - standalone chamber / no chamber → facilityType=TELEMEDICINE, no
//     facilityId (enum lacks a private-clinic value; chamberId still ties
//     the booking to the right location).

export interface FacilityMapping {
  facilityType: 'HOSPITAL' | 'TELEMEDICINE';
  facilityId: string | null;
  isTeleClinic: boolean;
}

export function mapChamberToFacility(
  chamberId: string | null,
  chambers: readonly DoctorChamber[],
): FacilityMapping {
  const chamber = chamberId !== null ? chambers.find((c) => c.id === chamberId) : undefined;
  const isTeleClinic = chamber?.type === 'TELE_CLINIC';
  const hospitalId = !isTeleClinic ? (chamber?.hospitalId ?? null) : null;
  if (hospitalId !== null) {
    return { facilityType: 'HOSPITAL', facilityId: hospitalId, isTeleClinic: false };
  }
  return { facilityType: 'TELEMEDICINE', facilityId: null, isTeleClinic };
}
