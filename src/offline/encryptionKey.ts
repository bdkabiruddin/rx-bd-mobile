// Cache encryption key — a 256-bit random key generated once and held in the
// device secure enclave. Feeds the PHI codec (and/or SQLCipher DB key).

import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const KEY_NAME = 'rxbd.cacheKey';
const OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

/** Get the cache key, creating + persisting one on first run. Hex-encoded
 *  256-bit key. */
export async function getOrCreateCacheKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(KEY_NAME, OPTS);
  if (existing) return existing;
  const bytes = await Crypto.getRandomBytesAsync(32);
  const key = toHex(bytes);
  await SecureStore.setItemAsync(KEY_NAME, key, OPTS);
  return key;
}

/** Destroy the key — called on remote-wipe / hard logout so any residual
 *  ciphertext becomes undecryptable. */
export async function destroyCacheKey(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_NAME, OPTS);
}
