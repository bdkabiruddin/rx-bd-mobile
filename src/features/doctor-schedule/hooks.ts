// Doctor Today + schedule — cached-read hooks. Stable keys so the write
// screens can invalidate after a successful mutation.

import { useCachedQuery, type CachedQueryResult } from '@/api/useCachedQuery';
import { useSession } from '@/auth/sessionStore';

import type {
  DoctorChambersPayload,
  MySchedulePayload,
  ScheduleBlocksPayload,
  UpcomingAppointmentsPayload,
} from './types';

export const DOCTOR_TODAY_KEY = 'doctor:today:upcoming';
export const DOCTOR_SCHEDULE_KEY = 'doctor:schedule:slots';
export const DOCTOR_BLOCKS_KEY = 'doctor:schedule:blocks';
export const DOCTOR_CHAMBERS_KEY = 'doctor:schedule:chambers';

/** Upcoming rows cover today comfortably (backend caps limit at 200). */
export const TODAY_FETCH_LIMIT = 100;

const TODAY_TTL_MS = 5 * 60 * 1000;
const SCHEDULE_TTL_MS = 10 * 60 * 1000;

/** The signed-in doctor's upcoming appointments — the handler's DOCTOR
 *  branch pins the scope to the caller, so no query filters are needed.
 *  PHI: appointment timestamps tied to patient ids are PHI. */
export function useDoctorUpcoming(): CachedQueryResult<UpcomingAppointmentsPayload> {
  const userId = useSession((s) => s.userId);
  return useCachedQuery<UpcomingAppointmentsPayload>({
    key: DOCTOR_TODAY_KEY,
    path: `/api/v1/appointments/upcoming?limit=${TODAY_FETCH_LIMIT}`,
    ttlMs: TODAY_TTL_MS,
    isPhi: true,
    enabled: userId !== null,
    ...(userId !== null ? { userId } : {}),
  });
}

/** My published recurring weekly schedule (non-PHI catalog rows). */
export function useMySchedule(): CachedQueryResult<MySchedulePayload> {
  const userId = useSession((s) => s.userId);
  return useCachedQuery<MySchedulePayload>({
    key: DOCTOR_SCHEDULE_KEY,
    path: '/api/v1/doctors/me/schedule',
    ttlMs: SCHEDULE_TTL_MS,
    isPhi: false,
    enabled: userId !== null,
    ...(userId !== null ? { userId } : {}),
  });
}

/** My applied schedule-block history, most recent first (non-PHI). */
export function useMyScheduleBlocks(): CachedQueryResult<ScheduleBlocksPayload> {
  const userId = useSession((s) => s.userId);
  return useCachedQuery<ScheduleBlocksPayload>({
    key: DOCTOR_BLOCKS_KEY,
    path: '/api/v1/doctors/me/schedule/blocks?limit=50',
    ttlMs: SCHEDULE_TTL_MS,
    isPhi: false,
    enabled: userId !== null,
    ...(userId !== null ? { userId } : {}),
  });
}

/** My chambers ({id} = the doctor's own user id) — resolves slot
 *  facilityIds to chamber display names. Non-PHI directory rows. */
export function useMyChambers(): CachedQueryResult<DoctorChambersPayload> {
  const userId = useSession((s) => s.userId);
  return useCachedQuery<DoctorChambersPayload>({
    key: DOCTOR_CHAMBERS_KEY,
    path: `/api/v1/doctors/${userId ?? 'unknown'}/chambers`,
    ttlMs: SCHEDULE_TTL_MS,
    isPhi: false,
    enabled: userId !== null,
    ...(userId !== null ? { userId } : {}),
  });
}
