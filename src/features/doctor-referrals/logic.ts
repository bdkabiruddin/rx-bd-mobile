// Doctor referrals + medical certificates — pure presentation/domain logic.
//
// Deliberately free of React/React Native imports so the whole module is
// unit-testable in the fast Node jest environment (see
// __tests__/doctor-referrals.test.ts).

import type { Language } from '@/i18n/types';

import type {
  CertificateType,
  IssueCertificateBody,
  IssueReferralBody,
  ReferralType,
  ReferralUrgency,
} from './types';

// ─── Enum vocabularies (client mirrors of referral ReferralEnums.ts) ────────

export const REFERRAL_TYPES: readonly ReferralType[] = Object.freeze([
  'SPECIALIST',
  'DIAGNOSTIC',
  'HOSPITAL_ADMISSION',
  'SECOND_OPINION',
]);

export const REFERRAL_URGENCIES: readonly ReferralUrgency[] = Object.freeze([
  'ROUTINE',
  'URGENT',
  'EMERGENT',
]);

export const CERTIFICATE_TYPES: readonly CertificateType[] = Object.freeze([
  'SICK_LEAVE',
  'FITNESS_TO_WORK',
  'FITNESS_TO_FLY',
  'FITNESS_TO_DRIVE',
  'OTHER',
]);

// ─── Server bounds (mirrors referral.schemas.ts zod caps) ───────────────────

export const MAX_REASON_CHARS = 5000;
export const MAX_SPECIALTY_CHARS = 200;
export const MAX_CONTEXT_CHARS = 5000;
export const MAX_RESTRICTIONS_CHARS = 5000;
export const MIN_VALIDITY_DAYS = 1;
export const MAX_VALIDITY_DAYS = 365;
/** Domain default when validityDays is omitted (Referral.issue). */
export const DEFAULT_VALIDITY_DAYS = 30;

// ─── Status → StatusPill tone ────────────────────────────────────────────────

/** Mirrors src/ui/StatusPill's StatusTone union (kept as literals here so
 *  this module never imports React Native). */
export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export function referralStatusTone(status: string | undefined): Tone {
  switch (status) {
    case 'ACTIVE':
      return 'info';
    case 'ACCEPTED':
      return 'success';
    case 'COMPLETED':
    case 'FULFILLED':
      return 'success';
    case 'REDIRECTED':
    case 'EXPIRED':
      return 'warning';
    case 'DECLINED':
    case 'CANCELLED':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function certificateStatusTone(status: string | undefined): Tone {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'REVOKED':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function urgencyTone(urgency: string | undefined): Tone {
  switch (urgency) {
    case 'EMERGENT':
      return 'danger';
    case 'URGENT':
      return 'warning';
    case 'ROUTINE':
      return 'neutral';
    default:
      return 'neutral';
  }
}

// ─── Cancel affordances (mirror the domain guards exactly) ──────────────────

/** Referral.cancel only succeeds while the referral is still ACTIVE (the
 *  sender cannot pull it once a receiver acted). Unknown/absent statuses get
 *  no affordance — the server would 409 anyway. */
export function canCancelReferral(status: string | undefined): boolean {
  return status === 'ACTIVE';
}

/** MedicalCertificate.revoke refuses only ALREADY_REVOKED. An absent status
 *  gets no affordance (we cannot know it is safe to offer). */
export function canRevokeCertificate(status: string | undefined): boolean {
  return status !== undefined && status !== 'REVOKED';
}

// ─── Patient search input (mirrors searchBodySchema: 1..100 chars) ──────────

export const SEARCH_QUERY_MAX = 100;

export function clampSearchQuery(raw: string): string {
  return raw.trim().slice(0, SEARCH_QUERY_MAX);
}

export function isSearchable(raw: string): boolean {
  return clampSearchQuery(raw).length > 0;
}

// ─── Display helpers ─────────────────────────────────────────────────────────

/** Short display fragment of a patient UUID — the first group, uppercased.
 *  List projections carry NO display name; a truncated real id keeps rows
 *  distinguishable without fabricating one. */
export function shortPatientRef(patientId: string | undefined): string | null {
  if (patientId === undefined || patientId.length === 0) return null;
  const first = patientId.split('-')[0];
  return (first !== undefined && first.length > 0 ? first : patientId).toUpperCase();
}

/** Join non-empty display parts with a middot. */
export function joinParts(parts: (string | null | undefined)[]): string {
  return parts
    .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
    .join(' · ');
}

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'] as const;

/** Localize ASCII digits inside a string (e.g. the "20–30" age bracket). */
export function localizeDigits(value: string, lang: Language): string {
  if (lang !== 'bn') return value;
  return value.replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)] ?? d);
}

/** Locale-aware plain number (Bangla numerals for bn). */
export function formatNumber(value: number, lang: Language): string {
  return value.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-GB');
}

/** Most-recent-first by issuedAt (rows without a timestamp sink to the end,
 *  original order preserved among themselves). Non-mutating. */
export function sortByIssuedAtDesc<T extends { issuedAt?: string }>(
  rows: readonly T[],
): T[] {
  const stamped = (r: T): number => {
    const ms = r.issuedAt !== undefined ? Date.parse(r.issuedAt) : Number.NaN;
    return Number.isNaN(ms) ? Number.NEGATIVE_INFINITY : ms;
  };
  return [...rows].sort((a, b) => stamped(b) - stamped(a));
}

// ─── Dhaka day math (UTC+6, no DST — same convention as the backend) ────────

export const DHAKA_UTC_OFFSET_MS = 6 * 60 * 60 * 1000;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Dhaka-local YYYY-MM-DD for an epoch-ms instant. */
export function dhakaDayKeyOfMs(ms: number): string {
  const d = new Date(ms + DHAKA_UTC_OFFSET_MS);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

/** Today's Dhaka-local YYYY-MM-DD. */
export function todayDhakaDate(now: Date): string {
  return dhakaDayKeyOfMs(now.getTime());
}

/** Epoch ms of 00:00 Dhaka on a YYYY-MM-DD; null when the format is bad or
 *  the calendar day does not exist (round-trip guarded, e.g. 2026-02-30). */
export function parseDhakaDateStartMs(date: string): number | null {
  const dt = date.trim();
  if (!DATE_RE.test(dt)) return null;
  const ms = Date.parse(`${dt}T00:00:00+06:00`);
  if (Number.isNaN(ms)) return null;
  if (dhakaDayKeyOfMs(ms) !== dt) return null;
  return ms;
}

/** Epoch ms of 23:59 Dhaka on the same day (inclusive end-of-day). */
export function dhakaEndOfDayMs(startMs: number): number {
  return startMs + 24 * 60 * 60 * 1000 - 60 * 1000;
}

// ─── Referral form ───────────────────────────────────────────────────────────

export interface ReferralDraftValues {
  patientId: string;
  /** Display label of the picked patient (initials/short id — never a name). */
  patientLabel: string;
  referralType: string;
  targetSpecialty: string;
  reason: string;
  clinicalContext: string;
  urgency: string;
  /** Free-typed digits; empty = server default (30). */
  validityDays: string;
}

export function makeEmptyReferralDraft(pinnedPatientId?: string): ReferralDraftValues {
  return {
    patientId: pinnedPatientId ?? '',
    patientLabel: '',
    referralType: 'SPECIALIST',
    targetSpecialty: '',
    reason: '',
    clinicalContext: '',
    urgency: 'ROUTINE',
    validityDays: '',
  };
}

export type ReferralFormIssue =
  | { kind: 'PATIENT_REQUIRED' }
  | { kind: 'TYPE_INVALID' }
  | { kind: 'URGENCY_INVALID' }
  | { kind: 'REASON_REQUIRED' }
  | { kind: 'REASON_TOO_LONG' }
  | { kind: 'SPECIALTY_TOO_LONG' }
  | { kind: 'CONTEXT_TOO_LONG' }
  | { kind: 'VALIDITY_INVALID' };

export type BuildReferralOutcome =
  | { ok: true; body: IssueReferralBody }
  | { ok: false; issue: ReferralFormIssue };

/** Validate the referral draft and build the POST /referrals body. Mirrors
 *  the backend zod guards (reason 1..5000, specialty ≤200, context ≤5000,
 *  validityDays int 1..365) so the doctor gets a local, localized error
 *  instead of a 400 round-trip. Optional empties are OMITTED (never sent as
 *  empty strings). */
export function buildReferralBody(draft: ReferralDraftValues): BuildReferralOutcome {
  if (draft.patientId.trim().length === 0) {
    return { ok: false, issue: { kind: 'PATIENT_REQUIRED' } };
  }
  if (!(REFERRAL_TYPES as readonly string[]).includes(draft.referralType)) {
    return { ok: false, issue: { kind: 'TYPE_INVALID' } };
  }
  if (!(REFERRAL_URGENCIES as readonly string[]).includes(draft.urgency)) {
    return { ok: false, issue: { kind: 'URGENCY_INVALID' } };
  }
  const reason = draft.reason.trim();
  if (reason.length === 0) return { ok: false, issue: { kind: 'REASON_REQUIRED' } };
  if (reason.length > MAX_REASON_CHARS) {
    return { ok: false, issue: { kind: 'REASON_TOO_LONG' } };
  }
  const specialty = draft.targetSpecialty.trim();
  if (specialty.length > MAX_SPECIALTY_CHARS) {
    return { ok: false, issue: { kind: 'SPECIALTY_TOO_LONG' } };
  }
  const context = draft.clinicalContext.trim();
  if (context.length > MAX_CONTEXT_CHARS) {
    return { ok: false, issue: { kind: 'CONTEXT_TOO_LONG' } };
  }
  const validityRaw = draft.validityDays.trim();
  let validityDays: number | undefined;
  if (validityRaw.length > 0) {
    if (!/^\d+$/.test(validityRaw)) {
      return { ok: false, issue: { kind: 'VALIDITY_INVALID' } };
    }
    const n = Number(validityRaw);
    if (!Number.isInteger(n) || n < MIN_VALIDITY_DAYS || n > MAX_VALIDITY_DAYS) {
      return { ok: false, issue: { kind: 'VALIDITY_INVALID' } };
    }
    validityDays = n;
  }
  return {
    ok: true,
    body: {
      patientId: draft.patientId.trim(),
      referralType: draft.referralType,
      reason,
      urgency: draft.urgency,
      ...(specialty.length > 0 ? { targetSpecialty: specialty } : {}),
      ...(context.length > 0 ? { clinicalContext: context } : {}),
      ...(validityDays !== undefined ? { validityDays } : {}),
    },
  };
}

// ─── Certificate form ────────────────────────────────────────────────────────

export interface CertificateDraftValues {
  patientId: string;
  /** Display label of the picked patient (initials/short id — never a name). */
  patientLabel: string;
  certificateType: string;
  /** Dhaka-local YYYY-MM-DD; certificate valid from 00:00 this day. */
  fromDate: string;
  /** Dhaka-local YYYY-MM-DD; certificate valid until 23:59 this day. */
  untilDate: string;
  reason: string;
  restrictions: string;
}

export function makeEmptyCertificateDraft(
  now: Date,
  pinnedPatientId?: string,
): CertificateDraftValues {
  const today = todayDhakaDate(now);
  return {
    patientId: pinnedPatientId ?? '',
    patientLabel: '',
    certificateType: 'SICK_LEAVE',
    fromDate: today,
    untilDate: today,
    reason: '',
    restrictions: '',
  };
}

export type CertificateFormIssue =
  | { kind: 'PATIENT_REQUIRED' }
  | { kind: 'TYPE_INVALID' }
  | { kind: 'FROM_INVALID' }
  | { kind: 'UNTIL_INVALID' }
  | { kind: 'UNTIL_BEFORE_FROM' }
  | { kind: 'REASON_REQUIRED' }
  | { kind: 'REASON_TOO_LONG' }
  | { kind: 'RESTRICTIONS_TOO_LONG' };

export type BuildCertificateOutcome =
  | { ok: true; body: IssueCertificateBody }
  | { ok: false; issue: CertificateFormIssue };

/** Validate the certificate draft and build the POST /medical-certificates
 *  body. Dates are Dhaka calendar days: validFrom = 00:00 Dhaka, validUntil =
 *  23:59 Dhaka (inclusive end-of-day), serialized as UTC ISO with a Z suffix
 *  — the only format issueCertificateSchema's z.string().datetime() accepts.
 *  A single-day certificate (from == until) is therefore valid, mirroring the
 *  backend's strict validUntil > validFrom refinement. */
export function buildCertificateBody(
  draft: CertificateDraftValues,
): BuildCertificateOutcome {
  if (draft.patientId.trim().length === 0) {
    return { ok: false, issue: { kind: 'PATIENT_REQUIRED' } };
  }
  if (!(CERTIFICATE_TYPES as readonly string[]).includes(draft.certificateType)) {
    return { ok: false, issue: { kind: 'TYPE_INVALID' } };
  }
  const fromMs = parseDhakaDateStartMs(draft.fromDate);
  if (fromMs === null) return { ok: false, issue: { kind: 'FROM_INVALID' } };
  const untilStartMs = parseDhakaDateStartMs(draft.untilDate);
  if (untilStartMs === null) return { ok: false, issue: { kind: 'UNTIL_INVALID' } };
  if (untilStartMs < fromMs) {
    return { ok: false, issue: { kind: 'UNTIL_BEFORE_FROM' } };
  }
  const reason = draft.reason.trim();
  if (reason.length === 0) return { ok: false, issue: { kind: 'REASON_REQUIRED' } };
  if (reason.length > MAX_REASON_CHARS) {
    return { ok: false, issue: { kind: 'REASON_TOO_LONG' } };
  }
  const restrictions = draft.restrictions.trim();
  if (restrictions.length > MAX_RESTRICTIONS_CHARS) {
    return { ok: false, issue: { kind: 'RESTRICTIONS_TOO_LONG' } };
  }
  return {
    ok: true,
    body: {
      patientId: draft.patientId.trim(),
      certificateType: draft.certificateType,
      reason,
      validFrom: new Date(fromMs).toISOString(),
      validUntil: new Date(dhakaEndOfDayMs(untilStartMs)).toISOString(),
      ...(restrictions.length > 0 ? { restrictions } : {}),
    },
  };
}
