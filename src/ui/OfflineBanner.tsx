// Offline banner — visible whenever connectivity is down, with the count of
// writes waiting to sync so the user knows their actions are safe, not lost.

import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useT } from '@/i18n';
import { useConnectivity } from '@/offline/connectivity';
import { pendingCount } from '@/offline/outbox';

import { spacing } from './tokens';
import { useTheme } from './theme';

export function OfflineBanner(): React.ReactElement | null {
  const theme = useTheme();
  const { t } = useT();
  const online = useConnectivity((s) => s.online);
  const [pending, setPending] = React.useState(0);

  React.useEffect(() => {
    let active = true;
    void pendingCount().then((n) => active && setPending(n));
    return () => {
      active = false;
    };
  }, [online]);

  if (online) return null;

  const label =
    pending > 0
      ? t({
          en: `Offline — ${pending} change${pending === 1 ? '' : 's'} will sync`,
          bn: `অফলাইন — ${pending}টি পরিবর্তন সিঙ্ক হবে`,
        })
      : t({ en: 'Offline — showing last synced data', bn: 'অফলাইন — সর্বশেষ সিঙ্ক করা তথ্য' });

  return (
    <View style={[styles.bar, { backgroundColor: theme.status.warningSoft }]}>
      <Text style={[styles.text, { color: theme.status.warning }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
  text: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
});
