// Doctor lab orders — the Orders tab landing.
//
//   Reads: GET /api/v1/doctors/me/lab-orders     (authored orders, newest first)
//          GET /api/v1/doctors/me/results-inbox  (shared query — the badge
//              count on the inbox link; unseen results are clinical risk,
//              so the count sits at the very top of the tab)
//
// Row = tests · patient ref · ordered date · status pill (+ priority pill
// when URGENT/STAT). New-order entry point lives here too.

import { useRouter } from 'expo-router';
import * as React from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import {
  useAckedResults,
  useMyLabOrders,
  useResultsInbox,
} from '@/features/doctor-orders/hooks';
import {
  countUnacknowledged,
  formatNumber,
  joinParts,
  orderStatusTone,
  priorityTone,
  shortPatientRef,
  testNamesLine,
} from '@/features/doctor-orders/logic';
import {
  ORD_STR,
  awaitingReviewLabel,
  orderStatusLabel,
  priorityLabel,
} from '@/features/doctor-orders/strings';
import type { MyLabOrderRow } from '@/features/doctor-orders/types';
import { COMMON, formatDate, formatDateTime, useT } from '@/i18n';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { FreshnessBadge } from '@/ui/FreshnessBadge';
import { ListRow } from '@/ui/ListRow';
import { ScreenScaffold } from '@/ui/ScreenScaffold';
import { SectionHeader } from '@/ui/SectionHeader';
import { StatusPill } from '@/ui/StatusPill';
import { useTheme } from '@/ui/theme';
import { fontSize, spacing } from '@/ui/tokens';

export default function DoctorOrdersIndex(): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  const { lang, t } = useT();

  const ordersQ = useMyLabOrders();
  const inboxQ = useResultsInbox();
  const acked = useAckedResults((s) => s.ids);

  const orders = React.useMemo(
    () =>
      (ordersQ.data?.orders ?? []).filter(
        (o): o is MyLabOrderRow =>
          typeof o?.labOrderId === 'string' && o.labOrderId.length > 0,
      ),
    [ordersQ.data],
  );

  // Unacknowledged count — never fabricate a zero: while the inbox is
  // loading say so, and when it could not be read at all say THAT.
  const inboxRows = inboxQ.data?.orders;
  let unackCount: number | null = null;
  let inboxSubtitle: string;
  if (inboxRows !== undefined && inboxRows !== null) {
    unackCount = countUnacknowledged(inboxRows, acked);
    inboxSubtitle =
      unackCount > 0 ? t(ORD_STR.inboxLinkHint) : t(ORD_STR.inboxAllReviewed);
  } else if (inboxQ.isLoading || inboxQ.isRefreshing) {
    inboxSubtitle = t(COMMON.loading);
  } else {
    inboxSubtitle = t(ORD_STR.inboxCountUnknown);
  }

  const renderOrder = ({ item }: { item: MyLabOrderRow }): React.ReactElement => {
    const testsLine = testNamesLine(item.tests);
    const title =
      testsLine.length > 0
        ? testsLine
        : item.orderedAt !== undefined
          ? formatDate(item.orderedAt, lang)
          : item.labOrderId;
    const subtitle = joinParts([
      item.patientId !== undefined && item.patientId.length > 0
        ? `${t(ORD_STR.patientRef)} ${shortPatientRef(item.patientId)}`
        : null,
      item.orderedAt !== undefined
        ? `${t(ORD_STR.orderedPrefix)} ${formatDateTime(item.orderedAt, lang)}`
        : null,
    ]);
    const showPriority = item.priority === 'STAT' || item.priority === 'URGENT';
    return (
      <ListRow
        title={title}
        {...(subtitle.length > 0 ? { subtitle } : {})}
        chevron={false}
        right={
          <View style={styles.trailingPills}>
            {showPriority ? (
              <StatusPill
                label={t(priorityLabel(String(item.priority)))}
                tone={priorityTone(String(item.priority))}
              />
            ) : null}
            <StatusPill
              label={t(orderStatusLabel(item.status !== undefined ? String(item.status) : undefined))}
              tone={orderStatusTone(item.status !== undefined ? String(item.status) : undefined)}
            />
          </View>
        }
      />
    );
  };

  const header = (
    <View style={styles.headerBlock}>
      {/* Results inbox — the priority surface; unseen results are risk. */}
      <ListRow
        title={t(ORD_STR.inboxLink)}
        subtitle={inboxSubtitle}
        {...(unackCount !== null && unackCount > 0
          ? {
              right: (
                <StatusPill
                  label={t(awaitingReviewLabel(formatNumber(unackCount, lang)))}
                  tone="danger"
                />
              ),
            }
          : {})}
        accessibilityLabel={joinParts([t(ORD_STR.inboxLink), inboxSubtitle])}
        testID="orders-inbox-link"
        onPress={() => router.push('/(doctor)/orders/inbox' as never)}
      />

      <Button
        title={t(ORD_STR.newOrder)}
        accessibilityLabel={t(ORD_STR.newOrder)}
        testID="new-order"
        onPress={() => router.push('/(doctor)/orders/new' as never)}
      />

      <Text accessibilityRole="header" style={[styles.listTitle, { color: theme.fg }]}>
        {t(ORD_STR.myOrders)}
      </Text>
    </View>
  );

  let body: React.ReactElement;
  if (ordersQ.isLoading) {
    body = (
      <View style={styles.center}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  } else if (ordersQ.error && orders.length === 0) {
    body = (
      <EmptyState
        title={t(COMMON.genericError)}
        message={ordersQ.error.message}
        actionLabel={t(COMMON.retry)}
        onAction={ordersQ.refetch}
      />
    );
  } else if (orders.length === 0) {
    body = <EmptyState title={t(ORD_STR.noOrders)} message={t(ORD_STR.noOrdersHint)} />;
  } else {
    body = (
      <FlatList
        data={orders}
        keyExtractor={(o) => o.labOrderId}
        contentContainerStyle={styles.list}
        renderItem={renderOrder}
      />
    );
  }

  return (
    <ScreenScaffold phi>
      <SectionHeader
        title={t(ORD_STR.ordersTitle)}
        right={<FreshnessBadge fetchedAt={ordersQ.fetchedAt} />}
      />
      {header}
      {body}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  headerBlock: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  listTitle: {
    fontSize: fontSize.h3,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  trailingPills: { alignItems: 'flex-end', gap: spacing.xs },
});
