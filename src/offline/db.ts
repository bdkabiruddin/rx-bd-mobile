// Local database — read cache + write outbox tables.
//
// Storage is expo-sqlite. PRODUCTION HARDENING: open with SQLCipher (drop-in
// via op-sqlite) keyed from `getOrCreateCacheKey()` for whole-DB encryption;
// PHI values are ALSO wrapped by the value-level codec (defense in depth).
// The schema below is identical either way.

import * as SQLite from 'expo-sqlite';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('rxbd.db');
      await migrate(db);
      return db;
    })();
  }
  return dbPromise;
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS cache (
      key         TEXT PRIMARY KEY NOT NULL,
      tenant_id   TEXT,
      user_id     TEXT,
      value_enc   TEXT NOT NULL,   -- codec-encrypted JSON
      is_phi      INTEGER NOT NULL DEFAULT 1,
      fetched_at  INTEGER NOT NULL,
      ttl_ms      INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cache_user ON cache(user_id);

    CREATE TABLE IF NOT EXISTS outbox (
      id              TEXT PRIMARY KEY NOT NULL,   -- idempotency key
      method          TEXT NOT NULL,
      path            TEXT NOT NULL,
      body_enc        TEXT,                        -- codec-encrypted JSON body
      reverify_token  TEXT,
      created_at      INTEGER NOT NULL,
      attempts        INTEGER NOT NULL DEFAULT 0,
      next_attempt_at INTEGER NOT NULL DEFAULT 0,
      last_error      TEXT,
      resource_key    TEXT                         -- preserves per-resource order
    );
    CREATE INDEX IF NOT EXISTS idx_outbox_order ON outbox(created_at);
  `);
}

/** Drop every local row — wipe on logout / session revoke / remote wipe. */
export async function clearAllTables(): Promise<void> {
  const db = await getDb();
  await db.execAsync('DELETE FROM cache; DELETE FROM outbox;');
}
