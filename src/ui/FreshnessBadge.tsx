// Freshness badge — every offline-aware data surface shows where its data
// came from (live / N min ago / offline last-synced). Drives user trust in
// the read-cache.

import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { formatFreshness, useT } from '@/i18n';
import { useConnectivity } from '@/offline/connectivity';

import { radius, spacing } from './tokens';
import { useTheme } from './theme';

export function FreshnessBadge({
  fetchedAt,
}: {
  fetchedAt: number | null;
}): React.ReactElement | null {
  const theme = useTheme();
  const { lang, t } = useT();
  const online = useConnectivity((s) => s.online);
  if (fetchedAt === null) return null;

  const offline = !online;
  const label = offline
    ? t({ en: 'Offline', bn: 'অফলাইন' }) + ' · ' + formatFreshness(fetchedAt, lang)
    : formatFreshness(fetchedAt, lang);

  const tone = offline ? theme.status.warning : theme.fgSubtle;

  return (
    <View style={[styles.wrap, { borderColor: theme.line }]}>
      <View style={[styles.dot, { backgroundColor: tone }]} />
      <Text style={[styles.text, { color: tone }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 12 },
});
