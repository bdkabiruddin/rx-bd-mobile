// Records hub — entry to lab results and the vitals diary. No PHI is
// rendered here (link labels only), so the screenshot guard is not needed.

import { useRouter } from 'expo-router';
import * as React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useT } from '@/i18n';
import { ListRow } from '@/ui/ListRow';
import { ScreenScaffold } from '@/ui/ScreenScaffold';
import { SectionHeader } from '@/ui/SectionHeader';
import { spacing } from '@/ui/tokens';

export default function PatientRecordsHub(): React.ReactElement {
  const { t } = useT();
  const router = useRouter();

  return (
    <ScreenScaffold>
      <SectionHeader title={t({ en: 'Health records', bn: 'স্বাস্থ্য রেকর্ড' })} />
      <ScrollView contentContainerStyle={styles.list}>
        <View style={styles.group}>
          <ListRow
            title={t({ en: 'Lab results', bn: 'ল্যাব রিপোর্ট' })}
            subtitle={t({
              en: 'Orders, reports and results',
              bn: 'অর্ডার, রিপোর্ট ও ফলাফল',
            })}
            onPress={() => router.push('/(patient)/labs')}
          />
          <ListRow
            title={t({ en: 'Vitals diary', bn: 'ভাইটাল ডায়েরি' })}
            subtitle={t({
              en: 'Blood pressure, sugar, weight and more',
              bn: 'রক্তচাপ, সুগার, ওজন এবং আরও',
            })}
            onPress={() => router.push('/(patient)/vitals')}
          />
        </View>
      </ScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg },
  group: { gap: spacing.sm },
});
