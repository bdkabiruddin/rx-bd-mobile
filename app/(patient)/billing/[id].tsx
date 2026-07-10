// Bill detail — the invoice summary (what it settles, status, issue +
// due dates, notes), every line item, payments received so far and the
// outstanding balance (total − paid, exact BigInt — shown only for
// lifecycle states where a balance is meaningful; never on VOID /
// REFUNDED / DRAFT bills).
//
// VIEW-ONLY in Phase 2: no payment initiation from mobile — gateway
// flows live on the web; a footnote says where payments happen instead
// of a fake pay button (clinical-safety honesty rule).
//
// Contracts:
//   - GET /api/v1/invoices/{id} → { invoice: InvoiceView | null } —
//     null for unknown / cross-tenant ids (no-enumeration oracle), so
//     the screen renders an honest not-found state;
//   - GET /api/v1/invoices/{id}/payments → payments +
//     totalPaidPaisa (authoritative server-side BigInt sum).

import { useLocalSearchParams } from 'expo-router';
import * as React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useInvoice, useInvoicePayments } from '@/features/patient-billing/hooks';
import {
  invoiceStatusTone,
  isConsentDenied,
  isSettleable,
  joinParts,
  lineTotalPaisa,
  outstandingPaisa,
  parsePaisa,
} from '@/features/patient-billing/logic';
import {
  STR,
  invoiceStatusLabel,
  paymentMethodLabel,
  sourceLabel,
} from '@/features/patient-billing/strings';
import type {
  InvoiceLineItem,
  PaymentListItem,
} from '@/features/patient-billing/types';
import { COMMON, formatDate, formatDateTime, formatPaisa, useT, type Language } from '@/i18n';
import { EmptyState } from '@/ui/EmptyState';
import { FreshnessBadge } from '@/ui/FreshnessBadge';
import { ScreenScaffold } from '@/ui/ScreenScaffold';
import { SectionHeader } from '@/ui/SectionHeader';
import { StatusPill } from '@/ui/StatusPill';
import { useTheme } from '@/ui/theme';
import { fontSize, radius, spacing } from '@/ui/tokens';

/** Wire paisa → "৳1,234.56", or an honest "—" when unparseable. */
function amountText(value: string | number | undefined, lang: Language): string {
  const paisa = parsePaisa(value);
  return paisa === null ? '—' : formatPaisa(paisa, lang);
}

export default function InvoiceDetailScreen(): React.ReactElement {
  const { lang, t } = useT();
  const theme = useTheme();
  const params = useLocalSearchParams<{ id: string }>();
  const invoiceId =
    typeof params.id === 'string' && params.id.length > 0 ? params.id : undefined;

  const invoiceQ = useInvoice(invoiceId);
  const paymentsQ = useInvoicePayments(invoiceId);

  // `invoice: null` is the backend's honest unknown-id answer.
  const invoice = invoiceQ.data?.invoice ?? null;
  const payments = paymentsQ.data?.payments;

  // Malformed/absent route param — nothing can load; say so honestly.
  if (invoiceId === undefined) {
    return (
      <ScreenScaffold phi>
        <SectionHeader title={t(STR.invoiceDetails)} />
        <EmptyState title={t(STR.invoiceNotFound)} />
      </ScreenScaffold>
    );
  }

  const outstanding =
    invoice !== null && isSettleable(invoice.status)
      ? outstandingPaisa(invoice.amountPaisa, paymentsQ.data?.totalPaidPaisa)
      : null;

  return (
    <ScreenScaffold phi>
      <SectionHeader
        title={t(STR.invoiceDetails)}
        right={<FreshnessBadge fetchedAt={invoiceQ.fetchedAt} />}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Invoice summary. */}
        {invoiceQ.isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        ) : invoiceQ.error && !invoiceQ.data ? (
          isConsentDenied(invoiceQ.error.code) ? (
            <EmptyState
              title={t(STR.consentDenied)}
              message={t(STR.consentDeniedHint)}
              actionLabel={t(COMMON.retry)}
              onAction={invoiceQ.refetch}
            />
          ) : (
            <EmptyState
              title={t(COMMON.genericError)}
              message={invoiceQ.error.message}
              actionLabel={t(COMMON.retry)}
              onAction={invoiceQ.refetch}
            />
          )
        ) : invoice === null ? (
          <EmptyState title={t(STR.invoiceNotFound)} />
        ) : (
          <>
            <View
              style={[
                styles.card,
                { borderColor: theme.line, backgroundColor: theme.bgElevated },
              ]}
              testID={`invoice-summary-${invoice.invoiceId}`}
            >
              <View style={styles.cardHead}>
                <Text style={[styles.cardTitle, { color: theme.fg }]}>
                  {t(sourceLabel(invoice.source))}
                </Text>
                <StatusPill
                  label={t(invoiceStatusLabel(invoice.status))}
                  tone={invoiceStatusTone(invoice.status)}
                />
              </View>
              <Text style={[styles.amount, { color: theme.fg }]}>
                {amountText(invoice.amountPaisa, lang)}
              </Text>
              {invoice.createdAt !== undefined ? (
                <KeyValue
                  label={t(STR.issuedOn)}
                  value={formatDate(invoice.createdAt, lang)}
                />
              ) : null}
              {invoice.dueDate !== undefined ? (
                <KeyValue
                  label={t(STR.dueOn)}
                  value={formatDate(invoice.dueDate, lang)}
                />
              ) : null}
              {invoice.notes !== null &&
              invoice.notes !== undefined &&
              invoice.notes.length > 0 ? (
                <KeyValue label={t(STR.notes)} value={invoice.notes} />
              ) : null}
            </View>

            {/* Line items. */}
            <Text style={[styles.sectionTitle, { color: theme.fg }]}>
              {t(STR.lineItems)}
            </Text>
            {invoice.items === undefined || invoice.items.length === 0 ? (
              <Text style={[styles.note, { color: theme.fgMuted }]}>
                {t(STR.noLineItems)}
              </Text>
            ) : (
              <View
                style={[
                  styles.card,
                  { borderColor: theme.line, backgroundColor: theme.bgElevated },
                ]}
              >
                {invoice.items.map((item, idx) => (
                  <LineItemRow key={`item-${idx}`} item={item} first={idx === 0} />
                ))}
              </View>
            )}
          </>
        )}

        {/* Payments received + balance. */}
        <Text style={[styles.sectionTitle, { color: theme.fg }]}>
          {t(STR.payments)}
        </Text>
        {paymentsQ.isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        ) : paymentsQ.error && !paymentsQ.data ? (
          <EmptyState
            title={t(COMMON.genericError)}
            message={paymentsQ.error.message}
            actionLabel={t(COMMON.retry)}
            onAction={paymentsQ.refetch}
          />
        ) : (
          <>
            {!payments || payments.length === 0 ? (
              <EmptyState
                title={t(STR.noPayments)}
                message={t(STR.noPaymentsHint)}
              />
            ) : (
              payments.map((p) => <PaymentCard key={p.paymentId} payment={p} />)
            )}

            {/* Totals — paid sum comes from the server; outstanding is
                total − paid in exact BigInt, only when meaningful. */}
            {invoice !== null && paymentsQ.data !== undefined ? (
              <View
                style={[
                  styles.card,
                  { borderColor: theme.line, backgroundColor: theme.bgElevated },
                ]}
                testID="invoice-totals"
              >
                <KeyValue
                  label={t(STR.totalAmount)}
                  value={amountText(invoice.amountPaisa, lang)}
                />
                <KeyValue
                  label={t(STR.paidSoFar)}
                  value={amountText(paymentsQ.data.totalPaidPaisa, lang)}
                />
                {outstanding !== null ? (
                  <View style={[styles.balanceRow, { borderTopColor: theme.line }]}>
                    <Text style={[styles.balanceLabel, { color: theme.fg }]}>
                      {t(STR.outstanding)}
                    </Text>
                    <Text style={[styles.balanceValue, { color: theme.fg }]}>
                      {formatPaisa(outstanding, lang)}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </>
        )}

        <Text style={[styles.footnote, { color: theme.fgSubtle }]}>
          {t(STR.viewOnlyNotice)}
        </Text>
      </ScrollView>
    </ScreenScaffold>
  );
}

function LineItemRow({
  item,
  first,
}: {
  item: InvoiceLineItem;
  first: boolean;
}): React.ReactElement {
  const { lang, t } = useT();
  const theme = useTheme();
  const unit = parsePaisa(item.unitAmountPaisa);
  const total = lineTotalPaisa(item.quantity, item.unitAmountPaisa);
  const qtyLine =
    typeof item.quantity === 'number' && unit !== null
      ? `${item.quantity} × ${formatPaisa(unit, lang)}`
      : unit !== null
        ? formatPaisa(unit, lang)
        : null;

  return (
    <View
      style={[
        styles.itemRow,
        { borderTopColor: theme.line },
        first ? styles.itemRowFirst : null,
      ]}
    >
      <View style={styles.itemMain}>
        <Text style={[styles.itemName, { color: theme.fg }]}>
          {item.description !== undefined && item.description.length > 0
            ? item.description
            : t(STR.itemFallback)}
        </Text>
        {item.code !== null && item.code !== undefined && item.code.length > 0 ? (
          <Text style={[styles.itemMeta, { color: theme.fgSubtle }]}>
            {item.code}
          </Text>
        ) : null}
        {qtyLine !== null ? (
          <Text style={[styles.itemMeta, { color: theme.fgSubtle }]}>
            {qtyLine}
          </Text>
        ) : null}
      </View>
      {total !== null ? (
        <Text style={[styles.itemTotal, { color: theme.fg }]}>
          {formatPaisa(total, lang)}
        </Text>
      ) : null}
    </View>
  );
}

function PaymentCard({ payment }: { payment: PaymentListItem }): React.ReactElement {
  const { lang, t } = useT();
  const theme = useTheme();
  const subtitle = joinParts([
    payment.paidAt !== undefined ? formatDateTime(payment.paidAt, lang) : undefined,
    payment.reference !== null &&
    payment.reference !== undefined &&
    payment.reference.length > 0
      ? `${t(STR.reference)}: ${payment.reference}`
      : undefined,
  ]);

  return (
    <View
      style={[
        styles.card,
        { borderColor: theme.line, backgroundColor: theme.bgElevated },
      ]}
      testID={`payment-${payment.paymentId}`}
    >
      <View style={styles.cardHead}>
        <Text style={[styles.cardTitle, { color: theme.fg }]}>
          {payment.paymentMethod !== undefined
            ? t(paymentMethodLabel(payment.paymentMethod))
            : t(STR.paymentFallbackTitle)}
        </Text>
        <Text style={[styles.paymentAmount, { color: theme.fg }]}>
          {amountText(payment.amountPaisa, lang)}
        </Text>
      </View>
      {subtitle.length > 0 ? (
        <Text style={[styles.itemMeta, { color: theme.fgSubtle }]}>
          {subtitle}
        </Text>
      ) : null}
      {payment.notes !== null &&
      payment.notes !== undefined &&
      payment.notes.length > 0 ? (
        <Text style={[styles.note, { color: theme.fgMuted }]}>{payment.notes}</Text>
      ) : null}
    </View>
  );
}

function KeyValue({ label, value }: { label: string; value: string }): React.ReactElement {
  const theme = useTheme();
  return (
    <View style={styles.kvRow}>
      <Text style={[styles.kvLabel, { color: theme.fgSubtle }]}>{label}</Text>
      <Text style={[styles.kvValue, { color: theme.fg }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: spacing.xl, alignItems: 'center' },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardTitle: { fontSize: fontSize.body, fontWeight: '600', flexShrink: 1 },
  amount: { fontSize: fontSize.h2, fontWeight: '700' },
  sectionTitle: { fontSize: fontSize.h3, fontWeight: '700', marginTop: spacing.sm },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  itemRowFirst: { borderTopWidth: 0, paddingTop: 0, marginTop: 0 },
  itemMain: { flex: 1, gap: 2 },
  itemName: { fontSize: fontSize.bodySm, fontWeight: '600' },
  itemMeta: { fontSize: fontSize.caption },
  itemTotal: { fontSize: fontSize.body, fontWeight: '700' },
  paymentAmount: { fontSize: fontSize.body, fontWeight: '700' },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  balanceLabel: { fontSize: fontSize.body, fontWeight: '600' },
  balanceValue: { fontSize: fontSize.h3, fontWeight: '700' },
  note: { fontSize: fontSize.bodySm, lineHeight: 20 },
  footnote: { fontSize: fontSize.caption, lineHeight: 18, textAlign: 'center' },
  kvRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  kvLabel: { fontSize: fontSize.bodySm, minWidth: 110 },
  kvValue: { fontSize: fontSize.bodySm, flex: 1 },
});
