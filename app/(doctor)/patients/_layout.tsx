// Doctor patients — feature stack. Screens render their own SectionHeader
// (tab shell owns the chrome).

import { Stack } from 'expo-router';
import * as React from 'react';

export default function DoctorPatientsLayout(): React.ReactElement {
  return <Stack screenOptions={{ headerShown: false }} />;
}
