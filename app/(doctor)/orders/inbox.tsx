// Doctor results inbox — the priority surface: unseen results are
// clinical risk. Unacknowledged released results, critical first then
// newest; open → full result detail; Acknowledge removes it from the list.
//
//   GET  /api/v1/doctors/me/results-inbox         list (shared query with
//        the orders index badge; no ack flag on the wire — the
//        session-local server-confirmed ack set filters the list)
//   GET  /api/v1/lab-results/{id}                 detail (via ResultDetail)
//   POST /api/v1/lab-results/{id}/acknowledge     acknowledge (via ResultDetail)
//
// Tablet (≥768dp): MasterDetail — list master, result detail pane.
// Phone: selection swaps the list for the inline detail (Back returns).

import * as React from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { ResultDetail } from '@/features/doctor-orders/ResultDetail';
import { useAckedResults, useResultsInbox } from '@/features/doctor-orders/hooks';
import {
  inboxTestsLine,
  joinParts,
  patientRefLabel,
  visibleInboxRows,
} from '@/features/doctor-orders/logic';
import { ORD_STR } from '@/features/doctor-orders/strings';
import type { ResultsInboxRow } from '@/features/doctor-orders/types';
import { COMMON, formatDateTime, useT } from '@/i18n';
import { EmptyState } from '@/ui/EmptyState';
import { FreshnessBadge } from '@/ui/FreshnessBadge';
import { ListRow } from '@/ui/ListRow';
import { MasterDetail } from '@/ui/MasterDetail';
import { ScreenScaffold } from '@/ui/ScreenScaffold';
import { SectionHeader } from '@/ui/SectionHeader';
import { StatusPill } from '@/ui/StatusPill';
import { useBreakpoint } from '@/ui/useBreakpoint';
import { useTheme } from '@/ui/theme';
import { fontSize, spacing } from '@/ui/tokens';

export default function DoctorResultsInbox(): React.ReactElement {
  const theme = useTheme();
  const { lang, t } = useT();
  const { isTablet } = useBreakpoint();

  const inboxQ = useResultsInbox();
  const acked = useAckedResults((s) => s.ids);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const rows = React.useMemo(
    () => visibleInboxRows(inboxQ.data?.orders, acked),
    [inboxQ.data, acked],
  );

  const clearSelection = React.useCallback(() => setSelectedId(null), []);

  const renderRow = ({ item }: { item: ResultsInboxRow }): React.ReactElement => {
    const testsLine = inboxTestsLine(item.tests);
    const ref = patientRefLabel(item);
    const title = testsLine.length > 0 ? testsLine : ref;
    const subtitle = joinParts([
      ref,
      item.latestResultAt !== undefined
        ? `${t(ORD_STR.reportedPrefix)} ${formatDateTime(item.latestResultAt, lang)}`
        : null,
    ]);
    return (
      <ListRow
        title={title}
        {...(subtitle.length > 0 ? { subtitle } : {})}
        {...(item.hasCritical === true
          ? { right: <StatusPill label={t(ORD_STR.critical)} tone="danger" /> }
          : {})}
        accessibilityLabel={joinParts([
          t(ORD_STR.openResult),
          title,
          item.hasCritical === true ? t(ORD_STR.critical) : null,
        ])}
        testID={`inbox-row-${item.latestResultId ?? item.labOrderId}`}
        onPress={() => {
          if (item.latestResultId !== undefined) setSelectedId(item.latestResultId);
        }}
      />
    );
  };

  let listBody: React.ReactElement;
  if (inboxQ.isLoading) {
    listBody = (
      <View style={styles.center}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  } else if (inboxQ.error && rows.length === 0 && !inboxQ.data) {
    listBody = (
      <EmptyState
        title={t(COMMON.genericError)}
        message={inboxQ.error.message}
        actionLabel={t(COMMON.retry)}
        onAction={inboxQ.refetch}
      />
    );
  } else if (rows.length === 0) {
    listBody = (
      <EmptyState title={t(ORD_STR.inboxEmpty)} message={t(ORD_STR.inboxEmptyHint)} />
    );
  } else {
    listBody = (
      <FlatList
        data={rows}
        keyExtractor={(r) => r.latestResultId ?? r.labOrderId}
        contentContainerStyle={styles.list}
        renderItem={renderRow}
      />
    );
  }

  const master = (
    <View style={styles.master}>
      <SectionHeader
        title={t(ORD_STR.inboxTitle)}
        right={<FreshnessBadge fetchedAt={inboxQ.fetchedAt} />}
      />
      <Text style={[styles.hint, { color: theme.fgMuted }]}>{t(ORD_STR.inboxHint)}</Text>
      {listBody}
    </View>
  );

  // ── Tablet: list master + detail pane ───────────────────────────────────
  if (isTablet) {
    return (
      <ScreenScaffold phi>
        <MasterDetail
          master={master}
          detail={
            selectedId !== null ? (
              // key: switching results must remount the detail (fresh cache
              // seed + fresh note draft — no cross-result bleed).
              <ResultDetail
                key={selectedId}
                resultId={selectedId}
                onAcknowledged={clearSelection}
              />
            ) : null
          }
          emptyDetail={
            <EmptyState
              title={t(ORD_STR.selectResult)}
              message={t(ORD_STR.selectResultHint)}
            />
          }
        />
      </ScreenScaffold>
    );
  }

  // ── Phone: selection swaps to the inline detail ─────────────────────────
  if (selectedId !== null) {
    return (
      <ScreenScaffold phi>
        <ResultDetail
          key={selectedId}
          resultId={selectedId}
          onAcknowledged={clearSelection}
          onBack={clearSelection}
        />
      </ScreenScaffold>
    );
  }

  return <ScreenScaffold phi>{master}</ScreenScaffold>;
}

const styles = StyleSheet.create({
  master: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  hint: {
    fontSize: fontSize.bodySm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
});
