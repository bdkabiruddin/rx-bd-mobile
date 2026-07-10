// useDoctorAvailability — merged read of a doctor's bookable times.
//
// Combines three backend reads (all verified in openapi.yaml):
//   GET /api/v1/doctors/{id}/available-slots?lookaheadDays=14  (required)
//   GET /api/v1/doctors/{id}/chambers                           (best-effort)
//   GET /api/v1/doctors/{id}/booked-times?lookaheadDays=14      (best-effort)
//
// The three payloads merge into honest, tappable chunks via
// expandWindowsToChunks. Slot data is time-sensitive (another patient can
// book at any moment) so this is a live fetch, not a cached query — the
// server-side schedule-conflict gate stays the final authority either way
// (same trade-off the web wizard makes). Chambers/booked-times failures
// degrade gracefully (default grain / no busy filter); a slots failure is
// surfaced as an error with retry.
//
// State is written only from the async completion (never synchronously in
// the effect body — react-hooks/set-state-in-effect); loading/error are
// derived from whether the stored result matches the current request key.

import * as React from 'react';

import { api } from '@/api/client';
import type { ApiError } from '@/api/errors';

import { expandWindowsToChunks, type BookableSlotChunk } from './logic';
import type {
  AvailableSlotsResult,
  BookedTimesResult,
  DoctorChamber,
  DoctorChambersResult,
} from './types';

const LOOKAHEAD_DAYS = 14;

export interface DoctorAvailability {
  /** null until the first load for this doctor completes. */
  chunks: BookableSlotChunk[] | null;
  /** Chambers list (empty when unavailable) — used for facility mapping. */
  chambers: DoctorChamber[];
  loading: boolean;
  error: ApiError | null;
  reload: () => void;
}

interface LoadedState {
  key: string;
  chunks: BookableSlotChunk[];
  chambers: DoctorChamber[];
}

interface ErrorState {
  key: string;
  error: ApiError;
}

export function useDoctorAvailability(doctorUserId: string | null): DoctorAvailability {
  const [loaded, setLoaded] = React.useState<LoadedState | null>(null);
  const [failed, setFailed] = React.useState<ErrorState | null>(null);
  const [nonce, setNonce] = React.useState(0);

  const requestKey = doctorUserId ? `${doctorUserId}:${nonce}` : null;

  React.useEffect(() => {
    if (!doctorUserId || !requestKey) return;
    let active = true;

    void (async () => {
      const encoded = encodeURIComponent(doctorUserId);
      const [slotsRes, chambersRes, bookedRes] = await Promise.all([
        api.get<AvailableSlotsResult>(
          `/api/v1/doctors/${encoded}/available-slots?lookaheadDays=${LOOKAHEAD_DAYS}`,
        ),
        api.get<DoctorChambersResult>(`/api/v1/doctors/${encoded}/chambers`),
        api.get<BookedTimesResult>(
          `/api/v1/doctors/${encoded}/booked-times?lookaheadDays=${LOOKAHEAD_DAYS}`,
        ),
      ]);
      if (!active) return;

      if (!slotsRes.ok) {
        setFailed({ key: requestKey, error: slotsRes.error });
        return;
      }
      // Best-effort companions — a failure degrades, never blocks.
      const chamberList = chambersRes.ok ? (chambersRes.value.chambers ?? []) : [];
      const bookedRanges = bookedRes.ok ? (bookedRes.value.ranges ?? []) : [];

      setFailed(null);
      setLoaded({
        key: requestKey,
        chambers: chamberList,
        chunks: expandWindowsToChunks({
          windows: slotsRes.value.slots ?? [],
          chambers: chamberList,
          bookedRanges,
          nowMs: Date.now(),
        }),
      });
    })();

    return () => {
      active = false;
    };
  }, [doctorUserId, requestKey]);

  const reload = React.useCallback(() => setNonce((n) => n + 1), []);

  const current = requestKey !== null && loaded?.key === requestKey ? loaded : null;
  const error =
    requestKey !== null && failed?.key === requestKey ? failed.error : null;
  const loading = requestKey !== null && current === null && error === null;

  return {
    chunks: current?.chunks ?? null,
    chambers: current?.chambers ?? [],
    loading,
    error,
    reload,
  };
}
