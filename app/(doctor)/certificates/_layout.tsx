// Doctor medical certificates — feature stack. Screens render their own
// SectionHeader (tab shell owns the chrome).

import { Stack } from 'expo-router';
import * as React from 'react';

export default function DoctorCertificatesLayout(): React.ReactElement {
  return <Stack screenOptions={{ headerShown: false }} />;
}
