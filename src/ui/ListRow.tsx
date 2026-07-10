// ListRow — standard tappable list row: title, optional subtitle/meta line,
// optional right accessory (e.g. a StatusPill), chevron when navigable.
// Token-driven, accessible, min 48dp touch target.

import * as React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MIN_TOUCH_TARGET, fontSize, radius, spacing } from './tokens';
import { useTheme } from './theme';

export interface ListRowProps {
  title: string;
  subtitle?: string;
  /** Small trailing text (e.g. a date) rendered above/next to the accessory. */
  meta?: string;
  /** Right-side accessory element (e.g. <StatusPill …/>). */
  right?: React.ReactNode;
  onPress?: () => void;
  /** Show a chevron affordance (defaults to true when onPress is set). */
  chevron?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}

export function ListRow({
  title,
  subtitle,
  meta,
  right,
  onPress,
  chevron,
  accessibilityLabel,
  testID,
}: ListRowProps): React.ReactElement {
  const theme = useTheme();
  const showChevron = chevron ?? onPress !== undefined;

  const body = (
    <>
      <View style={styles.main}>
        <Text style={[styles.title, { color: theme.fg }]} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: theme.fgMuted }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.trailing}>
        {meta ? <Text style={[styles.meta, { color: theme.fgMuted }]}>{meta}</Text> : null}
        {right}
        {showChevron ? (
          <Text style={[styles.chevron, { color: theme.fgMuted }]} accessibilityElementsHidden>
            ›
          </Text>
        ) : null}
      </View>
    </>
  );

  const frame = [
    styles.row,
    { borderColor: theme.line, backgroundColor: theme.bgElevated },
  ];

  if (!onPress) {
    return (
      <View style={frame} {...(testID !== undefined ? { testID } : {})}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      {...(accessibilityLabel !== undefined ? { accessibilityLabel } : {})}
      {...(testID !== undefined ? { testID } : {})}
      onPress={onPress}
      style={({ pressed }) => [...frame, pressed && { opacity: 0.85 }]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  main: { flex: 1, gap: 2 },
  title: { fontSize: fontSize.body, fontWeight: '600' },
  subtitle: { fontSize: fontSize.bodySm },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  meta: { fontSize: fontSize.bodySm },
  chevron: { fontSize: fontSize.h2, marginLeft: spacing.xs },
});
