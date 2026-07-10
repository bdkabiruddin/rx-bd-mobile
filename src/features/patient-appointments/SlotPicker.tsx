// SlotPicker — date-grouped grid of tappable bookable time chunks.
// Shared by the booking wizard (step 3) and the reschedule panel.
// Renders honest loading / error / empty states; never fabricates slots.

import * as React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { COMMON, formatDate, useT } from '@/i18n';
import { EmptyState } from '@/ui/EmptyState';
import { MIN_TOUCH_TARGET, fontSize, radius, spacing } from '@/ui/tokens';
import { useTheme } from '@/ui/theme';

import {
  formatMinuteOfDay,
  groupChunksByDate,
  type BookableSlotChunk,
} from './logic';
import { APPT_STRINGS } from './strings';
import type { DoctorAvailability } from './useDoctorAvailability';

export function chunkKey(chunk: BookableSlotChunk): string {
  return `${chunk.date}:${chunk.startMinuteOfDay}:${chunk.chamberId ?? ''}`;
}

export function SlotPicker({
  availability,
  selectedKey,
  onSelect,
}: {
  availability: DoctorAvailability;
  selectedKey: string | null;
  onSelect: (chunk: BookableSlotChunk) => void;
}): React.ReactElement {
  const theme = useTheme();
  const { lang, t } = useT();
  const { chunks, loading, error, reload } = availability;

  if (loading && chunks === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }
  if (error) {
    return (
      <EmptyState
        title={t(COMMON.genericError)}
        message={error.message}
        actionLabel={t(COMMON.retry)}
        onAction={reload}
      />
    );
  }
  if (!chunks || chunks.length === 0) {
    return <EmptyState title={t(APPT_STRINGS.noSlotsForDoctor)} />;
  }

  const groups = groupChunksByDate(chunks);

  return (
    <View style={styles.groups}>
      {groups.map((group) => (
        <View key={group.date} style={styles.group}>
          <Text style={[styles.date, { color: theme.fg }]}>
            {formatDate(group.date, lang)}
          </Text>
          <View style={styles.chips}>
            {group.chunks.map((chunk) => {
              const key = chunkKey(chunk);
              const selected = key === selectedKey;
              const label = formatMinuteOfDay(chunk.startMinuteOfDay, lang);
              return (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityLabel={`${formatDate(chunk.date, lang)} ${label}`}
                  accessibilityState={{ selected }}
                  onPress={() => onSelect(chunk)}
                  style={({ pressed }) => [
                    styles.chip,
                    {
                      backgroundColor: selected ? theme.accent : theme.bgElevated,
                      borderColor: selected ? theme.accent : theme.line,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: selected ? theme.accentFg : theme.fg },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: spacing.xl, alignItems: 'center' },
  groups: { gap: spacing.md },
  group: { gap: spacing.sm },
  date: { fontSize: fontSize.bodySm, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET + 24,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontSize: fontSize.bodySm, fontWeight: '600' },
});
