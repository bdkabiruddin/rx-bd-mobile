// Doctor lab orders + results inbox — cached-read hooks + the
// session-local acknowledged-results store.
//
// Stable query keys so the write flows (place order, acknowledge) can
// invalidate after a successful mutation. The inbox key is shared by the
// orders index (badge count) and the inbox screen (list) — one fetch, one
// encrypted cache row.

import { create } from 'zustand';

import { useCachedQuery, type CachedQueryResult } from '@/api/useCachedQuery';
import { useSession } from '@/auth/sessionStore';

import type {
  CatalogPayload,
  CentresPayload,
  LabResultDetailPayload,
  MyLabOrdersPayload,
  ResultsInboxPayload,
} from './types';

export const DOCTOR_ORDERS_KEY = 'doctor:orders:mine';
export const RESULTS_INBOX_KEY = 'doctor:orders:inbox';
export const CENTRES_KEY = 'doctor:orders:centres';
export const CATALOG_DEFAULT_KEY = 'doctor:orders:catalog-default';

export function resultDetailKey(resultId: string): string {
  return `doctor:orders:result:${resultId}`;
}

const ORDERS_TTL_MS = 5 * 60 * 1000;
const INBOX_TTL_MS = 5 * 60 * 1000;
const DETAIL_TTL_MS = 5 * 60 * 1000;
/** Reference data (non-PHI) — a longer window is fine. */
const REFERENCE_TTL_MS = 15 * 60 * 1000;

/** Backend list default is 50; ask for 100 (max 200) for deeper history. */
const ORDERS_LIMIT = 100;
const CENTRES_LIMIT = 100;

function useScope(): { userId: string | null; scope: { tenantId?: string; userId?: string } } {
  const userId = useSession((s) => s.userId);
  const tenantId = useSession((s) => s.tenantId);
  return {
    userId,
    scope: {
      ...(tenantId !== null ? { tenantId } : {}),
      ...(userId !== null ? { userId } : {}),
    },
  };
}

/** Lab orders authored by the signed-in doctor, newest first.
 *  PHI: a test panel implies a diagnosis. */
export function useMyLabOrders(): CachedQueryResult<MyLabOrdersPayload> {
  const { userId, scope } = useScope();
  return useCachedQuery<MyLabOrdersPayload>({
    key: DOCTOR_ORDERS_KEY,
    path: `/api/v1/doctors/me/lab-orders?limit=${ORDERS_LIMIT}`,
    ttlMs: ORDERS_TTL_MS,
    isPhi: true,
    enabled: userId !== null,
    ...scope,
  });
}

/** Results recorded against the doctor's orders (COMPLETED orders with at
 *  least one result). Unseen results are clinical risk — both the index
 *  badge and the inbox screen read THIS query. PHI: test names. */
export function useResultsInbox(): CachedQueryResult<ResultsInboxPayload> {
  const { userId, scope } = useScope();
  return useCachedQuery<ResultsInboxPayload>({
    key: RESULTS_INBOX_KEY,
    path: '/api/v1/doctors/me/results-inbox',
    ttlMs: INBOX_TTL_MS,
    isPhi: true,
    enabled: userId !== null,
    ...scope,
  });
}

/** Full result detail (values + acknowledgement state + doctorNote).
 *  Doctor-gated server-side: only the ordering doctor may read it. */
export function useLabResultDetail(
  resultId: string | null,
): CachedQueryResult<LabResultDetailPayload> {
  const { userId, scope } = useScope();
  const id = resultId ?? '';
  return useCachedQuery<LabResultDetailPayload>({
    key: resultDetailKey(id.length > 0 ? id : 'unknown'),
    path: `/api/v1/lab-results/${encodeURIComponent(id.length > 0 ? id : 'unknown')}`,
    ttlMs: DETAIL_TTL_MS,
    isPhi: true,
    enabled: userId !== null && id.length > 0,
    ...scope,
  });
}

/** ACTIVE diagnostic-centre directory (redacted, non-PHI) — the order
 *  placement endpoint is centre-keyed, so the form needs a picker. */
export function useCentresDirectory(enabled: boolean): CachedQueryResult<CentresPayload> {
  const { userId, scope } = useScope();
  return useCachedQuery<CentresPayload>({
    key: CENTRES_KEY,
    path: `/api/v1/diagnostic-centres/directory?limit=${CENTRES_LIMIT}`,
    ttlMs: REFERENCE_TTL_MS,
    isPhi: false,
    enabled: enabled && userId !== null,
    ...scope,
  });
}

/** Default (no-query) slice of the lab-test catalog so the picker offers
 *  common tests before the doctor types. Non-PHI reference data. */
export function useCatalogDefaults(enabled: boolean): CachedQueryResult<CatalogPayload> {
  return useCachedQuery<CatalogPayload>({
    key: CATALOG_DEFAULT_KEY,
    path: '/api/v1/lab-test-catalog?limit=20',
    ttlMs: REFERENCE_TTL_MS,
    isPhi: false,
    enabled,
  });
}

// ─── Acknowledged-results store (session-local, server-confirmed) ────────────
//
// GET /doctors/me/results-inbox carries no acknowledged flag and does not
// filter acknowledged rows (backend gap — reported). This store holds ONLY
// server-confirmed acknowledgements observed this session:
//   - a successful POST /lab-results/{id}/acknowledge, or
//   - a detail read whose acknowledgedByDoctorAt is non-null.
// The inbox filters against it so an acknowledged result leaves the list
// immediately; a fresh session honestly re-shows whatever the server sends
// until the backend exposes ack state on the list surface.

interface AckedResultsState {
  ids: Readonly<Record<string, boolean>>;
  markAcked: (resultId: string) => void;
}

export const useAckedResults = create<AckedResultsState>((set) => ({
  ids: {},
  markAcked: (resultId) =>
    set((s) => (s.ids[resultId] === true ? s : { ids: { ...s.ids, [resultId]: true } })),
}));
