// Patient meds — pure presentation/mapping logic. No React, no React
// Native imports: this module is unit-tested in a Node jest environment
// (__tests__/patient-meds.test.ts).

import type {
  MedicationView,
  ReminderChannel,
  ReminderStatus,
  ReminderUpsertBody,
  ReminderView,
} from './types';

/** Same literal union as src/ui/StatusPill's StatusTone — duplicated so
 *  this module stays free of react-native imports. */
export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

/** Prescription lifecycle → pill tone. Unknown values stay neutral. */
export function prescriptionStatusTone(status: string | undefined): Tone {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'DISPENSED':
      return 'info';
    case 'EXPIRED':
      return 'warning';
    case 'CANCELLED':
      return 'danger';
    default:
      return 'neutral';
  }
}

/** Patient medication status → pill tone. */
export function medicationStatusTone(status: string | undefined): Tone {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'PAUSED':
      return 'warning';
    default:
      return 'neutral';
  }
}

/** Medication reminder status → pill tone. */
export function reminderStatusTone(status: string | undefined): Tone {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'PAUSED':
      return 'warning';
    default:
      return 'neutral';
  }
}

/**
 * Reorder (ask the doctor to re-prescribe) eligibility. The backend
 * accepts only COMPLETED or EXPIRED source prescriptions — note that
 * 'COMPLETED' is not currently a member of the PrescriptionStatus enum
 * (see gap note), so in practice only EXPIRED qualifies; 'COMPLETED' is
 * kept for forward compatibility with the server-side check.
 */
export function canReorder(status: string | undefined): boolean {
  return status === 'EXPIRED' || status === 'COMPLETED';
}

/**
 * Normalize a user-typed reminder time to the backend's strict "HH:MM"
 * (24h) shape. Returns null when the input is not a valid time.
 */
export function normalizeReminderTime(raw: string): string | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(raw.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** Keep only channels the backend accepts; default to in-app. */
export function sanitizeChannels(channels: string[] | undefined): ReminderChannel[] {
  const valid: ReminderChannel[] = [];
  for (const c of channels ?? []) {
    if ((c === 'push' || c === 'in_app') && !valid.includes(c)) valid.push(c);
  }
  return valid.length > 0 ? valid : ['in_app'];
}

/**
 * Build the upsert body used to pause/resume/cancel an EXISTING reminder
 * row. The route's zod schema requires label + at least one valid time
 * even on a status-only change (POST is a full upsert), so a defensive
 * null is returned when the row is missing those — the caller must then
 * refuse the action instead of sending a request that can only 400.
 */
export function buildReminderUpsertBody(
  reminder: Partial<Pick<ReminderView, 'prescriptionId' | 'reminderLabel' | 'reminderTimes' | 'channels'>>,
  status: ReminderStatus,
): ReminderUpsertBody | null {
  const times: string[] = [];
  for (const t of reminder.reminderTimes ?? []) {
    const norm = normalizeReminderTime(t);
    if (norm !== null && !times.includes(norm)) times.push(norm);
  }
  if (!reminder.prescriptionId || !reminder.reminderLabel || times.length === 0) {
    return null;
  }
  return {
    prescriptionId: reminder.prescriptionId,
    reminderLabel: reminder.reminderLabel,
    reminderTimes: times.slice(0, 8),
    channels: sanitizeChannels(reminder.channels),
    status,
  };
}

/**
 * Group current-medication drug names by their source prescription id.
 * Used to enrich the (metadata-only) prescription picker with real drug
 * names and to prefill the reminder label. OTC rows (null source) are
 * skipped — reminders are keyed on a prescription id.
 */
export function medNamesByPrescription(
  medications: MedicationView[] | undefined,
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const med of medications ?? []) {
    const rxId = med.sourcePrescriptionId;
    const name = med.drugName?.trim();
    if (!rxId || !name) continue;
    const names = map.get(rxId) ?? [];
    if (!names.includes(name)) names.push(name);
    map.set(rxId, names);
  }
  return map;
}

/** Join defined, non-empty parts with a middle dot (list row subtitles). */
export function joinParts(parts: (string | undefined | null)[]): string {
  return parts.filter((p): p is string => typeof p === 'string' && p.length > 0).join(' · ');
}
