// Medication reminders — list + pause/resume + delete + create/update.
//
// Backend contract (src/app/api/v1/me/medication-reminders/route.ts):
//   GET  → { reminders: [...] } (ACTIVE + PAUSED rows)
//   POST → UPSERT keyed on prescriptionId; label + times required on
//          every call. Pause/resume = re-POST with flipped status;
//          delete = re-POST with status CANCELLED (no DELETE route).
//
// The create form MUST reference one of the patient's prescriptions
// (server keys reminders on a prescription UUID). The prescription list
// projection has no drug names, so the picker is enriched with names
// from the current-medications rows that point at each prescription.

import * as React from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import {
  useCurrentMedications,
  useMedicationReminders,
  usePatientPrescriptions,
} from '@/features/patient-meds/hooks';
import {
  buildReminderUpsertBody,
  joinParts,
  medNamesByPrescription,
  normalizeReminderTime,
  reminderStatusTone,
} from '@/features/patient-meds/logic';
import {
  STR,
  medicineCountLabel,
  prescriptionStatusLabel,
  reminderStatusLabel,
  removeTimeLabel,
} from '@/features/patient-meds/strings';
import type { ReminderStatus, ReminderView } from '@/features/patient-meds/types';
import { COMMON, formatDate, useT } from '@/i18n';
import { useWrite } from '@/offline/useWrite';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { FreshnessBadge } from '@/ui/FreshnessBadge';
import { ScreenScaffold } from '@/ui/ScreenScaffold';
import { SectionHeader } from '@/ui/SectionHeader';
import { StatusPill } from '@/ui/StatusPill';
import { TextField } from '@/ui/TextField';
import { useTheme } from '@/ui/theme';
import { useDraft } from '@/ui/useDraft';
import { MIN_TOUCH_TARGET, fontSize, radius, spacing } from '@/ui/tokens';

interface ReminderDraft {
  prescriptionId: string | null;
  label: string;
  times: string[];
  push: boolean;
}

const EMPTY_DRAFT: ReminderDraft = {
  prescriptionId: null,
  label: '',
  times: [],
  push: false,
};

export default function MedicationRemindersScreen(): React.ReactElement {
  const { lang, t } = useT();
  const theme = useTheme();

  const reminders = useMedicationReminders();
  const rx = usePatientPrescriptions();
  const meds = useCurrentMedications();

  // Separate write channels so an idempotency key is never shared across
  // different logical action kinds (row updates vs. form saves).
  const rowWrite = useWrite<unknown>();
  const createWrite = useWrite<unknown>();
  const [pendingRowId, setPendingRowId] = React.useState<string | null>(null);

  const draft = useDraft<ReminderDraft>('patient:meds:reminder-create', EMPTY_DRAFT);
  const [timeInput, setTimeInput] = React.useState('');
  const [formError, setFormError] = React.useState<string | null>(null);

  const reminderRows = reminders.data?.reminders;
  const prescriptions = rx.data?.prescriptions;
  const namesByRx = React.useMemo(
    () => medNamesByPrescription(meds.data?.medications),
    [meds.data],
  );

  const surfaceWriteError = React.useCallback(
    (code: string, message: string): void => {
      if (code === 'OFFLINE') {
        Alert.alert(t(COMMON.offline), t(STR.offlineWrite));
      } else {
        Alert.alert(t(COMMON.genericError), message);
      }
    },
    [t],
  );

  // ── Row actions (pause / resume / delete via status upsert) ───────────────

  const applyRowStatus = React.useCallback(
    async (row: ReminderView, status: ReminderStatus): Promise<void> => {
      const body = buildReminderUpsertBody(row, status);
      if (body === null) {
        Alert.alert(t(COMMON.genericError), t(STR.reminderRowIncomplete));
        return;
      }
      setPendingRowId(row.id);
      const res = await rowWrite.submit({
        method: 'POST',
        path: '/api/v1/me/medication-reminders',
        body,
      });
      setPendingRowId(null);
      if (res.ok) {
        reminders.refetch();
      } else {
        surfaceWriteError(res.error.code, res.error.message);
      }
    },
    [rowWrite, reminders, surfaceWriteError, t],
  );

  const confirmDelete = React.useCallback(
    (row: ReminderView): void => {
      Alert.alert(t(STR.deleteConfirmTitle), t(STR.deleteConfirmMsg), [
        { text: t(COMMON.cancel), style: 'cancel' },
        {
          text: t(STR.deleteReminder),
          style: 'destructive',
          onPress: () => void applyRowStatus(row, 'CANCELLED'),
        },
      ]);
    },
    [applyRowStatus, t],
  );

  // ── Create / update form ───────────────────────────────────────────────────

  const selectPrescription = (prescriptionId: string): void => {
    const suggested = namesByRx.get(prescriptionId)?.[0];
    draft.setValue({
      ...draft.value,
      prescriptionId,
      label:
        draft.value.label.trim().length === 0 && suggested !== undefined
          ? suggested
          : draft.value.label,
    });
  };

  const addTime = (): void => {
    const norm = normalizeReminderTime(timeInput);
    if (norm === null) {
      setFormError(t(STR.invalidTime));
      return;
    }
    setFormError(null);
    setTimeInput('');
    if (draft.value.times.includes(norm) || draft.value.times.length >= 8) return;
    draft.setValue({ ...draft.value, times: [...draft.value.times, norm].sort() });
  };

  const removeTime = (time: string): void => {
    draft.setValue({
      ...draft.value,
      times: draft.value.times.filter((x) => x !== time),
    });
  };

  const saveReminder = async (): Promise<void> => {
    const v = draft.value;
    if (v.prescriptionId === null) {
      setFormError(t(STR.pickPrescriptionFirst));
      return;
    }
    if (v.label.trim().length === 0) {
      setFormError(t(STR.labelRequired));
      return;
    }
    if (v.times.length === 0) {
      setFormError(t(STR.timesRequired));
      return;
    }
    setFormError(null);
    const res = await createWrite.submit({
      method: 'POST',
      path: '/api/v1/me/medication-reminders',
      body: {
        prescriptionId: v.prescriptionId,
        reminderLabel: v.label.trim(),
        reminderTimes: v.times,
        channels: v.push ? ['push', 'in_app'] : ['in_app'],
        status: 'ACTIVE',
      },
    });
    if (res.ok) {
      draft.clear();
      draft.setValue(EMPTY_DRAFT);
      setTimeInput('');
      reminders.refetch();
      Alert.alert(t(STR.reminderSavedTitle));
    } else {
      surfaceWriteError(res.error.code, res.error.message);
    }
  };

  const anyRowBusy = rowWrite.busy;

  return (
    <ScreenScaffold phi>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <SectionHeader
          title={t(STR.remindersTitle)}
          right={<FreshnessBadge fetchedAt={reminders.fetchedAt} />}
        />

        {/* Existing reminders */}
        {reminders.isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        ) : reminders.error && !reminderRows ? (
          <EmptyState
            title={t(COMMON.genericError)}
            message={reminders.error.message}
            actionLabel={t(COMMON.retry)}
            onAction={reminders.refetch}
          />
        ) : !reminderRows || reminderRows.length === 0 ? (
          <EmptyState title={t(STR.noReminders)} message={t(STR.noRemindersHint)} />
        ) : (
          <View style={styles.group}>
            {reminderRows.map((row) => {
              const isPaused = row.status === 'PAUSED';
              const rowBusy = pendingRowId === row.id && anyRowBusy;
              return (
                <View
                  key={row.id}
                  style={[styles.card, { borderColor: theme.line, backgroundColor: theme.bgElevated }]}
                >
                  <View style={styles.cardHead}>
                    <Text style={[styles.cardTitle, { color: theme.fg }]} numberOfLines={2}>
                      {row.reminderLabel ?? '—'}
                    </Text>
                    <StatusPill
                      label={t(reminderStatusLabel(row.status))}
                      tone={reminderStatusTone(row.status)}
                    />
                  </View>
                  <Text style={[styles.times, { color: theme.fgMuted }]}>
                    {(row.reminderTimes ?? []).join('  ·  ')}
                  </Text>
                  <View style={styles.actions}>
                    <View style={styles.actionButton}>
                      <Button
                        title={isPaused ? t(STR.resume) : t(STR.pause)}
                        variant="secondary"
                        loading={rowBusy}
                        disabled={anyRowBusy}
                        accessibilityLabel={`${isPaused ? t(STR.resume) : t(STR.pause)}: ${row.reminderLabel ?? ''}`}
                        onPress={() =>
                          void applyRowStatus(row, isPaused ? 'ACTIVE' : 'PAUSED')
                        }
                      />
                    </View>
                    <View style={styles.actionButton}>
                      <Button
                        title={t(STR.deleteReminder)}
                        variant="destructive"
                        disabled={anyRowBusy}
                        accessibilityLabel={`${t(STR.deleteReminder)}: ${row.reminderLabel ?? ''}`}
                        onPress={() => confirmDelete(row)}
                      />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Create / update */}
        <SectionHeader title={t(STR.setReminder)} />
        <View style={styles.group}>
          <Text style={[styles.hint, { color: theme.fgMuted }]}>{t(STR.setReminderHint)}</Text>

          <Text style={[styles.fieldLabel, { color: theme.fg }]}>
            {t(STR.choosePrescription)}
          </Text>
          {rx.isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator />
            </View>
          ) : !prescriptions || prescriptions.length === 0 ? (
            <Text style={[styles.hint, { color: theme.fgMuted }]}>
              {t(STR.noPrescriptionToRemind)}
            </Text>
          ) : (
            <View style={styles.pickerGroup}>
              {prescriptions.map((p) => {
                const selected = draft.value.prescriptionId === p.prescriptionId;
                const names = namesByRx.get(p.prescriptionId);
                const title =
                  p.prescribedAt !== undefined
                    ? formatDate(p.prescribedAt, lang)
                    : t(STR.prescriptionFallbackTitle);
                const subtitle = joinParts([
                  names !== undefined ? names.join(', ') : undefined,
                  names === undefined && p.itemCount !== undefined
                    ? t(medicineCountLabel(p.itemCount))
                    : undefined,
                  t(prescriptionStatusLabel(p.status)),
                ]);
                return (
                  <Pressable
                    key={p.prescriptionId}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={`${title}, ${subtitle}`}
                    testID={`pick-rx-${p.prescriptionId}`}
                    onPress={() => selectPrescription(p.prescriptionId)}
                    style={({ pressed }) => [
                      styles.option,
                      {
                        borderColor: selected ? theme.accent : theme.line,
                        backgroundColor: selected ? theme.accentSoft : theme.bgElevated,
                      },
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Text style={[styles.optionTitle, { color: theme.fg }]}>{title}</Text>
                    {subtitle.length > 0 ? (
                      <Text style={[styles.optionSub, { color: theme.fgMuted }]} numberOfLines={2}>
                        {subtitle}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          )}

          <TextField
            label={t(STR.medicineName)}
            hint={t(STR.medicineNameHint)}
            value={draft.value.label}
            onChangeText={(label) => draft.setValue({ ...draft.value, label })}
            testID="reminder-label"
          />

          <Text style={[styles.fieldLabel, { color: theme.fg }]}>{t(STR.reminderTimes)}</Text>
          {draft.value.times.length > 0 ? (
            <View style={styles.chipRow}>
              {draft.value.times.map((time) => (
                <Pressable
                  key={time}
                  accessibilityRole="button"
                  accessibilityLabel={t(removeTimeLabel(time))}
                  onPress={() => removeTime(time)}
                  style={({ pressed }) => [
                    styles.timeChip,
                    { backgroundColor: theme.bgMuted },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={[styles.timeChipText, { color: theme.fg }]}>{time} ✕</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <View style={styles.timeRow}>
            <View style={styles.timeField}>
              <TextField
                label={t(STR.addTime)}
                hint={t(STR.timeHint)}
                value={timeInput}
                onChangeText={setTimeInput}
                placeholder="08:00"
                keyboardType="numbers-and-punctuation"
                autoCapitalize="none"
                autoCorrect={false}
                testID="reminder-time-input"
              />
            </View>
            <View style={styles.timeAdd}>
              <Button
                title={t(STR.addTime)}
                variant="secondary"
                accessibilityLabel={t(STR.addTime)}
                testID="reminder-add-time"
                onPress={addTime}
              />
            </View>
          </View>

          <View style={styles.switchRow}>
            <Text style={[styles.fieldLabel, { color: theme.fg }]}>{t(STR.alsoPush)}</Text>
            <Switch
              value={draft.value.push}
              onValueChange={(push) => draft.setValue({ ...draft.value, push })}
              accessibilityLabel={t(STR.alsoPush)}
            />
          </View>

          {formError !== null ? (
            <Text style={[styles.error, { color: theme.status.danger }]}>{formError}</Text>
          ) : null}

          <Button
            title={t(STR.saveReminder)}
            loading={createWrite.busy}
            disabled={createWrite.busy}
            accessibilityLabel={t(STR.saveReminder)}
            testID="save-reminder"
            onPress={() => void saveReminder()}
          />
        </View>
      </ScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl },
  center: { paddingVertical: spacing.xl, alignItems: 'center' },
  group: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.md },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardTitle: { fontSize: fontSize.body, fontWeight: '600', flexShrink: 1 },
  times: { fontSize: fontSize.bodySm },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  actionButton: { flex: 1 },
  hint: { fontSize: fontSize.bodySm },
  fieldLabel: { fontSize: fontSize.bodySm, fontWeight: '600' },
  pickerGroup: { gap: spacing.xs },
  option: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    gap: 2,
  },
  optionTitle: { fontSize: fontSize.body, fontWeight: '600' },
  optionSub: { fontSize: fontSize.bodySm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  timeChip: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    minHeight: MIN_TOUCH_TARGET - 8,
    justifyContent: 'center',
  },
  timeChipText: { fontSize: fontSize.bodySm, fontWeight: '600' },
  timeRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end' },
  timeField: { flex: 1 },
  timeAdd: { paddingBottom: spacing.lg },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: MIN_TOUCH_TARGET,
    gap: spacing.sm,
  },
  error: { fontSize: fontSize.bodySm, fontWeight: '600' },
});
