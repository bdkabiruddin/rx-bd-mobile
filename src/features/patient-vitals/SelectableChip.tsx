// SelectableChip — small selected/unselected chip used for the diary's
// type-filter row and the add form's reading-type picker. Token-driven,
// min 48dp touch target, theme-aware.

import * as React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from '@/ui/theme';
import { MIN_TOUCH_TARGET, fontSize, radius, spacing } from '@/ui/tokens';

export function SelectableChip({
  label,
  selected,
  onPress,
  role = 'button',
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** 'radio' for pick-one groups (the add form), 'button' for filters. */
  role?: 'button' | 'radio';
  testID?: string;
}): React.ReactElement {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={role === 'radio' ? { checked: selected } : { selected }}
      {...(testID !== undefined ? { testID } : {})}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          borderColor: selected ? theme.accent : theme.line,
          backgroundColor: selected ? theme.accentSoft : theme.bgElevated,
        },
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text
        style={[styles.label, { color: selected ? theme.accent : theme.fg }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: MIN_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: fontSize.bodySm, fontWeight: '600' },
});
