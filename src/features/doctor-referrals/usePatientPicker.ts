// Debounced, consent-gated patient search for the referral / certificate
// forms.
//
//   POST /api/v1/doctors/me/patients/search   body: { query }
//
// Same ENDPOINT the doctor-patients feature uses; the hook is deliberately
// re-implemented here (never a cross-feature deep import) with only the
// fields this feature renders. Deliberately NOT useCachedQuery: the endpoint
// is a POST, responses are no-store, and results must track the keystroke —
// caching stale PHI search hits under changing queries would be wrong.
//
// State discipline (react-hooks/set-state-in-effect): effects never set
// state synchronously — the debounce timer and the response continuation do
// (async), and the phase is DERIVED from the raw query + the last applied
// result, so clearing the box needs no state reset at all.

import * as React from 'react';

import { api } from '@/api/client';
import type { ApiError } from '@/api/errors';

import { clampSearchQuery } from './logic';
import type { PatientSearchPayload, PickerPatient } from './types';

const DEBOUNCE_MS = 350;

export type PatientPickerPhase = 'idle' | 'searching' | 'ready' | 'error';

export interface PatientPickerState {
  phase: PatientPickerPhase;
  /** Rows of the most recent successful search (server order). */
  results: PickerPatient[];
  error: ApiError | null;
  /** Re-run the current query after a failure. */
  retry: () => void;
}

interface AppliedResult {
  /** The clamped query this result answers. */
  query: string;
  rows: PickerPatient[];
  error: ApiError | null;
}

export function usePatientPicker(rawQuery: string): PatientPickerState {
  const clamped = clampSearchQuery(rawQuery);

  const [debounced, setDebounced] = React.useState('');
  const [result, setResult] = React.useState<AppliedResult | null>(null);
  const [version, setVersion] = React.useState(0);

  // Debounce the keystrokes (setState only inside the async timer callback).
  React.useEffect(() => {
    const handle = setTimeout(() => setDebounced(clamped), DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [clamped]);

  // Fetch when the debounced query settles; the cleanup flag drops any
  // response that a newer query (or an unmount) has superseded.
  React.useEffect(() => {
    if (debounced.length === 0) return undefined;
    let cancelled = false;
    void (async () => {
      const res = await api.post<PatientSearchPayload>(
        '/api/v1/doctors/me/patients/search',
        { query: debounced },
      );
      if (cancelled) return;
      if (!res.ok) {
        setResult({ query: debounced, rows: [], error: res.error });
        return;
      }
      setResult({
        query: debounced,
        rows: (res.value?.patients ?? []).filter((p) => Boolean(p?.patientId)),
        error: null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced, version]);

  const retry = React.useCallback(() => {
    setResult(null);
    setVersion((v) => v + 1);
  }, []);

  // Derived phase — no effect-driven resets.
  if (clamped.length === 0) {
    return { phase: 'idle', results: [], error: null, retry };
  }
  const current = result !== null && result.query === clamped ? result : null;
  if (current === null) {
    return { phase: 'searching', results: [], error: null, retry };
  }
  if (current.error !== null) {
    return { phase: 'error', results: [], error: current.error, retry };
  }
  return { phase: 'ready', results: current.rows, error: null, retry };
}
