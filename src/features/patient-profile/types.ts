// Patient profile / allergies / emergency contacts / DSAR — wire types
// mirrored from the backend (READ-ONLY reference):
//
//   GET/PUT /api/v1/me/patient-profile
//     → src/modules/patient (PatientProfileView, upsertMyPatientProfileSchema)
//   GET/POST /api/v1/me/emergency-contacts, DELETE …/{id}
//     → src/modules/patient (EmergencyContactView, createMyEmergencyContactSchema)
//   GET/POST /api/v1/me/allergies, DELETE …/{id}
//     → src/modules/allergy (AllergyView, recordAllergySchema)
//   GET /api/v1/gdpr/requests, POST export/portability/erasure + cancel
//     → src/modules/gdpr (DsarRequestRow, CreateDsarRequestResult)
//   GET /api/v1/me/access-log
//     → src/modules/identity + audit-log (AuditLogSummary projection)
//
// Read-side fields the server could evolve are optional/nullable
// defensively; enum-ish read fields are plain strings with label/tone
// helpers that fall back to the raw value (never fabricate).

// ── Patient profile ─────────────────────────────────────────────────────

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

export type LactationStatus = 'LACTATING' | 'NOT_LACTATING' | 'UNKNOWN';

/** PHI-free MPI dedup review payload (backend MpiPossibleDuplicate). */
export interface MpiPossibleDuplicate {
  candidateUserId: string;
  tier?: string;
  matchedOn?: string[];
}

/** Mirrors backend PatientProfileView (fields this feature renders). The
 *  backend returns identifiers DECRYPTED; the summary screen masks them
 *  at display time (see maskIdentifier). */
export interface PatientProfileView {
  userId: string;
  birthDate?: string | null;
  gender?: string | null;
  bloodType?: string | null;
  lactationStatus?: string;
  /** String-typed at rest on the backend (encrypted column). */
  heightCm?: string | null;
  nationalId?: string | null;
  birthRegNo?: string | null;
  healthId?: string | null;
  possibleDuplicates?: MpiPossibleDuplicate[];
  updatedAt?: string;
}

/** GET /me/patient-profile → { profile } (null until first save). */
export interface MyPatientProfilePayload {
  profile: PatientProfileView | null;
}

/** PUT /me/patient-profile body (mirrors upsertMyPatientProfileSchema).
 *  Partial semantics: absent = unchanged, null = clear. lactationStatus
 *  has no null clear — send 'UNKNOWN' to reset. */
export interface UpsertMyPatientProfileBody {
  birthDate?: string | null;
  gender?: FhirGender | null;
  bloodType?: BloodType | null;
  lactationStatus?: LactationStatus;
  heightCm?: number | null;
  nationalId?: string | null;
  birthRegNo?: string | null;
  healthId?: string | null;
}

// ── Emergency contacts ──────────────────────────────────────────────────

export interface EmergencyContactView {
  id: string;
  name: string;
  relationship: string;
  phoneE164: string;
  secondaryPhoneE164?: string | null;
  email?: string | null;
  notes?: string | null;
  priority?: number;
  notifyInEmergency?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** GET /me/emergency-contacts → { contacts }. */
export interface EmergencyContactsPayload {
  contacts: EmergencyContactView[];
}

/** POST /me/emergency-contacts body (createMyEmergencyContactSchema).
 *  `email` is a REQUIRED key on the wire (null when the user has none). */
export interface CreateEmergencyContactBody {
  name: string;
  relationship: string;
  phoneE164: string;
  email: string | null;
  notes?: string;
}

export interface CreateEmergencyContactResponse {
  contact: EmergencyContactView;
}

/** DELETE /me/emergency-contacts/{id} → { contactId, status }. */
export interface DeleteEmergencyContactResponse {
  contactId?: string;
  status?: string;
}

// ── Allergies (clinical-safety data) ────────────────────────────────────

export type AllergySeverity = 'MILD' | 'MODERATE' | 'SEVERE' | 'ANAPHYLAXIS';

/** Mirrors backend AllergyView. status: ACTIVE | RESOLVED. */
export interface AllergyView {
  id: string;
  allergenDisplay: string;
  allergenCode?: string | null;
  reaction?: string | null;
  severity: string;
  onsetDate?: string | null;
  status: string;
  resolvedReason?: string | null;
  resolvedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** GET /me/allergies → { allergies: AllergyView[] }. */
export interface MyAllergiesPayload {
  allergies: AllergyView[];
}

/** POST /me/allergies body (recordAllergySchema). */
export interface RecordAllergyBody {
  allergen: { display: string; code?: string; system?: 'custom' | 'rxnorm' };
  severity: AllergySeverity;
  reaction?: string;
  onsetDate?: string;
}

export interface RecordAllergyResponse {
  allergy: AllergyView;
}

export interface ResolveAllergyResponse {
  allergy: AllergyView;
}

// ── GDPR / DSAR ─────────────────────────────────────────────────────────

export type DsarRequestType = 'EXPORT' | 'ERASURE' | 'PORTABILITY';

export type DsarRequestStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'EXPIRED';

/** Mirrors backend DsarRequestRow (list projection fields we render). */
export interface DsarRequestListItem {
  id: string;
  type: string;
  status: string;
  reason?: string | null;
  rejectionReason?: string | null;
  completedAt?: string | null;
  expiresAt?: string;
  downloadUrl?: string | null;
  createdAt?: string;
}

/** GET /gdpr/requests → { rows, total, page, pageSize }. */
export interface DsarRequestsPayload {
  rows: DsarRequestListItem[];
  total: number;
  page: number;
  pageSize: number;
}

/** POST /gdpr/{export,portability,erasure}-request → CreateDsarRequestResult. */
export interface CreateDsarResponse {
  id: string;
  type?: string;
  status?: string;
  expiresAt?: string;
  createdAt?: string;
}

/** POST /gdpr/requests/{id}/cancel → CancelMyDsarRequestResult. */
export interface CancelDsarResponse {
  id: string;
  status?: string;
  cancelledAt?: string | null;
}

// ── Access log (GDPR Art. 15 subject-side audit trail) ─────────────────

/** Mirrors backend AuditLogSummary (summary projection only — no
 *  metadata blob crosses this surface). `sequence` is deliberately not
 *  mirrored (bigint on the backend; not rendered). */
export interface AccessLogEntry {
  id: string;
  action: string;
  actionCategory?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  ipAddress?: string | null;
  createdAt: string;
}

/** GET /me/access-log → { rows, total, page, pageSize }. */
export interface AccessLogPayload {
  rows: AccessLogEntry[];
  total: number;
  page: number;
  pageSize: number;
}
