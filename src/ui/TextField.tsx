// TextField — labelled text input with optional error line. Token-driven,
// min 48dp, theme-aware. Use for every form input so styling stays uniform.

import * as React from 'react';
import { StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';

import { MIN_TOUCH_TARGET, fontSize, radius, spacing } from './tokens';
import { useTheme } from './theme';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string;
  /** Optional helper line shown when there is no error. */
  hint?: string;
}

export function TextField({ label, error, hint, ...rest }: TextFieldProps): React.ReactElement {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.fg }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.fgSubtle}
        style={[
          styles.input,
          {
            color: theme.fg,
            backgroundColor: theme.bgElevated,
            borderColor: error ? theme.status.danger : theme.inputBorder,
          },
        ]}
        {...rest}
      />
      {error ? (
        <Text style={[styles.note, { color: theme.status.danger }]}>{error}</Text>
      ) : hint ? (
        <Text style={[styles.note, { color: theme.fgMuted }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  label: { fontSize: fontSize.bodySm, fontWeight: '600' },
  input: {
    minHeight: MIN_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.body,
  },
  note: { fontSize: fontSize.caption },
});
