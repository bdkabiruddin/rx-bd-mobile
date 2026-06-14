// Client error model — mirrors the backend Result<T,E> + ApiError so the
// app speaks the same error language. Never throws across call boundaries;
// callers branch on `result.ok`.

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'RESOURCE_NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'SERVER_ERROR'
  | 'NETWORK_ERROR'
  | 'OFFLINE'
  | 'UNKNOWN';

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  /** HTTP status when the failure came from a response. */
  status?: number;
  details?: unknown;
}

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: ApiError };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const fail = (error: ApiError): Result<never> => ({ ok: false, error });

/** Map an HTTP status + parsed body to a typed ApiError. */
export function toApiError(status: number, body: unknown): ApiError {
  const message =
    (typeof body === 'object' &&
      body !== null &&
      // backend shape: { error: { message } } or { message }
      (((body as { error?: { message?: string } }).error?.message) ??
        (body as { message?: string }).message)) ||
    `Request failed (${status}).`;

  const byStatus: Record<number, ApiErrorCode> = {
    400: 'VALIDATION_ERROR',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'RESOURCE_NOT_FOUND',
    409: 'CONFLICT',
    422: 'VALIDATION_ERROR',
    429: 'RATE_LIMITED',
  };
  const code: ApiErrorCode =
    byStatus[status] ?? (status >= 500 ? 'SERVER_ERROR' : 'UNKNOWN');

  return { code, message, status, details: body };
}

export const networkError = (): ApiError => ({
  code: 'NETWORK_ERROR',
  message: 'Network request failed.',
});

export const offlineError = (): ApiError => ({
  code: 'OFFLINE',
  message: 'You are offline.',
});

/** True when a failed write is safe to queue for later replay (transient). */
export function isRetryable(error: ApiError): boolean {
  return (
    error.code === 'NETWORK_ERROR' ||
    error.code === 'OFFLINE' ||
    error.code === 'SERVER_ERROR' ||
    error.code === 'RATE_LIMITED'
  );
}
