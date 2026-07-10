// Edit patient profile — PUT /api/v1/me/patient-profile (partial upsert:
// absent = unchanged, null = clear; body mirrors upsertMyPatientProfileSchema
// via buildUpsertProfileBody in the feature logic).
//
// The response is the backend PatientProfileView; when this write set a
// national identifier the MPI dedup probe may return possibleDuplicates —
// surfaced as a review notice (staff review + link; not a hard block).
//
// Form state autosaves through useDraft (encrypted; survives app-kill) and
// is seeded from the server profile once, only while the form is untouched.

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import * as React from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PROFILE_KEY, useMyPatientProfile } from '@/features/patient-profile/hooks';
import {
  buildUpsertProfileBody,
  emptyProfileForm,
  isEmptyProfileForm,
  seedProfileForm,
  type ProfileFormIssue,
  type ProfileFormValues,
} from '@/features/patient-profile/logic';
import { PickerChip } from '@/features/patient-profile/PickerChip';
import { PROFILE_STR, genderLabel, lactationLabel } from '@/features/patient-profile/strings';
import type {
  BloodType,
  FhirGender,
  LactationStatus,
  PatientProfileView,
} from '@/features/patient-profile/types';
import { COMMON, useT } from '@/i18n';
import { useWrite } from '@/offline/useWrite';
import { Button } from '@/ui/Button';
import { ScreenScaffold } from '@/ui/ScreenScaffold';
import { SectionHeader } from '@/ui/SectionHeader';
import { TextField } from '@/ui/TextField';
import { useDraft } from '@/ui/useDraft';
import { useTheme } from '@/ui/theme';
import { fontSize, spacing } from '@/ui/tokens';

const GENDER_OPTIONS: readonly FhirGender[] = ['male', 'female', 'other', 'unknown'];
const BLOOD_OPTIONS: readonly { value: BloodType; label: string }[] = [
  { value: 'A_POS', label: 'A+' },
  { value: 'A_NEG', label: 'A−' },
  { value: 'B_POS', label: 'B+' },
  { value: 'B_NEG', label: 'B−' },
  { value: 'AB_POS', label: 'AB+' },
  { value: 'AB_NEG', label: 'AB−' },
  { value: 'O_POS', label: 'O+' },
  { value: 'O_NEG', label: 'O−' },
];
const LACTATION_OPTIONS: readonly LactationStatus[] = [
  'LACTATING',
  'NOT_LACTATING',
  'UNKNOWN',
];

export default function EditPatientProfile(): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useT();

  const profileQ = useMyPatientProfile();
  const profile = profileQ.data?.profile ?? null;

  const draft = useDraft<ProfileFormValues>('patient:profile:edit', emptyProfileForm());
  const d = draft.value;
  const setD = (patch: Partial<ProfileFormValues>): void =>
    draft.setValue({ ...draft.value, ...patch });

  // Seed the form from the server profile exactly once — and only while the
  // restored draft is still untouched, so in-progress edits always win. The
  // ref guard makes the effect a no-op on every later render.
  const seededRef = React.useRef(false);
  React.useEffect(() => {
    if (seededRef.current || !draft.restored || profileQ.isLoading) return;
    seededRef.current = true;
    if (profile && isEmptyProfileForm(draft.value)) {
      draft.setValue(seedProfileForm(profile));
    }
  }, [draft, profile, profileQ.isLoading]);

  const [issue, setIssue] = React.useState<ProfileFormIssue | null>(null);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const write = useWrite<PatientProfileView>();

  const issueText = (i: ProfileFormIssue): string => {
    switch (i.field) {
      case 'birthDate':
        return i.kind === 'FUTURE'
          ? t(PROFILE_STR.birthDateFuture)
          : t(PROFILE_STR.birthDateInvalid);
      case 'heightCm':
        return t(PROFILE_STR.heightInvalid);
      case 'nationalId':
        return t(PROFILE_STR.nidInvalid);
      case 'birthRegNo':
        return t(PROFILE_STR.brnInvalid);
      case 'healthId':
        return t(PROFILE_STR.healthIdInvalid);
    }
  };

  const onSave = async (): Promise<void> => {
    setServerError(null);
    const built = buildUpsertProfileBody(draft.value, profile, Date.now());
    if (!built.ok) {
      setIssue(built.issue);
      return;
    }
    setIssue(null);
    const res = await write.submit({
      method: 'PUT',
      path: '/api/v1/me/patient-profile',
      body: built.body,
    });
    if (res.ok) {
      draft.clear();
      void queryClient.invalidateQueries({ queryKey: [PROFILE_KEY] });
      const duplicates = res.value?.possibleDuplicates;
      if (duplicates && duplicates.length > 0) {
        // MPI dedup review notice (backend semantics: staff review + link;
        // never a hard block on the patient's own save).
        Alert.alert(t(PROFILE_STR.duplicateTitle), t(PROFILE_STR.duplicateBody), [
          { text: t(COMMON.confirm), onPress: () => router.back() },
        ]);
      } else {
        Alert.alert(t(PROFILE_STR.profileSaved));
        router.back();
      }
    } else if (res.error.code === 'OFFLINE') {
      setServerError(t(PROFILE_STR.offlineWrite));
    } else {
      setServerError(res.error.message || t(COMMON.genericError));
    }
  };

  const ready = draft.restored && !profileQ.isLoading;

  return (
    <ScreenScaffold phi>
      <SectionHeader title={t(PROFILE_STR.editTitle)} />
      {!ready ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TextField
            label={t(PROFILE_STR.birthDateLabel)}
            value={d.birthDate}
            onChangeText={(birthDate) => setD({ birthDate })}
            keyboardType="numbers-and-punctuation"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="1990-01-25"
            {...(issue?.field === 'birthDate' ? { error: issueText(issue) } : {})}
            testID="profile-birthdate"
          />

          <Text style={[styles.fieldLabel, { color: theme.fg }]}>{t(PROFILE_STR.gender)}</Text>
          <View style={styles.chipRow}>
            {GENDER_OPTIONS.map((g) => (
              <PickerChip
                key={g}
                label={t(genderLabel(g))}
                selected={d.gender === g}
                testID={`gender-${g}`}
                onPress={() => setD({ gender: d.gender === g ? '' : g })}
              />
            ))}
          </View>

          <Text style={[styles.fieldLabel, { color: theme.fg }]}>{t(PROFILE_STR.bloodGroup)}</Text>
          <View style={styles.chipRow}>
            {BLOOD_OPTIONS.map((b) => (
              <PickerChip
                key={b.value}
                label={b.label}
                selected={d.bloodType === b.value}
                testID={`blood-${b.value}`}
                onPress={() => setD({ bloodType: d.bloodType === b.value ? '' : b.value })}
              />
            ))}
          </View>

          <Text style={[styles.fieldLabel, { color: theme.fg }]}>{t(PROFILE_STR.lactation)}</Text>
          <View style={styles.chipRow}>
            {LACTATION_OPTIONS.map((l) => (
              <PickerChip
                key={l}
                label={t(lactationLabel(l))}
                selected={d.lactationStatus === l}
                testID={`lactation-${l}`}
                onPress={() => setD({ lactationStatus: d.lactationStatus === l ? '' : l })}
              />
            ))}
          </View>

          <TextField
            label={t(PROFILE_STR.heightLabel)}
            value={d.heightCm}
            onChangeText={(heightCm) => setD({ heightCm })}
            keyboardType="decimal-pad"
            {...(issue?.field === 'heightCm' ? { error: issueText(issue) } : {})}
            testID="profile-height"
          />
          <TextField
            label={t(PROFILE_STR.nidLabel)}
            value={d.nationalId}
            onChangeText={(nationalId) => setD({ nationalId })}
            keyboardType="number-pad"
            {...(issue?.field === 'nationalId' ? { error: issueText(issue) } : {})}
            testID="profile-nid"
          />
          <TextField
            label={t(PROFILE_STR.brnLabel)}
            value={d.birthRegNo}
            onChangeText={(birthRegNo) => setD({ birthRegNo })}
            keyboardType="number-pad"
            {...(issue?.field === 'birthRegNo' ? { error: issueText(issue) } : {})}
            testID="profile-brn"
          />
          <TextField
            label={t(PROFILE_STR.healthIdLabel)}
            value={d.healthId}
            onChangeText={(healthId) => setD({ healthId })}
            autoCapitalize="characters"
            autoCorrect={false}
            {...(issue?.field === 'healthId' ? { error: issueText(issue) } : {})}
            testID="profile-healthid"
          />

          <Text style={[styles.hint, { color: theme.fgMuted }]}>
            {t(PROFILE_STR.clearFieldHint)}
          </Text>

          {serverError !== null ? (
            <Text style={[styles.error, { color: theme.status.danger }]}>{serverError}</Text>
          ) : null}

          <Button
            title={t(PROFILE_STR.saveProfile)}
            loading={write.busy}
            disabled={write.busy}
            accessibilityLabel={t(PROFILE_STR.saveProfile)}
            testID="save-profile"
            onPress={() => void onSave()}
          />
          <Button
            title={t(PROFILE_STR.back)}
            variant="ghost"
            accessibilityLabel={t(PROFILE_STR.back)}
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace('/(patient)/profile')
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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  hint: { fontSize: fontSize.caption },
  error: { fontSize: fontSize.bodySm, fontWeight: '600' },
});
