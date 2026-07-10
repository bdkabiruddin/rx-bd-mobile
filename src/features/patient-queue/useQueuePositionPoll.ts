// Live queue-position poller — deliberately NOT useCachedQuery: queue
// positions are live data (spec: poll every 20s while the screen is
// focused, no cache replay of a minutes-old position).
//
//   GET /api/v1/me/queue-position?chamberId=…   (20s, focus-scoped)
//
// The endpoint REQUIRES a chamberId. When the caller supplied one (route
// param) we probe it first; otherwise — and additionally, for display
// names — we discover candidates from the patient's own data:
//
//   GET /api/v1/patients/{id}/appointments  → today's active rows
//        (carries doctorUserId + doctorName + chamberName, but NOT the
//         raw chamberId)
//   GET /api/v1/doctors/{id}/chambers       → chamber ids + names
//
// Probe outcome semantics (mirrors GetMyQueuePositionHandler):
//   200            → active entry at that chamber; lock onto it.
//   404            → definitively NOT in that chamber's queue today.
//   anything else  → transport/server trouble: keep the last known
//                    position on screen, marked stale (honesty over
//                    freshness), and try again next tick.
//
// "Not in queue" is only declared when discovery fully succeeded AND
// every candidate answered a definitive 404 — a partial network failure
// must never masquerade as "you're done".

import { useFocusEffect } from 'expo-router';
import * as React from 'react';

import { api } from '@/api/client';

import {
  deriveChamberCandidates,
  deriveDoctorCandidates,
  probeOrder,
} from './logic';
import type {
  DoctorChamberLite,
  DoctorChambersPayload,
  PatientAppointmentsPayload,
  PositionSnapshot,
  QueuePositionPayload,
} from './types';

export const QUEUE_POLL_INTERVAL_MS = 20_000;

export type QueuePollPhase = 'loading' | 'position' | 'notInQueue' | 'error';

export interface QueuePollState {
  phase: QueuePollPhase;
  /** Last successful probe; kept (stale) while polling fails. */
  snapshot: PositionSnapshot | null;
  /** True when the MOST RECENT tick failed but an older snapshot is shown. */
  stale: boolean;
  /** Message of the most recent transport/server failure. */
  errorMessage: string | null;
  /** Hard reset: forget discovery + snapshot and start over. */
  refresh: () => void;
}

interface Discovery {
  chamberIds: string[];
  chamberNameById: Map<string, string>;
  doctorNameById: Map<string, string>;
}

export function useQueuePositionPoll(opts: {
  userId: string | null;
  chamberIdParam: string | null;
  doctorNameParam: string | null;
  chamberNameParam: string | null;
}): QueuePollState {
  const { userId, chamberIdParam, doctorNameParam, chamberNameParam } = opts;

  const [phase, setPhase] = React.useState<QueuePollPhase>('loading');
  const [snapshot, setSnapshot] = React.useState<PositionSnapshot | null>(null);
  const [stale, setStale] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [version, setVersion] = React.useState(0);

  // Mirror of `snapshot` readable from the long-lived effect closure
  // without resubscribing the poll loop on every successful tick.
  const snapshotRef = React.useRef<PositionSnapshot | null>(null);

  const applySnapshot = React.useCallback(
    (next: PositionSnapshot | null): void => {
      snapshotRef.current = next;
      setSnapshot(next);
    },
    [],
  );

  const refresh = React.useCallback(() => {
    applySnapshot(null);
    setPhase('loading');
    setStale(false);
    setErrorMessage(null);
    setVersion((v) => v + 1);
  }, [applySnapshot]);

  useFocusEffect(
    React.useCallback(() => {
      // `version` bumps on manual refresh — referencing it here restarts
      // the whole poll loop (fresh discovery, fresh lock) on retry.
      void version;
      if (userId === null) return undefined;
      // Narrowed copy — TS narrowing does not flow into the nested closures.
      const patientId: string = userId;

      let cancelled = false;
      let busy = false;
      // Chamber that last answered 200 — probed first on later ticks.
      let locked: string | null = null;
      // null = not discovered yet. Re-attempted on every tick until it
      // yields at least one candidate, so a visit that appears after the
      // screen opened is picked up without a manual refresh.
      let discovery: Discovery | null = null;
      let discoveryFailed = false;

      function reportTrouble(message: string | null): void {
        const hasLastKnown = snapshotRef.current !== null;
        setErrorMessage(message);
        setStale(hasLastKnown);
        setPhase(hasLastKnown ? 'position' : 'error');
      }

      async function discover(): Promise<void> {
        discoveryFailed = false;
        const apptRes = await api.get<PatientAppointmentsPayload>(
          `/api/v1/patients/${encodeURIComponent(patientId)}/appointments?limit=50`,
        );
        if (cancelled) return;
        if (!apptRes.ok) {
          discoveryFailed = true;
          return;
        }
        const { doctorIds, doctorNameById } = deriveDoctorCandidates(
          apptRes.value?.appointments ?? [],
        );
        const chamberLists: (DoctorChamberLite[] | null | undefined)[] = [];
        for (const doctorId of doctorIds) {
          const chamberRes = await api.get<DoctorChambersPayload>(
            `/api/v1/doctors/${encodeURIComponent(doctorId)}/chambers`,
          );
          if (cancelled) return;
          if (!chamberRes.ok) {
            // Partial discovery is still useful for probing, but "not in
            // queue" may no longer be declared definitively this tick.
            discoveryFailed = true;
            continue;
          }
          chamberLists.push(chamberRes.value?.chambers ?? []);
        }
        const { chamberIds, chamberNameById } =
          deriveChamberCandidates(chamberLists);
        discovery = { chamberIds, chamberNameById, doctorNameById };
      }

      async function tick(): Promise<void> {
        if (cancelled || busy) return;
        busy = true;
        try {
          // (Re-)discover until at least one candidate is known. Also runs
          // when only a route param exists, purely for display names — a
          // failure then is non-fatal because the param still probes.
          if (discovery === null || discovery.chamberIds.length === 0) {
            await discover();
          }
          if (cancelled) return;

          const discovered = discovery?.chamberIds ?? [];
          const candidates =
            chamberIdParam !== null
              ? [chamberIdParam, ...discovered.filter((id) => id !== chamberIdParam)]
              : discovered;

          if (candidates.length === 0) {
            if (discoveryFailed) {
              reportTrouble(null);
            } else {
              // Discovery worked and found no chamber visit today.
              applySnapshot(null);
              setStale(false);
              setErrorMessage(null);
              setPhase('notInQueue');
            }
            return;
          }

          let transportError: string | null = null;
          for (const chamberId of probeOrder(candidates, locked)) {
            const res = await api.get<QueuePositionPayload>(
              `/api/v1/me/queue-position?chamberId=${encodeURIComponent(chamberId)}`,
            );
            if (cancelled) return;
            if (res.ok && res.value && res.value.entry) {
              locked = chamberId;
              const entry = res.value.entry;
              const doctorId = entry.doctorUserId ?? null;
              applySnapshot({
                chamberId,
                position:
                  typeof res.value.position === 'number' ? res.value.position : null,
                entry,
                fetchedAt: Date.now(),
                doctorName:
                  doctorNameParam ??
                  (doctorId !== null
                    ? (discovery?.doctorNameById.get(doctorId) ?? null)
                    : null),
                chamberName:
                  chamberNameParam ??
                  discovery?.chamberNameById.get(chamberId) ??
                  null,
              });
              setStale(false);
              setErrorMessage(null);
              setPhase('position');
              return;
            }
            if (!res.ok && res.error.code !== 'RESOURCE_NOT_FOUND') {
              transportError = res.error.message;
            }
            // RESOURCE_NOT_FOUND (or an empty 200) → try the next candidate.
          }

          if (transportError !== null || discoveryFailed) {
            // No definitive answer this tick — keep the last known
            // position on screen, marked stale.
            reportTrouble(transportError);
            return;
          }

          // Every candidate definitively said 404 — not in any queue.
          locked = null;
          applySnapshot(null);
          setStale(false);
          setErrorMessage(null);
          setPhase('notInQueue');
        } finally {
          busy = false;
        }
      }

      void tick();
      const intervalId = setInterval(() => {
        void tick();
      }, QUEUE_POLL_INTERVAL_MS);

      return () => {
        cancelled = true;
        clearInterval(intervalId);
      };
    }, [
      userId,
      chamberIdParam,
      doctorNameParam,
      chamberNameParam,
      version,
      applySnapshot,
    ]),
  );

  return { phase, snapshot, stale, errorMessage, refresh };
}
