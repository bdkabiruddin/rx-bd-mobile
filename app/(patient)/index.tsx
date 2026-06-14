// Patient home (example screen) — demonstrates the foundation end-to-end:
// PHI screenshot guard + cached query + freshness badge + honest empty/
// loading/error states (NEVER fabricated data).
//
// The exact endpoint + payload type come from the generated OpenAPI client;
// the path below is a placeholder validated during API integration.

import * as React from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { useCachedQuery } from '@/api/useCachedQuery';
import { sessionAccess } from '@/auth/sessionStore';
import { COMMON, formatDateTime, useT } from '@/i18n';
import { EmptyState } from '@/ui/EmptyState';
import { FreshnessBadge } from '@/ui/FreshnessBadge';
import { ScreenScaffold } from '@/ui/ScreenScaffold';
import { fontSize, spacing } from '@/ui/tokens';
import { useTheme } from '@/ui/theme';

interface AppointmentLite {
  id: string;
  scheduledAt: string;
  status: string;
}

export default function PatientHome(): React.ReactElement {
  const theme = useTheme();
  const { lang, t } = useT();

  const { data, fetchedAt, isLoading, error, refetch } = useCachedQuery<AppointmentLite[]>({
    key: 'patient:appointments:upcoming',
    path: '/api/v1/patients/me/appointments?scope=upcoming',
    ttlMs: 15 * 60 * 1000,
    isPhi: true,
    userId: sessionAccess.getRole(),
  });

  return (
    <ScreenScaffold phi>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.fg }]}>
          {t({ en: 'Upcoming appointments', bn: 'আসন্ন অ্যাপয়েন্টমেন্ট' })}
        </Text>
        <FreshnessBadge fetchedAt={fetchedAt} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.accent} />
        </View>
      ) : error && !data ? (
        <EmptyState
          title={t(COMMON.genericError)}
          message={error.message}
          actionLabel={t(COMMON.retry)}
          onAction={refetch}
        />
      ) : !data || data.length === 0 ? (
        <EmptyState title={t({ en: 'No upcoming appointments', bn: 'কোনো আসন্ন অ্যাপয়েন্টমেন্ট নেই' })} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(a) => a.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={[styles.row, { borderColor: theme.line, backgroundColor: theme.bgElevated }]}>
              <Text style={[styles.rowDate, { color: theme.fg }]}>
                {formatDateTime(item.scheduledAt, lang)}
              </Text>
              <Text style={[styles.rowStatus, { color: theme.fgMuted }]}>{item.status}</Text>
            </View>
          )}
        />
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  title: { fontSize: fontSize.h2, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.lg, gap: spacing.sm },
  row: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: spacing.md },
  rowDate: { fontSize: fontSize.body, fontWeight: '600' },
  rowStatus: { fontSize: fontSize.bodySm, marginTop: 2 },
});
