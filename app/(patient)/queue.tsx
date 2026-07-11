// Patient live queue position — my place in the chamber queue, polled
// live every 20s while this screen is focused (never useCachedQuery: a
// cached queue position is a wrong queue position).
//
//   GET /api/v1/me/queue-position?chamberId=…   (+ chamber discovery,
//   see src/features/patient-queue/useQueuePositionPoll.ts)
//
// Honesty rules: ActivityIndicator only on the FIRST load; when a later
// poll fails the last known position stays on screen with an explicit
// stale notice + its timestamp; "not in queue" renders only on a
// definitive server answer, never on a network failure.

import { useLocalSearchParams, useRouter } from 'expo-router';
import * as React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useSession } from '@/auth/sessionStore';
import { COMMON, formatDateTime, useT } from '@/i18n';
import { EmptyState } from '@/ui/EmptyState';
import { FreshnessBadge } from '@/ui/FreshnessBadge';
import { ScreenScaffold } from '@/ui/ScreenScaffold';
import { SectionHeader } from '@/ui/SectionHeader';
import { StatusPill } from '@/ui/StatusPill';
import { fontSize, radius, spacing } from '@/ui/tokens';
import { useTheme } from '@/ui/theme';

import {
  estWaitMinutes,
  formatNumber,
  peopleAhead,
  priorityTone,
  stageTone,
} from '@/features/patient-queue/logic';
import {
  QUEUE_STRINGS,
  priorityLabel,
  stageLabel,
} from '@/features/patient-queue/strings';
import { useQueuePositionPoll } from '@/features/patient-queue/useQueuePositionPoll';

function paramString(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default function PatientQueueScreen(): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  const { lang, t } = useT();
  const params = useLocalSearchParams<{
    chamberId?: string;
    doctorName?: string;
    chamberName?: string;
  }>();
  const userId = useSession((s) => s.userId);

  const { phase, snapshot, stale, errorMessage, refresh } = useQueuePositionPoll({
    userId,
    chamberIdParam: paramString(params.chamberId),
    doctorNameParam: paramString(params.doctorName),
    chamberNameParam: paramString(params.chamberName),
  });

  const goBack = (): void => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/(patient)');
    }
  };

  const renderField = (label: string, value: string): React.ReactElement => (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: theme.fgMuted }]}>{label}</Text>
      <Text style={[styles.fieldValue, { color: theme.fg }]}>{value}</Text>
    </View>
  );

  let body: React.ReactElement;
  if (userId === null) {
    body = <EmptyState title={t(QUEUE_STRINGS.needSession)} />;
  } else if (phase === 'loading') {
    body = (
      <View style={styles.center}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  } else if (phase === 'error') {
    body = (
      <EmptyState
        title={t(COMMON.genericError)}
        {...(errorMessage !== null ? { message: errorMessage } : {})}
        actionLabel={t(COMMON.retry)}
        onAction={refresh}
      />
    );
  } else if (phase === 'notInQueue' || snapshot === null) {
    body = (
      <EmptyState
        title={t(QUEUE_STRINGS.notInQueueTitle)}
        message={t(QUEUE_STRINGS.notInQueueBody)}
        actionLabel={t(QUEUE_STRINGS.goBack)}
        onAction={goBack}
      />
    );
  } else {
    const entry = snapshot.entry;
    const position = snapshot.position;
    const ahead = peopleAhead(position);
    const inConsultation = position === null && entry.stage === 'IN_CONSULTATION';
    const wait = estWaitMinutes(entry.estimatedWaitTimeMinutes);
    const stagePillLabel = t(stageLabel(entry.stage));
    const prioLabel = priorityLabel(entry.priority);
    const prioTone = priorityTone(entry.priority);

    const aheadLine =
      ahead === null
        ? null
        : ahead === 0
          ? t(QUEUE_STRINGS.youAreNext)
          : t({
              en: `${formatNumber(ahead, 'en')} ${ahead === 1 ? 'person' : 'people'} ahead of you`,
              bn: `আপনার আগে ${formatNumber(ahead, 'bn')} জন আছেন`,
            });

    const heroA11y = inConsultation
      ? t(QUEUE_STRINGS.yourTurn)
      : position !== null
        ? `${t(QUEUE_STRINGS.a11yPosition)} ${formatNumber(position, lang)}${aheadLine !== null ? `. ${aheadLine}` : ''}`
        : t(QUEUE_STRINGS.positionUnavailable);

    body = (
      <ScrollView contentContainerStyle={styles.body}>
        {stale ? (
          <Text
            style={[styles.stale, { color: theme.status.warningText }]}
            accessibilityRole="alert"
          >
            {`${t(QUEUE_STRINGS.staleNotice)} ${formatDateTime(snapshot.fetchedAt, lang)}`}
          </Text>
        ) : null}

        <View
          style={[
            styles.card,
            { borderColor: theme.line, backgroundColor: theme.bgElevated },
          ]}
        >
          <View
            style={styles.hero}
            accessible
            accessibilityRole="text"
            accessibilityLabel={heroA11y}
            accessibilityLiveRegion="polite"
          >
            {inConsultation ? (
              <Text style={[styles.heroTurn, { color: theme.accent }]}>
                {t(QUEUE_STRINGS.yourTurn)}
              </Text>
            ) : position !== null ? (
              <>
                <Text style={[styles.heroLabel, { color: theme.fgMuted }]}>
                  {t(QUEUE_STRINGS.yourPosition)}
                </Text>
                <Text style={[styles.heroNumber, { color: theme.accent }]}>
                  {`#${formatNumber(position, lang)}`}
                </Text>
                {aheadLine !== null ? (
                  <Text style={[styles.heroAhead, { color: theme.fg }]}>
                    {aheadLine}
                  </Text>
                ) : null}
              </>
            ) : (
              <Text style={[styles.heroAhead, { color: theme.fgMuted }]}>
                {t(QUEUE_STRINGS.positionUnavailable)}
              </Text>
            )}
          </View>

          <View style={styles.pillRow}>
            {stagePillLabel.length > 0 ? (
              <StatusPill label={stagePillLabel} tone={stageTone(entry.stage)} />
            ) : null}
            {prioLabel !== null && prioTone !== null ? (
              <StatusPill label={t(prioLabel)} tone={prioTone} />
            ) : null}
          </View>

          {snapshot.doctorName !== null
            ? renderField(t(QUEUE_STRINGS.doctor), snapshot.doctorName)
            : null}
          {snapshot.chamberName !== null
            ? renderField(t(QUEUE_STRINGS.chamber), snapshot.chamberName)
            : null}
          {typeof entry.tokenNumber === 'string' && entry.tokenNumber.length > 0
            ? renderField(t(QUEUE_STRINGS.token), entry.tokenNumber)
            : null}
          {typeof entry.queueNumber === 'number'
            ? renderField(
                t(QUEUE_STRINGS.serial),
                formatNumber(entry.queueNumber, lang),
              )
            : null}
          {wait !== null
            ? renderField(
                t(QUEUE_STRINGS.estWait),
                `~${formatNumber(wait, lang)} ${t(QUEUE_STRINGS.minutesShort)}`,
              )
            : null}
          {typeof entry.checkInTime === 'string' && entry.checkInTime.length > 0
            ? renderField(
                t(QUEUE_STRINGS.checkedInAt),
                formatDateTime(entry.checkInTime, lang),
              )
            : null}
        </View>

        <Text style={[styles.autoRefresh, { color: theme.fgSubtle }]}>
          {t(QUEUE_STRINGS.autoRefresh)}
        </Text>
      </ScrollView>
    );
  }

  return (
    <ScreenScaffold phi>
      <SectionHeader
        title={t(QUEUE_STRINGS.title)}
        right={<FreshnessBadge fetchedAt={snapshot?.fetchedAt ?? null} />}
      />
      {body}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: spacing.lg, gap: spacing.md },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  hero: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm },
  heroLabel: {
    fontSize: fontSize.caption,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroNumber: { fontSize: 64, fontWeight: '800', fontVariant: ['tabular-nums'] },
  heroTurn: { fontSize: fontSize.h1, fontWeight: '800', textAlign: 'center' },
  heroAhead: { fontSize: fontSize.body, fontWeight: '600', textAlign: 'center' },
  pillRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  field: { gap: 2 },
  fieldLabel: { fontSize: fontSize.caption, fontWeight: '600', textTransform: 'uppercase' },
  fieldValue: { fontSize: fontSize.body },
  stale: { fontSize: fontSize.bodySm, fontWeight: '600' },
  autoRefresh: { fontSize: fontSize.caption, textAlign: 'center' },
});
