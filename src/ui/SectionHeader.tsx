// SectionHeader — screen/section heading row with an optional trailing
// accessory (e.g. a FreshnessBadge or "see all" link).

import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { fontSize, spacing } from './tokens';
import { useTheme } from './theme';

export function SectionHeader({
  title,
  right,
}: {
  title: string;
  right?: React.ReactNode;
}): React.ReactElement {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: theme.fg }]}
        numberOfLines={1}
      >
        {title}
      </Text>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: { fontSize: fontSize.h2, fontWeight: '700' },
});
