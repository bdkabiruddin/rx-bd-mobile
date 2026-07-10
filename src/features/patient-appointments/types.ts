// Patient appointments — local API contract mirrors.
//
// Shapes are hand-mirrored from the backend source (READ-ONLY reference):
//   - GET  /api/v1/patients/{id}/appointments
//       → ListAppointmentsByPatientHandler.AppointmentListView
//   - GET  /api/v1/appointments/{id}
//       → GetAppointmentHandler.AppointmentView
//   - GET  /api/v1/specialties                → { specialties: [{code,label,doctorCount}] }
//   - GET  /api/v1/specialties/{code}/doctors → SearchDoctorsBySpecialtyResult
//   - GET  /api/v1/doctors/{id}/available-slots → ListAvailableScheduleSlotsResult
//   - GET  /api/v1/doctors/{id}/booked-times    → { ranges, from, to }
//   - GET  /api/v1/doctors/{id}/chambers        → { chambers: DoctorChamber[] }
//   - POST /api/v1/appointments                 → ScheduleAppointmentResult
//   - POST /api/v1/appointments/{id}/cancel     → UpdateAppointmentStatusResult
//   - PATCH /api/v1/appointments/{id}/reschedule → RescheduleAppointmentResult
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

/** One row of GET /api/v1/patients/{id}/appointments (metadata only — no
 *  reason/notes on the list projection). */
export interface PatientAppointmentListItem {
  appointmentId: string;
  patientId?: string;
  doctorUserId?: string | null;
  /** Doctor display name resolved server-side; null when unresolvable. */
  doctorName?: string | null;
  facilityType?: AppointmentFacilityType | string;
  facilityId?: string | null;
  chamberName?: string | null;
  chamberAddress?: string | null;
  /** ISO timestamp (Date serialized by the route layer). */
  scheduledAt: string;
  durationMinutes?: number;
  appointmentType?: AppointmentType | string;
  status: AppointmentStatus | string;
  createdAt?: string;
}

export interface PatientAppointmentsResult {
  appointments?: PatientAppointmentListItem[] | null;
  pagination?: { limit?: number; offset?: number };
}

/** GET /api/v1/appointments/{id} — PHI-bearing single view. */
export interface AppointmentDetailView {
  appointmentId: string;
  patientId?: string;
  doctorUserId?: string | null;
  facilityType?: AppointmentFacilityType | string;
  facilityId?: string | null;
  scheduledAt: string;
  durationMinutes?: number;
  appointmentType?: AppointmentType | string;
  status: AppointmentStatus | string;
  /** PHI — chief complaint. */
  reason?: string | null;
  /** PHI — additional clinical context. */
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface GetAppointmentResult {
  appointment?: AppointmentDetailView | null;
}

/** GET /api/v1/specialties (public catalog). */
export interface SpecialtyEntry {
  code: string;
  label: string;
  doctorCount?: number;
}

export interface SpecialtiesResult {
  specialties?: SpecialtyEntry[] | null;
}

/** GET /api/v1/specialties/{code}/doctors — PUBLIC doctor view. */
export interface DoctorSearchItem {
  doctorProfileId?: string;
  /** Doctor USER id — the id used by /doctors/{id}/* and POST /appointments. */
  userId: string;
  doctorFullName?: string | null;
  primarySpecialty?: string;
  yearsOfPractice?: number;
  languagesSpoken?: string[];
  /** Stringified-BigInt paisa. */
  consultationFeePaisa?: string;
  isActive?: boolean;
}

export interface DoctorSearchResult {
  doctors?: DoctorSearchItem[] | null;
  count?: number;
}

/** GET /api/v1/doctors/{id}/available-slots — recurring window expanded to a
 *  concrete Dhaka-local date. facilityId === chamberId for chamber windows. */
export interface AvailableSlotWindow {
  /** Dhaka-local date, YYYY-MM-DD. */
  date: string;
  dayOfWeek?: string;
  /** Inclusive start, 0..1439 (Dhaka minutes). */
  startMinuteOfDay: number;
  /** Exclusive end, 1..1440. */
  endMinuteOfDay: number;
  facilityId?: string | null;
}

export interface AvailableSlotsResult {
  slots?: AvailableSlotWindow[] | null;
  lookaheadDays?: number;
}

/** GET /api/v1/doctors/{id}/booked-times — non-PHI busy ranges. */
export interface BookedTimeRange {
  scheduledAt: string;
  durationMinutes: number;
  facilityId?: string | null;
}

export interface BookedTimesResult {
  ranges?: BookedTimeRange[] | null;
  from?: string;
  to?: string;
}

/** GET /api/v1/doctors/{id}/chambers. */
export interface ChamberScheduleWindow {
  /** 0=Sun … 6=Sat (JS Date convention). */
  dayOfWeek: number;
  startMinuteOfDay: number;
  endMinuteOfDay: number;
  slotDurationMinutes?: number;
}

export interface DoctorChamber {
  id: string;
  name?: string;
  /** TELE_CLINIC renders as video consultation; null = legacy row. */
  type?: string | null;
  /** Set when the chamber sits inside a hospital — booking then submits
   *  (facilityType=HOSPITAL, facilityId=hospitalId). */
  hospitalId?: string | null;
  schedules?: ChamberScheduleWindow[];
}

export interface DoctorChambersResult {
  chambers?: DoctorChamber[] | null;
}

/** POST /api/v1/appointments body (scheduleAppointmentSchema). */
export interface BookAppointmentBody {
  patientId: string;
  doctorUserId?: string;
  facilityType: AppointmentFacilityType;
  facilityId?: string;
  scheduledAt: string;
  durationMinutes: number;
  appointmentType: AppointmentType;
  reason: string;
  /** Handler-layer dedupe key (the transport header is sent separately). */
  idempotencyKey?: string;
  chamberId?: string;
}

/** POST /api/v1/appointments response. */
export interface BookAppointmentResult {
  appointmentId?: string;
  replayed?: boolean;
}

/** POST /api/v1/appointments/{id}/cancel response. */
export interface CancelAppointmentResult {
  appointmentId?: string;
  previousStatus?: string;
  newStatus?: string;
}

/** PATCH /api/v1/appointments/{id}/reschedule response. */
export interface RescheduleAppointmentResult {
  appointmentId?: string;
  rescheduleId?: string;
  previousScheduledAt?: string;
  newScheduledAt?: string;
}
