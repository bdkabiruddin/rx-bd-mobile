// useWrite — the safe way for screens to perform a mutation.
//
// Holds a STABLE idempotency key for one logical action: if a write fails
// (e.g. the response was lost to a network drop) and the user taps again, the
// SAME key is reused, so the server dedupes instead of creating a duplicate
// (double appointment / double payment / double prescription). The key is
// reset only after a SUCCESS, so the next distinct action gets a fresh key.
//
// Always prefer useWrite over calling submitWrite directly from a screen.

import * as React from 'react';

import { newIdempotencyKey } from '@/api/idempotency';
import type { Result } from '@/api/errors';

import { submitWrite, type WriteCommand } from './submit';

export function useWrite<T = unknown>(): {
  submit: (cmd: Omit<WriteCommand, 'idempotencyKey'>) => Promise<Result<T>>;
  busy: boolean;
} {
  const keyRef = React.useRef<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const submit = React.useCallback(
    async (cmd: Omit<WriteCommand, 'idempotencyKey'>): Promise<Result<T>> => {
      // Mint once on the first attempt; reuse on every retry of THIS action.
      if (!keyRef.current) keyRef.current = newIdempotencyKey();
      setBusy(true);
      const res = await submitWrite<T>({ ...cmd, idempotencyKey: keyRef.current });
      setBusy(false);
      // After success, the next distinct action should get a fresh key.
      if (res.ok) keyRef.current = null;
      return res;
    },
    [],
  );

  return { submit, busy };
}
