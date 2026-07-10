// Patient meds — local wire types mirrored from the rx.bd backend.
//
// Sources (READ-ONLY mirrors; do not import backend code):
//   - GET /api/v1/patients/{id}/prescriptions →
//     ListPrescriptionsByPatientResult (src/modules/prescription/
//     application/queries/ListPrescriptionsByPatientHandler.ts) —
//     METADATA-ONLY projection: no drug names, doctor userId only.
//   - GET /api/v1/prescriptions/{id} → GetPrescriptionResult
//     (GetPrescriptionHandler.ts) — full PHI view incl. items.
//   - GET /api/v1/patients/{id}/medications → { medications:
//     PatientMedicationView[] } (src/modules/medication).
//   - GET/POST /api/v1/me/medication-reminders → ReminderView rows
//     (src/app/api/v1/me/medication-reminders/route.ts). POST is an
//     UPSERT keyed on prescriptionId; "delete" = status CANCELLED.
//   - POST /api/v1/me/refills/reorder → ReorderRequestResponse
//     (src/app/api/v1/me/refills/reorder/route.ts).
//   - GET /api/v1/public/doctors/{id} → PublicDoctorView (non-PHI
//     professional persona; keyed on doctorUserId).
//
// Only fields this feature renders are declared; everything the server
// merely *may* send is marked optional/nullable defensively.

/** Prescription lifecycle (mirror of PrescriptionStatus). Kept as a
 *  reference union for write-side literals; read-side status fields are
 *  plain strings so unknown future values degrade gracefully. */
export type PrescriptionStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'DISPENSED';

/** Mirror of PatientMedicationStatus. */
export type PatientMedicationStatus = 'ACTIVE' | 'PAUSED' | 'DISCONTINUED';

/** Mirror of the reminder status enum on the reminders route. */
export type ReminderStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED';

/** Mirror of the reminder channel enum on the reminders route. */
export type ReminderChannel = 'push' | 'in_app';

// ── Prescriptions ────────────────────────────────────────────────────────────

/** One row of the patient prescription list (slim projection). */
export interface PrescriptionListItem {
  prescriptionId: string;
  /** ISO timestamp. */
  prescribedAt?: string;
  status?: string;
  /** ISO timestamp. */
  validUntil?: string;
  itemCount?: number;
  refillsAllowed?: number;
  refillsUsed?: number;
}

export interface PrescriptionsPayload {
  prescriptions?: PrescriptionListItem[];
}

/** One drug line on the full prescription view. All PHI. */
export interface PrescriptionItemView {
  drugName?: string;
  strength?: string;
  dose?: string;
  frequency?: string;
  durationDays?: number;
  route?: string;
  instructions?: string;
}

export interface PrescriptionDetail {
  prescriptionId: string;
  prescribingDoctorUserId?: string;
  /** Points at the original Rx when this row is an amendment. */
  supersedesId?: string | null;
  prescribedAt?: string;
  items?: PrescriptionItemView[];
  diagnosisCodes?: string[];
  status?: string;
  validUntil?: string;
  refillsAllowed?: number;
  refillsUsed?: number;
  notes?: string | null;
}

/** GET /prescriptions/{id} — `prescription: null` covers both "does not
 *  exist" and cross-tenant probes (no enumeration oracle). */
export interface PrescriptionDetailPayload {
  prescription?: PrescriptionDetail | null;
}

// ── Medications ──────────────────────────────────────────────────────────────

export interface MedicationView {
  id: string;
  /** Source prescription FK; null for OTC / self-recorded rows. */
  sourcePrescriptionId?: string | null;
  drugName?: string;
  doseAmount?: string;
  frequency?: string;
  status?: string;
  /** ISO timestamp. */
  startedAt?: string;
}

export interface MedicationsPayload {
  medications?: MedicationView[];
}

// ── Medication reminders ─────────────────────────────────────────────────────

export interface ReminderView {
  id: string;
  prescriptionId?: string;
  /** Drug name shown on the reminder — PHI. */
  reminderLabel?: string;
  /** "HH:MM" 24h strings, 1–8 slots. */
  reminderTimes?: string[];
  channels?: string[];
  status?: string;
  updatedAt?: string;
}

export interface RemindersPayload {
  reminders?: ReminderView[];
}

/** POST /me/medication-reminders body (upsert keyed on prescriptionId). */
export interface ReminderUpsertBody {
  prescriptionId: string;
  reminderLabel: string;
  reminderTimes: string[];
  channels: ReminderChannel[];
  status: ReminderStatus;
}

// ── Reorder (re-prescribe request) ───────────────────────────────────────────

/** POST /me/refills/reorder body. `idempotencyKey` is REQUIRED in the
 *  body by the backend schema (in addition to the Idempotency-Key
 *  header) — keep it stable across retries of one logical request. */
export interface ReorderRequestBody {
  sourcePrescriptionId: string;
  contextNote?: string;
  idempotencyKey: string;
}

export interface ReorderResponse {
  reorderRequestId?: string;
  status?: string;
  /** True when the server deduped a replayed submission. */
  replayed?: boolean;
}

// ── Public doctor directory (prescriber name lookup) ─────────────────────────

/** Non-PHI professional persona — verified doctors only. */
export interface PublicDoctorLite {
  doctorUserId?: string;
  fullName?: string;
  primarySpecialty?: string;
}
