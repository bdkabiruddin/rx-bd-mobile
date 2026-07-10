// Debounced type-ahead searches for the new-order form:
//   - POST /api/v1/doctors/me/patients/search  (patientId substring within
//     the doctor's OWN panel — the backend never name-searches)
//   - GET  /api/v1/lab-test-catalog?q=&limit=  (non-PHI reference data)
//
// Deliberately NOT useCachedQuery: results must track the keystroke, and
// the patient search is a no-store POST — caching stale PHI hits under
// changing queries would be wrong. Mirrors the state discipline of the
// shipped doctor-patients search hook (react-hooks/set-state-in-effect):
// effects only set state asynchronously (timer / response continuation);
// the phase is DERIVED from the raw query + the last applied result.

import * as React from 'react';

import { api } from '@/api/client';
import { ok, type ApiError, type Result } from '@/api/errors';

import { clampQuery } from './logic';
import type {
  CatalogEntry,
  CatalogPayload,
  PatientSearchPayload,
  SearchPatientRow,
} from './types';

const DEBOUNCE_MS = 350;

export type SearchPhase = 'idle' | 'searching' | 'ready' | 'error';

export interface SearchState<T> {
  phase: SearchPhase;
  /** Rows of the most recent successful search (server order). */
  results: T[];
  error: ApiError | null;
  /** Re-run the current query after a failure. */
  retry: () => void;
}

interface AppliedResult<T> {
  /** The clamped query this result answers. */
  query: string;
  rows: T[];
  error: ApiError | null;
}

/** Shared debounced-search core. `fetcher` MUST be module-level stable. */
function useDebouncedSearch<T>(
  rawQuery: string,
  fetcher: (q: string) => Promise<Result<T[]>>,
): SearchState<T> {
  const clamped = clampQuery(rawQuery);

  const [debounced, setDebounced] = React.useState('');
  const [result, setResult] = React.useState<AppliedResult<T> | null>(null);
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
      const res = await fetcher(debounced);
      if (cancelled) return;
      if (!res.ok) {
        setResult({ query: debounced, rows: [], error: res.error });
        return;
      }
      setResult({ query: debounced, rows: res.value, error: null });
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced, version, fetcher]);

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

// ─── Concrete fetchers (module-level: stable identities) ─────────────────────

async function fetchPanelPatients(q: string): Promise<Result<SearchPatientRow[]>> {
  const res = await api.post<PatientSearchPayload>(
    '/api/v1/doctors/me/patients/search',
    { query: q },
  );
  if (!res.ok) return res;
  return ok(
    (res.value?.patients ?? []).filter(
      (p): p is SearchPatientRow =>
        typeof p?.patientId === 'string' && p.patientId.length > 0,
    ),
  );
}

async function fetchCatalogEntries(q: string): Promise<Result<CatalogEntry[]>> {
  const res = await api.get<CatalogPayload>(
    `/api/v1/lab-test-catalog?q=${encodeURIComponent(q)}&limit=20`,
  );
  if (!res.ok) return res;
  return ok(
    (res.value?.entries ?? []).filter(
      (e): e is CatalogEntry => typeof e?.code === 'string' && e.code.length > 0,
    ),
  );
}

/** Consent-gated panel search (doctor's own panel, id substring only). */
export function usePanelPatientSearch(rawQuery: string): SearchState<SearchPatientRow> {
  return useDebouncedSearch(rawQuery, fetchPanelPatients);
}

/** Lab-test catalog type-ahead. */
export function useCatalogSearch(rawQuery: string): SearchState<CatalogEntry> {
  return useDebouncedSearch(rawQuery, fetchCatalogEntries);
}
