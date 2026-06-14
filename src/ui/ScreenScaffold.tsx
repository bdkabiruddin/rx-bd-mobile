// ScreenScaffold — standard screen frame: safe-area, offline banner, and an
// optional PHI screenshot guard. Persona screens compose this.

import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePhiScreenGuard } from '@/security/screenshotGuard';

import { OfflineBanner } from './OfflineBanner';
import { useTheme } from './theme';

export function ScreenScaffold({
  children,
  /** Set true on any screen that renders PHI — applies the screenshot guard. */
  phi = false,
}: {
  children: React.ReactNode;
  phi?: boolean;
}): React.ReactElement {
  const theme = useTheme();
  usePhiScreenGuard(phi);
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]} edges={['top', 'left', 'right']}>
      <OfflineBanner />
      <View style={styles.body}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1 },
});
