// useCachedQuery — the read path. Renders the encrypted cache immediately
// (with its fetchedAt for the freshness badge), then background-refreshes via
// the API and writes the fresh payload back to the cache.

import { useQuery } from '@tanstack/react-query';
import * as React from 'react';

import { getCache, putCache } from '@/offline/cache';

import { api } from './client';
import type { ApiError } from './errors';

export interface CachedQueryResult<T> {
  data: T | undefined;
  fetchedAt: number | null;
  isStale: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  error: ApiError | null;
  refetch: () => void;
}

export function useCachedQuery<T>(opts: {
  /** Stable cache + query key. */
  key: string;
  /** API path to GET. */
  path: string;
  ttlMs?: number;
  isPhi?: boolean;
  tenantId?: string;
  userId?: string;
  enabled?: boolean;
}): CachedQueryResult<T> {
  const [seed, setSeed] = React.useState<{ value: T; fetchedAt: number } | null>(null);
  const [seedLoaded, setSeedLoaded] = React.useState(false);

  // Hydrate from cache once.
  React.useEffect(() => {
    let active = true;
    void (async () => {
      const cached = await getCache<T>(opts.key);
      if (active) {
        if (cached) setSeed({ value: cached.value, fetchedAt: cached.fetchedAt });
        setSeedLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [opts.key]);

  const query = useQuery<{ value: T; fetchedAt: number }, ApiError>({
    queryKey: [opts.key],
    enabled: (opts.enabled ?? true) && seedLoaded,
    queryFn: async () => {
      const res = await api.get<T>(opts.path);
      if (!res.ok) throw res.error;
      const fetchedAt = Date.now();
      await putCache(opts.key, res.value, {
        ...(opts.ttlMs !== undefined ? { ttlMs: opts.ttlMs } : {}),
        ...(opts.isPhi !== undefined ? { isPhi: opts.isPhi } : {}),
        ...(opts.tenantId !== undefined ? { tenantId: opts.tenantId } : {}),
        ...(opts.userId !== undefined ? { userId: opts.userId } : {}),
      });
      return { value: res.value, fetchedAt };
    },
    initialData: seed ?? undefined,
  });

  const fetchedAt = query.data?.fetchedAt ?? seed?.fetchedAt ?? null;
  const isStale =
    fetchedAt !== null && opts.ttlMs !== undefined
      ? Date.now() > fetchedAt + opts.ttlMs
      : false;

  return {
    data: query.data?.value,
    fetchedAt,
    isStale,
    isLoading: !seedLoaded || (query.isLoading && !seed),
    isRefreshing: query.isFetching,
    error: query.error ?? null,
    refetch: () => void query.refetch(),
  };
}
