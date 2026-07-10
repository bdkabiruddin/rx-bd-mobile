// Patient vitals diary — self-reported readings history.
//
//   Read: GET /api/v1/patients/{userId}/vitals?limit=200 (usePatientVitals).
//         Payload mirrors listPatientVitalsResponseSchema
//         ({ vitals: { readings, totalCount } }).
//
// Readings render newest first, grouped by Dhaka-local day; the type-filter
// chips appear only when the data actually contains more than one type.
// Patient-entered rows are pilled "Self-reported" (backend `source`), and
// non-RECORDED statuses (corrected / out-of-range) surface honestly.

import { useRouter } from 'expo-router';
import * as React from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  filterByType,
  formatTimeOfDay,
  formatVitalNumber,
  formatVitalValue,
  groupReadingsByDay,
  typesPresent,
  vitalSourceTone,
  vitalStatusTone,
  type VitalDayGroup,
} from '@/features/patient-vitals/logic';
import { usePatientVitals } from '@/features/patient-vitals/hooks';
import { SelectableChip } from '@/features/patient-vitals/SelectableChip';
import {
  VITALS_STR,
  showingLatestLabel,
  vitalSourceLabel,
  vitalStatusLabel,
  vitalTypeLabel,
} from '@/features/patient-vitals/strings';
import type { VitalReadingView } from '@/features/patient-vitals/types';
import { COMMON, formatDate, useT } from '@/i18n';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { FreshnessBadge } from '@/ui/FreshnessBadge';
import { ListRow } from '@/ui/ListRow';
import { ScreenScaffold } from '@/ui/ScreenScaffold';
import { SectionHeader } from '@/ui/SectionHeader';
import { StatusPill } from '@/ui/StatusPill';
import { useTheme } from '@/ui/theme';
import { fontSize, spacing } from '@/ui/tokens';

export default function PatientVitalsDiary(): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  const { lang, t } = useT();

  const { data, fetchedAt, isLoading, error, refetch } = usePatientVitals();
  const [typeFilter, setTypeFilter] = React.useState<string | null>(null);

  const readings = data?.vitals?.readings;
  const totalCount = data?.vitals?.totalCount;

  const chipTypes = React.useMemo(() => typesPresent(readings), [readings]);
  const groups = React.useMemo(
    () => groupReadingsByDay(filterByType(readings ?? [], typeFilter)),
    [readings, typeFilter],
  );

  const goAdd = React.useCallback(
    () => router.push('/(patient)/vitals/add'),
    [router],
  );

  // Honest truncation note when the history is longer than one fetch.
  const footerNote =
    totalCount !== undefined && readings !== undefined && totalCount > readings.length ? (
      <Text style={[styles.footerNote, { color: theme.fgMuted }]}>
        {t(
          showingLatestLabel(
            formatVitalNumber(readings.length, lang),
            formatVitalNumber(totalCount, lang),
          ),
        )}
      </Text>
    ) : null;

  const renderReading = (r: VitalReadingView): React.ReactElement => {
    const typeLabel = t(vitalTypeLabel(r.vitalType));
    const value = formatVitalValue(r, lang);
    const note = r.notes !== null && r.notes !== undefined && r.notes.trim().length > 0
      ? ` — ${r.notes.trim()}`
      : '';
    return (
      <ListRow
        key={r.vitalReadingId}
        title={typeLabel}
        subtitle={`${value}${note}`}
        meta={formatTimeOfDay(r.effectiveAt, lang)}
        accessibilityLabel={`${typeLabel}: ${value}`}
        right={
          <View style={styles.pills}>
            {r.source !== undefined && r.source.length > 0 ? (
              <StatusPill label={t(vitalSourceLabel(r.source))} tone={vitalSourceTone(r.source)} />
            ) : null}
            {r.status !== undefined && r.status !== 'RECORDED' ? (
              <StatusPill label={t(vitalStatusLabel(r.status))} tone={vitalStatusTone(r.status)} />
            ) : null}
          </View>
        }
      />
    );
  };

  const renderGroup = ({ item }: { item: VitalDayGroup }): React.ReactElement => {
    const first = item.items[0];
    return (
      <View style={styles.dayGroup}>
        <Text style={[styles.dayHeader, { color: theme.fgMuted }]} accessibilityRole="header">
          {first !== undefined ? formatDate(first.effectiveAt, lang) : item.day}
        </Text>
        <View style={styles.dayRows}>{item.items.map(renderReading)}</View>
      </View>
    );
  };

  return (
    <ScreenScaffold phi>
      <SectionHeader
        title={t(VITALS_STR.diaryTitle)}
        right={<FreshnessBadge fetchedAt={fetchedAt} />}
      />

      <View style={styles.toolbar}>
        <Button
          title={t(VITALS_STR.addReading)}
          accessibilityLabel={t(VITALS_STR.addReading)}
          testID="add-vital"
          onPress={goAdd}
        />
      </View>

      {chipTypes.length > 1 ? (
        <View style={styles.chipStrip}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            <SelectableChip
              label={t(VITALS_STR.filterAll)}
              selected={typeFilter === null}
              onPress={() => setTypeFilter(null)}
            />
            {chipTypes.map((type) => (
              <SelectableChip
                key={type}
                label={t(vitalTypeLabel(type))}
                selected={typeFilter === type}
                onPress={() => setTypeFilter(type)}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : error && !readings ? (
        <EmptyState
          title={t(COMMON.genericError)}
          message={error.message}
          actionLabel={t(COMMON.retry)}
          onAction={refetch}
        />
      ) : !readings || readings.length === 0 ? (
        <EmptyState
          title={t(VITALS_STR.noReadings)}
          message={t(VITALS_STR.noReadingsHint)}
          actionLabel={t(VITALS_STR.addReading)}
          onAction={goAdd}
        />
      ) : groups.length === 0 ? (
        <EmptyState
          title={t(VITALS_STR.noReadingsOfType)}
          actionLabel={t(VITALS_STR.showAll)}
          onAction={() => setTypeFilter(null)}
        />
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(g) => g.day}
          contentContainerStyle={styles.list}
          renderItem={renderGroup}
          ListFooterComponent={footerNote}
        />
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  toolbar: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  chipStrip: { paddingBottom: spacing.sm },
  chipRow: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  dayGroup: { gap: spacing.xs },
  dayHeader: { fontSize: fontSize.bodySm, fontWeight: '700' },
  dayRows: { gap: spacing.sm },
  pills: { alignItems: 'flex-end', gap: spacing.xs },
  footerNote: {
    fontSize: fontSize.caption,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
});
