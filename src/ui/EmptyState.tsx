// Empty / error state — the ONLY thing we render when there is no data.
// Never fabricated placeholder content (mirrors the web hard rule).

import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from './Button';
import { fontSize, spacing } from './tokens';
import { useTheme } from './theme';

export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}): React.ReactElement {
  const theme = useTheme();
  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: theme.fg }]}>{title}</Text>
      {message ? (
        <Text style={[styles.message, { color: theme.fgMuted }]}>{message}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <Button title={actionLabel} variant="secondary" onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  title: { fontSize: fontSize.h3, fontWeight: '600', textAlign: 'center' },
  message: { fontSize: fontSize.bodySm, textAlign: 'center' },
  action: { marginTop: spacing.md },
});
