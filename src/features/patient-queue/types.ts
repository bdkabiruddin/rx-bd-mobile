// Patient live queue position — local API contract mirrors.
//
// Shapes are hand-mirrored from the backend source (READ-ONLY reference):
//   - GET /api/v1/me/queue-position?chamberId=…
//       → GetMyQueuePositionHandler.GetMyQueuePositionResult
//         { entry: QueueEntryDto, position: number | null }
//       404 RESOURCE_NOT_FOUND = no active entry at that chamber today.
//   - GET /api/v1/patients/{id}/appointments
//       → ListAppointmentsByPatientHandler.AppointmentListView
//         (chamber DISCOVERY only — the view carries chamberName but NOT
//          the raw chamberId; doctorUserId bridges to /doctors/{id}/chambers)
//   - GET /api/v1/doctors/{id}/chambers
//       → chamber id + display name for the queue probe candidates.
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

/** Subset of the backend QueueEntryDto this screen renders. PHI fields
 *  the screen does not need (patientName, patientPhone, prep notes) are
 *  deliberately NOT mirrored. */
export interface QueueEntryLite {
  id?: string;
  /** Daily serial at this chamber (1, 2, 3 …). */
  queueNumber?: number;
  /** Printed token handed to the patient at check-in. */
  tokenNumber?: string | null;
  stage: QueueStage | string;
  priority?: QueuePriority | string;
  /** 0 = the backend did not estimate a wait. */
  estimatedWaitTimeMinutes?: number;
  chamberId?: string;
  doctorUserId?: string | null;
  /** ISO-8601. */
  checkInTime?: string;
}

/** GET /api/v1/me/queue-position response (envelope auto-unwrapped).
 *  position is 1-based; null when IN_CONSULTATION. */
export interface QueuePositionPayload {
  entry?: QueueEntryLite | null;
  position?: number | null;
}

/** One row of GET /api/v1/patients/{id}/appointments — discovery subset. */
export interface AppointmentRowLite {
  appointmentId: string;
  doctorUserId?: string | null;
  doctorName?: string | null;
  chamberName?: string | null;
  /** ISO timestamp. */
  scheduledAt: string;
  status: string;
}

export interface PatientAppointmentsPayload {
  appointments?: AppointmentRowLite[] | null;
}

/** One row of GET /api/v1/doctors/{id}/chambers — discovery subset. */
export interface DoctorChamberLite {
  id: string;
  name?: string | null;
}

export interface DoctorChambersPayload {
  chambers?: DoctorChamberLite[] | null;
}

/** Last successful probe, kept on screen (marked stale) when polling
 *  later fails — honesty over freshness. */
export interface PositionSnapshot {
  chamberId: string;
  position: number | null;
  entry: QueueEntryLite;
  /** Client clock at the successful fetch. */
  fetchedAt: number;
  doctorName: string | null;
  chamberName: string | null;
}
