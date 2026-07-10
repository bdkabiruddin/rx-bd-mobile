// Patient billing — my bills. Each row shows the bill total in taka
// (exact BigInt paisa via the shared formatter), what it settles
// (appointment / pharmacy / lab / admission), the issue date + item
// count, and the lifecycle StatusPill (paid / partially paid / due /
// overdue). Rows open the bill detail. VIEW-ONLY in Phase 2 — no
// payment initiation from mobile. Honest loading/error/empty states
// throughout — never fabricated data.
//
// Contract: GET /api/v1/patients/{id}/invoices (self-read) —
// ListInvoicesByPatientResult mirrored in ../../../src/features/
// patient-billing/types.ts. A consent-gate deny (403) renders a
// dedicated explanation instead of a generic failure.

import { useRouter } from 'expo-router';
import * as React from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { usePatientInvoices } from '@/features/patient-billing/hooks';
import {
  invoiceStatusTone,
  isConsentDenied,
  joinParts,
  parsePaisa,
} from '@/features/patient-billing/logic';
import {
  STR,
  invoiceStatusLabel,
  itemCountLabel,
  sourceLabel,
} from '@/features/patient-billing/strings';
import { COMMON, formatDate, formatPaisa, useT, type Language } from '@/i18n';
import { EmptyState } from '@/ui/EmptyState';
import { FreshnessBadge } from '@/ui/FreshnessBadge';
import { ListRow } from '@/ui/ListRow';
import { ScreenScaffold } from '@/ui/ScreenScaffold';
import { SectionHeader } from '@/ui/SectionHeader';
import { StatusPill } from '@/ui/StatusPill';
import { spacing } from '@/ui/tokens';

/** Wire paisa → "৳1,234.56", or an honest "—" when unparseable. */
function amountText(value: string | number | undefined, lang: Language): string {
  const paisa = parsePaisa(value);
  return paisa === null ? '—' : formatPaisa(paisa, lang);
}

export default function PatientBillingHome(): React.ReactElement {
  const { lang, t } = useT();
  const router = useRouter();

  const { data, fetchedAt, isLoading, error, refetch } = usePatientInvoices();
  const invoices = data?.invoices;

  return (
    <ScreenScaffold phi>
      <SectionHeader
        title={t(STR.myBills)}
        right={<FreshnessBadge fetchedAt={fetchedAt} />}
      />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : error && !invoices ? (
        isConsentDenied(error.code) ? (
          <EmptyState
            title={t(STR.consentDenied)}
            message={t(STR.consentDeniedHint)}
            actionLabel={t(COMMON.retry)}
            onAction={refetch}
          />
        ) : (
          <EmptyState
            title={t(COMMON.genericError)}
            message={error.message}
            actionLabel={t(COMMON.retry)}
            onAction={refetch}
          />
        )
      ) : !invoices || invoices.length === 0 ? (
        <EmptyState title={t(STR.noInvoices)} message={t(STR.noInvoicesHint)} />
      ) : (
        <FlatList
          data={invoices}
          keyExtractor={(inv) => inv.invoiceId}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const title = amountText(item.amountPaisa, lang);
            const subtitle = joinParts([
              t(sourceLabel(item.source)),
              item.createdAt !== undefined
                ? formatDate(item.createdAt, lang)
                : undefined,
              typeof item.itemCount === 'number' && item.itemCount > 0
                ? t(itemCountLabel(item.itemCount))
                : undefined,
            ]);
            const statusText = t(invoiceStatusLabel(item.status));
            return (
              <ListRow
                title={title}
                {...(subtitle.length > 0 ? { subtitle } : {})}
                right={
                  <StatusPill
                    label={statusText}
                    tone={invoiceStatusTone(item.status)}
                  />
                }
                accessibilityLabel={`${t(sourceLabel(item.source))}, ${title}, ${statusText}`}
                testID={`invoice-row-${item.invoiceId}`}
                onPress={() =>
                  router.push(`/(patient)/billing/${item.invoiceId}` as never)
                }
              />
            );
          }}
        />
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
});
