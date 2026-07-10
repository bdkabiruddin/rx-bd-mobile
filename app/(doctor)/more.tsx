// Doctor "More" hub — schedule management, referrals, certificates, branch
// switch, language toggle and sign-out. Link labels only; no PHI here.

import { useRouter } from 'expo-router';
import * as React from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { hardLogout } from '@/auth/boot';
import { COMMON, useLanguage, useT } from '@/i18n';
import { BranchSwitcher } from '@/ui/BranchSwitcher';
import { Button } from '@/ui/Button';
import { ListRow } from '@/ui/ListRow';
import { ScreenScaffold } from '@/ui/ScreenScaffold';
import { SectionHeader } from '@/ui/SectionHeader';
import { spacing } from '@/ui/tokens';

export default function DoctorMoreHub(): React.ReactElement {
  const { t } = useT();
  const toggleLang = useLanguage((s) => s.toggle);
  const router = useRouter();
  const [signingOut, setSigningOut] = React.useState(false);

  const confirmSignOut = (): void => {
    Alert.alert(
      t(COMMON.signOut),
      t({
        en: 'This clears all app data on this device.',
        bn: 'এটি এই ডিভাইসের সব অ্যাপ ডেটা মুছে ফেলবে।',
      }),
      [
        { text: t(COMMON.cancel), style: 'cancel' },
        {
          text: t(COMMON.signOut),
          style: 'destructive',
          onPress: () => {
            setSigningOut(true);
            void hardLogout().finally(() => setSigningOut(false));
          },
        },
      ],
    );
  };

  return (
    <ScreenScaffold>
      <SectionHeader title={t({ en: 'More', bn: 'আরও' })} />
      <ScrollView contentContainerStyle={styles.list}>
        <BranchSwitcher />
        <View style={styles.group}>
          <ListRow
            title={t({ en: 'Manage schedule', bn: 'শিডিউল ব্যবস্থাপনা' })}
            subtitle={t({ en: 'Weekly hours and blocks', bn: 'সাপ্তাহিক সময় ও ব্লক' })}
            onPress={() => router.push('/(doctor)/schedule')}
          />
          <ListRow
            title={t({ en: 'Referrals', bn: 'রেফারেল' })}
            onPress={() => router.push('/(doctor)/referrals')}
          />
          <ListRow
            title={t({ en: 'Medical certificates', bn: 'মেডিকেল সার্টিফিকেট' })}
            onPress={() => router.push('/(doctor)/certificates')}
          />
          <ListRow
            title={t({ en: 'Language: English ⇄ বাংলা', bn: 'ভাষা: বাংলা ⇄ English' })}
            onPress={toggleLang}
            chevron={false}
          />
        </View>
        <View style={styles.footer}>
          <Button
            title={t(COMMON.signOut)}
            variant="destructive"
            loading={signingOut}
            onPress={confirmSignOut}
          />
        </View>
      </ScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg },
  group: { gap: spacing.sm, marginTop: spacing.md },
  footer: { marginTop: spacing.xl },
});
