// Runtime environment, resolved from Expo config `extra` (app.config.ts).
// No secrets here — only the API host + non-sensitive flags. Secrets live
// in the device secure store or are never on-device at all.

import Constants from 'expo-constants';

type Flavor = 'patient-public' | 'staff-internal';
type EnvTier = 'development' | 'staging' | 'production';

interface RxbdExtra {
  rxbdFlavor: Flavor;
  rxbdEnv: EnvTier;
  apiBaseUrl: string;
  sentryDsn: string;
}

const extra = (Constants.expoConfig?.extra ?? {}) as Partial<RxbdExtra>;

export const env = {
  flavor: (extra.rxbdFlavor ?? 'patient-public') as Flavor,
  tier: (extra.rxbdEnv ?? 'development') as EnvTier,
  apiBaseUrl: (extra.apiBaseUrl ?? 'http://localhost:3000').replace(/\/$/, ''),
  sentryDsn: extra.sentryDsn ?? '',
  isProduction: (extra.rxbdEnv ?? 'development') === 'production',
  isStaffBuild: (extra.rxbdFlavor ?? 'patient-public') === 'staff-internal',
} as const;

/** Absolute URL for an /api/v1 path. */
export function apiUrl(path: string): string {
  return `${env.apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}
