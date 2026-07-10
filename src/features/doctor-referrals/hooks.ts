// Doctor referrals + certificates — cached-read hooks. Stable keys so the
// write flows can invalidate after a successful mutation.
//
// PHI: both lists tie patient ids to clinical activity (referral existence,
// certificate validity windows) — cached encrypted with isPhi: true.

import { useCachedQuery, type CachedQueryResult } from '@/api/useCachedQuery';
import { useSession } from '@/auth/sessionStore';

import type { MyCertificatesPayload, MyReferralsPayload } from './types';

export const MY_REFERRALS_KEY = 'doctor:referrals:mine';
export const MY_CERTIFICATES_KEY = 'doctor:certificates:mine';

/** Backend caps limit at 100 (listReferralsQuerySchema). */
export const LIST_FETCH_LIMIT = 100;

const LIST_TTL_MS = 5 * 60 * 1000;

/** Referrals the signed-in doctor issued — GET /me/referrals pins the scope
 *  to the JWT userId, so no query filters are needed. */
export function useMyReferrals(): CachedQueryResult<MyReferralsPayload> {
  const userId = useSession((s) => s.userId);
  const tenantId = useSession((s) => s.tenantId);
  return useCachedQuery<MyReferralsPayload>({
    key: MY_REFERRALS_KEY,
    path: `/api/v1/me/referrals?limit=${LIST_FETCH_LIMIT}`,
    ttlMs: LIST_TTL_MS,
    isPhi: true,
    enabled: userId !== null,
    ...(userId !== null ? { userId } : {}),
    ...(tenantId !== null ? { tenantId } : {}),
  });
}

/** Medical certificates the signed-in doctor issued — GET
 *  /me/medical-certificates, pinned to the JWT userId server-side. */
export function useMyCertificates(): CachedQueryResult<MyCertificatesPayload> {
  const userId = useSession((s) => s.userId);
  const tenantId = useSession((s) => s.tenantId);
  return useCachedQuery<MyCertificatesPayload>({
    key: MY_CERTIFICATES_KEY,
    path: `/api/v1/me/medical-certificates?limit=${LIST_FETCH_LIMIT}`,
    ttlMs: LIST_TTL_MS,
    isPhi: true,
    enabled: userId !== null,
    ...(userId !== null ? { userId } : {}),
    ...(tenantId !== null ? { tenantId } : {}),
  });
}
