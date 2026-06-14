// Login screen. Password → (optional MFA) → session. Phone-OTP / OAuth land
// alongside in Phase 1; this is the foundation flow.

import * as React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import type { ApiError } from '@/api/errors';
import { login } from '@/auth/boot';
import { COMMON, useT } from '@/i18n';
import { Button } from '@/ui/Button';
import { ScreenScaffold } from '@/ui/ScreenScaffold';
import { fontSize, radius, spacing } from '@/ui/tokens';
import { useTheme } from '@/ui/theme';
import { useRouter } from 'expo-router';

export default function LoginScreen(): React.ReactElement {
  const theme = useTheme();
  const { t } = useT();
  const router = useRouter();
  const [identifier, setIdentifier] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<ApiError | null>(null);

  async function onSubmit() {
    setBusy(true);
    setError(null);
    const res = await login(identifier.trim(), password);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (res.value.mfaRequired) {
      router.replace('/(auth)/mfa');
    }
    // On success the SessionGate routes to the persona stack.
  }

  return (
    <ScreenScaffold>
      <View style={styles.wrap}>
        <Text style={[styles.brand, { color: theme.accent }]}>{t(COMMON.appName)}</Text>
        <Text style={[styles.subtitle, { color: theme.fgMuted }]}>
          {t({ en: 'Sign in to your account', bn: 'আপনার অ্যাকাউন্টে সাইন ইন করুন' })}
        </Text>

        <TextInput
          value={identifier}
          onChangeText={setIdentifier}
          placeholder={t({ en: 'Email or phone', bn: 'ইমেইল বা ফোন' })}
          placeholderTextColor={theme.fgSubtle}
          autoCapitalize="none"
          keyboardType="email-address"
          accessibilityLabel={t({ en: 'Email or phone', bn: 'ইমেইল বা ফোন' })}
          style={[styles.input, { borderColor: theme.inputBorder, color: theme.fg }]}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder={t({ en: 'Password', bn: 'পাসওয়ার্ড' })}
          placeholderTextColor={theme.fgSubtle}
          secureTextEntry
          accessibilityLabel={t({ en: 'Password', bn: 'পাসওয়ার্ড' })}
          style={[styles.input, { borderColor: theme.inputBorder, color: theme.fg }]}
        />

        {error ? (
          <Text style={[styles.error, { color: theme.status.danger }]} accessibilityRole="alert">
            {error.message}
          </Text>
        ) : null}

        <Button
          title={t(COMMON.signIn)}
          onPress={() => void onSubmit()}
          loading={busy}
          disabled={!identifier || !password}
        />

        <Button
          title={t({ en: 'Sign in with phone', bn: 'ফোন দিয়ে সাইন ইন' })}
          variant="ghost"
          onPress={() => router.push('/(auth)/phone')}
        />
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  brand: { fontSize: fontSize.h1, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: fontSize.bodySm, textAlign: 'center', marginBottom: spacing.lg },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.body,
  },
  error: { fontSize: fontSize.bodySm },
});
