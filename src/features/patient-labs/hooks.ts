// Patient labs — shared cached-read hooks. Both screens (index, [id])
// reuse the SAME orders query key, so the detail screen resolves its
// order from the already-encrypted-cached list without a second
// endpoint (the backend exposes no single-order GET for patients).
//
// Endpoints (verified against openapi.yaml + backend route auth):
//   GET /api/v1/patients/{id}/lab-orders     — PATIENT self-read OK
//   GET /api/v1/lab-orders/{id}/lab-results  — PATIENT owner-read OK;
//       the server returns ONLY RELEASED rows to patient viewers.

import { useCachedQuery, type CachedQueryResult } from '@/api/useCachedQuery';
import { useSession } from '@/auth/sessionStore';

import type { LabOrdersPayload, LabResultsPayload } from './types';

const ORDERS_TTL_MS = 10 * 60 * 1000;
const RESULTS_TTL_MS = 5 * 60 * 1000;

/** The backend's list default is 50; ask for 100 (max 200) so the
 *  detail screen's in-cache lookup covers deeper history. */
const ORDERS_LIMIT = 100;

/** The signed-in patient's lab orders, newest first. */
export function usePatientLabOrders(): CachedQueryResult<LabOrdersPayload> {
  const userId = useSession((s) => s.userId);
  return useCachedQuery<LabOrdersPayload>({
    key: 'patient:labs:orders',
    path: `/api/v1/patients/${userId ?? 'unknown'}/lab-orders?limit=${ORDERS_LIMIT}`,
    ttlMs: ORDERS_TTL_MS,
    isPhi: true,
    enabled: userId !== null,
    ...(userId !== null ? { userId } : {}),
  });
}

/** Released results reported against one of the patient's lab orders. */
export function useLabOrderResults(
  labOrderId: string | undefined,
): CachedQueryResult<LabResultsPayload> {
  const userId = useSession((s) => s.userId);
  return useCachedQuery<LabResultsPayload>({
    key: `patient:labs:results:${labOrderId ?? 'unknown'}`,
    path: `/api/v1/lab-orders/${labOrderId ?? 'unknown'}/lab-results`,
    ttlMs: RESULTS_TTL_MS,
    isPhi: true,
    enabled: labOrderId !== undefined,
    ...(userId !== null ? { userId } : {}),
  });
}
