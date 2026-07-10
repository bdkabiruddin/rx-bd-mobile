// Doctor chamber queue — live poller. Deliberately NOT useCachedQuery:
// a chamber queue is live data (spec: poll every 15s while the screen is
// focused; a cached queue replayed minutes later is a wrong queue).
//
//   GET /api/v1/me/chambers                     (once per focus session —
//        chamber discovery, retried each tick until it succeeds)
//   GET /api/v1/me/doctor-queue?chamberId=…     (15s — DOCTOR_READY next-up
//        list; the mandated doctor-queue endpoint, server-sorted)
//   GET /api/v1/chambers/{id}/queue?limit=100   (15s — all of today's stages;
//        the IN_CONSULTATION bucket feeds the now-serving card, exactly like
//        the web QueueClient. /me/doctor-queue alone cannot provide it.)
//
// Both queue reads run in ONE tick (Promise.all) so a snapshot is always
// internally coherent — never a fresh next-up list against a stale
// now-serving card.
//
// Honesty rules (mirrors the patient queue poller): ActivityIndicator only
// on the FIRST load; when a later tick fails the last known snapshot stays
// on screen with an explicit stale notice + timestamp; "no chamber" renders
// only on a definitive server answer, never on a network failure.

import { useFocusEffect } from 'expo-router';
import * as React from 'react';

import { api } from '@/api/client';

import { effectiveChamberId, pickNowServing, toWaitingList } from './logic';
import type {
  ChamberLite,
  ChamberQueuePayload,
  DoctorQueuePayload,
  DoctorQueueSnapshot,
  MyChambersPayload,
} from './types';

export const DOCTOR_QUEUE_POLL_INTERVAL_MS = 15_000;

export type DoctorQueuePollPhase = 'loading' | 'noChamber' | 'ready' | 'error';

export interface DoctorQueuePollState {
  phase: DoctorQueuePollPhase;
  /** Doctor's chambers (selector data; empty until discovery succeeds). */
  chambers: ChamberLite[];
  /** Effective chamber the queue is scoped to (selected > primary > first). */
  chamberId: string | null;
  /** Last successful tick; kept (stale) while polling fails. */
  snapshot: DoctorQueueSnapshot | null;
  /** True when the MOST RECENT tick failed but an older snapshot is shown. */
  stale: boolean;
  /** Message of the most recent transport/server failure. */
  errorMessage: string | null;
  /** Hard reset: forget discovery + snapshot and start over. */
  refresh: () => void;
  /** Immediate re-poll (e.g. right after a mutation) without a reset. */
  refreshNow: () => void;
}

export function useDoctorQueuePoll(opts: {
  userId: string | null;
  /** Doctor's explicit chamber choice; null = auto (primary/first). */
  selectedChamberId: string | null;
}): DoctorQueuePollState {
  const { userId, selectedChamberId } = opts;

  const [phase, setPhase] = React.useState<DoctorQueuePollPhase>('loading');
  const [chambers, setChambers] = React.useState<ChamberLite[]>([]);
  const [chamberId, setChamberId] = React.useState<string | null>(null);
  const [snapshot, setSnapshot] = React.useState<DoctorQueueSnapshot | null>(null);
  const [stale, setStale] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [version, setVersion] = React.useState(0);

  // Mirrors readable from the long-lived effect closure without
  // resubscribing the poll loop on every successful tick.
  const snapshotRef = React.useRef<DoctorQueueSnapshot | null>(null);
  const chambersRef = React.useRef<ChamberLite[] | null>(null);
  const tickRef = React.useRef<(() => Promise<void>) | null>(null);

  const applySnapshot = React.useCallback(
    (next: DoctorQueueSnapshot | null): void => {
      snapshotRef.current = next;
      setSnapshot(next);
    },
    [],
  );

  const refresh = React.useCallback(() => {
    chambersRef.current = null;
    applySnapshot(null);
    setPhase('loading');
    setStale(false);
    setErrorMessage(null);
    setVersion((v) => v + 1);
  }, [applySnapshot]);

  const refreshNow = React.useCallback(() => {
    void tickRef.current?.();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      // `version` bumps on manual refresh — referencing it here restarts
      // the whole poll loop (fresh discovery) on retry.
      void version;
      if (userId === null) return undefined;
      const doctorUserId: string = userId;

      let cancelled = false;
      let busy = false;

      // Chamber switch: drop the previous chamber's snapshot so a wrong
      // queue never lingers on screen while the new one loads.
      if (
        snapshotRef.current !== null &&
        selectedChamberId !== null &&
        snapshotRef.current.chamberId !== selectedChamberId
      ) {
        applySnapshot(null);
        setStale(false);
        setErrorMessage(null);
        setPhase('loading');
      }

      function reportTrouble(message: string | null): void {
        const hasLastKnown = snapshotRef.current !== null;
        setErrorMessage(message);
        setStale(hasLastKnown);
        setPhase(hasLastKnown ? 'ready' : 'error');
      }

      async function tick(): Promise<void> {
        if (cancelled || busy) return;
        busy = true;
        try {
          // 1. Chamber discovery — once per focus session, retried on
          //    every tick until it yields a definitive answer.
          let chamberList = chambersRef.current;
          if (chamberList === null) {
            const res = await api.get<MyChambersPayload>('/api/v1/me/chambers');
            if (cancelled) return;
            if (!res.ok) {
              reportTrouble(res.error.message);
              return;
            }
            chamberList = (res.value?.chambers ?? []).filter(
              (c) => typeof c.id === 'string' && c.id.length > 0,
            );
            chambersRef.current = chamberList;
            setChambers(chamberList);
          }

          const chamber = effectiveChamberId(chamberList, selectedChamberId);
          setChamberId(chamber);
          if (chamber === null) {
            // Discovery succeeded and found no usable chamber — definitive.
            applySnapshot(null);
            setStale(false);
            setErrorMessage(null);
            setPhase('noChamber');
            return;
          }

          // 2. Both queue reads in one tick → coherent snapshot.
          const [readyRes, chamberRes] = await Promise.all([
            api.get<DoctorQueuePayload>(
              `/api/v1/me/doctor-queue?chamberId=${encodeURIComponent(chamber)}`,
            ),
            api.get<ChamberQueuePayload>(
              `/api/v1/chambers/${encodeURIComponent(chamber)}/queue?limit=100`,
            ),
          ]);
          if (cancelled) return;
          if (!readyRes.ok) {
            reportTrouble(readyRes.error.message);
            return;
          }
          if (!chamberRes.ok) {
            reportTrouble(chamberRes.error.message);
            return;
          }

          applySnapshot({
            chamberId: chamber,
            waiting: toWaitingList(readyRes.value?.entries),
            nowServing: pickNowServing(chamberRes.value?.entries, doctorUserId),
            fetchedAt: Date.now(),
          });
          setStale(false);
          setErrorMessage(null);
          setPhase('ready');
        } finally {
          busy = false;
        }
      }

      tickRef.current = tick;
      void tick();
      const intervalId = setInterval(() => {
        void tick();
      }, DOCTOR_QUEUE_POLL_INTERVAL_MS);

      return () => {
        cancelled = true;
        tickRef.current = null;
        clearInterval(intervalId);
      };
    }, [userId, selectedChamberId, version, applySnapshot]),
  );

  return {
    phase,
    chambers,
    chamberId,
    snapshot,
    stale,
    errorMessage,
    refresh,
    refreshNow,
  };
}
