// Patient vitals — feature stack. Screens render their own SectionHeader
// (tab shell owns the chrome).

import { Stack } from 'expo-router';
import * as React from 'react';

export default function PatientVitalsLayout(): React.ReactElement {
  return <Stack screenOptions={{ headerShown: false }} />;
}
