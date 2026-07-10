// Patient appointments — upcoming + past list with a segmented filter.
//
// Read: GET /api/v1/patients/{userId}/appointments (metadata-only list
// projection: doctor/chamber names, schedule, status — verified against
// ListAppointmentsByPatientHandler). Partitioned client-side into
// upcoming (active status, not yet elapsed) and past.

import { useRouter } from 'expo-router';
import * as React from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { useCachedQuery } from '@/api/useCachedQuery';
import { useSession } from '@/auth/sessionStore';
import { COMMON, formatDateTime, useT } from '@/i18n';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { FreshnessBadge } from '@/ui/FreshnessBadge';
import { ListRow } from '@/ui/ListRow';
import { ScreenScaffold } from '@/ui/ScreenScaffold';
import { SectionHeader } from '@/ui/SectionHeader';
import { StatusPill } from '@/ui/StatusPill';
import { MIN_TOUCH_TARGET, fontSize, radius, spacing } from '@/ui/tokens';
import { useTheme } from '@/ui/theme';

import { partitionAppointments, statusTone } from '@/features/patient-appointments/logic';
import {
  APPT_STRINGS,
  FACILITY_LABELS,
  STATUS_LABELS,
  TYPE_LABELS,
  labelFor,
} from '@/features/patient-appointments/strings';
import type {
  PatientAppointmentListItem,
  PatientAppointmentsResult,
} from '@/features/patient-appointments/types';

type Segment = 'upcoming' | 'past';

export default function PatientAppointmentsList(): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  const { lang, t } = useT();
  const userId = useSession((s) => s.userId);
  const tenantId = useSession((s) => s.tenantId);
  const [segment, setSegment] = React.useState<Segment>('upcoming');

  const { data, fetchedAt, isLoading, error, refetch } =
    useCachedQuery<PatientAppointmentsResult>({
      key: 'patient:appointments:list',
      path: `/api/v1/patients/${encodeURIComponent(userId ?? '')}/appointments?limit=200`,
      ttlMs: 10 * 60 * 1000,
      isPhi: true,
      enabled: userId !== null,
      ...(tenantId !== null ? { tenantId } : {}),
      ...(userId !== null ? { userId } : {}),
    });

  // Partition relative to the fetch instant — data-derived, so the render
  // stays pure (react-hooks/purity); a refetch re-partitions with fresh "now".
  const items = React.useMemo(
    () => partitionAppointments(data?.appointments ?? [], fetchedAt ?? 0),
    [data, fetchedAt],
  );
  const visible = segment === 'upcoming' ? items.upcoming : items.past;

  const openDetail = (item: PatientAppointmentListItem): void => {
    router.push({
      pathname: '/(patient)/appointments/[id]',
      params: {
        id: item.appointmentId,
        ...(item.doctorName ? { doctorName: item.doctorName } : {}),
        ...(item.chamberName ? { chamberName: item.chamberName } : {}),
      },
    });
  };

  const renderRow = ({ item }: { item: PatientAppointmentListItem }): React.ReactElement => {
    const title = item.doctorName ?? t(labelFor(TYPE_LABELS, item.appointmentType));
    const subtitleParts = [
      item.chamberName ?? null,
      item.chamberName ? null : t(labelFor(FACILITY_LABELS, item.facilityType)),
    ].filter((s): s is string => !!s);
    const statusLabel = t(labelFor(STATUS_LABELS, item.status));
    return (
      <ListRow
        title={title}
        {...(subtitleParts.length > 0 ? { subtitle: subtitleParts.join(' · ') } : {})}
        meta={formatDateTime(item.scheduledAt, lang)}
        right={<StatusPill label={statusLabel} tone={statusTone(String(item.status))} />}
        accessibilityLabel={`${title}, ${formatDateTime(item.scheduledAt, lang)}, ${statusLabel}`}
        onPress={() => openDetail(item)}
      />
    );
  };

  return (
    <ScreenScaffold phi>
      <SectionHeader
        title={t(APPT_STRINGS.appointments)}
        right={<FreshnessBadge fetchedAt={fetchedAt} />}
      />

      <View style={styles.controls}>
        <Button
          title={t(APPT_STRINGS.bookAppointment)}
          accessibilityLabel={t(APPT_STRINGS.bookAppointment)}
          testID="book-appointment"
          onPress={() => router.push('/(patient)/appointments/book')}
        />
        <View style={[styles.segments, { backgroundColor: theme.bgMuted }]}>
          {(['upcoming', 'past'] as const).map((key) => {
            const selected = segment === key;
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={t(APPT_STRINGS[key])}
                accessibilityState={{ selected }}
                onPress={() => setSegment(key)}
                style={[
                  styles.segment,
                  selected && { backgroundColor: theme.bgElevated, borderColor: theme.line },
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    { color: selected ? theme.fg : theme.fgMuted },
                  ]}
                >
                  {t(APPT_STRINGS[key])}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.accent} />
        </View>
      ) : error && !data ? (
        <EmptyState
          title={t(COMMON.genericError)}
          message={error.message}
          actionLabel={t(COMMON.retry)}
          onAction={refetch}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title={t(segment === 'upcoming' ? APPT_STRINGS.noUpcoming : APPT_STRINGS.noPast)}
          {...(segment === 'upcoming' ? { message: t(APPT_STRINGS.bookFirstHint) } : {})}
        />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(a) => a.appointmentId}
          contentContainerStyle={styles.list}
          renderItem={renderRow}
        />
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  controls: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  segments: {
    flexDirection: 'row',
    borderRadius: radius.md,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  segment: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: { fontSize: fontSize.bodySm, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.lg, gap: spacing.sm },
});
