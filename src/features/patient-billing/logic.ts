// Patient billing — pure presentation/mapping logic. No React, no
// React Native imports: this module is unit-tested in a Node jest
// environment (__tests__/patient-billing.test.ts).
//
// Money discipline: every wire amount goes through parsePaisa (exact
// BigInt) before any arithmetic or formatting. A value that does not
// parse renders as an honest "—" — the app NEVER guesses a financial
// figure. Outstanding balance is total − paid computed in BigInt, and
// only for lifecycle states where "outstanding" is meaningful.

/** Same literal union as src/ui/StatusPill's StatusTone — duplicated so
 *  this module stays free of react-native imports. */
export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

/** Invoice lifecycle → pill tone. Mirrors the web BillingClient badge
 *  variants. Unknown/absent values degrade to neutral. */
export function invoiceStatusTone(status: string | undefined): Tone {
  switch (status) {
    case 'DRAFT':
      return 'neutral';
    case 'SENT':
      return 'info';
    case 'PAID':
      return 'success';
    case 'PARTIALLY_PAID':
      return 'warning';
    case 'OVERDUE':
      return 'danger';
    case 'VOID':
    case 'REFUNDED':
      return 'neutral';
    default:
      return 'neutral';
  }
}

/**
 * Parse a wire money value (stringified BigInt paisa; defensively also
 * a safe-integer number or a native bigint) to exact BigInt paisa.
 * Returns null for anything else — fractional numbers, unsafe-range
 * numbers, malformed strings — so callers render "—" instead of a
 * wrong amount.
 */
export function parsePaisa(value: unknown): bigint | null {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) return null;
    return BigInt(value);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!/^-?\d+$/.test(trimmed)) return null;
    return BigInt(trimmed);
  }
  return null;
}

/** Lifecycle states for which an outstanding balance is meaningful.
 *  DRAFT (not yet issued), VOID (cancelled) and REFUNDED (terminal)
 *  are excluded — showing "due ৳X" on a void invoice would be false. */
const SETTLEABLE_STATUSES = new Set<string>([
  'SENT',
  'PARTIALLY_PAID',
  'OVERDUE',
  'PAID',
]);

export function isSettleable(status: string | undefined): boolean {
  return status !== undefined && SETTLEABLE_STATUSES.has(status);
}

/**
 * Outstanding balance = invoice total − payments received, exact
 * BigInt. Null when either side is missing/unparseable (render "—").
 * A negative result (overpayment/credit) is returned verbatim — the
 * formatter shows the sign; the app never clamps a financial figure.
 */
export function outstandingPaisa(
  amount: unknown,
  totalPaid: unknown,
): bigint | null {
  const total = parsePaisa(amount);
  const paid = parsePaisa(totalPaid);
  if (total === null || paid === null) return null;
  return total - paid;
}

/** Line total = quantity × unit amount, exact BigInt. Null when the
 *  quantity is not a positive safe integer or the unit amount does not
 *  parse — the row then shows only what the backend sent. */
export function lineTotalPaisa(
  quantity: number | undefined,
  unitAmountPaisa: unknown,
): bigint | null {
  if (
    typeof quantity !== 'number' ||
    !Number.isSafeInteger(quantity) ||
    quantity <= 0
  ) {
    return null;
  }
  const unit = parsePaisa(unitAmountPaisa);
  if (unit === null) return null;
  return BigInt(quantity) * unit;
}

/** Join defined, non-empty parts with a middle dot (list row subtitles). */
export function joinParts(parts: (string | undefined | null)[]): string {
  return parts
    .filter((p): p is string => typeof p === 'string' && p.length > 0)
    .join(' · ');
}

/** True when an ApiError code means the server's consent gate denied
 *  the read (TASK-244 uniform-fire: a patient whose TREATMENT consent
 *  lacks READ_INVOICES gets 403 on their own billing list). The screen
 *  then explains consent instead of showing a generic failure. */
export function isConsentDenied(code: string | undefined): boolean {
  return code === 'FORBIDDEN';
}
