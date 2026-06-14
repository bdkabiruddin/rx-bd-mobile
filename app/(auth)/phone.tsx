// Phone-OTP login — two steps: enter a +880 number → enter the OTP. On
// success the SessionGate routes to the persona stack.

import * as React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import type { ApiError } from '@/api/errors';
import { issuePhoneOtp, verifyPhoneOtp } from '@/auth/phone';
import { COMMON, useT } from '@/i18n';
import { Button } from '@/ui/Button';
import { ScreenScaffold } from '@/ui/ScreenScaffold';
import { fontSize, radius, spacing } from '@/ui/tokens';
import { useTheme } from '@/ui/theme';

export default function PhoneLoginScreen(): React.ReactElement {
  const theme = useTheme();
  const { t } = useT();
  const [step, setStep] = React.useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = React.useState('');
  const [code, setCode] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<ApiError | null>(null);

  async function sendOtp() {
    setBusy(true);
    setError(null);
    const res = await issuePhoneOtp(phone.trim());
    setBusy(false);
    if (!res.ok) setError(res.error);
    else setStep('otp');
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    const res = await verifyPhoneOtp(phone.trim(), code.trim());
    setBusy(false);
    if (!res.ok) setError(res.error);
    // On success the SessionGate routes onward.
  }

  return (
    <ScreenScaffold>
      <View style={styles.wrap}>
        <Text style={[styles.title, { color: theme.fg }]}>
          {t({ en: 'Sign in with phone', bn: 'ফোন দিয়ে সাইন ইন' })}
        </Text>

        {step === 'phone' ? (
          <>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="01XXXXXXXXX"
              placeholderTextColor={theme.fgSubtle}
              keyboardType="phone-pad"
              accessibilityLabel={t({ en: 'Mobile number', bn: 'মোবাইল নম্বর' })}
              style={[styles.input, { borderColor: theme.inputBorder, color: theme.fg }]}
            />
            {error ? (
              <Text style={[styles.error, { color: theme.status.danger }]} accessibilityRole="alert">
                {error.message}
              </Text>
            ) : null}
            <Button
              title={t({ en: 'Send code', bn: 'কোড পাঠান' })}
              onPress={() => void sendOtp()}
              loading={busy}
              disabled={phone.trim().length < 6}
            />
          </>
        ) : (
          <>
            <Text style={[styles.subtitle, { color: theme.fgMuted }]}>
              {t({ en: 'Enter the code sent to your phone.', bn: 'আপনার ফোনে পাঠানো কোডটি দিন।' })}
            </Text>
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="000000"
              placeholderTextColor={theme.fgSubtle}
              keyboardType="number-pad"
              maxLength={8}
              accessibilityLabel={t({ en: 'Verification code', bn: 'যাচাই কোড' })}
              style={[styles.input, styles.otp, { borderColor: theme.inputBorder, color: theme.fg }]}
            />
            {error ? (
              <Text style={[styles.error, { color: theme.status.danger }]} accessibilityRole="alert">
                {error.message}
              </Text>
            ) : null}
            <Button
              title={t(COMMON.confirm)}
              onPress={() => void confirm()}
              loading={busy}
              disabled={code.trim().length < 4}
            />
            <Button
              title={t({ en: 'Change number', bn: 'নম্বর পরিবর্তন' })}
              variant="ghost"
              onPress={() => {
                setStep('phone');
                setCode('');
                setError(null);
              }}
            />
          </>
        )}
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  title: { fontSize: fontSize.h2, fontWeight: '700', textAlign: 'center', marginBottom: spacing.sm },
  subtitle: { fontSize: fontSize.bodySm, textAlign: 'center' },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.body,
  },
  otp: { minHeight: 56, fontSize: fontSize.h3, textAlign: 'center', letterSpacing: 8 },
  error: { fontSize: fontSize.bodySm, textAlign: 'center' },
});
