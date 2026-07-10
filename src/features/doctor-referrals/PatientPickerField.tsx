// PatientPickerField — consent-gated patient selection for the referral /
// certificate forms. Renders the selected patient (initials + short id —
// the search projection NEVER carries display names, so none are shown or
// invented) or a debounced search box over the doctor's own panel.
//
// Non-virtualized result rows on purpose: the field lives inside the form's
// ScrollView, and the panel search returns a small consent-filtered set.

import * as React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useT } from '@/i18n';
import { Button } from '@/ui/Button';
import { TextField } from '@/ui/TextField';
import { useTheme } from '@/ui/theme';
import { MIN_TOUCH_TARGET, fontSize, radius, spacing } from '@/ui/tokens';

import { isSearchable, joinParts, localizeDigits, shortPatientRef } from './logic';
import { REF_STR } from './strings';
import type { PickerPatient } from './types';
import { usePatientPicker } from './usePatientPicker';

/** Display label for a picked row — initials token + short id, never a name. */
export function pickerPatientLabel(p: PickerPatient): string {
  return joinParts([p.initials ?? null, shortPatientRef(p.patientId)]);
}

export function PatientPickerField({
  selectedPatientId,
  selectedLabel,
  onSelect,
  onClear,
  error,
  testIDPrefix,
}: {
  /** Currently selected patient id ('' / null = none). */
  selectedPatientId: string | null;
  /** Display label captured at selection time (may be empty for a patient
   *  pinned via route param — falls back to the short id). */
  selectedLabel: string | null;
  onSelect: (patientId: string, label: string) => void;
  onClear: () => void;
  error?: string;
  testIDPrefix: string;
}): React.ReactElement {
  const theme = useTheme();
  const { lang, t } = useT();
  const [query, setQuery] = React.useState('');
  const search = usePatientPicker(query);

  const hasSelection =
    selectedPatientId !== null && selectedPatientId.trim().length > 0;

  if (hasSelection) {
    const label =
      selectedLabel !== null && selectedLabel.trim().length > 0
        ? selectedLabel
        : (shortPatientRef(selectedPatientId ?? undefined) ?? '');
    return (
      <View style={styles.wrap}>
        <Text style={[styles.label, { color: theme.fg }]}>
          {t(REF_STR.patientSelected)}
        </Text>
        <View
          style={[
            styles.selectedRow,
            { borderColor: theme.line, backgroundColor: theme.bgElevated },
          ]}
          testID={`${testIDPrefix}-selected`}
        >
          <Text style={[styles.selectedText, { color: theme.fg }]} numberOfLines={1}>
            {`${t(REF_STR.patientRef)} ${label}`}
          </Text>
          <Button
            title={t(REF_STR.changePatient)}
            variant="ghost"
            accessibilityLabel={t(REF_STR.changePatient)}
            testID={`${testIDPrefix}-change`}
            onPress={onClear}
          />
        </View>
      </View>
    );
  }

  const searching = isSearchable(query);

  return (
    <View style={styles.wrap}>
      <TextField
        label={t(REF_STR.patientSearchLabel)}
        {...(error !== undefined ? { error } : { hint: t(REF_STR.patientSearchHint) })}
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
        testID={`${testIDPrefix}-search`}
      />

      {searching && search.phase === 'searching' ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : null}

      {searching && search.phase === 'error' ? (
        <View style={styles.stateBox}>
          <Text style={[styles.stateTitle, { color: theme.fg }]}>
            {search.error?.code === 'FORBIDDEN'
              ? t(REF_STR.searchLocked)
              : (search.error?.message ?? t(REF_STR.noPatientMatches))}
          </Text>
          {search.error?.code === 'FORBIDDEN' ? (
            <Text style={[styles.stateHint, { color: theme.fgMuted }]}>
              {t(REF_STR.searchLockedHint)}
            </Text>
          ) : null}
        </View>
      ) : null}

      {searching && search.phase === 'ready' && search.results.length === 0 ? (
        <View style={styles.stateBox}>
          <Text style={[styles.stateTitle, { color: theme.fg }]}>
            {t(REF_STR.noPatientMatches)}
          </Text>
          <Text style={[styles.stateHint, { color: theme.fgMuted }]}>
            {t(REF_STR.noPatientMatchesHint)}
          </Text>
        </View>
      ) : null}

      {searching && search.phase === 'ready' && search.results.length > 0 ? (
        <View style={[styles.resultBox, { borderColor: theme.line }]}>
          {search.results.map((p) => {
            const label = pickerPatientLabel(p);
            const age =
              p.ageBracket !== undefined && p.ageBracket !== 'unknown'
                ? `${t(REF_STR.age)} ${localizeDigits(p.ageBracket, lang)}`
                : null;
            return (
              <Pressable
                key={p.patientId}
                accessibilityRole="button"
                accessibilityLabel={`${t(REF_STR.patientRef)} ${label}`}
                style={({ pressed }) => [
                  styles.resultRow,
                  { backgroundColor: theme.bgElevated },
                  pressed && { opacity: 0.85 },
                ]}
                testID={`${testIDPrefix}-result-${p.patientId}`}
                onPress={() => onSelect(p.patientId, label)}
              >
                <Text style={[styles.resultTitle, { color: theme.fg }]} numberOfLines={1}>
                  {`${t(REF_STR.patientRef)} ${label}`}
                </Text>
                {age !== null ? (
                  <Text style={[styles.resultMeta, { color: theme.fgMuted }]}>{age}</Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: { fontSize: fontSize.bodySm, fontWeight: '600' },
  selectedRow: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
  },
  selectedText: { flex: 1, fontSize: fontSize.body, fontWeight: '600' },
  center: { alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  stateBox: { padding: spacing.md, gap: 2 },
  stateTitle: { fontSize: fontSize.bodySm, fontWeight: '600' },
  stateHint: { fontSize: fontSize.caption },
  resultBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  resultRow: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: 2,
  },
  resultTitle: { fontSize: fontSize.bodySm, fontWeight: '600' },
  resultMeta: { fontSize: fontSize.caption },
});
