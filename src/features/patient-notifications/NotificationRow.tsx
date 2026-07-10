// One inbox row — type pill + sent time header line, then title + body.
// Custom (not ListRow) so the pill/time header and unread emphasis read
// clearly; keeps the same card frame, tokens and touch-target rules.

import * as React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDateTime, useT } from '@/i18n';
import { StatusPill } from '@/ui/StatusPill';
import { MIN_TOUCH_TARGET, fontSize, radius, spacing } from '@/ui/tokens';
import { useTheme } from '@/ui/theme';

import { isUnread, normalizeType, notificationTone } from './logic';
import { STR, typeLabel } from './strings';
import type { NotificationItem } from './types';

export function NotificationRow({
  item,
  onPress,
}: {
  item: NotificationItem;
  onPress: () => void;
}): React.ReactElement {
  const theme = useTheme();
  const { lang, t } = useT();

  const unread = isUnread(item);
  const tone = notificationTone(item.level, item.type);
  const kind = t(typeLabel(normalizeType(item.type)));
  const title = item.title ?? kind;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          borderColor: unread ? theme.lineStrong : theme.line,
          backgroundColor: theme.bgElevated,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.pills}>
          <StatusPill label={kind} tone={tone} />
          {unread ? <StatusPill label={t(STR.newPill)} tone="info" /> : null}
        </View>
        {item.createdAt ? (
          <Text style={[styles.time, { color: theme.fgSubtle }]}>
            {formatDateTime(item.createdAt, lang)}
          </Text>
        ) : null}
      </View>
      <Text
        style={[
          styles.title,
          { color: theme.fg, fontWeight: unread ? '700' : '600' },
        ]}
        numberOfLines={2}
      >
        {title}
      </Text>
      {item.body ? (
        <Text style={[styles.body, { color: theme.fgMuted }]} numberOfLines={3}>
          {item.body}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: MIN_TOUCH_TARGET,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  pills: { flexDirection: 'row', gap: spacing.xs, flexShrink: 1 },
  time: { fontSize: fontSize.caption },
  title: { fontSize: fontSize.body },
  body: { fontSize: fontSize.bodySm },
});
