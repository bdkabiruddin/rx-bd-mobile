// Patient booking wizard — specialty → doctor → time → confirm.
//
//   Reads:  GET /api/v1/specialties                       (public catalog)
//           GET /api/v1/specialties/{code}/doctors        (ACTIVE doctors, public view)
//           GET /api/v1/doctors/{id}/available-slots      (+ chambers + booked-times,
//                                                          via useDoctorAvailability)
//   Write:  POST /api/v1/appointments (scheduleAppointmentSchema) via useWrite.
//
// Multi-step form state autosaves through useDraft (encrypted; survives
// app-kill) and clears after a successful booking. Facility mapping mirrors
// the web wizard's Wave-240 rules (see mapChamberToFacility).

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import * as React from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { newIdempotencyKey } from '@/api/idempotency';
import { useCachedQuery } from '@/api/useCachedQuery';
import { useSession } from '@/auth/sessionStore';
import { COMMON, formatDate, formatPaisa, useT } from '@/i18n';
import { useWrite } from '@/offline/useWrite';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ListRow } from '@/ui/ListRow';
import { ScreenScaffold } from '@/ui/ScreenScaffold';
import { SectionHeader } from '@/ui/SectionHeader';
import { TextField } from '@/ui/TextField';
import { useDraft } from '@/ui/useDraft';
import { fontSize, radius, spacing } from '@/ui/tokens';
import { useTheme } from '@/ui/theme';

import {
  formatMinuteOfDay,
  formatNumber,
  mapChamberToFacility,
  slotIso,
  type BookableSlotChunk,
} from '@/features/patient-appointments/logic';
import { SlotPicker, chunkKey } from '@/features/patient-appointments/SlotPicker';
import { APPT_STRINGS, TYPE_LABELS, labelFor } from '@/features/patient-appointments/strings';
import type {
  AppointmentType,
  BookAppointmentBody,
  BookAppointmentResult,
  DoctorSearchResult,
  SpecialtiesResult,
} from '@/features/patient-appointments/types';
import { useDoctorAvailability } from '@/features/patient-appointments/useDoctorAvailability';

const MIN_REASON_CHARS = 2; // scheduleAppointmentSchema: reason min 2
const TOTAL_STEPS = 4;

interface BookingDraft {
  step: 1 | 2 | 3 | 4;
  specialtyCode: string | null;
  specialtyLabel: string | null;
  doctorUserId: string | null;
  doctorName: string | null;
  feePaisa: string | null;
  slot: BookableSlotChunk | null;
  appointmentType: 'CONSULTATION' | 'FOLLOW_UP';
  reason: string;
}

const EMPTY_DRAFT: BookingDraft = {
  step: 1,
  specialtyCode: null,
  specialtyLabel: null,
  doctorUserId: null,
  doctorName: null,
  feePaisa: null,
  slot: null,
  appointmentType: 'CONSULTATION',
  reason: '',
};

export default function PatientBookAppointment(): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { lang, t } = useT();
  const userId = useSession((s) => s.userId);
  const tenantId = useSession((s) => s.tenantId);

  const draft = useDraft<BookingDraft>('patient:appointments:book', EMPTY_DRAFT);
  const d = draft.value;
  const setD = (patch: Partial<BookingDraft>): void =>
    draft.setValue({ ...draft.value, ...patch });

  const [specialtyFilter, setSpecialtyFilter] = React.useState('');
  const [writeError, setWriteError] = React.useState<string | null>(null);

  // Handler-layer dedupe key for the booking body (the transport
  // Idempotency-Key header is minted/held by useWrite). Stable across
  // retries of this one booking; a fresh screen mount = a fresh action.
  const bodyKeyRef = React.useRef<string>(newIdempotencyKey());
  const write = useWrite<BookAppointmentResult>();

  // ── Step 1 data — specialties ─────────────────────────────────────────
  const specialties = useCachedQuery<SpecialtiesResult>({
    key: 'patient:appointments:specialties',
    path: '/api/v1/specialties',
    ttlMs: 15 * 60 * 1000,
    isPhi: false,
  });

  // ── Step 2 data — doctors for the picked specialty ────────────────────
  // Tenant-scoped server-side; tagging the cache entry with tenantId keeps a
  // tenant switch from replaying another tenant's roster.
  const doctors = useCachedQuery<DoctorSearchResult>({
    key: `patient:appointments:doctors:${d.specialtyCode ?? 'none'}`,
    path: `/api/v1/specialties/${encodeURIComponent(d.specialtyCode ?? '')}/doctors?limit=50`,
    ttlMs: 15 * 60 * 1000,
    isPhi: false,
    enabled: d.specialtyCode !== null,
    ...(tenantId !== null ? { tenantId } : {}),
  });

  // ── Step 3 data — bookable chunks for the picked doctor ───────────────
  const availability = useDoctorAvailability(d.step >= 3 ? d.doctorUserId : null);

  const chosenMapping = React.useMemo(
    () => mapChamberToFacility(d.slot?.chamberId ?? null, availability.chambers),
    [d.slot, availability.chambers],
  );

  const reasonValid = d.reason.trim().length >= MIN_REASON_CHARS;

  const submitBooking = (): void => {
    if (!userId || !d.doctorUserId || !d.slot || !reasonValid) return;
    setWriteError(null);

    const slot = d.slot;
    const duration = slot.endMinuteOfDay - slot.startMinuteOfDay;
    const appointmentType: AppointmentType = chosenMapping.isTeleClinic
      ? 'TELEMEDICINE'
      : d.appointmentType;

    const body: BookAppointmentBody = {
      patientId: userId,
      doctorUserId: d.doctorUserId,
      facilityType: chosenMapping.facilityType,
      ...(chosenMapping.facilityId !== null ? { facilityId: chosenMapping.facilityId } : {}),
      ...(slot.chamberId !== null ? { chamberId: slot.chamberId } : {}),
      scheduledAt: slotIso(slot.date, slot.startMinuteOfDay),
      durationMinutes: duration > 0 ? duration : 30,
      appointmentType,
      reason: d.reason.trim(),
      idempotencyKey: bodyKeyRef.current,
    };

    void (async () => {
      const res = await write.submit({
        method: 'POST',
        path: '/api/v1/appointments',
        body,
      });
      if (res.ok) {
        draft.clear();
        draft.setValue(EMPTY_DRAFT);
        void queryClient.invalidateQueries({ queryKey: ['patient:appointments:list'] });
        const newId = res.value?.appointmentId;
        Alert.alert(t(APPT_STRINGS.bookingConfirmed));
        if (newId) {
          router.replace({
            pathname: '/(patient)/appointments/[id]',
            params: { id: newId, ...(d.doctorName ? { doctorName: d.doctorName } : {}) },
          });
        } else {
          router.replace('/(patient)/appointments');
        }
      } else if (res.error.code === 'OFFLINE') {
        setWriteError(t(APPT_STRINGS.offlineWrite));
      } else if (res.error.code === 'CONFLICT') {
        setWriteError(t(APPT_STRINGS.slotTaken));
      } else {
        setWriteError(res.error.message || t(COMMON.genericError));
      }
    })();
  };

  const goBack = (): void => {
    setWriteError(null);
    if (d.step === 1) {
      router.back();
      return;
    }
    setD({ step: (d.step - 1) as BookingDraft['step'] });
  };

  const stepTitle =
    d.step === 1
      ? t(APPT_STRINGS.chooseSpecialty)
      : d.step === 2
        ? t(APPT_STRINGS.chooseDoctor)
        : d.step === 3
          ? t(APPT_STRINGS.chooseTime)
          : t(APPT_STRINGS.visitDetails);

  const renderStep = (): React.ReactElement => {
    // Wait for the draft restore so a saved draft is never overwritten.
    if (!draft.restored) {
      return (
        <View style={styles.center}>
          <ActivityIndicator color={theme.accent} />
        </View>
      );
    }

    if (d.step === 1) {
      const all = specialties.data?.specialties ?? [];
      const filter = specialtyFilter.trim().toLowerCase();
      const list = filter
        ? all.filter(
            (s) =>
              s.label.toLowerCase().includes(filter) ||
              s.code.toLowerCase().includes(filter),
          )
        : all;
      return (
        <View style={styles.stepBody}>
          <TextField
            label={t(APPT_STRINGS.searchSpecialty)}
            value={specialtyFilter}
            onChangeText={setSpecialtyFilter}
            autoCapitalize="none"
          />
          {specialties.isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={theme.accent} />
            </View>
          ) : specialties.error && !specialties.data ? (
            <EmptyState
              title={t(COMMON.genericError)}
              message={specialties.error.message}
              actionLabel={t(COMMON.retry)}
              onAction={specialties.refetch}
            />
          ) : list.length === 0 ? (
            <EmptyState title={t(COMMON.noData)} />
          ) : (
            <View style={styles.rows}>
              {list.map((s) => (
                <ListRow
                  key={s.code}
                  title={s.label}
                  {...(s.doctorCount !== undefined
                    ? {
                        meta: `${formatNumber(s.doctorCount, lang)} ${t(APPT_STRINGS.doctorsCount)}`,
                      }
                    : {})}
                  accessibilityLabel={s.label}
                  onPress={() =>
                    setD({ specialtyCode: s.code, specialtyLabel: s.label, step: 2 })
                  }
                />
              ))}
            </View>
          )}
        </View>
      );
    }

    if (d.step === 2) {
      const list = (doctors.data?.doctors ?? []).filter((doc) => doc.isActive !== false);
      return (
        <View style={styles.stepBody}>
          {d.specialtyLabel ? (
            <Text style={[styles.context, { color: theme.fgMuted }]}>
              {d.specialtyLabel}
            </Text>
          ) : null}
          {doctors.isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={theme.accent} />
            </View>
          ) : doctors.error && !doctors.data ? (
            <EmptyState
              title={t(COMMON.genericError)}
              message={doctors.error.message}
              actionLabel={t(COMMON.retry)}
              onAction={doctors.refetch}
            />
          ) : list.length === 0 ? (
            <EmptyState title={t(APPT_STRINGS.noDoctors)} />
          ) : (
            <View style={styles.rows}>
              {list.map((doc) => {
                const name = doc.doctorFullName ?? '—';
                const subtitleParts: string[] = [];
                if (doc.yearsOfPractice !== undefined) {
                  subtitleParts.push(
                    `${formatNumber(doc.yearsOfPractice, lang)} ${t(APPT_STRINGS.yearsExperience)}`,
                  );
                }
                if (doc.consultationFeePaisa) {
                  subtitleParts.push(
                    `${t(APPT_STRINGS.consultationFee)}: ${formatPaisa(doc.consultationFeePaisa, lang)}`,
                  );
                }
                return (
                  <ListRow
                    key={doc.userId}
                    title={name}
                    {...(subtitleParts.length > 0
                      ? { subtitle: subtitleParts.join(' · ') }
                      : {})}
                    accessibilityLabel={name}
                    onPress={() =>
                      setD({
                        doctorUserId: doc.userId,
                        doctorName: doc.doctorFullName ?? null,
                        feePaisa: doc.consultationFeePaisa ?? null,
                        slot: null,
                        step: 3,
                      })
                    }
                  />
                );
              })}
            </View>
          )}
        </View>
      );
    }

    if (d.step === 3) {
      return (
        <View style={styles.stepBody}>
          {d.doctorName ? (
            <Text style={[styles.context, { color: theme.fgMuted }]}>{d.doctorName}</Text>
          ) : null}
          <SlotPicker
            availability={availability}
            selectedKey={d.slot ? chunkKey(d.slot) : null}
            onSelect={(slot) => setD({ slot, step: 4 })}
          />
        </View>
      );
    }

    // Step 4 — details + confirm.
    const slot = d.slot;
    return (
      <View style={styles.stepBody}>
        <View
          style={[
            styles.summary,
            { borderColor: theme.line, backgroundColor: theme.bgElevated },
          ]}
        >
          {d.doctorName ? (
            <Text style={[styles.summaryTitle, { color: theme.fg }]}>{d.doctorName}</Text>
          ) : null}
          {slot ? (
            <Text style={[styles.summaryLine, { color: theme.fg }]}>
              {formatDate(slot.date, lang)} · {formatMinuteOfDay(slot.startMinuteOfDay, lang)}
              {chosenMapping.isTeleClinic ? ` · ${t(APPT_STRINGS.videoConsultation)}` : ''}
            </Text>
          ) : null}
          {d.feePaisa ? (
            <Text style={[styles.summaryLine, { color: theme.fgMuted }]}>
              {t(APPT_STRINGS.consultationFee)}: {formatPaisa(d.feePaisa, lang)}
            </Text>
          ) : null}
        </View>

        {!chosenMapping.isTeleClinic ? (
          <View style={styles.typeRow}>
            {(['CONSULTATION', 'FOLLOW_UP'] as const).map((type) => {
              const selected = d.appointmentType === type;
              return (
                <View key={type} style={styles.typeButton}>
                  <Button
                    title={t(labelFor(TYPE_LABELS, type))}
                    variant={selected ? 'default' : 'secondary'}
                    accessibilityLabel={t(labelFor(TYPE_LABELS, type))}
                    onPress={() => setD({ appointmentType: type })}
                  />
                </View>
              );
            })}
          </View>
        ) : null}

        <TextField
          label={t(APPT_STRINGS.reasonForVisit)}
          hint={t(APPT_STRINGS.reasonHint)}
          {...(d.reason.length > 0 && !reasonValid
            ? { error: t(APPT_STRINGS.reasonTooShort) }
            : {})}
          value={d.reason}
          onChangeText={(reason) => setD({ reason })}
          multiline
        />

        {writeError ? (
          <Text style={[styles.error, { color: theme.status.danger }]}>{writeError}</Text>
        ) : null}

        <Button
          title={t(APPT_STRINGS.confirmBooking)}
          disabled={!userId || !d.doctorUserId || !slot || !reasonValid}
          loading={write.busy}
          accessibilityLabel={t(APPT_STRINGS.confirmBooking)}
          testID="confirm-booking"
          onPress={submitBooking}
        />
      </View>
    );
  };

  return (
    <ScreenScaffold phi>
      <SectionHeader
        title={t(APPT_STRINGS.bookAppointment)}
        right={
          <Text style={[styles.step, { color: theme.fgMuted }]}>
            {t(APPT_STRINGS.stepOf)} {formatNumber(d.step, lang)}/{formatNumber(TOTAL_STEPS, lang)}
          </Text>
        }
      />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={[styles.stepTitle, { color: theme.fg }]}>{stepTitle}</Text>
        {renderStep()}
        <View style={styles.footer}>
          <Button
            title={t(APPT_STRINGS.back)}
            variant="ghost"
            accessibilityLabel={t(APPT_STRINGS.back)}
            onPress={goBack}
          />
        </View>
      </ScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.md },
  stepTitle: { fontSize: fontSize.h3, fontWeight: '700' },
  step: { fontSize: fontSize.bodySm, fontWeight: '600' },
  stepBody: { gap: spacing.md },
  center: { paddingVertical: spacing.xl, alignItems: 'center' },
  rows: { gap: spacing.sm },
  context: { fontSize: fontSize.bodySm, fontWeight: '600' },
  summary: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  summaryTitle: { fontSize: fontSize.body, fontWeight: '700' },
  summaryLine: { fontSize: fontSize.bodySm },
  typeRow: { flexDirection: 'row', gap: spacing.sm },
  typeButton: { flex: 1 },
  error: { fontSize: fontSize.bodySm },
  footer: { marginTop: spacing.sm },
});
