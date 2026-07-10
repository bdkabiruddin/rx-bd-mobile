// Patient meds — shared cached-read hooks. All three surfaces (index,
// detail, reminders) reuse these so the cache keys stay stable and the
// prescriptions list is fetched once for both the list screen and the
// reminder prescription-picker.

import { useCachedQuery, type CachedQueryResult } from '@/api/useCachedQuery';
import { useSession } from '@/auth/sessionStore';

import type {
  MedicationsPayload,
  PrescriptionsPayload,
  RemindersPayload,
} from './types';

const LIST_TTL_MS = 10 * 60 * 1000;
const REMINDERS_TTL_MS = 5 * 60 * 1000;

/** The signed-in patient's prescriptions (metadata-only projection). */
export function usePatientPrescriptions(): CachedQueryResult<PrescriptionsPayload> {
  const userId = useSession((s) => s.userId);
  return useCachedQuery<PrescriptionsPayload>({
    key: 'patient:meds:prescriptions',
    path: `/api/v1/patients/${userId ?? 'unknown'}/prescriptions`,
    ttlMs: LIST_TTL_MS,
    isPhi: true,
    enabled: userId !== null,
    ...(userId !== null ? { userId } : {}),
  });
}

/** Current (ACTIVE + PAUSED) medications for the signed-in patient. */
export function useCurrentMedications(): CachedQueryResult<MedicationsPayload> {
  const userId = useSession((s) => s.userId);
  return useCachedQuery<MedicationsPayload>({
    key: 'patient:meds:current',
    path: `/api/v1/patients/${userId ?? 'unknown'}/medications?currentOnly=true`,
    ttlMs: LIST_TTL_MS,
    isPhi: true,
    enabled: userId !== null,
    ...(userId !== null ? { userId } : {}),
  });
}

/** The signed-in patient's medication reminders (non-cancelled rows). */
export function useMedicationReminders(): CachedQueryResult<RemindersPayload> {
  const userId = useSession((s) => s.userId);
  return useCachedQuery<RemindersPayload>({
    key: 'patient:meds:reminders',
    path: '/api/v1/me/medication-reminders',
    ttlMs: REMINDERS_TTL_MS,
    isPhi: true,
    ...(userId !== null ? { userId } : {}),
  });
}
