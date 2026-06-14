// submitCommand — the write path. Send now when online; on a transient
// failure or while offline, enqueue to the durable outbox for replay. The
// command's stable Idempotency-Key guarantees exactly-once at the server.

import { request } from '@/api/client';
import { type Result, isRetryable, ok } from '@/api/errors';

import { isOnline } from './connectivity';
import { enqueue, type OutboxCommand } from './outbox';

export interface SubmitResult {
  /** True when the command was queued for later instead of applied now. */
  queued: boolean;
  /** Server payload when applied immediately. */
  value?: unknown;
}

export async function submitCommand(
  cmd: OutboxCommand,
): Promise<Result<SubmitResult>> {
  if (isOnline()) {
    const res = await request(cmd.path, {
      method: cmd.method,
      body: cmd.body,
      idempotencyKey: cmd.id,
      ...(cmd.reverifyToken ? { reverifyToken: cmd.reverifyToken } : {}),
    });
    if (res.ok) return ok({ queued: false, value: res.value });
    if (isRetryable(res.error)) {
      await enqueue(cmd);
      return ok({ queued: true });
    }
    // Permanent failure — surface to caller; do NOT queue.
    return res;
  }

  await enqueue(cmd);
  return ok({ queued: true });
}
