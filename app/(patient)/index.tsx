// Patient home — upcoming appointments (real /appointments/upcoming
// contract), quick entry to booking and the live queue. Demonstrates the
// foundation end-to-end: PHI screenshot guard + cached query + freshness
// badge + honest empty/loading/error states (NEVER fabricated data).
//
// Response shape mirrors ListUpcomingAppointmentsResult
// (backend src/modules/appointment — UpcomingAppointmentView).

import { useRouter } from 'expo-router';
import * as React from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { useCachedQuery } from '@/api/useCachedQuery';
import { useSession } from '@/auth/sessionStore';
import { COMMON, formatDateTime, useT } from '@/i18n';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { FreshnessBadge } from '@/ui/FreshnessBadge';
import { ListRow } from '@/ui/ListRow';
import { ScreenScaffold } from '@/ui/ScreenScaffold';
import { SectionHeader } from '@/ui/SectionHeader';
import { spacing } from '@/ui/tokens';

interface UpcomingAppointmentLite {
  appointmentId: string;
  scheduledAt: string;
  status: string;
  appointmentType?: string;
  facilityType?: string;
}

interface UpcomingAppointmentsPayload {
  appointments: UpcomingAppointmentLite[];
}

export default function PatientHome(): React.ReactElement {
  const { lang, t } = useT();
  const router = useRouter();
  const userId = useSession((s) => s.userId);

  const { data, fetchedAt, isLoading, error, refetch } =
    useCachedQuery<UpcomingAppointmentsPayload>({
      key: 'patient:home:upcoming',
      path: '/api/v1/appointments/upcoming',
      ttlMs: 15 * 60 * 1000,
      isPhi: true,
      ...(userId !== null ? { userId } : {}),
    });

  const appointments = data?.appointments;

  return (
    <ScreenScaffold phi>
      <SectionHeader
        title={t({ en: 'Upcoming appointments', bn: 'আসন্ন অ্যাপয়েন্টমেন্ট' })}
        right={<FreshnessBadge fetchedAt={fetchedAt} />}
      />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : error && !appointments ? (
        <EmptyState
          title={t(COMMON.genericError)}
          message={error.message}
          actionLabel={t(COMMON.retry)}
          onAction={refetch}
        />
      ) : !appointments || appointments.length === 0 ? (
        <EmptyState
          title={t({ en: 'No upcoming appointments', bn: 'কোনো আসন্ন অ্যাপয়েন্টমেন্ট নেই' })}
          actionLabel={t({ en: 'Book an appointment', bn: 'অ্যাপয়েন্টমেন্ট বুক করুন' })}
          onAction={() => router.push('/(patient)/appointments/book')}
        />
      ) : (
        <FlatList
          data={appointments}
          keyExtractor={(a) => a.appointmentId}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <ListRow
              title={formatDateTime(item.scheduledAt, lang)}
              subtitle={item.status}
              onPress={() => router.push(`/(patient)/appointments/${item.appointmentId}` as never)}
            />
          )}
          ListFooterComponent={
            <View style={styles.footer}>
              <Button
                title={t({ en: 'Book an appointment', bn: 'অ্যাপয়েন্টমেন্ট বুক করুন' })}
                onPress={() => router.push('/(patient)/appointments/book')}
              />
              <Button
                title={t({ en: 'Live queue position', bn: 'লাইভ সিরিয়াল অবস্থান' })}
                variant="secondary"
                onPress={() => router.push('/(patient)/queue')}
              />
            </View>
          }
        />
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.lg, gap: spacing.sm },
  footer: { marginTop: spacing.lg, gap: spacing.sm },
});
