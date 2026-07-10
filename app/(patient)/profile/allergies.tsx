// My allergies — clinical-safety data (feeds the prescribing/dispense
// allergy interlock on the backend). Active allergies render prominently
// with danger-tone severity pills, most severe first; removals are
// Alert-confirmed and are honestly labelled "mark resolved" — the backend
// DELETE soft-resolves (the row stays in the record; it never hard-deletes).
//
//   Read:  GET    /api/v1/me/allergies          → { allergies: AllergyView[] }
//   Write: POST   /api/v1/me/allergies          (recordAllergySchema)
//          DELETE /api/v1/me/allergies/{id}     (resolve own ACTIVE allergy)

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

import { ALLERGIES_KEY, useMyAllergies } from '@/features/patient-profile/hooks';
import {
  ALLERGY_SEVERITIES,
  allergySeverityTone,
  buildRecordAllergyBody,
  emptyAllergyForm,
  partitionAllergies,
  type AllergyFormIssue,
  type AllergyFormValues,
} from '@/features/patient-profile/logic';
import { PickerChip } from '@/features/patient-profile/PickerChip';
import { PROFILE_STR, severityLabel } from '@/features/patient-profile/strings';
import type {
  AllergyView,
  RecordAllergyResponse,
  ResolveAllergyResponse,
} from '@/features/patient-profile/types';
import { COMMON, formatDate, useT } from '@/i18n';
import { useWrite } from '@/offline/useWrite';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { FreshnessBadge } from '@/ui/FreshnessBadge';
import { ScreenScaffold } from '@/ui/ScreenScaffold';
import { SectionHeader } from '@/ui/SectionHeader';
import { StatusPill } from '@/ui/StatusPill';
import { TextField } from '@/ui/TextField';
import { useDraft } from '@/ui/useDraft';
import { useTheme } from '@/ui/theme';
import { fontSize, radius, spacing } from '@/ui/tokens';

export default function MyAllergies(): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { lang, t } = useT();

  const allergiesQ = useMyAllergies();

  const [formOpen, setFormOpen] = React.useState(false);
  const draft = useDraft<AllergyFormValues>('patient:profile:allergy-add', emptyAllergyForm());
  const d = draft.value;
  const setD = (patch: Partial<AllergyFormValues>): void =>
    draft.setValue({ ...draft.value, ...patch });
  const [issue, setIssue] = React.useState<AllergyFormIssue | null>(null);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const addWrite = useWrite<RecordAllergyResponse>();
  const resolveWrite = useWrite<ResolveAllergyResponse>();

  const issueText = (i: AllergyFormIssue): string => {
    switch (i.field) {
      case 'allergen':
        return t(PROFILE_STR.allergenRequired);
      case 'severity':
        return t(PROFILE_STR.severityRequired);
      case 'onsetDate':
        return t(PROFILE_STR.onsetInvalid);
    }
  };

  const onSaveAllergy = async (): Promise<void> => {
    setServerError(null);
    const built = buildRecordAllergyBody(draft.value, Date.now());
    if (!built.ok) {
      setIssue(built.issue);
      return;
    }
    setIssue(null);
    const res = await addWrite.submit({
      method: 'POST',
      path: '/api/v1/me/allergies',
      body: built.body,
    });
    if (res.ok) {
      draft.clear();
      draft.setValue(emptyAllergyForm());
      setFormOpen(false);
      void queryClient.invalidateQueries({ queryKey: [ALLERGIES_KEY] });
      Alert.alert(t(PROFILE_STR.allergySaved));
    } else if (res.error.code === 'OFFLINE') {
      setServerError(t(PROFILE_STR.offlineWrite));
    } else {
      setServerError(res.error.message || t(COMMON.genericError));
    }
  };

  const onResolve = (allergy: AllergyView): void => {
    Alert.alert(t(PROFILE_STR.resolveTitle), t(PROFILE_STR.resolveBody), [
      { text: t(COMMON.cancel), style: 'cancel' },
      {
        text: t(PROFILE_STR.markResolved),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const res = await resolveWrite.submit({
              method: 'DELETE',
              path: `/api/v1/me/allergies/${encodeURIComponent(allergy.id)}`,
            });
            if (res.ok) {
              void queryClient.invalidateQueries({ queryKey: [ALLERGIES_KEY] });
            } else if (res.error.code === 'OFFLINE') {
              Alert.alert(t(COMMON.offline), t(PROFILE_STR.offlineWrite));
            } else {
              Alert.alert(t(COMMON.genericError), res.error.message);
            }
          })();
        },
      },
    ]);
  };

  const list = allergiesQ.data?.allergies;
  const { active, resolved } = React.useMemo(
    () => partitionAllergies(list ?? []),
    [list],
  );

  const renderCard = (a: AllergyView, isActive: boolean): React.ReactElement => (
    <View
      key={a.id}
      style={[
        styles.card,
        {
          borderColor: isActive ? theme.status.danger : theme.line,
          backgroundColor: theme.bgElevated,
        },
      ]}
      testID={`allergy-${a.id}`}
    >
      <View style={styles.cardHeader}>
        <Text style={[styles.allergen, { color: theme.fg }]} numberOfLines={2}>
          {a.allergenDisplay}
        </Text>
        <StatusPill
          label={t(severityLabel(a.severity))}
          tone={isActive ? allergySeverityTone(a.severity) : 'neutral'}
        />
      </View>
      {a.reaction ? (
        <Text style={[styles.reaction, { color: theme.fgMuted }]} numberOfLines={3}>
          {a.reaction}
        </Text>
      ) : null}
      <View style={styles.cardFooter}>
        {a.createdAt ? (
          <Text style={[styles.meta, { color: theme.fgSubtle }]}>
            {t(PROFILE_STR.recordedOn)}: {formatDate(a.createdAt, lang)}
          </Text>
        ) : (
          <View />
        )}
        {isActive ? (
          <Button
            title={t(PROFILE_STR.markResolved)}
            variant="ghost"
            accessibilityLabel={`${t(PROFILE_STR.markResolved)} — ${a.allergenDisplay}`}
            disabled={resolveWrite.busy}
            onPress={() => onResolve(a)}
          />
        ) : null}
      </View>
    </View>
  );

  return (
    <ScreenScaffold phi>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <SectionHeader
          title={t(PROFILE_STR.allergiesTitle)}
          right={<FreshnessBadge fetchedAt={allergiesQ.fetchedAt} />}
        />
        <Text style={[styles.safetyNote, { color: theme.fgMuted }]}>
          {t(PROFILE_STR.allergiesSafetyNote)}
        </Text>

        {allergiesQ.isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        ) : allergiesQ.error && allergiesQ.data === undefined ? (
          <EmptyState
            title={t(COMMON.genericError)}
            message={allergiesQ.error.message}
            actionLabel={t(COMMON.retry)}
            onAction={allergiesQ.refetch}
          />
        ) : active.length === 0 && resolved.length === 0 ? (
          <EmptyState
            title={t(PROFILE_STR.noAllergies)}
            message={t(PROFILE_STR.noAllergiesHint)}
            actionLabel={t(PROFILE_STR.addAllergy)}
            onAction={() => setFormOpen(true)}
          />
        ) : (
          <View style={styles.listWrap}>
            {active.length > 0 ? (
              <>
                <Text style={[styles.groupLabel, { color: theme.fg }]}>
                  {t(PROFILE_STR.activeAllergies)}
                </Text>
                {active.map((a) => renderCard(a, true))}
              </>
            ) : null}
            {resolved.length > 0 ? (
              <>
                <Text style={[styles.groupLabel, { color: theme.fgMuted }]}>
                  {t(PROFILE_STR.resolvedAllergies)}
                </Text>
                {resolved.map((a) => renderCard(a, false))}
              </>
            ) : null}
          </View>
        )}

        {formOpen ? (
          <View style={styles.form}>
            {!draft.restored ? (
              <ActivityIndicator />
            ) : (
              <>
                <TextField
                  label={t(PROFILE_STR.allergenLabel)}
                  hint={t(PROFILE_STR.allergenHint)}
                  value={d.allergen}
                  onChangeText={(allergen) => setD({ allergen })}
                  maxLength={255}
                  {...(issue?.field === 'allergen' ? { error: issueText(issue) } : {})}
                  testID="allergy-allergen"
                />
                <Text style={[styles.groupLabel, { color: theme.fg }]}>
                  {t(PROFILE_STR.severityLabel)}
                </Text>
                <View style={styles.chipRow}>
                  {ALLERGY_SEVERITIES.map((s) => (
                    <PickerChip
                      key={s}
                      label={t(severityLabel(s))}
                      selected={d.severity === s}
                      testID={`severity-${s}`}
                      onPress={() => setD({ severity: s })}
                    />
                  ))}
                </View>
                {issue?.field === 'severity' ? (
                  <Text style={[styles.error, { color: theme.status.danger }]}>
                    {issueText(issue)}
                  </Text>
                ) : null}
                <TextField
                  label={t(PROFILE_STR.reactionLabel)}
                  hint={t(PROFILE_STR.reactionHint)}
                  value={d.reaction}
                  onChangeText={(reaction) => setD({ reaction })}
                  maxLength={1000}
                  multiline
                  testID="allergy-reaction"
                />
                <TextField
                  label={t(PROFILE_STR.onsetLabel)}
                  value={d.onsetDate}
                  onChangeText={(onsetDate) => setD({ onsetDate })}
                  keyboardType="numbers-and-punctuation"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="2020-01-15"
                  {...(issue?.field === 'onsetDate' ? { error: issueText(issue) } : {})}
                  testID="allergy-onset"
                />
                {serverError !== null ? (
                  <Text style={[styles.error, { color: theme.status.danger }]}>
                    {serverError}
                  </Text>
                ) : null}
                <Button
                  title={t(PROFILE_STR.saveAllergy)}
                  loading={addWrite.busy}
                  disabled={addWrite.busy}
                  accessibilityLabel={t(PROFILE_STR.saveAllergy)}
                  testID="save-allergy"
                  onPress={() => void onSaveAllergy()}
                />
                <Button
                  title={t(COMMON.cancel)}
                  variant="ghost"
                  accessibilityLabel={t(COMMON.cancel)}
                  onPress={() => {
                    setIssue(null);
                    setServerError(null);
                    setFormOpen(false);
                  }}
                />
              </>
            )}
          </View>
        ) : (
          <View style={styles.form}>
            <Button
              title={t(PROFILE_STR.addAllergy)}
              accessibilityLabel={t(PROFILE_STR.addAllergy)}
              testID="add-allergy"
              onPress={() => setFormOpen(true)}
            />
            <Button
              title={t(PROFILE_STR.back)}
              variant="ghost"
              accessibilityLabel={t(PROFILE_STR.back)}
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace('/(patient)/profile')
              }
            />
          </View>
        )}
      </ScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl },
  center: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  safetyNote: { fontSize: fontSize.bodySm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  listWrap: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  groupLabel: { fontSize: fontSize.bodySm, fontWeight: '700', marginTop: spacing.sm },
  card: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  allergen: { fontSize: fontSize.body, fontWeight: '700', flexShrink: 1 },
  reaction: { fontSize: fontSize.bodySm },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  meta: { fontSize: fontSize.caption },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  form: { padding: spacing.lg, gap: spacing.md },
  error: { fontSize: fontSize.bodySm, fontWeight: '600' },
});
