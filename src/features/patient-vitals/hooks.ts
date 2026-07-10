// Patient vitals — cached-read hook. One stable key for the whole diary;
// filtering/grouping happen client-side so the chips work instantly and
// offline. The add screen invalidates VITALS_LIST_KEY after a successful
// save so the diary refreshes.

import { useCachedQuery, type CachedQueryResult } from '@/api/useCachedQuery';
import { useSession } from '@/auth/sessionStore';

import type { VitalsListPayload } from './types';

export const VITALS_LIST_KEY = 'patient:vitals:list';

/** How much history one fetch covers — the backend caps limit at 200; the
 *  diary shows an honest "latest N of M" footer beyond that. */
export const VITALS_FETCH_LIMIT = 200;

const VITALS_TTL_MS = 5 * 60 * 1000;

/** The signed-in patient's vital readings (self read: {id} = session userId). */
export function usePatientVitals(): CachedQueryResult<VitalsListPayload> {
  const userId = useSession((s) => s.userId);
  return useCachedQuery<VitalsListPayload>({
    key: VITALS_LIST_KEY,
    path: `/api/v1/patients/${userId ?? 'unknown'}/vitals?limit=${VITALS_FETCH_LIMIT}`,
    ttlMs: VITALS_TTL_MS,
    isPhi: true,
    enabled: userId !== null,
    ...(userId !== null ? { userId } : {}),
  });
}
