// Doctor patients — consent-gated search + "my patients" panel.
//
//   POST /api/v1/doctors/me/patients/search   (debounced; patientId substring
//        within the doctor's OWN panel only — the backend never name-searches)
//   GET  /api/v1/doctors/{id}/patients        ({id} = signed-in doctor's user
//        id; initials-only projection, consent-filtered per row)
//
// Tablet master-detail flagship: on >=768dp the list is the master pane and
// the selected patient's PatientSummary renders inline as the detail pane
// (no route push). On phones a row tap pushes /(doctor)/patients/[id].

import { useRouter } from 'expo-router';
import * as React from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { useCachedQuery } from '@/api/useCachedQuery';
import { useSession } from '@/auth/sessionStore';
import { COMMON, formatDate, useT } from '@/i18n';
import { EmptyState } from '@/ui/EmptyState';
import { FreshnessBadge } from '@/ui/FreshnessBadge';
import { ListRow } from '@/ui/ListRow';
 
import { MasterDetail } from '@/ui/MasterDetail';
import { ScreenScaffold } from '@/ui/ScreenScaffold';
import { SectionHeader } from '@/ui/SectionHeader';
import { StatusPill } from '@/ui/StatusPill';
import { TextField } from '@/ui/TextField';
import { spacing } from '@/ui/tokens';
 
import { useBreakpoint } from '@/ui/useBreakpoint';

import {
  isConsentDenied,
  isSearchable,
  joinParts,
  localizeDigits,
  shortPatientRef,
} from '@/features/doctor-patients/logic';
import { PatientSummary } from '@/features/doctor-patients/PatientSummary';
import { DP_STR } from '@/features/doctor-patients/strings';
import type { PanelPatient, PanelPayload } from '@/features/doctor-patients/types';
import { usePatientSearch } from '@/features/doctor-patients/usePatientSearch';

const PANEL_TTL_MS = 10 * 60 * 1000;
const PANEL_LIMIT = 50;

export default function DoctorPatientsIndex(): React.ReactElement {
  const { lang, t } = useT();
  const router = useRouter();
  const { isTablet } = useBreakpoint();
  const userId = useSession((s) => s.userId);
  const tenantId = useSession((s) => s.tenantId);

  const [query, setQuery] = React.useState('');
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const search = usePatientSearch(query);
  const searching = isSearchable(query);

  const panel = useCachedQuery<PanelPayload>({
    key: `doctor:patients:panel:${userId ?? 'anon'}`,
    path: `/api/v1/doctors/${encodeURIComponent(userId ?? '')}/patients?limit=${PANEL_LIMIT}`,
    ttlMs: PANEL_TTL_MS,
    isPhi: true,
    enabled: userId !== null,
    ...(tenantId !== null ? { tenantId } : {}),
    ...(userId !== null ? { userId } : {}),
  });
  const panelPatients = React.useMemo(
    () => (panel.data?.patients ?? []).filter((p) => Boolean(p?.patientId)),
    [panel.data],
  );

  const openPatient = React.useCallback(
    (patientId: string): void => {
      if (isTablet) {
        setSelectedId(patientId);
        return;
      }
      router.push(`/(doctor)/patients/${patientId}` as never);
    },
    [isTablet, router],
  );

  const renderRow = ({ item }: { item: PanelPatient }): React.ReactElement => {
    const age =
      item.ageBracket && item.ageBracket !== 'unknown'
        ? `${t(DP_STR.age)} ${localizeDigits(item.ageBracket, lang)}`
        : null;
    const visit = item.lastVisitAt
      ? `${t(DP_STR.lastVisit)} ${formatDate(item.lastVisitAt, lang)}`
      : t(DP_STR.noVisitYet);
    const title = `${t(DP_STR.patientRef)} ${joinParts([
      item.initials ?? null,
      shortPatientRef(item.patientId),
    ])}`;
    return (
      <ListRow
        title={title}
        subtitle={joinParts([age, visit])}
        {...(item.viaBreakGlass
          ? { right: <StatusPill label={t(DP_STR.breakGlass)} tone="warning" /> }
          : {})}
        accessibilityLabel={title}
        onPress={() => openPatient(item.patientId)}
      />
    );
  };

  // ── List body: search results when a query is live, else the panel. ──────
  let listBody: React.ReactElement;
  if (searching) {
    if (search.phase === 'searching') {
      listBody = (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      );
    } else if (search.phase === 'error') {
      listBody = isConsentDenied(search.error) ? (
        <EmptyState
          title={t(DP_STR.sectionLocked)}
          message={t(DP_STR.sectionLockedHint)}
        />
      ) : (
        <EmptyState
          title={t(COMMON.genericError)}
          {...(search.error ? { message: search.error.message } : {})}
          actionLabel={t(COMMON.retry)}
          onAction={search.retry}
        />
      );
    } else if (search.results.length === 0) {
      listBody = (
        <EmptyState
          title={t(DP_STR.noResults)}
          message={t(DP_STR.noResultsHint)}
        />
      );
    } else {
      listBody = (
        <FlatList
          data={search.results}
          keyExtractor={(p) => p.patientId}
          contentContainerStyle={styles.list}
          renderItem={renderRow}
        />
      );
    }
  } else if (panel.isLoading) {
    listBody = (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  } else if (panel.error && panelPatients.length === 0) {
    listBody = isConsentDenied(panel.error) ? (
      <EmptyState
        title={t(DP_STR.sectionLocked)}
        message={t(DP_STR.sectionLockedHint)}
      />
    ) : (
      <EmptyState
        title={t(COMMON.genericError)}
        message={panel.error.message}
        actionLabel={t(COMMON.retry)}
        onAction={panel.refetch}
      />
    );
  } else if (panelPatients.length === 0) {
    listBody = (
      <EmptyState
        title={t(DP_STR.emptyPanel)}
        message={t(DP_STR.emptyPanelHint)}
      />
    );
  } else {
    listBody = (
      <FlatList
        data={panelPatients}
        keyExtractor={(p) => p.patientId}
        contentContainerStyle={styles.list}
        renderItem={renderRow}
      />
    );
  }

  const master = (
    <View style={styles.master}>
      <SectionHeader
        title={t(DP_STR.patientsTitle)}
        right={searching ? undefined : <FreshnessBadge fetchedAt={panel.fetchedAt} />}
      />
      <View style={styles.searchBox}>
        <TextField
          label={t(DP_STR.searchLabel)}
          hint={t(DP_STR.searchHint)}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
      <SectionHeader
        title={searching ? t(DP_STR.searchResults) : t(DP_STR.myPatients)}
      />
      {listBody}
    </View>
  );

  if (!isTablet) {
    return <ScreenScaffold phi>{master}</ScreenScaffold>;
  }

  return (
    <ScreenScaffold phi>
      <MasterDetail
        master={master}
        detail={selectedId !== null ? <PatientSummary patientId={selectedId} /> : null}
        emptyDetail={
          <EmptyState
            title={t(DP_STR.selectPatient)}
            message={t(DP_STR.selectPatientHint)}
          />
        }
      />
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  master: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.lg, gap: spacing.sm },
  searchBox: { paddingHorizontal: spacing.lg },
});
