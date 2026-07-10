// Billing feature stack — screens render their own SectionHeader.

import { Stack } from 'expo-router';
import * as React from 'react';

export default function BillingLayout(): React.ReactElement {
  return <Stack screenOptions={{ headerShown: false }} />;
}
