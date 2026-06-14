// PHI codec — pluggable symmetric encryption for cached PHI values.
//
// FAIL-CLOSED BY DESIGN: until a real cipher is configured at boot via
// `setCodec()`, encrypt()/decrypt() throw. This makes it IMPOSSIBLE to
// accidentally persist plaintext PHI to the on-device cache.
//
// The production codec is AES-256-GCM with the key from
// `encryptionKey.ts` (held in the device secure enclave). The concrete
// implementation is provided by a native crypto module (e.g. SQLCipher at
// the DB layer and/or react-native-quick-crypto for value-level AES) and
// wired in app/_layout boot. See docs/02-security-compliance.md §2.

export interface Codec {
  encrypt(plaintext: string): string;
  decrypt(ciphertext: string): string;
}

let codec: Codec | null = null;

export function setCodec(impl: Codec): void {
  codec = impl;
}

export function isCodecReady(): boolean {
  return codec !== null;
}

export function encrypt(plaintext: string): string {
  if (!codec) {
    throw new Error('PHI codec not configured — refusing to store plaintext PHI.');
  }
  return codec.encrypt(plaintext);
}

export function decrypt(ciphertext: string): string {
  if (!codec) {
    throw new Error('PHI codec not configured — cannot read encrypted cache.');
  }
  return codec.decrypt(ciphertext);
}
