// PickerChip — small pick-one chip for the profile edit + allergy forms
// (gender, blood group, severity). Token-driven, min 48dp touch target,
// theme-aware. Local to the patient-profile feature (file-ownership rule:
// no cross-feature imports).

import * as React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from '@/ui/theme';
import { MIN_TOUCH_TARGET, fontSize, radius, spacing } from '@/ui/tokens';

export function PickerChip({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}): React.ReactElement {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
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
