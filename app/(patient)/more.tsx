// More hub — queue position, notifications, profile, billing, language
// toggle and sign-out. Link labels only; no PHI rendered here.

import { useRouter } from 'expo-router';
import * as React from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { hardLogout } from '@/auth/boot';
import { COMMON, useLanguage, useT } from '@/i18n';
import { Button } from '@/ui/Button';
import { ListRow } from '@/ui/ListRow';
import { ScreenScaffold } from '@/ui/ScreenScaffold';
import { SectionHeader } from '@/ui/SectionHeader';
import { spacing } from '@/ui/tokens';

export default function PatientMoreHub(): React.ReactElement {
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
        <View style={styles.group}>
          <ListRow
            title={t({ en: 'Live queue position', bn: 'লাইভ সিরিয়াল অবস্থান' })}
            onPress={() => router.push('/(patient)/queue')}
          />
          <ListRow
            title={t({ en: 'Notifications', bn: 'নোটিফিকেশন' })}
            onPress={() => router.push('/(patient)/notifications')}
          />
          <ListRow
            title={t({ en: 'Profile & privacy', bn: 'প্রোফাইল ও গোপনীয়তা' })}
            onPress={() => router.push('/(patient)/profile')}
          />
          <ListRow
            title={t({ en: 'Bills & payments', bn: 'বিল ও পেমেন্ট' })}
            onPress={() => router.push('/(patient)/billing')}
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
  group: { gap: spacing.sm },
  footer: { marginTop: spacing.xl },
});
