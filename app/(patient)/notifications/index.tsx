// Patient notification inbox — newest first, type pill + sent time per
// row, pull-to-refresh, unread tally, critical-alert banner.
//
//   Reads:  GET /api/v1/notifications/me?limit=50 → ListMyNotificationsResult
//           (read + unread rows, newest first; unreadCount powers the
//           header tally; unreadCritical gates the danger banner).
//   Write:  POST /api/v1/notifications/{id}/read on row tap (idempotent
//           mark-read) via useWrite; taps on mapped deep-links navigate.
//
// Title/body are stored single-language on the server (no { en, bn }
// pair), so notification content renders as sent; chrome is localized.

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import * as React from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useCachedQuery } from '@/api/useCachedQuery';
import { useSession } from '@/auth/sessionStore';
import { COMMON, useT } from '@/i18n';
import { useWrite } from '@/offline/useWrite';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { FreshnessBadge } from '@/ui/FreshnessBadge';
import { ScreenScaffold } from '@/ui/ScreenScaffold';
import { SectionHeader } from '@/ui/SectionHeader';
import { fontSize, radius, spacing } from '@/ui/tokens';
import { useTheme } from '@/ui/theme';

import {
  isUnread,
  mapDeepLinkToRoute,
  sortNewestFirst,
} from '@/features/patient-notifications/logic';
import { NotificationRow } from '@/features/patient-notifications/NotificationRow';
import { STR, unreadCountLabel } from '@/features/patient-notifications/strings';
import type {
  InboxPayload,
  MarkReadResult,
  NotificationItem,
} from '@/features/patient-notifications/types';

const INBOX_KEY = 'patient:notifications:inbox';

export default function PatientNotificationsInbox(): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useT();
  const userId = useSession((s) => s.userId);

  const { data, fetchedAt, isLoading, error, refetch } =
    useCachedQuery<InboxPayload>({
      key: INBOX_KEY,
      path: '/api/v1/notifications/me?limit=50',
      ttlMs: 5 * 60 * 1000,
      isPhi: true,
      ...(userId !== null ? { userId } : {}),
    });

  // Pull spinner only for user-initiated refreshes (not background refetch):
  // the flag clears when the refetch promise settles — no effect needed.
  const [pulling, setPulling] = React.useState(false);
  const onPullRefresh = React.useCallback(() => {
    setPulling(true);
    void queryClient
      .refetchQueries({ queryKey: [INBOX_KEY] })
      .finally(() => setPulling(false));
  }, [queryClient]);

  const markRead = useWrite<MarkReadResult>();

  const notifications = React.useMemo(
    () => (data?.notifications ? sortNewestFirst(data.notifications) : undefined),
    [data],
  );
  const unreadCount = data?.unreadCount ?? 0;
  const hasCritical = (data?.unreadCritical?.length ?? 0) > 0;

  const openNotification = (item: NotificationItem): void => {
    // Mark-read fires only when the row is unread AND no other mark-read
    // is in flight — useWrite holds ONE idempotency key per logical
    // action, so concurrent taps must not share it. A skipped row stays
    // unread and is retried on the next tap. OFFLINE failures are
    // silently tolerated here (reading is offline-safe; the row simply
    // stays unread until reconnect).
    if (isUnread(item) && !markRead.busy) {
      void (async () => {
        const res = await markRead.submit({
          method: 'POST',
          path: `/api/v1/notifications/${encodeURIComponent(item.id)}/read`,
        });
        if (res.ok) {
          void queryClient.invalidateQueries({ queryKey: [INBOX_KEY] });
        }
      })();
    }
    const route = mapDeepLinkToRoute(item.deepLink, item.link);
    if (route) router.push(route as never);
  };

  return (
    <ScreenScaffold phi>
      <SectionHeader
        title={t(STR.inboxTitle)}
        right={<FreshnessBadge fetchedAt={fetchedAt} />}
      />

      <View style={styles.toolbar}>
        <Text style={[styles.unread, { color: theme.fgMuted }]}>
          {unreadCount > 0 ? t(unreadCountLabel(unreadCount)) : ''}
        </Text>
        <Button
          title={t(STR.preferences)}
          variant="ghost"
          accessibilityLabel={t(STR.preferences)}
          onPress={() => router.push('/(patient)/notifications/settings' as never)}
        />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.accent} />
        </View>
      ) : error && !notifications ? (
        <EmptyState
          title={t(COMMON.genericError)}
          message={error.message}
          actionLabel={t(COMMON.retry)}
          onAction={refetch}
        />
      ) : !notifications || notifications.length === 0 ? (
        <EmptyState
          title={t(STR.noNotifications)}
          message={t(STR.noNotificationsHint)}
          actionLabel={t(COMMON.retry)}
          onAction={refetch}
        />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={pulling}
              onRefresh={onPullRefresh}
              tintColor={theme.accent}
              colors={[theme.accent]}
            />
          }
          ListHeaderComponent={
            hasCritical ? (
              <View
                style={[
                  styles.banner,
                  {
                    backgroundColor: theme.status.dangerSoft,
                    borderColor: theme.status.danger,
                  },
                ]}
                accessibilityRole="alert"
              >
                <Text style={[styles.bannerText, { color: theme.status.danger }]}>
                  {t(STR.criticalBanner)}
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <NotificationRow item={item} onPress={() => openNotification(item)} />
          )}
        />
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  unread: { fontSize: fontSize.bodySm, fontWeight: '600' },
  list: { padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm },
  banner: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  bannerText: { fontSize: fontSize.bodySm, fontWeight: '700' },
});
