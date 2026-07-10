// OrderForm — the lab-order compose body for ONE selected patient.
//
// The parent (app/(doctor)/orders/new.tsx) mounts this with
// key={patientId}, so switching patients remounts the form and drafts can
// NEVER bleed across patients (the draft key is patient-scoped too —
// defence in depth for a clinical-safety hazard).
//
//   GET  /api/v1/lab-test-catalog?q=&limit=       test picker (non-PHI)
//   GET  /api/v1/diagnostic-centres/directory     centre picker (non-PHI)
//   POST /api/v1/diagnostic-centres/{id}/lab-orders  place (idempotent write)

import { useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';

import { COMMON, useT } from '@/i18n';
import { useWrite } from '@/offline/useWrite';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ListRow } from '@/ui/ListRow';
import { StatusPill } from '@/ui/StatusPill';
import { TextField } from '@/ui/TextField';
import { useDraft } from '@/ui/useDraft';
import { useTheme } from '@/ui/theme';
import { fontSize, spacing } from '@/ui/tokens';

import { DOCTOR_ORDERS_KEY, useCatalogDefaults, useCentresDirectory } from './hooks';
import {
  MAX_NOTES_LEN,
  buildPlaceOrderBody,
  catalogEntryLabel,
  emptyOrderDraft,
  filterCentres,
  formatNumber,
  isSearchable,
  isTestSelected,
  joinParts,
  toggleTest,
  type OrderDraftValues,
  type OrderFormIssue,
} from './logic';
import { useCatalogSearch } from './search';
import { ORD_STR, priorityLabel } from './strings';
import type { CatalogEntry, CentreRow, PlaceLabOrderResult } from './types';

const PRIORITIES = ['ROUTINE', 'URGENT', 'STAT'] as const;
const CENTRE_LIST_MAX = 20;

export function OrderForm({
  patientId,
  onPlaced,
}: {
  patientId: string;
  /** Called after the server confirmed the order (navigate away). */
  onPlaced: () => void;
}): React.ReactElement {
  const theme = useTheme();
  const { lang, t } = useT();
  const queryClient = useQueryClient();

  // ── Draft (encrypted, patient-scoped, survives app-kill/lock) ──────────
  const draft = useDraft<OrderDraftValues>(
    `doctor:orders:new:${patientId}`,
    emptyOrderDraft(),
  );
  const d = draft.value;
  const setD = (patch: Partial<OrderDraftValues>): void =>
    draft.setValue({ ...draft.value, ...patch });

  // ── Test catalog (defaults + type-ahead) ────────────────────────────────
  const [testQuery, setTestQuery] = React.useState('');
  const searchingTests = isSearchable(testQuery);
  const catalogSearch = useCatalogSearch(testQuery);
  const catalogDefaults = useCatalogDefaults(!searchingTests);
  const suggestions: CatalogEntry[] = searchingTests
    ? catalogSearch.results
    : (catalogDefaults.data?.entries ?? []).filter(
        (e): e is CatalogEntry => typeof e?.code === 'string' && e.code.length > 0,
      );

  // ── Centres ─────────────────────────────────────────────────────────────
  const [centreQuery, setCentreQuery] = React.useState('');
  const centresQ = useCentresDirectory(true);
  const centres = React.useMemo(
    () =>
      (centresQ.data?.centres ?? []).filter(
        (c): c is CentreRow => typeof c?.centreId === 'string' && c.centreId.length > 0,
      ),
    [centresQ.data],
  );
  const selectedCentre = centres.find((c) => c.centreId === d.centreId) ?? null;
  const filteredCentres = filterCentres(centres, centreQuery);
  const visibleCentres = filteredCentres.slice(0, CENTRE_LIST_MAX);

  // ── Submit ──────────────────────────────────────────────────────────────
  const placeWrite = useWrite<PlaceLabOrderResult>();
  const [issue, setIssue] = React.useState<OrderFormIssue | null>(null);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const issueMessage = (i: OrderFormIssue): string => {
    switch (i.kind) {
      case 'NO_PATIENT':
        return t(ORD_STR.needPatient);
      case 'NO_TESTS':
        return t(ORD_STR.needTests);
      case 'NO_CENTRE':
        return t(ORD_STR.needCentre);
      case 'NOTES_TOO_LONG':
        return t(ORD_STR.notesTooLong);
    }
  };

  const submitOrder = async (): Promise<void> => {
    const built = buildPlaceOrderBody(patientId, draft.value);
    if (!built.ok) {
      setIssue(built.issue);
      return;
    }
    setIssue(null);
    setServerError(null);
    const res = await placeWrite.submit({
      method: 'POST',
      path: `/api/v1/diagnostic-centres/${encodeURIComponent(built.centreId)}/lab-orders`,
      body: built.body,
    });
    if (res.ok) {
      draft.clear();
      void queryClient.invalidateQueries({ queryKey: [DOCTOR_ORDERS_KEY] });
      Alert.alert(t(ORD_STR.orderPlaced), undefined, [
        { text: t(COMMON.confirm), onPress: onPlaced },
      ]);
    } else if (res.error.code === 'OFFLINE') {
      setServerError(t(ORD_STR.offlineWrite));
    } else {
      setServerError(res.error.message || t(COMMON.genericError));
    }
  };

  const confirmOrder = (): void => {
    setServerError(null);
    const built = buildPlaceOrderBody(patientId, draft.value);
    if (!built.ok) {
      setIssue(built.issue);
      return;
    }
    setIssue(null);
    const summary = joinParts([
      built.body.tests.map((x) => x.name).join(', '),
      selectedCentre?.name ?? null,
      t(priorityLabel(d.priority)),
    ]);
    Alert.alert(t(ORD_STR.confirmOrderTitle), summary, [
      { text: t(COMMON.cancel), style: 'cancel' },
      { text: t(COMMON.confirm), onPress: () => void submitOrder() },
    ]);
  };

  if (!draft.restored) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  // ── Suggestion list body (honest states) ───────────────────────────────
  let suggestionBody: React.ReactNode;
  if (searchingTests && catalogSearch.phase === 'searching') {
    suggestionBody = (
      <View style={styles.centerSm}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  } else if (searchingTests && catalogSearch.phase === 'error') {
    suggestionBody = (
      <EmptyState
        title={t(ORD_STR.catalogUnavailable)}
        {...(catalogSearch.error ? { message: catalogSearch.error.message } : {})}
        actionLabel={t(COMMON.retry)}
        onAction={catalogSearch.retry}
      />
    );
  } else if (searchingTests && suggestions.length === 0) {
    suggestionBody = (
      <EmptyState title={t(ORD_STR.noTestsFound)} message={t(ORD_STR.noTestsFoundHint)} />
    );
  } else if (!searchingTests && catalogDefaults.isLoading) {
    suggestionBody = (
      <View style={styles.centerSm}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  } else if (suggestions.length === 0) {
    // Default slice unavailable (offline first run / server issue) — the
    // doctor can still type to search; say so honestly.
    suggestionBody = (
      <Text style={[styles.hint, { color: theme.fgMuted }]}>
        {t(ORD_STR.searchTestsHint)}
      </Text>
    );
  } else {
    suggestionBody = (
      <View style={styles.rows}>
        {suggestions.map((entry) => {
          const selected = isTestSelected(d.tests, entry.code);
          const label = catalogEntryLabel(entry, lang);
          return (
            <ListRow
              key={entry.code}
              title={label}
              subtitle={joinParts([entry.code, entry.specimenType ?? null])}
              chevron={false}
              {...(selected
                ? { right: <StatusPill label={t(ORD_STR.selectedPill)} tone="success" /> }
                : {})}
              accessibilityLabel={`${selected ? t(ORD_STR.removeTest) : t(ORD_STR.addTest)} · ${label}`}
              testID={`test-option-${entry.code}`}
              onPress={() => setD({ tests: toggleTest(d.tests, entry) })}
            />
          );
        })}
      </View>
    );
  }

  const notesIssue = issue !== null && issue.kind === 'NOTES_TOO_LONG';

  return (
    <View style={styles.form}>
      {/* ── Tests ─────────────────────────────────────────────────────── */}
      <Text accessibilityRole="header" style={[styles.sectionTitle, { color: theme.fg }]}>
        {t(ORD_STR.testsSection)}
      </Text>

      {d.tests.length > 0 ? (
        <View style={styles.rows}>
          <Text style={[styles.subLabel, { color: theme.fgMuted }]}>
            {`${t(ORD_STR.selectedTests)} (${formatNumber(d.tests.length, lang)})`}
          </Text>
          {d.tests.map((test) => (
            <ListRow
              key={test.code}
              title={test.name}
              subtitle={test.code}
              chevron={false}
              right={
                <Button
                  title={t(ORD_STR.removeTest)}
                  variant="ghost"
                  accessibilityLabel={`${t(ORD_STR.removeTest)} · ${test.name}`}
                  testID={`remove-test-${test.code}`}
                  onPress={() =>
                    setD({ tests: d.tests.filter((x) => x.code !== test.code) })
                  }
                />
              }
            />
          ))}
        </View>
      ) : null}
      {issue !== null && issue.kind === 'NO_TESTS' ? (
        <Text style={[styles.error, { color: theme.status.danger }]}>
          {issueMessage(issue)}
        </Text>
      ) : null}

      <TextField
        label={t(ORD_STR.searchTestsLabel)}
        hint={t(ORD_STR.searchTestsHint)}
        value={testQuery}
        onChangeText={setTestQuery}
        autoCapitalize="none"
        autoCorrect={false}
        testID="test-search"
      />
      {suggestionBody}

      {/* ── Diagnostic centre ─────────────────────────────────────────── */}
      <Text accessibilityRole="header" style={[styles.sectionTitle, { color: theme.fg }]}>
        {t(ORD_STR.centreSection)}
      </Text>
      {selectedCentre !== null ? (
        <ListRow
          title={selectedCentre.name ?? selectedCentre.centreId}
          subtitle={joinParts([selectedCentre.city ?? null, selectedCentre.district ?? null])}
          chevron={false}
          right={
            <Button
              title={t(ORD_STR.changeCentre)}
              variant="ghost"
              accessibilityLabel={`${t(ORD_STR.changeCentre)} · ${t(ORD_STR.centreSection)}`}
              testID="change-centre"
              onPress={() => setD({ centreId: '' })}
            />
          }
        />
      ) : centresQ.isLoading ? (
        <View style={styles.centerSm}>
          <ActivityIndicator color={theme.accent} />
        </View>
      ) : centresQ.error && centres.length === 0 ? (
        <EmptyState
          title={t(COMMON.genericError)}
          message={centresQ.error.message}
          actionLabel={t(COMMON.retry)}
          onAction={centresQ.refetch}
        />
      ) : centres.length === 0 ? (
        <EmptyState title={t(ORD_STR.noCentres)} message={t(ORD_STR.noCentresHint)} />
      ) : (
        <View style={styles.rows}>
          <TextField
            label={t(ORD_STR.centreFilterLabel)}
            value={centreQuery}
            onChangeText={setCentreQuery}
            autoCapitalize="none"
            autoCorrect={false}
            testID="centre-filter"
          />
          {visibleCentres.map((centre) => (
            <ListRow
              key={centre.centreId}
              title={centre.name ?? centre.centreId}
              subtitle={joinParts([centre.city ?? null, centre.district ?? null])}
              chevron={false}
              accessibilityLabel={`${t(ORD_STR.centreSection)} · ${centre.name ?? centre.centreId}`}
              testID={`centre-option-${centre.centreId}`}
              onPress={() => setD({ centreId: centre.centreId })}
            />
          ))}
          {filteredCentres.length > CENTRE_LIST_MAX ? (
            <Text style={[styles.hint, { color: theme.fgMuted }]}>
              {t(ORD_STR.moreCentresHint)}
            </Text>
          ) : null}
        </View>
      )}
      {issue !== null && issue.kind === 'NO_CENTRE' ? (
        <Text style={[styles.error, { color: theme.status.danger }]}>
          {issueMessage(issue)}
        </Text>
      ) : null}

      {/* ── Priority ──────────────────────────────────────────────────── */}
      <Text accessibilityRole="header" style={[styles.sectionTitle, { color: theme.fg }]}>
        {t(ORD_STR.prioritySection)}
      </Text>
      <View style={styles.priorityRow}>
        {PRIORITIES.map((p) => (
          <View key={p} style={styles.priorityItem}>
            <Button
              title={t(priorityLabel(p))}
              variant={d.priority === p ? 'default' : 'secondary'}
              accessibilityLabel={`${t(ORD_STR.prioritySection)} · ${t(priorityLabel(p))}`}
              testID={`priority-${p}`}
              onPress={() => setD({ priority: p })}
            />
          </View>
        ))}
      </View>

      {/* ── Clinical notes ─────────────────────────────────────────────── */}
      <TextField
        label={t(ORD_STR.notesLabel)}
        hint={t(ORD_STR.notesHint)}
        value={d.notes}
        onChangeText={(notes) => setD({ notes })}
        maxLength={MAX_NOTES_LEN}
        multiline
        {...(notesIssue && issue !== null ? { error: issueMessage(issue) } : {})}
        testID="order-notes"
      />

      {serverError !== null ? (
        <Text style={[styles.error, { color: theme.status.danger }]}>{serverError}</Text>
      ) : null}

      <Button
        title={t(ORD_STR.placeOrder)}
        loading={placeWrite.busy}
        disabled={placeWrite.busy}
        accessibilityLabel={t(ORD_STR.placeOrder)}
        testID="place-order"
        onPress={confirmOrder}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  center: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  centerSm: { alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  rows: { gap: spacing.sm },
  sectionTitle: { fontSize: fontSize.h3, fontWeight: '700', marginTop: spacing.sm },
  subLabel: { fontSize: fontSize.bodySm, fontWeight: '600' },
  hint: { fontSize: fontSize.bodySm },
  error: { fontSize: fontSize.bodySm, fontWeight: '600' },
  priorityRow: { flexDirection: 'row', gap: spacing.sm },
  priorityItem: { flex: 1 },
});
