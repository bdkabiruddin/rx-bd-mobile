// ResultDetail — one lab result: values / units / reference ranges,
// abnormal-flag pills ONLY when the payload carries flags, the order
// context, and the acknowledge flow (optional doctorNote for the patient).
//
// Reusable in two shells inside app/(doctor)/orders/inbox.tsx:
//   - phone: full-screen swap (list ⇄ detail, Back button)
//   - tablet: MasterDetail right pane
//
//   GET  /api/v1/lab-results/{id}              detail (ordering doctor only)
//   POST /api/v1/lab-results/{id}/acknowledge  { doctorNote? } — first ack wins

import { useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { COMMON, formatDateTime, useT } from '@/i18n';
import { useWrite } from '@/offline/useWrite';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { FreshnessBadge } from '@/ui/FreshnessBadge';
import { StatusPill } from '@/ui/StatusPill';
import { TextField } from '@/ui/TextField';
import { useDraft } from '@/ui/useDraft';
import { useTheme } from '@/ui/theme';
import { fontSize, radius, spacing } from '@/ui/tokens';

import {
  RESULTS_INBOX_KEY,
  resultDetailKey,
  useAckedResults,
  useLabResultDetail,
} from './hooks';
import {
  MAX_NOTES_LEN,
  detectCritical,
  flagTone,
  joinParts,
  normalizeResultPayload,
  priorityTone,
  shortPatientRef,
  testNamesLine,
} from './logic';
import { ORD_STR, flagLabel, priorityLabel } from './strings';
import type { AcknowledgeResult } from './types';

export function ResultDetail({
  resultId,
  onAcknowledged,
  onBack,
}: {
  resultId: string;
  /** Called after a server-confirmed acknowledgement (clear selection). */
  onAcknowledged?: () => void;
  /** Phone shell renders a Back affordance; tablet pane omits it. */
  onBack?: () => void;
}): React.ReactElement {
  const theme = useTheme();
  const { lang, t } = useT();
  const queryClient = useQueryClient();

  const detailQ = useLabResultDetail(resultId);
  const detail = detailQ.data;

  const markAcked = useAckedResults((s) => s.markAcked);

  // Sync the session-local ack store with server truth: a detail read that
  // already carries an acknowledgement removes the row from the inbox list.
  const serverAckedAt = detail?.acknowledgedByDoctorAt ?? null;
  React.useEffect(() => {
    if (serverAckedAt !== null && resultId.length > 0) {
      markAcked(resultId);
    }
  }, [serverAckedAt, resultId, markAcked]);

  // ── Acknowledge write ───────────────────────────────────────────────────
  const ackWrite = useWrite<AcknowledgeResult>();
  const noteDraft = useDraft<string>(`doctor:orders:ack-note:${resultId}`, '');
  const [ackError, setAckError] = React.useState<string | null>(null);

  const doAcknowledge = async (): Promise<void> => {
    setAckError(null);
    const note = noteDraft.value.trim();
    const res = await ackWrite.submit({
      method: 'POST',
      path: `/api/v1/lab-results/${encodeURIComponent(resultId)}/acknowledge`,
      body: note.length > 0 ? { doctorNote: note } : {},
    });
    if (res.ok) {
      markAcked(resultId);
      noteDraft.clear();
      void queryClient.invalidateQueries({ queryKey: [RESULTS_INBOX_KEY] });
      void queryClient.invalidateQueries({ queryKey: [resultDetailKey(resultId)] });
      Alert.alert(t(ORD_STR.ackDone));
      onAcknowledged?.();
    } else if (res.error.code === 'OFFLINE') {
      setAckError(t(ORD_STR.offlineWrite));
    } else {
      setAckError(res.error.message || t(COMMON.genericError));
    }
  };

  const confirmAcknowledge = (): void => {
    Alert.alert(t(ORD_STR.ackConfirmTitle), t(ORD_STR.ackConfirmBody), [
      { text: t(COMMON.cancel), style: 'cancel' },
      { text: t(COMMON.confirm), onPress: () => void doAcknowledge() },
    ]);
  };

  // ── Honest state machine ────────────────────────────────────────────────
  if (detailQ.isLoading && !detail) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }
  if (detailQ.error && !detail) {
    const err = detailQ.error;
    if (err.code === 'FORBIDDEN') {
      return (
        <EmptyState title={t(ORD_STR.resultTitle)} message={t(ORD_STR.resultForbidden)} />
      );
    }
    if (err.code === 'RESOURCE_NOT_FOUND') {
      return <EmptyState title={t(ORD_STR.resultNotFound)} />;
    }
    return (
      <EmptyState
        title={t(COMMON.genericError)}
        message={err.message}
        actionLabel={t(COMMON.retry)}
        onAction={detailQ.refetch}
      />
    );
  }
  if (!detail) {
    return <EmptyState title={t(ORD_STR.resultNotFound)} />;
  }

  // ── Data ────────────────────────────────────────────────────────────────
  const order = detail.order;
  const testsLine = testNamesLine(order?.tests);
  const critical = detectCritical(detail.payload);
  const normalized = normalizeResultPayload(detail.payload);
  const acknowledgedAt = detail.acknowledgedByDoctorAt ?? null;
  const doctorNote = detail.doctorNote?.trim() ?? '';
  const orderNotes = order?.notes?.trim() ?? '';
  const priority = order?.priority;
  const patientRef =
    order?.patientId !== undefined && order.patientId.length > 0
      ? `${t(ORD_STR.patientRef)} ${shortPatientRef(order.patientId)}`
      : null;

  return (
    <ScrollView
      contentContainerStyle={styles.body}
      accessibilityLabel={t(ORD_STR.resultTitle)}
      testID="result-detail"
    >
      {onBack ? (
        <Button
          title={t(ORD_STR.back)}
          variant="ghost"
          accessibilityLabel={t(ORD_STR.back)}
          testID="result-back"
          onPress={onBack}
        />
      ) : null}

      {/* Critical banner — first thing on the screen (clinical safety). */}
      {critical ? (
        <View
          accessibilityRole="alert"
          style={[styles.criticalBanner, { backgroundColor: theme.status.danger }]}
        >
          <Text style={[styles.criticalText, { color: theme.status.dangerFg }]}>
            {t(ORD_STR.criticalBanner)}
          </Text>
        </View>
      ) : null}

      {/* Header card */}
      <View style={[styles.card, { borderColor: theme.line, backgroundColor: theme.bgElevated }]}>
        <View style={styles.headerTop}>
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: theme.fg }]}
            numberOfLines={3}
          >
            {testsLine.length > 0 ? testsLine : t(ORD_STR.resultTitle)}
          </Text>
          <FreshnessBadge fetchedAt={detailQ.fetchedAt} />
        </View>
        <View style={styles.pillRow}>
          {critical ? <StatusPill label={t(ORD_STR.critical)} tone="danger" /> : null}
          {priority === 'STAT' || priority === 'URGENT' ? (
            <StatusPill label={t(priorityLabel(priority))} tone={priorityTone(priority)} />
          ) : null}
          <StatusPill
            label={acknowledgedAt !== null ? t(ORD_STR.ackStatusDone) : t(ORD_STR.ackStatusPending)}
            tone={acknowledgedAt !== null ? 'success' : 'warning'}
          />
        </View>
        {patientRef !== null ? (
          <Text style={[styles.line, { color: theme.fgMuted }]}>{patientRef}</Text>
        ) : null}
        {detail.reportedAt !== undefined ? (
          <Text style={[styles.line, { color: theme.fgMuted }]}>
            {joinParts([t(ORD_STR.reportedPrefix), formatDateTime(detail.reportedAt, lang)])}
          </Text>
        ) : null}
        {order?.orderedAt !== undefined ? (
          <Text style={[styles.line, { color: theme.fgMuted }]}>
            {joinParts([t(ORD_STR.orderedPrefix), formatDateTime(order.orderedAt, lang)])}
          </Text>
        ) : null}
      </View>

      {/* Result values */}
      <View style={[styles.card, { borderColor: theme.line, backgroundColor: theme.bgElevated }]}>
        <Text accessibilityRole="header" style={[styles.sectionTitle, { color: theme.fg }]}>
          {t(ORD_STR.valuesTitle)}
        </Text>
        {normalized.kind === 'unstructured' ? (
          <View style={styles.rows}>
            <Text style={[styles.emptyTitle, { color: theme.fg }]}>{t(ORD_STR.unstructured)}</Text>
            <Text style={[styles.line, { color: theme.fgMuted }]}>
              {t(ORD_STR.unstructuredHint)}
            </Text>
          </View>
        ) : normalized.kind === 'text' ? (
          <View style={styles.rows}>
            {normalized.analyte !== null ? (
              <Text style={[styles.analyteName, { color: theme.fg }]}>{normalized.analyte}</Text>
            ) : null}
            <Text style={[styles.line, { color: theme.fg }]}>{normalized.text}</Text>
          </View>
        ) : (
          <View style={styles.rows}>
            {normalized.panel !== null ? (
              <Text style={[styles.line, { color: theme.fgMuted }]}>{normalized.panel}</Text>
            ) : null}
            {normalized.rows.map((row) => {
              const tone = flagTone(row.flag);
              const valueText = `${row.value}${row.unit !== null ? ` ${row.unit}` : ''}`;
              return (
                <View
                  key={row.key}
                  style={styles.analyteRow}
                  accessible
                  accessibilityLabel={joinParts([
                    row.analyte,
                    valueText,
                    row.flag !== null ? t(flagLabel(row.flag)) : null,
                  ])}
                >
                  <View style={styles.analyteMain}>
                    <Text style={[styles.analyteName, { color: theme.fg }]} numberOfLines={2}>
                      {row.analyte ?? t(ORD_STR.resultTitle)}
                    </Text>
                    {row.refRange !== null ? (
                      <Text style={[styles.caption, { color: theme.fgMuted }]}>
                        {`${t(ORD_STR.rangeLabel)}: ${row.refRange}`}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.analyteTrailing}>
                    <Text
                      style={[
                        styles.analyteValue,
                        { color: tone === 'danger' ? theme.status.danger : theme.fg },
                      ]}
                    >
                      {valueText}
                    </Text>
                    {row.flag !== null && tone !== null ? (
                      <StatusPill label={t(flagLabel(row.flag))} tone={tone} />
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Clinical notes captured on the order */}
      {orderNotes.length > 0 ? (
        <View style={[styles.card, { borderColor: theme.line, backgroundColor: theme.bgElevated }]}>
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: theme.fg }]}>
            {t(ORD_STR.orderNotes)}
          </Text>
          <Text style={[styles.line, { color: theme.fg }]}>{orderNotes}</Text>
        </View>
      ) : null}

      {/* Acknowledge */}
      <View style={[styles.card, { borderColor: theme.line, backgroundColor: theme.bgElevated }]}>
        {acknowledgedAt !== null ? (
          <View style={styles.rows}>
            <View style={styles.pillRow}>
              <StatusPill label={t(ORD_STR.ackStatusDone)} tone="success" />
            </View>
            <Text style={[styles.line, { color: theme.fgMuted }]}>
              {formatDateTime(acknowledgedAt, lang)}
            </Text>
            {doctorNote.length > 0 ? (
              <Text style={[styles.line, { color: theme.fgMuted }]}>
                {t(ORD_STR.yourNote)}: <Text style={{ color: theme.fg }}>{doctorNote}</Text>
              </Text>
            ) : null}
          </View>
        ) : !noteDraft.restored ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.accent} />
          </View>
        ) : (
          <View style={styles.rows}>
            <TextField
              label={t(ORD_STR.doctorNoteLabel)}
              hint={t(ORD_STR.doctorNoteHint)}
              value={noteDraft.value}
              onChangeText={noteDraft.setValue}
              maxLength={MAX_NOTES_LEN}
              multiline
              testID="ack-note"
            />
            {ackError !== null ? (
              <Text style={[styles.error, { color: theme.status.danger }]}>{ackError}</Text>
            ) : null}
            <Button
              title={t(ORD_STR.ackButton)}
              loading={ackWrite.busy}
              disabled={ackWrite.busy}
              accessibilityLabel={t(ORD_STR.ackButton)}
              testID="ack-result"
              onPress={confirmAcknowledge}
            />
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  center: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  criticalBanner: {
    borderRadius: radius.md,
    padding: spacing.md,
  },
  criticalText: { fontSize: fontSize.bodySm, fontWeight: '700' },
  card: {
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
  title: { fontSize: fontSize.h3, fontWeight: '700', flexShrink: 1 },
  sectionTitle: { fontSize: fontSize.body, fontWeight: '700' },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  rows: { gap: spacing.sm },
  line: { fontSize: fontSize.bodySm },
  caption: { fontSize: fontSize.caption },
  analyteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  analyteMain: { flex: 1, gap: 2 },
  analyteName: { fontSize: fontSize.bodySm, fontWeight: '600' },
  analyteTrailing: { alignItems: 'flex-end', gap: spacing.xs },
  analyteValue: { fontSize: fontSize.body, fontWeight: '700' },
  emptyTitle: { fontSize: fontSize.bodySm, fontWeight: '600' },
  error: { fontSize: fontSize.bodySm, fontWeight: '600' },
});
