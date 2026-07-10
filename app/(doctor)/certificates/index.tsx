// Doctor medical certificates — certificates I issued, with cancel (revoke)
// while still ACTIVE. Reached from the More hub (hidden route).
//
//   Reads:  GET   /api/v1/me/medical-certificates          (doctor-pinned)
//   Writes: PATCH /api/v1/medical-certificates/{id}/cancel (issuing doctor
//           only; the domain refuses only ALREADY_REVOKED — the button
//           mirrors that guard; NO reverify requirement on this route,
//           per the backend defineRoute config)
//
// Death certificates are deliberately NOT handled here — they live behind
// the DEATH_CERTIFICATE_ISSUE two-key reverify and a heavier workflow.
// The list projection is metadata-only (type, validity window, status —
// never the PHI reason/restrictions text or patient names).

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

import {
  MY_CERTIFICATES_KEY,
  useMyCertificates,
} from '@/features/doctor-referrals/hooks';
import {
  canRevokeCertificate,
  certificateStatusTone,
  joinParts,
  shortPatientRef,
  sortByIssuedAtDesc,
} from '@/features/doctor-referrals/logic';
import {
  REF_STR,
  certificateStatusLabel,
  certificateTypeLabel,
} from '@/features/doctor-referrals/strings';
import type {
  DoctorCertificateRow,
  RevokeCertificateResult,
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

export default function DoctorCertificatesIndex(): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { lang, t } = useT();

  const certificates = useMyCertificates();
  const rows = React.useMemo(
    () =>
      sortByIssuedAtDesc(
        (certificates.data?.certificates ?? []).filter((c) =>
          Boolean(c?.certificateId),
        ),
      ),
    [certificates.data],
  );

  // ── Cancel / revoke ──────────────────────────────────────────────────────
  const cancelWrite = useWrite<RevokeCertificateResult>();
  const [cancellingId, setCancellingId] = React.useState<string | null>(null);
  const [cancelError, setCancelError] = React.useState<string | null>(null);

  const doCancel = async (row: DoctorCertificateRow): Promise<void> => {
    setCancelError(null);
    setCancellingId(row.certificateId);
    const res = await cancelWrite.submit({
      method: 'PATCH',
      path: `/api/v1/medical-certificates/${encodeURIComponent(row.certificateId)}/cancel`,
    });
    setCancellingId(null);
    if (res.ok) {
      void queryClient.invalidateQueries({ queryKey: [MY_CERTIFICATES_KEY] });
      Alert.alert(t(REF_STR.certificateCancelled));
    } else if (res.error.code === 'OFFLINE') {
      setCancelError(t(REF_STR.offlineWrite));
    } else {
      setCancelError(res.error.message || t(COMMON.genericError));
    }
  };

  const confirmCancel = (row: DoctorCertificateRow): void => {
    Alert.alert(
      t(REF_STR.cancelCertificateTitle),
      t(REF_STR.cancelCertificateBody),
      [
        { text: t(COMMON.cancel), style: 'cancel' },
        {
          text: t(REF_STR.cancelCertificate),
          style: 'destructive',
          onPress: () => void doCancel(row),
        },
      ],
    );
  };

  // ── Row rendering ────────────────────────────────────────────────────────
  const renderRow = ({
    item,
  }: {
    item: DoctorCertificateRow;
  }): React.ReactElement => {
    const ref = shortPatientRef(item.patientId);
    const title = `${t(REF_STR.patientRef)} ${ref ?? '—'}`;
    const validity =
      item.validFrom !== undefined && item.validUntil !== undefined
        ? `${formatDate(item.validFrom, lang)} – ${formatDate(item.validUntil, lang)}`
        : null;
    const subtitle = joinParts([
      t(certificateTypeLabel(item.certificateType)),
      validity,
      item.issuedAt !== undefined
        ? `${t(REF_STR.issuedOn)} ${formatDate(item.issuedAt, lang)}`
        : null,
    ]);
    const cancellable = canRevokeCertificate(item.status);
    return (
      <ListRow
        title={title}
        subtitle={subtitle}
        chevron={false}
        testID={`certificate-${item.certificateId}`}
        right={
          <View style={styles.rowTrailing}>
            <StatusPill
              label={t(certificateStatusLabel(item.status))}
              tone={certificateStatusTone(item.status)}
            />
            {cancellable ? (
              <Button
                title={t(REF_STR.cancelCertificate)}
                variant="destructive"
                accessibilityLabel={`${t(REF_STR.cancelCertificate)} · ${title}`}
                loading={cancellingId === item.certificateId}
                disabled={cancelWrite.busy}
                testID={`cancel-certificate-${item.certificateId}`}
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
  if (certificates.isLoading) {
    body = (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  } else if (certificates.error && rows.length === 0) {
    body = (
      <EmptyState
        title={t(COMMON.genericError)}
        message={certificates.error.message}
        actionLabel={t(COMMON.retry)}
        onAction={certificates.refetch}
      />
    );
  } else if (rows.length === 0) {
    body = (
      <EmptyState
        title={t(REF_STR.noCertificates)}
        message={t(REF_STR.noCertificatesHint)}
      />
    );
  } else {
    body = (
      <FlatList
        style={styles.flex}
        data={rows}
        keyExtractor={(c) => c.certificateId}
        contentContainerStyle={styles.list}
        renderItem={renderRow}
      />
    );
  }

  return (
    <ScreenScaffold phi>
      <SectionHeader
        title={t(REF_STR.certificatesTitle)}
        right={<FreshnessBadge fetchedAt={certificates.fetchedAt} />}
      />
      <View style={styles.actions}>
        <Text style={[styles.hint, { color: theme.fgMuted }]}>
          {t(REF_STR.certificatesHint)}
        </Text>
        <Button
          title={t(REF_STR.newCertificate)}
          accessibilityLabel={t(REF_STR.newCertificate)}
          testID="new-certificate"
          onPress={() => router.push('/(doctor)/certificates/new')}
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
