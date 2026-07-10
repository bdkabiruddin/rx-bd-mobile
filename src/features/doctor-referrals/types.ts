// Doctor referrals + medical certificates — local API contract mirrors.
//
// Shapes are hand-mirrored from the backend source (READ-ONLY reference):
//   - GET   /api/v1/me/referrals
//       → ListReferralsByDoctorHandler.ListReferralsByDoctorResult
//         (DoctorReferralListView rows — metadata only; the PHI free-text
//          reason/clinicalContext never appear on the list projection)
//   - POST  /api/v1/referrals
//       → IssueReferralHandler.IssueReferralResult (body: issueReferralSchema)
//   - PATCH /api/v1/referrals/{id}/cancel
//       → CancelReferralHandler.CancelReferralResult
//   - GET   /api/v1/me/medical-certificates
//       → ListCertificatesByDoctorHandler.ListCertificatesByDoctorResult
//   - POST  /api/v1/medical-certificates
//       → IssueCertificateHandler.IssueCertificateResult
//         (body: issueCertificateSchema)
//   - PATCH /api/v1/medical-certificates/{id}/cancel
//       → RevokeCertificateHandler.RevokeCertificateResult
//   - POST  /api/v1/doctors/me/patients/search
//       → same panel-row projection the doctor-patients feature mirrors
//         (endpoint reused; types deliberately re-declared locally so this
//          feature never deep-imports a sibling feature folder)
//
// Only fields the app renders are mirrored; everything non-load-bearing is
// optional/nullable so a backend projection change degrades gracefully.
// Backend Date fields arrive as ISO strings after JSON serialization.

// ─── Enums (referral module ReferralEnums.ts) ────────────────────────────────

export type ReferralType =
  | 'SPECIALIST'
  | 'DIAGNOSTIC'
  | 'HOSPITAL_ADMISSION'
  | 'SECOND_OPINION';

export type ReferralUrgency = 'ROUTINE' | 'URGENT' | 'EMERGENT';

export type ReferralStatus =
  | 'ACTIVE'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'REDIRECTED'
  | 'COMPLETED'
  | 'FULFILLED'
  | 'EXPIRED'
  | 'CANCELLED';

export type CertificateType =
  | 'SICK_LEAVE'
  | 'FITNESS_TO_WORK'
  | 'FITNESS_TO_FLY'
  | 'FITNESS_TO_DRIVE'
  | 'OTHER';

export type CertificateStatus = 'ACTIVE' | 'REVOKED';

// ─── Referrals I issued ──────────────────────────────────────────────────────

/** One row of GET /me/referrals (DoctorReferralListView — ids only, no
 *  patient display name, no reason text). */
export interface DoctorReferralRow {
  referralId: string;
  /** Patient USER id — a raw id; the projection has no display name. */
  patientId?: string;
  doctorUserId?: string;
  referralType?: ReferralType | string;
  targetSpecialty?: string | null;
  urgency?: ReferralUrgency | string;
  validityDays?: number;
  /** ISO timestamp. */
  issuedAt?: string;
  status?: ReferralStatus | string;
}

export interface MyReferralsPayload {
  referrals?: DoctorReferralRow[] | null;
}

/** POST /referrals body (issueReferralSchema). */
export interface IssueReferralBody {
  patientId: string;
  referralType: ReferralType | string;
  targetSpecialty?: string;
  targetFacilityId?: string;
  reason: string;
  clinicalContext?: string;
  urgency: ReferralUrgency | string;
  validityDays?: number;
}

export interface IssueReferralResult {
  referralId?: string;
}

export interface CancelReferralResult {
  referralId?: string;
}

// ─── Certificates I issued ───────────────────────────────────────────────────

/** One row of GET /me/medical-certificates (DoctorCertificateListView —
 *  metadata only; reason/restrictions never cross the list wire). */
export interface DoctorCertificateRow {
  certificateId: string;
  /** Patient USER id — a raw id; the projection has no display name. */
  patientId?: string;
  doctorUserId?: string;
  certificateType?: CertificateType | string;
  /** ISO timestamp. */
  validFrom?: string;
  /** ISO timestamp. */
  validUntil?: string;
  /** ISO timestamp. */
  issuedAt?: string;
  status?: CertificateStatus | string;
}

export interface MyCertificatesPayload {
  certificates?: DoctorCertificateRow[] | null;
}

/** POST /medical-certificates body (issueCertificateSchema — validFrom /
 *  validUntil must be UTC ISO-8601 with a Z suffix). */
export interface IssueCertificateBody {
  patientId: string;
  certificateType: CertificateType | string;
  reason: string;
  validFrom: string;
  validUntil: string;
  restrictions?: string;
}

export interface IssueCertificateResult {
  certificateId?: string;
}

export interface RevokeCertificateResult {
  certificateId?: string;
}

// ─── Patient picker (POST /doctors/me/patients/search) ──────────────────────

/** One consent-gated panel row — initials/id-only projection (no names). */
export interface PickerPatient {
  patientId: string;
  /** Two-hex display token derived from the UUID — NEVER a name. */
  initials?: string;
  /** Decade bracket "20–30" / "90+" / "unknown" — never a raw DOB. */
  ageBracket?: string;
}

export interface PatientSearchPayload {
  patients?: PickerPatient[] | null;
}
