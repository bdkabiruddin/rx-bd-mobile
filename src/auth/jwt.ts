// Minimal JWT claims decode — FOR CLIENT-SIDE ROUTING ONLY.
//
// We read role / branch from the access token to choose the persona stack
// and seed session context. This is NOT a security check: the token is not
// verified here, and the server remains the sole authority on every request.

export interface AccessClaims {
  sub?: string;
  tenantId?: string;
  role?: string;
  branchId?: string | null;
  departmentId?: string | null;
  exp?: number;
}

export function decodeAccessClaims(token: string): AccessClaims | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    // JWT uses base64url WITHOUT padding; restore it for atob.
    let b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4;
    if (pad) b64 += '='.repeat(4 - pad);
    // atob is available in Hermes (RN 0.74+/Expo SDK 53) and in Node ≥16.
    const json = atob(b64);
    return JSON.parse(json) as AccessClaims;
  } catch {
    return null;
  }
}

/** Seconds until the access token expires (negative if already expired). */
export function secondsUntilExpiry(token: string, now: number = Date.now()): number | null {
  const claims = decodeAccessClaims(token);
  if (!claims?.exp) return null;
  return claims.exp - Math.floor(now / 1000);
}
