// Doctor chamber queue — live now-serving card + next-up list, polled
// every 15s while focused (never useCachedQuery: a cached queue is a
// wrong queue — see src/features/doctor-queue/useDoctorQueuePoll.ts).
//
// Actions (all real backend transitions, Wave 68b RT-502):
//   Call next   POST /api/v1/queue/call-next            DOCTOR_READY → IN_CONSULTATION
//   Complete    POST /api/v1/queue/{entryId}/complete   IN_CONSULTATION → COMPLETED
//   No-show     POST /api/v1/queue/{entryId}/no-show    any active → NO_SHOW
//
// Honesty rules: spinner only on the FIRST load; a failed tick keeps the
// last snapshot on screen with an explicit stale notice + timestamp;
// empty states are definitive server answers, never fabricated rows.

import { useRouter } from 'expo-router';
import * as React from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { ApiError } from '@/api/errors';
import { useSession } from '@/auth/sessionStore';
import { COMMON, formatDateTime, useT } from '@/i18n';
import { useWrite } from '@/offline/useWrite';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { FreshnessBadge } from '@/ui/FreshnessBadge';
import { ListRow } from '@/ui/ListRow';
import { ScreenScaffold } from '@/ui/ScreenScaffold';
import { SectionHeader } from '@/ui/SectionHeader';
import { StatusPill } from '@/ui/StatusPill';
import { useTheme } from '@/ui/theme';
import { MIN_TOUCH_TARGET, fontSize, radius, spacing } from '@/ui/tokens';

import {
  chamberNameOf,
  formatNumber,
  isWalkIn,
  joinParts,
  minutesBetween,
  priorityTone,
} from '@/features/doctor-queue/logic';
import {
  DOCTOR_QUEUE_STRINGS as DQ,
  inConsultLabel,
  priorityLabel,
  waitShortLabel,
} from '@/features/doctor-queue/strings';
import type {
  CallNextResultLite,
  CompleteConsultationResultLite,
  DoctorQueueEntry,
  MarkNoShowResultLite,
} from '@/features/doctor-queue/types';
import { useDoctorQueuePoll } from '@/features/doctor-queue/useDoctorQueuePoll';

export default function DoctorQueueScreen(): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  const { lang, t } = useT();
  const userId = useSession((s) => s.userId);

  const [selectedChamberId, setSelectedChamberId] = React.useState<string | null>(null);

  const {
    phase,
    chambers,
    chamberId,
    snapshot,
    stale,
    errorMessage,
    refresh,
    refreshNow,
  } = useDoctorQueuePoll({ userId, selectedChamberId });

  const callNext = useWrite<CallNextResultLite>();
  const complete = useWrite<CompleteConsultationResultLite>();
  const noShow = useWrite<MarkNoShowResultLite>();

  const openPatientChart = React.useCallback(
    (patientId: string): void => {
      router.push(`/(doctor)/patients/${patientId}` as never);
    },
    [router],
  );

  const surfaceWriteError = React.useCallback(
    (error: ApiError): void => {
      if (error.code === 'OFFLINE') {
        Alert.alert(t(COMMON.offline), t(DQ.offlineWrite));
        return;
      }
      Alert.alert(t(COMMON.genericError), error.message);
      // The queue likely moved under us (e.g. CONFLICT) — resync now.
      refreshNow();
    },
    [t, refreshNow],
  );

  const doCallNext = React.useCallback(async (): Promise<void> => {
    if (chamberId === null) return;
    const res = await callNext.submit({
      method: 'POST',
      path: '/api/v1/queue/call-next',
      body: { chamberId },
    });
    if (res.ok) {
      refreshNow();
      return;
    }
    if (res.error.code === 'RESOURCE_NOT_FOUND') {
      // Backend's definitive "no DOCTOR_READY entries" answer.
      Alert.alert(t(DQ.callNextEmptyTitle), t(DQ.callNextEmptyBody));
      refreshNow();
      return;
    }
    surfaceWriteError(res.error);
  }, [chamberId, callNext, refreshNow, surfaceWriteError, t]);

  const onCallNext = React.useCallback((): void => {
    if (snapshot?.nowServing) {
      // Guard: calling next does NOT complete the current consultation.
      Alert.alert(t(DQ.confirmCallTitle), t(DQ.confirmCallBody), [
        { text: t(COMMON.cancel), style: 'cancel' },
        { text: t(DQ.callNext), onPress: () => void doCallNext() },
      ]);
      return;
    }
    void doCallNext();
  }, [snapshot, t, doCallNext]);

  const onComplete = React.useCallback(
    (entry: DoctorQueueEntry): void => {
      Alert.alert(t(DQ.confirmCompleteTitle), t(DQ.confirmCompleteBody), [
        { text: t(COMMON.cancel), style: 'cancel' },
        {
          text: t(COMMON.confirm),
          onPress: () => {
            void (async () => {
              const res = await complete.submit({
                method: 'POST',
                path: `/api/v1/queue/${encodeURIComponent(entry.id)}/complete`,
              });
              if (res.ok) refreshNow();
              else surfaceWriteError(res.error);
            })();
          },
        },
      ]);
    },
    [t, complete, refreshNow, surfaceWriteError],
  );

  const onNoShow = React.useCallback(
    (entry: DoctorQueueEntry): void => {
      Alert.alert(t(DQ.confirmNoShowTitle), t(DQ.confirmNoShowBody), [
        { text: t(COMMON.cancel), style: 'cancel' },
        {
          text: t(DQ.noShow),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const res = await noShow.submit({
                method: 'POST',
                path: `/api/v1/queue/${encodeURIComponent(entry.id)}/no-show`,
              });
              if (res.ok) refreshNow();
              else surfaceWriteError(res.error);
            })();
          },
        },
      ]);
    },
    [t, noShow, refreshNow, surfaceWriteError],
  );

  const chamberName = chamberNameOf(chambers, chamberId);

  const renderWaitingRow = ({ item }: { item: DoctorQueueEntry }): React.ReactElement => {
    const name = item.patientName?.trim() ?? '';
    const displayName = name.length > 0 ? name : (item.tokenNumber ?? '—');
    const title =
      typeof item.queueNumber === 'number'
        ? `#${formatNumber(item.queueNumber, lang)} · ${displayName}`
        : displayName;
    const subtitle = joinParts([
      t(DQ.readyForDoctor),
      typeof item.tokenNumber === 'string' && item.tokenNumber.length > 0
        ? `${t(DQ.token)} ${item.tokenNumber}`
        : null,
      typeof item.checkInTime === 'string' && item.checkInTime.length > 0
        ? `${t(DQ.checkedIn)} ${formatDateTime(item.checkInTime, lang)}`
        : null,
      isWalkIn(item.appointmentType) ? t(DQ.walkIn) : null,
    ]);
    const waited =
      snapshot !== null ? minutesBetween(item.checkInTime, snapshot.fetchedAt) : null;
    const prioLbl = priorityLabel(item.priority);
    const prioTone = priorityTone(item.priority);
    const patientId = item.patientId;
    return (
      <ListRow
        title={title}
        subtitle={subtitle}
        {...(waited !== null ? { meta: t(waitShortLabel(waited)) } : {})}
        {...(prioLbl !== null && prioTone !== null
          ? { right: <StatusPill label={t(prioLbl)} tone={prioTone} /> }
          : {})}
        {...(typeof patientId === 'string' && patientId.length > 0
          ? { onPress: () => openPatientChart(patientId) }
          : {})}
        accessibilityLabel={`${displayName}. ${subtitle}`}
      />
    );
  };

  let body: React.ReactElement;
  if (userId === null) {
    body = <EmptyState title={t(DQ.needSession)} />;
  } else if (phase === 'loading') {
    body = (
      <View style={styles.center}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  } else if (phase === 'noChamber') {
    body = <EmptyState title={t(DQ.noChamberTitle)} message={t(DQ.noChamberBody)} />;
  } else if (phase === 'error' || snapshot === null) {
    body = (
      <EmptyState
        title={t(COMMON.genericError)}
        {...(errorMessage !== null ? { message: errorMessage } : {})}
        actionLabel={t(COMMON.retry)}
        onAction={refresh}
      />
    );
  } else {
    const snap = snapshot;
    const nowServing = snap.nowServing;
    const nowServingPatientId =
      nowServing !== null &&
      typeof nowServing.patientId === 'string' &&
      nowServing.patientId.length > 0
        ? nowServing.patientId
        : null;
    const header = (
      <View style={styles.headerWrap}>
        {stale ? (
          <Text
            style={[styles.stale, { color: theme.status.warningText }]}
            accessibilityRole="alert"
          >
            {`${t(DQ.staleNotice)} ${formatDateTime(snap.fetchedAt, lang)}`}
          </Text>
        ) : null}

        {chambers.length <= 1 && chamberName !== null ? (
          <Text style={[styles.chamberCaption, { color: theme.fgSubtle }]}>
            {`${t(DQ.chamber)}: ${chamberName}`}
          </Text>
        ) : null}

        {nowServing !== null ? (
          <NowServingCard
            entry={nowServing}
            fetchedAt={snap.fetchedAt}
            completing={complete.busy}
            noShowing={noShow.busy}
            onComplete={() => onComplete(nowServing)}
            onNoShow={() => onNoShow(nowServing)}
            onOpenChart={
              nowServingPatientId !== null
                ? () => openPatientChart(nowServingPatientId)
                : null
            }
          />
        ) : (
          <View
            style={[
              styles.card,
              { borderColor: theme.line, backgroundColor: theme.bgElevated },
            ]}
          >
            <Text style={[styles.nowLabel, { color: theme.fgMuted }]}>
              {t(DQ.nowServing)}
            </Text>
            <Text style={[styles.noConsultText, { color: theme.fgMuted }]}>
              {t(DQ.noOneInConsult)}
            </Text>
          </View>
        )}

        <Button
          title={t(DQ.callNext)}
          onPress={onCallNext}
          loading={callNext.busy}
          accessibilityLabel={t(DQ.callNext)}
        />

        <View style={styles.nextUpRow}>
          <Text
            accessibilityRole="header"
            style={[styles.nextUpTitle, { color: theme.fg }]}
          >
            {t(DQ.nextUp)}
          </Text>
          <Text style={[styles.nextUpCount, { color: theme.fgMuted }]}>
            {formatNumber(snap.waiting.length, lang)}
          </Text>
        </View>
      </View>
    );

    body = (
      <FlatList
        data={snap.waiting}
        keyExtractor={(entry) => entry.id}
        contentContainerStyle={styles.list}
        renderItem={renderWaitingRow}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <EmptyState title={t(DQ.noneWaitingTitle)} message={t(DQ.noneWaitingBody)} />
        }
        ListFooterComponent={
          <Text style={[styles.autoRefresh, { color: theme.fgSubtle }]}>
            {t(DQ.autoRefresh)}
          </Text>
        }
      />
    );
  }

  return (
    <ScreenScaffold phi>
      <SectionHeader
        title={t(DQ.title)}
        right={<FreshnessBadge fetchedAt={snapshot?.fetchedAt ?? null} />}
      />
      {chambers.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          contentContainerStyle={styles.chips}
        >
          {chambers.map((chamber) => {
            const selected = chamber.id === chamberId;
            const trimmed = chamber.name?.trim() ?? '';
            const label = trimmed.length > 0 ? trimmed : chamber.id.slice(0, 8);
            return (
              <Pressable
                key={chamber.id}
                accessibilityRole="button"
                accessibilityLabel={`${t(DQ.chamber)}: ${label}`}
                accessibilityState={{ selected }}
                onPress={() => setSelectedChamberId(chamber.id)}
                style={[
                  styles.chip,
                  {
                    borderColor: selected ? theme.accent : theme.line,
                    backgroundColor: selected ? theme.accentSoft : theme.bgElevated,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: selected ? theme.accent : theme.fgMuted },
                  ]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
      {body}
    </ScreenScaffold>
  );
}

// ─── Now-serving card ───────────────────────────────────────────────────

function NowServingCard({
  entry,
  fetchedAt,
  completing,
  noShowing,
  onComplete,
  onNoShow,
  onOpenChart,
}: {
  entry: DoctorQueueEntry;
  fetchedAt: number;
  completing: boolean;
  noShowing: boolean;
  onComplete: () => void;
  onNoShow: () => void;
  onOpenChart: (() => void) | null;
}): React.ReactElement {
  const theme = useTheme();
  const { lang, t } = useT();

  const name = entry.patientName?.trim() ?? '';
  const displayName = name.length > 0 ? name : (entry.tokenNumber ?? '—');
  const elapsed = minutesBetween(
    entry.consultationStartTime ?? entry.calledAt,
    fetchedAt,
  );
  const prioLbl = priorityLabel(entry.priority);
  const prioTone = priorityTone(entry.priority);
  const metaLine = joinParts([
    typeof entry.tokenNumber === 'string' && entry.tokenNumber.length > 0
      ? `${t(DQ.token)} ${entry.tokenNumber}`
      : null,
    typeof entry.queueNumber === 'number'
      ? `${t(DQ.serial)} ${formatNumber(entry.queueNumber, lang)}`
      : null,
    typeof entry.checkInTime === 'string' && entry.checkInTime.length > 0
      ? `${t(DQ.checkedIn)} ${formatDateTime(entry.checkInTime, lang)}`
      : null,
  ]);
  const prepNotes = entry.assistantPrepNotes?.trim() ?? '';

  const identity = (
    <>
      <Text style={[styles.nowName, { color: theme.fg }]} numberOfLines={2}>
        {displayName}
      </Text>
      {metaLine.length > 0 ? (
        <Text style={[styles.nowMeta, { color: theme.fgMuted }]}>{metaLine}</Text>
      ) : null}
    </>
  );

  return (
    <View
      style={[
        styles.card,
        styles.nowCard,
        { borderColor: theme.accent, backgroundColor: theme.bgElevated },
      ]}
      accessibilityLiveRegion="polite"
    >
      <Text style={[styles.nowLabel, { color: theme.fgMuted }]}>
        {t(DQ.nowServing)}
      </Text>
      <View style={styles.pillRow}>
        <StatusPill label={t(inConsultLabel(elapsed))} tone="success" />
        {prioLbl !== null && prioTone !== null ? (
          <StatusPill label={t(prioLbl)} tone={prioTone} />
        ) : null}
      </View>
      {onOpenChart !== null ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t(DQ.openChart)}: ${displayName}`}
          onPress={onOpenChart}
          style={({ pressed }) => [styles.nowIdentity, pressed && { opacity: 0.85 }]}
        >
          {identity}
        </Pressable>
      ) : (
        <View style={styles.nowIdentity}>{identity}</View>
      )}
      {prepNotes.length > 0 ? (
        <View style={[styles.notes, { backgroundColor: theme.bgSoft }]}>
          <Text style={[styles.notesLabel, { color: theme.fgMuted }]}>
            {t(DQ.prepNotes)}
          </Text>
          <Text style={[styles.notesBody, { color: theme.fg }]}>{prepNotes}</Text>
        </View>
      ) : null}
      <View style={styles.actionsRow}>
        <View style={styles.actionGrow}>
          <Button
            title={t(DQ.complete)}
            onPress={onComplete}
            loading={completing}
            disabled={noShowing}
            accessibilityLabel={t(DQ.complete)}
          />
        </View>
        <View style={styles.actionGrow}>
          <Button
            title={t(DQ.noShow)}
            variant="secondary"
            onPress={onNoShow}
            loading={noShowing}
            disabled={completing}
            accessibilityLabel={t(DQ.noShow)}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  headerWrap: { gap: spacing.md, marginBottom: spacing.sm },
  stale: { fontSize: fontSize.bodySm, fontWeight: '600' },
  chamberCaption: { fontSize: fontSize.caption },
  chipsScroll: { flexGrow: 0 },
  chips: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    maxWidth: 220,
  },
  chipText: { fontSize: fontSize.bodySm, fontWeight: '600' },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  nowCard: { borderWidth: 1 },
  nowLabel: {
    fontSize: fontSize.caption,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  noConsultText: { fontSize: fontSize.bodySm },
  pillRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  nowIdentity: { gap: 2, minHeight: MIN_TOUCH_TARGET, justifyContent: 'center' },
  nowName: { fontSize: fontSize.h3, fontWeight: '700' },
  nowMeta: { fontSize: fontSize.bodySm },
  notes: { borderRadius: radius.sm, padding: spacing.md, gap: 2 },
  notesLabel: {
    fontSize: fontSize.caption,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  notesBody: { fontSize: fontSize.bodySm, fontStyle: 'italic' },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  actionGrow: { flex: 1 },
  nextUpRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  nextUpTitle: { fontSize: fontSize.h3, fontWeight: '700' },
  nextUpCount: { fontSize: fontSize.bodySm, fontVariant: ['tabular-nums'] },
  autoRefresh: { fontSize: fontSize.caption, textAlign: 'center', marginTop: spacing.md },
});
