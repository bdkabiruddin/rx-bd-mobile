// Shared session establishment — persist tokens + seed routing context from
// the access-token claims. Used by every login path (password, MFA, phone-OTP,
// OAuth). Claims are for routing only; the server re-authorizes every request.

import { decodeAccessClaims } from './jwt';
import { secureStore } from './secureStore';
import { useSession } from './sessionStore';

export async function establishSessionFromTokens(
  accessToken: string,
  refreshToken: string,
  mfaSatisfied = true,
): Promise<void> {
  await secureStore.setTokens(accessToken, refreshToken);
  const claims = decodeAccessClaims(accessToken);
  useSession.getState().setActive(accessToken, {
    role: claims?.role ?? '',
    userId: claims?.sub ?? null,
    tenantId: claims?.tenantId ?? null,
    activeBranchId: claims?.branchId ?? null,
    activeDepartmentId: claims?.departmentId ?? null,
    mfaSatisfied,
  });
}
