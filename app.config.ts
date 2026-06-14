// Expo app configuration — env- and flavor-driven.
//
// Two build flavors select persona bundles + distribution target:
//   - RXBD_FLAVOR=patient-public → patient app, public stores
//   - RXBD_FLAVOR=staff-internal → staff/clinical apps, enterprise/MDM
//
// API host + env tier come from EAS env / .env (never committed). See
// docs/05-delivery-cicd-testing.md.

import type { ExpoConfig, ConfigContext } from 'expo/config';

type Flavor = 'patient-public' | 'staff-internal';

const FLAVOR = (process.env.RXBD_FLAVOR as Flavor) ?? 'patient-public';
const ENV = process.env.RXBD_ENV ?? 'development';

const FLAVOR_META: Record<Flavor, { name: string; slug: string; androidPackage: string; iosBundle: string; scheme: string }> = {
  'patient-public': {
    name: 'rx.bd',
    slug: 'rxbd-patient',
    androidPackage: 'bd.rx.patient',
    iosBundle: 'bd.rx.patient',
    scheme: 'rxbd',
  },
  'staff-internal': {
    name: 'rx.bd Staff',
    slug: 'rxbd-staff',
    androidPackage: 'bd.rx.staff',
    iosBundle: 'bd.rx.staff',
    scheme: 'rxbdstaff',
  },
};

export default ({ config }: ConfigContext): ExpoConfig => {
  const meta = FLAVOR_META[FLAVOR];
  return {
    ...config,
    name: meta.name,
    slug: meta.slug,
    scheme: meta.scheme,
    version: '0.1.0',
    orientation: 'default', // tablets/iPad use landscape master-detail
    userInterfaceStyle: 'automatic',
    assetBundlePatterns: ['**/*'],
    ios: {
      bundleIdentifier: meta.iosBundle,
      supportsTablet: true, // iPad first-class
      config: { usesNonExemptEncryption: false },
      infoPlist: {
        // Privacy-blur on background + screenshot awareness handled at runtime.
        NSFaceIDUsageDescription:
          'Unlock rx.bd and approve sensitive clinical actions with Face ID.',
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: meta.androidPackage,
      // FLAG_SECURE on PHI screens is applied at runtime via expo-screen-capture.
      permissions: ['USE_BIOMETRIC', 'USE_FINGERPRINT', 'POST_NOTIFICATIONS'],
      blockedPermissions: [],
    },
    plugins: [
      'expo-router',
      'expo-secure-store',
      'expo-local-authentication',
      'expo-notifications',
      'expo-screen-capture',
      [
        'expo-build-properties',
        {
          android: { usesCleartextTraffic: false, allowBackup: false },
          ios: { },
        },
      ],
    ],
    extra: {
      rxbdFlavor: FLAVOR,
      rxbdEnv: ENV,
      // API base URL is injected per env via EAS secrets; never hardcoded here.
      apiBaseUrl: process.env.RXBD_API_BASE_URL ?? 'http://localhost:3000',
      sentryDsn: process.env.RXBD_SENTRY_DSN ?? '',
    },
    experiments: { typedRoutes: true },
  };
};
