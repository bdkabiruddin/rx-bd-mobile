// Patient billing — feature-local bilingual strings ({ en, bn }). One
// language renders at a time (Wave 59 rule); never both side by side.

import type { Localized } from '@/i18n/types';

export const STR = {
  // Index — my bills
  myBills: { en: 'My bills', bn: 'আমার বিল' },
  noInvoices: { en: 'No bills yet', bn: 'এখনো কোনো বিল নেই' },
  noInvoicesHint: {
    en: 'Bills from your visits, medicines and tests will appear here.',
    bn: 'আপনার ভিজিট, ওষুধ ও পরীক্ষার বিল এখানে দেখা যাবে।',
  },
  consentDenied: {
    en: 'Billing access is not enabled',
    bn: 'বিলিং দেখার অনুমতি চালু নেই',
  },
  consentDeniedHint: {
    en: 'Your consent settings do not allow viewing bills in the app yet. Please contact your care facility to update them.',
    bn: 'আপনার সম্মতির সেটিংসে এখনো অ্যাপে বিল দেখার অনুমতি নেই। হালনাগাদ করতে আপনার সেবাকেন্দ্রে যোগাযোগ করুন।',
  },
  // Detail — invoice
  invoiceDetails: { en: 'Bill details', bn: 'বিলের বিবরণ' },
  invoiceNotFound: { en: 'Bill not found', bn: 'বিলটি পাওয়া যায়নি' },
  issuedOn: { en: 'Issued on', bn: 'ইস্যুর তারিখ' },
  dueOn: { en: 'Due by', bn: 'পরিশোধের শেষ তারিখ' },
  notes: { en: 'Notes', bn: 'নোট' },
  lineItems: { en: 'Items', bn: 'আইটেমসমূহ' },
  noLineItems: {
    en: 'No items listed on this bill.',
    bn: 'এই বিলে কোনো আইটেমের তালিকা নেই।',
  },
  itemFallback: { en: 'Item', bn: 'আইটেম' },

  // Payments
  payments: { en: 'Payments received', bn: 'গৃহীত পেমেন্ট' },
  noPayments: {
    en: 'No payments recorded yet',
    bn: 'এখনো কোনো পেমেন্ট নথিভুক্ত হয়নি',
  },
  noPaymentsHint: {
    en: 'Payments recorded at your care facility will appear here.',
    bn: 'আপনার সেবাকেন্দ্রে নথিভুক্ত পেমেন্ট এখানে দেখা যাবে।',
  },
  paymentFallbackTitle: { en: 'Payment', bn: 'পেমেন্ট' },
  reference: { en: 'Reference', bn: 'রেফারেন্স' },

  // Totals
  totalAmount: { en: 'Total', bn: 'মোট' },
  paidSoFar: { en: 'Paid so far', bn: 'এ পর্যন্ত পরিশোধিত' },
  outstanding: { en: 'Outstanding', bn: 'বকেয়া' },

  // View-only notice — Phase 2 has no in-app payment.
  viewOnlyNotice: {
    en: 'Payments are handled at your care facility or on the rx.bd website.',
    bn: 'পেমেন্ট আপনার সেবাকেন্দ্রে অথবা rx.bd ওয়েবসাইটে সম্পন্ন হয়।',
  },
} satisfies Record<string, Localized>;

/** Localized label for an invoice lifecycle status; raw when unknown.
 *  Patient-facing: SENT reads as "payment due", not the internal name. */
export function invoiceStatusLabel(status: string | undefined): Localized {
  switch (status) {
    case 'DRAFT':
      return { en: 'Draft', bn: 'খসড়া' };
    case 'SENT':
      return { en: 'Due', bn: 'পরিশোধ বাকি' };
    case 'PAID':
      return { en: 'Paid', bn: 'পরিশোধিত' };
    case 'PARTIALLY_PAID':
      return { en: 'Partially paid', bn: 'আংশিক পরিশোধিত' };
    case 'OVERDUE':
      return { en: 'Overdue', bn: 'বকেয়া' };
    case 'VOID':
      return { en: 'Void', bn: 'বাতিল' };
    case 'REFUNDED':
      return { en: 'Refunded', bn: 'ফেরত দেওয়া হয়েছে' };
    default:
      return { en: status ?? '—', bn: status ?? '—' };
  }
}

/** Localized label for what the invoice settles (InvoiceSource);
 *  raw value when unknown. */
export function sourceLabel(source: string | undefined): Localized {
  switch (source) {
    case 'APPOINTMENT':
      return { en: 'Appointment', bn: 'অ্যাপয়েন্টমেন্ট' };
    case 'DISPENSE':
      return { en: 'Pharmacy', bn: 'ফার্মেসি' };
    case 'LAB_RESULT':
      return { en: 'Lab test', bn: 'ল্যাব পরীক্ষা' };
    case 'ADMISSION':
      return { en: 'Hospital admission', bn: 'হাসপাতালে ভর্তি' };
    case 'SUBSCRIPTION':
      return { en: 'Subscription', bn: 'সাবস্ক্রিপশন' };
    case 'OTHER':
      return { en: 'Other charge', bn: 'অন্যান্য' };
    default:
      return { en: source ?? '—', bn: source ?? '—' };
  }
}

/** Localized label for how a payment was tendered (PaymentMethod). */
export function paymentMethodLabel(method: string | undefined): Localized {
  switch (method) {
    case 'CASH':
      return { en: 'Cash', bn: 'নগদ অর্থ' };
    case 'CARD':
      return { en: 'Card', bn: 'কার্ড' };
    case 'MOBILE_BANKING':
      return { en: 'Mobile banking', bn: 'মোবাইল ব্যাংকিং' };
    case 'INSURANCE':
      return { en: 'Insurance', bn: 'বীমা' };
    case 'OTHER':
      return { en: 'Other', bn: 'অন্যান্য' };
    default:
      return { en: method ?? '—', bn: method ?? '—' };
  }
}

/** "2 items" / "২টি আইটেম" style count label. */
export function itemCountLabel(count: number): Localized {
  return {
    en: count === 1 ? '1 item' : `${count} items`,
    bn: `${count}টি আইটেম`,
  };
}
