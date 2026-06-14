// Button primitive — token-driven, accessible, min 48dp touch target.
// Variants mirror web semantics, including the locked `clinicalCritical`
// destructive treatment for safety-bearing actions.

import * as React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
} from 'react-native';

import { MIN_TOUCH_TARGET, radius, spacing } from './tokens';
import { useTheme } from './theme';

export type ButtonVariant = 'default' | 'secondary' | 'destructive' | 'ghost';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  title: string;
  variant?: ButtonVariant;
  /** Safety-bearing destructive action (locked danger styling). */
  clinicalCritical?: boolean;
  loading?: boolean;
  disabled?: boolean;
}

export function Button({
  title,
  variant = 'default',
  clinicalCritical = false,
  loading = false,
  disabled = false,
  ...rest
}: ButtonProps): React.ReactElement {
  const theme = useTheme();
  const isDisabled = disabled || loading;
  const v = clinicalCritical ? 'destructive' : variant;

  const bg =
    v === 'default'
      ? theme.accent
      : v === 'destructive'
        ? theme.status.danger
        : v === 'secondary'
          ? theme.bgMuted
          : 'transparent';
  const fg =
    v === 'default'
      ? theme.accentFg
      : v === 'destructive'
        ? theme.status.dangerFg
        : theme.fg;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: bg, opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1 },
        v === 'ghost' && { borderWidth: 0 },
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.label, { color: fg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 16, fontWeight: '600' },
});
