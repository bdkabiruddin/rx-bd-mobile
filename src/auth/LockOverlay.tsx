// LockOverlay — biometric re-lock rendered ON TOP of the current screen
// (not a navigation). The underlying screen stays mounted, so any in-progress
// form input survives the lock/unlock cycle — no data loss on idle-lock.
//
// It also doubles as a privacy cover: while locked, PHI underneath is hidden.

import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { COMMON, useT } from '@/i18n';
import { Button } from '@/ui/Button';
import { fontSize, spacing } from '@/ui/tokens';
import { useTheme } from '@/ui/theme';

import { authenticate } from './biometric';
import { hardLogout } from './boot';
import { useSession } from './sessionStore';

export function LockOverlay(): React.ReactElement {
  const theme = useTheme();
  const { t } = useT();
  const unlock = useSession((s) => s.unlock);
  const [failed, setFailed] = React.useState(false);

  const tryUnlock = React.useCallback(async () => {
    const okBio = await authenticate(t(COMMON.unlockPrompt));
    if (okBio) unlock();
    else setFailed(true);
  }, [t, unlock]);

  React.useEffect(() => {
    // Prompt biometric as soon as the overlay appears. setState only after the
    // async prompt resolves (not synchronously in the effect).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void tryUnlock();
  }, [tryUnlock]);

  return (
    <View style={[StyleSheet.absoluteFill, styles.cover, { backgroundColor: theme.bg }]}>
      <Text style={[styles.title, { color: theme.fg }]}>{t(COMMON.unlockPrompt)}</Text>
      <Text style={[styles.note, { color: theme.fgMuted }]}>
        {t({
          en: 'Locked for your privacy. Your unsaved work is kept.',
          bn: 'গোপনীয়তার জন্য লক করা হয়েছে। আপনার অসংরক্ষিত কাজ রাখা আছে।',
        })}
      </Text>
      {failed ? (
        <Button title={t(COMMON.unlock)} onPress={() => void tryUnlock()} />
      ) : null}
      <View style={styles.signout}>
        <Button title={t(COMMON.signOut)} variant="ghost" onPress={() => void hardLogout()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  title: { fontSize: fontSize.h2, fontWeight: '700' },
  note: { fontSize: fontSize.bodySm, textAlign: 'center' },
  signout: { marginTop: spacing.xl },
});
