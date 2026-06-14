// Reverified action — the client half of the backend's two-key model for
// sensitive intents (prescription sign, controlled-substance dispense,
// death-cert issue, admin actions, …).
//
// Flow: require connectivity → biometric step-up → obtain a short-lived,
// single-use reverify token → send the mutation with the token attached.
//
// Reverify tokens are short-lived and single-use, so a reverified action is
// NEVER queued to the offline outbox — it requires an online round-trip. When
// offline we refuse with a clear OFFLINE result so the UI can ask the user to
// reconnect rather than silently dropping a safety-critical action.

import { request } from '@/api/client';
import { type Result, fail } from '@/api/errors';
import { newIdempotencyKey } from '@/api/idempotency';
import type { ReverifyIntent } from '@/config/domain';
import { isOnline } from '@/offline/connectivity';

import { obtainReverifyToken } from './reverify';

export interface ReverifiedActionOptions {
  intent: ReverifyIntent;
  /** Biometric prompt copy (already localized by the caller). */
  promptMessage: string;
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
}

export async function performReverifiedAction<T>(
  opts: ReverifiedActionOptions,
): Promise<Result<T>> {
  if (!isOnline()) {
    return fail({
      code: 'OFFLINE',
      message: 'This action needs a connection — reconnect and try again.',
    });
  }

  const tokenRes = await obtainReverifyToken(opts.intent, opts.promptMessage);
  if (!tokenRes.ok) return tokenRes;

  return request<T>(opts.path, {
    method: opts.method,
    body: opts.body,
    idempotencyKey: newIdempotencyKey(),
    reverifyToken: tokenRes.value,
  });
}
