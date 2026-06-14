// Shared domain constants mirrored from the rx.bd backend.
//
// These are pure, stable values (no runtime/server deps) that the mobile
// client needs to speak the backend's language: the reverify two-key
// intents, the portal role keys, and a few status enums. They are
// duplicated deliberately (see docs/01-architecture.md §2) — the OpenAPI
// client is the contract for shapes; these are the small constant set
// that drives client-side flow decisions.
//
// KEEP IN SYNC: src/shared/kernel/security/reverifyToken.ts (intents) and
// the role enum. A backend change to either is a `main` task (doc 07);
// update this file when the mobile branch pulls that change down.

/** Two-key reverify intents. A sensitive action maps to its intent, does a
 *  biometric step-up, obtains a reverify token, and attaches it. */
export const REVERIFY_INTENTS = {
  PRESCRIPTION_SIGN: 'prescription-sign',
  PRESCRIPTION_EDIT: 'prescription-edit',
  DISPENSE_CONTROLLED_SUBSTANCE: 'dispense-controlled-substance',
  DEATH_CERTIFICATE_ISSUE: 'death-certificate-issue',
  TENANT_LIFECYCLE: 'tenant-lifecycle',
  ADMIN_USER_MERGE: 'admin-user-merge',
  ADMIN_IMPERSONATE: 'admin-impersonate',
  AUDIT_LOG_EXPORT: 'audit-log-export',
  ADMIN_MFA_DISABLE: 'admin-mfa-disable',
  ADMIN_USER_SUSPEND: 'admin-user-suspend',
  CRON_MANUAL_RUN: 'cron-manual-run',
} as const;

export type ReverifyIntent =
  (typeof REVERIFY_INTENTS)[keyof typeof REVERIFY_INTENTS];

/** Portal role keys. Drives which persona stack the app routes into. */
export const ROLES = {
  PATIENT: 'PATIENT',
  DOCTOR: 'DOCTOR',
  PHARMACY_STAFF: 'PHARMACY_STAFF',
  LAB_STAFF: 'LAB_STAFF',
  DIAGNOSTIC_CENTRE_STAFF: 'DIAGNOSTIC_CENTRE_STAFF',
  HOSPITAL_ADMIN: 'HOSPITAL_ADMIN',
  HOSPITAL_STAFF: 'HOSPITAL_STAFF',
  STAFF: 'STAFF',
  ASSISTANT: 'ASSISTANT',
  VENDOR_STAFF: 'VENDOR_STAFF',
  INSURER_STAFF: 'INSURER_STAFF',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const;

export type RoleKey = (typeof ROLES)[keyof typeof ROLES];

/** Which persona home a role lands on after login. */
export function personaForRole(role: string): string {
  switch (role) {
    case ROLES.PATIENT:
      return 'patient';
    case ROLES.DOCTOR:
      return 'doctor';
    case ROLES.PHARMACY_STAFF:
      return 'pharmacy';
    case ROLES.LAB_STAFF:
      return 'lab';
    case ROLES.DIAGNOSTIC_CENTRE_STAFF:
      return 'diagnostic-centre';
    case ROLES.HOSPITAL_ADMIN:
    case ROLES.HOSPITAL_STAFF:
      return 'hospital';
    case ROLES.ASSISTANT:
      return 'assistant';
    case ROLES.VENDOR_STAFF:
    case ROLES.INSURER_STAFF:
      return 'vendor';
    case ROLES.ADMIN:
    case ROLES.SUPER_ADMIN:
      return 'admin';
    case ROLES.STAFF:
    default:
      return 'staff';
  }
}

/** True for personas that handle PHI — drives the screenshot guard default. */
export function roleHandlesPhi(role: string): boolean {
  return role !== ROLES.VENDOR_STAFF && role !== ROLES.INSURER_STAFF;
}
