// Doctor patient search + summary — pure logic (no RN imports; covered by
// __tests__/doctor-patients.test.ts in a Node environment).

import type { ApiError } from '@/api/errors';
import type { Language } from '@/i18n/types';

import type {
  AllergyRow,
  BloodType,
  DoctorPatientDetail,
  VitalRow,
} from './types';

// ─── Search input ────────────────────────────────────────────────────────────

/** Server bound: searchBodySchema max 100 chars. */
export const SEARCH_QUERY_MAX = 100;

/** Trim + clamp the raw input to what the server accepts. */
export function clampSearchQuery(raw: string): string {
  return raw.trim().slice(0, SEARCH_QUERY_MAX);
}

/** True when the clamped query is worth sending (server min 1 char). */
export function isSearchable(raw: string): boolean {
  return clampSearchQuery(raw).length > 0;
}

// ─── Display helpers ─────────────────────────────────────────────────────────

/** Short display fragment of a patient UUID — the first group. The panel
 *  search matches patientId substrings, so this is the token the doctor
 *  correlates against. */
export function shortPatientRef(patientId: string): string {
  const first = patientId.split('-')[0];
  return (first !== undefined && first.length > 0 ? first : patientId).toUpperCase();
}

/** Full name when the backend surfaced one (P0-070), else null so the
 *  caller falls back to the initials token — never a fabricated name. */
export function displayNameOf(detail: DoctorPatientDetail | null): string | null {
  const name = detail?.fullName?.trim();
  return name !== undefined && name.length > 0 ? name : null;
}

/** True when every write CTA must be hidden (backend DECEASED record lock). */
export function writesLocked(detail: DoctorPatientDetail | null): boolean {
  return detail?.status === 'DECEASED';
}

const BLOOD_TYPE_DISPLAY: Record<BloodType, string | null> = {
  A_POS: 'A+',
  A_NEG: 'A−',
  B_POS: 'B+',
  B_NEG: 'B−',
  AB_POS: 'AB+',
  AB_NEG: 'AB−',
  O_POS: 'O+',
  O_NEG: 'O−',
  UNKNOWN: null,
};

/** "A_POS" → "A+"; null for UNKNOWN/absent (render nothing, not a guess). */
export function bloodTypeDisplay(value: string | null | undefined): string | null {
  if (!value) return null;
  return BLOOD_TYPE_DISPLAY[value as BloodType] ?? null;
}

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'] as const;

/** Localize ASCII digits inside a string (e.g. the "20–30" age bracket). */
export function localizeDigits(value: string, lang: Language): string {
  if (lang !== 'bn') return value;
  return value.replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)] ?? d);
}

/** Locale-aware plain number (mirrors the sibling features' helper). */
export function formatNumber(value: number, lang: Language): string {
  return value.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-GB');
}

// ─── Consent / error classification ─────────────────────────────────────────

/** 403 on a clinical read = the consent/authorization gate denied — render
 *  the honest locked state, NEVER a generic error. */
export function isConsentDenied(error: ApiError | null): boolean {
  return error !== null && error.code === 'FORBIDDEN';
}

// ─── Allergies (clinical safety) ─────────────────────────────────────────────

const SEVERITY_RANK: Record<string, number> = {
  ANAPHYLAXIS: 0,
  SEVERE: 1,
  MODERATE: 2,
  MILD: 3,
};

/** Keep everything that is not explicitly RESOLVED (an allergy with an
 *  unknown future status must stay visible — fail safe), most severe
 *  first, stable within equal severity. */
export function visibleAllergies(rows: AllergyRow[] | null | undefined): AllergyRow[] {
  const kept = (rows ?? []).filter((r) => r.status !== 'RESOLVED');
  return kept
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const ra = SEVERITY_RANK[a.row.severity] ?? 4;
      const rb = SEVERITY_RANK[b.row.severity] ?? 4;
      if (ra !== rb) return ra - rb;
      return a.index - b.index;
    })
    .map((e) => e.row);
}

/** Free-text allergen strings from the detail bundle that are not already
 *  covered by a structured row (case-insensitive) — shown as extra danger
 *  pills so nothing recorded ever disappears. */
export function extraAllergyStrings(
  detail: DoctorPatientDetail | null,
  structured: AllergyRow[],
): string[] {
  const seen = new Set(structured.map((r) => r.allergenDisplay.trim().toLowerCase()));
  const out: string[] = [];
  for (const raw of detail?.structuredAllergyDisplays ?? []) {
    const label = raw.trim();
    if (label.length === 0) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}

// ─── Status → tone maps (StatusPill tones; locked theme colors) ─────────────

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export function prescriptionStatusTone(status: string): Tone {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'DISPENSED':
      return 'info';
    case 'EXPIRED':
      return 'warning';
    case 'CANCELLED':
      return 'danger';
    case 'DRAFT':
    default:
      return 'neutral';
  }
}

export function labOrderStatusTone(status: string): Tone {
  switch (status) {
    case 'COMPLETED':
      return 'success';
    case 'IN_PROGRESS':
      return 'info';
    case 'PENDING':
      return 'warning';
    case 'CANCELLED':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function labOrderPriorityTone(priority: string | undefined): Tone {
  switch (priority) {
    case 'STAT':
      return 'danger';
    case 'URGENT':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function medicationStatusTone(status: string): Tone {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'PAUSED':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function conditionSeverityTone(severity: string | undefined): Tone {
  switch (severity) {
    case 'SEVERE':
      return 'danger';
    case 'MODERATE':
      return 'warning';
    case 'MILD':
      return 'neutral';
    default:
      return 'neutral';
  }
}

// ─── Vitals ──────────────────────────────────────────────────────────────────

const UNIT_DISPLAY: Record<string, string> = {
  celsius: '°C',
  fahrenheit: '°F',
};

/** "120/80 mmHg" for BP; "37.2 °C" style otherwise. Locale-aware digits. */
export function formatVitalValue(row: VitalRow, lang: Language): string {
  const unit = UNIT_DISPLAY[row.unit] ?? row.unit;
  const main = formatNumber(row.valueQuantity, lang);
  if (row.valueSecondary !== null && row.valueSecondary !== undefined) {
    return `${main}/${formatNumber(row.valueSecondary, lang)} ${unit}`.trim();
  }
  return `${main} ${unit}`.trim();
}

// ─── Misc ────────────────────────────────────────────────────────────────────

/** Join non-empty display parts with a middot. */
export function joinParts(parts: (string | null | undefined)[]): string {
  return parts
    .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
    .join(' · ');
}

/** Lab order tests → "CBC, HbA1c" (name preferred, code fallback). */
export function labTestsSummary(
  tests: { code?: string; name?: string }[] | null | undefined,
): string {
  return (tests ?? [])
    .map((t) => {
      const name = t.name?.trim();
      if (name !== undefined && name.length > 0) return name;
      const code = t.code?.trim();
      return code !== undefined && code.length > 0 ? code : null;
    })
    .filter((s): s is string => s !== null)
    .join(', ');
}
