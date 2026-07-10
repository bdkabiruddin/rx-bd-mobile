// MasterDetail — tablet side-by-side panes (the dictated contract).
//
// Usage (list + inline summary; callers render this ONLY when
// useBreakpoint().isTablet — phones keep push navigation):
//
//   const { isTablet } = useBreakpoint();
//   if (isTablet) {
//     return (
//       <MasterDetail
//         master={<SearchList onSelect={setSelectedId} />}
//         detail={selectedId ? <PatientSummary patientId={selectedId} /> : null}
//       />
//     );
//   }
//   // phone: onSelect -> router.push('/(doctor)/patients/' + id)

import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useT } from '@/i18n';

import { fontSize, spacing } from './tokens';
import { useTheme } from './theme';

export function MasterDetail({
  master,
  detail,
  emptyDetail,
}: {
  master: React.ReactNode;
  detail: React.ReactNode | null;
  emptyDetail?: React.ReactNode;
}): React.ReactElement {
  const theme = useTheme();
  const { t } = useT();

  return (
    <View style={styles.row}>
      <View style={styles.master}>{master}</View>
      <View style={[styles.divider, { backgroundColor: theme.line }]} />
      <View style={[styles.detail, { backgroundColor: theme.bgSoft }]}>
        {detail ??
          emptyDetail ?? (
            <View style={styles.placeholder}>
              <Text style={[styles.placeholderText, { color: theme.fgMuted }]}>
                {t({ en: 'Select an item', bn: 'একটি আইটেম নির্বাচন করুন' })}
              </Text>
            </View>
          )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row' },
  master: { width: 380, maxWidth: '40%' },
  divider: { width: StyleSheet.hairlineWidth },
  detail: { flex: 1 },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  placeholderText: { fontSize: fontSize.body },
});
