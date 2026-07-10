// Doctor patient summary route (phone navigation target; on tablets the
// same PatientSummary renders inline as the master-detail pane, so this
// route body stays a thin shell around the shared component).
//
// `[id]` is the patient's USER id — the key of `/patients/{id}/*` and of
// `/doctors/{doctorId}/patients/{patientId}` (see PatientSummary for the
// endpoint set + per-section consent handling).

import { useLocalSearchParams, useRouter } from 'expo-router';
import * as React from 'react';

import { useT } from '@/i18n';
import { EmptyState } from '@/ui/EmptyState';
import { ScreenScaffold } from '@/ui/ScreenScaffold';
import { SectionHeader } from '@/ui/SectionHeader';

import { PatientSummary } from '@/features/doctor-patients/PatientSummary';
import { DP_STR } from '@/features/doctor-patients/strings';

function paramString(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default function DoctorPatientDetailRoute(): React.ReactElement {
  const { t } = useT();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = paramString(params.id);

  return (
    <ScreenScaffold phi>
      <SectionHeader title={t(DP_STR.summaryTitle)} />
      {id === null || id.length === 0 ? (
        <EmptyState
          title={t(DP_STR.notFound)}
          actionLabel={t(DP_STR.back)}
          onAction={() => router.back()}
        />
      ) : (
        <PatientSummary patientId={id} />
      )}
    </ScreenScaffold>
  );
}
