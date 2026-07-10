// Add vital reading — patient self-service entry.
//
//   Write: POST /api/v1/patients/{userId}/vitals (recordVitalReadingSchema)
//          via useWrite; body built + validated in
//          src/features/patient-vitals/logic.ts, which mirrors the backend
//          VitalReading factory (plausibility ranges, BP two-limb rule,
//          ordinal-zero pain exemption). source is pinned 'PATIENT' — the
//          backend refuses anything else for the PATIENT role.
//
// Form state autosaves through useDraft (encrypted; survives app-kill) and
// clears after a successful save. Measured-at defaults to now (Dhaka).

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import * as React from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { VITALS_LIST_KEY } from '@/features/patient-vitals/hooks';
import {
  ENTRY_UNITS,
  PATIENT_ENTRY_TYPES,
  buildRecordVitalBody,
  dhakaDateTimeParts,
  formatVitalNumber,
  isBloodPressure,
  makeEmptyDraft,
  unitSymbol,
  type VitalDraftValues,
  type VitalFormIssue,
} from '@/features/patient-vitals/logic';
import { SelectableChip } from '@/features/patient-vitals/SelectableChip';
import { VITALS_STR, rangeErrorLabel, vitalTypeLabel } from '@/features/patient-vitals/strings';
import type { RecordVitalResponse } from '@/features/patient-vitals/types';
import { COMMON, useT } from '@/i18n';
import { useSession } from '@/auth/sessionStore';
import { useWrite } from '@/offline/useWrite';
import { Button } from '@/ui/Button';
import { ScreenScaffold } from '@/ui/ScreenScaffold';
import { SectionHeader } from '@/ui/SectionHeader';
import { TextField } from '@/ui/TextField';
import { useTheme } from '@/ui/theme';
import { useDraft } from '@/ui/useDraft';
import { fontSize, spacing } from '@/ui/tokens';

export default function AddVitalReading(): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { lang, t } = useT();
  const userId = useSession((s) => s.userId);

  // Fresh drafts default measured-at to "now" once per mount; a restored
  // draft keeps whatever the user had typed.
  const initialDraft = React.useMemo(() => makeEmptyDraft(new Date()), []);
  const draft = useDraft<VitalDraftValues>('patient:vitals:add', initialDraft);
  const d = draft.value;
  const setD = (patch: Partial<VitalDraftValues>): void =>
    draft.setValue({ ...draft.value, ...patch });

  const [issue, setIssue] = React.useState<VitalFormIssue | null>(null);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const write = useWrite<RecordVitalResponse>();

  const isBp = isBloodPressure(d.vitalType);
  // A restored draft is untyped at runtime — widen the lookup so a stale
  // vital type (app-version drift) degrades to a plain label, not a crash.
  const entryUnit = ENTRY_UNITS[d.vitalType] as string | undefined;
  const unitSym = entryUnit !== undefined ? unitSymbol(entryUnit) : '';

  const issueMessage = (i: VitalFormIssue): string => {
    switch (i.kind) {
      case 'VALUE_REQUIRED':
        return t(VITALS_STR.valueRequired);
      case 'VALUE_INVALID':
        return t(VITALS_STR.valueInvalid);
      case 'DIASTOLIC_REQUIRED':
        return t(VITALS_STR.diastolicRequired);
      case 'RANGE':
        return t(
          rangeErrorLabel(
            formatVitalNumber(i.min, lang),
            formatVitalNumber(i.max, lang),
            unitSym,
          ),
        );
      case 'DATETIME_INVALID':
        return t(VITALS_STR.datetimeInvalid);
      case 'DATETIME_FUTURE':
        return t(VITALS_STR.datetimeFuture);
    }
  };

  const valueIssue =
    issue !== null &&
    (issue.kind === 'VALUE_REQUIRED' ||
      issue.kind === 'VALUE_INVALID' ||
      issue.kind === 'DIASTOLIC_REQUIRED' ||
      (issue.kind === 'RANGE' && issue.field === 'value'));
  const diastolicIssue =
    issue !== null && issue.kind === 'RANGE' && issue.field === 'diastolic';
  const datetimeIssue =
    issue !== null &&
    (issue.kind === 'DATETIME_INVALID' || issue.kind === 'DATETIME_FUTURE');

  const pickType = (vitalType: (typeof PATIENT_ENTRY_TYPES)[number]): void => {
    if (vitalType === d.vitalType) return;
    // Units differ per type — clear values so nothing carries over wrongly.
    setD({ vitalType, value: '', secondary: '' });
    setIssue(null);
    setServerError(null);
  };

  const setMeasuredNow = (): void => {
    const { date, time } = dhakaDateTimeParts(new Date());
    setD({ date, time });
    setIssue(null);
  };

  const onSave = async (): Promise<void> => {
    setServerError(null);
    const built = buildRecordVitalBody(draft.value, Date.now());
    if (!built.ok) {
      setIssue(built.issue);
      return;
    }
    setIssue(null);
    if (userId === null) {
      setServerError(t(COMMON.sessionExpired));
      return;
    }
    const res = await write.submit({
      method: 'POST',
      path: `/api/v1/patients/${userId}/vitals`,
      body: built.body,
    });
    if (res.ok) {
      draft.clear();
      draft.setValue(makeEmptyDraft(new Date()));
      void queryClient.invalidateQueries({ queryKey: [VITALS_LIST_KEY] });
      Alert.alert(t(VITALS_STR.readingSaved));
      router.replace('/(patient)/vitals');
    } else if (res.error.code === 'OFFLINE') {
      setServerError(t(VITALS_STR.offlineWrite));
    } else {
      setServerError(res.error.message || t(COMMON.genericError));
    }
  };

  const valueLabel =
    d.vitalType === 'PAIN_SCORE'
      ? t(VITALS_STR.painValueLabel)
      : unitSym.length > 0
        ? `${t(VITALS_STR.valueLabel)} (${unitSym})`
        : t(VITALS_STR.valueLabel);

  return (
    <ScreenScaffold phi>
      <SectionHeader title={t(VITALS_STR.addReading)} />
      {!draft.restored ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={[styles.fieldLabel, { color: theme.fg }]}>
            {t(VITALS_STR.readingType)}
          </Text>
          <View style={styles.typeGrid}>
            {PATIENT_ENTRY_TYPES.map((type) => (
              <SelectableChip
                key={type}
                label={t(vitalTypeLabel(type))}
                selected={d.vitalType === type}
                role="radio"
                testID={`vital-type-${type}`}
                onPress={() => pickType(type)}
              />
            ))}
          </View>

          {isBp ? (
            <View style={styles.bpRow}>
              <View style={styles.bpField}>
                <TextField
                  label={t(VITALS_STR.systolic)}
                  value={d.value}
                  onChangeText={(value) => setD({ value })}
                  keyboardType="decimal-pad"
                  {...(valueIssue && issue !== null ? { error: issueMessage(issue) } : {})}
                  testID="vital-value"
                />
              </View>
              <View style={styles.bpField}>
                <TextField
                  label={t(VITALS_STR.diastolic)}
                  value={d.secondary}
                  onChangeText={(secondary) => setD({ secondary })}
                  keyboardType="decimal-pad"
                  {...(diastolicIssue && issue !== null ? { error: issueMessage(issue) } : {})}
                  testID="vital-secondary"
                />
              </View>
            </View>
          ) : (
            <TextField
              label={valueLabel}
              value={d.value}
              onChangeText={(value) => setD({ value })}
              keyboardType="decimal-pad"
              {...(d.vitalType === 'PAIN_SCORE' ? { hint: t(VITALS_STR.painHint) } : {})}
              {...(valueIssue && issue !== null ? { error: issueMessage(issue) } : {})}
              testID="vital-value"
            />
          )}

          <Text style={[styles.fieldLabel, { color: theme.fg }]}>
            {t(VITALS_STR.measuredAt)}
          </Text>
          <View style={styles.dtRow}>
            <View style={styles.dtDate}>
              <TextField
                label={t(VITALS_STR.dateLabel)}
                value={d.date}
                onChangeText={(date) => setD({ date })}
                keyboardType="numbers-and-punctuation"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="2026-07-10"
                {...(datetimeIssue && issue !== null ? { error: issueMessage(issue) } : {})}
                testID="vital-date"
              />
            </View>
            <View style={styles.dtTime}>
              <TextField
                label={t(VITALS_STR.timeLabel)}
                value={d.time}
                onChangeText={(time) => setD({ time })}
                keyboardType="numbers-and-punctuation"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="14:30"
                testID="vital-time"
              />
            </View>
          </View>
          <Button
            title={t(VITALS_STR.setToNow)}
            variant="secondary"
            accessibilityLabel={t(VITALS_STR.setToNow)}
            onPress={setMeasuredNow}
          />

          <TextField
            label={t(VITALS_STR.notesLabel)}
            hint={t(VITALS_STR.notesHint)}
            value={d.notes}
            onChangeText={(notes) => setD({ notes })}
            maxLength={2000}
            multiline
            testID="vital-notes"
          />

          <Text style={[styles.selfNote, { color: theme.fgMuted }]}>
            {t(VITALS_STR.selfReportedNote)}
          </Text>

          {serverError !== null ? (
            <Text style={[styles.error, { color: theme.status.danger }]}>{serverError}</Text>
          ) : null}
          {issue !== null && !valueIssue && !diastolicIssue && !datetimeIssue ? (
            <Text style={[styles.error, { color: theme.status.danger }]}>
              {issueMessage(issue)}
            </Text>
          ) : null}

          <Button
            title={t(VITALS_STR.saveReading)}
            loading={write.busy}
            disabled={write.busy}
            accessibilityLabel={t(VITALS_STR.saveReading)}
            testID="save-vital"
            onPress={() => void onSave()}
          />
          <Button
            title={t(VITALS_STR.back)}
            variant="ghost"
            accessibilityLabel={t(VITALS_STR.back)}
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace('/(patient)/vitals')
            }
          />
        </ScrollView>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { fontSize: fontSize.bodySm, fontWeight: '600' },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  bpRow: { flexDirection: 'row', gap: spacing.sm },
  bpField: { flex: 1 },
  dtRow: { flexDirection: 'row', gap: spacing.sm },
  dtDate: { flex: 3 },
  dtTime: { flex: 2 },
  selfNote: { fontSize: fontSize.bodySm },
  error: { fontSize: fontSize.bodySm, fontWeight: '600' },
});
