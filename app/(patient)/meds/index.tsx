// Patient meds hub — prescription list (metadata projection: date, item
// count, refills, status) + current medications, with entry to the
// medication reminders manager. The backend list view carries NO drug
// names and NO doctor display name (prescribingDoctorUserId only) — rows
// honestly show what exists; drug detail lives on the detail screen.

import { useRouter } from 'expo-router';
import * as React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import {
  useCurrentMedications,
  usePatientPrescriptions,
} from '@/features/patient-meds/hooks';
import { joinParts, medicationStatusTone, prescriptionStatusTone } from '@/features/patient-meds/logic';
import {
  STR,
  medicationStatusLabel,
  medicineCountLabel,
  prescriptionStatusLabel,
  refillsLabel,
} from '@/features/patient-meds/strings';
import { COMMON, formatDate, useT } from '@/i18n';
import { EmptyState } from '@/ui/EmptyState';
import { FreshnessBadge } from '@/ui/FreshnessBadge';
import { ListRow } from '@/ui/ListRow';
import { ScreenScaffold } from '@/ui/ScreenScaffold';
import { SectionHeader } from '@/ui/SectionHeader';
import { StatusPill } from '@/ui/StatusPill';
import { spacing } from '@/ui/tokens';

export default function PatientMedsHome(): React.ReactElement {
  const { lang, t } = useT();
  const router = useRouter();

  const rx = usePatientPrescriptions();
  const meds = useCurrentMedications();

  const prescriptions = rx.data?.prescriptions;
  const medications = meds.data?.medications;

  return (
    <ScreenScaffold phi>
      <ScrollView contentContainerStyle={styles.scroll}>
        <SectionHeader
          title={t(STR.myPrescriptions)}
          right={<FreshnessBadge fetchedAt={rx.fetchedAt} />}
        />
        {rx.isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        ) : rx.error && !prescriptions ? (
          <EmptyState
            title={t(COMMON.genericError)}
            message={rx.error.message}
            actionLabel={t(COMMON.retry)}
            onAction={rx.refetch}
          />
        ) : !prescriptions || prescriptions.length === 0 ? (
          <EmptyState
            title={t(STR.noPrescriptions)}
            message={t(STR.noPrescriptionsHint)}
          />
        ) : (
          <View style={styles.group}>
            {prescriptions.map((item) => {
              const dateLabel =
                item.prescribedAt !== undefined
                  ? formatDate(item.prescribedAt, lang)
                  : t(STR.prescriptionFallbackTitle);
              const subtitle = joinParts([
                item.itemCount !== undefined
                  ? t(medicineCountLabel(item.itemCount))
                  : undefined,
                item.refillsAllowed !== undefined &&
                item.refillsAllowed > 0 &&
                item.refillsUsed !== undefined
                  ? t(refillsLabel(item.refillsUsed, item.refillsAllowed))
                  : undefined,
              ]);
              return (
                <ListRow
                  key={item.prescriptionId}
                  title={dateLabel}
                  {...(subtitle.length > 0 ? { subtitle } : {})}
                  right={
                    <StatusPill
                      label={t(prescriptionStatusLabel(item.status))}
                      tone={prescriptionStatusTone(item.status)}
                    />
                  }
                  accessibilityLabel={`${dateLabel}, ${t(prescriptionStatusLabel(item.status))}`}
                  testID={`rx-row-${item.prescriptionId}`}
                  onPress={() =>
                    router.push(`/(patient)/meds/${item.prescriptionId}` as never)
                  }
                />
              );
            })}
          </View>
        )}

        <SectionHeader
          title={t(STR.currentMedications)}
          right={<FreshnessBadge fetchedAt={meds.fetchedAt} />}
        />
        {meds.isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        ) : meds.error && !medications ? (
          <EmptyState
            title={t(COMMON.genericError)}
            message={meds.error.message}
            actionLabel={t(COMMON.retry)}
            onAction={meds.refetch}
          />
        ) : !medications || medications.length === 0 ? (
          <EmptyState title={t(STR.noMedications)} />
        ) : (
          <View style={styles.group}>
            {medications.map((med) => {
              const title = med.drugName ?? '—';
              const subtitle = joinParts([
                med.doseAmount,
                med.frequency,
                med.startedAt !== undefined
                  ? formatDate(med.startedAt, lang)
                  : undefined,
              ]);
              const sourceId = med.sourcePrescriptionId;
              return (
                <ListRow
                  key={med.id}
                  title={title}
                  {...(subtitle.length > 0 ? { subtitle } : {})}
                  right={
                    <StatusPill
                      label={t(medicationStatusLabel(med.status))}
                      tone={medicationStatusTone(med.status)}
                    />
                  }
                  accessibilityLabel={`${title}, ${t(medicationStatusLabel(med.status))}`}
                  {...(sourceId
                    ? {
                        onPress: () =>
                          router.push(`/(patient)/meds/${sourceId}` as never),
                      }
                    : { chevron: false })}
                />
              );
            })}
          </View>
        )}

        <View style={styles.group}>
          <ListRow
            title={t(STR.remindersEntry)}
            subtitle={t(STR.remindersEntryHint)}
            testID="open-reminders"
            accessibilityLabel={t(STR.remindersEntry)}
            onPress={() => router.push('/(patient)/meds/reminders')}
          />
        </View>
      </ScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl },
  center: { paddingVertical: spacing.xl, alignItems: 'center' },
  group: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.md },
});
