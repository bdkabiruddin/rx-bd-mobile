// Doctor referrals — issue a referral letter.
//
//   Reads:  POST /api/v1/doctors/me/patients/search  (consent-gated picker)
//   Writes: POST /api/v1/referrals                   (issueReferralSchema;
//           doctorUserId pinned from the JWT server-side; idempotent route,
//           NO reverify requirement — mirrors the backend defineRoute config)
//
// Accepts an optional ?patientId= search param so the patient chart can
// launch straight into a pre-pinned form. The whole draft autosaves via
// useDraft (encrypted, survives app-kill/lock), keyed per launch context.

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

import { MY_REFERRALS_KEY } from '@/features/doctor-referrals/hooks';
import {
  REFERRAL_TYPES,
  REFERRAL_URGENCIES,
  buildReferralBody,
  makeEmptyReferralDraft,
  type ReferralDraftValues,
  type ReferralFormIssue,
} from '@/features/doctor-referrals/logic';
import { PatientPickerField } from '@/features/doctor-referrals/PatientPickerField';
import {
  REF_STR,
  referralTypeLabel,
  referralUrgencyLabel,
} from '@/features/doctor-referrals/strings';
import type { IssueReferralResult } from '@/features/doctor-referrals/types';
import { COMMON, useT } from '@/i18n';
import { useWrite } from '@/offline/useWrite';
import { Button } from '@/ui/Button';
import { ScreenScaffold } from '@/ui/ScreenScaffold';
import { SectionHeader } from '@/ui/SectionHeader';
import { TextField } from '@/ui/TextField';
import { useTheme } from '@/ui/theme';
import { MIN_TOUCH_TARGET, fontSize, radius, spacing } from '@/ui/tokens';
import { useDraft } from '@/ui/useDraft';

export default function NewReferralScreen(): React.ReactElement {
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

  const draft = useDraft<ReferralDraftValues>(
    `doctor:referrals:new:${pinnedPatientId ?? 'any'}`,
    makeEmptyReferralDraft(pinnedPatientId),
  );
  const d = draft.value;
  const setD = (patch: Partial<ReferralDraftValues>): void =>
    draft.setValue({ ...draft.value, ...patch });

  const write = useWrite<IssueReferralResult>();
  const [issue, setIssue] = React.useState<ReferralFormIssue | null>(null);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const issueMessage = (i: ReferralFormIssue): string => {
    switch (i.kind) {
      case 'PATIENT_REQUIRED':
        return t(REF_STR.refPatientRequired);
      case 'TYPE_INVALID':
        return t(REF_STR.refTypeInvalid);
      case 'URGENCY_INVALID':
        return t(REF_STR.refUrgencyInvalid);
      case 'REASON_REQUIRED':
        return t(REF_STR.refReasonRequired);
      case 'REASON_TOO_LONG':
        return t(REF_STR.refReasonTooLong);
      case 'SPECIALTY_TOO_LONG':
        return t(REF_STR.refSpecialtyTooLong);
      case 'CONTEXT_TOO_LONG':
        return t(REF_STR.refContextTooLong);
      case 'VALIDITY_INVALID':
        return t(REF_STR.refValidityInvalid);
    }
  };

  const patientIssue = issue !== null && issue.kind === 'PATIENT_REQUIRED';
  const reasonIssue =
    issue !== null &&
    (issue.kind === 'REASON_REQUIRED' || issue.kind === 'REASON_TOO_LONG');
  const specialtyIssue = issue !== null && issue.kind === 'SPECIALTY_TOO_LONG';
  const contextIssue = issue !== null && issue.kind === 'CONTEXT_TOO_LONG';
  const validityIssue = issue !== null && issue.kind === 'VALIDITY_INVALID';

  const submit = async (): Promise<void> => {
    setServerError(null);
    const built = buildReferralBody(draft.value);
    if (!built.ok) {
      setIssue(built.issue);
      return;
    }
    setIssue(null);
    const res = await write.submit({
      method: 'POST',
      path: '/api/v1/referrals',
      body: built.body,
    });
    if (res.ok) {
      draft.clear();
      draft.setValue(makeEmptyReferralDraft(pinnedPatientId));
      void queryClient.invalidateQueries({ queryKey: [MY_REFERRALS_KEY] });
      Alert.alert(t(REF_STR.referralIssued), undefined, [
        {
          text: t({ en: 'OK', bn: 'ঠিক আছে' }),
          onPress: () =>
            router.canGoBack()
              ? router.back()
              : router.replace('/(doctor)/referrals'),
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
    const built = buildReferralBody(draft.value);
    if (!built.ok) {
      setIssue(built.issue);
      return;
    }
    setIssue(null);
    Alert.alert(t(REF_STR.confirmReferralTitle), t(REF_STR.confirmReferralBody), [
      { text: t(COMMON.cancel), style: 'cancel' },
      { text: t(COMMON.confirm), onPress: () => void submit() },
    ]);
  };

  const chip = (
    selected: boolean,
    label: string,
    onPress: () => void,
    testID: string,
  ): React.ReactElement => (
    <Pressable
      key={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? theme.accent : theme.bgMuted,
          borderColor: selected ? theme.accent : theme.line,
        },
      ]}
      testID={testID}
    >
      <Text style={[styles.chipText, { color: selected ? theme.accentFg : theme.fg }]}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <ScreenScaffold phi>
      <SectionHeader title={t(REF_STR.newReferralTitle)} />
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
            testIDPrefix="referral-patient"
          />

          <Text style={[styles.fieldLabel, { color: theme.fg }]}>
            {t(REF_STR.referralTypeLabel)}
          </Text>
          <View style={styles.chipWrap}>
            {REFERRAL_TYPES.map((type) =>
              chip(
                d.referralType === type,
                t(referralTypeLabel(type)),
                () => setD({ referralType: type }),
                `referral-type-${type}`,
              ),
            )}
          </View>

          <Text style={[styles.fieldLabel, { color: theme.fg }]}>
            {t(REF_STR.urgencyLabel)}
          </Text>
          <View style={styles.chipWrap}>
            {REFERRAL_URGENCIES.map((urgency) =>
              chip(
                d.urgency === urgency,
                t(referralUrgencyLabel(urgency)),
                () => setD({ urgency }),
                `referral-urgency-${urgency}`,
              ),
            )}
          </View>

          <TextField
            label={t(REF_STR.specialtyLabel)}
            hint={t(REF_STR.specialtyHint)}
            value={d.targetSpecialty}
            onChangeText={(targetSpecialty) => setD({ targetSpecialty })}
            maxLength={200}
            {...(specialtyIssue && issue !== null
              ? { error: issueMessage(issue) }
              : {})}
            testID="referral-specialty"
          />

          <TextField
            label={t(REF_STR.reasonLabel)}
            hint={t(REF_STR.reasonHint)}
            value={d.reason}
            onChangeText={(reason) => setD({ reason })}
            multiline
            numberOfLines={4}
            maxLength={5000}
            {...(reasonIssue && issue !== null
              ? { error: issueMessage(issue) }
              : {})}
            testID="referral-reason"
          />

          <TextField
            label={t(REF_STR.contextLabel)}
            hint={t(REF_STR.contextHint)}
            value={d.clinicalContext}
            onChangeText={(clinicalContext) => setD({ clinicalContext })}
            multiline
            numberOfLines={3}
            maxLength={5000}
            {...(contextIssue && issue !== null
              ? { error: issueMessage(issue) }
              : {})}
            testID="referral-context"
          />

          <TextField
            label={t(REF_STR.validityLabel)}
            hint={t(REF_STR.validityHint)}
            value={d.validityDays}
            onChangeText={(validityDays) => setD({ validityDays })}
            keyboardType="number-pad"
            maxLength={3}
            {...(validityIssue && issue !== null
              ? { error: issueMessage(issue) }
              : {})}
            testID="referral-validity"
          />

          {serverError !== null ? (
            <Text style={[styles.error, { color: theme.status.danger }]}>
              {serverError}
            </Text>
          ) : null}

          <Button
            title={t(REF_STR.issueReferral)}
            loading={write.busy}
            disabled={write.busy}
            accessibilityLabel={t(REF_STR.issueReferral)}
            testID="issue-referral"
            onPress={confirmIssue}
          />

          <Button
            title={t(REF_STR.back)}
            variant="ghost"
            accessibilityLabel={t(REF_STR.back)}
            onPress={() =>
              router.canGoBack()
                ? router.back()
                : router.replace('/(doctor)/referrals')
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
  error: { fontSize: fontSize.bodySm, fontWeight: '600' },
});
