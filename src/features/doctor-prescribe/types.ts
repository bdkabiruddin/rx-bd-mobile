// Doctor prescribe + e-sign — local mirrors of the backend contracts.
// Shapes are copied (never imported) from:
//   - allergy module      ListPatientAllergiesHandler.AllergyView
//   - drug-catalog module SearchDrugCatalogHandler.DrugView
//   - prescription module prescription.schemas.ts (draft/sign bodies),
//                         SaveDraftPrescriptionHandler / SignPrescriptionHandler
//                         results, FindOpenDraftHandler.OpenDraftView,
//                         WritePrescriptionHandler.SafetyBlockItemFinding
//   - clinical-decision   PrescriptionSafetyDryRun result (dry-run)
// Only fields the mobile UI renders are mirrored; everything inbound is
// optional/nullable defensively.

// ─── Allergies (GET /patients/{id}/allergies) ───────────────────────────────

export type AllergySeverity = 'MILD' | 'MODERATE' | 'SEVERE' | 'ANAPHYLAXIS';

export interface AllergyLite {
  id: string;
  allergenDisplay?: string;
  reaction?: string | null;
  severity?: AllergySeverity | string;
  status?: 'ACTIVE' | 'RESOLVED' | string;
}

export interface AllergiesPayload {
  allergies?: AllergyLite[];
}

// ─── Drug catalog (GET /drug-catalog?q=…) ───────────────────────────────────

export interface DrugLite {
  id: string;
  brandName?: string;
  genericName?: string;
  /** ISMP Tall-Man cased genericName — clinical surfaces MUST render this
   *  (charter §3.1) wherever a catalog drug name is displayed. */
  tallManName?: string;
  strengthDisplay?: string;
  dosageForm?: string;
  routeOfAdmin?: string;
}

export interface DrugCatalogPayload {
  drugs?: DrugLite[];
}

// ─── Templates (GET /me/prescription-templates, POST …/{id}/use) ────────────

export interface TemplateItem {
  drugId?: string | null;
  strengthId?: string | null;
  doseText?: string;
  frequency?: string | null;
  durationValue?: number | null;
  durationUnit?: 'days' | 'weeks' | string;
  route?: string | null;
  instructions?: string;
  refills?: number;
}

export interface TemplateLite {
  id: string;
  name?: string;
  description?: string | null;
  /** Prisma JSON column — validate at runtime before trusting. */
  items?: unknown;
}

export interface TemplatesPayload {
  templates?: TemplateLite[];
}

export interface TemplateUsePayload {
  templateId?: string;
  name?: string;
  items?: unknown;
}

// ─── Dry run (POST /clinical/prescription-dry-run) ──────────────────────────

export type SafetyTier = 'ABSOLUTE' | 'BLOCKING' | 'ADVISORY';

export interface DryRunAssessment {
  primitive?: string;
  tier?: SafetyTier | string;
  reason?: string;
}

/** Mirror of PrescriptionSafetyDryRunResult — only the fields we render. */
export interface DryRunResultLite {
  clear?: boolean;
  assessments?: DryRunAssessment[];
  absoluteBlocks?: string[];
  overridableBlocks?: string[];
  advisories?: string[];
  structuredAllergySourceUnavailable?: boolean;
  structuredMedicationSourceUnavailable?: boolean;
}

/** Request body — mirror of runPrescriptionDryRunSchema (subset sent). */
export interface DryRunBody {
  patientUserId: string;
  newDrugName: string;
  prescribedDoseString?: string;
  prescribedFrequency?: string;
}

/** One compose item's dry-run outcome as tracked client-side. */
export interface ItemDryRun {
  itemIndex: number;
  drugName: string;
  result: DryRunResultLite | null;
  errorMessage: string | null;
}

// ─── Compose state (persisted in the encrypted useDraft store) ──────────────

export interface ComposeItem {
  drugName: string;
  strength: string;
  dose: string;
  frequency: string;
  /** Kept as string for the numeric TextInput; parsed at payload build. */
  durationDays: string;
  route: string;
  instructions: string;
}

export interface ComposeState {
  /** Server-side DRAFT row id once one exists (create-or-resume). */
  serverDraftId: string | null;
  items: ComposeItem[];
  /** Raw comma-separated ICD-10 input; parsed at payload build. */
  diagnosisText: string;
  notes: string;
  refillsAllowed: string;
  validUntilDays: string;
}

// ─── Draft save (POST /prescriptions/draft, PUT /prescriptions/{id}/draft) ──

export interface DraftBodyItem {
  drugName: string;
  strength: string;
  dose: string;
  frequency: string;
  durationDays: number;
  route: string;
  instructions: string;
}

/** Mirror of saveDraftPrescriptionBodySchema. */
export interface DraftBody {
  patientId: string;
  items: DraftBodyItem[];
  diagnosisCodes: string[];
  validUntilDays?: number;
  refillsAllowed?: number;
  notes?: string;
}

/** Mirror of SaveDraftPrescriptionResult. */
export interface SaveDraftResult {
  prescriptionId?: string;
  created?: boolean;
  status?: string;
  itemCount?: number;
  updatedAt?: string;
}

// ─── Resume probe (GET /me/drafts/prescriptions?patientId=…) ────────────────

export interface OpenDraftItem {
  drugName?: string;
  strength?: string;
  dose?: string;
  frequency?: string;
  durationDays?: number;
  route?: string;
  instructions?: string;
}

/** Mirror of FindOpenDraftHandler.OpenDraftView. */
export interface OpenDraftView {
  prescriptionId?: string;
  patientId?: string;
  items?: OpenDraftItem[];
  diagnosisCodes?: string[];
  refillsAllowed?: number;
  notes?: string | null;
  validUntilDays?: number;
}

export interface FindOpenDraftPayload {
  draft?: OpenDraftView | null;
}

// ─── Sign (POST /prescriptions/{id}/sign) ───────────────────────────────────

/** Mirror of SignPrescriptionResult — only fields we render. */
export interface SignResultLite {
  prescriptionId?: string;
  status?: string;
  safetyAdvisories?: unknown[];
}

/** Mirror of WritePrescriptionHandler.SafetyBlockItemFinding as carried on a
 *  409 SAFETY_BLOCK / SAFETY_BLOCK_ABSOLUTE error payload. */
export interface ServerSafetyFinding {
  itemIndex?: number;
  drugName?: string;
  flaggedPrimitives?: string[];
  absolutePrimitives?: string[];
  overridablePrimitives?: string[];
  advisoryPrimitives?: string[];
}

/** Parsed server-side refusal (409 SAFETY_BLOCK) shown in the UI. */
export interface ServerBlock {
  message: string | null;
  findings: ServerSafetyFinding[];
}
