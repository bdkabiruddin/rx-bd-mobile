// Sign the server-side DRAFT — the two-key, safety-critical write.
//
// WHY NOT performReverifiedAction: that helper attaches the reverify
// token as the `x-reverify-token` HEADER, but the backend sign route
// (POST /api/v1/prescriptions/{id}/sign, signPrescriptionBodySchema)
// REQUIRES the token in the BODY (`reverifyToken`, verified in-handler
// with single-use jti semantics — `reverify: { enforcedInHandler: true }`).
// This helper preserves the exact same two-key flow — connectivity gate →
// biometric step-up → intent-pinned short-lived token → mutation — and
// simply carries the token where the contract demands it. There is no
// path through here that skips the step-up.

import { request } from '@/api/client';
import { fail, type Result } from '@/api/errors';
import { newIdempotencyKey } from '@/api/idempotency';
import { obtainReverifyToken } from '@/auth/reverify';
import { REVERIFY_INTENTS } from '@/config/domain';
import { isOnline } from '@/offline/connectivity';

import type { SignResultLite } from './types';

/** Mirror of signPrescriptionBodySchema (subset the mobile client sends). */
interface SignBody {
  reverifyToken: string;
  validUntilDays?: number;
}

export async function signServerDraft(opts: {
  prescriptionId: string;
  /** Biometric prompt copy — already localized by the caller. */
  promptMessage: string;
  validUntilDays?: number;
}): Promise<Result<SignResultLite>> {
  if (!isOnline()) {
    return fail({
      code: 'OFFLINE',
      message: 'Signing needs a connection — reconnect and try again.',
    });
  }

  const tokenRes = await obtainReverifyToken(
    REVERIFY_INTENTS.PRESCRIPTION_SIGN,
    opts.promptMessage,
  );
  if (!tokenRes.ok) return tokenRes;

  const body: SignBody = {
    reverifyToken: tokenRes.value,
    ...(opts.validUntilDays !== undefined
      ? { validUntilDays: opts.validUntilDays }
      : {}),
  };

  return request<SignResultLite>(
    `/api/v1/prescriptions/${opts.prescriptionId}/sign`,
    {
      method: 'POST',
      body,
      idempotencyKey: newIdempotencyKey(),
    },
  );
}
