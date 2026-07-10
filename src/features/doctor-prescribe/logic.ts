// Doctor prescribe + e-sign — pure derivation logic. No React, no
// React Native imports: unit-tested in a Node jest environment
// (__tests__/doctor-prescribe.test.ts).
//
// CLINICAL-SAFETY POSTURE (mirrors the web two-key + interlock contract):
//   - There is NO code path that enables signing without a fresh dry-run
//     over the exact current medication list (fingerprint match).
//   - Unknown / malformed safety tiers are treated as BLOCKING (fail
//     closed) — a payload we don't understand never reads as "safe".
//   - Blocking / absolute findings disable signing entirely; the mobile
//     client ships NO override path. Advisory warnings require an
//     explicit doctor acknowledgement.

import type {
  ComposeItem,
  ComposeState,
  DraftBody,
  DraftBodyItem,
  DrugLite,
  DryRunBody,
  ItemDryRun,
  OpenDraftView,
  ServerBlock,
  ServerSafetyFinding,
  TemplateItem,
} from './types';

/** Same literal union as src/ui/StatusPill's StatusTone — duplicated so
 *  this module stays free of react-native imports. */
export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

// ─── Controlled vocabulary (mirror of PrescriptionVocabulary.ts) ────────────

/** Charter §3.3 controlled frequency vocabulary — same set + order as the
 *  backend `CONTROLLED_FREQUENCY_CODES`. The mobile composer only offers
 *  these codes (no free-text frequency path in v1). */
export const FREQUENCY_CODES = [
  'OD', 'BID', 'TID', 'QID', 'Q4H', 'Q6H', 'Q8H', 'Q12H', 'QHS', 'QAM', 'STAT', 'PRN',
] as const;

const FREQUENCY_SET: ReadonlySet<string> = new Set(FREQUENCY_CODES);

export function isControlledFrequencyCode(value: string): boolean {
  return FREQUENCY_SET.has(value.trim().toUpperCase());
}

/** ICD-10 shape gate — mirror of the backend regex (letter + 2 digits +
 *  optional dot + up to 4 alphanumerics). */
const ICD10_RE = /^[A-Z][0-9]{2}(\.[0-9A-Z]{1,4})?$/;

export function isValidIcd10(code: string): boolean {
  return ICD10_RE.test(code.trim().toUpperCase());
}

// Backend bounds (writePrescriptionSchema / saveDraftPrescriptionBodySchema).
export const MAX_ITEMS = 20;
export const MAX_DIAGNOSIS_CODES = 10;

// ─── Compose-state constructors ─────────────────────────────────────────────

export function emptyItem(): ComposeItem {
  return {
    drugName: '',
    strength: '',
    dose: '',
    frequency: '',
    durationDays: '',
    route: '',
    instructions: '',
  };
}

export function emptyComposeState(): ComposeState {
  return {
    serverDraftId: null,
    items: [],
    diagnosisText: '',
    notes: '',
    refillsAllowed: '',
    validUntilDays: '',
  };
}

/** True when the local draft has no doctor-entered content yet — the only
 *  case where the server-draft probe may hydrate over it. */
export function isPristine(s: ComposeState): boolean {
  return (
    s.items.length === 0 &&
    s.diagnosisText.trim().length === 0 &&
    s.notes.trim().length === 0
  );
}

/** Hydrate compose state from the server's open DRAFT (cross-device resume). */
export function openDraftToCompose(d: OpenDraftView): ComposeState {
  return {
    serverDraftId: d.prescriptionId ?? null,
    items: (d.items ?? []).map((i) => ({
      drugName: i.drugName ?? '',
      strength: i.strength ?? '',
      dose: i.dose ?? '',
      frequency: i.frequency ?? '',
      durationDays:
        typeof i.durationDays === 'number' && i.durationDays > 0
          ? String(i.durationDays)
          : '',
      route: i.route ?? '',
      instructions: i.instructions ?? '',
    })),
    diagnosisText: (d.diagnosisCodes ?? []).join(', '),
    notes: d.notes ?? '',
    refillsAllowed:
      typeof d.refillsAllowed === 'number' ? String(d.refillsAllowed) : '',
    validUntilDays:
      typeof d.validUntilDays === 'number' && d.validUntilDays > 0
        ? String(d.validUntilDays)
        : '',
  };
}

// ─── Parsing helpers ────────────────────────────────────────────────────────

/** Integer in [min, max] from a text input, or null when absent/invalid. */
export function parseBoundedInt(
  raw: string,
  min: number,
  max: number,
): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = parseInt(trimmed, 10);
  if (Number.isNaN(n) || n < min || n > max) return null;
  return n;
}

/** Comma / newline / semicolon separated ICD-10 input → trimmed,
 *  upper-cased, de-duplicated codes (empty entries dropped). */
export function parseDiagnosisCodes(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[,;\n]+/)) {
    const code = part.trim().toUpperCase();
    if (code.length === 0 || seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}

// ─── Item completeness (sign-time gate, mirrors writePrescriptionSchema) ────

export type ItemIssue =
  | 'drugName'
  | 'strength'
  | 'dose'
  | 'frequency'
  | 'durationDays'
  | 'route';

/** Fields still missing/invalid for a SIGNABLE item. Strength is REQUIRED
 *  (charter §3.2 — drug + strength inseparability); frequency must be a
 *  controlled-vocabulary code (charter §3.3). */
export function itemIssues(item: ComposeItem): ItemIssue[] {
  const issues: ItemIssue[] = [];
  if (item.drugName.trim().length === 0) issues.push('drugName');
  if (item.strength.trim().length === 0) issues.push('strength');
  if (item.dose.trim().length === 0) issues.push('dose');
  if (!isControlledFrequencyCode(item.frequency)) issues.push('frequency');
  if (parseBoundedInt(item.durationDays, 1, 365) === null) {
    issues.push('durationDays');
  }
  if (item.route.trim().length === 0) issues.push('route');
  return issues;
}

// ─── Dry-run plumbing ───────────────────────────────────────────────────────

/** Stable fingerprint over the safety-relevant item fields. ANY change to
 *  them invalidates a previous dry-run (sign re-disables until re-run). */
export function itemsFingerprint(items: ComposeItem[]): string {
  return JSON.stringify(
    items.map((i) => [
      i.drugName.trim().toUpperCase(),
      i.strength.trim(),
      i.dose.trim(),
      i.frequency.trim().toUpperCase(),
      i.durationDays.trim(),
      i.route.trim(),
    ]),
  );
}

/** Request body for one item — mirror of runPrescriptionDryRunSchema. */
export function buildDryRunBody(item: ComposeItem, patientId: string): DryRunBody {
  const dose = item.dose.trim().slice(0, 200);
  const freq = item.frequency.trim().slice(0, 200);
  return {
    patientUserId: patientId,
    newDrugName: item.drugName.trim().slice(0, 200),
    ...(dose.length > 0 ? { prescribedDoseString: dose } : {}),
    ...(freq.length > 0 ? { prescribedFrequency: freq } : {}),
  };
}

export interface DryRunSummary {
  /** True only when EVERY current item has a successfully-parsed result. */
  ran: boolean;
  hasAbsolute: boolean;
  hasBlocking: boolean;
  advisoryCount: number;
}

/** Aggregate the per-item dry-run outcomes. Fail-closed everywhere:
 *  unknown tiers count as BLOCKING; `clear: false` with no recognizable
 *  block detail counts as BLOCKING; a malformed/failed item result means
 *  the dry-run did NOT run. */
export function summarizeDryRun(
  perItem: ItemDryRun[] | null,
  expectedItemCount: number,
): DryRunSummary {
  const none: DryRunSummary = {
    ran: false,
    hasAbsolute: false,
    hasBlocking: false,
    advisoryCount: 0,
  };
  if (!perItem || expectedItemCount === 0 || perItem.length !== expectedItemCount) {
    return none;
  }
  let ran = true;
  let hasAbsolute = false;
  let hasBlocking = false;
  let advisoryCount = 0;
  for (const rec of perItem) {
    const r = rec.result;
    if (r === null || rec.errorMessage !== null) {
      ran = false;
      continue;
    }
    let recognized = false;
    if ((r.absoluteBlocks?.length ?? 0) > 0) {
      hasAbsolute = true;
      recognized = true;
    }
    if ((r.overridableBlocks?.length ?? 0) > 0) {
      hasBlocking = true;
      recognized = true;
    }
    for (const a of r.assessments ?? []) {
      if (a.tier === 'ABSOLUTE') {
        hasAbsolute = true;
      } else if (a.tier === 'BLOCKING') {
        hasBlocking = true;
      } else if (a.tier === 'ADVISORY') {
        advisoryCount += 1;
      } else {
        // Unknown tier → fail closed.
        hasBlocking = true;
      }
      recognized = true;
    }
    if (r.clear === false && !recognized) hasBlocking = true;
    if (r.clear === undefined && !recognized && r.advisories === undefined) {
      // Shape we cannot interpret at all — treat as not run.
      ran = false;
    }
  }
  return { ran, hasAbsolute, hasBlocking, advisoryCount };
}

/** Locked status-pill tone per tier. Unknown tiers render danger. */
export function tierTone(tier: string | undefined): Tone {
  return tier === 'ADVISORY' ? 'warning' : 'danger';
}

// ─── Sign gate ──────────────────────────────────────────────────────────────

export type SignBlockReason =
  | 'no-items'
  | 'incomplete-item'
  | 'diagnosis'
  | 'dry-run'
  | 'safety-block'
  | 'ack';

export interface SignGateInput {
  items: ComposeItem[];
  diagnosisText: string;
  /** Dry-run ran against the EXACT current items (fingerprint match). */
  dryRunFresh: boolean;
  summary: DryRunSummary;
  acknowledged: boolean;
}

/** First unmet condition for enabling Sign, or null when signable.
 *  Order matters: content problems first, then the interlock. */
export function signBlockReason(g: SignGateInput): SignBlockReason | null {
  if (g.items.length === 0) return 'no-items';
  if (g.items.some((i) => itemIssues(i).length > 0)) return 'incomplete-item';
  const codes = parseDiagnosisCodes(g.diagnosisText);
  if (
    codes.length === 0 ||
    codes.length > MAX_DIAGNOSIS_CODES ||
    codes.some((c) => !isValidIcd10(c))
  ) {
    return 'diagnosis';
  }
  if (!g.dryRunFresh || !g.summary.ran) return 'dry-run';
  if (g.summary.hasAbsolute || g.summary.hasBlocking) return 'safety-block';
  if (g.summary.advisoryCount > 0 && !g.acknowledged) return 'ack';
  return null;
}

// ─── Draft payload (mirror of saveDraftPrescriptionBodySchema) ──────────────

export function buildDraftBody(state: ComposeState, patientId: string): DraftBody {
  const items: DraftBodyItem[] = state.items
    .filter((i) => i.drugName.trim().length > 0)
    .slice(0, MAX_ITEMS)
    .map((i) => ({
      drugName: i.drugName.trim().slice(0, 200),
      strength: i.strength.trim().slice(0, 200),
      dose: i.dose.trim().slice(0, 200),
      frequency: i.frequency.trim().slice(0, 200),
      durationDays: parseBoundedInt(i.durationDays, 1, 365) ?? 0,
      route: i.route.trim().slice(0, 50),
      instructions: i.instructions.trim().slice(0, 2000),
    }));
  const diagnosisCodes = parseDiagnosisCodes(state.diagnosisText)
    .slice(0, MAX_DIAGNOSIS_CODES)
    .map((c) => c.slice(0, 64));
  const refills = parseBoundedInt(state.refillsAllowed, 0, 12);
  const valid = parseBoundedInt(state.validUntilDays, 1, 365);
  const notes = state.notes.trim().slice(0, 4000);
  return {
    patientId,
    items,
    diagnosisCodes,
    ...(refills !== null ? { refillsAllowed: refills } : {}),
    ...(valid !== null ? { validUntilDays: valid } : {}),
    ...(notes.length > 0 ? { notes } : {}),
  };
}

// ─── Server 409 SAFETY_BLOCK parsing ────────────────────────────────────────

/** Extract the safety-block findings from an ApiError.details payload.
 *  Backend envelope: { success:false, error:{ message, details:{
 *  safetyBlockCode, overridable, findings } }, code, statusCode } —
 *  probed defensively across plausible nestings. Returns null when the
 *  payload carries no findings array (caller falls back to the message). */
export function extractServerBlock(details: unknown): ServerBlock | null {
  const roots: unknown[] = [];
  if (details !== null && typeof details === 'object') {
    roots.push(details);
    const err = (details as { error?: unknown }).error;
    if (err !== null && typeof err === 'object') roots.push(err);
  }
  for (const root of roots) {
    const nested = (root as { details?: unknown }).details;
    for (const candidate of [nested, root]) {
      if (candidate === null || typeof candidate !== 'object') continue;
      const findingsRaw = (candidate as { findings?: unknown }).findings;
      if (!Array.isArray(findingsRaw)) continue;
      const findings = findingsRaw.filter(
        (f): f is ServerSafetyFinding => f !== null && typeof f === 'object',
      );
      const msg = (root as { message?: unknown }).message;
      return {
        message: typeof msg === 'string' && msg.length > 0 ? msg : null,
        findings,
      };
    }
  }
  return null;
}

// ─── Templates → compose items ──────────────────────────────────────────────

/** Runtime-validate a Prisma-JSON template items payload. */
export function normalizeTemplateItems(raw: unknown): TemplateItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (it): it is TemplateItem => it !== null && typeof it === 'object',
  );
}

/** Map template items onto compose rows. Template items carry drugId /
 *  strengthId (catalog references), not names — resolve through the
 *  supplied catalog map; unresolvable drugs leave the field EMPTY for the
 *  doctor to fill (honest blank, never a guessed name). */
export function templateItemsToCompose(
  raw: unknown,
  drugsById: ReadonlyMap<string, DrugLite>,
): ComposeItem[] {
  return normalizeTemplateItems(raw).map((it) => {
    const drug =
      typeof it.drugId === 'string' && it.drugId.length > 0
        ? drugsById.get(it.drugId)
        : undefined;
    const days =
      typeof it.durationValue === 'number' && it.durationValue > 0
        ? it.durationUnit === 'weeks'
          ? it.durationValue * 7
          : it.durationValue
        : null;
    const freq = typeof it.frequency === 'string' ? it.frequency.trim() : '';
    return {
      drugName: drug?.genericName ?? drug?.brandName ?? '',
      strength: drug?.strengthDisplay ?? '',
      dose: typeof it.doseText === 'string' ? it.doseText : '',
      // Only controlled codes survive — the picker cannot represent
      // bespoke schedules, so anything else must be re-chosen.
      frequency: isControlledFrequencyCode(freq) ? freq.toUpperCase() : '',
      durationDays: days !== null && days <= 365 ? String(days) : '',
      route: typeof it.route === 'string' ? it.route : '',
      instructions: typeof it.instructions === 'string' ? it.instructions : '',
    };
  });
}

// ─── Allergy banner helpers ─────────────────────────────────────────────────

/** ACTIVE allergies (unknown status is kept — fail closed, show it). */
export function activeAllergies<T extends { status?: string }>(
  allergies: T[] | null | undefined,
): T[] {
  return (allergies ?? []).filter((a) => a.status !== 'RESOLVED');
}

export function severityTone(severity: string | undefined): Tone {
  switch (severity) {
    case 'ANAPHYLAXIS':
    case 'SEVERE':
      return 'danger';
    case 'MODERATE':
      return 'warning';
    case 'MILD':
      return 'neutral';
    default:
      // Unknown severity — show it loudly rather than quietly.
      return 'warning';
  }
}

/** Join defined, non-empty parts with a middle dot. */
export function joinParts(parts: (string | null | undefined)[]): string {
  return parts
    .filter((p): p is string => typeof p === 'string' && p.length > 0)
    .join(' · ');
}
