// ReasonSheet — a bottom sheet that collects a REQUIRED reason and runs one
// confirm action. Doctor cancel/deny flows (lab-order cancel, refill deny,
// appointment cancel, referral decline) all need a justification the backend
// enforces (typically ≥10 chars). This is the shared surface so each caller is
// a few lines. Writes still go through the caller's useWrite (online-only).

import * as React from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { COMMON, useT } from '@/i18n';

import { Button } from './Button';
import { fontSize, radius, spacing } from './tokens';
import { useTheme } from './theme';

export function ReasonSheet({
  heading,
  description,
  placeholder,
  confirmLabel,
  minChars = 10,
  destructive = true,
  busy = false,
  onConfirm,
  onClose,
}: {
  heading: string;
  description?: string;
  placeholder: string;
  confirmLabel: string;
  /** Minimum trimmed length the backend requires (default 10). */
  minChars?: number;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}): React.ReactElement {
  const theme = useTheme();
  const { t } = useT();
  const [reason, setReason] = React.useState('');
  const trimmed = reason.trim();
  const ready = trimmed.length >= minChars;

  return (
    <Modal transparent visible animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={[styles.backdrop, { backgroundColor: theme.scrim }]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t(COMMON.close)}
      />
      <View style={[styles.sheet, { backgroundColor: theme.bgElevated, borderColor: theme.line }]}>
        <Text accessibilityRole="header" style={[styles.heading, { color: theme.fg }]}>
          {heading}
        </Text>
        {description ? (
          <Text style={[styles.note, { color: theme.fgMuted }]}>{description}</Text>
        ) : null}
        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder={placeholder}
          placeholderTextColor={theme.fgSubtle}
          accessibilityLabel={placeholder}
          multiline
          style={[styles.input, { borderColor: theme.inputBorder, color: theme.fg }]}
        />
        <Text style={[styles.hint, { color: theme.fgSubtle }]}>
          {t({ en: `At least ${minChars} characters.`, bn: `কমপক্ষে ${minChars} অক্ষর।` })}
        </Text>
        <Button
          title={confirmLabel}
          variant={destructive ? 'destructive' : 'default'}
          disabled={!ready}
          loading={busy}
          accessibilityLabel={confirmLabel}
          onPress={() => onConfirm(trimmed)}
        />
        <Button title={t(COMMON.close)} variant="ghost" onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  heading: { fontSize: fontSize.body, fontWeight: '700' },
  note: { fontSize: fontSize.bodySm },
  input: {
    minHeight: 80,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.body,
    textAlignVertical: 'top',
  },
  hint: { fontSize: fontSize.caption },
});
