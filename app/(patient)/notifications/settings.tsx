// Patient notification preferences — digest mode, quiet hours, per-event
// channel matrix, and the TCPA/GDPR channel-wide opt-out registry.
//
//   Reads:  GET /api/v1/me/notifications/preferences → digest mode,
//           quiet hours, eventTypeOptOuts matrix (defaults when no row).
//           GET /api/v1/me/notifications/opt-outs → channel opt-out rows.
//   Writes: PATCH /api/v1/me/notifications/digest-mode
//           PATCH /api/v1/me/notifications/quiet-hours
//           PATCH /api/v1/me/notifications/opt-out  (event × channel cell)
//           POST  /api/v1/me/notifications/opt-out  (whole channel — the
//           registry is append-only: one-way, no self-service restore).
//
// Mirrors the web settings/notifications page (RT-311/312/313):
// lab_critical × IN_APP is locked always-on (clinical safety) and the
// channel opt-out needs an explicit destructive confirm (TCPA surface).

import { useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { useCachedQuery } from '@/api/useCachedQuery';
import { useSession } from '@/auth/sessionStore';
import { COMMON, formatDate, useT } from '@/i18n';
import { useWrite } from '@/offline/useWrite';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { FreshnessBadge } from '@/ui/FreshnessBadge';
import { ScreenScaffold } from '@/ui/ScreenScaffold';
import { SectionHeader } from '@/ui/SectionHeader';
import { StatusPill } from '@/ui/StatusPill';
import { TextField } from '@/ui/TextField';
import { fontSize, MIN_TOUCH_TARGET, radius, spacing } from '@/ui/tokens';
import { useTheme } from '@/ui/theme';
import { useDraft } from '@/ui/useDraft';

import {
  isCellLocked,
  isCellOptedOut,
  isChannelOptedOut,
  normalizeQuietTime,
  toggleTuple,
} from '@/features/patient-notifications/logic';
import {
  channelLabel,
  digestModeLabel,
  digestSavedMsg,
  eventTypeLabel,
  matrixSavedMsg,
  optOutConfirmMsg,
  optOutSourceLabel,
  quietSavedMsg,
  STR,
} from '@/features/patient-notifications/strings';
import type {
  ChannelOptOutBody,
  ChannelOptOutResult,
  DigestMode,
  DigestModeBody,
  DigestModeResult,
  EventOptOutBody,
  EventOptOutResult,
  EventOptOutTuple,
  EventTypeKey,
  MatrixChannel,
  NotificationPreferences,
  OptOutChannel,
  OptOutsPayload,
  QuietHoursBody,
  QuietHoursResult,
} from '@/features/patient-notifications/types';

const PREFS_KEY = 'patient:notifications:prefs';
const OPTOUTS_KEY = 'patient:notifications:optouts';

const DIGEST_MODES: DigestMode[] = ['REALTIME', 'DAILY', 'WEEKLY', 'NEVER'];
const EVENT_TYPES: EventTypeKey[] = [
  'booking_confirmed',
  'refill_ready',
  'lab_critical',
  'billing_invoice',
  'marketing',
];
const MATRIX_CHANNELS: MatrixChannel[] = ['SMS', 'EMAIL', 'PUSH', 'IN_APP'];
const OPTOUT_CHANNELS: OptOutChannel[] = ['SMS', 'EMAIL', 'PUSH'];

interface QuietDraft {
  start: string;
  end: string;
  suppress: boolean;
  /** True once server values were copied in (draft edits then win). */
  seeded: boolean;
}

const EMPTY_QUIET: QuietDraft = { start: '', end: '', suppress: true, seeded: false };

export default function PatientNotificationSettings(): React.ReactElement {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { lang, t } = useT();
  const userId = useSession((s) => s.userId);

  // ── Reads ──────────────────────────────────────────────────────────────
  const prefs = useCachedQuery<NotificationPreferences>({
    key: PREFS_KEY,
    path: '/api/v1/me/notifications/preferences',
    ttlMs: 5 * 60 * 1000,
    isPhi: false,
    ...(userId !== null ? { userId } : {}),
  });

  const optOuts = useCachedQuery<OptOutsPayload>({
    key: OPTOUTS_KEY,
    path: '/api/v1/me/notifications/opt-outs',
    ttlMs: 5 * 60 * 1000,
    isPhi: false,
    ...(userId !== null ? { userId } : {}),
  });

  // ── Digest mode ────────────────────────────────────────────────────────
  const digestWrite = useWrite<DigestModeResult>();
  const [digestLocal, setDigestLocal] = React.useState<string | null>(null);
  const [digestNote, setDigestNote] = React.useState<string | null>(null);
  const [digestError, setDigestError] = React.useState<string | null>(null);
  const digestMode = digestLocal ?? prefs.data?.digestMode ?? 'REALTIME';

  const chooseDigest = (mode: DigestMode): void => {
    if (digestWrite.busy || mode === digestMode) return;
    setDigestError(null);
    setDigestNote(null);
    void (async () => {
      const res = await digestWrite.submit({
        method: 'PATCH',
        path: '/api/v1/me/notifications/digest-mode',
        body: { digestMode: mode } satisfies DigestModeBody,
      });
      if (res.ok) {
        setDigestLocal(res.value?.digestMode ?? mode);
        setDigestNote(t(digestSavedMsg(digestModeLabel(mode))));
        void queryClient.invalidateQueries({ queryKey: [PREFS_KEY] });
      } else if (res.error.code === 'OFFLINE') {
        setDigestError(t(STR.offlineWrite));
      } else {
        setDigestError(res.error.message || t(STR.couldNotSave));
      }
    })();
  };

  // ── Quiet hours (multi-field form → useDraft) ──────────────────────────
  const quietDraft = useDraft<QuietDraft>('patient:notifications:quiet-hours', EMPTY_QUIET);
  const qd = quietDraft.value;
  const quietWrite = useWrite<QuietHoursResult>();
  const [quietError, setQuietError] = React.useState<string | null>(null);

  // Seed the form from the server once (saved in-progress edits win).
  React.useEffect(() => {
    if (!quietDraft.restored || qd.seeded || !prefs.data) return;
    quietDraft.setValue({
      start: prefs.data.quietHoursStart ?? '22:00',
      end: prefs.data.quietHoursEnd ?? '07:00',
      suppress: prefs.data.suppressNonCritical ?? true,
      seeded: true,
    });
    // quietDraft.setValue identity changes each render; keying on the
    // loaded flags keeps this a run-once seeding effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quietDraft.restored, qd.seeded, prefs.data]);

  const startNorm = normalizeQuietTime(qd.start);
  const endNorm = normalizeQuietTime(qd.end);
  const startInvalid = qd.start.trim().length > 0 && startNorm === null;
  const endInvalid = qd.end.trim().length > 0 && endNorm === null;
  const quietValid = startNorm !== null && endNorm !== null;

  const saveQuietHours = (): void => {
    if (!quietValid || quietWrite.busy || startNorm === null || endNorm === null) return;
    setQuietError(null);
    void (async () => {
      const res = await quietWrite.submit({
        method: 'PATCH',
        path: '/api/v1/me/notifications/quiet-hours',
        body: {
          quietHoursStart: startNorm,
          quietHoursEnd: endNorm,
          suppressNonCritical: qd.suppress,
        } satisfies QuietHoursBody,
      });
      if (res.ok) {
        const savedStart = res.value?.quietHoursStart ?? startNorm;
        const savedEnd = res.value?.quietHoursEnd ?? endNorm;
        quietDraft.clear();
        quietDraft.setValue({
          start: savedStart,
          end: savedEnd,
          suppress: res.value?.suppressNonCritical ?? qd.suppress,
          seeded: true,
        });
        void queryClient.invalidateQueries({ queryKey: [PREFS_KEY] });
        Alert.alert(t(STR.quietSavedTitle), t(quietSavedMsg(savedStart, savedEnd)));
      } else if (res.error.code === 'OFFLINE') {
        setQuietError(t(STR.offlineWrite));
      } else {
        setQuietError(res.error.message || t(STR.couldNotSave));
      }
    })();
  };

  // ── Event-type × channel matrix ────────────────────────────────────────
  const matrixWrite = useWrite<EventOptOutResult>();
  const [matrixLocal, setMatrixLocal] = React.useState<EventOptOutTuple[] | null>(null);
  const [matrixNote, setMatrixNote] = React.useState<string | null>(null);
  const [matrixError, setMatrixError] = React.useState<string | null>(null);
  const matrix = matrixLocal ?? prefs.data?.eventTypeOptOuts ?? [];

  const toggleCell = (eventType: EventTypeKey, channel: MatrixChannel): void => {
    // One in-flight cell at a time — useWrite holds a single idempotency
    // key per logical action, so concurrent toggles must not share it.
    if (matrixWrite.busy || isCellLocked(eventType, channel)) return;
    const nextOptOut = !isCellOptedOut(matrix, eventType, channel);

    // Optimistic flip, rolled back on failure (mirrors the web matrix).
    const before = matrix;
    setMatrixLocal(toggleTuple(before, eventType, channel, nextOptOut));
    setMatrixError(null);
    setMatrixNote(null);

    void (async () => {
      const res = await matrixWrite.submit({
        method: 'PATCH',
        path: '/api/v1/me/notifications/opt-out',
        body: { eventType, channel, optOut: nextOptOut } satisfies EventOptOutBody,
      });
      if (res.ok) {
        setMatrixNote(
          t(matrixSavedMsg(eventTypeLabel(eventType), channelLabel(channel), nextOptOut)),
        );
        void queryClient.invalidateQueries({ queryKey: [PREFS_KEY] });
      } else {
        setMatrixLocal([...before]);
        setMatrixError(
          res.error.code === 'OFFLINE'
            ? t(STR.offlineWrite)
            : res.error.message || t(STR.couldNotSave),
        );
      }
    })();
  };

  // ── Channel-wide opt-out (one-way, append-only registry) ──────────────
  const optOutWrite = useWrite<ChannelOptOutResult>();
  const [optOutError, setOptOutError] = React.useState<string | null>(null);

  const confirmChannelOptOut = (channel: OptOutChannel): void => {
    if (optOutWrite.busy) return;
    const label = channelLabel(channel);
    Alert.alert(t(STR.optOutConfirmTitle), t(optOutConfirmMsg(label)), [
      { text: t(COMMON.cancel), style: 'cancel' },
      {
        text: t(STR.optOutAction),
        style: 'destructive',
        onPress: () => {
          setOptOutError(null);
          void (async () => {
            const res = await optOutWrite.submit({
              method: 'POST',
              path: '/api/v1/me/notifications/opt-out',
              body: { channel } satisfies ChannelOptOutBody,
            });
            if (res.ok) {
              void queryClient.invalidateQueries({ queryKey: [OPTOUTS_KEY] });
              Alert.alert(t(STR.optOutDoneTitle), `${t(label)} · ${t(STR.optedOut)}`);
            } else if (res.error.code === 'OFFLINE') {
              setOptOutError(t(STR.offlineWrite));
            } else {
              setOptOutError(res.error.message || t(STR.couldNotSave));
            }
          })();
        },
      },
    ]);
  };

  // ── Render ─────────────────────────────────────────────────────────────
  const card = { borderColor: theme.line, backgroundColor: theme.bgElevated };

  if (prefs.isLoading) {
    return (
      <ScreenScaffold>
        <SectionHeader title={t(STR.settingsTitle)} />
        <View style={styles.center}>
          <ActivityIndicator color={theme.accent} />
        </View>
      </ScreenScaffold>
    );
  }

  if (prefs.error && !prefs.data) {
    return (
      <ScreenScaffold>
        <SectionHeader title={t(STR.settingsTitle)} />
        <EmptyState
          title={t(COMMON.genericError)}
          message={prefs.error.message}
          actionLabel={t(COMMON.retry)}
          onAction={prefs.refetch}
        />
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold>
      <SectionHeader
        title={t(STR.settingsTitle)}
        right={<FreshnessBadge fetchedAt={prefs.fetchedAt} />}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* ── Email digest ──────────────────────────────────────────── */}
        <View style={[styles.card, card]}>
          <Text style={[styles.cardTitle, { color: theme.fg }]}>{t(STR.digestHeading)}</Text>
          <Text style={[styles.cardDesc, { color: theme.fgMuted }]}>{t(STR.digestDesc)}</Text>
          <View style={styles.digestRow}>
            {DIGEST_MODES.map((mode) => (
              <View key={mode} style={styles.digestButton}>
                <Button
                  title={t(digestModeLabel(mode))}
                  variant={digestMode === mode ? 'default' : 'secondary'}
                  disabled={digestWrite.busy}
                  accessibilityLabel={t(digestModeLabel(mode))}
                  onPress={() => chooseDigest(mode)}
                />
              </View>
            ))}
          </View>
          <Text style={[styles.cardDesc, { color: theme.fgMuted }]}>
            {t(STR.digestNote)}
          </Text>
          {digestNote ? (
            <Text style={[styles.note, { color: theme.status.success }]}>{digestNote}</Text>
          ) : null}
          {digestError ? (
            <Text style={[styles.note, { color: theme.status.danger }]}>{digestError}</Text>
          ) : null}
        </View>

        {/* ── Quiet hours ───────────────────────────────────────────── */}
        <View style={[styles.card, card]}>
          <Text style={[styles.cardTitle, { color: theme.fg }]}>{t(STR.quietHeading)}</Text>
          <Text style={[styles.cardDesc, { color: theme.fgMuted }]}>{t(STR.quietDesc)}</Text>
          <View style={styles.quietTimes}>
            <View style={styles.quietField}>
              <TextField
                label={t(STR.quietFrom)}
                hint={t(STR.quietTimeHint)}
                {...(startInvalid ? { error: t(STR.invalidTime) } : {})}
                value={qd.start}
                onChangeText={(start) => quietDraft.setValue({ ...qd, start })}
                keyboardType="numbers-and-punctuation"
                autoCapitalize="none"
              />
            </View>
            <View style={styles.quietField}>
              <TextField
                label={t(STR.quietTo)}
                hint={t(STR.quietTimeHint)}
                {...(endInvalid ? { error: t(STR.invalidTime) } : {})}
                value={qd.end}
                onChangeText={(end) => quietDraft.setValue({ ...qd, end })}
                keyboardType="numbers-and-punctuation"
                autoCapitalize="none"
              />
            </View>
          </View>
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: theme.fg }]}>
              {t(STR.suppressLabel)}
            </Text>
            <Switch
              accessibilityRole="switch"
              accessibilityLabel={t(STR.suppressLabel)}
              accessibilityState={{ checked: qd.suppress }}
              value={qd.suppress}
              onValueChange={(suppress) => quietDraft.setValue({ ...qd, suppress })}
              trackColor={{ false: theme.bgMuted, true: theme.accent }}
              thumbColor={theme.bg}
            />
          </View>
          {quietError ? (
            <Text style={[styles.note, { color: theme.status.danger }]}>{quietError}</Text>
          ) : null}
          <Button
            title={t(STR.saveQuietHours)}
            disabled={!quietValid}
            loading={quietWrite.busy}
            accessibilityLabel={t(STR.saveQuietHours)}
            onPress={saveQuietHours}
          />
        </View>

        {/* ── Event-type × channel matrix ───────────────────────────── */}
        <View style={[styles.card, card]}>
          <Text style={[styles.cardTitle, { color: theme.fg }]}>{t(STR.matrixHeading)}</Text>
          <Text style={[styles.cardDesc, { color: theme.fgMuted }]}>{t(STR.matrixDesc)}</Text>
          {EVENT_TYPES.map((eventType) => (
            <View
              key={eventType}
              style={[styles.matrixRow, { borderTopColor: theme.line }]}
            >
              <Text style={[styles.matrixEvent, { color: theme.fg }]}>
                {t(eventTypeLabel(eventType))}
              </Text>
              <View style={styles.matrixCells}>
                {MATRIX_CHANNELS.map((channel) => {
                  const locked = isCellLocked(eventType, channel);
                  const on = locked || !isCellOptedOut(matrix, eventType, channel);
                  const cellLabel = `${t(eventTypeLabel(eventType))} · ${t(channelLabel(channel))}`;
                  return (
                    <View key={channel} style={styles.matrixCell}>
                      <Text style={[styles.matrixChannel, { color: theme.fgMuted }]}>
                        {t(channelLabel(channel))}
                      </Text>
                      {locked ? (
                        <StatusPill label={t(STR.alwaysOn)} tone="info" />
                      ) : (
                        <Switch
                          accessibilityRole="switch"
                          accessibilityLabel={cellLabel}
                          accessibilityState={{ checked: on }}
                          value={on}
                          disabled={matrixWrite.busy}
                          onValueChange={() => toggleCell(eventType, channel)}
                          trackColor={{ false: theme.bgMuted, true: theme.accent }}
                          thumbColor={theme.bg}
                        />
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
          <Text style={[styles.cardDesc, { color: theme.fgMuted }]}>
            {t(STR.matrixLockedNote)}
          </Text>
          {matrixNote ? (
            <Text style={[styles.note, { color: theme.status.success }]}>{matrixNote}</Text>
          ) : null}
          {matrixError ? (
            <Text style={[styles.note, { color: theme.status.danger }]}>{matrixError}</Text>
          ) : null}
        </View>

        {/* ── Channel-wide opt-out (TCPA) ───────────────────────────── */}
        <View style={[styles.card, card]}>
          <Text style={[styles.cardTitle, { color: theme.fg }]}>{t(STR.optOutHeading)}</Text>
          <Text style={[styles.cardDesc, { color: theme.fgMuted }]}>{t(STR.optOutDesc)}</Text>
          {optOuts.isLoading ? (
            <ActivityIndicator color={theme.accent} />
          ) : optOuts.error && !optOuts.data ? (
            <EmptyState
              title={t(COMMON.genericError)}
              message={optOuts.error.message}
              actionLabel={t(COMMON.retry)}
              onAction={optOuts.refetch}
            />
          ) : (
            OPTOUT_CHANNELS.map((channel) => {
              const row = (optOuts.data?.optOuts ?? []).find((o) => o.channel === channel);
              const optedOut = isChannelOptedOut(optOuts.data?.optOuts, channel);
              return (
                <View
                  key={channel}
                  style={[styles.optOutRow, { borderTopColor: theme.line }]}
                >
                  <View style={styles.optOutInfo}>
                    <Text style={[styles.switchLabel, { color: theme.fg }]}>
                      {t(channelLabel(channel))}
                    </Text>
                    {optedOut && row ? (
                      <Text style={[styles.optOutMeta, { color: theme.fgMuted }]}>
                        {t(optOutSourceLabel(row.source))}
                        {row.optedOutAt ? ` · ${formatDate(row.optedOutAt, lang)}` : ''}
                      </Text>
                    ) : null}
                  </View>
                  {optedOut ? (
                    <StatusPill label={t(STR.optedOut)} tone="warning" />
                  ) : (
                    <Button
                      title={t(STR.optOutAction)}
                      variant="destructive"
                      disabled={optOutWrite.busy}
                      accessibilityLabel={`${t(STR.optOutAction)} — ${t(channelLabel(channel))}`}
                      onPress={() => confirmChannelOptOut(channel)}
                    />
                  )}
                </View>
              );
            })
          )}
          {optOutError ? (
            <Text style={[styles.note, { color: theme.status.danger }]}>{optOutError}</Text>
          ) : null}
        </View>
      </ScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.lg, gap: spacing.md },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardTitle: { fontSize: fontSize.h3, fontWeight: '700' },
  cardDesc: { fontSize: fontSize.bodySm },
  note: { fontSize: fontSize.bodySm, fontWeight: '600' },
  digestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  digestButton: { flexGrow: 1, flexBasis: '45%' },
  quietTimes: { flexDirection: 'row', gap: spacing.sm },
  quietField: { flex: 1 },
  switchRow: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  switchLabel: { flex: 1, fontSize: fontSize.bodySm, fontWeight: '600' },
  matrixRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  matrixEvent: { fontSize: fontSize.body, fontWeight: '600' },
  matrixCells: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  matrixCell: {
    minHeight: MIN_TOUCH_TARGET,
    flexGrow: 1,
    flexBasis: '22%',
    alignItems: 'center',
    gap: spacing.xs,
  },
  matrixChannel: { fontSize: fontSize.caption, fontWeight: '600' },
  optOutRow: {
    minHeight: MIN_TOUCH_TARGET,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  optOutInfo: { flex: 1, gap: 2 },
  optOutMeta: { fontSize: fontSize.caption },
});
