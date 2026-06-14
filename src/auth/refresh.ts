// Single-flight token refresh. Uses a RAW fetch (not the api client) to
// avoid the 401→refresh recursion. The backend rotates both tokens on every
// refresh; any failure here is a hard logout.

import { apiUrl } from '@/config/env';

import { secureStore } from './secureStore';
import { useSession } from './sessionStore';

interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  // optional rotated claims; we keep the existing role/branch unless present
}

let inFlight: Promise<boolean> | null = null;

/** Refresh tokens. Concurrent callers share one in-flight request. Returns
 *  true if a fresh access token is now available. */
export function refreshTokens(): Promise<boolean> {
  if (inFlight) return inFlight;
  inFlight = doRefresh().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function doRefresh(): Promise<boolean> {
  const refreshToken = await secureStore.getRefresh();
  if (!refreshToken) return false;

  let res: Response;
  try {
    res = await fetch(apiUrl('/api/v1/auth/refresh'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      // API/CLI clients send the refresh token in the body (backend supports this).
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    return false; // network blip — caller decides; do NOT wipe on transient
  }

  if (!res.ok) return false;

  const json = (await res.json().catch(() => null)) as
    | ({ data?: RefreshResponse } & Partial<RefreshResponse>)
    | null;
  const body = (json?.data ?? json) as RefreshResponse | null;
  if (!body?.accessToken || !body?.refreshToken) return false;

  await secureStore.setTokens(body.accessToken, body.refreshToken);
  useSession.getState().setAccessToken(body.accessToken);
  return true;
}
