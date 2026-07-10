// Patient profile — cached read hooks. One stable key per surface; write
// screens invalidate the matching key after a successful mutation so the
// reads refresh. Everything on this feature is patient-identifiable →
// isPhi: true (encrypted at rest in the offline cache).

import { useCachedQuery, type CachedQueryResult } from '@/api/useCachedQuery';
import { useSession } from '@/auth/sessionStore';

import type {
  AccessLogPayload,
  DsarRequestsPayload,
  EmergencyContactsPayload,
  MyAllergiesPayload,
  MyPatientProfilePayload,
} from './types';

export const PROFILE_KEY = 'patient:profile:me';
export const CONTACTS_KEY = 'patient:profile:contacts';
export const ALLERGIES_KEY = 'patient:profile:allergies';
export const DSAR_KEY = 'patient:profile:dsar';
export const ACCESS_LOG_KEY = 'patient:profile:access-log';

const TEN_MIN = 10 * 60 * 1000;
const FIVE_MIN = 5 * 60 * 1000;

/** Access-log page size — one page is plenty for the in-app viewer; the
 *  header shows an honest "latest N of M" count beyond that. */
export const ACCESS_LOG_PAGE_SIZE = 50;

export function useMyPatientProfile(): CachedQueryResult<MyPatientProfilePayload> {
  const userId = useSession((s) => s.userId);
  return useCachedQuery<MyPatientProfilePayload>({
    key: PROFILE_KEY,
    path: '/api/v1/me/patient-profile',
    ttlMs: TEN_MIN,
    isPhi: true,
    enabled: userId !== null,
    ...(userId !== null ? { userId } : {}),
  });
}

export function useMyEmergencyContacts(): CachedQueryResult<EmergencyContactsPayload> {
  const userId = useSession((s) => s.userId);
  return useCachedQuery<EmergencyContactsPayload>({
    key: CONTACTS_KEY,
    path: '/api/v1/me/emergency-contacts',
    ttlMs: TEN_MIN,
    isPhi: true,
    enabled: userId !== null,
    ...(userId !== null ? { userId } : {}),
  });
}

/** Clinical-safety data — shorter TTL so the list stays fresh. */
export function useMyAllergies(): CachedQueryResult<MyAllergiesPayload> {
  const userId = useSession((s) => s.userId);
  return useCachedQuery<MyAllergiesPayload>({
    key: ALLERGIES_KEY,
    path: '/api/v1/me/allergies',
    ttlMs: FIVE_MIN,
    isPhi: true,
    enabled: userId !== null,
    ...(userId !== null ? { userId } : {}),
  });
}

export function useMyDsarRequests(): CachedQueryResult<DsarRequestsPayload> {
  const userId = useSession((s) => s.userId);
  return useCachedQuery<DsarRequestsPayload>({
    key: DSAR_KEY,
    path: '/api/v1/gdpr/requests',
    ttlMs: FIVE_MIN,
    isPhi: true,
    enabled: userId !== null,
    ...(userId !== null ? { userId } : {}),
  });
}

/** Lazy — enable only when the user expands the access-log section (each
 *  fetch is itself audited server-side; don't spam the trail on mount). */
export function useMyAccessLog(enabled: boolean): CachedQueryResult<AccessLogPayload> {
  const userId = useSession((s) => s.userId);
  return useCachedQuery<AccessLogPayload>({
    key: ACCESS_LOG_KEY,
    path: `/api/v1/me/access-log?pageSize=${ACCESS_LOG_PAGE_SIZE}`,
    ttlMs: FIVE_MIN,
    isPhi: true,
    enabled: enabled && userId !== null,
    ...(userId !== null ? { userId } : {}),
  });
}
