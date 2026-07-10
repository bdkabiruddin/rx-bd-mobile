// Privacy & data rights — the DSAR (data-subject access request) center.
// Compliance-facing surface: wording is honest about what each action does
// and its irreversibility. Every request goes to admin review first; only
// PENDING requests are cancellable (backend transition rule).
//
//   Reads:  GET /api/v1/gdpr/requests   → { rows, total, page, pageSize }
//           GET /api/v1/me/access-log   → audit summary (lazy: each read is
//                                         itself audited server-side)
//   Writes: POST /api/v1/gdpr/export-request       (GDPR Art. 15)
//           POST /api/v1/gdpr/portability-request  (GDPR Art. 20, FHIR)
//           POST /api/v1/gdpr/erasure-request      (GDPR Art. 17 — strong warning)
//           POST /api/v1/gdpr/requests/{id}/cancel (PENDING only)

import { useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
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

import { DSAR_KEY, useMyAccessLog, useMyDsarRequests } from '@/features/patient-profile/hooks';
import { dsarStatusTone, isCancellableDsar } from '@/features/patient-profile/logic';
import { PROFILE_STR, dsarStatusLabel, dsarTypeLabel } from '@/features/patient-profile/strings';
import type {
  CancelDsarResponse,
  CreateDsarResponse,
  DsarRequestListItem,
} from '@/features/patient-profile/types';
import { COMMON, formatDate, formatDateTime, useT } from '@/i18n';
import { useWrite } from '@/offline/useWrite';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { FreshnessBadge } from '@/ui/FreshnessBadge';
import { ScreenScaffold } from '@/ui/ScreenScaffold';
import { SectionHeader } from '@/ui/SectionHeader';
import { StatusPill } from '@/ui/StatusPill';
import { useTheme } from '@/ui/theme';
import { fontSize, radius, spacing } from '@/ui/tokens';

type DsarKind = 'EXPORT' | 'PORTABILITY' | 'ERASURE';

const DSAR_PATHS: Record<DsarKind, string> = {
  EXPORT: '/api/v1/gdpr/export-request',
  PORTABILITY: '/api/v1/gdpr/portability-request',
  ERASURE: '/api/v1/gdpr/erasure-request',
};

export default function PrivacyCenter(): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { lang, t } = useT();

  const requestsQ = useMyDsarRequests();
  const [logOpen, setLogOpen] = React.useState(false);
  const accessLogQ = useMyAccessLog(logOpen);

  // One useWrite per action so each keeps its own stable idempotency key.
  const exportWrite = useWrite<CreateDsarResponse>();
  const portabilityWrite = useWrite<CreateDsarResponse>();
  const erasureWrite = useWrite<CreateDsarResponse>();
  const cancelWrite = useWrite<CancelDsarResponse>();
  const anyBusy =
    exportWrite.busy || portabilityWrite.busy || erasureWrite.busy || cancelWrite.busy;

  const [serverError, setServerError] = React.useState<string | null>(null);

  const submitDsar = async (
    kind: DsarKind,
    write: ReturnType<typeof useWrite<CreateDsarResponse>>,
  ): Promise<void> => {
    setServerError(null);
    const res = await write.submit({
      method: 'POST',
      path: DSAR_PATHS[kind],
      // createDsarRequestSchema: { reason? } — an empty object is valid.
      body: {},
    });
    if (res.ok) {
      void queryClient.invalidateQueries({ queryKey: [DSAR_KEY] });
      Alert.alert(t(PROFILE_STR.requestSubmitted), t(PROFILE_STR.requestSubmittedBody));
    } else if (res.error.code === 'OFFLINE') {
      setServerError(t(PROFILE_STR.offlineWrite));
    } else {
      setServerError(res.error.message || t(COMMON.genericError));
    }
  };

  const onExport = (): void => {
    Alert.alert(t(PROFILE_STR.exportConfirmTitle), t(PROFILE_STR.exportConfirmBody), [
      { text: t(COMMON.cancel), style: 'cancel' },
      {
        text: t(PROFILE_STR.submitRequest),
        onPress: () => void submitDsar('EXPORT', exportWrite),
      },
    ]);
  };

  const onPortability = (): void => {
    Alert.alert(
      t(PROFILE_STR.portabilityConfirmTitle),
      t(PROFILE_STR.portabilityConfirmBody),
      [
        { text: t(COMMON.cancel), style: 'cancel' },
        {
          text: t(PROFILE_STR.submitRequest),
          onPress: () => void submitDsar('PORTABILITY', portabilityWrite),
        },
      ],
    );
  };

  const onErasure = (): void => {
    Alert.alert(t(PROFILE_STR.erasureConfirmTitle), t(PROFILE_STR.erasureWarning), [
      { text: t(COMMON.cancel), style: 'cancel' },
      {
        text: t(PROFILE_STR.erasureConfirmAction),
        style: 'destructive',
        onPress: () => void submitDsar('ERASURE', erasureWrite),
      },
    ]);
  };

  const onCancelRequest = (item: DsarRequestListItem): void => {
    Alert.alert(t(PROFILE_STR.cancelRequestTitle), t(PROFILE_STR.cancelRequestBody), [
      { text: t(PROFILE_STR.keep), style: 'cancel' },
      {
        text: t(PROFILE_STR.cancelRequest),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const res = await cancelWrite.submit({
              method: 'POST',
              path: `/api/v1/gdpr/requests/${encodeURIComponent(item.id)}/cancel`,
            });
            if (res.ok) {
              void queryClient.invalidateQueries({ queryKey: [DSAR_KEY] });
              Alert.alert(t(PROFILE_STR.requestCancelled));
            } else if (res.error.code === 'OFFLINE') {
              Alert.alert(t(COMMON.offline), t(PROFILE_STR.offlineWrite));
            } else {
              Alert.alert(t(COMMON.genericError), res.error.message);
            }
          })();
        },
      },
    ]);
  };

  const rows = requestsQ.data?.rows;
  const logRows = accessLogQ.data?.rows;
  const logTotal = accessLogQ.data?.total ?? 0;

  return (
    <ScreenScaffold phi>
      <ScrollView contentContainerStyle={styles.scroll}>
        <SectionHeader title={t(PROFILE_STR.privacyTitle)} />
        <Text style={[styles.intro, { color: theme.fgMuted }]}>
          {t(PROFILE_STR.rightsIntro)}
        </Text>

        <View style={styles.actions}>
          <Button
            title={t(PROFILE_STR.requestExport)}
            variant="secondary"
            accessibilityLabel={t(PROFILE_STR.requestExport)}
            loading={exportWrite.busy}
            disabled={anyBusy}
            testID="dsar-export"
            onPress={onExport}
          />
          <Button
            title={t(PROFILE_STR.requestPortability)}
            variant="secondary"
            accessibilityLabel={t(PROFILE_STR.requestPortability)}
            loading={portabilityWrite.busy}
            disabled={anyBusy}
            testID="dsar-portability"
            onPress={onPortability}
          />
          <Button
            title={t(PROFILE_STR.requestErasure)}
            variant="destructive"
            accessibilityLabel={t(PROFILE_STR.requestErasure)}
            loading={erasureWrite.busy}
            disabled={anyBusy}
            testID="dsar-erasure"
            onPress={onErasure}
          />
          {serverError !== null ? (
            <Text style={[styles.error, { color: theme.status.danger }]}>{serverError}</Text>
          ) : null}
        </View>

        {/* ── My requests ── */}
        <SectionHeader
          title={t(PROFILE_STR.myRequests)}
          right={<FreshnessBadge fetchedAt={requestsQ.fetchedAt} />}
        />
        {requestsQ.isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        ) : requestsQ.error && requestsQ.data === undefined ? (
          <EmptyState
            title={t(COMMON.genericError)}
            message={requestsQ.error.message}
            actionLabel={t(COMMON.retry)}
            onAction={requestsQ.refetch}
          />
        ) : !rows || rows.length === 0 ? (
          <EmptyState title={t(PROFILE_STR.noRequests)} />
        ) : (
          <View style={styles.listWrap}>
            {rows.map((r) => (
              <View
                key={r.id}
                style={[styles.card, { borderColor: theme.line, backgroundColor: theme.bgElevated }]}
                testID={`dsar-${r.id}`}
              >
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, { color: theme.fg }]} numberOfLines={1}>
                    {t(dsarTypeLabel(r.type))}
                  </Text>
                  <StatusPill label={t(dsarStatusLabel(r.status))} tone={dsarStatusTone(r.status)} />
                </View>
                {r.createdAt ? (
                  <Text style={[styles.meta, { color: theme.fgMuted }]}>
                    {t(PROFILE_STR.submitted)}: {formatDate(r.createdAt, lang)}
                  </Text>
                ) : null}
                {r.expiresAt && isCancellableDsar(r.status) ? (
                  <Text style={[styles.meta, { color: theme.fgMuted }]}>
                    {t(PROFILE_STR.dueBy)}: {formatDate(r.expiresAt, lang)}
                  </Text>
                ) : null}
                {r.status === 'REJECTED' && r.rejectionReason ? (
                  <Text style={[styles.meta, { color: theme.status.danger }]} numberOfLines={3}>
                    {t(PROFILE_STR.rejectionReason)}: {r.rejectionReason}
                  </Text>
                ) : null}
                {r.downloadUrl ? (
                  <Button
                    title={t(PROFILE_STR.downloadExport)}
                    variant="secondary"
                    accessibilityLabel={t(PROFILE_STR.downloadExport)}
                    onPress={() => {
                      const url = r.downloadUrl;
                      if (url) void Linking.openURL(url);
                    }}
                  />
                ) : null}
                {isCancellableDsar(r.status) ? (
                  <Button
                    title={t(PROFILE_STR.cancelRequest)}
                    variant="ghost"
                    accessibilityLabel={`${t(PROFILE_STR.cancelRequest)} — ${t(dsarTypeLabel(r.type))}`}
                    disabled={cancelWrite.busy}
                    onPress={() => onCancelRequest(r)}
                  />
                ) : null}
              </View>
            ))}
          </View>
        )}

        {/* ── Access log (GDPR Art. 15) ── */}
        <SectionHeader
          title={t(PROFILE_STR.accessLogTitle)}
          right={logOpen ? <FreshnessBadge fetchedAt={accessLogQ.fetchedAt} /> : undefined}
        />
        <Text style={[styles.intro, { color: theme.fgMuted }]}>
          {t(PROFILE_STR.accessLogDesc)}
        </Text>
        <View style={styles.actions}>
          <Button
            title={logOpen ? t(PROFILE_STR.hideAccessLog) : t(PROFILE_STR.showAccessLog)}
            variant="secondary"
            accessibilityLabel={logOpen ? t(PROFILE_STR.hideAccessLog) : t(PROFILE_STR.showAccessLog)}
            testID="toggle-access-log"
            onPress={() => setLogOpen((v) => !v)}
          />
        </View>
        {logOpen ? (
          accessLogQ.isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator />
            </View>
          ) : accessLogQ.error && accessLogQ.data === undefined ? (
            <EmptyState
              title={t(COMMON.genericError)}
              message={accessLogQ.error.message}
              actionLabel={t(COMMON.retry)}
              onAction={accessLogQ.refetch}
            />
          ) : !logRows || logRows.length === 0 ? (
            <EmptyState title={t(PROFILE_STR.noAccessLog)} />
          ) : (
            <View style={styles.listWrap}>
              <Text style={[styles.meta, { color: theme.fgSubtle }]}>
                {t(PROFILE_STR.accessLogShowing)} {logRows.length} {t(PROFILE_STR.accessLogOf)} {logTotal}
              </Text>
              {logRows.map((e) => (
                <View
                  key={e.id}
                  style={[styles.logRow, { borderColor: theme.line, backgroundColor: theme.bgElevated }]}
                >
                  <Text style={[styles.logAction, { color: theme.fg }]} numberOfLines={1}>
                    {e.action}
                  </Text>
                  <Text style={[styles.meta, { color: theme.fgMuted }]} numberOfLines={1}>
                    {[e.actionCategory, e.resourceType].filter(Boolean).join(' · ')}
                  </Text>
                  <Text style={[styles.meta, { color: theme.fgSubtle }]}>
                    {formatDateTime(e.createdAt, lang)}
                  </Text>
                </View>
              ))}
            </View>
          )
        ) : null}

        <View style={styles.actions}>
          <Button
            title={t(PROFILE_STR.back)}
            variant="ghost"
            accessibilityLabel={t(PROFILE_STR.back)}
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace('/(patient)/profile')
            }
          />
        </View>
      </ScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl },
  center: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  intro: { fontSize: fontSize.bodySm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  actions: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm },
  listWrap: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardTitle: { fontSize: fontSize.body, fontWeight: '700', flexShrink: 1 },
  meta: { fontSize: fontSize.caption },
  logRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    padding: spacing.sm,
    gap: 2,
  },
  logAction: { fontSize: fontSize.bodySm, fontWeight: '600' },
  error: { fontSize: fontSize.bodySm, fontWeight: '600' },
});
