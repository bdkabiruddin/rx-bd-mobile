// New lab order — patient (route param or panel search) → tests →
// centre → priority → notes → confirm → place.
//
// Entry points:
//   - Orders tab "New lab order" button (no param → panel search here)
//   - PatientSummary "New lab order" CTA — pushes /(doctor)/orders/new
//     with a `patientId` search param (see doctor-patients feature)
//
//   POST /api/v1/doctors/me/patients/search           patient picker
//   POST /api/v1/diagnostic-centres/{id}/lab-orders   submit (via OrderForm)
//
// The compose body (OrderForm) mounts with key={patientId} so drafts can
// never bleed across patients.

import { useLocalSearchParams, useRouter } from 'expo-router';
import * as React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { OrderForm } from '@/features/doctor-orders/OrderForm';
import { isSearchable, joinParts, shortPatientRef } from '@/features/doctor-orders/logic';
import { usePanelPatientSearch } from '@/features/doctor-orders/search';
import { ORD_STR } from '@/features/doctor-orders/strings';
import type { SearchPatientRow } from '@/features/doctor-orders/types';
import { COMMON, formatDate, useT } from '@/i18n';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ListRow } from '@/ui/ListRow';
import { ScreenScaffold } from '@/ui/ScreenScaffold';
import { SectionHeader } from '@/ui/SectionHeader';
import { TextField } from '@/ui/TextField';
import { useTheme } from '@/ui/theme';
import { fontSize, spacing } from '@/ui/tokens';

/** How the patient was chosen. 'param' defers to the route search param;
 *  'picked' is an explicit in-screen selection; 'searching' shows the
 *  picker even when a param exists (the doctor tapped Change). */
type PatientChoice =
  | { kind: 'param' }
  | { kind: 'picked'; patientId: string }
  | { kind: 'searching' };

export default function DoctorNewOrder(): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  const { lang, t } = useT();

  const params = useLocalSearchParams<{ patientId: string }>();
  const paramPatientId =
    typeof params.patientId === 'string' && params.patientId.length > 0
      ? params.patientId
      : null;

  const [choice, setChoice] = React.useState<PatientChoice>({ kind: 'param' });
  const patientId =
    choice.kind === 'picked'
      ? choice.patientId
      : choice.kind === 'param'
        ? paramPatientId
        : null;

  const [query, setQuery] = React.useState('');
  const search = usePanelPatientSearch(patientId === null ? query : '');

  const goBack = (): void => {
    if (router.canGoBack()) router.back();
    else router.replace('/(doctor)/orders' as never);
  };

  const renderPatientRow = (row: SearchPatientRow): React.ReactElement => {
    const title = `${t(ORD_STR.patientRef)} ${joinParts([
      row.initials ?? null,
      shortPatientRef(row.patientId),
    ])}`;
    const visit =
      row.lastVisitAt !== undefined && row.lastVisitAt !== null
        ? `${t(ORD_STR.lastVisit)} ${formatDate(row.lastVisitAt, lang)}`
        : null;
    return (
      <ListRow
        key={row.patientId}
        title={title}
        {...(visit !== null ? { subtitle: visit } : {})}
        accessibilityLabel={title}
        testID={`patient-option-${row.patientId}`}
        onPress={() => {
          setChoice({ kind: 'picked', patientId: row.patientId });
          setQuery('');
        }}
      />
    );
  };

  // ── Patient picker body (honest states) ────────────────────────────────
  let pickerBody: React.ReactNode = null;
  if (patientId === null) {
    if (!isSearchable(query)) {
      pickerBody = (
        <Text style={[styles.hint, { color: theme.fgMuted }]}>
          {t(ORD_STR.selectPatientFirst)}
        </Text>
      );
    } else if (search.phase === 'searching') {
      pickerBody = (
        <View style={styles.centerSm}>
          <ActivityIndicator color={theme.accent} />
        </View>
      );
    } else if (search.phase === 'error') {
      pickerBody = (
        <EmptyState
          title={t(COMMON.genericError)}
          {...(search.error ? { message: search.error.message } : {})}
          actionLabel={t(COMMON.retry)}
          onAction={search.retry}
        />
      );
    } else if (search.results.length === 0) {
      pickerBody = (
        <EmptyState
          title={t(ORD_STR.noPatientsFound)}
          message={t(ORD_STR.noPatientsFoundHint)}
        />
      );
    } else {
      pickerBody = <View style={styles.rows}>{search.results.map(renderPatientRow)}</View>;
    }
  }

  return (
    <ScreenScaffold phi>
      <SectionHeader title={t(ORD_STR.newOrderTitle)} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Patient ───────────────────────────────────────────────────── */}
        <Text accessibilityRole="header" style={[styles.sectionTitle, { color: theme.fg }]}>
          {t(ORD_STR.patientSection)}
        </Text>

        {patientId !== null ? (
          <ListRow
            title={`${t(ORD_STR.patientRef)} ${shortPatientRef(patientId)}`}
            chevron={false}
            right={
              <Button
                title={t(ORD_STR.changePatient)}
                variant="ghost"
                accessibilityLabel={`${t(ORD_STR.changePatient)} · ${t(ORD_STR.patientSection)}`}
                testID="change-patient"
                onPress={() => setChoice({ kind: 'searching' })}
              />
            }
          />
        ) : (
          <>
            <TextField
              label={t(ORD_STR.searchPatientLabel)}
              hint={t(ORD_STR.searchPatientHint)}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              testID="patient-search"
            />
            {pickerBody}
          </>
        )}

        {/* ── Compose body — remounts per patient (draft isolation) ────── */}
        {patientId !== null ? (
          <OrderForm key={patientId} patientId={patientId} onPlaced={goBack} />
        ) : null}

        <Button
          title={t(ORD_STR.back)}
          variant="ghost"
          accessibilityLabel={t(ORD_STR.back)}
          onPress={goBack}
        />
      </ScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  centerSm: { alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  rows: { gap: spacing.sm },
  sectionTitle: { fontSize: fontSize.h3, fontWeight: '700' },
  hint: { fontSize: fontSize.bodySm },
});
