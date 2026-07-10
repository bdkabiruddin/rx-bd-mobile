// Patient vitals — pure presentation/domain logic.
//
// Deliberately free of React/React Native imports so the whole module is
// unit-testable in the fast Node jest environment (see
// __tests__/patient-vitals.test.ts).
//
// The plausibility gate MIRRORS the backend VitalReading domain factory
// (src/modules/vital-reading/domain/VitalReading.ts): same ranges, same
// ordinal-score zero exemption, same BP two-limb rule. The server stays
// authoritative — this only refuses obviously impossible values before a
// round-trip.

import type { Language } from '@/i18n/types';

import type { RecordVitalBody, VitalReadingView, VitalType, VitalUnit } from './types';

// ── Vital-type catalog ──────────────────────────────────────────────────

/** Canonical order (mirrors vitalTypeSchema) — drives chip ordering. */
export const VITAL_TYPES: readonly VitalType[] = [
  'BLOOD_PRESSURE',
  'HEART_RATE',
  'TEMPERATURE',
  'BLOOD_GLUCOSE',
  'WEIGHT',
  'HEIGHT',
  'OXYGEN_SATURATION',
  'RESPIRATORY_RATE',
  'PAIN_SCORE',
  'GCS',
  'MUAC',
  'BMI',
];

/** Types a patient can self-enter in the diary. GCS / MUAC / BMI are
 *  clinician-scored or derived, so they render in history but are not
 *  offered in the add form. */
export const PATIENT_ENTRY_TYPES = [
  'BLOOD_PRESSURE',
  'HEART_RATE',
  'TEMPERATURE',
  'BLOOD_GLUCOSE',
  'WEIGHT',
  'HEIGHT',
  'OXYGEN_SATURATION',
  'RESPIRATORY_RATE',
  'PAIN_SCORE',
] as const;

export type PatientVitalType = (typeof PATIENT_ENTRY_TYPES)[number];

/** Unit the app records each self-entered type in. Pinned to the units the
 *  backend plausibility band is calibrated for (the band is unit-agnostic
 *  server-side, so e.g. °F or low mmol/L values would bounce — see gaps). */
export const ENTRY_UNITS: Record<PatientVitalType, VitalUnit> = {
  BLOOD_PRESSURE: 'mmHg',
  HEART_RATE: 'bpm',
  TEMPERATURE: 'celsius',
  BLOOD_GLUCOSE: 'mg/dL',
  WEIGHT: 'kg',
  HEIGHT: 'cm',
  OXYGEN_SATURATION: '%',
  RESPIRATORY_RATE: 'breaths/min',
  PAIN_SCORE: 'score',
};

/** Mirrors the backend PLAUSIBLE_RANGES exactly. */
export const PLAUSIBLE_RANGES: Record<VitalType, { min: number; max: number }> = {
  BLOOD_PRESSURE: { min: 30, max: 350 },
  HEART_RATE: { min: 20, max: 250 },
  TEMPERATURE: { min: 25, max: 45 },
  BLOOD_GLUCOSE: { min: 10, max: 1000 },
  WEIGHT: { min: 0.5, max: 500 },
  HEIGHT: { min: 30, max: 280 },
  OXYGEN_SATURATION: { min: 30, max: 100 },
  RESPIRATORY_RATE: { min: 5, max: 80 },
  PAIN_SCORE: { min: 0, max: 10 },
  GCS: { min: 3, max: 15 },
  MUAC: { min: 5, max: 60 },
  BMI: { min: 8, max: 100 },
};

/** Mirrors the backend ORDINAL_SCORE_TYPES — a zero value is legitimate. */
const ORDINAL_SCORE_TYPES: ReadonlySet<string> = new Set(['PAIN_SCORE', 'GCS']);

export const isBloodPressure = (vitalType: string): boolean =>
  vitalType === 'BLOOD_PRESSURE';

// ── Display helpers (language-neutral symbols; words live in strings.ts) ─

const UNIT_SYMBOL: Readonly<Record<string, string>> = {
  mmHg: 'mmHg',
  bpm: 'bpm',
  celsius: '°C',
  fahrenheit: '°F',
  'mg/dL': 'mg/dL',
  'mmol/L': 'mmol/L',
  kg: 'kg',
  lb: 'lb',
  cm: 'cm',
  in: 'in',
  '%': '%',
  'breaths/min': '/min',
  score: '',
  'kg/m2': 'kg/m²',
};

/** Printable symbol for a wire unit; raw value when unknown, '' for score. */
export function unitSymbol(unit: string): string {
  return UNIT_SYMBOL[unit] ?? unit;
}

/** Locale-aware plain number (Bangla numerals for bn). */
export function formatVitalNumber(value: number, lang: Language): string {
  return value.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-GB', {
    maximumFractionDigits: 2,
  });
}

/** "120/80 mmHg", "36.8 °C", "7/10" (pain), "14/15" (GCS). */
export function formatVitalValue(
  r: Pick<VitalReadingView, 'vitalType' | 'valueQuantity' | 'valueSecondary' | 'unit'>,
  lang: Language,
): string {
  const q = formatVitalNumber(r.valueQuantity, lang);
  if (isBloodPressure(r.vitalType) && r.valueSecondary !== null && r.valueSecondary !== undefined) {
    return `${q}/${formatVitalNumber(r.valueSecondary, lang)} ${unitSymbol(r.unit)}`;
  }
  if (r.vitalType === 'PAIN_SCORE') return `${q}/${formatVitalNumber(10, lang)}`;
  if (r.vitalType === 'GCS') return `${q}/${formatVitalNumber(15, lang)}`;
  const sym = unitSymbol(r.unit);
  return sym.length > 0 ? `${q} ${sym}` : q;
}

/** Time-of-day (Asia/Dhaka) for a reading row — the day itself is carried
 *  by the group header (formatDate). Same Dhaka pinning as i18n/formatters. */
export function formatTimeOfDay(iso: string, lang: Language): string {
  return new Date(iso).toLocaleTimeString(lang === 'bn' ? 'bn-BD' : 'en-GB', {
    timeZone: 'Asia/Dhaka',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Status / source → StatusPill tone ───────────────────────────────────

/** Mirrors src/ui/StatusPill's StatusTone union (kept as literals so this
 *  module never imports React Native). */
export type VitalTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export function vitalStatusTone(status: string | undefined): VitalTone {
  switch (status) {
    case 'OBSERVED_OUT_OF_RANGE':
      return 'danger';
    case 'AMENDED':
      return 'info';
    case 'RECORDED':
    default:
      return 'neutral';
  }
}

export function vitalSourceTone(source: string | undefined): VitalTone {
  return source === 'PATIENT' ? 'info' : 'neutral';
}

// ── History grouping / filtering ────────────────────────────────────────

/** Bangladesh is UTC+6 with no DST — fixed-offset day math is exact (same
 *  convention as patient-appointments/logic.ts). */
export const DHAKA_UTC_OFFSET_MS = 6 * 60 * 60 * 1000;

/** Dhaka-local YYYY-MM-DD for an ISO timestamp; null when unparseable. */
export function dayKeyDhaka(iso: string): string | null {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  const d = new Date(ms + DHAKA_UTC_OFFSET_MS);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface VitalDayGroup {
  /** Dhaka-local YYYY-MM-DD ('unknown' for unparseable timestamps). */
  day: string;
  items: VitalReadingView[];
}

/** Newest first, grouped by Dhaka-local calendar day. */
export function groupReadingsByDay(
  readings: readonly VitalReadingView[],
): VitalDayGroup[] {
  const timeOf = (r: VitalReadingView): number => {
    const ms = Date.parse(r.effectiveAt);
    return Number.isNaN(ms) ? 0 : ms;
  };
  const sorted = [...readings].sort((a, b) => timeOf(b) - timeOf(a));
  const groups: VitalDayGroup[] = [];
  for (const r of sorted) {
    const key = dayKeyDhaka(r.effectiveAt) ?? 'unknown';
    const last = groups[groups.length - 1];
    if (last !== undefined && last.day === key) {
      last.items.push(r);
    } else {
      groups.push({ day: key, items: [r] });
    }
  }
  return groups;
}

/** Distinct vital types present in the data, in canonical order — drives
 *  the filter chip row (only offered when the data supports it). */
export function typesPresent(
  readings: readonly VitalReadingView[] | undefined,
): VitalType[] {
  if (!readings || readings.length === 0) return [];
  const present = new Set<string>();
  for (const r of readings) present.add(r.vitalType);
  return VITAL_TYPES.filter((t) => present.has(t));
}

export function filterByType(
  readings: readonly VitalReadingView[],
  vitalType: string | null,
): VitalReadingView[] {
  if (vitalType === null) return [...readings];
  return readings.filter((r) => r.vitalType === vitalType);
}

// ── Measured-at (Dhaka wall-clock ⇄ ISO) ────────────────────────────────

/** Dhaka-local { date: YYYY-MM-DD, time: HH:MM } parts for an instant —
 *  used to prefill "measured at" with now. */
export function dhakaDateTimeParts(now: Date): { date: string; time: string } {
  const d = new Date(now.getTime() + DHAKA_UTC_OFFSET_MS);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const h = String(d.getUTCHours()).padStart(2, '0');
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  return { date: `${y}-${mo}-${day}`, time: `${h}:${mi}` };
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
  // Round-trip guard: a rolled-over calendar day (engine-dependent) must not
  // silently shift the reading to a different date.
  if (dayKeyDhaka(new Date(ms).toISOString()) !== dt) return null;
  return ms;
}

/** Small allowance for device-clock skew when refusing future timestamps. */
export const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

// ── Add-form validation + body build (mirrors the backend factory) ──────

export interface VitalDraftValues {
  vitalType: PatientVitalType;
  /** Raw text inputs — parsed/validated here. */
  value: string;
  /** BP diastolic input; ignored for other types. */
  secondary: string;
  /** Dhaka-local measured-at parts. */
  date: string;
  time: string;
  notes: string;
}

/** Fresh add-form draft, measured-at defaulting to now (Dhaka). */
export function makeEmptyDraft(now: Date): VitalDraftValues {
  const { date, time } = dhakaDateTimeParts(now);
  return { vitalType: 'BLOOD_PRESSURE', value: '', secondary: '', date, time, notes: '' };
}

export type VitalFormIssue =
  | { kind: 'VALUE_REQUIRED' }
  | { kind: 'VALUE_INVALID' }
  | { kind: 'DIASTOLIC_REQUIRED' }
  | { kind: 'RANGE'; field: 'value' | 'diastolic'; min: number; max: number }
  | { kind: 'DATETIME_INVALID' }
  | { kind: 'DATETIME_FUTURE' };

/** Lenient numeric parse of a text input; null when not a finite number. */
export function parseValueInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export type BuildVitalBodyResult =
  | { ok: true; body: RecordVitalBody }
  | { ok: false; issue: VitalFormIssue };

/** Validate the draft exactly the way the backend factory will, then build
 *  the POST body. Refuses obviously impossible values client-side; the
 *  server remains authoritative. */
export function buildRecordVitalBody(
  d: VitalDraftValues,
  nowMs: number,
): BuildVitalBodyResult {
  // A restored draft is untyped at runtime — refuse an unknown vital type
  // instead of posting an invalid body (the user re-picks from the chips).
  const entryUnit: VitalUnit | undefined = ENTRY_UNITS[d.vitalType];
  const range: { min: number; max: number } | undefined = PLAUSIBLE_RANGES[d.vitalType];
  if (entryUnit === undefined || range === undefined) {
    return { ok: false, issue: { kind: 'VALUE_INVALID' } };
  }

  if (d.value.trim().length === 0) {
    return { ok: false, issue: { kind: 'VALUE_REQUIRED' } };
  }
  const value = parseValueInput(d.value);
  if (value === null) return { ok: false, issue: { kind: 'VALUE_INVALID' } };

  // Numeric sanity — ordinal scores (pain) may legitimately be zero.
  const ordinal = ORDINAL_SCORE_TYPES.has(d.vitalType);
  if (ordinal ? value < 0 : value <= 0) {
    return { ok: false, issue: { kind: 'VALUE_INVALID' } };
  }

  // BP shape — must have a diastolic limb; nothing else may (the form only
  // shows the second field for BP, so non-BP secondary is simply ignored).
  let secondary: number | null = null;
  if (isBloodPressure(d.vitalType)) {
    if (d.secondary.trim().length === 0) {
      return { ok: false, issue: { kind: 'DIASTOLIC_REQUIRED' } };
    }
    secondary = parseValueInput(d.secondary);
    if (secondary === null || secondary <= 0) {
      return { ok: false, issue: { kind: 'VALUE_INVALID' } };
    }
  }

  // Plausibility band — identical numbers to the backend gate.
  if (value < range.min || value > range.max) {
    return {
      ok: false,
      issue: { kind: 'RANGE', field: 'value', min: range.min, max: range.max },
    };
  }
  if (secondary !== null && (secondary < range.min || secondary > range.max)) {
    return {
      ok: false,
      issue: { kind: 'RANGE', field: 'diastolic', min: range.min, max: range.max },
    };
  }

  const measuredMs = parseDhakaDateTimeMs(d.date, d.time);
  if (measuredMs === null) {
    return { ok: false, issue: { kind: 'DATETIME_INVALID' } };
  }
  if (measuredMs > nowMs + FUTURE_TOLERANCE_MS) {
    return { ok: false, issue: { kind: 'DATETIME_FUTURE' } };
  }

  const notes = d.notes.trim();
  return {
    ok: true,
    body: {
      vitalType: d.vitalType,
      valueQuantity: value,
      ...(secondary !== null ? { valueSecondary: secondary } : {}),
      unit: entryUnit,
      source: 'PATIENT',
      effectiveAt: new Date(measuredMs).toISOString(),
      ...(notes.length > 0 ? { notes } : {}),
    },
  };
}
