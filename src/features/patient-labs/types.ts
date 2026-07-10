// Patient labs — local wire types mirrored from the rx.bd backend.
//
// Sources (READ-ONLY mirrors; do not import backend code):
//   - GET /api/v1/patients/{id}/lab-orders →
//     ListLabOrdersByPatientResult (src/modules/diagnostic-centre/
//     application/queries/ListLabOrdersByPatientHandler.ts). PATIENT may
//     read their own id only (route customOwnership).
//   - GET /api/v1/lab-orders/{id}/lab-results →
//     ListLabResultsByOrderResult (ListLabResultsByOrderHandler.ts).
//     PATIENT viewers receive ONLY RELEASED rows (FIND-060 maker/checker
//     scoping happens server-side; the app renders what it gets and
//     never infers beyond it).
//
// Result payloads are a backend discriminated union on `kind`
// ('numeric' | 'text' | 'multi-analyte') with a legacy free-form
// fallback (src/modules/diagnostic-centre/domain/LabResult.ts). The
// wire field is typed `unknown` here and narrowed at runtime in
// logic.ts — a malformed or legacy payload degrades to an honest
// "can't display" notice, never to invented values.
//
// Only fields this feature renders are declared; everything the server
// merely *may* send is marked optional/nullable defensively.

/** Mirror of LabOrderStatus (domain/LabOrderEnums.ts). Read-side status
 *  fields stay plain strings so unknown future values degrade to a
 *  neutral pill instead of breaking the screen. */
export type LabOrderStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

/** Mirror of LabOrderPriority. */
export type LabOrderPriority = 'ROUTINE' | 'URGENT' | 'STAT';

/** Mirror of LabResultStatus — patients only ever receive RELEASED. */
export type LabResultStatus = 'PRELIMINARY' | 'RELEASED';

/** One ordered test line (mirror of LabOrderTest). */
export interface LabOrderTestView {
  code?: string;
  /** Human-readable test name captured at order time. */
  name?: string;
}

/** One row of the patient lab-order list (mirror of LabOrderView). */
export interface LabOrderListItem {
  labOrderId: string;
  patientId?: string;
  /** Ordering user id (UUID) — no display name on this payload. */
  orderedByUserId?: string;
  /** Diagnostic centre id (UUID) — no display name on this payload. */
  centreId?: string;
  /** ISO timestamp. */
  orderedAt?: string;
  tests?: LabOrderTestView[];
  priority?: string;
  status?: string;
  notes?: string | null;
}

/** GET /patients/{id}/lab-orders payload. */
export interface LabOrdersPayload {
  orders?: LabOrderListItem[];
  pagination?: { limit?: number; offset?: number };
}

/** One result row reported against an order (mirror of LabResultView). */
export interface LabResultListItem {
  resultId: string;
  labOrderId?: string;
  centreId?: string;
  reportedByUserId?: string;
  /** ISO timestamp. */
  reportedAt?: string;
  /** Discriminated union on `kind` OR a legacy free-form record —
   *  narrowed at runtime by normalizeResultPayload (logic.ts). */
  payload?: unknown;
  status?: string;
  /** ISO timestamp; null while unreleased (patients never see those rows). */
  releasedAt?: string | null;
}

/** GET /lab-orders/{id}/lab-results payload. */
export interface LabResultsPayload {
  results?: LabResultListItem[];
}
