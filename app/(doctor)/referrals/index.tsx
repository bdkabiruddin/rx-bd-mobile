// Doctor referrals — referrals I issued, with cancel while still ACTIVE.
// Reached from the More hub (hidden route: href:null in the doctor layout).
//
//   Reads:  GET   /api/v1/me/referrals            (doctor-pinned list)
//   Writes: PATCH /api/v1/referrals/{id}/cancel   (issuing doctor only;
//           the domain allows cancel ONLY while status is ACTIVE — the
//           button mirrors that guard exactly)
//
// The list projection is metadata-only (ids, type, specialty, urgency,
// status — never patient names or the PHI reason text). Patient rows render
// the honest short id reference, never a fabricated name.

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import * as React from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { MY_REFERRALS_KEY, useMyReferrals } from '@/features/doctor-referrals/hooks';
import {
  canCancelReferral,
  formatNumber,
  joinParts,
  referralStatusTone,
  shortPatientRef,
  sortByIssuedAtDesc,
} from '@/features/doctor-referrals/logic';
import {
  REF_STR,
  referralStatusLabel,
  referralTypeLabel,
  referralUrgencyLabel,
} from '@/features/doctor-referrals/strings';
import type {
  CancelReferralResult,
  DoctorReferralRow,
} from '@/features/doctor-referrals/types';
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
import { fontSize, spacing } from '@/ui/tokens';

export default function DoctorReferralsIndex(): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { lang, t } = useT();

  const referrals = useMyReferrals();
  const rows = React.useMemo(
    () =>
      sortByIssuedAtDesc(
        (referrals.data?.referrals ?? []).filter((r) => Boolean(r?.referralId)),
      ),
    [referrals.data],
  );

  // ── Cancel (PATCH /referrals/{id}/cancel — no reverify on this route) ───
  const cancelWrite = useWrite<CancelReferralResult>();
  const [cancellingId, setCancellingId] = React.useState<string | null>(null);
  const [cancelError, setCancelError] = React.useState<string | null>(null);

  const doCancel = async (row: DoctorReferralRow): Promise<void> => {
    setCancelError(null);
    setCancellingId(row.referralId);
    const res = await cancelWrite.submit({
      method: 'PATCH',
      path: `/api/v1/referrals/${encodeURIComponent(row.referralId)}/cancel`,
    });
    setCancellingId(null);
    if (res.ok) {
      void queryClient.invalidateQueries({ queryKey: [MY_REFERRALS_KEY] });
      Alert.alert(t(REF_STR.referralCancelled));
    } else if (res.error.code === 'OFFLINE') {
      setCancelError(t(REF_STR.offlineWrite));
    } else {
      setCancelError(res.error.message || t(COMMON.genericError));
    }
  };

  const confirmCancel = (row: DoctorReferralRow): void => {
    Alert.alert(t(REF_STR.cancelReferralTitle), t(REF_STR.cancelReferralBody), [
      { text: t(COMMON.cancel), style: 'cancel' },
      {
        text: t(REF_STR.cancelReferral),
        style: 'destructive',
        onPress: () => void doCancel(row),
      },
    ]);
  };

  // ── Row rendering ────────────────────────────────────────────────────────
  const renderRow = ({ item }: { item: DoctorReferralRow }): React.ReactElement => {
    const ref = shortPatientRef(item.patientId);
    const title = `${t(REF_STR.patientRef)} ${ref ?? '—'}`;
    const destination =
      item.targetSpecialty !== null &&
      item.targetSpecialty !== undefined &&
      item.targetSpecialty.trim().length > 0
        ? item.targetSpecialty
        : t(referralTypeLabel(item.referralType));
    const subtitle = joinParts([
      destination,
      item.urgency !== undefined ? t(referralUrgencyLabel(item.urgency)) : null,
      item.issuedAt !== undefined
        ? `${t(REF_STR.issuedOn)} ${formatDate(item.issuedAt, lang)}`
        : null,
      item.validityDays !== undefined
        ? `${formatNumber(item.validityDays, lang)} ${t(REF_STR.validDays)}`
        : null,
    ]);
    const cancellable = canCancelReferral(item.status);
    return (
      <ListRow
        title={title}
        subtitle={subtitle}
        chevron={false}
        testID={`referral-${item.referralId}`}
        right={
          <View style={styles.rowTrailing}>
            <StatusPill
              label={t(referralStatusLabel(item.status))}
              tone={referralStatusTone(item.status)}
            />
            {cancellable ? (
              <Button
                title={t(REF_STR.cancelReferral)}
                variant="destructive"
                accessibilityLabel={`${t(REF_STR.cancelReferral)} · ${title}`}
                loading={cancellingId === item.referralId}
                disabled={cancelWrite.busy}
                testID={`cancel-referral-${item.referralId}`}
                onPress={() => confirmCancel(item)}
              />
            ) : null}
          </View>
        }
      />
    );
  };

  // ── Body states ──────────────────────────────────────────────────────────
  let body: React.ReactElement;
  if (referrals.isLoading) {
    body = (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  } else if (referrals.error && rows.length === 0) {
    body = (
      <EmptyState
        title={t(COMMON.genericError)}
        message={referrals.error.message}
        actionLabel={t(COMMON.retry)}
        onAction={referrals.refetch}
      />
    );
  } else if (rows.length === 0) {
    body = (
      <EmptyState
        title={t(REF_STR.noReferrals)}
        message={t(REF_STR.noReferralsHint)}
      />
    );
  } else {
    body = (
      <FlatList
        style={styles.flex}
        data={rows}
        keyExtractor={(r) => r.referralId}
        contentContainerStyle={styles.list}
        renderItem={renderRow}
      />
    );
  }

  return (
    <ScreenScaffold phi>
      <SectionHeader
        title={t(REF_STR.referralsTitle)}
        right={<FreshnessBadge fetchedAt={referrals.fetchedAt} />}
      />
      <View style={styles.actions}>
        <Text style={[styles.hint, { color: theme.fgMuted }]}>
          {t(REF_STR.referralsHint)}
        </Text>
        <Button
          title={t(REF_STR.newReferral)}
          accessibilityLabel={t(REF_STR.newReferral)}
          testID="new-referral"
          onPress={() => router.push('/(doctor)/referrals/new')}
        />
        {cancelError !== null ? (
          <Text style={[styles.error, { color: theme.status.danger }]}>
            {cancelError}
          </Text>
        ) : null}
      </View>
      <View style={styles.flex}>{body}</View>
      <View style={styles.footer}>
        <Button
          title={t(REF_STR.back)}
          variant="ghost"
          accessibilityLabel={t(REF_STR.back)}
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace('/(doctor)')
          }
        />
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  actions: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  hint: { fontSize: fontSize.bodySm },
  list: { padding: spacing.lg, gap: spacing.sm },
  rowTrailing: { alignItems: 'flex-end', gap: spacing.xs },
  error: { fontSize: fontSize.bodySm, fontWeight: '600' },
  footer: { padding: spacing.lg },
});
