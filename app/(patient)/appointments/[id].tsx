// Patient appointment detail — full view + cancel + reschedule.
//
//   Read:  GET   /api/v1/appointments/{id}      (PHI view: reason + notes)
//   Write: POST  /api/v1/appointments/{id}/cancel      { reason }
//          PATCH /api/v1/appointments/{id}/reschedule  { newScheduledAt, reason }
//
// Cancel/reschedule are offered only for SCHEDULED/CONFIRMED (mirrors the
// backend per-transition role gate for PATIENT). Both confirm via
// Alert.alert and submit through useWrite (stable idempotency key,
// online-only). Reschedule times come from the doctor's published slots.

import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as React from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { ApiError } from '@/api/errors';
import { useCachedQuery } from '@/api/useCachedQuery';
import { useSession } from '@/auth/sessionStore';
import { COMMON, formatDate, formatDateTime, useT } from '@/i18n';
import { useWrite } from '@/offline/useWrite';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { FreshnessBadge } from '@/ui/FreshnessBadge';
import { ScreenScaffold } from '@/ui/ScreenScaffold';
import { SectionHeader } from '@/ui/SectionHeader';
import { StatusPill } from '@/ui/StatusPill';
import { TextField } from '@/ui/TextField';
import { useDraft } from '@/ui/useDraft';
import { fontSize, radius, spacing } from '@/ui/tokens';
import { useTheme } from '@/ui/theme';

import {
  formatMinuteOfDay,
  formatNumber,
  isActionableStatus,
  slotIso,
  statusTone,
  type BookableSlotChunk,
} from '@/features/patient-appointments/logic';
import { SlotPicker, chunkKey } from '@/features/patient-appointments/SlotPicker';
import {
  APPT_STRINGS,
  FACILITY_LABELS,
  STATUS_LABELS,
  TYPE_LABELS,
  labelFor,
} from '@/features/patient-appointments/strings';
import type {
  CancelAppointmentResult,
  GetAppointmentResult,
  RescheduleAppointmentResult,
} from '@/features/patient-appointments/types';
import { useDoctorAvailability } from '@/features/patient-appointments/useDoctorAvailability';

const MIN_REASON_CHARS = 3;

type Panel = 'none' | 'cancel' | 'reschedule';

interface RescheduleDraft {
  slot: BookableSlotChunk | null;
  reason: string;
}

function paramString(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default function PatientAppointmentDetail(): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { lang, t } = useT();
  const params = useLocalSearchParams<{
    id: string;
    doctorName?: string;
    chamberName?: string;
  }>();
  const id = paramString(params.id);
  const doctorNameParam = paramString(params.doctorName);
  const chamberNameParam = paramString(params.chamberName);
  const tenantId = useSession((s) => s.tenantId);
  const userId = useSession((s) => s.userId);

  const { data, fetchedAt, isLoading, error, refetch } =
    useCachedQuery<GetAppointmentResult>({
      key: `patient:appointments:detail:${id ?? 'missing'}`,
      path: `/api/v1/appointments/${encodeURIComponent(id ?? '')}`,
      ttlMs: 5 * 60 * 1000,
      isPhi: true,
      enabled: id !== null,
      ...(tenantId !== null ? { tenantId } : {}),
      ...(userId !== null ? { userId } : {}),
    });
  const appointment = data?.appointment ?? null;

  const [panel, setPanel] = React.useState<Panel>('none');
  const [cancelReason, setCancelReason] = React.useState('');
  const [writeError, setWriteError] = React.useState<string | null>(null);

  const rescheduleDraft = useDraft<RescheduleDraft>(
    `patient:appointments:reschedule:${id ?? 'missing'}`,
    { slot: null, reason: '' },
  );

  const cancelWrite = useWrite<CancelAppointmentResult>();
  const rescheduleWrite = useWrite<RescheduleAppointmentResult>();

  const doctorUserId = appointment?.doctorUserId ?? null;
  const availability = useDoctorAvailability(
    panel === 'reschedule' ? doctorUserId : null,
  );

  const afterMutation = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['patient:appointments:list'] });
    refetch();
  }, [queryClient, refetch]);

  const describeError = (err: ApiError, isReschedule: boolean): string => {
    if (err.code === 'OFFLINE') return t(APPT_STRINGS.offlineWrite);
    if (isReschedule && err.code === 'CONFLICT') return t(APPT_STRINGS.slotTaken);
    return err.message || t(COMMON.genericError);
  };

  const submitCancel = (): void => {
    if (!id) return;
    setWriteError(null);
    Alert.alert(
      t(APPT_STRINGS.cancelConfirmTitle),
      t(APPT_STRINGS.cancelConfirmBody),
      [
        { text: t(APPT_STRINGS.keepAppointment), style: 'cancel' },
        {
          text: t(APPT_STRINGS.cancelAppointment),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const res = await cancelWrite.submit({
                method: 'POST',
                path: `/api/v1/appointments/${encodeURIComponent(id)}/cancel`,
                body: { reason: cancelReason.trim() },
              });
              if (res.ok) {
                setPanel('none');
                setCancelReason('');
                afterMutation();
                Alert.alert(t(APPT_STRINGS.cancelled));
              } else {
                setWriteError(describeError(res.error, false));
              }
            })();
          },
        },
      ],
    );
  };

  const submitReschedule = (): void => {
    const slot = rescheduleDraft.value.slot;
    if (!id || !slot) return;
    setWriteError(null);
    const newIso = slotIso(slot.date, slot.startMinuteOfDay);
    Alert.alert(
      t(APPT_STRINGS.rescheduleConfirmTitle),
      `${formatDate(slot.date, lang)} · ${formatMinuteOfDay(slot.startMinuteOfDay, lang)}`,
      [
        { text: t(COMMON.cancel), style: 'cancel' },
        {
          text: t(COMMON.confirm),
          onPress: () => {
            void (async () => {
              const res = await rescheduleWrite.submit({
                method: 'PATCH',
                path: `/api/v1/appointments/${encodeURIComponent(id)}/reschedule`,
                body: {
                  newScheduledAt: newIso,
                  reason: rescheduleDraft.value.reason.trim(),
                },
              });
              if (res.ok) {
                rescheduleDraft.clear();
                rescheduleDraft.setValue({ slot: null, reason: '' });
                setPanel('none');
                afterMutation();
                Alert.alert(t(APPT_STRINGS.rescheduled));
              } else {
                setWriteError(describeError(res.error, true));
              }
            })();
          },
        },
      ],
    );
  };

  const cancelValid = cancelReason.trim().length >= MIN_REASON_CHARS;
  const rescheduleValid =
    rescheduleDraft.value.slot !== null &&
    rescheduleDraft.value.reason.trim().length >= MIN_REASON_CHARS;

  const renderField = (label: string, value: string): React.ReactElement => (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: theme.fgMuted }]}>{label}</Text>
      <Text style={[styles.fieldValue, { color: theme.fg }]}>{value}</Text>
    </View>
  );

  return (
    <ScreenScaffold phi>
      <SectionHeader
        title={t(APPT_STRINGS.appointmentDetail)}
        right={<FreshnessBadge fetchedAt={fetchedAt} />}
      />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.accent} />
        </View>
      ) : error && !data ? (
        <EmptyState
          title={t(COMMON.genericError)}
          message={error.message}
          actionLabel={t(COMMON.retry)}
          onAction={refetch}
        />
      ) : !appointment ? (
        <EmptyState
          title={t(APPT_STRINGS.notFound)}
          actionLabel={t(APPT_STRINGS.back)}
          onAction={() => router.back()}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <View
            style={[
              styles.card,
              { borderColor: theme.line, backgroundColor: theme.bgElevated },
            ]}
          >
            <View style={styles.statusRow}>
              <Text style={[styles.when, { color: theme.fg }]}>
                {formatDateTime(appointment.scheduledAt, lang)}
              </Text>
              <StatusPill
                label={t(labelFor(STATUS_LABELS, appointment.status))}
                tone={statusTone(String(appointment.status))}
              />
            </View>

            {doctorNameParam
              ? renderField(t(APPT_STRINGS.doctor), doctorNameParam)
              : null}
            {chamberNameParam
              ? renderField(t(APPT_STRINGS.chamber), chamberNameParam)
              : null}
            {renderField(
              t(APPT_STRINGS.visitType),
              t(labelFor(TYPE_LABELS, appointment.appointmentType)),
            )}
            {renderField(
              t(APPT_STRINGS.facility),
              t(labelFor(FACILITY_LABELS, appointment.facilityType)),
            )}
            {appointment.durationMinutes !== undefined
              ? renderField(
                  t(APPT_STRINGS.duration),
                  `${formatNumber(appointment.durationMinutes, lang)} ${t(APPT_STRINGS.minutes)}`,
                )
              : null}
            {appointment.reason
              ? renderField(t(APPT_STRINGS.reasonForVisit), appointment.reason)
              : null}
            {appointment.notes
              ? renderField(t(APPT_STRINGS.notes), appointment.notes)
              : null}
          </View>

          {isActionableStatus(String(appointment.status)) ? (
            <View style={styles.actions}>
              {panel !== 'reschedule' ? (
                <Button
                  title={t(APPT_STRINGS.reschedule)}
                  variant="secondary"
                  accessibilityLabel={t(APPT_STRINGS.reschedule)}
                  onPress={() => {
                    setWriteError(null);
                    setPanel('reschedule');
                  }}
                />
              ) : null}
              {panel !== 'cancel' ? (
                <Button
                  title={t(APPT_STRINGS.cancelAppointment)}
                  variant="destructive"
                  accessibilityLabel={t(APPT_STRINGS.cancelAppointment)}
                  onPress={() => {
                    setWriteError(null);
                    setPanel('cancel');
                  }}
                />
              ) : null}
            </View>
          ) : null}

          {panel === 'cancel' && isActionableStatus(String(appointment.status)) ? (
            <View
              style={[
                styles.panel,
                { borderColor: theme.line, backgroundColor: theme.bgElevated },
              ]}
            >
              <Text style={[styles.panelTitle, { color: theme.fg }]}>
                {t(APPT_STRINGS.cancelAppointment)}
              </Text>
              <TextField
                label={t(APPT_STRINGS.cancelReasonLabel)}
                hint={t(APPT_STRINGS.cancelReasonHint)}
                value={cancelReason}
                onChangeText={setCancelReason}
                multiline
              />
              {writeError ? (
                <Text style={[styles.error, { color: theme.status.danger }]}>
                  {writeError}
                </Text>
              ) : null}
              <Button
                title={t(APPT_STRINGS.cancelAppointment)}
                variant="destructive"
                disabled={!cancelValid}
                loading={cancelWrite.busy}
                accessibilityLabel={t(APPT_STRINGS.cancelAppointment)}
                onPress={submitCancel}
              />
              <Button
                title={t(APPT_STRINGS.keepAppointment)}
                variant="ghost"
                accessibilityLabel={t(APPT_STRINGS.keepAppointment)}
                onPress={() => {
                  setPanel('none');
                  setWriteError(null);
                }}
              />
            </View>
          ) : null}

          {panel === 'reschedule' && isActionableStatus(String(appointment.status)) ? (
            <View
              style={[
                styles.panel,
                { borderColor: theme.line, backgroundColor: theme.bgElevated },
              ]}
            >
              <Text style={[styles.panelTitle, { color: theme.fg }]}>
                {t(APPT_STRINGS.rescheduleTitle)}
              </Text>
              {doctorUserId === null ? (
                <Text style={[styles.error, { color: theme.fgMuted }]}>
                  {t(APPT_STRINGS.rescheduleNeedsDoctor)}
                </Text>
              ) : (
                <>
                  <SlotPicker
                    availability={availability}
                    selectedKey={
                      rescheduleDraft.value.slot
                        ? chunkKey(rescheduleDraft.value.slot)
                        : null
                    }
                    onSelect={(slot) =>
                      rescheduleDraft.setValue({ ...rescheduleDraft.value, slot })
                    }
                  />
                  {rescheduleDraft.value.slot ? (
                    <Text style={[styles.selected, { color: theme.fg }]}>
                      {t(APPT_STRINGS.selectedTime)}:{' '}
                      {formatDate(rescheduleDraft.value.slot.date, lang)} ·{' '}
                      {formatMinuteOfDay(
                        rescheduleDraft.value.slot.startMinuteOfDay,
                        lang,
                      )}
                    </Text>
                  ) : null}
                  <TextField
                    label={t(APPT_STRINGS.rescheduleReasonLabel)}
                    hint={t(APPT_STRINGS.cancelReasonHint)}
                    value={rescheduleDraft.value.reason}
                    onChangeText={(reason) =>
                      rescheduleDraft.setValue({ ...rescheduleDraft.value, reason })
                    }
                    multiline
                  />
                  {writeError ? (
                    <Text style={[styles.error, { color: theme.status.danger }]}>
                      {writeError}
                    </Text>
                  ) : null}
                  <Button
                    title={t(APPT_STRINGS.reschedule)}
                    disabled={!rescheduleValid}
                    loading={rescheduleWrite.busy}
                    accessibilityLabel={t(APPT_STRINGS.reschedule)}
                    onPress={submitReschedule}
                  />
                </>
              )}
              <Button
                title={t(COMMON.cancel)}
                variant="ghost"
                accessibilityLabel={t(COMMON.cancel)}
                onPress={() => {
                  setPanel('none');
                  setWriteError(null);
                }}
              />
            </View>
          ) : null}
        </ScrollView>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: spacing.lg, gap: spacing.md },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  when: { fontSize: fontSize.body, fontWeight: '700', flexShrink: 1 },
  field: { gap: 2 },
  fieldLabel: { fontSize: fontSize.caption, fontWeight: '600', textTransform: 'uppercase' },
  fieldValue: { fontSize: fontSize.body },
  actions: { gap: spacing.sm },
  panel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  panelTitle: { fontSize: fontSize.h3, fontWeight: '700' },
  error: { fontSize: fontSize.bodySm },
  selected: { fontSize: fontSize.bodySm, fontWeight: '600' },
});
