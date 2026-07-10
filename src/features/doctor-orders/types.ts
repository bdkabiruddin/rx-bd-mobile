// Doctor lab orders + results inbox — local API contract mirrors.
//
// Shapes are hand-mirrored from the backend source (READ-ONLY reference):
//   - GET  /api/v1/doctors/me/lab-orders
//       → ListLabOrdersByOrderingDoctorHandler.ListLabOrdersByOrderingDoctorResult
//         (authorship shape: server pins orderedByUserId = ctx.userId)
//   - GET  /api/v1/doctors/me/results-inbox
//       → route _lib/types ListLabOrdersByDoctorResult (ResultsInboxItem rows;
//         COMPLETED orders that have at least one recorded result)
//   - GET  /api/v1/lab-results/{id}
//       → route LabResultDetailResponse (ordering doctor only; payload +
//         acknowledgement state + doctorNote)
//   - POST /api/v1/lab-results/{id}/acknowledge
//       → route AcknowledgeResult ({ doctorNote? } body; first ack wins)
//   - POST /api/v1/diagnostic-centres/{id}/lab-orders
//       → PlaceLabOrderHandler.PlaceLabOrderResult
//         (body = placeLabOrderSchema minus centreId — centre rides the URL)
//   - GET  /api/v1/lab-test-catalog?q=&limit=
//       → SearchLabTestCatalogHandler.SearchLabTestCatalogResult (non-PHI)
//   - GET  /api/v1/diagnostic-centres/directory
//       → route DiagnosticCentreDirectoryResult (ACTIVE centres, redacted)
//   - POST /api/v1/doctors/me/patients/search
//       → panel search (patientId substring within the doctor's OWN panel)
//
// Only fields the app renders are mirrored; everything non-load-bearing is
// optional/nullable so a backend projection change degrades gracefully.
// Backend Date fields arrive as ISO strings after JSON serialization.

// ─── Shared enums (kept as open strings on read paths) ──────────────────────

export type LabOrderStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type LabOrderPriority = 'ROUTINE' | 'URGENT' | 'STAT';

/** One ordered test line (mirror of domain LabOrderTest — { code, name }). */
export interface OrderTestRef {
  code?: string;
  name?: string;
}

// ─── GET /doctors/me/lab-orders ──────────────────────────────────────────────

/** Mirrors DoctorAuthoredLabOrderView. */
export interface MyLabOrderRow {
  labOrderId: string;
  patientId?: string;
  centreId?: string;
  /** ISO timestamp. */
  orderedAt?: string;
  tests?: OrderTestRef[] | null;
  priority?: LabOrderPriority | string;
  status?: LabOrderStatus | string;
  notes?: string | null;
}

export interface MyLabOrdersPayload {
  orders?: MyLabOrderRow[] | null;
  pagination?: { limit?: number; offset?: number };
}

// ─── GET /doctors/me/results-inbox ───────────────────────────────────────────

/** Mirrors the route's ResultsInboxItem. NOTE: the row carries NO
 *  acknowledged flag — see hooks.ts useAckedResults for the honest
 *  session-local compensation. */
export interface ResultsInboxRow {
  labOrderId: string;
  patientId?: string;
  /** Opaque display token "PT-XXXX" derived server-side from the UUID. */
  patientInitials?: string;
  /** Test display names (strings, not {code,name} refs on this surface). */
  tests?: string[] | null;
  /** ISO timestamp. */
  orderedAt?: string;
  priority?: LabOrderPriority | string;
  /** Derived server-side from the result payload's critical markers. */
  hasCritical?: boolean;
  latestResultId?: string;
  /** ISO timestamp of the newest result on the order. */
  latestResultAt?: string;
}

export interface ResultsInboxPayload {
  orders?: ResultsInboxRow[] | null;
}

// ─── GET /lab-results/{id} ───────────────────────────────────────────────────

/** Mirrors the route's LabResultDetailResponse. */
export interface LabResultDetailPayload {
  labResultId?: string;
  labOrderId?: string;
  centreId?: string;
  /** ISO timestamp. */
  reportedAt?: string;
  /** Free-form / tagged-union result payload — narrowed at runtime in
   *  logic.ts (normalizeResultPayload); never rendered by guesswork. */
  payload?: unknown;
  /** ISO timestamp | null — null means not yet acknowledged. */
  acknowledgedByDoctorAt?: string | null;
  doctorNote?: string | null;
  order?: {
    labOrderId?: string;
    patientId?: string;
    tests?: OrderTestRef[] | null;
    priority?: LabOrderPriority | string;
    notes?: string | null;
    /** ISO timestamp. */
    orderedAt?: string;
  };
}

// ─── POST /lab-results/{id}/acknowledge ──────────────────────────────────────

/** Body: doctorNote max 2000 chars, optional. */
export interface AcknowledgeBody {
  doctorNote?: string;
}

export interface AcknowledgeResult {
  labResultId?: string;
  acknowledgedByDoctorAt?: string;
  alreadyAcknowledged?: boolean;
}

// ─── POST /diagnostic-centres/{id}/lab-orders ────────────────────────────────

/** One test line the order body carries — schema is .strict():
 *  EXACTLY { code, name }, nothing else. */
export interface OrderTest {
  code: string;
  name: string;
}

export interface PlaceLabOrderBody {
  patientId: string;
  tests: OrderTest[];
  priority?: LabOrderPriority;
  notes?: string;
}

export interface PlaceLabOrderResult {
  labOrderId?: string;
  /** TRUE on an idempotency replay, FALSE on a fresh write. */
  replayed?: boolean;
}

// ─── GET /lab-test-catalog ───────────────────────────────────────────────────

/** Mirrors LabTestCatalogEntry (lab-test-catalog module). Non-PHI. */
export interface CatalogEntry {
  id?: string;
  /** LOINC code if known, else internal "RXBD-NNN" code. Order-time test
   *  codes are validated against this catalog server-side. */
  code: string;
  displayName?: string;
  displayNameBn?: string | null;
  specimenType?: string | null;
  category?: string;
  common?: boolean;
}

export interface CatalogPayload {
  entries?: CatalogEntry[] | null;
  total?: number;
}

// ─── GET /diagnostic-centres/directory ───────────────────────────────────────

/** Redacted ACTIVE-centre directory row (non-PHI). */
export interface CentreRow {
  centreId: string;
  name?: string;
  city?: string;
  district?: string;
  status?: string;
}

export interface CentresPayload {
  centres?: CentreRow[] | null;
  pagination?: { limit?: number; offset?: number };
}

// ─── POST /doctors/me/patients/search ────────────────────────────────────────

/** Panel-search row (initials-only projection — never names). */
export interface SearchPatientRow {
  patientId: string;
  initials?: string;
  ageBracket?: string;
  lastVisitAt?: string | null;
}

export interface PatientSearchPayload {
  patients?: SearchPatientRow[] | null;
}
