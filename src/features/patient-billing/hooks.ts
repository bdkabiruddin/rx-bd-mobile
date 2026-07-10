// Patient billing — shared cached-read hooks (view-only feature; no
// writes ship in Phase 2 — payment initiation lives on the web).
//
// Endpoints (verified against openapi.yaml + backend route auth):
//   GET /api/v1/patients/{id}/invoices    — PATIENT self-read OK
//       (customOwnership: URL id must equal the caller's userId);
//       consent gate (TREATMENT + READ_INVOICES) fires server-side.
//   GET /api/v1/invoices/{id}             — any tenant member; the
//       consent gate is the load-bearing access control. Unknown /
//       cross-tenant ids return `invoice: null` (no-enumeration).
//   GET /api/v1/invoices/{id}/payments    — same consent gate via the
//       parent invoice's patientId.
//
// Everything here is PHI (an invoice tied to a patient is individually
// identifiable health information) — isPhi: true on every cache entry.

import { useCachedQuery, type CachedQueryResult } from '@/api/useCachedQuery';
import { useSession } from '@/auth/sessionStore';

import type { InvoicePayload, InvoicesPayload, PaymentsPayload } from './types';

const INVOICES_TTL_MS = 10 * 60 * 1000;
const DETAIL_TTL_MS = 5 * 60 * 1000;

/** The backend's list default is 50; ask for 100 (max 200) so the list
 *  covers deeper billing history in one page. */
const INVOICES_LIMIT = 100;

/** The signed-in patient's invoices, newest first. */
export function usePatientInvoices(): CachedQueryResult<InvoicesPayload> {
  const userId = useSession((s) => s.userId);
  return useCachedQuery<InvoicesPayload>({
    key: 'patient:billing:invoices',
    path: `/api/v1/patients/${userId ?? 'unknown'}/invoices?limit=${INVOICES_LIMIT}`,
    ttlMs: INVOICES_TTL_MS,
    isPhi: true,
    enabled: userId !== null,
    ...(userId !== null ? { userId } : {}),
  });
}

/** One invoice with line items + notes. */
export function useInvoice(
  invoiceId: string | undefined,
): CachedQueryResult<InvoicePayload> {
  const userId = useSession((s) => s.userId);
  return useCachedQuery<InvoicePayload>({
    key: `patient:billing:invoice:${invoiceId ?? 'unknown'}`,
    path: `/api/v1/invoices/${invoiceId ?? 'unknown'}`,
    ttlMs: DETAIL_TTL_MS,
    isPhi: true,
    enabled: invoiceId !== undefined,
    ...(userId !== null ? { userId } : {}),
  });
}

/** Payments recorded against one invoice + the authoritative paid sum. */
export function useInvoicePayments(
  invoiceId: string | undefined,
): CachedQueryResult<PaymentsPayload> {
  const userId = useSession((s) => s.userId);
  return useCachedQuery<PaymentsPayload>({
    key: `patient:billing:payments:${invoiceId ?? 'unknown'}`,
    path: `/api/v1/invoices/${invoiceId ?? 'unknown'}/payments`,
    ttlMs: DETAIL_TTL_MS,
    isPhi: true,
    enabled: invoiceId !== undefined,
    ...(userId !== null ? { userId } : {}),
  });
}
