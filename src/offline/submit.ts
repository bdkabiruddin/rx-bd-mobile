// submitWrite — the write path. ONLINE-ONLY by design.
//
// Add / edit / delete require a live connection: if offline, the action is
// refused with a clear OFFLINE result so the UI can ask the user to reconnect
// — it is NEVER queued. This eliminates the silent-loss risks of a deferred
// write queue (a queued mutation rejected on later sync, or wiped on session
// revoke). Reads still work offline from the encrypted cache; only mutations
// require connectivity.
//
// The Idempotency-Key is still attached so that a mid-request network drop
// followed by a user retry cannot double-apply at the server.

import { request } from '@/api/client';
import { type Result, fail } from '@/api/errors';
import { newIdempotencyKey } from '@/api/idempotency';

import { isOnline } from './connectivity';

export interface WriteCommand {
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
  /** Reverify token for two-key sensitive intents. */
  reverifyToken?: string;
  /** Stable idempotency key. Auto-generated when omitted. Reuse the SAME key
   *  across user-driven retries of one logical action so retries are safe. */
  idempotencyKey?: string;
}

export async function submitWrite<T>(cmd: WriteCommand): Promise<Result<T>> {
  if (!isOnline()) {
    return fail({
      code: 'OFFLINE',
      message: 'You are offline. Reconnect to make changes.',
    });
  }
  return request<T>(cmd.path, {
    method: cmd.method,
    body: cmd.body,
    idempotencyKey: cmd.idempotencyKey ?? newIdempotencyKey(),
    ...(cmd.reverifyToken ? { reverifyToken: cmd.reverifyToken } : {}),
  });
}
