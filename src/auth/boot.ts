// Auth orchestration — wires the API auth bridge, login/MFA, session
// hydration, idle-lock, and hard logout (with full local wipe).

import { api, configureApiAuth, request } from '@/api/client';
import { type Result, ok } from '@/api/errors';
import { wipeAllLocalData } from '@/offline/wipe';

import { decodeAccessClaims } from './jwt';
import { refreshTokens } from './refresh';
import { secureStore } from './secureStore';
import { useSession } from './sessionStore';

/** Idle window before the app re-locks behind biometrics. */
export const IDLE_LOCK_MS = 5 * 60 * 1000;

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn?: number;
  refreshTokenExpiresIn?: number;
  mfaRequired?: boolean;
}

/** Call once at app boot — installs the auth bridge into the HTTP client. */
export function configureAuthBridge(): void {
  configureApiAuth({
    getAccessToken: () => useSession.getState().accessToken,
    refresh: refreshTokens,
    onAuthFailure: () => {
      void hardLogout();
    },
  });
}

/** Persist tokens + seed session context from the access-token claims.
 *  (Claims are for routing; the server re-authorizes every request.) */
async function establishSession(
  accessToken: string,
  refreshToken: string,
  mfaSatisfied: boolean,
): Promise<void> {
  await secureStore.setTokens(accessToken, refreshToken);
  const claims = decodeAccessClaims(accessToken);
  useSession.getState().setActive(accessToken, {
    role: claims?.role ?? '',
    activeBranchId: claims?.branchId ?? null,
    activeDepartmentId: claims?.departmentId ?? null,
    mfaSatisfied,
  });
}

/** Password login. Returns `{ mfaRequired }`; if true, call `verifyMfa`. */
export async function login(
  identifier: string,
  password: string,
): Promise<Result<{ mfaRequired: boolean }>> {
  const res = await api.post<LoginResponse>('/api/v1/auth/login', {
    identifier,
    password,
  });
  if (!res.ok) return res;
  const data = res.value;

  if (data.mfaRequired) {
    // Hold the interim access token so the MFA verify call is authenticated.
    // NOTE: confirm the exact interim-token contract against the backend
    // during integration (doc 07 if a change is needed).
    useSession.getState().setAccessToken(data.accessToken);
    return ok({ mfaRequired: true });
  }

  await establishSession(data.accessToken, data.refreshToken, true);
  return ok({ mfaRequired: false });
}

/** Complete MFA after a login that returned mfaRequired. */
export async function verifyMfa(code: string): Promise<Result<void>> {
  const res = await api.post<LoginResponse>('/api/v1/auth/mfa/verify', { code });
  if (!res.ok) return res;
  await establishSession(res.value.accessToken, res.value.refreshToken, true);
  return ok(undefined);
}

/** Restore a session from the secure store on cold start. Moves to `locked`
 *  (biometric required) when tokens exist; `anon` otherwise. */
export async function hydrateSession(): Promise<void> {
  const access = await secureStore.getAccess();
  if (!access) {
    useSession.getState().clear();
    return;
  }
  const claims = decodeAccessClaims(access);
  useSession.getState().setActive(access, {
    role: claims?.role ?? '',
    activeBranchId: claims?.branchId ?? null,
    activeDepartmentId: claims?.departmentId ?? null,
    mfaSatisfied: true,
  });
  // Require biometric unlock before any PHI renders.
  useSession.getState().lock();
}

/** Re-lock if the app has been idle past the threshold (call on resume). */
export function maybeLockOnResume(now: number = Date.now()): void {
  const s = useSession.getState();
  if (s.status === 'active' && now - s.lastActivityAt > IDLE_LOCK_MS) {
    s.lock();
  }
}

/** Hard logout: revoke server session (best-effort), clear tokens, wipe data. */
export async function hardLogout(): Promise<void> {
  // Best-effort server-side revoke; ignore result (we wipe regardless).
  await request('/api/v1/auth/logout', { method: 'POST' }).catch(() => undefined);
  useSession.getState().clear();
  await secureStore.clear();
  await wipeAllLocalData();
}
