// Appointment status action sheet — the doctor advances an appointment through
// its lifecycle from the Today list (check-in → start visit → complete) or
// marks no-show / cancel. PATCH /api/v1/appointments/{id}/status carries
// { newStatus, reason? }. The backend owns the authoritative transition rules
// and per-status guards; we offer the plausible next actions and surface any
// rejection honestly. Writes go through useWrite (online-only, stable key).

import { useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { COMMON, useT } from '@/i18n';
import { useWrite } from '@/offline/useWrite';
import { Button } from '@/ui/Button';
import { fontSize, radius, spacing } from '@/ui/tokens';
import { useTheme } from '@/ui/theme';

import { DOCTOR_TODAY_KEY } from './hooks';
import { nextStatusActions, statusNeedsReason } from './logic';
import { SCHED_STR, appointmentActionLabel } from './strings';
import type { AppointmentStatus } from './types';

export function AppointmentActionSheet({
  appointmentId,
  status,
  heading,
  onClose,
}: {
  appointmentId: string;
  status: string;
  /** Row title (time · type) shown at the top of the sheet for context. */
  heading: string;
  onClose: () => void;
}): React.ReactElement {
  const theme = useTheme();
  const { t } = useT();
  const queryClient = useQueryClient();
  const write = useWrite<unknown>();
  const [reason, setReason] = React.useState('');

  const actions = nextStatusActions(status);

  const run = (target: AppointmentStatus): void => {
    const trimmed = reason.trim();
    if (statusNeedsReason(target) && trimmed.length === 0) {
      Alert.alert(t(SCHED_STR.statusReasonRequired));
      return;
    }
    Alert.alert(t(appointmentActionLabel(target)), t(SCHED_STR.confirmStatusChange), [
      { text: t(COMMON.cancel), style: 'cancel' },
      {
        text: t(COMMON.confirm),
        style: statusNeedsReason(target) ? 'destructive' : 'default',
        onPress: () => {
          void (async () => {
            const res = await write.submit({
              method: 'PATCH',
              path: `/api/v1/appointments/${encodeURIComponent(appointmentId)}/status`,
              body: { newStatus: target, ...(trimmed ? { reason: trimmed } : {}) },
            });
            if (res.ok) {
              void queryClient.invalidateQueries({ queryKey: [DOCTOR_TODAY_KEY] });
              onClose();
            } else {
              Alert.alert(t(COMMON.genericError), res.error.message);
            }
          })();
        },
      },
    ]);
  };

  return (
    <Modal transparent visible animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={[styles.backdrop, { backgroundColor: theme.scrim }]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t(SCHED_STR.closeSheet)}
      />
      <View style={[styles.sheet, { backgroundColor: theme.bgElevated, borderColor: theme.line }]}>
        <Text accessibilityRole="header" style={[styles.heading, { color: theme.fg }]}>
          {heading}
        </Text>
        {actions.length === 0 ? (
          <Text style={[styles.note, { color: theme.fgMuted }]}>
            {t(SCHED_STR.noStatusActions)}
          </Text>
        ) : (
          <>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder={t(SCHED_STR.statusReasonOptional)}
              placeholderTextColor={theme.fgSubtle}
              accessibilityLabel={t(SCHED_STR.statusReasonOptional)}
              style={[styles.input, { borderColor: theme.inputBorder, color: theme.fg }]}
            />
            {actions.map((target) => (
              <Button
                key={target}
                title={t(appointmentActionLabel(target))}
                variant={statusNeedsReason(target) ? 'secondary' : 'default'}
                loading={write.busy}
                accessibilityLabel={t(appointmentActionLabel(target))}
                onPress={() => run(target)}
              />
            ))}
          </>
        )}
        <Button title={t(SCHED_STR.closeSheet)} variant="ghost" onPress={onClose} />
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
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.body,
  },
});
