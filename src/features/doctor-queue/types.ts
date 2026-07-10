// Doctor chamber queue — local API contract mirrors.
//
// Shapes are hand-mirrored from the backend source (READ-ONLY reference):
//   - GET /api/v1/me/chambers
//       → ListMyChambersWithAttendanceHandler.ListMyChambersWithAttendanceResult
//         (only the id/name/isPrimary/isActive subset this feature renders)
//   - GET /api/v1/me/doctor-queue?chamberId=…
//       → ListDoctorQueueHandler.ListDoctorQueueResult
//         { entries: QueueEntryDto[], total } — DOCTOR_READY only,
//         priority DESC then checkInTime ASC (server-sorted; kept as-is)
//   - GET /api/v1/chambers/{id}/queue?limit=100
//       → ListChamberQueueHandler.ListChamberQueueResult — ALL of today's
//         stages; the IN_CONSULTATION bucket feeds the now-serving card
//         (mirrors the web QueueClient)
//   - POST /api/v1/queue/call-next          → CallNextPatientResult
//   - POST /api/v1/queue/{entryId}/complete → CompleteConsultationResult
//   - POST /api/v1/queue/{entryId}/no-show  → MarkNoShowResult
//
// Only fields this feature renders are mirrored; everything
// non-load-bearing is optional/nullable so a backend projection change
// degrades gracefully.

/** QueueStage — mirrors src/modules/queue/domain/QueueEnums.ts. */
export type QueueStage =
  | 'CHECKED_IN'
  | 'ASSISTANT_PREP'
  | 'DOCTOR_READY'
  | 'IN_CONSULTATION'
  | 'COMPLETED'
  | 'NO_SHOW'
  | 'CANCELLED';

/** QueuePriority — mirrors src/modules/queue/domain/QueueEnums.ts. */
export type QueuePriority = 'NORMAL' | 'URGENT' | 'EMERGENCY';

/** Subset of the backend QueueEntryDto this screen renders.
 *  `id` and `stage` are structurally guaranteed by the DTO and are
 *  load-bearing (mutations + bucketing); the rest is defensive. */
export interface DoctorQueueEntry {
  id: string;
  stage: QueueStage | string;
  /** Daily serial at this chamber (1, 2, 3 …). */
  queueNumber?: number;
  /** Printed token handed to the patient at check-in. */
  tokenNumber?: string | null;
  patientId?: string;
  /** @phi — patient display name; rendered only behind the PHI guard. */
  patientName?: string | null;
  appointmentId?: string | null;
  appointmentType?: string;
  doctorUserId?: string | null;
  priority?: QueuePriority | string;
  /** ISO-8601. */
  checkInTime?: string;
  calledAt?: string | null;
  consultationStartTime?: string | null;
  /** @phi — assistant vitals/history snapshot for the doctor. */
  assistantPrepNotes?: string | null;
}

/** GET /api/v1/me/doctor-queue response (envelope auto-unwrapped). */
export interface DoctorQueuePayload {
  entries?: DoctorQueueEntry[] | null;
  total?: number;
}

/** GET /api/v1/chambers/{id}/queue response (envelope auto-unwrapped). */
export interface ChamberQueuePayload {
  entries?: DoctorQueueEntry[] | null;
  total?: number;
}

/** One row of GET /api/v1/me/chambers — selector subset. */
export interface ChamberLite {
  id: string;
  name?: string | null;
  isPrimary?: boolean;
  isActive?: boolean;
}

export interface MyChambersPayload {
  chambers?: ChamberLite[] | null;
}

/** POST /api/v1/queue/call-next result (CallNextPatientResult). */
export interface CallNextResultLite {
  entryId?: string;
  queueNumber?: number;
  tokenNumber?: string;
  patientId?: string;
  appointmentId?: string | null;
  stage?: string;
}

/** POST /api/v1/queue/{entryId}/complete result (CompleteConsultationResult). */
export interface CompleteConsultationResultLite {
  entryId?: string;
  stage?: string;
  consultationEndTime?: string;
}

/** POST /api/v1/queue/{entryId}/no-show result (MarkNoShowResult). */
export interface MarkNoShowResultLite {
  entryId?: string;
  stage?: string;
}

/** Last successful poll tick, kept on screen (marked stale) when a later
 *  tick fails — honesty over freshness. */
export interface DoctorQueueSnapshot {
  chamberId: string;
  /** First IN_CONSULTATION entry for THIS doctor, or null. */
  nowServing: DoctorQueueEntry | null;
  /** DOCTOR_READY entries in server order (priority, then check-in). */
  waiting: DoctorQueueEntry[];
  /** Client clock at the successful fetch. */
  fetchedAt: number;
}
