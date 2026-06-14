// Two-key reverify for sensitive intents. Flow: biometric step-up → POST
// /api/v1/auth/reverify { intent } → reverify token → attach to the mutation.

import { api } from '@/api/client';
import { type ApiError, type Result, fail, ok } from '@/api/errors';
import type { ReverifyIntent } from '@/config/domain';

import { authenticate } from './biometric';

interface ReverifyResponse {
  reverifyToken: string;
}

/**
 * Obtain a reverify token for `intent`. Requires a fresh biometric step-up
 * first; the token is short-lived and single-use (backend-enforced) and must
 * be attached to the immediately-following sensitive request.
 */
export async function obtainReverifyToken(
  intent: ReverifyIntent,
  promptMessage: string,
): Promise<Result<string>> {
  const passed = await authenticate(promptMessage);
  if (!passed) {
    const e: ApiError = {
      code: 'UNAUTHORIZED',
      message: 'Biometric verification was cancelled or failed.',
    };
    return fail(e);
  }

  const res = await api.post<ReverifyResponse>('/api/v1/auth/reverify', { intent });
  if (!res.ok) return res;
  if (!res.value?.reverifyToken) {
    return fail({ code: 'SERVER_ERROR', message: 'No reverify token returned.' });
  }
  return ok(res.value.reverifyToken);
}
