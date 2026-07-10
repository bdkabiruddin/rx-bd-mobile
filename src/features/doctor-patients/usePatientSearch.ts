// Debounced, consent-gated patient search.
//
//   POST /api/v1/doctors/me/patients/search   body: { query }
//
// Deliberately NOT useCachedQuery: the endpoint is a POST (server treats it
// as an idempotent query but keys the audit trail per call), responses are
// no-store, and results must track the keystroke — caching stale PHI search
// hits under changing queries would be wrong.
//
// State discipline (react-hooks/set-state-in-effect): effects never set
// state synchronously — the debounce timer and the response continuation do
// (async), and everything else (idle/searching/ready/error) is DERIVED from
// the raw query + the last applied result, so clearing the box needs no
// state reset at all.

import * as React from 'react';

import { api } from '@/api/client';
import type { ApiError } from '@/api/errors';

import { clampSearchQuery } from './logic';
import type { PanelPatient, SearchPayload } from './types';

const DEBOUNCE_MS = 350;

export type PatientSearchPhase = 'idle' | 'searching' | 'ready' | 'error';

export interface PatientSearchState {
  phase: PatientSearchPhase;
  /** Rows of the most recent successful search (server order). */
  results: PanelPatient[];
  error: ApiError | null;
  /** Re-run the current query after a failure. */
  retry: () => void;
}

interface AppliedResult {
  /** The clamped query this result answers. */
  query: string;
  rows: PanelPatient[];
  error: ApiError | null;
}

export function usePatientSearch(rawQuery: string): PatientSearchState {
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
      const res = await api.post<SearchPayload>(
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
    // Drop the failed result so the UI shows progress immediately (event
    // handler — setState here is fine), then re-fire the fetch effect.
    setResult(null);
    setVersion((v) => v + 1);
  }, []);

  // Derived phase — no effect-driven resets.
  if (clamped.length === 0) {
    return { phase: 'idle', results: [], error: null, retry };
  }
  const current = result !== null && result.query === clamped ? result : null;
  if (current === null) {
    // Debounce pending or response not yet applied for THIS query.
    return { phase: 'searching', results: [], error: null, retry };
  }
  if (current.error !== null) {
    return { phase: 'error', results: [], error: current.error, retry };
  }
  return { phase: 'ready', results: current.rows, error: null, retry };
}
