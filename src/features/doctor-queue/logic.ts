// Doctor chamber queue — pure presentation/derivation logic.
// No React, no React Native imports: unit-tested in a Node jest
// environment (__tests__/doctor-queue.test.ts).
//
// Clinical-safety posture: everything here degrades to an HONEST
// fallback — unknown priorities get no pill, malformed timestamps render
// nothing, and the now-serving pick never surfaces another doctor's
// patient (a shared-chamber entry with a different doctorUserId is
// skipped rather than offered for Complete/No-show).

import type { ChamberLite, DoctorQueueEntry } from './types';

/** Same literal union as src/ui/StatusPill's StatusTone — duplicated so
 *  this module stays free of react-native imports. */
export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

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

/** First IN_CONSULTATION entry (server sorts EMERGENCY first, then
 *  check-in — mirrors the web QueueClient's buckets.IN_CONSULTATION[0]).
 *  Entries that carry a DIFFERENT doctorUserId are skipped so a shared
 *  chamber never offers another doctor's patient for Complete/No-show;
 *  entries without the field are trusted (chamber is doctor-owned). */
export function pickNowServing(
  entries: DoctorQueueEntry[] | null | undefined,
  doctorUserId: string | null,
): DoctorQueueEntry | null {
  for (const entry of entries ?? []) {
    if (entry.stage !== 'IN_CONSULTATION') continue;
    const owner = entry.doctorUserId;
    if (
      doctorUserId !== null &&
      typeof owner === 'string' &&
      owner.length > 0 &&
      owner !== doctorUserId
    ) {
      continue;
    }
    return entry;
  }
  return null;
}

/** Defensive DOCTOR_READY filter over the /me/doctor-queue payload —
 *  the backend already scopes to DOCTOR_READY; this guards against
 *  contract drift. Server order (priority, then check-in) is kept. */
export function toWaitingList(
  entries: DoctorQueueEntry[] | null | undefined,
): DoctorQueueEntry[] {
  return (entries ?? []).filter((entry) => entry.stage === 'DOCTOR_READY');
}

/** Chamber the queue is scoped to: the doctor's explicit selection when
 *  it is still a usable chamber, else the primary, else the first, else
 *  null (no chamber → the screen renders the setup empty state). */
export function effectiveChamberId(
  chambers: ChamberLite[] | null | undefined,
  selectedId: string | null,
): string | null {
  const usable = (chambers ?? []).filter(
    (c) => typeof c.id === 'string' && c.id.length > 0 && c.isActive !== false,
  );
  if (usable.length === 0) return null;
  if (selectedId !== null && usable.some((c) => c.id === selectedId)) {
    return selectedId;
  }
  const primary = usable.find((c) => c.isPrimary === true);
  return (primary ?? usable[0])?.id ?? null;
}

/** Display name for a chamber id, or null when the backend sent none. */
export function chamberNameOf(
  chambers: ChamberLite[] | null | undefined,
  chamberId: string | null,
): string | null {
  if (chamberId === null) return null;
  const name = (chambers ?? []).find((c) => c.id === chamberId)?.name?.trim();
  return name !== undefined && name.length > 0 ? name : null;
}

/** Whole minutes from an ISO instant to a client-clock ms instant,
 *  clamped at 0; null on absent/malformed input (never invented).
 *  Computed against the snapshot's fetchedAt (not a render-time clock)
 *  so derivation stays pure and consistent with the freshness badge. */
export function minutesBetween(
  fromIso: string | null | undefined,
  toMs: number,
): number | null {
  if (typeof fromIso !== 'string' || fromIso.length === 0) return null;
  const t = Date.parse(fromIso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((toMs - t) / 60_000));
}

/** Locale-aware integer (Bangla numerals for bn). */
export function formatNumber(value: number, lang: 'en' | 'bn'): string {
  return value.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-GB');
}

/** True when the entry was a walk-in (no prior booking). */
export function isWalkIn(appointmentType: string | null | undefined): boolean {
  return appointmentType === 'WALK_IN';
}

/** Join defined, non-empty parts with a middle dot (info line). */
export function joinParts(parts: (string | null | undefined)[]): string {
  return parts
    .filter((p): p is string => typeof p === 'string' && p.length > 0)
    .join(' · ');
}
