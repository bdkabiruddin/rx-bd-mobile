// Patient billing — pure logic suite (Node environment, no RN imports).

import {
  invoiceStatusTone,
  isConsentDenied,
  isSettleable,
  joinParts,
  lineTotalPaisa,
  outstandingPaisa,
  parsePaisa,
} from '@/features/patient-billing/logic';

describe('invoiceStatusTone — lifecycle → locked pill tones', () => {
  it('maps the invoice lifecycle', () => {
    expect(invoiceStatusTone('DRAFT')).toBe('neutral');
    expect(invoiceStatusTone('SENT')).toBe('info');
    expect(invoiceStatusTone('PAID')).toBe('success');
    expect(invoiceStatusTone('PARTIALLY_PAID')).toBe('warning');
    expect(invoiceStatusTone('OVERDUE')).toBe('danger');
    expect(invoiceStatusTone('VOID')).toBe('neutral');
    expect(invoiceStatusTone('REFUNDED')).toBe('neutral');
  });

  it('degrades unknown/absent statuses to neutral', () => {
    expect(invoiceStatusTone('SOMETHING_NEW')).toBe('neutral');
    expect(invoiceStatusTone(undefined)).toBe('neutral');
  });
});

describe('parsePaisa — exact BigInt from the wire, never a guess', () => {
  it('parses stringified BigInt paisa (the canonical wire shape)', () => {
    expect(parsePaisa('123456')).toBe(123456n);
    expect(parsePaisa('0')).toBe(0n);
    expect(parsePaisa('-2550')).toBe(-2550n);
    // Beyond Number.MAX_SAFE_INTEGER — exactness is the point.
    expect(parsePaisa('9007199254740993')).toBe(9007199254740993n);
  });

  it('accepts safe-integer numbers and native bigint defensively', () => {
    expect(parsePaisa(123456)).toBe(123456n);
    expect(parsePaisa(42n)).toBe(42n);
  });

  it('rejects anything that could round or mislead', () => {
    expect(parsePaisa(12.5)).toBeNull();
    expect(parsePaisa(Number.MAX_SAFE_INTEGER + 2)).toBeNull();
    expect(parsePaisa('12.5')).toBeNull();
    expect(parsePaisa('1e6')).toBeNull();
    expect(parsePaisa('')).toBeNull();
    expect(parsePaisa('abc')).toBeNull();
    expect(parsePaisa(undefined)).toBeNull();
    expect(parsePaisa(null)).toBeNull();
    expect(parsePaisa({})).toBeNull();
  });
});

describe('outstandingPaisa — total − paid in exact BigInt', () => {
  it('computes the balance from wire strings', () => {
    expect(outstandingPaisa('100000', '25000')).toBe(75000n);
    expect(outstandingPaisa('100000', '0')).toBe(100000n);
    expect(outstandingPaisa('100000', '100000')).toBe(0n);
  });

  it('returns an overpayment verbatim (never clamps a figure)', () => {
    expect(outstandingPaisa('100000', '120000')).toBe(-20000n);
  });

  it('returns null (screen renders "—") when either side is unusable', () => {
    expect(outstandingPaisa(undefined, '100')).toBeNull();
    expect(outstandingPaisa('100', undefined)).toBeNull();
    expect(outstandingPaisa('12.5', '100')).toBeNull();
  });
});

describe('isSettleable — outstanding shown only where it is meaningful', () => {
  it('allows the settleable lifecycle states', () => {
    expect(isSettleable('SENT')).toBe(true);
    expect(isSettleable('PARTIALLY_PAID')).toBe(true);
    expect(isSettleable('OVERDUE')).toBe(true);
    expect(isSettleable('PAID')).toBe(true);
  });

  it('refuses states where a balance would be false', () => {
    expect(isSettleable('DRAFT')).toBe(false);
    expect(isSettleable('VOID')).toBe(false);
    expect(isSettleable('REFUNDED')).toBe(false);
    expect(isSettleable(undefined)).toBe(false);
    expect(isSettleable('SOMETHING_NEW')).toBe(false);
  });
});

describe('lineTotalPaisa — quantity × unit, exact BigInt', () => {
  it('multiplies exactly', () => {
    expect(lineTotalPaisa(3, '15000')).toBe(45000n);
    expect(lineTotalPaisa(1, '9007199254740993')).toBe(9007199254740993n);
  });

  it('returns null on malformed inputs', () => {
    expect(lineTotalPaisa(undefined, '100')).toBeNull();
    expect(lineTotalPaisa(0, '100')).toBeNull();
    expect(lineTotalPaisa(-1, '100')).toBeNull();
    expect(lineTotalPaisa(2.5, '100')).toBeNull();
    expect(lineTotalPaisa(2, undefined)).toBeNull();
    expect(lineTotalPaisa(2, '1.5')).toBeNull();
  });
});

describe('joinParts', () => {
  it('joins defined, non-empty parts with a middle dot', () => {
    expect(joinParts(['a', undefined, 'b', null, '', 'c'])).toBe('a · b · c');
    expect(joinParts([undefined, null])).toBe('');
  });
});

describe('isConsentDenied — 403 explains consent, not a generic error', () => {
  it('matches only the FORBIDDEN code', () => {
    expect(isConsentDenied('FORBIDDEN')).toBe(true);
    expect(isConsentDenied('SERVER_ERROR')).toBe(false);
    expect(isConsentDenied('RESOURCE_NOT_FOUND')).toBe(false);
    expect(isConsentDenied(undefined)).toBe(false);
  });
});
