// Doctor patient search + summary — local API contract mirrors.
//
// Shapes are hand-mirrored from the backend source (READ-ONLY reference):
//   - POST /api/v1/doctors/me/patients/search
//       → route SearchResult over ListPatientsByDoctorHandler
//         (DoctorPanelPatientView rows; search matches patientId substring
//          ONLY — never names, PHI safety)
//   - GET  /api/v1/doctors/{id}/patients ({id} = doctor USER id)
//       → ListPatientsByDoctorHandler.ListPatientsByDoctorResult
//   - GET  /api/v1/doctors/{id}/patients/{patientId}
//       → GetPatientForDoctorHandler.GetPatientForDoctorResult
//   - GET  /api/v1/patients/{id}/allergies
//       → { allergies: AllergyView[] } (allergy module)
//   - GET  /api/v1/patients/{id}/conditions?activeOnly=true
//       → { conditions: serializeCondition(ChronicConditionRow)[] }
//   - GET  /api/v1/patients/{id}/medications?currentOnly=true
//       → { medications: PatientMedicationView[] }
//   - GET  /api/v1/patients/{id}/vitals?limit=N
//       → { vitals: { readings: VitalReadingView[]; totalCount } }
//   - GET  /api/v1/patients/{id}/prescriptions?limit=N
//       → ListPrescriptionsByPatientResult (metadata-only rows)
//   - GET  /api/v1/patients/{id}/lab-orders?limit=N
//       → ListLabOrdersByPatientResult
//
// Only fields the app renders are mirrored; everything non-load-bearing is
// optional/nullable so a backend projection change degrades gracefully.
// Backend Date fields arrive as ISO strings after JSON serialization.

// ─── Panel + search (doctor's patient list) ─────────────────────────────────

/** One row of the doctor's panel — initials-only projection (no names). */
export interface PanelPatient {
  patientId: string;
  /** Two-hex display token derived from the UUID — NEVER a name. */
  initials?: string;
  /** Decade bracket "20–30" / "90+" / "unknown" — never a raw DOB. */
  ageBracket?: string;
  /** ISO timestamp of the most recent clinical event with this doctor. */
  lastVisitAt?: string | null;
  primaryCondition?: string | null;
  openConsents?: number;
  /** Row admitted under emergency break-glass rather than granted consent. */
  viaBreakGlass?: boolean;
}

/** GET /doctors/{id}/patients payload (after { data } unwrap). */
export interface PanelPayload {
  patients?: PanelPatient[] | null;
  pagination?: { limit?: number; nextCursor?: string | null };
  filterMetadata?: {
    totalCount?: number;
    filteredCount?: number;
    breakGlassCount?: number;
  };
}

/** POST /doctors/me/patients/search payload (after { data } unwrap). */
export interface SearchPayload {
  patients?: PanelPatient[] | null;
  consentGated?: boolean;
  totalInPanel?: number;
  filteredBySearch?: number;
}

// ─── Patient detail bundle (demographics header) ────────────────────────────

export type FhirGender = 'male' | 'female' | 'other' | 'unknown';

export type BloodType =
  | 'A_POS'
  | 'A_NEG'
  | 'B_POS'
  | 'B_NEG'
  | 'AB_POS'
  | 'AB_NEG'
  | 'O_POS'
  | 'O_NEG'
  | 'UNKNOWN';

export interface PatientRecentAppointment {
  appointmentId: string;
  /** ISO timestamp. */
  scheduledAt: string;
  durationMinutes?: number;
  status?: string;
  appointmentType?: string;
}

export interface PatientRecentPrescription {
  prescriptionId: string;
  /** ISO timestamp. */
  prescribedAt: string;
  status?: string;
  itemCount?: number;
}

/** Mirrors DoctorPatientDetailView (patient module). */
export interface DoctorPatientDetail {
  patientId: string;
  initials?: string;
  /** Empty string when the User row is missing — fall back to initials. */
  fullName?: string;
  /** ISO timestamp | null. */
  dateOfBirth?: string | null;
  ageBracket?: string;
  gender?: FhirGender | string | null;
  bloodType?: BloodType | string | null;
  /** Free-text allergies noted on the profile. */
  allergies?: string | null;
  /** Structured ACTIVE allergen display strings (allergy module). */
  structuredAllergyDisplays?: string[];
  /** Free-text current medications noted on the profile. */
  activeMedications?: string | null;
  /** DECEASED locks every write CTA (mirrors the backend patient lock). */
  status?: 'ACTIVE' | 'DECEASED' | 'INACTIVE' | string;
  recentAppointments?: PatientRecentAppointment[];
  recentPrescriptions?: PatientRecentPrescription[];
}

export interface PatientDetailPayload {
  patient?: DoctorPatientDetail;
}

// ─── Allergies ───────────────────────────────────────────────────────────────

export type AllergySeverity = 'MILD' | 'MODERATE' | 'SEVERE' | 'ANAPHYLAXIS';
export type AllergyStatus = 'ACTIVE' | 'RESOLVED';

/** Mirrors AllergyView (allergy module). */
export interface AllergyRow {
  id: string;
  allergenDisplay: string;
  reaction?: string | null;
  severity: AllergySeverity | string;
  status: AllergyStatus | string;
  /** YYYY-MM-DD | null. */
  onsetDate?: string | null;
}

export interface AllergiesPayload {
  allergies?: AllergyRow[] | null;
}

// ─── Conditions ──────────────────────────────────────────────────────────────

export type ConditionStatus = 'ACTIVE' | 'IN_REMISSION' | 'RESOLVED';
export type ConditionSeverity = 'MILD' | 'MODERATE' | 'SEVERE';

/** Mirrors the conditions route serializeCondition output. */
export interface ConditionRow {
  id: string;
  conditionLabel: string;
  icd10Code?: string | null;
  /** YYYY-MM-DD | null. */
  onsetDate?: string | null;
  status: ConditionStatus | string;
  severity?: ConditionSeverity | string;
  notes?: string | null;
  /** ISO timestamp. */
  recordedAt?: string;
}

export interface ConditionsPayload {
  conditions?: ConditionRow[] | null;
}

// ─── Medications ─────────────────────────────────────────────────────────────

export type MedicationStatus = 'ACTIVE' | 'PAUSED' | 'DISCONTINUED';

/** Mirrors PatientMedicationView (medication module). */
export interface MedicationRow {
  id: string;
  drugName: string;
  doseAmount?: string;
  frequency?: string;
  status: MedicationStatus | string;
  /** ISO timestamp. */
  startedAt?: string;
  endedAt?: string | null;
}

export interface MedicationsPayload {
  medications?: MedicationRow[] | null;
}

// ─── Vitals ──────────────────────────────────────────────────────────────────

/** Mirrors VitalReadingView (vital-reading module); widened defensively. */
export interface VitalRow {
  vitalReadingId: string;
  vitalType: string;
  valueQuantity: number;
  /** BP diastolic limb; null for every other vital type. */
  valueSecondary?: number | null;
  unit: string;
  status?: string;
  /** ISO timestamp — when the measurement was taken. */
  effectiveAt: string;
}

export interface VitalsPayload {
  vitals?: {
    readings?: VitalRow[] | null;
    totalCount?: number;
  };
}

// ─── Prescriptions ───────────────────────────────────────────────────────────

export type PrescriptionStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'DISPENSED';

/** Mirrors PrescriptionListView — metadata only (no drug names). */
export interface PrescriptionRow {
  prescriptionId: string;
  /** ISO timestamp. */
  prescribedAt: string;
  status: PrescriptionStatus | string;
  /** ISO timestamp. */
  validUntil?: string;
  itemCount?: number;
  refillsAllowed?: number;
  refillsUsed?: number;
}

export interface PrescriptionsPayload {
  prescriptions?: PrescriptionRow[] | null;
  pagination?: { limit?: number; offset?: number };
}

// ─── Lab orders ──────────────────────────────────────────────────────────────

export type LabOrderStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type LabOrderPriority = 'ROUTINE' | 'URGENT' | 'STAT';

export interface LabOrderTestRef {
  code?: string;
  name?: string;
}

/** Mirrors LabOrderView (diagnostic-centre module). */
export interface LabOrderRow {
  labOrderId: string;
  /** ISO timestamp. */
  orderedAt: string;
  tests?: LabOrderTestRef[] | null;
  priority?: LabOrderPriority | string;
  status: LabOrderStatus | string;
}

export interface LabOrdersPayload {
  orders?: LabOrderRow[] | null;
  pagination?: { limit?: number; offset?: number };
}
