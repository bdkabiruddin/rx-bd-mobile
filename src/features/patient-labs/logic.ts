// Patient labs — pure presentation/mapping logic. No React, no React
// Native imports: this module is unit-tested in a Node jest environment
// (__tests__/patient-labs.test.ts).
//
// Clinical-safety posture: every mapping here degrades to an HONEST
// fallback (neutral tone, "unstructured" payload) — nothing is inferred
// beyond what the backend explicitly sent. Abnormal-flag pills render
// ONLY when the backend supplied a flag.

import type { LabOrderTestView } from './types';

/** Same literal union as src/ui/StatusPill's StatusTone — duplicated so
 *  this module stays free of react-native imports. */
export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

/** LabOrder lifecycle → pill tone. Unknown values stay neutral.
 *  Danger is deliberately NOT used for order states in this feature —
 *  red is reserved for abnormal result flags. */
export function orderStatusTone(status: string | undefined): Tone {
  switch (status) {
    case 'PENDING':
      return 'neutral';
    case 'IN_PROGRESS':
      return 'info';
    case 'COMPLETED':
      return 'success';
    case 'CANCELLED':
      return 'warning';
    default:
      return 'neutral';
  }
}

/** LabResult verification state → pill tone. Patients only ever
 *  receive RELEASED rows; PRELIMINARY is mapped defensively. */
export function resultStatusTone(status: string | undefined): Tone {
  switch (status) {
    case 'RELEASED':
      return 'success';
    case 'PRELIMINARY':
      return 'warning';
    default:
      return 'neutral';
  }
}

/**
 * Backend-provided abnormality flag → pill tone, or null when the
 * backend sent no flag (in which case NO pill renders — the app never
 * computes normal/abnormal itself from value vs range).
 * An unrecognized non-empty flag maps to `warning`: a future backend
 * flag value is still a flag, and under-alerting is the unsafe failure.
 */
export function flagTone(flag: string | null | undefined): Tone | null {
  switch (flag) {
    case 'normal':
      return 'success';
    case 'low':
    case 'high':
    case 'abnormal':
      return 'warning';
    case 'critical-low':
    case 'critical-high':
      return 'danger';
    default:
      return typeof flag === 'string' && flag.length > 0 ? 'warning' : null;
  }
}

/** "3.5–5.1" / "≥ 3.5" / "≤ 5.1" / null — from the backend's optional
 *  reference band. Locale-neutral digits (lab values are read against
 *  the printed report; transliterating them risks misreads). */
export function refRangeText(
  low: number | undefined,
  high: number | undefined,
): string | null {
  const hasLow = typeof low === 'number' && Number.isFinite(low);
  const hasHigh = typeof high === 'number' && Number.isFinite(high);
  if (hasLow && hasHigh) return `${low}–${high}`;
  if (hasLow) return `≥ ${low}`;
  if (hasHigh) return `≤ ${high}`;
  return null;
}

/** Comma-joined human test names for a lab order; falls back to the
 *  test code when the captured name is missing. Empty string when the
 *  order carries no renderable test lines. */
export function testNamesLine(tests: LabOrderTestView[] | undefined): string {
  const names: string[] = [];
  for (const test of tests ?? []) {
    const name = test.name?.trim();
    const code = test.code?.trim();
    const label = name && name.length > 0 ? name : code;
    if (typeof label === 'string' && label.length > 0) names.push(label);
  }
  return names.join(', ');
}

/** Join defined, non-empty parts with a middle dot (list row subtitles). */
export function joinParts(parts: (string | undefined | null)[]): string {
  return parts
    .filter((p): p is string => typeof p === 'string' && p.length > 0)
    .join(' · ');
}

// ── Result payload normalization ─────────────────────────────────────────────
//
// The backend payload is a discriminated union on `kind` with a legacy
// free-form fallback. The app renders ONLY the tagged shapes it can
// faithfully display; anything else becomes an explicit "unstructured"
// marker the screen turns into an honest can't-display notice.

/** One displayable analyte line. */
export interface AnalyteRow {
  analyte: string | null;
  /** Raw numeric value, stringified without locale games. */
  value: string;
  unit: string | null;
  /** Pre-formatted reference band, e.g. "3.5–5.1". */
  refRange: string | null;
  /** Backend-provided flag verbatim; null = no flag → no pill. */
  flag: string | null;
  /** Analyser/methodology comment (backend guarantees non-PHI). */
  comment: string | null;
}

export type NormalizedResult =
  | { kind: 'analytes'; panel: string | null; rows: AnalyteRow[] }
  | { kind: 'text'; analyte: string | null; text: string }
  | { kind: 'unstructured' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function optionalFinite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

/** Narrow one `kind: 'numeric'` item to a displayable row; null when
 *  the item is not a well-formed numeric result. */
function numericRow(value: unknown): AnalyteRow | null {
  if (!isRecord(value) || value.kind !== 'numeric') return null;
  if (typeof value.value !== 'number' || !Number.isFinite(value.value)) {
    return null;
  }
  return {
    analyte: optionalString(value.analyte),
    value: String(value.value),
    unit: optionalString(value.unit),
    refRange: refRangeText(
      optionalFinite(value.refRangeLow),
      optionalFinite(value.refRangeHigh),
    ),
    flag: optionalString(value.flag),
    comment: optionalString(value.comment),
  };
}

/**
 * Normalize a wire payload into something the detail screen can render.
 * Tagged 'numeric' / 'multi-analyte' / 'text' shapes map to rows; the
 * legacy free-form record (no `kind`) and every malformed shape map to
 * 'unstructured' — the screen then says so instead of guessing.
 */
export function normalizeResultPayload(payload: unknown): NormalizedResult {
  if (!isRecord(payload)) return { kind: 'unstructured' };

  if (payload.kind === 'numeric') {
    const row = numericRow(payload);
    return row
      ? { kind: 'analytes', panel: null, rows: [row] }
      : { kind: 'unstructured' };
  }

  if (payload.kind === 'multi-analyte') {
    const items = Array.isArray(payload.items) ? payload.items : [];
    const rows: AnalyteRow[] = [];
    for (const item of items) {
      const row = numericRow(item);
      if (row) rows.push(row);
    }
    return rows.length > 0
      ? { kind: 'analytes', panel: optionalString(payload.panel), rows }
      : { kind: 'unstructured' };
  }

  if (payload.kind === 'text') {
    const text = optionalString(payload.value);
    return text
      ? { kind: 'text', analyte: optionalString(payload.analyte), text }
      : { kind: 'unstructured' };
  }

  // Legacy free-form record or an unknown tagged shape — never guess.
  return { kind: 'unstructured' };
}
