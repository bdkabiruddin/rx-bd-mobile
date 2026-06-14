// PHI codec — pluggable symmetric encryption for cached PHI values.
//
// FAIL-CLOSED BY DESIGN: until a real cipher is configured at boot via
// `setCodec()`, encrypt()/decrypt() reject. This makes it IMPOSSIBLE to
// accidentally persist plaintext PHI to the on-device cache.
//
// The production codec is AES-256-GCM (see `aesCodec.ts`) with the key from
// `encryptionKey.ts` (held in the device secure enclave). Operations are
// async because Web Crypto's SubtleCrypto is async; cache/outbox writes are
// already async so this is transparent to callers.

export interface Codec {
  encrypt(plaintext: string): Promise<string>;
  decrypt(ciphertext: string): Promise<string>;
}

let codec: Codec | null = null;

export function setCodec(impl: Codec): void {
  codec = impl;
}

export function isCodecReady(): boolean {
  return codec !== null;
}

export function clearCodec(): void {
  codec = null;
}

export async function encrypt(plaintext: string): Promise<string> {
  if (!codec) {
    throw new Error('PHI codec not configured — refusing to store plaintext PHI.');
  }
  return codec.encrypt(plaintext);
}

export async function decrypt(ciphertext: string): Promise<string> {
  if (!codec) {
    throw new Error('PHI codec not configured — cannot read encrypted cache.');
  }
  return codec.decrypt(ciphertext);
}
