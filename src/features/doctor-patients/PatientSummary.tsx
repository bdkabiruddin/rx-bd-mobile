// PatientSummary — the doctor-facing chart summary for ONE patient.
//
// Reusable in two shells (tablet master-detail flagship):
//   - inline detail pane inside app/(doctor)/patients/index.tsx (tablet)
//   - route body of app/(doctor)/patients/[id].tsx (phone)
//
// Each clinical section is fetched from its own consent-scoped endpoint and
// renders independently: loading / locked (403 = consent denied — shown
// honestly, never disguised) / error+retry / honest empty / data. Allergies
// render FIRST and prominent (danger treatment — clinical safety).
//
//   GET /api/v1/doctors/{doctorId}/patients/{patientId}   demographics bundle
//   GET /api/v1/patients/{id}/allergies                   structured allergies
//   GET /api/v1/patients/{id}/conditions?activeOnly=true  active conditions
//   GET /api/v1/patients/{id}/medications?currentOnly=true current meds
//   GET /api/v1/patients/{id}/vitals?limit=5               recent vitals
//   GET /api/v1/patients/{id}/prescriptions?limit=5        recent prescriptions
//   GET /api/v1/patients/{id}/lab-orders?limit=5           recent lab orders

import { useRouter } from 'expo-router';
import * as React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { ApiError } from '@/api/errors';
import { useCachedQuery } from '@/api/useCachedQuery';
import { useSession } from '@/auth/sessionStore';
import { COMMON, formatDate, formatDateTime, formatFreshness, useT } from '@/i18n';
import { Button } from '@/ui/Button';
import { FreshnessBadge } from '@/ui/FreshnessBadge';
import { StatusPill } from '@/ui/StatusPill';
import { fontSize, radius, spacing } from '@/ui/tokens';
import { useTheme } from '@/ui/theme';

import {
  bloodTypeDisplay,
  conditionSeverityTone,
  displayNameOf,
  extraAllergyStrings,
  formatNumber,
  formatVitalValue,
  isConsentDenied,
  joinParts,
  labOrderPriorityTone,
  labOrderStatusTone,
  labTestsSummary,
  localizeDigits,
  medicationStatusTone,
  prescriptionStatusTone,
  shortPatientRef,
  visibleAllergies,
  writesLocked,
} from './logic';
import {
  ALLERGY_SEVERITY_LABELS,
  CONDITION_SEVERITY_LABELS,
  CONDITION_STATUS_LABELS,
  DP_STR,
  GENDER_LABELS,
  LAB_ORDER_PRIORITY_LABELS,
  LAB_ORDER_STATUS_LABELS,
  MEDICATION_STATUS_LABELS,
  PRESCRIPTION_STATUS_LABELS,
  VITAL_TYPE_LABELS,
  labelFor,
} from './strings';
import type {
  AllergiesPayload,
  ConditionsPayload,
  LabOrdersPayload,
  MedicationsPayload,
  PatientDetailPayload,
  PrescriptionsPayload,
  VitalsPayload,
} from './types';

const CLINICAL_TTL_MS = 5 * 60 * 1000;
const RECENT_LIMIT = 5;

// ─── Per-section state frame ─────────────────────────────────────────────────

interface SectionQuery {
  isLoading: boolean;
  error: ApiError | null;
  refetch: () => void;
  /** True when the section has at least one row to show. */
  hasData: boolean;
  /** When the shown rows were last fetched — drives per-section freshness. */
  fetchedAt: number | null;
}

/** One clinical section: title row + honest state machine + rows. */
function SummarySection({
  title,
  query,
  emptyTitle,
  emptyHint,
  critical = false,
  children,
}: {
  title: string;
  query: SectionQuery;
  emptyTitle: string;
  emptyHint?: string;
  /** Danger treatment (allergies — clinical safety). */
  critical?: boolean;
  children: React.ReactNode;
}): React.ReactElement {
  const theme = useTheme();
  const { lang, t } = useT();
  const locked = isConsentDenied(query.error);
  // Once rows are shown, a lingering `error` means the background refresh failed
  // over stale cache — surface it so a clinician isn't misled by out-of-date
  // PHI (e.g. an allergy added elsewhere since the last successful fetch). M7.
  const showingData = query.hasData && !locked;
  const refreshFailed = showingData && query.error !== null;

  let body: React.ReactNode;
  if (locked) {
    // Consent gate denied — honest locked state; stale cached PHI must NOT
    // keep rendering once the server says access is withdrawn.
    body = (
      <View style={styles.stateRow}>
        <StatusPill label={t(DP_STR.sectionLocked)} tone="warning" />
        <Text style={[styles.stateText, { color: theme.fgMuted }]}>
          {t(DP_STR.sectionLockedHint)}
        </Text>
      </View>
    );
  } else if (query.isLoading && !query.hasData) {
    body = (
      <View style={styles.stateRow}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  } else if (query.error && !query.hasData) {
    body = (
      <View style={styles.stateCol}>
        <Text style={[styles.stateText, { color: theme.fgMuted }]}>
          {query.error.message || t(COMMON.genericError)}
        </Text>
        <Button
          title={t(COMMON.retry)}
          variant="secondary"
          accessibilityLabel={`${t(COMMON.retry)} — ${title}`}
          onPress={query.refetch}
        />
      </View>
    );
  } else if (!query.hasData) {
    body = (
      <View style={styles.stateCol}>
        <Text style={[styles.emptyTitle, { color: theme.fg }]}>{emptyTitle}</Text>
        {emptyHint ? (
          <Text style={[styles.stateText, { color: theme.fgMuted }]}>{emptyHint}</Text>
        ) : null}
      </View>
    );
  } else {
    body = children;
  }

  return (
    <View
      accessible={false}
      style={[
        styles.section,
        {
          borderColor: critical ? theme.status.danger : theme.line,
          backgroundColor: theme.bgElevated,
        },
        critical && styles.sectionCritical,
      ]}
    >
      <Text
        accessibilityRole="header"
        style={[
          styles.sectionTitle,
          { color: critical ? theme.status.danger : theme.fg },
        ]}
      >
        {title}
      </Text>
      {body}
      {showingData && query.fetchedAt !== null ? (
        <Text
          style={[
            styles.freshness,
            { color: refreshFailed ? theme.status.warningText : theme.fgSubtle },
          ]}
        >
          {refreshFailed
            ? `${t(DP_STR.sectionRefreshFailed)} · ${formatFreshness(query.fetchedAt, lang)}`
            : `${t(DP_STR.sectionUpdated)} ${formatFreshness(query.fetchedAt, lang)}`}
        </Text>
      ) : null}
    </View>
  );
}

/** Label + value line inside a section row. */
function Line({ label, value }: { label: string; value: string }): React.ReactElement {
  const theme = useTheme();
  return (
    <Text style={[styles.lineText, { color: theme.fgMuted }]}>
      {label}: <Text style={{ color: theme.fg }}>{value}</Text>
    </Text>
  );
}

// ─── PatientSummary ──────────────────────────────────────────────────────────

export function PatientSummary({
  patientId,
}: {
  /** Patient USER id (the `/patients/{id}/*` key). */
  patientId: string;
}): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  const { lang, t } = useT();
  const doctorUserId = useSession((s) => s.userId);
  const tenantId = useSession((s) => s.tenantId);

  const idOk = patientId.length > 0;
  const pid = encodeURIComponent(patientId);
  const scope = {
    ...(tenantId !== null ? { tenantId } : {}),
    ...(doctorUserId !== null ? { userId: doctorUserId } : {}),
  };

  const detailQ = useCachedQuery<PatientDetailPayload>({
    key: `doctor:patients:detail:${patientId}`,
    path: `/api/v1/doctors/${encodeURIComponent(doctorUserId ?? '')}/patients/${pid}`,
    ttlMs: CLINICAL_TTL_MS,
    isPhi: true,
    enabled: idOk && doctorUserId !== null,
    ...scope,
  });
  const allergiesQ = useCachedQuery<AllergiesPayload>({
    key: `doctor:patients:allergies:${patientId}`,
    path: `/api/v1/patients/${pid}/allergies`,
    ttlMs: CLINICAL_TTL_MS,
    isPhi: true,
    enabled: idOk,
    ...scope,
  });
  const conditionsQ = useCachedQuery<ConditionsPayload>({
    key: `doctor:patients:conditions:${patientId}`,
    path: `/api/v1/patients/${pid}/conditions?activeOnly=true`,
    ttlMs: CLINICAL_TTL_MS,
    isPhi: true,
    enabled: idOk,
    ...scope,
  });
  const medicationsQ = useCachedQuery<MedicationsPayload>({
    key: `doctor:patients:medications:${patientId}`,
    path: `/api/v1/patients/${pid}/medications?currentOnly=true`,
    ttlMs: CLINICAL_TTL_MS,
    isPhi: true,
    enabled: idOk,
    ...scope,
  });
  const vitalsQ = useCachedQuery<VitalsPayload>({
    key: `doctor:patients:vitals:${patientId}`,
    path: `/api/v1/patients/${pid}/vitals?limit=${RECENT_LIMIT}`,
    ttlMs: CLINICAL_TTL_MS,
    isPhi: true,
    enabled: idOk,
    ...scope,
  });
  const prescriptionsQ = useCachedQuery<PrescriptionsPayload>({
    key: `doctor:patients:rx:${patientId}`,
    path: `/api/v1/patients/${pid}/prescriptions?limit=${RECENT_LIMIT}`,
    ttlMs: CLINICAL_TTL_MS,
    isPhi: true,
    enabled: idOk,
    ...scope,
  });
  const labOrdersQ = useCachedQuery<LabOrdersPayload>({
    key: `doctor:patients:laborders:${patientId}`,
    path: `/api/v1/patients/${pid}/lab-orders?limit=${RECENT_LIMIT}`,
    ttlMs: CLINICAL_TTL_MS,
    isPhi: true,
    enabled: idOk,
    ...scope,
  });

  const detail = detailQ.data?.patient ?? null;
  const detailLocked = isConsentDenied(detailQ.error);

  // Allergies — structured rows + profile free-text merged; safety-first.
  const structuredAllergies = visibleAllergies(allergiesQ.data?.allergies);
  const bundleAllergyPills = extraAllergyStrings(detail, structuredAllergies);
  const freeTextAllergies = detail?.allergies?.trim() ?? '';
  const hasAllergyData =
    structuredAllergies.length > 0 ||
    bundleAllergyPills.length > 0 ||
    freeTextAllergies.length > 0;

  const conditions = conditionsQ.data?.conditions ?? [];
  const medications = medicationsQ.data?.medications ?? [];
  const vitals = vitalsQ.data?.vitals?.readings ?? [];
  const prescriptions = prescriptionsQ.data?.prescriptions ?? [];
  const labOrders = labOrdersQ.data?.orders ?? [];

  const patientLabel =
    displayNameOf(detail) ??
    `${t(DP_STR.patientRef)} ${detail?.initials ?? shortPatientRef(patientId)}`;
  const locked = writesLocked(detail);

  const goPrescribe = (): void => {
    router.push(`/(doctor)/prescribe/${patientId}` as never);
  };
  const goNewLabOrder = (): void => {
    router.push(
      { pathname: '/(doctor)/orders/new', params: { patientId } } as never,
    );
  };

  // Demographics header body (its own honest state machine).
  let header: React.ReactNode;
  if (detailLocked) {
    header = (
      <View style={[styles.headerCard, { borderColor: theme.line, backgroundColor: theme.bgElevated }]}>
        <StatusPill label={t(DP_STR.sectionLocked)} tone="warning" />
        <Text style={[styles.headerName, { color: theme.fg }]}>
          {t(DP_STR.recordLocked)}
        </Text>
        <Text style={[styles.stateText, { color: theme.fgMuted }]}>
          {t(DP_STR.recordLockedHint)}
        </Text>
      </View>
    );
  } else if (detailQ.isLoading && !detail) {
    header = (
      <View style={styles.headerLoading}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  } else if (detailQ.error && !detail) {
    header = (
      <View style={[styles.headerCard, { borderColor: theme.line, backgroundColor: theme.bgElevated }]}>
        <Text style={[styles.stateText, { color: theme.fgMuted }]}>
          {detailQ.error.message || t(COMMON.genericError)}
        </Text>
        <Button
          title={t(COMMON.retry)}
          variant="secondary"
          accessibilityLabel={t(COMMON.retry)}
          onPress={detailQ.refetch}
        />
      </View>
    );
  } else {
    const agePill =
      detail?.ageBracket && detail.ageBracket !== 'unknown'
        ? `${t(DP_STR.age)} ${localizeDigits(detail.ageBracket, lang)}`
        : null;
    const genderPill = detail?.gender
      ? t(labelFor(GENDER_LABELS, detail.gender))
      : null;
    const blood = bloodTypeDisplay(detail?.bloodType);
    header = (
      <View style={[styles.headerCard, { borderColor: theme.line, backgroundColor: theme.bgElevated }]}>
        <View style={styles.headerTop}>
          <Text style={[styles.headerName, { color: theme.fg }]} numberOfLines={2}>
            {patientLabel}
          </Text>
          <FreshnessBadge fetchedAt={detailQ.fetchedAt} />
        </View>
        <Text style={[styles.headerId, { color: theme.fgSubtle }]}>
          ID {shortPatientRef(patientId)}
        </Text>
        <View style={styles.pillRow}>
          {agePill ? <StatusPill label={agePill} tone="neutral" /> : null}
          {genderPill ? <StatusPill label={genderPill} tone="neutral" /> : null}
          {blood ? (
            <StatusPill label={`${t(DP_STR.bloodType)} ${blood}`} tone="info" />
          ) : null}
          {locked ? <StatusPill label={t(DP_STR.deceasedNotice)} tone="danger" /> : null}
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.body}
      accessibilityLabel={t(DP_STR.summaryTitle)}
    >
      {header}

      {/* ALLERGIES — always the first clinical section (safety interlock). */}
      <SummarySection
        title={t(DP_STR.allergies)}
        critical
        query={{
          isLoading: allergiesQ.isLoading,
          error: allergiesQ.error,
          refetch: allergiesQ.refetch,
          fetchedAt: allergiesQ.fetchedAt,
          hasData: hasAllergyData,
        }}
        emptyTitle={t(DP_STR.noAllergiesRecorded)}
        emptyHint={t(DP_STR.noAllergiesHint)}
      >
        <View style={styles.rows}>
          {structuredAllergies.map((a) => (
            <View
              key={a.id}
              style={styles.allergyRow}
              accessible
              accessibilityLabel={`${a.allergenDisplay} — ${t(labelFor(ALLERGY_SEVERITY_LABELS, a.severity))}`}
            >
              <StatusPill
                label={`${a.allergenDisplay} — ${t(labelFor(ALLERGY_SEVERITY_LABELS, a.severity))}`}
                tone="danger"
              />
              {a.reaction ? (
                <Text style={[styles.lineText, { color: theme.fgMuted }]}>
                  {t(DP_STR.reaction)}: <Text style={{ color: theme.fg }}>{a.reaction}</Text>
                </Text>
              ) : null}
            </View>
          ))}
          {bundleAllergyPills.length > 0 ? (
            <View style={styles.pillRow}>
              {bundleAllergyPills.map((label) => (
                <StatusPill key={label} label={label} tone="danger" />
              ))}
            </View>
          ) : null}
          {freeTextAllergies.length > 0 ? (
            <Line label={t(DP_STR.freeTextAllergies)} value={freeTextAllergies} />
          ) : null}
        </View>
      </SummarySection>

      {/* Active conditions */}
      <SummarySection
        title={t(DP_STR.conditions)}
        query={{
          isLoading: conditionsQ.isLoading,
          error: conditionsQ.error,
          refetch: conditionsQ.refetch,
          fetchedAt: conditionsQ.fetchedAt,
          hasData: conditions.length > 0,
        }}
        emptyTitle={t(DP_STR.noConditions)}
      >
        <View style={styles.rows}>
          {conditions.map((c) => (
            <View key={c.id} style={styles.itemRow}>
              <View style={styles.itemMain}>
                <Text style={[styles.itemTitle, { color: theme.fg }]} numberOfLines={2}>
                  {c.conditionLabel}
                </Text>
                <Text style={[styles.lineText, { color: theme.fgMuted }]}>
                  {joinParts([
                    c.icd10Code ?? null,
                    t(labelFor(CONDITION_STATUS_LABELS, c.status)),
                    c.onsetDate ? formatDate(c.onsetDate, lang) : null,
                  ])}
                </Text>
              </View>
              {c.severity ? (
                <StatusPill
                  label={t(labelFor(CONDITION_SEVERITY_LABELS, c.severity))}
                  tone={conditionSeverityTone(c.severity)}
                />
              ) : null}
            </View>
          ))}
        </View>
      </SummarySection>

      {/* Current medications */}
      <SummarySection
        title={t(DP_STR.medications)}
        query={{
          isLoading: medicationsQ.isLoading,
          error: medicationsQ.error,
          refetch: medicationsQ.refetch,
          fetchedAt: medicationsQ.fetchedAt,
          hasData:
            medications.length > 0 ||
            (detail?.activeMedications?.trim().length ?? 0) > 0,
        }}
        emptyTitle={t(DP_STR.noMedications)}
      >
        <View style={styles.rows}>
          {medications.map((m) => (
            <View key={m.id} style={styles.itemRow}>
              <View style={styles.itemMain}>
                <Text style={[styles.itemTitle, { color: theme.fg }]} numberOfLines={2}>
                  {m.drugName}
                </Text>
                <Text style={[styles.lineText, { color: theme.fgMuted }]}>
                  {joinParts([m.doseAmount ?? null, m.frequency ?? null])}
                </Text>
              </View>
              <StatusPill
                label={t(labelFor(MEDICATION_STATUS_LABELS, m.status))}
                tone={medicationStatusTone(m.status)}
              />
            </View>
          ))}
          {detail?.activeMedications?.trim() ? (
            <Line label={t(DP_STR.medsNotedOnProfile)} value={detail.activeMedications.trim()} />
          ) : null}
        </View>
      </SummarySection>

      {/* Recent vitals */}
      <SummarySection
        title={t(DP_STR.vitals)}
        query={{
          isLoading: vitalsQ.isLoading,
          error: vitalsQ.error,
          refetch: vitalsQ.refetch,
          fetchedAt: vitalsQ.fetchedAt,
          hasData: vitals.length > 0,
        }}
        emptyTitle={t(DP_STR.noVitals)}
      >
        <View style={styles.rows}>
          {vitals.map((v) => (
            <View key={v.vitalReadingId} style={styles.itemRow}>
              <View style={styles.itemMain}>
                <Text style={[styles.itemTitle, { color: theme.fg }]}>
                  {t(labelFor(VITAL_TYPE_LABELS, v.vitalType))}
                </Text>
                <Text style={[styles.lineText, { color: theme.fgMuted }]}>
                  {formatDateTime(v.effectiveAt, lang)}
                </Text>
              </View>
              <Text style={[styles.vitalValue, { color: theme.fg }]}>
                {formatVitalValue(v, lang)}
              </Text>
            </View>
          ))}
        </View>
      </SummarySection>

      {/* Recent prescriptions */}
      <SummarySection
        title={t(DP_STR.prescriptions)}
        query={{
          isLoading: prescriptionsQ.isLoading,
          error: prescriptionsQ.error,
          refetch: prescriptionsQ.refetch,
          fetchedAt: prescriptionsQ.fetchedAt,
          hasData: prescriptions.length > 0,
        }}
        emptyTitle={t(DP_STR.noPrescriptions)}
      >
        <View style={styles.rows}>
          {prescriptions.map((p) => (
            <View key={p.prescriptionId} style={styles.itemRow}>
              <View style={styles.itemMain}>
                <Text style={[styles.itemTitle, { color: theme.fg }]}>
                  {formatDate(p.prescribedAt, lang)}
                </Text>
                {p.itemCount !== undefined ? (
                  <Text style={[styles.lineText, { color: theme.fgMuted }]}>
                    {lang === 'bn'
                      ? `${formatNumber(p.itemCount, lang)}টি ওষুধ`
                      : `${formatNumber(p.itemCount, lang)} item${p.itemCount === 1 ? '' : 's'}`}
                  </Text>
                ) : null}
              </View>
              <StatusPill
                label={t(labelFor(PRESCRIPTION_STATUS_LABELS, p.status))}
                tone={prescriptionStatusTone(String(p.status))}
              />
            </View>
          ))}
        </View>
      </SummarySection>

      {/* Recent lab orders */}
      <SummarySection
        title={t(DP_STR.labOrders)}
        query={{
          isLoading: labOrdersQ.isLoading,
          error: labOrdersQ.error,
          refetch: labOrdersQ.refetch,
          fetchedAt: labOrdersQ.fetchedAt,
          hasData: labOrders.length > 0,
        }}
        emptyTitle={t(DP_STR.noLabOrders)}
      >
        <View style={styles.rows}>
          {labOrders.map((o) => {
            const testsLabel = labTestsSummary(o.tests);
            return (
              <View key={o.labOrderId} style={styles.itemRow}>
                <View style={styles.itemMain}>
                  <Text style={[styles.itemTitle, { color: theme.fg }]} numberOfLines={2}>
                    {testsLabel.length > 0 ? testsLabel : formatDate(o.orderedAt, lang)}
                  </Text>
                  <Text style={[styles.lineText, { color: theme.fgMuted }]}>
                    {joinParts([
                      formatDateTime(o.orderedAt, lang),
                      o.priority && o.priority !== 'ROUTINE'
                        ? t(labelFor(LAB_ORDER_PRIORITY_LABELS, o.priority))
                        : null,
                    ])}
                  </Text>
                </View>
                <View style={styles.trailingPills}>
                  {o.priority === 'STAT' || o.priority === 'URGENT' ? (
                    <StatusPill
                      label={t(labelFor(LAB_ORDER_PRIORITY_LABELS, o.priority))}
                      tone={labOrderPriorityTone(o.priority)}
                    />
                  ) : null}
                  <StatusPill
                    label={t(labelFor(LAB_ORDER_STATUS_LABELS, o.status))}
                    tone={labOrderStatusTone(String(o.status))}
                  />
                </View>
              </View>
            );
          })}
        </View>
      </SummarySection>

      {/* Actions — hidden entirely for a DECEASED record (write lock). */}
      {locked ? (
        <Text style={[styles.deceased, { color: theme.status.danger }]}>
          {t(DP_STR.deceasedNotice)}
        </Text>
      ) : (
        <View style={styles.actions}>
          <Button
            title={t(DP_STR.prescribe)}
            accessibilityLabel={t(DP_STR.prescribe)}
            onPress={goPrescribe}
          />
          <Button
            title={t(DP_STR.newLabOrder)}
            variant="secondary"
            accessibilityLabel={t(DP_STR.newLabOrder)}
            onPress={goNewLabOrder}
          />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.md },
  headerLoading: { paddingVertical: spacing.xl, alignItems: 'center' },
  headerCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  headerName: { fontSize: fontSize.h3, fontWeight: '700', flexShrink: 1 },
  headerId: { fontSize: fontSize.caption },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  section: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sectionCritical: { borderWidth: 1 },
  sectionTitle: { fontSize: fontSize.body, fontWeight: '700' },
  rows: { gap: spacing.sm },
  allergyRow: { gap: spacing.xs },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  itemMain: { flex: 1, gap: 2 },
  itemTitle: { fontSize: fontSize.bodySm, fontWeight: '600' },
  lineText: { fontSize: fontSize.bodySm },
  vitalValue: { fontSize: fontSize.bodySm, fontWeight: '700' },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  stateCol: { gap: spacing.sm },
  stateText: { fontSize: fontSize.bodySm, flexShrink: 1 },
  emptyTitle: { fontSize: fontSize.bodySm, fontWeight: '600' },
  freshness: { fontSize: fontSize.caption, marginTop: 2 },
  trailingPills: { alignItems: 'flex-end', gap: spacing.xs },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
  deceased: { fontSize: fontSize.bodySm, fontWeight: '600', textAlign: 'center' },
});
