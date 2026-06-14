// Idempotency keys for writes. The backend enforces idempotency on write
// routes; every mutation the app sends carries a stable client-generated
// key so a retried/queued write applies exactly once.

import * as Crypto from 'expo-crypto';

/** A fresh idempotency key (UUID v4). Generate ONCE per logical command and
 *  reuse it across retries — that is what makes replay safe. */
export function newIdempotencyKey(): string {
  // expo-crypto provides a cryptographically strong UUID.
  return Crypto.randomUUID();
}

export const IDEMPOTENCY_HEADER = 'Idempotency-Key';
