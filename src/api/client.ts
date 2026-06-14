// HTTP client — the single seam through which the app talks to rx.bd.
//
// Responsibilities:
//   - attach the bearer access token
//   - attach Idempotency-Key on writes
//   - on 401: single-flight refresh (delegated to the auth bridge), retry once
//   - on hard auth failure: signal logout/wipe
//   - never throw across the boundary — return Result<T>
//
// Decoupling: the client does NOT import the session store (would create a
// cycle). The auth layer wires a bridge at boot via `configureApiAuth`.

import { apiUrl } from '@/config/env';

import {
  type ApiError,
  type Result,
  fail,
  networkError,
  ok,
  toApiError,
} from './errors';
import { IDEMPOTENCY_HEADER, newIdempotencyKey } from './idempotency';

export interface AuthBridge {
  /** Current access token, or null when signed out. */
  getAccessToken: () => string | null;
  /** Single-flight refresh; resolves true if a fresh token is now available. */
  refresh: () => Promise<boolean>;
  /** Called on unrecoverable auth failure — clears session + wipes caches. */
  onAuthFailure: () => void;
}

let authBridge: AuthBridge | null = null;
export function configureApiAuth(bridge: AuthBridge): void {
  authBridge = bridge;
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface RequestOptions {
  method?: Method;
  body?: unknown;
  /** Provide to make the write idempotent with a STABLE key (reused on retry).
   *  Omit on writes to auto-generate one. */
  idempotencyKey?: string;
  /** Reverify token for two-key intents. */
  reverifyToken?: string;
  signal?: AbortSignal;
  /** Internal: prevents infinite refresh recursion. */
  _isRetry?: boolean;
}

const isWrite = (m: Method): boolean => m === 'POST' || m === 'PATCH' || m === 'PUT' || m === 'DELETE';

export async function request<T>(
  path: string,
  opts: RequestOptions = {},
): Promise<Result<T>> {
  const method: Method = opts.method ?? 'GET';
  const headers: Record<string, string> = {
    accept: 'application/json',
  };

  const token = authBridge?.getAccessToken() ?? null;
  if (token) headers.authorization = `Bearer ${token}`;

  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (isWrite(method)) {
    headers[IDEMPOTENCY_HEADER] = opts.idempotencyKey ?? newIdempotencyKey();
  }
  if (opts.reverifyToken) headers['x-reverify-token'] = opts.reverifyToken;

  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      method,
      headers,
      ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
      ...(opts.signal ? { signal: opts.signal } : {}),
    });
  } catch {
    return fail(networkError());
  }

  // 401 → attempt one refresh+retry, then hard-fail.
  if (res.status === 401 && !opts._isRetry && authBridge) {
    const refreshed = await authBridge.refresh();
    if (refreshed) {
      return request<T>(path, { ...opts, _isRetry: true });
    }
    authBridge.onAuthFailure();
    return fail(toApiError(401, await safeJson(res)));
  }

  if (!res.ok) {
    return fail(toApiError(res.status, await safeJson(res)));
  }

  // 204 / empty body.
  if (res.status === 204) return ok(undefined as T);
  const json = await safeJson(res);
  // Backend commonly wraps payloads as { data: … }; unwrap when present.
  const value = (json && typeof json === 'object' && 'data' in (json as object)
    ? (json as { data: unknown }).data
    : json) as T;
  return ok(value);
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

// Convenience verbs.
export const api = {
  get: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'PATCH', body }),
  del: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'DELETE' }),
};

export type { ApiError };
