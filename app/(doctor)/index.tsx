// Doctor Today — the doctor's landing tab. Today at a glance: the
// remaining appointments for the Dhaka calendar day in time order, plus
// quick links into the queue, the patient panel, and schedule management.
//
//   Read: GET /api/v1/appointments/upcoming?limit=100 (ONE cached query —
//         the handler's DOCTOR branch pins the scope to the caller; rows
//         are filtered to today client-side).
//
// The upcoming projection carries ids only (no patient display name, no
// chamber name) — rows show the time, visit type, facility type and a
// clearly-labelled short patient-id reference. Nothing is fabricated.

import { useFocusEffect, useRouter } from 'expo-router';
import * as React from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { AppointmentActionSheet } from '@/features/doctor-schedule/AppointmentActionSheet';
import { useDoctorUpcoming } from '@/features/doctor-schedule/hooks';
import {
  appointmentStatusTone,
  dhakaMinuteOfDay,
  filterTodays,
  formatMinuteOfDay,
  formatNumber,
  shortPatientRef,
} from '@/features/doctor-schedule/logic';
import {
  SCHED_STR,
  appointmentStatusLabel,
  appointmentTypeLabel,
  facilityTypeLabel,
} from '@/features/doctor-schedule/strings';
import type { DoctorUpcomingAppointment } from '@/features/doctor-schedule/types';
import { COMMON, useT } from '@/i18n';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { FreshnessBadge } from '@/ui/FreshnessBadge';
import { ListRow } from '@/ui/ListRow';
import { ScreenScaffold } from '@/ui/ScreenScaffold';
import { SectionHeader } from '@/ui/SectionHeader';
import { StatusPill } from '@/ui/StatusPill';
import { useTheme } from '@/ui/theme';
import { fontSize, spacing } from '@/ui/tokens';

export default function DoctorToday(): React.ReactElement {
  const { lang, t } = useT();
  const router = useRouter();
  const theme = useTheme();

  const { data, fetchedAt, isLoading, error, refetch } = useDoctorUpcoming();

  // Tapping a row opens the status action sheet (check-in / start / complete /
  // no-show / cancel). The doctor's landing is no longer read-only.
  const [active, setActive] = React.useState<DoctorUpcomingAppointment | null>(null);

  // Refresh the "today" boundary whenever the tab regains focus so an
  // overnight app stays honest about which day it is.
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  useFocusEffect(
    React.useCallback(() => {
      setNowMs(Date.now());
    }, []),
  );

  const appointments = data?.appointments;
  const todays = React.useMemo(
    () => filterTodays(appointments ?? [], nowMs),
    [appointments, nowMs],
  );

  const rowTitle = (item: DoctorUpcomingAppointment): string => {
    const minute = dhakaMinuteOfDay(item.scheduledAt);
    const time = minute !== null ? formatMinuteOfDay(minute, lang) : item.scheduledAt;
    const type =
      item.appointmentType !== undefined
        ? ` · ${t(appointmentTypeLabel(String(item.appointmentType)))}`
        : '';
    return `${time}${type}`;
  };

  const rowSubtitle = (item: DoctorUpcomingAppointment): string => {
    const parts: string[] = [];
    if (item.facilityType !== undefined) {
      parts.push(t(facilityTypeLabel(String(item.facilityType))));
    }
    const ref = shortPatientRef(item.patientId);
    if (ref !== null) parts.push(`${t(SCHED_STR.patientRef)} ${ref}`);
    return parts.join(' · ');
  };

  const quickLinks = (
    <View style={styles.footer}>
      <Button
        title={t(SCHED_STR.viewQueue)}
        accessibilityLabel={t(SCHED_STR.viewQueue)}
        onPress={() => router.push('/(doctor)/queue')}
      />
      <Button
        title={t(SCHED_STR.myPatients)}
        variant="secondary"
        accessibilityLabel={t(SCHED_STR.myPatients)}
        onPress={() => router.push('/(doctor)/patients')}
      />
      <Button
        title={t(SCHED_STR.manageSchedule)}
        variant="secondary"
        accessibilityLabel={t(SCHED_STR.manageSchedule)}
        testID="manage-schedule"
        onPress={() => router.push('/(doctor)/schedule')}
      />
    </View>
  );

  return (
    <ScreenScaffold phi>
      <SectionHeader
        title={t(SCHED_STR.todayTitle)}
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
      ) : (
        <FlatList
          data={todays}
          keyExtractor={(a) => a.appointmentId}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            todays.length > 0 ? (
              <Text style={[styles.listLabel, { color: theme.fgMuted }]}>
                {t(SCHED_STR.remainingToday)}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              title={t(SCHED_STR.freeDay)}
              message={t(SCHED_STR.freeDayHint)}
            />
          }
          renderItem={({ item }) => (
            <ListRow
              title={rowTitle(item)}
              subtitle={rowSubtitle(item)}
              onPress={() => setActive(item)}
              {...(item.durationMinutes !== undefined
                ? {
                    meta: `${formatNumber(item.durationMinutes, lang)} ${t(SCHED_STR.minutesSuffix)}`,
                  }
                : {})}
              right={
                <StatusPill
                  label={t(appointmentStatusLabel(String(item.status)))}
                  tone={appointmentStatusTone(String(item.status))}
                />
              }
            />
          )}
          ListFooterComponent={quickLinks}
        />
      )}

      {active ? (
        <AppointmentActionSheet
          appointmentId={active.appointmentId}
          status={String(active.status)}
          heading={rowTitle(active)}
          onClose={() => setActive(null)}
        />
      ) : null}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  listLabel: { fontSize: fontSize.bodySm, fontWeight: '600', marginBottom: spacing.xs },
  footer: { marginTop: spacing.lg, gap: spacing.sm },
});
