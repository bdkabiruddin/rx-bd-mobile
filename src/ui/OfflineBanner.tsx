// Offline banner — visible whenever connectivity is down. Writes are
// online-only, so the message tells the user they're viewing cached data and
// must reconnect to make changes (add/edit/delete are blocked while offline).

import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useT } from '@/i18n';
import { useConnectivity } from '@/offline/connectivity';

import { spacing } from './tokens';
import { useTheme } from './theme';

export function OfflineBanner(): React.ReactElement | null {
  const theme = useTheme();
  const { t } = useT();
  const online = useConnectivity((s) => s.online);

  if (online) return null;

  return (
    <View style={[styles.bar, { backgroundColor: theme.status.warningSoft }]}>
      <Text style={[styles.text, { color: theme.status.warning }]}>
        {t({
          en: 'Offline — viewing saved data. Reconnect to make changes.',
          bn: 'অফলাইন — সংরক্ষিত তথ্য দেখছেন। পরিবর্তন করতে আবার সংযুক্ত হন।',
        })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
  text: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
});
