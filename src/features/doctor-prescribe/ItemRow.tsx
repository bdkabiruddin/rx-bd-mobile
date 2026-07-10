// One medication row of the prescribe composer: catalog-backed drug
// search (type-ahead over GET /drug-catalog), strength / dose / duration /
// route / instructions fields and the controlled-vocabulary frequency
// picker (charter §3.3 — no free-text frequency path on mobile).

import * as React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import { useT } from '@/i18n';
import { Button } from '@/ui/Button';
import { TextField } from '@/ui/TextField';
import { useTheme } from '@/ui/theme';
import { fontSize, MIN_TOUCH_TARGET, radius, spacing } from '@/ui/tokens';

import { FREQUENCY_CODES, itemIssues, joinParts } from './logic';
import { itemIssueLabel, itemTitle, STR } from './strings';
import type { ComposeItem, DrugCatalogPayload, DrugLite } from './types';

const SEARCH_DEBOUNCE_MS = 350;
const SEARCH_MIN_CHARS = 2;

export interface ItemRowProps {
  index: number;
  item: ComposeItem;
  /** True once the doctor tried to sign/dry-run — surfaces field issues. */
  showIssues: boolean;
  onPatch: (index: number, patch: Partial<ComposeItem>) => void;
  onRemove: (index: number) => void;
}

export function ItemRow({
  index,
  item,
  showIssues,
  onPatch,
  onRemove,
}: ItemRowProps): React.ReactElement {
  const { lang, t } = useT();
  const theme = useTheme();

  const [drugFocused, setDrugFocused] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<DrugLite[]>([]);
  // Debounce timer + request sequence — search runs from the text-change
  // handler (not an effect), so a suggestion tap never re-triggers it.
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const seqRef = React.useRef(0);

  React.useEffect(
    () => () => {
      seqRef.current += 1;
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    },
    [],
  );

  const onDrugText = (value: string): void => {
    onPatch(index, { drugName: value });
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    const query = value.trim();
    if (query.length < SEARCH_MIN_CHARS) {
      seqRef.current += 1;
      setSuggestions([]);
      return;
    }
    const seq = (seqRef.current += 1);
    timerRef.current = setTimeout(() => {
      void (async () => {
        const res = await api.get<DrugCatalogPayload>(
          `/api/v1/drug-catalog?q=${encodeURIComponent(query.slice(0, 100))}&limit=8`,
        );
        if (seqRef.current !== seq) return;
        // Search failures degrade silently to manual entry — the field is
        // free-text per the backend schema; nothing is fabricated.
        setSuggestions(res.ok ? (res.value?.drugs ?? []) : []);
      })();
    }, SEARCH_DEBOUNCE_MS);
  };

  const pickDrug = (drug: DrugLite): void => {
    seqRef.current += 1;
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    setSuggestions([]);
    onPatch(index, {
      drugName: drug.genericName ?? drug.brandName ?? '',
      ...(drug.strengthDisplay !== undefined
        ? { strength: drug.strengthDisplay }
        : {}),
      ...(item.route.trim().length === 0 && drug.routeOfAdmin !== undefined
        ? { route: drug.routeOfAdmin }
        : {}),
    });
  };

  const issues = showIssues ? itemIssues(item) : [];

  return (
    <View
      style={[
        styles.card,
        { borderColor: theme.line, backgroundColor: theme.bgElevated },
      ]}
    >
      <View style={styles.head}>
        <Text style={[styles.headTitle, { color: theme.fg }]}>
          {itemTitle(index + 1, lang)}
        </Text>
        <Button
          title={t(STR.removeItem)}
          variant="ghost"
          accessibilityLabel={`${t(STR.removeItem)} — ${itemTitle(index + 1, lang)}`}
          testID={`remove-item-${index}`}
          onPress={() => onRemove(index)}
        />
      </View>

      <TextField
        label={t(STR.drugLabel)}
        value={item.drugName}
        onChangeText={onDrugText}
        onFocus={() => setDrugFocused(true)}
        onBlur={() => setDrugFocused(false)}
        autoCapitalize="none"
        autoCorrect={false}
        hint={t(STR.drugHint)}
        testID={`drug-name-${index}`}
      />

      {drugFocused && suggestions.length > 0 ? (
        <View style={[styles.suggestBox, { borderColor: theme.lineStrong }]}>
          {suggestions.map((drug) => (
            <Pressable
              key={drug.id}
              accessibilityRole="button"
              accessibilityLabel={joinParts([
                drug.tallManName ?? drug.genericName,
                drug.strengthDisplay,
              ])}
              onPress={() => pickDrug(drug)}
              style={({ pressed }) => [
                styles.suggestRow,
                { backgroundColor: pressed ? theme.bgMuted : theme.bgElevated },
              ]}
            >
              {/* Charter §3.1 — render the Tall-Man cased name. */}
              <Text style={[styles.suggestTitle, { color: theme.fg }]}>
                {drug.tallManName ?? drug.genericName ?? drug.brandName ?? '—'}
              </Text>
              <Text style={[styles.suggestMeta, { color: theme.fgMuted }]}>
                {joinParts([drug.brandName, drug.strengthDisplay, drug.dosageForm])}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <TextField
        label={t(STR.strengthLabel)}
        value={item.strength}
        onChangeText={(v) => onPatch(index, { strength: v })}
        autoCapitalize="none"
        testID={`strength-${index}`}
      />
      <TextField
        label={t(STR.doseLabel)}
        value={item.dose}
        onChangeText={(v) => onPatch(index, { dose: v })}
        autoCapitalize="none"
        testID={`dose-${index}`}
      />

      {/* Controlled frequency vocabulary — chips, no free text. */}
      <Text style={[styles.freqLabel, { color: theme.fg }]}>
        {t(STR.frequencyLabel)}
      </Text>
      <View style={styles.freqWrap}>
        {FREQUENCY_CODES.map((code) => {
          const selected = item.frequency.trim().toUpperCase() === code;
          return (
            <Pressable
              key={code}
              accessibilityRole="button"
              accessibilityLabel={`${t(STR.frequencyLabel)} ${code}`}
              accessibilityState={{ selected }}
              onPress={() => onPatch(index, { frequency: code })}
              style={[
                styles.freqChip,
                {
                  backgroundColor: selected ? theme.accent : theme.bgMuted,
                  borderColor: selected ? theme.accent : theme.line,
                },
              ]}
              testID={`freq-${index}-${code}`}
            >
              <Text
                style={[
                  styles.freqText,
                  { color: selected ? theme.accentFg : theme.fg },
                ]}
              >
                {code}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <TextField
        label={t(STR.durationLabel)}
        value={item.durationDays}
        onChangeText={(v) => onPatch(index, { durationDays: v })}
        keyboardType="number-pad"
        testID={`duration-${index}`}
      />
      <TextField
        label={t(STR.routeLabel)}
        value={item.route}
        onChangeText={(v) => onPatch(index, { route: v })}
        autoCapitalize="none"
        testID={`route-${index}`}
      />
      <TextField
        label={t(STR.instructionsLabel)}
        value={item.instructions}
        onChangeText={(v) => onPatch(index, { instructions: v })}
        multiline
        testID={`instructions-${index}`}
      />

      {issues.map((issue) => (
        <Text
          key={issue}
          style={[styles.issue, { color: theme.status.danger }]}
          accessibilityRole="alert"
        >
          {t(itemIssueLabel(issue))}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headTitle: { fontSize: fontSize.body, fontWeight: '700' },
  suggestBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  suggestRow: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: 2,
  },
  suggestTitle: { fontSize: fontSize.bodySm, fontWeight: '600' },
  suggestMeta: { fontSize: fontSize.caption },
  freqLabel: { fontSize: fontSize.bodySm, fontWeight: '600' },
  freqWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  freqChip: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  freqText: { fontSize: fontSize.bodySm, fontWeight: '600' },
  issue: { fontSize: fontSize.caption },
});
