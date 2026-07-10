// Patient live queue position — pure presentation/derivation logic.
// No React, no React Native imports: unit-tested in a Node jest
// environment (__tests__/patient-queue.test.ts).
//
// Clinical-safety posture: everything here degrades to an HONEST
// fallback — unknown stages get a neutral pill with the raw value,
// absent numbers render nothing, and the chamber-discovery helpers
// only surface what the backend explicitly sent.

import type { AppointmentRowLite, DoctorChamberLite } from './types';

/** Same literal union as src/ui/StatusPill's StatusTone — duplicated so
 *  this module stays free of react-native imports. */
export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

/** Queue stage → pill tone. Unknown/future stages stay neutral. */
export function stageTone(stage: string | undefined): Tone {
  switch (stage) {
    case 'CHECKED_IN':
      return 'info';
    case 'ASSISTANT_PREP':
      return 'info';
    case 'DOCTOR_READY':
      return 'success';
    case 'IN_CONSULTATION':
      return 'success';
    case 'NO_SHOW':
    case 'CANCELLED':
      return 'warning';
    default:
      return 'neutral';
  }
}

/** Priority → pill tone, or null when NO pill should render (NORMAL /
 *  absent priority is the default and needs no callout). */
export function priorityTone(priority: string | null | undefined): Tone | null {
  switch (priority) {
    case 'EMERGENCY':
      return 'danger';
    case 'URGENT':
      return 'warning';
    default:
      return null;
  }
}

/** 1-based position → how many people are ahead, or null when the
 *  backend sent no usable position (never invented). */
export function peopleAhead(position: number | null | undefined): number | null {
  if (typeof position !== 'number' || !Number.isFinite(position) || position < 1) {
    return null;
  }
  return Math.floor(position) - 1;
}

/** Estimated wait in minutes, or null when the backend sent no positive
 *  estimate (0 = "not estimated" per the wait-time service). */
export function estWaitMinutes(minutes: number | null | undefined): number | null {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) {
    return null;
  }
  return Math.round(minutes);
}

/** Locale-aware integer (Bangla numerals for bn). */
export function formatNumber(value: number, lang: 'en' | 'bn'): string {
  return value.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-GB');
}

/** YYYY-MM-DD key of an instant in the Asia/Dhaka calendar. */
export function dhakaDayKey(instant: string | number | Date): string {
  return new Date(instant).toLocaleDateString('en-CA', {
    timeZone: 'Asia/Dhaka',
  });
}

/** True when the ISO timestamp falls on the same Dhaka calendar day as
 *  `now`. Malformed timestamps are never "today". */
export function isSameDhakaDay(iso: string, now: Date = new Date()): boolean {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return false;
  return dhakaDayKey(t) === dhakaDayKey(now);
}

/** Appointment statuses that can still put the patient in a chamber
 *  queue today (terminal rows are ignored by discovery). */
const ACTIVE_APPOINTMENT_STATUSES: ReadonlySet<string> = new Set([
  'SCHEDULED',
  'CONFIRMED',
  'CHECKED_IN',
  'IN_PROGRESS',
]);

export const MAX_DISCOVERY_DOCTORS = 3;
export const MAX_CANDIDATE_CHAMBERS = 6;

export interface DoctorCandidates {
  /** Unique doctor userIds from today's active appointments (bounded). */
  doctorIds: string[];
  /** doctorUserId → display name (only when the backend resolved one). */
  doctorNameById: Map<string, string>;
}

/** Today's active chamber-visit doctors, derived from the patient's own
 *  appointment list (the list view carries chamberName but NOT the raw
 *  chamberId — the doctor's chamber list bridges the gap). */
export function deriveDoctorCandidates(
  appointments: AppointmentRowLite[] | null | undefined,
  now: Date = new Date(),
): DoctorCandidates {
  const doctorIds: string[] = [];
  const doctorNameById = new Map<string, string>();
  for (const row of appointments ?? []) {
    if (!ACTIVE_APPOINTMENT_STATUSES.has(row.status)) continue;
    if (!isSameDhakaDay(row.scheduledAt, now)) continue;
    const doctorId = row.doctorUserId;
    if (typeof doctorId !== 'string' || doctorId.length === 0) continue;
    if (!doctorIds.includes(doctorId) && doctorIds.length < MAX_DISCOVERY_DOCTORS) {
      doctorIds.push(doctorId);
    }
    const name = row.doctorName?.trim();
    if (name && name.length > 0 && !doctorNameById.has(doctorId)) {
      doctorNameById.set(doctorId, name);
    }
  }
  return { doctorIds, doctorNameById };
}

export interface ChamberCandidates {
  /** Unique chamber ids to probe, bounded, order preserved. */
  chamberIds: string[];
  /** chamberId → display name (only when the backend sent one). */
  chamberNameById: Map<string, string>;
}

/** Flatten per-doctor chamber lists into a bounded, de-duplicated probe
 *  candidate set. */
export function deriveChamberCandidates(
  chamberLists: (DoctorChamberLite[] | null | undefined)[],
): ChamberCandidates {
  const chamberIds: string[] = [];
  const chamberNameById = new Map<string, string>();
  for (const list of chamberLists) {
    for (const chamber of list ?? []) {
      if (typeof chamber.id !== 'string' || chamber.id.length === 0) continue;
      if (
        !chamberIds.includes(chamber.id) &&
        chamberIds.length < MAX_CANDIDATE_CHAMBERS
      ) {
        chamberIds.push(chamber.id);
      }
      const name = chamber.name?.trim();
      if (name && name.length > 0 && !chamberNameById.has(chamber.id)) {
        chamberNameById.set(chamber.id, name);
      }
    }
  }
  return { chamberIds, chamberNameById };
}

/** Probe order: the last chamber that answered 200 goes first, then the
 *  remaining candidates in discovery order. */
export function probeOrder(
  candidates: string[],
  lockedChamberId: string | null,
): string[] {
  if (lockedChamberId === null || !candidates.includes(lockedChamberId)) {
    return candidates;
  }
  return [lockedChamberId, ...candidates.filter((id) => id !== lockedChamberId)];
}

/** Join defined, non-empty parts with a middle dot (info line). */
export function joinParts(parts: (string | null | undefined)[]): string {
  return parts
    .filter((p): p is string => typeof p === 'string' && p.length > 0)
    .join(' · ');
}
