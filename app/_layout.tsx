// Root layout — providers + app boot + session gate.
//
// Boot order:
//   1. configure the API auth bridge
//   2. start connectivity watch
//   3. hydrate session from secure store (→ locked if tokens exist)
//   4. wire AppState: idle-lock on resume, privacy-blur on background
//
// Routing gate: anon → /(auth)/login · active → persona stack. "locked" is NOT
// a route — it renders a LockOverlay on top so screen state survives the lock.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Slot, useRouter, useSegments } from 'expo-router';
import * as React from 'react';
import { AppState, type AppStateStatus, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  configureAuthBridge,
  hydrateSession,
  maybeLockOnResume,
} from '@/auth/boot';
import { LockOverlay } from '@/auth/LockOverlay';
import { useSession } from '@/auth/sessionStore';
import { personaForRole } from '@/config/domain';
import { evictExpired } from '@/offline/cache';
import { startConnectivityWatch } from '@/offline/connectivity';
import { initOfflineSecurity } from '@/offline/init';
import { registerForPush, usePushDeepLinks } from '@/push/register';

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
    // Install the AES codec (cache leaves fail-closed mode), then evict any
    // expired PHI, then hydrate the session. (Writes are online-only — no
    // outbox sync to start.)
    void initOfflineSecurity()
      .then(() => evictExpired())
      .catch(() => undefined)
      .finally(() => {
        void hydrateSession().finally(() => setBooted(true));
      });

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') maybeLockOnResume();
    });

    return () => {
      stopNet();
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
  usePushDeepLinks();
  const status = useSession((s) => s.status);
  const role = useSession((s) => s.role);
  const router = useRouter();
  const segments = useSegments();

  // Register the device push token once per signed-in session (permission
  // prompt + backend upsert); reset on logout so the next user re-registers.
  const pushRegisteredRef = React.useRef(false);
  React.useEffect(() => {
    if (status === 'active' && !pushRegisteredRef.current) {
      pushRegisteredRef.current = true;
      void registerForPush();
    } else if (status === 'anon') {
      pushRegisteredRef.current = false;
    }
  }, [status]);

  React.useEffect(() => {
    const group = segments[0]; // e.g. '(auth)', '(patient)'
    // NOTE: 'locked' does NOT navigate — it renders a LockOverlay on top so the
    // current screen (and any in-progress form input) stays mounted. Only
    // anon/active drive navigation.
    if (status === 'anon' && group !== '(auth)') {
      router.replace('/(auth)/login');
    } else if (status === 'active') {
      const persona = personaForRole(role);
      if (group === '(auth)' || group === undefined) {
        router.replace(`/(${persona})` as never);
      }
    }
  }, [status, role, segments, router]);

  return (
    <View style={{ flex: 1 }}>
      <Slot />
      {status === 'locked' ? <LockOverlay /> : null}
    </View>
  );
}
