// Encrypted read cache. Every query payload is persisted (codec-encrypted)
// with a TTL and tenant/user scope. Screens render the cached value
// immediately with a freshness badge, then background-refresh.

import { decrypt, encrypt } from './codec';
import { getDb } from './db';

export interface CacheEntry<T> {
  value: T;
  fetchedAt: number;
  ttlMs: number;
  /** True once fetchedAt + ttlMs has elapsed. */
  isStale: boolean;
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 1 day; per-key override below

export async function putCache<T>(
  key: string,
  value: T,
  opts: { tenantId?: string; userId?: string; ttlMs?: number; isPhi?: boolean } = {},
): Promise<void> {
  const db = await getDb();
  const now = Date.now();
  const valueEnc = await encrypt(JSON.stringify(value));
  await db.runAsync(
    `INSERT OR REPLACE INTO cache (key, tenant_id, user_id, value_enc, is_phi, fetched_at, ttl_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    key,
    opts.tenantId ?? null,
    opts.userId ?? null,
    valueEnc,
    opts.isPhi === false ? 0 : 1,
    now,
    opts.ttlMs ?? DEFAULT_TTL_MS,
  );
}

export async function getCache<T>(key: string): Promise<CacheEntry<T> | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{
    value_enc: string;
    fetched_at: number;
    ttl_ms: number;
  }>(`SELECT value_enc, fetched_at, ttl_ms FROM cache WHERE key = ?`, key);
  if (!row) return null;
  let value: T;
  try {
    value = JSON.parse(await decrypt(row.value_enc)) as T;
  } catch {
    return null; // undecryptable (e.g. key destroyed / tampered) → treat as miss
  }
  const isStale = Date.now() > row.fetched_at + row.ttl_ms;
  return { value, fetchedAt: row.fetched_at, ttlMs: row.ttl_ms, isStale };
}

/** Purge expired PHI entries — called on launch + on a timer. */
export async function evictExpired(): Promise<number> {
  const db = await getDb();
  const now = Date.now();
  const result = await db.runAsync(
    `DELETE FROM cache WHERE fetched_at + ttl_ms < ?`,
    now,
  );
  return result.changes ?? 0;
}

export async function deleteCache(key: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM cache WHERE key = ?`, key);
}
