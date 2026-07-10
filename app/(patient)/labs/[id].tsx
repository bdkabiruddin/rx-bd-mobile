// Lab order detail — the order summary (tests, ordered date, priority,
// status, centre notes) plus every result the lab has RELEASED for it.
// Analyte rows render value + unit + reference range, and an
// abnormality StatusPill ONLY when the backend supplied a flag — the
// app never computes normal/abnormal itself.
//
// Contracts:
//   - order summary comes from the shared patient:labs:orders cache
//     (GET /api/v1/patients/{id}/lab-orders — the backend exposes no
//     patient-readable single-order GET);
//   - results from GET /api/v1/lab-orders/{id}/lab-results, which the
//     server already scopes to RELEASED rows for patient viewers.
//
// No Acknowledge button: POST /api/v1/lab-results/{id}/acknowledge is
// the ORDERING DOCTOR's review action (roles DOCTOR/SUPER_ADMIN); the
// backend has no patient-acknowledgement endpoint today (gap-noted).

import { useLocalSearchParams } from 'expo-router';
import * as React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useLabOrderResults, usePatientLabOrders } from '@/features/patient-labs/hooks';
import {
  flagTone,
  normalizeResultPayload,
  orderStatusTone,
  resultStatusTone,
  testNamesLine,
  type AnalyteRow,
} from '@/features/patient-labs/logic';
import {
  STR,
  flagLabel,
  orderStatusLabel,
  priorityLabel,
  resultStatusLabel,
} from '@/features/patient-labs/strings';
import type { LabResultListItem } from '@/features/patient-labs/types';
import { COMMON, formatDate, formatDateTime, useT } from '@/i18n';
import { EmptyState } from '@/ui/EmptyState';
import { FreshnessBadge } from '@/ui/FreshnessBadge';
import { ScreenScaffold } from '@/ui/ScreenScaffold';
import { SectionHeader } from '@/ui/SectionHeader';
import { StatusPill } from '@/ui/StatusPill';
import { useTheme } from '@/ui/theme';
import { fontSize, radius, spacing } from '@/ui/tokens';

export default function LabOrderDetailScreen(): React.ReactElement {
  const { lang, t } = useT();
  const theme = useTheme();
  const params = useLocalSearchParams<{ id: string }>();
  const orderId =
    typeof params.id === 'string' && params.id.length > 0 ? params.id : undefined;

  const ordersQ = usePatientLabOrders();
  const resultsQ = useLabOrderResults(orderId);

  const order = React.useMemo(
    () => ordersQ.data?.orders?.find((o) => o.labOrderId === orderId),
    [ordersQ.data, orderId],
  );
  const results = resultsQ.data?.results;

  const names = testNamesLine(order?.tests);
  const orderTitle = names.length > 0 ? names : t(STR.orderFallbackTitle);

  // Malformed/absent route param — nothing can load; say so honestly.
  if (orderId === undefined) {
    return (
      <ScreenScaffold phi>
        <SectionHeader title={t(STR.orderDetails)} />
        <EmptyState title={t(STR.orderNotFound)} />
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold phi>
      <SectionHeader
        title={t(STR.orderDetails)}
        right={<FreshnessBadge fetchedAt={resultsQ.fetchedAt} />}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Order summary — resolved from the shared orders cache. */}
        {ordersQ.isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        ) : ordersQ.error && !ordersQ.data ? (
          <EmptyState
            title={t(COMMON.genericError)}
            message={ordersQ.error.message}
            actionLabel={t(COMMON.retry)}
            onAction={ordersQ.refetch}
          />
        ) : !order ? (
          <EmptyState title={t(STR.orderNotFound)} />
        ) : (
          <View
            style={[
              styles.card,
              { borderColor: theme.line, backgroundColor: theme.bgElevated },
            ]}
          >
            <View style={styles.cardHead}>
              <Text style={[styles.cardTitle, { color: theme.fg }]}>
                {orderTitle}
              </Text>
              <StatusPill
                label={t(orderStatusLabel(order.status))}
                tone={orderStatusTone(order.status)}
              />
            </View>
            {order.orderedAt !== undefined ? (
              <KeyValue
                label={t(STR.orderedOn)}
                value={formatDate(order.orderedAt, lang)}
              />
            ) : null}
            {order.priority !== undefined ? (
              <KeyValue
                label={t(STR.priority)}
                value={t(priorityLabel(order.priority))}
              />
            ) : null}
            {order.notes !== null && order.notes !== undefined && order.notes.length > 0 ? (
              <KeyValue label={t(STR.notes)} value={order.notes} />
            ) : null}
          </View>
        )}

        {/* Released results. */}
        <Text style={[styles.sectionTitle, { color: theme.fg }]}>
          {t(STR.results)}
        </Text>
        {resultsQ.isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        ) : resultsQ.error && !results ? (
          <EmptyState
            title={t(COMMON.genericError)}
            message={resultsQ.error.message}
            actionLabel={t(COMMON.retry)}
            onAction={resultsQ.refetch}
          />
        ) : !results || results.length === 0 ? (
          <EmptyState
            title={t(STR.noResultsYet)}
            message={t(STR.noResultsYetHint)}
          />
        ) : (
          results.map((item) => <ResultCard key={item.resultId} item={item} />)
        )}
      </ScrollView>
    </ScreenScaffold>
  );
}

function ResultCard({ item }: { item: LabResultListItem }): React.ReactElement {
  const { lang, t } = useT();
  const theme = useTheme();
  const normalized = React.useMemo(
    () => normalizeResultPayload(item.payload),
    [item.payload],
  );

  return (
    <View
      style={[
        styles.card,
        { borderColor: theme.line, backgroundColor: theme.bgElevated },
      ]}
      testID={`lab-result-${item.resultId}`}
    >
      <View style={styles.cardHead}>
        <Text style={[styles.cardTitle, { color: theme.fg }]}>
          {item.reportedAt !== undefined
            ? formatDateTime(item.reportedAt, lang)
            : t(STR.resultFallbackTitle)}
        </Text>
        <StatusPill
          label={t(resultStatusLabel(item.status))}
          tone={resultStatusTone(item.status)}
        />
      </View>

      {normalized.kind === 'analytes' ? (
        <View style={styles.analytes}>
          {normalized.panel !== null ? (
            <Text style={[styles.panelName, { color: theme.fgMuted }]}>
              {normalized.panel}
            </Text>
          ) : null}
          {normalized.rows.map((row, idx) => (
            <AnalyteLine key={`${row.analyte ?? 'analyte'}-${idx}`} row={row} />
          ))}
        </View>
      ) : normalized.kind === 'text' ? (
        <View style={styles.analytes}>
          {normalized.analyte !== null ? (
            <Text style={[styles.panelName, { color: theme.fgMuted }]}>
              {normalized.analyte}
            </Text>
          ) : null}
          <Text style={[styles.textResult, { color: theme.fg }]}>
            {normalized.text}
          </Text>
        </View>
      ) : (
        <Text style={[styles.note, { color: theme.fgMuted }]}>
          {t(STR.unsupportedFormat)}
        </Text>
      )}

      {item.releasedAt !== null && item.releasedAt !== undefined ? (
        <KeyValue
          label={t(STR.releasedOn)}
          value={formatDateTime(item.releasedAt, lang)}
        />
      ) : null}
    </View>
  );
}

function AnalyteLine({ row }: { row: AnalyteRow }): React.ReactElement {
  const { t } = useT();
  const theme = useTheme();
  const tone = flagTone(row.flag);
  const valueText = row.unit !== null ? `${row.value} ${row.unit}` : row.value;

  return (
    <View style={[styles.analyteRow, { borderTopColor: theme.line }]}>
      <View style={styles.analyteMain}>
        <Text style={[styles.analyteName, { color: theme.fg }]}>
          {row.analyte ?? t(STR.resultFallbackTitle)}
        </Text>
        {row.refRange !== null ? (
          <Text style={[styles.analyteMeta, { color: theme.fgSubtle }]}>
            {`${t(STR.refRange)}: ${row.refRange}`}
          </Text>
        ) : null}
        {row.comment !== null ? (
          <Text style={[styles.analyteMeta, { color: theme.fgSubtle }]}>
            {row.comment}
          </Text>
        ) : null}
      </View>
      <View style={styles.analyteTrailing}>
        <Text style={[styles.analyteValue, { color: theme.fg }]}>
          {valueText}
        </Text>
        {tone !== null && row.flag !== null ? (
          <StatusPill label={t(flagLabel(row.flag))} tone={tone} />
        ) : null}
      </View>
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
    marginBottom: spacing.xs,
  },
  cardTitle: { fontSize: fontSize.body, fontWeight: '600', flexShrink: 1 },
  sectionTitle: { fontSize: fontSize.h3, fontWeight: '700', marginTop: spacing.sm },
  analytes: { gap: spacing.xs },
  panelName: { fontSize: fontSize.bodySm, fontWeight: '600' },
  analyteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  analyteMain: { flex: 1, gap: 2 },
  analyteName: { fontSize: fontSize.bodySm, fontWeight: '600' },
  analyteMeta: { fontSize: fontSize.caption },
  analyteTrailing: { alignItems: 'flex-end', gap: spacing.xs },
  analyteValue: { fontSize: fontSize.body, fontWeight: '700' },
  textResult: { fontSize: fontSize.bodySm, lineHeight: 20 },
  note: { fontSize: fontSize.bodySm, lineHeight: 20 },
  kvRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  kvLabel: { fontSize: fontSize.bodySm, minWidth: 110 },
  kvValue: { fontSize: fontSize.bodySm, flex: 1 },
});
