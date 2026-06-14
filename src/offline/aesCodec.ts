// AES-256-GCM PHI codec via Web Crypto (SubtleCrypto).
//
// - Key: a 256-bit key (hex) — on device, from the secure enclave
//   (see init.ts → encryptionKey.ts). Passed in here so this module stays
//   free of native imports and is unit-testable under Node's Web Crypto.
// - Per-message random 96-bit IV, packed as [IV(12) || ciphertext+tag],
//   base64-encoded for TEXT storage in SQLite.
// - GCM is authenticated: a tampered ciphertext fails to decrypt (asserted
//   by the round-trip test).
//
// Runtime: Node ≥20 and Expo's runtime both expose `globalThis.crypto.subtle`.
// If SubtleCrypto is missing, the factory rejects and the cache stays
// fail-closed (no plaintext is ever written) — a safe degradation.

import type { Codec } from './codec';

const IV_BYTES = 12;

// Return ArrayBuffer-backed views so they satisfy SubtleCrypto's BufferSource
// (TS widens `new Uint8Array(n)` to ArrayBufferLike otherwise).
function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

/** Build an AES-GCM codec from a hex-encoded 256-bit key. Rejects if
 *  SubtleCrypto is unavailable (cache then remains fail-closed). */
export async function createAesCodecFromKey(keyHex: string): Promise<Codec> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('SubtleCrypto unavailable — cannot build AES codec.');
  }
  const cryptoKey = await subtle.importKey(
    'raw',
    hexToBytes(keyHex),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  );

  return {
    async encrypt(plaintext: string): Promise<string> {
      const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
      // Copy into a fresh ArrayBuffer-backed view for BufferSource typing.
      const data = new Uint8Array(new TextEncoder().encode(plaintext));
      const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, data);
      const ctBytes = new Uint8Array(ct);
      const packed = new Uint8Array(iv.length + ctBytes.length);
      packed.set(iv, 0);
      packed.set(ctBytes, iv.length);
      return bytesToBase64(packed);
    },
    async decrypt(ciphertext: string): Promise<string> {
      const packed = base64ToBytes(ciphertext);
      const iv = packed.slice(0, IV_BYTES);
      const ct = packed.slice(IV_BYTES);
      const pt = await subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, ct);
      return new TextDecoder().decode(pt);
    },
  };
}
