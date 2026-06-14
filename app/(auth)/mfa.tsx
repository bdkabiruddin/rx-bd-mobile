// MFA verification — shown after a login that returned mfaRequired. On
// success the SessionGate routes to the persona stack.

import * as React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import type { ApiError } from '@/api/errors';
import { verifyMfa } from '@/auth/boot';
import { COMMON, useT } from '@/i18n';
import { Button } from '@/ui/Button';
import { ScreenScaffold } from '@/ui/ScreenScaffold';
import { fontSize, radius, spacing } from '@/ui/tokens';
import { useTheme } from '@/ui/theme';

export default function MfaScreen(): React.ReactElement {
  const theme = useTheme();
  const { t } = useT();
  const [code, setCode] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<ApiError | null>(null);

  async function onSubmit() {
    setBusy(true);
    setError(null);
    const res = await verifyMfa(code.trim());
    setBusy(false);
    if (!res.ok) setError(res.error);
    // On success the SessionGate routes onward.
  }

  return (
    <ScreenScaffold>
      <View style={styles.wrap}>
        <Text style={[styles.title, { color: theme.fg }]}>
          {t({ en: 'Two-factor verification', bn: 'দুই-ধাপ যাচাই' })}
        </Text>
        <Text style={[styles.subtitle, { color: theme.fgMuted }]}>
          {t({ en: 'Enter the 6-digit code from your authenticator.', bn: 'আপনার অথেন্টিকেটরের ৬-সংখ্যার কোডটি দিন।' })}
        </Text>

        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="000000"
          placeholderTextColor={theme.fgSubtle}
          keyboardType="number-pad"
          maxLength={8}
          accessibilityLabel={t({ en: 'Verification code', bn: 'যাচাই কোড' })}
          style={[styles.input, { borderColor: theme.inputBorder, color: theme.fg }]}
        />

        {error ? (
          <Text style={[styles.error, { color: theme.status.danger }]} accessibilityRole="alert">
            {error.message}
          </Text>
        ) : null}

        <Button
          title={t(COMMON.confirm)}
          onPress={() => void onSubmit()}
          loading={busy}
          disabled={code.trim().length < 6}
        />
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  title: { fontSize: fontSize.h2, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: fontSize.bodySm, textAlign: 'center', marginBottom: spacing.lg },
  input: {
    minHeight: 56,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.h3,
    textAlign: 'center',
    letterSpacing: 8,
  },
  error: { fontSize: fontSize.bodySm, textAlign: 'center' },
});
