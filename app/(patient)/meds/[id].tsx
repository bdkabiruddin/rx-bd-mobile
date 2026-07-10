// Prescription detail — full PHI view: drug-line items (name, dose,
// frequency, duration, route, instructions), diagnosis codes, notes,
// validity + refill counters, prescriber (best-effort public-directory
// lookup by prescribingDoctorUserId — the prescription payload itself
// carries no doctor display name), and a re-order request action for
// EXPIRED prescriptions (backend also accepts 'COMPLETED').
//
// PDF export (POST /me/prescriptions/{id}/pdf) needs an authenticated
// file download pipeline — out of scope for this phase (gap-noted), so
// no button is rendered.

import { useLocalSearchParams, useRouter } from 'expo-router';
import * as React from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { newIdempotencyKey } from '@/api/idempotency';
import { useCachedQuery } from '@/api/useCachedQuery';
import { canReorder, joinParts, prescriptionStatusTone } from '@/features/patient-meds/logic';
import {
  STR,
  daysLabel,
  prescriptionStatusLabel,
} from '@/features/patient-meds/strings';
import type {
  PrescriptionDetailPayload,
  PublicDoctorLite,
  ReorderRequestBody,
  ReorderResponse,
} from '@/features/patient-meds/types';
import { COMMON, formatDate, useT } from '@/i18n';
import { useWrite } from '@/offline/useWrite';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { FreshnessBadge } from '@/ui/FreshnessBadge';
import { ListRow } from '@/ui/ListRow';
import { ScreenScaffold } from '@/ui/ScreenScaffold';
import { SectionHeader } from '@/ui/SectionHeader';
import { StatusPill } from '@/ui/StatusPill';
import { useTheme } from '@/ui/theme';
import { fontSize, radius, spacing } from '@/ui/tokens';

export default function PrescriptionDetailScreen(): React.ReactElement {
  const { lang, t } = useT();
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const rxId =
    typeof params.id === 'string' && params.id.length > 0 ? params.id : undefined;

  const { data, fetchedAt, isLoading, error, refetch } =
    useCachedQuery<PrescriptionDetailPayload>({
      key: `patient:meds:rx:${rxId ?? 'unknown'}`,
      path: `/api/v1/prescriptions/${rxId ?? 'unknown'}`,
      ttlMs: 15 * 60 * 1000,
      isPhi: true,
      enabled: rxId !== undefined,
    });

  const rx = data?.prescription;
  const doctorId = rx?.prescribingDoctorUserId;

  // Best-effort prescriber name via the PUBLIC directory (non-PHI
  // professional persona). 404s for unverified/hidden doctors — the UI
  // falls back to an honest "unavailable" line, never a fabricated name.
  const prescriber = useCachedQuery<PublicDoctorLite>({
    key: `patient:meds:prescriber:${doctorId ?? 'none'}`,
    path: `/api/v1/public/doctors/${doctorId ?? 'none'}`,
    ttlMs: 15 * 60 * 1000,
    isPhi: false,
    enabled: doctorId !== undefined && doctorId.length > 0,
  });

  const { submit, busy } = useWrite<ReorderResponse>();
  const reorderKeyRef = React.useRef<string | null>(null);
  const [reorderSent, setReorderSent] = React.useState(false);

  const doReorder = React.useCallback(async (): Promise<void> => {
    if (rxId === undefined) return;
    // The backend requires an idempotencyKey INSIDE the body too — mint
    // once per logical request and reuse across user retries.
    if (!reorderKeyRef.current) reorderKeyRef.current = newIdempotencyKey();
    const body: ReorderRequestBody = {
      sourcePrescriptionId: rxId,
      idempotencyKey: reorderKeyRef.current,
    };
    const res = await submit({
      method: 'POST',
      path: '/api/v1/me/refills/reorder',
      body,
    });
    if (res.ok) {
      reorderKeyRef.current = null;
      setReorderSent(true);
      Alert.alert(t(STR.reorderSentTitle), t(STR.reorderSentMsg));
    } else if (res.error.code === 'OFFLINE') {
      Alert.alert(t(COMMON.offline), t(STR.offlineWrite));
    } else {
      Alert.alert(t(COMMON.genericError), res.error.message);
    }
  }, [rxId, submit, t]);

  const onReorderPress = React.useCallback((): void => {
    Alert.alert(t(STR.reorderConfirmTitle), t(STR.reorderConfirmMsg), [
      { text: t(COMMON.cancel), style: 'cancel' },
      { text: t(COMMON.confirm), onPress: () => void doReorder() },
    ]);
  }, [doReorder, t]);

  return (
    <ScreenScaffold phi>
      <SectionHeader
        title={t(STR.prescriptionDetails)}
        right={<FreshnessBadge fetchedAt={fetchedAt} />}
      />
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : error && !data ? (
        <EmptyState
          title={t(COMMON.genericError)}
          message={error.message}
          actionLabel={t(COMMON.retry)}
          onAction={refetch}
        />
      ) : !rx ? (
        <EmptyState title={t(STR.prescriptionNotFound)} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Summary */}
          <View style={[styles.card, { borderColor: theme.line, backgroundColor: theme.bgElevated }]}>
            <View style={styles.cardHead}>
              <Text style={[styles.cardTitle, { color: theme.fg }]}>
                {rx.prescribedAt !== undefined
                  ? formatDate(rx.prescribedAt, lang)
                  : t(STR.prescriptionFallbackTitle)}
              </Text>
              <StatusPill
                label={t(prescriptionStatusLabel(rx.status))}
                tone={prescriptionStatusTone(rx.status)}
              />
            </View>
            {rx.validUntil !== undefined ? (
              <KeyValue label={t(STR.validUntil)} value={formatDate(rx.validUntil, lang)} />
            ) : null}
            {rx.refillsAllowed !== undefined && rx.refillsUsed !== undefined ? (
              <KeyValue
                label={t(STR.refills)}
                value={`${rx.refillsUsed}/${rx.refillsAllowed}`}
              />
            ) : null}
            <KeyValue
              label={t(STR.prescriber)}
              value={
                prescriber.data?.fullName !== undefined
                  ? joinParts([prescriber.data.fullName, prescriber.data.primarySpecialty])
                  : prescriber.isLoading
                    ? '…'
                    : t(STR.prescriberUnavailable)
              }
            />
          </View>

          {/* Amendment backlink */}
          {rx.supersedesId ? (
            <View style={styles.block}>
              <Text style={[styles.note, { color: theme.fgMuted }]}>{t(STR.amendedNote)}</Text>
              <ListRow
                title={t(STR.viewOriginal)}
                accessibilityLabel={t(STR.viewOriginal)}
                onPress={() =>
                  router.push(`/(patient)/meds/${rx.supersedesId}` as never)
                }
              />
            </View>
          ) : null}

          {/* Drug-line items */}
          <Text style={[styles.sectionTitle, { color: theme.fg }]}>{t(STR.medicines)}</Text>
          {!rx.items || rx.items.length === 0 ? (
            <EmptyState title={t(COMMON.noData)} />
          ) : (
            rx.items.map((item, idx) => (
              <View
                key={`${item.drugName ?? 'item'}-${idx}`}
                style={[styles.card, { borderColor: theme.line, backgroundColor: theme.bgElevated }]}
              >
                <Text style={[styles.cardTitle, { color: theme.fg }]}>
                  {joinParts([item.drugName ?? '—', item.strength])}
                </Text>
                {item.dose !== undefined ? (
                  <KeyValue label={t(STR.dose)} value={item.dose} />
                ) : null}
                {item.frequency !== undefined ? (
                  <KeyValue label={t(STR.frequency)} value={item.frequency} />
                ) : null}
                {item.durationDays !== undefined ? (
                  <KeyValue label={t(STR.duration)} value={t(daysLabel(item.durationDays))} />
                ) : null}
                {item.route !== undefined ? (
                  <KeyValue label={t(STR.route)} value={item.route} />
                ) : null}
                {item.instructions !== undefined && item.instructions.length > 0 ? (
                  <KeyValue label={t(STR.instructions)} value={item.instructions} />
                ) : null}
              </View>
            ))
          )}

          {/* Diagnosis codes */}
          {rx.diagnosisCodes && rx.diagnosisCodes.length > 0 ? (
            <View style={styles.block}>
              <Text style={[styles.sectionTitleInline, { color: theme.fg }]}>
                {t(STR.diagnosisCodes)}
              </Text>
              <View style={styles.chipRow}>
                {rx.diagnosisCodes.map((code) => (
                  <View
                    key={code}
                    style={[styles.chip, { backgroundColor: theme.bgMuted }]}
                  >
                    <Text style={[styles.chipText, { color: theme.fgMuted }]}>{code}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Notes */}
          {rx.notes ? (
            <View style={styles.block}>
              <Text style={[styles.sectionTitleInline, { color: theme.fg }]}>{t(STR.notes)}</Text>
              <Text style={[styles.note, { color: theme.fgMuted }]}>{rx.notes}</Text>
            </View>
          ) : null}

          {/* Re-order request (expired prescriptions) */}
          {canReorder(rx.status) ? (
            <View style={styles.block}>
              <Button
                title={reorderSent ? t(STR.reorderRequested) : t(STR.requestReorder)}
                loading={busy}
                disabled={reorderSent}
                accessibilityLabel={t(STR.requestReorder)}
                testID="request-reorder"
                onPress={onReorderPress}
              />
            </View>
          ) : null}
        </ScrollView>
      )}
    </ScreenScaffold>
  );
}

function KeyValue({ label, value }: { label: string; value: string }): React.ReactElement {
  const theme = useTheme();
  return (
    <View style={styles.kvRow}>
      <Text style={[styles.kvLabel, { color: theme.fgSubtle }]}>{label}</Text>
      <Text style={[styles.kvValue, { color: theme.fg }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  cardTitle: { fontSize: fontSize.body, fontWeight: '600', flexShrink: 1 },
  sectionTitle: {
    fontSize: fontSize.h3,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  sectionTitleInline: { fontSize: fontSize.body, fontWeight: '600' },
  block: { gap: spacing.sm },
  kvRow: { flexDirection: 'row', gap: spacing.sm },
  kvLabel: { fontSize: fontSize.bodySm, minWidth: 110 },
  kvValue: { fontSize: fontSize.bodySm, flex: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  chipText: { fontSize: fontSize.caption, fontWeight: '600' },
  note: { fontSize: fontSize.bodySm, lineHeight: 20 },
});
