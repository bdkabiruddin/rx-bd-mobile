import { isRetryable, networkError, toApiError } from '@/api/errors';

describe('toApiError', () => {
  it('maps HTTP statuses to typed codes', () => {
    expect(toApiError(401, null).code).toBe('UNAUTHORIZED');
    expect(toApiError(403, null).code).toBe('FORBIDDEN');
    expect(toApiError(404, null).code).toBe('RESOURCE_NOT_FOUND');
    expect(toApiError(409, null).code).toBe('CONFLICT');
    expect(toApiError(422, null).code).toBe('VALIDATION_ERROR');
    expect(toApiError(429, null).code).toBe('RATE_LIMITED');
    expect(toApiError(500, null).code).toBe('SERVER_ERROR');
    expect(toApiError(418, null).code).toBe('UNKNOWN');
  });

  it('extracts the backend { error: { message } } shape', () => {
    expect(toApiError(400, { error: { message: 'bad input' } }).message).toBe('bad input');
    expect(toApiError(400, { message: 'flat message' }).message).toBe('flat message');
    expect(toApiError(500, null).message).toContain('500');
  });
});

describe('isRetryable', () => {
  it('queues transient failures only', () => {
    expect(isRetryable(networkError())).toBe(true);
    expect(isRetryable({ code: 'SERVER_ERROR', message: '' })).toBe(true);
    expect(isRetryable({ code: 'RATE_LIMITED', message: '' })).toBe(true);
    expect(isRetryable({ code: 'OFFLINE', message: '' })).toBe(true);
    expect(isRetryable({ code: 'VALIDATION_ERROR', message: '' })).toBe(false);
    expect(isRetryable({ code: 'CONFLICT', message: '' })).toBe(false);
    expect(isRetryable({ code: 'FORBIDDEN', message: '' })).toBe(false);
  });
});
