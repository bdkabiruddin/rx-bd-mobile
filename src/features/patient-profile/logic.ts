// Patient profile / allergies / contacts / DSAR — pure logic. No React /
// React Native imports so the whole module runs in the fast Node jest
// environment (see __tests__/patient-profile.test.ts).
//
// Validation mirrors the backend rules:
//   - BD identifiers: src/modules/patient/domain/bdNationalIdentifiers.ts
//     (NID 10/13/17 digits, BRN 17 digits, health-ID 4–32 alnum/hyphen)
//   - birthDate: YYYY-MM-DD, not in the future (UpsertMyPatientProfileHandler)
//   - heightCm: > 0 and ≤ 300 (upsertMyPatientProfileSchema)
//   - contact phone: ^\+8801\d{9}$ (createMyEmergencyContactSchema)
//   - allergy: allergen.display + severity required (recordAllergySchema)

import { formatPhoneBd } from '@/i18n/formatters';

import type {
  AllergySeverity,
  AllergyView,
  BloodType,
  CreateEmergencyContactBody,
  FhirGender,
  LactationStatus,
  PatientProfileView,
  RecordAllergyBody,
  UpsertMyPatientProfileBody,
} from './types';

/** Mirrors src/ui/StatusPill's StatusTone union (kept as literals so this
 *  module never imports React Native). */
export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

// ── Identifier display masking ──────────────────────────────────────────
// The backend returns national/health identifiers decrypted on the
// self-read; the summary screen masks them at display time so a glance
// (or shoulder-surf) never exposes the full value.

export function maskIdentifier(value: string): string {
  const v = value.trim();
  if (v.length === 0) return '';
  if (v.length <= 4) return '••••';
  return `••••${v.slice(-4)}`;
}

// ── Blood group display ─────────────────────────────────────────────────

const BLOOD_LABELS: Record<string, string> = {
  A_POS: 'A+',
  A_NEG: 'A−',
  B_POS: 'B+',
  B_NEG: 'B−',
  AB_POS: 'AB+',
  AB_NEG: 'AB−',
  O_POS: 'O+',
  O_NEG: 'O−',
};

/** 'A_POS' → 'A+'. Returns null for UNKNOWN / unrecognized values so the
 *  screen renders its localized "not set" copy instead of a raw enum. */
export function bloodTypeDisplay(bloodType: string | null | undefined): string | null {
  if (!bloodType) return null;
  return BLOOD_LABELS[bloodType] ?? null;
}

// ── Status → tone maps ──────────────────────────────────────────────────

export function allergySeverityTone(severity: string): Tone {
  switch (severity) {
    case 'ANAPHYLAXIS':
    case 'SEVERE':
      return 'danger';
    case 'MODERATE':
      return 'warning';
    case 'MILD':
      return 'info';
    default:
      return 'neutral';
  }
}

export function dsarStatusTone(status: string): Tone {
  switch (status) {
    case 'PENDING':
      return 'warning';
    case 'APPROVED':
    case 'IN_PROGRESS':
      return 'info';
    case 'COMPLETED':
      return 'success';
    case 'REJECTED':
      return 'danger';
    case 'CANCELLED':
    case 'EXPIRED':
    default:
      return 'neutral';
  }
}

/** Subject cancel is only allowed while PENDING (backend
 *  CancelMyDsarRequestHandler: PENDING → CANCELLED, anything later 409s). */
export function isCancellableDsar(status: string): boolean {
  return status === 'PENDING';
}

// ── Emergency contact ordering ──────────────────────────────────────────

/** Priority 1 = highest. Missing priority sorts last; ties by name. */
export function sortContactsByPriority<T extends { priority?: number; name: string }>(
  contacts: readonly T[],
): T[] {
  return [...contacts].sort((a, b) => {
    const pa = a.priority ?? Number.MAX_SAFE_INTEGER;
    const pb = b.priority ?? Number.MAX_SAFE_INTEGER;
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name);
  });
}

// ── Allergy list partition ──────────────────────────────────────────────

const SEVERITY_RANK: Record<string, number> = {
  ANAPHYLAXIS: 3,
  SEVERE: 2,
  MODERATE: 1,
  MILD: 0,
};

export function partitionAllergies(list: readonly AllergyView[]): {
  active: AllergyView[];
  resolved: AllergyView[];
} {
  const active: AllergyView[] = [];
  const resolved: AllergyView[] = [];
  for (const a of list) {
    (a.status === 'RESOLVED' ? resolved : active).push(a);
  }
  const bySeverityThenName = (a: AllergyView, b: AllergyView): number => {
    const ra = SEVERITY_RANK[a.severity] ?? -1;
    const rb = SEVERITY_RANK[b.severity] ?? -1;
    if (ra !== rb) return rb - ra; // most severe first — safety-first ordering
    return a.allergenDisplay.localeCompare(b.allergenDisplay);
  };
  active.sort(bySeverityThenName);
  resolved.sort(bySeverityThenName);
  return { active, resolved };
}

// ── Shared date helper ──────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True when `value` is a real YYYY-MM-DD calendar date not after `nowMs`. */
export function isValidPastDate(value: string, nowMs: number): boolean {
  if (!DATE_RE.test(value)) return false;
  const ms = Date.parse(`${value}T00:00:00.000Z`);
  if (Number.isNaN(ms)) return false;
  return ms <= nowMs;
}

// ── BD identifier shape checks (mirror bdNationalIdentifiers.ts) ────────

export function normalizeNumericId(raw: string): string {
  return raw.replace(/[\s-]/g, '');
}

export function isValidNid(raw: string): boolean {
  const digits = normalizeNumericId(raw);
  return /^\d+$/.test(digits) && [10, 13, 17].includes(digits.length);
}

export function isValidBrn(raw: string): boolean {
  return /^\d{17}$/.test(normalizeNumericId(raw));
}

export function isValidHealthId(raw: string): boolean {
  return /^[A-Za-z0-9-]{4,32}$/.test(raw.trim());
}

// ── Profile edit form ───────────────────────────────────────────────────

export interface ProfileFormValues {
  birthDate: string;
  gender: '' | FhirGender;
  bloodType: '' | BloodType;
  lactationStatus: '' | LactationStatus;
  heightCm: string;
  nationalId: string;
  birthRegNo: string;
  healthId: string;
}

export function emptyProfileForm(): ProfileFormValues {
  return {
    birthDate: '',
    gender: '',
    bloodType: '',
    lactationStatus: '',
    heightCm: '',
    nationalId: '',
    birthRegNo: '',
    healthId: '',
  };
}

export function isEmptyProfileForm(v: ProfileFormValues): boolean {
  return (
    v.birthDate.trim() === '' &&
    v.gender === '' &&
    v.bloodType === '' &&
    v.lactationStatus === '' &&
    v.heightCm.trim() === '' &&
    v.nationalId.trim() === '' &&
    v.birthRegNo.trim() === '' &&
    v.healthId.trim() === ''
  );
}

const GENDERS: readonly FhirGender[] = ['male', 'female', 'other', 'unknown'];
const BLOOD_TYPES: readonly BloodType[] = [
  'A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG', 'UNKNOWN',
];
const LACTATION: readonly LactationStatus[] = ['LACTATING', 'NOT_LACTATING', 'UNKNOWN'];

/** Seed the edit form from the server profile (self-read is decrypted).
 *  Unrecognized server enum values degrade to '' (unselected) rather than
 *  crashing or fabricating a choice. */
export function seedProfileForm(profile: PatientProfileView | null): ProfileFormValues {
  if (!profile) return emptyProfileForm();
  const gender = GENDERS.find((g) => g === profile.gender) ?? '';
  const bloodType = BLOOD_TYPES.find((b) => b === profile.bloodType) ?? '';
  const lactationStatus = LACTATION.find((l) => l === profile.lactationStatus) ?? '';
  return {
    birthDate: profile.birthDate ?? '',
    gender,
    bloodType,
    lactationStatus,
    heightCm: profile.heightCm ?? '',
    nationalId: profile.nationalId ?? '',
    birthRegNo: profile.birthRegNo ?? '',
    healthId: profile.healthId ?? '',
  };
}

export type ProfileFormIssue =
  | { field: 'birthDate'; kind: 'INVALID' | 'FUTURE' }
  | { field: 'heightCm'; kind: 'INVALID' }
  | { field: 'nationalId' | 'birthRegNo' | 'healthId'; kind: 'INVALID' };

export type BuildProfileResult =
  | { ok: true; body: UpsertMyPatientProfileBody }
  | { ok: false; issue: ProfileFormIssue };

/**
 * Build the PUT /me/patient-profile body. Partial-update semantics per the
 * backend: a field the user filled is SENT; a field the user CLEARED that
 * the server previously held is sent as null (explicit clear); an untouched
 * empty field is OMITTED (unchanged). `server` is the last-known profile —
 * pass null when none exists (then empty fields are simply omitted, so a
 * failed profile read can never cause an accidental wipe).
 */
export function buildUpsertProfileBody(
  values: ProfileFormValues,
  server: PatientProfileView | null,
  nowMs: number,
): BuildProfileResult {
  const body: UpsertMyPatientProfileBody = {};

  const birthDate = values.birthDate.trim();
  if (birthDate !== '') {
    if (!DATE_RE.test(birthDate) || Number.isNaN(Date.parse(`${birthDate}T00:00:00.000Z`))) {
      return { ok: false, issue: { field: 'birthDate', kind: 'INVALID' } };
    }
    if (!isValidPastDate(birthDate, nowMs)) {
      return { ok: false, issue: { field: 'birthDate', kind: 'FUTURE' } };
    }
    body.birthDate = birthDate;
  } else if (server?.birthDate) {
    body.birthDate = null;
  }

  if (values.gender !== '') {
    body.gender = values.gender;
  } else if (server?.gender) {
    body.gender = null;
  }

  if (values.bloodType !== '') {
    body.bloodType = values.bloodType;
  } else if (server?.bloodType) {
    body.bloodType = null;
  }

  // No null clear on the wire for lactationStatus — 'UNKNOWN' is the reset;
  // an unselected chip leaves the server value unchanged.
  if (values.lactationStatus !== '') {
    body.lactationStatus = values.lactationStatus;
  }

  const height = values.heightCm.trim();
  if (height !== '') {
    const n = Number(height);
    if (!Number.isFinite(n) || n <= 0 || n > 300) {
      return { ok: false, issue: { field: 'heightCm', kind: 'INVALID' } };
    }
    body.heightCm = n;
  } else if (server?.heightCm) {
    body.heightCm = null;
  }

  const nationalId = values.nationalId.trim();
  if (nationalId !== '') {
    if (!isValidNid(nationalId)) {
      return { ok: false, issue: { field: 'nationalId', kind: 'INVALID' } };
    }
    body.nationalId = nationalId;
  } else if (server?.nationalId) {
    body.nationalId = null;
  }

  const birthRegNo = values.birthRegNo.trim();
  if (birthRegNo !== '') {
    if (!isValidBrn(birthRegNo)) {
      return { ok: false, issue: { field: 'birthRegNo', kind: 'INVALID' } };
    }
    body.birthRegNo = birthRegNo;
  } else if (server?.birthRegNo) {
    body.birthRegNo = null;
  }

  const healthId = values.healthId.trim();
  if (healthId !== '') {
    if (!isValidHealthId(healthId)) {
      return { ok: false, issue: { field: 'healthId', kind: 'INVALID' } };
    }
    body.healthId = healthId;
  } else if (server?.healthId) {
    body.healthId = null;
  }

  return { ok: true, body };
}

// ── Emergency contact form ──────────────────────────────────────────────

export interface ContactFormValues {
  name: string;
  relationship: string;
  phone: string;
  email: string;
  notes: string;
}

export function emptyContactForm(): ContactFormValues {
  return { name: '', relationship: '', phone: '', email: '', notes: '' };
}

export type ContactFormIssue =
  | { field: 'name'; kind: 'REQUIRED' }
  | { field: 'relationship'; kind: 'REQUIRED' }
  | { field: 'phone'; kind: 'INVALID' }
  | { field: 'email'; kind: 'INVALID' };

export type BuildContactResult =
  | { ok: true; body: CreateEmergencyContactBody }
  | { ok: false; issue: ContactFormIssue };

const BD_PHONE_RE = /^\+8801\d{9}$/;
// Deliberately loose — the backend enforces the full RFC shape; this only
// catches obvious typos before a round-trip.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Build POST /me/emergency-contacts body. Normalizes the phone through the
 *  shared +880 formatter, then enforces the backend's ^\+8801\d{9}$ rule. */
export function buildEmergencyContactBody(values: ContactFormValues): BuildContactResult {
  const name = values.name.trim();
  if (name === '' || name.length > 120) {
    return { ok: false, issue: { field: 'name', kind: 'REQUIRED' } };
  }
  const relationship = values.relationship.trim();
  if (relationship === '' || relationship.length > 40) {
    return { ok: false, issue: { field: 'relationship', kind: 'REQUIRED' } };
  }
  const phoneE164 = formatPhoneBd(values.phone);
  if (!BD_PHONE_RE.test(phoneE164)) {
    return { ok: false, issue: { field: 'phone', kind: 'INVALID' } };
  }
  const email = values.email.trim();
  if (email !== '' && !EMAIL_RE.test(email)) {
    return { ok: false, issue: { field: 'email', kind: 'INVALID' } };
  }
  const notes = values.notes.trim();
  return {
    ok: true,
    body: {
      name,
      relationship,
      phoneE164,
      // Required key on the wire — null when the contact has no email.
      email: email === '' ? null : email,
      ...(notes !== '' ? { notes: notes.slice(0, 1000) } : {}),
    },
  };
}

// ── Allergy form ────────────────────────────────────────────────────────

export const ALLERGY_SEVERITIES: readonly AllergySeverity[] = [
  'MILD',
  'MODERATE',
  'SEVERE',
  'ANAPHYLAXIS',
];

export interface AllergyFormValues {
  allergen: string;
  severity: '' | AllergySeverity;
  reaction: string;
  onsetDate: string;
}

export function emptyAllergyForm(): AllergyFormValues {
  return { allergen: '', severity: '', reaction: '', onsetDate: '' };
}

export type AllergyFormIssue =
  | { field: 'allergen'; kind: 'REQUIRED' }
  | { field: 'severity'; kind: 'REQUIRED' }
  | { field: 'onsetDate'; kind: 'INVALID' };

export type BuildAllergyResult =
  | { ok: true; body: RecordAllergyBody }
  | { ok: false; issue: AllergyFormIssue };

/** Build POST /me/allergies body (recordAllergySchema: allergen.display +
 *  severity required; reaction/onsetDate optional). */
export function buildRecordAllergyBody(
  values: AllergyFormValues,
  nowMs: number,
): BuildAllergyResult {
  const display = values.allergen.trim();
  if (display === '' || display.length > 255) {
    return { ok: false, issue: { field: 'allergen', kind: 'REQUIRED' } };
  }
  if (values.severity === '') {
    return { ok: false, issue: { field: 'severity', kind: 'REQUIRED' } };
  }
  const onset = values.onsetDate.trim();
  if (onset !== '' && !isValidPastDate(onset, nowMs)) {
    return { ok: false, issue: { field: 'onsetDate', kind: 'INVALID' } };
  }
  const reaction = values.reaction.trim();
  return {
    ok: true,
    body: {
      allergen: { display, system: 'custom' },
      severity: values.severity,
      ...(reaction !== '' ? { reaction: reaction.slice(0, 1000) } : {}),
      ...(onset !== '' ? { onsetDate: onset } : {}),
    },
  };
}
