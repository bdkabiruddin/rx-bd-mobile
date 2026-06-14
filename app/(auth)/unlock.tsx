// Biometric unlock — shown when a session exists but is locked (cold start
// or post-idle). No PHI renders until this passes.

import { useRouter } from 'expo-router';
import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { authenticate } from '@/auth/biometric';
import { hardLogout } from '@/auth/boot';
import { useSession } from '@/auth/sessionStore';
import { COMMON, useT } from '@/i18n';
import { Button } from '@/ui/Button';
import { ScreenScaffold } from '@/ui/ScreenScaffold';
import { fontSize, spacing } from '@/ui/tokens';
import { useTheme } from '@/ui/theme';

export default function UnlockScreen(): React.ReactElement {
  const theme = useTheme();
  const { t } = useT();
  const router = useRouter();
  const unlock = useSession((s) => s.unlock);
  const [failed, setFailed] = React.useState(false);

  const tryUnlock = React.useCallback(async () => {
    const okBio = await authenticate(t(COMMON.unlockPrompt));
    if (okBio) {
      unlock();
    } else {
      setFailed(true);
    }
  }, [t, unlock]);

  React.useEffect(() => {
    void tryUnlock();
  }, [tryUnlock]);

  return (
    <ScreenScaffold>
      <View style={styles.wrap}>
        <Text style={[styles.title, { color: theme.fg }]}>{t(COMMON.unlockPrompt)}</Text>
        {failed ? (
          <>
            <Text style={[styles.msg, { color: theme.fgMuted }]}>
              {t({ en: 'Verification needed to continue.', bn: 'চালিয়ে যেতে যাচাই প্রয়োজন।' })}
            </Text>
            <Button title={t(COMMON.unlock)} onPress={() => void tryUnlock()} />
          </>
        ) : null}
        <View style={styles.signout}>
          <Button
            title={t(COMMON.signOut)}
            variant="ghost"
            onPress={() => {
              void hardLogout().then(() => router.replace('/(auth)/login'));
            }}
          />
        </View>
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, gap: spacing.md },
  title: { fontSize: fontSize.h2, fontWeight: '700' },
  msg: { fontSize: fontSize.bodySm, textAlign: 'center' },
  signout: { marginTop: spacing.xl },
});
