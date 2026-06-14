// Durable write outbox. Mutations that can't complete now are enqueued with
// their stable Idempotency-Key and replayed on reconnect. Idempotency makes
// replay exactly-once at the server; per-resource ordering is preserved.

import { decrypt, encrypt } from './codec';
import { getDb } from './db';

export type OutboxMethod = 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface OutboxCommand {
  /** Idempotency key — also the primary key. Generate ONCE per command. */
  id: string;
  method: OutboxMethod;
  path: string;
  body?: unknown;
  /** Reverify tokens are short-lived; queued sensitive writes generally must
   *  re-acquire on send. Persisted only if present. */
  reverifyToken?: string;
  /** Groups commands that must apply in order (e.g. same prescription id). */
  resourceKey?: string;
}

export interface OutboxRow extends OutboxCommand {
  createdAt: number;
  attempts: number;
  nextAttemptAt: number;
  lastError: string | null;
}

export async function enqueue(cmd: OutboxCommand): Promise<void> {
  const db = await getDb();
  const bodyEnc = cmd.body === undefined ? null : await encrypt(JSON.stringify(cmd.body));
  await db.runAsync(
    `INSERT OR IGNORE INTO outbox
       (id, method, path, body_enc, reverify_token, created_at, attempts, next_attempt_at, resource_key)
     VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?)`,
    cmd.id,
    cmd.method,
    cmd.path,
    bodyEnc,
    cmd.reverifyToken ?? null,
    Date.now(),
    cmd.resourceKey ?? null,
  );
}

/** Pending commands eligible to send now (nextAttemptAt due), in FIFO order. */
export async function dueCommands(limit = 25): Promise<OutboxRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string;
    method: OutboxMethod;
    path: string;
    body_enc: string | null;
    reverify_token: string | null;
    created_at: number;
    attempts: number;
    next_attempt_at: number;
    last_error: string | null;
    resource_key: string | null;
  }>(
    `SELECT * FROM outbox WHERE next_attempt_at <= ? ORDER BY created_at ASC LIMIT ?`,
    Date.now(),
    limit,
  );
  return Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      method: r.method,
      path: r.path,
      body: r.body_enc ? JSON.parse(await decrypt(r.body_enc)) : undefined,
      ...(r.reverify_token ? { reverifyToken: r.reverify_token } : {}),
      ...(r.resource_key ? { resourceKey: r.resource_key } : {}),
      createdAt: r.created_at,
      attempts: r.attempts,
      nextAttemptAt: r.next_attempt_at,
      lastError: r.last_error,
    })),
  );
}

export async function remove(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM outbox WHERE id = ?`, id);
}

/** Record a transient failure with exponential backoff. */
export async function recordFailure(id: string, error: string, attempts: number): Promise<void> {
  const db = await getDb();
  const backoffMs = Math.min(60_000, 2 ** attempts * 1000); // cap 60s
  await db.runAsync(
    `UPDATE outbox SET attempts = ?, next_attempt_at = ?, last_error = ? WHERE id = ?`,
    attempts + 1,
    Date.now() + backoffMs,
    error,
    id,
  );
}

export async function pendingCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM outbox`);
  return row?.n ?? 0;
}
