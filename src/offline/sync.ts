// Sync engine — replays the outbox when connectivity returns.
//
// Safety rules (docs/03 §B.4):
//   - Idempotency-Key makes replay exactly-once at the server.
//   - Non-retryable failures (validation/conflict) are surfaced to the user
//     and removed from the outbox — never silently retried forever.
//   - Clinical conflicts are NOT auto-merged; the conflict is reported.

import { request } from '@/api/client';
import { isRetryable, type ApiError } from '@/api/errors';

import { onConnectivityChange } from './connectivity';
import {
  dueCommands,
  recordFailure,
  remove,
  type OutboxRow,
} from './outbox';

export interface SyncConflict {
  command: OutboxRow;
  error: ApiError;
}

type ConflictHandler = (conflict: SyncConflict) => void;
let onConflict: ConflictHandler = () => {};
export function setConflictHandler(fn: ConflictHandler): void {
  onConflict = fn;
}

let running = false;

/** Drain the outbox once. Safe to call repeatedly; self-guards re-entry. */
export async function drainOutbox(): Promise<void> {
  if (running) return;
  running = true;
  try {
    let batch = await dueCommands();
    while (batch.length > 0) {
      for (const cmd of batch) {
        const res = await request(cmd.path, {
          method: cmd.method,
          body: cmd.body,
          idempotencyKey: cmd.id, // STABLE key → exactly-once
          ...(cmd.reverifyToken ? { reverifyToken: cmd.reverifyToken } : {}),
        });

        if (res.ok) {
          await remove(cmd.id);
          continue;
        }

        if (isRetryable(res.error)) {
          await recordFailure(cmd.id, res.error.message, cmd.attempts);
          // leave in queue; backoff applied
        } else {
          // Permanent failure (validation / conflict / forbidden):
          // surface to the user and drop. Conflicts are never auto-merged.
          onConflict({ command: cmd, error: res.error });
          await remove(cmd.id);
        }
      }
      batch = await dueCommands();
      // Avoid a tight loop if everything is backed off.
      if (batch.every((c) => c.nextAttemptAt > Date.now())) break;
    }
  } finally {
    running = false;
  }
}

/** Wire sync to connectivity. Returns an unsubscribe fn. */
export function startSync(): () => void {
  // Drain on reconnect.
  const off = onConnectivityChange((online) => {
    if (online) void drainOutbox();
  });
  // Opportunistic first drain.
  void drainOutbox();
  return off;
}
