// Offline/security boot — fetches the secure-store cache key and installs
// the AES-256-GCM codec so the cache leaves fail-closed mode. Call once at
// app start (before any cached read/write).

import { createAesCodecFromKey } from './aesCodec';
import { setCodec } from './codec';
import { getOrCreateCacheKey } from './encryptionKey';

let initialized = false;

/** Configure the PHI codec. Returns true on success; on failure the cache
 *  stays fail-closed (encrypt/decrypt reject) and the app should fall back to
 *  online-only for PHI surfaces rather than risk a plaintext write. */
export async function initOfflineSecurity(): Promise<boolean> {
  if (initialized) return true;
  try {
    const keyHex = await getOrCreateCacheKey();
    const codec = await createAesCodecFromKey(keyHex);
    setCodec(codec);
    initialized = true;
    return true;
  } catch {
    return false;
  }
}

/** Reset the init guard (used on hard-logout so a re-login re-bootstraps). */
export function resetOfflineSecurity(): void {
  initialized = false;
}
