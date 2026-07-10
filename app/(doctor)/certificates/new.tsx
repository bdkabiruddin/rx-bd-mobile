// Doctor medical certificates — issue a certificate.
//
//   Reads:  POST /api/v1/doctors/me/patients/search  (consent-gated picker)
//   Writes: POST /api/v1/medical-certificates        (issueCertificateSchema;
//           doctorUserId pinned from the JWT server-side; idempotent route,
//           NO reverify requirement — mirrors the backend defineRoute config.
//           Death certificates are OUT of scope: they carry the
//           DEATH_CERTIFICATE_ISSUE two-key reverify and a separate module.)
//
// Dates are whole Dhaka calendar days: validFrom = 00:00, validUntil = 23:59
// (inclusive end-of-day), serialized as UTC ISO — the only shape the backend
// zod .datetime() accepts. Accepts an optional ?patientId= search param so
// the patient chart can launch straight into a pre-pinned form.

import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as React from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { MY_CERTIFICATES_KEY } from '@/features/doctor-referrals/hooks';
import {
  CERTIFICATE_TYPES,
  buildCertificateBody,
  makeEmptyCertificateDraft,
  type CertificateDraftValues,
  type CertificateFormIssue,
} from '@/features/doctor-referrals/logic';
import { PatientPickerField } from '@/features/doctor-referrals/PatientPickerField';
import { REF_STR, certificateTypeLabel } from '@/features/doctor-referrals/strings';
import type { IssueCertificateResult } from '@/features/doctor-referrals/types';
import { COMMON, useT } from '@/i18n';
import { useWrite } from '@/offline/useWrite';
import { Button } from '@/ui/Button';
import { ScreenScaffold } from '@/ui/ScreenScaffold';
import { SectionHeader } from '@/ui/SectionHeader';
import { TextField } from '@/ui/TextField';
import { useTheme } from '@/ui/theme';
import { MIN_TOUCH_TARGET, fontSize, radius, spacing } from '@/ui/tokens';
import { useDraft } from '@/ui/useDraft';

export default function NewCertificateScreen(): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useT();

  // Launch-from-chart support: ?patientId=… pins the patient.
  const params = useLocalSearchParams<{ patientId?: string }>();
  const pinnedPatientId =
    typeof params.patientId === 'string' && params.patientId.length > 0
      ? params.patientId
      : undefined;

  const initialDraft = React.useMemo(
    () => makeEmptyCertificateDraft(new Date(), pinnedPatientId),
    [pinnedPatientId],
  );
  const draft = useDraft<CertificateDraftValues>(
    `doctor:certificates:new:${pinnedPatientId ?? 'any'}`,
    initialDraft,
  );
  const d = draft.value;
  const setD = (patch: Partial<CertificateDraftValues>): void =>
    draft.setValue({ ...draft.value, ...patch });

  const write = useWrite<IssueCertificateResult>();
  const [issue, setIssue] = React.useState<CertificateFormIssue | null>(null);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const issueMessage = (i: CertificateFormIssue): string => {
    switch (i.kind) {
      case 'PATIENT_REQUIRED':
        return t(REF_STR.certPatientRequired);
      case 'TYPE_INVALID':
        return t(REF_STR.certTypeInvalid);
      case 'FROM_INVALID':
        return t(REF_STR.certFromInvalid);
      case 'UNTIL_INVALID':
        return t(REF_STR.certUntilInvalid);
      case 'UNTIL_BEFORE_FROM':
        return t(REF_STR.certUntilBeforeFrom);
      case 'REASON_REQUIRED':
        return t(REF_STR.certReasonRequired);
      case 'REASON_TOO_LONG':
        return t(REF_STR.certReasonTooLong);
      case 'RESTRICTIONS_TOO_LONG':
        return t(REF_STR.certRestrictionsTooLong);
    }
  };

  const patientIssue = issue !== null && issue.kind === 'PATIENT_REQUIRED';
  const fromIssue = issue !== null && issue.kind === 'FROM_INVALID';
  const untilIssue =
    issue !== null &&
    (issue.kind === 'UNTIL_INVALID' || issue.kind === 'UNTIL_BEFORE_FROM');
  const reasonIssue =
    issue !== null &&
    (issue.kind === 'REASON_REQUIRED' || issue.kind === 'REASON_TOO_LONG');
  const restrictionsIssue =
    issue !== null && issue.kind === 'RESTRICTIONS_TOO_LONG';

  const submit = async (): Promise<void> => {
    setServerError(null);
    const built = buildCertificateBody(draft.value);
    if (!built.ok) {
      setIssue(built.issue);
      return;
    }
    setIssue(null);
    const res = await write.submit({
      method: 'POST',
      path: '/api/v1/medical-certificates',
      body: built.body,
    });
    if (res.ok) {
      draft.clear();
      draft.setValue(makeEmptyCertificateDraft(new Date(), pinnedPatientId));
      void queryClient.invalidateQueries({ queryKey: [MY_CERTIFICATES_KEY] });
      Alert.alert(t(REF_STR.certificateIssued), undefined, [
        {
          text: t({ en: 'OK', bn: 'ঠিক আছে' }),
          onPress: () =>
            router.canGoBack()
              ? router.back()
              : router.replace('/(doctor)/certificates'),
        },
      ]);
    } else if (res.error.code === 'OFFLINE') {
      setServerError(t(REF_STR.offlineWrite));
    } else {
      setServerError(res.error.message || t(COMMON.genericError));
    }
  };

  const confirmIssue = (): void => {
    setServerError(null);
    const built = buildCertificateBody(draft.value);
    if (!built.ok) {
      setIssue(built.issue);
      return;
    }
    setIssue(null);
    Alert.alert(
      t(REF_STR.confirmCertificateTitle),
      t(REF_STR.confirmCertificateBody),
      [
        { text: t(COMMON.cancel), style: 'cancel' },
        { text: t(COMMON.confirm), onPress: () => void submit() },
      ],
    );
  };

  return (
    <ScreenScaffold phi>
      <SectionHeader title={t(REF_STR.newCertificateTitle)} />
      {!draft.restored ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <PatientPickerField
            selectedPatientId={d.patientId}
            selectedLabel={d.patientLabel}
            onSelect={(patientId, label) =>
              setD({ patientId, patientLabel: label })
            }
            onClear={() => setD({ patientId: '', patientLabel: '' })}
            {...(patientIssue && issue !== null
              ? { error: issueMessage(issue) }
              : {})}
            testIDPrefix="certificate-patient"
          />

          <Text style={[styles.fieldLabel, { color: theme.fg }]}>
            {t(REF_STR.certTypeLabel)}
          </Text>
          <View style={styles.chipWrap}>
            {CERTIFICATE_TYPES.map((type) => {
              const selected = d.certificateType === type;
              return (
                <Pressable
                  key={type}
                  accessibilityRole="button"
                  accessibilityLabel={t(certificateTypeLabel(type))}
                  accessibilityState={{ selected }}
                  onPress={() => setD({ certificateType: type })}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: selected ? theme.accent : theme.bgMuted,
                      borderColor: selected ? theme.accent : theme.line,
                    },
                  ]}
                  testID={`certificate-type-${type}`}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: selected ? theme.accentFg : theme.fg },
                    ]}
                  >
                    {t(certificateTypeLabel(type))}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.dateRow}>
            <View style={styles.dateCol}>
              <TextField
                label={t(REF_STR.certFromLabel)}
                value={d.fromDate}
                onChangeText={(fromDate) => setD({ fromDate })}
                keyboardType="numbers-and-punctuation"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="2026-07-10"
                {...(fromIssue && issue !== null
                  ? { error: issueMessage(issue) }
                  : {})}
                testID="certificate-from"
              />
            </View>
            <View style={styles.dateCol}>
              <TextField
                label={t(REF_STR.certUntilLabel)}
                value={d.untilDate}
                onChangeText={(untilDate) => setD({ untilDate })}
                keyboardType="numbers-and-punctuation"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="2026-07-12"
                {...(untilIssue && issue !== null
                  ? { error: issueMessage(issue) }
                  : {})}
                testID="certificate-until"
              />
            </View>
          </View>
          <Text style={[styles.hint, { color: theme.fgMuted }]}>
            {t(REF_STR.certDatesHint)}
          </Text>

          <TextField
            label={t(REF_STR.certReasonLabel)}
            hint={t(REF_STR.certReasonHint)}
            value={d.reason}
            onChangeText={(reason) => setD({ reason })}
            multiline
            numberOfLines={4}
            maxLength={5000}
            {...(reasonIssue && issue !== null
              ? { error: issueMessage(issue) }
              : {})}
            testID="certificate-reason"
          />

          <TextField
            label={t(REF_STR.certRestrictionsLabel)}
            hint={t(REF_STR.certRestrictionsHint)}
            value={d.restrictions}
            onChangeText={(restrictions) => setD({ restrictions })}
            multiline
            numberOfLines={3}
            maxLength={5000}
            {...(restrictionsIssue && issue !== null
              ? { error: issueMessage(issue) }
              : {})}
            testID="certificate-restrictions"
          />

          {serverError !== null ? (
            <Text style={[styles.error, { color: theme.status.danger }]}>
              {serverError}
            </Text>
          ) : null}

          <Button
            title={t(REF_STR.issueCertificate)}
            loading={write.busy}
            disabled={write.busy}
            accessibilityLabel={t(REF_STR.issueCertificate)}
            testID="issue-certificate"
            onPress={confirmIssue}
          />

          <Button
            title={t(REF_STR.back)}
            variant="ghost"
            accessibilityLabel={t(REF_STR.back)}
            onPress={() =>
              router.canGoBack()
                ? router.back()
                : router.replace('/(doctor)/certificates')
            }
          />
        </ScrollView>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  fieldLabel: { fontSize: fontSize.bodySm, fontWeight: '600' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontSize: fontSize.bodySm, fontWeight: '600' },
  dateRow: { flexDirection: 'row', gap: spacing.sm },
  dateCol: { flex: 1 },
  hint: { fontSize: fontSize.caption },
  error: { fontSize: fontSize.bodySm, fontWeight: '600' },
});
