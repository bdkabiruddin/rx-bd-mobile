import { decodeAccessClaims, secondsUntilExpiry } from '@/auth/jwt';

// Build a JWT-shaped token (base64url payload, no padding) — header + payload + sig.
function makeToken(claims: Record<string, unknown>): string {
  const b64url = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(claims)}.sig`;
}

describe('decodeAccessClaims', () => {
  it('decodes role/branch claims from a base64url payload (no padding)', () => {
    const token = makeToken({
      sub: 'user-1',
      tenantId: 'tenant-1',
      role: 'DOCTOR',
      branchId: 'branch-9',
      exp: 1_900_000_000,
    });
    const claims = decodeAccessClaims(token);
    expect(claims).not.toBeNull();
    expect(claims?.role).toBe('DOCTOR');
    expect(claims?.branchId).toBe('branch-9');
    expect(claims?.tenantId).toBe('tenant-1');
  });

  it('returns null for malformed tokens', () => {
    expect(decodeAccessClaims('not-a-token')).toBeNull();
    expect(decodeAccessClaims('')).toBeNull();
  });
});

describe('secondsUntilExpiry', () => {
  it('computes remaining lifetime', () => {
    const now = 1_700_000_000_000; // ms
    const token = makeToken({ exp: 1_700_000_060 }); // +60s in seconds
    expect(secondsUntilExpiry(token, now)).toBe(60);
  });
});
