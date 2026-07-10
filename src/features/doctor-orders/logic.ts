// Doctor lab orders + results inbox — pure presentation/mapping logic.
// No React, no React Native imports: unit-tested in a Node jest
// environment (__tests__/doctor-orders.test.ts).
//
// Clinical-safety posture: every mapping degrades to an HONEST fallback
// (neutral tone, "unstructured" payload) — nothing is inferred beyond
// what the backend explicitly sent. Abnormal flags render as pills ONLY
// when the data provides them; the app never classifies values itself.

import type { Language } from '@/i18n/types';

import type {
  CatalogEntry,
  OrderTest,
  OrderTestRef,
  PlaceLabOrderBody,
  ResultsInboxRow,
} from './types';

/** Same literal union as src/ui/StatusPill's StatusTone — duplicated so
 *  this module stays free of react-native imports. */
export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

// ─── Pills / labels ──────────────────────────────────────────────────────────

/** LabOrder lifecycle → pill tone. Unknown values stay neutral — red is
 *  reserved for result-abnormality flags, never order states. */
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

/** Order priority → pill tone (STAT is the drop-everything signal). */
export function priorityTone(priority: string | undefined): Tone {
  switch (priority) {
    case 'STAT':
      return 'danger';
    case 'URGENT':
      return 'warning';
    default:
      return 'neutral';
  }
}

/**
 * Backend-provided abnormality flag / FHIR-style interpretation → pill
 * tone, or null when there is no flag (in which case NO pill renders).
 *
 * Vocabulary union across the backend writers:
 *   - domain tagged payloads: 'normal' | 'low' | 'high' |
 *     'critical-low' | 'critical-high' | 'abnormal'
 *   - lab-portal legacy interpretation letters: 'N' | 'H' | 'L' | 'A'
 *     ('A' is stamped for critical values — the web doctor portal
 *      renders it as critical; mirrored here)
 *   - lab-portal classification codes: 'C-H' | 'C-L'
 *
 * An unrecognized non-empty flag maps to `warning`: a future backend
 * flag is still a flag, and under-alerting is the unsafe failure.
 */
export function flagTone(flag: string | null | undefined): Tone | null {
  switch (flag) {
    case 'N':
    case 'normal':
      return 'success';
    case 'H':
    case 'L':
    case 'high':
    case 'low':
    case 'abnormal':
      return 'warning';
    case 'A':
    case 'C-H':
    case 'C-L':
    case 'critical-low':
    case 'critical-high':
      return 'danger';
    default:
      return typeof flag === 'string' && flag.trim().length > 0 ? 'warning' : null;
  }
}

// ─── Display helpers ─────────────────────────────────────────────────────────

/** Short display fragment of a patient UUID — the first hyphen group,
 *  uppercased (matches the sibling doctor features). */
export function shortPatientRef(patientId: string): string {
  const first = patientId.split('-')[0];
  return (first !== undefined && first.length > 0 ? first : patientId).toUpperCase();
}

/** Inbox rows carry an opaque server token ("PT-XXXX"); fall back to the
 *  local short ref, then an empty string — never a fabricated name. */
export function patientRefLabel(row: {
  patientInitials?: string;
  patientId?: string;
}): string {
  const token = row.patientInitials?.trim();
  if (token !== undefined && token.length > 0) return token;
  const id = row.patientId?.trim();
  if (id !== undefined && id.length > 0) return shortPatientRef(id);
  return '';
}

/** Join defined, non-empty parts with a middle dot (list row subtitles). */
export function joinParts(parts: (string | null | undefined)[]): string {
  return parts
    .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
    .join(' · ');
}

/** {code,name} test refs → "CBC, HbA1c" (name preferred, code fallback). */
export function testNamesLine(tests: OrderTestRef[] | null | undefined): string {
  const names: string[] = [];
  for (const test of tests ?? []) {
    const name = test.name?.trim();
    const code = test.code?.trim();
    const label = name !== undefined && name.length > 0 ? name : code;
    if (typeof label === 'string' && label.length > 0) names.push(label);
  }
  return names.join(', ');
}

/** Inbox rows carry test display names as plain strings. */
export function inboxTestsLine(tests: string[] | null | undefined): string {
  return (tests ?? [])
    .filter((name): name is string => typeof name === 'string' && name.trim().length > 0)
    .map((name) => name.trim())
    .join(', ');
}

/** Locale-aware plain integer (mirrors the sibling features' helper). */
export function formatNumber(value: number, lang: Language): string {
  return value.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-GB');
}

/** Catalog entry display name for the active language; the ORDER body
 *  always carries the canonical English displayName (historical record
 *  consistency — see buildOrderTest). */
export function catalogEntryLabel(entry: CatalogEntry, lang: Language): string {
  if (lang === 'bn') {
    const bn = entry.displayNameBn?.trim();
    if (bn !== undefined && bn.length > 0) return bn;
  }
  const en = entry.displayName?.trim();
  return en !== undefined && en.length > 0 ? en : entry.code;
}

// ─── Search input clamp ──────────────────────────────────────────────────────

/** Server caps: patient search body query ≤ 100; catalog q ≤ 100. */
export const SEARCH_QUERY_MAX = 100;

export function clampQuery(raw: string): string {
  return raw.trim().slice(0, SEARCH_QUERY_MAX);
}

export function isSearchable(raw: string): boolean {
  return clampQuery(raw).length > 0;
}

// ─── Results inbox (unacknowledged model) ────────────────────────────────────
//
// The list endpoint returns COMPLETED orders with results but carries NO
// acknowledged flag and does not filter acknowledged rows (backend gap —
// reported upstream). The app compensates honestly with a session-local
// set of result ids whose acknowledgement the SERVER confirmed (either a
// successful POST /acknowledge or a detail read showing
// acknowledgedByDoctorAt). Filtering uses only that server-confirmed set.

/** Rows still needing review, doctor-voice ordered: critical first, then
 *  newest result first (mirrors the web inbox). Rows without a result id
 *  are dropped — they cannot be opened or acknowledged. */
export function visibleInboxRows(
  rows: ResultsInboxRow[] | null | undefined,
  acked: Readonly<Record<string, boolean>>,
): ResultsInboxRow[] {
  const kept = (rows ?? []).filter(
    (r): r is ResultsInboxRow =>
      typeof r?.latestResultId === 'string' &&
      r.latestResultId.length > 0 &&
      acked[r.latestResultId] !== true,
  );
  return [...kept].sort((a, b) => {
    const aCrit = a.hasCritical === true;
    const bCrit = b.hasCritical === true;
    if (aCrit !== bCrit) return aCrit ? -1 : 1;
    return timeOf(b.latestResultAt) - timeOf(a.latestResultAt);
  });
}

function timeOf(iso: string | undefined): number {
  if (typeof iso !== 'string') return 0;
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

/** Badge count for the orders index — server rows minus locally
 *  server-confirmed acknowledgements. */
export function countUnacknowledged(
  rows: ResultsInboxRow[] | null | undefined,
  acked: Readonly<Record<string, boolean>>,
): number {
  return visibleInboxRows(rows, acked).length;
}

// ─── Result payload normalization ────────────────────────────────────────────
//
// The wire payload is one of:
//   1. tagged domain union — {kind:'numeric'|'text'|'multi-analyte', …}
//   2. lab-portal legacy   — {code?, shape:'numeric'|'categorical'|'free-text',
//                             value?, unit?, referenceRange?, interpretation?,
//                             report?}
//   3. LIS legacy map      — { 'CBC.WBC': { value, unit, interpretation? }, … }
// Anything else renders as an explicit "can't display" notice — never a
// guessed value.

/** One displayable analyte line. */
export interface AnalyteRow {
  /** Stable render key. */
  key: string;
  analyte: string | null;
  /** Raw value, stringified without locale games (read against the
   *  printed report; transliterating digits risks misreads). */
  value: string;
  unit: string | null;
  /** Pre-formatted reference band, e.g. "3.5–5.1". */
  refRange: string | null;
  /** Backend-provided flag verbatim; null = no flag → no pill. */
  flag: string | null;
}

export type NormalizedResult =
  | { kind: 'analytes'; panel: string | null; rows: AnalyteRow[] }
  | { kind: 'text'; analyte: string | null; text: string }
  | { kind: 'unstructured' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function optionalFinite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** "3.5–5.1" / "≥ 3.5" / "≤ 5.1" / null. */
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

/** Reference band from either the tagged shape (refRangeLow/High) or the
 *  lab-portal legacy nested referenceRange {normalLow, normalHigh}. */
function refRangeOf(obj: Record<string, unknown>): string | null {
  const direct = refRangeText(
    optionalFinite(obj.refRangeLow),
    optionalFinite(obj.refRangeHigh),
  );
  if (direct !== null) return direct;
  if (isRecord(obj.referenceRange)) {
    return refRangeText(
      optionalFinite(obj.referenceRange.normalLow),
      optionalFinite(obj.referenceRange.normalHigh),
    );
  }
  return null;
}

/** Flag from either vocabulary: tagged `flag` or legacy `interpretation`. */
function flagOf(obj: Record<string, unknown>): string | null {
  return optionalString(obj.flag) ?? optionalString(obj.interpretation);
}

/** Meta keys that are not analyte entries in the legacy LIS map shape. */
const META_KEYS = new Set([
  'criticalFlag',
  'hasCritical',
  'criticalValue',
  'criticalCommunication',
  'code',
  'shape',
  'kind',
]);

/** Narrow one tagged `kind:'numeric'` item; null when malformed. */
function taggedNumericRow(value: unknown, key: string): AnalyteRow | null {
  if (!isRecord(value) || value.kind !== 'numeric') return null;
  if (typeof value.value !== 'number' || !Number.isFinite(value.value)) return null;
  return {
    key,
    analyte: optionalString(value.analyte),
    value: String(value.value),
    unit: optionalString(value.unit),
    refRange: refRangeOf(value),
    flag: flagOf(value),
  };
}

/**
 * Normalize a wire payload into something the detail screen can render
 * faithfully. Unknown shapes map to 'unstructured' — the screen then says
 * so instead of guessing.
 */
export function normalizeResultPayload(payload: unknown): NormalizedResult {
  if (!isRecord(payload)) return { kind: 'unstructured' };

  // 1 — tagged domain union.
  if (payload.kind === 'numeric') {
    const row = taggedNumericRow(payload, 'numeric-0');
    return row ? { kind: 'analytes', panel: null, rows: [row] } : { kind: 'unstructured' };
  }
  if (payload.kind === 'multi-analyte') {
    const items = Array.isArray(payload.items) ? payload.items : [];
    const rows: AnalyteRow[] = [];
    items.forEach((item, i) => {
      const row = taggedNumericRow(item, `item-${i}`);
      if (row) rows.push(row);
    });
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
  if ('kind' in payload) {
    // Unknown tagged shape — never guess.
    return { kind: 'unstructured' };
  }

  // 2 — lab-portal legacy single-test shape (discriminated by `shape`).
  if (typeof payload.shape === 'string') {
    const analyte = optionalString(payload.code);
    if (payload.shape === 'numeric') {
      const value = optionalFinite(payload.value);
      if (value === undefined) return { kind: 'unstructured' };
      return {
        kind: 'analytes',
        panel: null,
        rows: [
          {
            key: 'legacy-0',
            analyte,
            value: String(value),
            unit: optionalString(payload.unit),
            refRange: refRangeOf(payload),
            flag: flagOf(payload),
          },
        ],
      };
    }
    if (payload.shape === 'categorical') {
      const text = optionalString(payload.value);
      return text ? { kind: 'text', analyte, text } : { kind: 'unstructured' };
    }
    if (payload.shape === 'free-text') {
      const text = optionalString(payload.report);
      return text ? { kind: 'text', analyte, text } : { kind: 'unstructured' };
    }
    return { kind: 'unstructured' };
  }

  // 3 — LIS legacy map: analyte-key → { value | result, unit?, flag? }.
  const rows: AnalyteRow[] = [];
  for (const [key, entry] of Object.entries(payload)) {
    if (META_KEYS.has(key)) continue;
    if (!isRecord(entry)) continue;
    const raw = 'value' in entry ? entry.value : entry.result;
    const value =
      typeof raw === 'number' && Number.isFinite(raw)
        ? String(raw)
        : optionalString(raw);
    if (value === null) continue;
    rows.push({
      key,
      analyte: key,
      value,
      unit: optionalString(entry.unit),
      refRange: refRangeOf(entry),
      flag: flagOf(entry),
    });
  }
  return rows.length > 0
    ? { kind: 'analytes', panel: null, rows }
    : { kind: 'unstructured' };
}

/** Top-level critical marker set by the lab writers — mirrors the web
 *  doctor portal's detectCritical. Renders the sticky danger banner. */
export function detectCritical(payload: unknown): boolean {
  if (!isRecord(payload)) return false;
  return (
    payload.criticalFlag === true ||
    payload.hasCritical === true ||
    payload.criticalValue === true
  );
}

// ─── New-order form ──────────────────────────────────────────────────────────

export const MAX_NOTES_LEN = 2000;

export interface OrderDraftValues {
  tests: OrderTest[];
  priority: 'ROUTINE' | 'URGENT' | 'STAT';
  centreId: string;
  notes: string;
}

export function emptyOrderDraft(): OrderDraftValues {
  return { tests: [], priority: 'ROUTINE', centreId: '', notes: '' };
}

/** Catalog entry → strict {code, name} order line. The canonical English
 *  displayName is captured (historical record consistency — a later
 *  catalog rename must not retroactively change orders). */
export function buildOrderTest(entry: CatalogEntry): OrderTest {
  const name = entry.displayName?.trim();
  return {
    code: entry.code,
    name: name !== undefined && name.length > 0 ? name : entry.code,
  };
}

/** Multi-select toggle by test code. */
export function toggleTest(tests: OrderTest[], entry: CatalogEntry): OrderTest[] {
  const next = buildOrderTest(entry);
  const without = tests.filter((t) => t.code !== next.code);
  return without.length === tests.length ? [...tests, next] : without;
}

export function isTestSelected(tests: OrderTest[], code: string): boolean {
  return tests.some((t) => t.code === code);
}

export type OrderFormIssue =
  | { kind: 'NO_PATIENT' }
  | { kind: 'NO_TESTS' }
  | { kind: 'NO_CENTRE' }
  | { kind: 'NOTES_TOO_LONG' };

export type BuiltOrder =
  | { ok: true; centreId: string; body: PlaceLabOrderBody }
  | { ok: false; issue: OrderFormIssue };

/** Validate + assemble the POST body. Mirrors placeLabOrderSchema minus
 *  centreId (the centre id rides the URL path). */
export function buildPlaceOrderBody(
  patientId: string | null | undefined,
  draft: OrderDraftValues,
): BuiltOrder {
  const pid = patientId?.trim();
  if (pid === undefined || pid.length === 0) {
    return { ok: false, issue: { kind: 'NO_PATIENT' } };
  }
  if (draft.tests.length === 0) {
    return { ok: false, issue: { kind: 'NO_TESTS' } };
  }
  if (draft.centreId.trim().length === 0) {
    return { ok: false, issue: { kind: 'NO_CENTRE' } };
  }
  const notes = draft.notes.trim();
  if (notes.length > MAX_NOTES_LEN) {
    return { ok: false, issue: { kind: 'NOTES_TOO_LONG' } };
  }
  return {
    ok: true,
    centreId: draft.centreId.trim(),
    body: {
      patientId: pid,
      tests: draft.tests.map((t) => ({ code: t.code, name: t.name })),
      priority: draft.priority,
      ...(notes.length > 0 ? { notes } : {}),
    },
  };
}

/** Client-side centre filter (name/city/district substring, any case). */
export function filterCentres<T extends { name?: string; city?: string; district?: string }>(
  centres: T[],
  rawQuery: string,
): T[] {
  const q = rawQuery.trim().toLowerCase();
  if (q.length === 0) return centres;
  return centres.filter((c) =>
    [c.name, c.city, c.district].some(
      (field) => typeof field === 'string' && field.toLowerCase().includes(q),
    ),
  );
}
