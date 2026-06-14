// Root layout — providers + app boot + session gate.
//
// Boot order:
//   1. configure the API auth bridge
//   2. start connectivity watch + outbox sync
//   3. hydrate session from secure store (→ locked if tokens exist)
//   4. wire AppState: idle-lock on resume, privacy-blur on background
//
// Routing gate: anon → /(auth)/login · locked → biometric unlock · active →
// the persona stack chosen from the role.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Slot, useRouter, useSegments } from 'expo-router';
import * as React from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  configureAuthBridge,
  hydrateSession,
  maybeLockOnResume,
} from '@/auth/boot';
import { useSession } from '@/auth/sessionStore';
import { personaForRole } from '@/config/domain';
import { evictExpired } from '@/offline/cache';
import { startConnectivityWatch } from '@/offline/connectivity';
import { startSync } from '@/offline/sync';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

export default function RootLayout(): React.ReactElement {
  const [booted, setBooted] = React.useState(false);

  React.useEffect(() => {
    configureAuthBridge();
    const stopNet = startConnectivityWatch();
    const stopSync = startSync();
    void evictExpired();
    void hydrateSession().finally(() => setBooted(true));

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') maybeLockOnResume();
    });

    return () => {
      stopNet();
      stopSync();
      sub.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        {booted ? <SessionGate /> : <Slot />}
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function SessionGate(): React.ReactElement {
  const status = useSession((s) => s.status);
  const role = useSession((s) => s.role);
  const router = useRouter();
  const segments = useSegments();

  React.useEffect(() => {
    const group = segments[0]; // e.g. '(auth)', '(patient)'
    if (status === 'anon' && group !== '(auth)') {
      router.replace('/(auth)/login');
    } else if (status === 'locked') {
      router.replace('/(auth)/unlock');
    } else if (status === 'active') {
      const persona = personaForRole(role);
      if (group === '(auth)' || group === undefined) {
        router.replace(`/(${persona})` as never);
      }
    }
  }, [status, role, segments, router]);

  return <Slot />;
}
