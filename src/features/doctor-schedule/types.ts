// Doctor Today + schedule management — local API contract mirrors.
//
// Shapes are hand-mirrored from the backend source (READ-ONLY reference):
//   - GET  /api/v1/appointments/upcoming
//       → ListUpcomingAppointmentsHandler.UpcomingAppointmentView
//         (DOCTOR branch: server pins doctorUserId = ctx.userId)
//   - GET  /api/v1/doctors/me/schedule
//       → ListMyScheduleSlotsHandler.ListMyScheduleSlotsResult
//   - GET  /api/v1/doctors/me/schedule/blocks
//       → ListMyScheduleBlocksHandler.ListMyScheduleBlocksResult
//   - POST /api/v1/doctors/me/schedule/blocks
//       → BlockScheduleSlotsHandler.BlockScheduleSlotsResult
//   - POST /api/v1/doctors/me/schedule/recurring
//       → PublishScheduleSlotsHandler.PublishScheduleSlotsResult
//         (REPLACES the whole weekly set — "remove one slot" republishes
//          the remaining slots)
//   - GET  /api/v1/doctors/{id}/chambers ({id} = doctor USER id)
//       → chamber id → display-name resolution for slot facilityIds
//
// Only fields the app renders are mirrored; everything non-load-bearing is
// optional/nullable so a backend projection change degrades gracefully.

export type AppointmentStatus =
  | 'SCHEDULED'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'NO_SHOW'
  | 'CANCELLED';

export type AppointmentType =
  | 'CONSULTATION'
  | 'FOLLOW_UP'
  | 'LAB_VISIT'
  | 'PRESCRIPTION_REFILL'
  | 'TELEMEDICINE'
  | 'OTHER';

export type AppointmentFacilityType =
  | 'HOSPITAL'
  | 'DIAGNOSTIC_CENTRE'
  | 'PHARMACY'
  | 'TELEMEDICINE';

/** Backend DayOfWeek enum (doctor-profile module). */
export type DayOfWeek =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

/** One row of GET /api/v1/appointments/upcoming (metadata only — the
 *  projection carries ids, never patient names / reason / notes). */
export interface DoctorUpcomingAppointment {
  appointmentId: string;
  /** Patient USER id — a raw id; the projection has no display name. */
  patientId?: string;
  doctorUserId?: string | null;
  facilityType?: AppointmentFacilityType | string;
  facilityId?: string | null;
  /** ISO timestamp (Date serialized by the route layer). */
  scheduledAt: string;
  durationMinutes?: number;
  appointmentType?: AppointmentType | string;
  status: AppointmentStatus | string;
}

export interface UpcomingAppointmentsPayload {
  appointments?: DoctorUpcomingAppointment[] | null;
  pagination?: { limit?: number; offset?: number };
}

/** One recurring weekly slot (GET /api/v1/doctors/me/schedule). */
export interface MyScheduleSlot {
  id: string;
  dayOfWeek: DayOfWeek | string;
  /** Inclusive start, 0..1439 (Dhaka minutes). */
  startMinuteOfDay: number;
  /** Exclusive end, 1..1440. */
  endMinuteOfDay: number;
  /** Chamber the slot is held at; null = universal / telemedicine default. */
  facilityId?: string | null;
}

export interface MySchedulePayload {
  /** Null when the caller has no DoctorProfile in this tenant yet. */
  doctorProfileId: string | null;
  slots?: MyScheduleSlot[] | null;
}

/** One applied block (GET /api/v1/doctors/me/schedule/blocks). */
export interface ScheduleBlock {
  id: string;
  /** UTC ISO-8601. */
  startsAt: string;
  /** UTC ISO-8601. */
  endsAt: string;
  reason?: string | null;
  /** UTC ISO-8601 — when the block was POSTed. */
  appliedAt?: string;
  /** How many recurring weekly slots the block removed. */
  cancelledSlotCount?: number;
}

export interface ScheduleBlocksPayload {
  blocks?: ScheduleBlock[] | null;
}

/** POST /api/v1/doctors/me/schedule/blocks body
 *  (blockScheduleSlotsBodySchema — z.coerce.date accepts ISO strings). */
export interface BlockScheduleBody {
  startsAt: string;
  endsAt: string;
  reason?: string | null;
}

/** POST /api/v1/doctors/me/schedule/blocks response. */
export interface BlockScheduleResult {
  doctorProfileId?: string;
  removedSlotCount?: number;
  affectedDaysOfWeek?: (DayOfWeek | string)[];
}

/** POST /api/v1/doctors/me/schedule/recurring body
 *  (publishScheduleSlotsBodySchema — max 100 entries, replace semantics). */
export interface PublishScheduleBody {
  slots: {
    dayOfWeek: DayOfWeek | string;
    startMinuteOfDay: number;
    endMinuteOfDay: number;
    facilityId?: string | null;
  }[];
}

/** POST /api/v1/doctors/me/schedule/recurring response. */
export interface PublishScheduleResult {
  doctorProfileId?: string;
  slotCount?: number;
}

/** GET /api/v1/doctors/{id}/chambers — non-PHI chamber directory rows
 *  (only the fields this feature renders). */
export interface DoctorChamberLite {
  id: string;
  name?: string;
}

export interface DoctorChambersPayload {
  chambers?: DoctorChamberLite[] | null;
}
