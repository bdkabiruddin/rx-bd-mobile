// Patient labs — my lab orders. Each row shows the ordered test names,
// the order date (plus priority when the centre marked it urgent/STAT)
// and the lifecycle StatusPill. Rows open the order detail with its
// released results. Honest loading/error/empty states throughout —
// never fabricated data.
//
// Contract: GET /api/v1/patients/{id}/lab-orders (self-read) —
// ListLabOrdersByPatientResult mirrored in ../../../src/features/
// patient-labs/types.ts.

import { useRouter } from 'expo-router';
import * as React from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { usePatientLabOrders } from '@/features/patient-labs/hooks';
import { joinParts, orderStatusTone, testNamesLine } from '@/features/patient-labs/logic';
import { STR, orderStatusLabel, priorityLabel, testCountLabel } from '@/features/patient-labs/strings';
import { COMMON, formatDate, useT } from '@/i18n';
import { EmptyState } from '@/ui/EmptyState';
import { FreshnessBadge } from '@/ui/FreshnessBadge';
import { ListRow } from '@/ui/ListRow';
import { ScreenScaffold } from '@/ui/ScreenScaffold';
import { SectionHeader } from '@/ui/SectionHeader';
import { StatusPill } from '@/ui/StatusPill';
import { spacing } from '@/ui/tokens';

export default function PatientLabsHome(): React.ReactElement {
  const { lang, t } = useT();
  const router = useRouter();

  const { data, fetchedAt, isLoading, error, refetch } = usePatientLabOrders();
  const orders = data?.orders;

  return (
    <ScreenScaffold phi>
      <SectionHeader
        title={t(STR.myLabTests)}
        right={<FreshnessBadge fetchedAt={fetchedAt} />}
      />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : error && !orders ? (
        <EmptyState
          title={t(COMMON.genericError)}
          message={error.message}
          actionLabel={t(COMMON.retry)}
          onAction={refetch}
        />
      ) : !orders || orders.length === 0 ? (
        <EmptyState title={t(STR.noLabOrders)} message={t(STR.noLabOrdersHint)} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.labOrderId}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const names = testNamesLine(item.tests);
            const title = names.length > 0 ? names : t(STR.orderFallbackTitle);
            const subtitle = joinParts([
              item.orderedAt !== undefined
                ? formatDate(item.orderedAt, lang)
                : undefined,
              item.tests !== undefined && item.tests.length > 1
                ? t(testCountLabel(item.tests.length))
                : undefined,
              item.priority !== undefined && item.priority !== 'ROUTINE'
                ? t(priorityLabel(item.priority))
                : undefined,
            ]);
            const statusText = t(orderStatusLabel(item.status));
            return (
              <ListRow
                title={title}
                {...(subtitle.length > 0 ? { subtitle } : {})}
                right={
                  <StatusPill
                    label={statusText}
                    tone={orderStatusTone(item.status)}
                  />
                }
                accessibilityLabel={`${title}, ${statusText}`}
                testID={`lab-order-row-${item.labOrderId}`}
                onPress={() =>
                  router.push(`/(patient)/labs/${item.labOrderId}` as never)
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
