// StatusPill — small semantic status chip. Tone maps to the locked theme
// status colors; never hardcode clinical/status colors in screens.

import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { fontSize, radius, spacing } from './tokens';
import { useTheme } from './theme';

export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export function StatusPill({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: StatusTone;
}): React.ReactElement {
  const theme = useTheme();
  const map: Record<StatusTone, { bg: string; fg: string }> = {
    neutral: { bg: theme.bgMuted, fg: theme.fgMuted },
    info: { bg: theme.status.infoSoft, fg: theme.status.infoStrong },
    success: { bg: theme.status.successSoft, fg: theme.status.success },
    warning: { bg: theme.status.warningSoft, fg: theme.status.warning },
    danger: { bg: theme.status.dangerSoft, fg: theme.status.danger },
  };
  const c = map[tone];
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <Text style={[styles.label, { color: c.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  label: { fontSize: fontSize.caption, fontWeight: '600' },
});
