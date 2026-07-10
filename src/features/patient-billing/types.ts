// Patient billing — local wire types mirrored from the rx.bd backend.
//
// Sources (READ-ONLY mirrors; do not import backend code):
//   - GET /api/v1/patients/{id}/invoices →
//     ListInvoicesByPatientResult (src/modules/billing/application/
//     queries/ListInvoicesByPatientHandler.ts — InvoiceListView).
//     PATIENT may read their own id only (route customOwnership); the
//     consent gate (TREATMENT + READ_INVOICES) fires server-side and a
//     deny surfaces as 403 FORBIDDEN.
//   - GET /api/v1/invoices/{id} →
//     GetInvoiceResult (GetInvoiceHandler.ts — InvoiceView). Returns
//     `invoice: null` for unknown / cross-tenant ids (no-enumeration
//     oracle) — the screen renders an honest not-found state.
//   - GET /api/v1/invoices/{id}/payments →
//     ListPaymentsByInvoiceResult (ListPaymentsByInvoiceHandler.ts —
//     PaymentView + totalPaidPaisa).
//
// Money: `*Paisa` fields are BigInt server-side and stringified for
// JSON transport (the web mirror in src/app/(patient)/dashboard/
// patient/billing/_lib/fetchInvoices.ts coerces string OR number
// defensively — we mirror that posture). Dates serialize as ISO
// strings. Only fields this feature renders are declared; everything
// the server merely *may* send is optional/nullable defensively.

/** Mirror of InvoiceStatus (domain/BillingEnums.ts). Read-side status
 *  fields stay plain strings so unknown future values degrade to a
 *  neutral pill instead of breaking the screen. */
export type InvoiceStatus =
  | 'DRAFT'
  | 'SENT'
  | 'PAID'
  | 'PARTIALLY_PAID'
  | 'OVERDUE'
  | 'VOID'
  | 'REFUNDED';

/** Mirror of InvoiceSource. */
export type InvoiceSource =
  | 'APPOINTMENT'
  | 'DISPENSE'
  | 'LAB_RESULT'
  | 'ADMISSION'
  | 'SUBSCRIPTION'
  | 'OTHER';

/** Mirror of PaymentMethod. */
export type PaymentMethod =
  | 'CASH'
  | 'CARD'
  | 'MOBILE_BANKING'
  | 'INSURANCE'
  | 'OTHER';

/** One row of the patient invoice list (mirror of InvoiceListView —
 *  metadata only; line items ship on the detail payload). */
export interface InvoiceListItem {
  invoiceId: string;
  patientId?: string;
  source?: string;
  sourceId?: string | null;
  /** Stringified BigInt paisa on the wire (defensively also number). */
  amountPaisa?: string | number;
  currency?: string;
  status?: string;
  /** ISO timestamp. */
  dueDate?: string;
  itemCount?: number;
  /** ISO timestamp. */
  createdAt?: string;
}

/** GET /patients/{id}/invoices payload. */
export interface InvoicesPayload {
  invoices?: InvoiceListItem[];
  pagination?: { limit?: number; offset?: number };
}

/** One invoice line item (mirror of InvoiceItem, domain/Invoice.ts).
 *  `description` is PHI when it carries clinical narrative. */
export interface InvoiceLineItem {
  description?: string;
  code?: string | null;
  quantity?: number;
  /** Stringified BigInt paisa on the wire. */
  unitAmountPaisa?: string | number;
}

/** Full invoice view (mirror of InvoiceView). */
export interface InvoiceDetail {
  invoiceId: string;
  /** NULL on SUBSCRIPTION-source (tenant-level) rows. */
  patientId?: string | null;
  source?: string;
  sourceId?: string | null;
  amountPaisa?: string | number;
  currency?: string;
  status?: string;
  dueDate?: string;
  items?: InvoiceLineItem[];
  /** PHI — billing notes may carry clinical context. */
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** GET /invoices/{id} payload — `invoice: null` on unknown ids. */
export interface InvoicePayload {
  invoice?: InvoiceDetail | null;
}

/** One payment tendered against an invoice (mirror of PaymentView). */
export interface PaymentListItem {
  paymentId: string;
  invoiceId?: string;
  paymentMethod?: string;
  amountPaisa?: string | number;
  currency?: string;
  /** ISO timestamp. */
  paidAt?: string;
  paidByUserId?: string;
  reference?: string | null;
  /** PHI — operator notes may carry clinical context. */
  notes?: string | null;
  createdAt?: string;
}

/** GET /invoices/{id}/payments payload. */
export interface PaymentsPayload {
  payments?: PaymentListItem[];
  /** Stringified BigInt paisa — authoritative sum of payments. */
  totalPaidPaisa?: string | number;
  pagination?: { limit?: number; offset?: number };
}
