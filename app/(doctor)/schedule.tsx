// Doctor schedule management — weekly recurring template, one-off blocks,
// and block history. Reached from the Today quick link and the More hub
// (hidden from the tab bar via href:null in the doctor layout).
//
//   Reads:  GET  /api/v1/doctors/me/schedule            (weekly template)
//           GET  /api/v1/doctors/me/schedule/blocks     (block history)
//           GET  /api/v1/doctors/{userId}/chambers      (facilityId → name)
//   Writes: POST /api/v1/doctors/me/schedule/blocks     (create a block)
//           POST /api/v1/doctors/me/schedule/recurring  (remove one slot —
//                the endpoint REPLACES the whole weekly set, so removal
//                republishes the remaining slots)
//
// The backend has NO delete endpoint for applied blocks — the history
// section says so honestly instead of faking an affordance.
//
// Non-PHI surface: schedule slots and blocks are the doctor's own catalog
// rows (time windows; no patient data), per the backend module docs.

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

import {
  DOCTOR_BLOCKS_KEY,
  DOCTOR_SCHEDULE_KEY,
  useMyChambers,
  useMySchedule,
  useMyScheduleBlocks,
} from '@/features/doctor-schedule/hooks';
import {
  buildBlockBody,
  buildRemoveSlotBody,
  chamberDisplayName,
  formatMinuteOfDay,
  formatNumber,
  groupSlotsByDay,
  makeEmptyBlockDraft,
  type BlockDraftValues,
  type BlockFormIssue,
} from '@/features/doctor-schedule/logic';
import {
  SCHED_STR,
  dayOfWeekLabel,
  slotsRemovedLabel,
} from '@/features/doctor-schedule/strings';
import type {
  BlockScheduleResult,
  MyScheduleSlot,
  PublishScheduleResult,
} from '@/features/doctor-schedule/types';
import { COMMON, formatDateTime, useT } from '@/i18n';
import { useWrite } from '@/offline/useWrite';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { FreshnessBadge } from '@/ui/FreshnessBadge';
import { ListRow } from '@/ui/ListRow';
import { ScreenScaffold } from '@/ui/ScreenScaffold';
import { SectionHeader } from '@/ui/SectionHeader';
import { TextField } from '@/ui/TextField';
import { useTheme } from '@/ui/theme';
import { useDraft } from '@/ui/useDraft';
import { fontSize, spacing } from '@/ui/tokens';

export default function DoctorSchedule(): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { lang, t } = useT();

  const schedule = useMySchedule();
  const blocks = useMyScheduleBlocks();
  const chambers = useMyChambers();

  // ── Remove a recurring slot (republish the remaining set) ─────────────
  const removeWrite = useWrite<PublishScheduleResult>();
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const [removeError, setRemoveError] = React.useState<string | null>(null);

  const slots = schedule.data?.slots ?? [];
  const dayGroups = groupSlotsByDay(slots);
  const chamberRows = chambers.data?.chambers ?? [];

  const doRemoveSlot = async (slot: MyScheduleSlot): Promise<void> => {
    const body = buildRemoveSlotBody(slots, slot.id);
    if (body === null) return;
    setRemoveError(null);
    setRemovingId(slot.id);
    const res = await removeWrite.submit({
      method: 'POST',
      path: '/api/v1/doctors/me/schedule/recurring',
      body,
    });
    setRemovingId(null);
    if (res.ok) {
      void queryClient.invalidateQueries({ queryKey: [DOCTOR_SCHEDULE_KEY] });
      Alert.alert(t(SCHED_STR.slotRemoved));
    } else if (res.error.code === 'OFFLINE') {
      setRemoveError(t(SCHED_STR.offlineWrite));
    } else {
      setRemoveError(res.error.message || t(COMMON.genericError));
    }
  };

  const confirmRemoveSlot = (slot: MyScheduleSlot): void => {
    Alert.alert(t(SCHED_STR.removeSlotTitle), t(SCHED_STR.removeSlotBody), [
      { text: t(COMMON.cancel), style: 'cancel' },
      {
        text: t(SCHED_STR.removeSlot),
        style: 'destructive',
        onPress: () => void doRemoveSlot(slot),
      },
    ]);
  };

  // ── Block form ────────────────────────────────────────────────────────
  const initialDraft = React.useMemo(() => makeEmptyBlockDraft(new Date()), []);
  const draft = useDraft<BlockDraftValues>('doctor:schedule:block', initialDraft);
  const d = draft.value;
  const setD = (patch: Partial<BlockDraftValues>): void =>
    draft.setValue({ ...draft.value, ...patch });

  const blockWrite = useWrite<BlockScheduleResult>();
  const [issue, setIssue] = React.useState<BlockFormIssue | null>(null);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const issueMessage = (i: BlockFormIssue): string => {
    switch (i.kind) {
      case 'START_INVALID':
        return t(SCHED_STR.startInvalid);
      case 'END_INVALID':
        return t(SCHED_STR.endInvalid);
      case 'END_NOT_AFTER_START':
        return t(SCHED_STR.endNotAfterStart);
      case 'RANGE_TOO_LONG':
        return t(SCHED_STR.rangeTooLong);
      case 'REASON_TOO_LONG':
        return t(SCHED_STR.reasonTooLong);
    }
  };

  const startIssue = issue !== null && issue.kind === 'START_INVALID';
  const endIssue =
    issue !== null &&
    (issue.kind === 'END_INVALID' ||
      issue.kind === 'END_NOT_AFTER_START' ||
      issue.kind === 'RANGE_TOO_LONG');
  const reasonIssue = issue !== null && issue.kind === 'REASON_TOO_LONG';

  const submitBlock = async (): Promise<void> => {
    setServerError(null);
    const built = buildBlockBody(draft.value);
    if (!built.ok) {
      setIssue(built.issue);
      return;
    }
    setIssue(null);
    const res = await blockWrite.submit({
      method: 'POST',
      path: '/api/v1/doctors/me/schedule/blocks',
      body: built.body,
    });
    if (res.ok) {
      draft.clear();
      draft.setValue(makeEmptyBlockDraft(new Date()));
      // A block drops intersecting recurring slots — refresh both reads.
      void queryClient.invalidateQueries({ queryKey: [DOCTOR_BLOCKS_KEY] });
      void queryClient.invalidateQueries({ queryKey: [DOCTOR_SCHEDULE_KEY] });
      const removed = res.value?.removedSlotCount;
      Alert.alert(
        t(SCHED_STR.blockApplied),
        removed !== undefined
          ? `${t(SCHED_STR.blockAppliedDetail)}: ${formatNumber(removed, lang)}`
          : undefined,
      );
    } else if (res.error.code === 'OFFLINE') {
      setServerError(t(SCHED_STR.offlineWrite));
    } else {
      setServerError(res.error.message || t(COMMON.genericError));
    }
  };

  const confirmBlock = (): void => {
    setServerError(null);
    const built = buildBlockBody(draft.value);
    if (!built.ok) {
      setIssue(built.issue);
      return;
    }
    setIssue(null);
    Alert.alert(t(SCHED_STR.confirmBlockTitle), t(SCHED_STR.confirmBlockBody), [
      { text: t(COMMON.cancel), style: 'cancel' },
      {
        text: t(COMMON.confirm),
        style: 'destructive',
        onPress: () => void submitBlock(),
      },
    ]);
  };

  // ── Render helpers ────────────────────────────────────────────────────
  const slotSubtitle = (slot: MyScheduleSlot): string => {
    const resolved = chamberDisplayName(slot.facilityId, chamberRows);
    if (resolved.kind === 'universal') return t(SCHED_STR.allChambers);
    if (resolved.kind === 'named') return resolved.name;
    return `${t(SCHED_STR.chamberRef)} ${resolved.shortId}`;
  };

  const blockHistory = blocks.data?.blocks ?? [];

  return (
    <ScreenScaffold>
      <SectionHeader
        title={t(SCHED_STR.scheduleTitle)}
        right={<FreshnessBadge fetchedAt={schedule.fetchedAt} />}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Weekly recurring template ─────────────────────────────── */}
        <Text style={[styles.sectionTitle, { color: theme.fg }]}>
          {t(SCHED_STR.weeklyTemplate)}
        </Text>
        <Text style={[styles.hint, { color: theme.fgMuted }]}>
          {t(SCHED_STR.weeklyTemplateHint)}
        </Text>

        {schedule.isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        ) : schedule.error && !schedule.data ? (
          <EmptyState
            title={t(COMMON.genericError)}
            message={schedule.error.message}
            actionLabel={t(COMMON.retry)}
            onAction={schedule.refetch}
          />
        ) : schedule.data?.doctorProfileId === null ? (
          <EmptyState
            title={t(SCHED_STR.noProfile)}
            message={t(SCHED_STR.noProfileHint)}
          />
        ) : dayGroups.length === 0 ? (
          <EmptyState
            title={t(SCHED_STR.noSlots)}
            message={t(SCHED_STR.noSlotsHint)}
          />
        ) : (
          dayGroups.map((group) => (
            <View key={group.day} style={styles.dayGroup}>
              <Text style={[styles.dayLabel, { color: theme.fgMuted }]}>
                {t(dayOfWeekLabel(group.day))}
              </Text>
              {group.slots.map((slot) => (
                <ListRow
                  key={slot.id}
                  title={`${formatMinuteOfDay(slot.startMinuteOfDay, lang)} – ${formatMinuteOfDay(slot.endMinuteOfDay, lang)}`}
                  subtitle={slotSubtitle(slot)}
                  right={
                    <Button
                      title={t(SCHED_STR.removeSlot)}
                      variant="destructive"
                      accessibilityLabel={`${t(SCHED_STR.removeSlot)} · ${t(dayOfWeekLabel(group.day))} ${formatMinuteOfDay(slot.startMinuteOfDay, lang)}`}
                      loading={removingId === slot.id}
                      disabled={removeWrite.busy}
                      testID={`remove-slot-${slot.id}`}
                      onPress={() => confirmRemoveSlot(slot)}
                    />
                  }
                />
              ))}
            </View>
          ))
        )}
        {removeError !== null ? (
          <Text style={[styles.error, { color: theme.status.danger }]}>
            {removeError}
          </Text>
        ) : null}

        {/* ── Block time off ─────────────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { color: theme.fg }]}>
          {t(SCHED_STR.blockSection)}
        </Text>
        <Text style={[styles.hint, { color: theme.fgMuted }]}>
          {t(SCHED_STR.blockHint)}
        </Text>

        {!draft.restored ? (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={[styles.fieldLabel, { color: theme.fg }]}>
              {t(SCHED_STR.blockFrom)}
            </Text>
            <View style={styles.dtRow}>
              <View style={styles.dtDate}>
                <TextField
                  label={t(SCHED_STR.dateLabel)}
                  value={d.startDate}
                  onChangeText={(startDate) => setD({ startDate })}
                  keyboardType="numbers-and-punctuation"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="2026-07-15"
                  {...(startIssue && issue !== null
                    ? { error: issueMessage(issue) }
                    : {})}
                  testID="block-start-date"
                />
              </View>
              <View style={styles.dtTime}>
                <TextField
                  label={t(SCHED_STR.timeLabel)}
                  value={d.startTime}
                  onChangeText={(startTime) => setD({ startTime })}
                  keyboardType="numbers-and-punctuation"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="09:00"
                  testID="block-start-time"
                />
              </View>
            </View>

            <Text style={[styles.fieldLabel, { color: theme.fg }]}>
              {t(SCHED_STR.blockTo)}
            </Text>
            <View style={styles.dtRow}>
              <View style={styles.dtDate}>
                <TextField
                  label={t(SCHED_STR.dateLabel)}
                  value={d.endDate}
                  onChangeText={(endDate) => setD({ endDate })}
                  keyboardType="numbers-and-punctuation"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="2026-07-16"
                  {...(endIssue && issue !== null
                    ? { error: issueMessage(issue) }
                    : {})}
                  testID="block-end-date"
                />
              </View>
              <View style={styles.dtTime}>
                <TextField
                  label={t(SCHED_STR.timeLabel)}
                  value={d.endTime}
                  onChangeText={(endTime) => setD({ endTime })}
                  keyboardType="numbers-and-punctuation"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="17:00"
                  testID="block-end-time"
                />
              </View>
            </View>

            <TextField
              label={t(SCHED_STR.reasonLabel)}
              hint={t(SCHED_STR.reasonHint)}
              value={d.reason}
              onChangeText={(reason) => setD({ reason })}
              maxLength={200}
              {...(reasonIssue && issue !== null
                ? { error: issueMessage(issue) }
                : {})}
              testID="block-reason"
            />

            {serverError !== null ? (
              <Text style={[styles.error, { color: theme.status.danger }]}>
                {serverError}
              </Text>
            ) : null}

            <Button
              title={t(SCHED_STR.applyBlock)}
              loading={blockWrite.busy}
              disabled={blockWrite.busy}
              accessibilityLabel={t(SCHED_STR.applyBlock)}
              testID="apply-block"
              onPress={confirmBlock}
            />
          </View>
        )}

        {/* ── Block history ──────────────────────────────────────────── */}
        <View style={styles.historyHeader}>
          <Text style={[styles.sectionTitle, { color: theme.fg }]}>
            {t(SCHED_STR.blockHistory)}
          </Text>
          <FreshnessBadge fetchedAt={blocks.fetchedAt} />
        </View>

        {blocks.isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        ) : blocks.error && !blocks.data ? (
          <EmptyState
            title={t(COMMON.genericError)}
            message={blocks.error.message}
            actionLabel={t(COMMON.retry)}
            onAction={blocks.refetch}
          />
        ) : blockHistory.length === 0 ? (
          <EmptyState
            title={t(SCHED_STR.noBlocks)}
            message={t(SCHED_STR.noBlocksHint)}
          />
        ) : (
          <View style={styles.historyList}>
            {blockHistory.map((block) => (
              <ListRow
                key={block.id}
                title={`${formatDateTime(block.startsAt, lang)} → ${formatDateTime(block.endsAt, lang)}`}
                {...(block.reason !== null && block.reason !== undefined && block.reason.length > 0
                  ? { subtitle: block.reason }
                  : {})}
                {...(block.cancelledSlotCount !== undefined
                  ? {
                      meta: t(
                        slotsRemovedLabel(
                          formatNumber(block.cancelledSlotCount, lang),
                        ),
                      ),
                    }
                  : {})}
              />
            ))}
            <Text style={[styles.hint, { color: theme.fgMuted }]}>
              {t(SCHED_STR.blockRemovalUnsupported)}
            </Text>
          </View>
        )}

        <Button
          title={t(SCHED_STR.back)}
          variant="ghost"
          accessibilityLabel={t(SCHED_STR.back)}
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace('/(doctor)')
          }
        />
      </ScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  center: { alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  sectionTitle: { fontSize: fontSize.h3, fontWeight: '700', marginTop: spacing.sm },
  hint: { fontSize: fontSize.bodySm },
  dayGroup: { gap: spacing.xs },
  dayLabel: { fontSize: fontSize.bodySm, fontWeight: '600', marginTop: spacing.xs },
  form: { gap: spacing.md },
  fieldLabel: { fontSize: fontSize.bodySm, fontWeight: '600' },
  dtRow: { flexDirection: 'row', gap: spacing.sm },
  dtDate: { flex: 3 },
  dtTime: { flex: 2 },
  error: { fontSize: fontSize.bodySm, fontWeight: '600' },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  historyList: { gap: spacing.sm },
});
