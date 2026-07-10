// Labs feature stack — screens render their own SectionHeader.

import { Stack } from 'expo-router';
import * as React from 'react';

export default function LabsLayout(): React.ReactElement {
  return <Stack screenOptions={{ headerShown: false }} />;
}
