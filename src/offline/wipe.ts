// Wipe all on-device data — logout, server session-revoke, biometric
// lockout, or remote-wipe signal. Destroying the cache key renders any
// residual ciphertext undecryptable even if rows survive.

import { clearAllTables } from './db';
import { destroyCacheKey } from './encryptionKey';

export async function wipeAllLocalData(): Promise<void> {
  try {
    await clearAllTables();
  } catch {
    // best-effort; key destruction below is the backstop
  }
  await destroyCacheKey();
}
