# 01 — Architecture

## 1. High-level shape

```
┌─────────────────────────────────────────────────────────────────┐
│  rx.bd Mobile (Expo / React Native / TypeScript)                 │
│                                                                  │
│  app/            Expo Router screens (file-based, per persona)   │
│  src/                                                             │
│    api/          generated OpenAPI client + typed hooks          │
│    auth/         session store, token refresh, biometric, MFA    │
│    offline/      encrypted cache + write outbox + sync engine    │
│    ui/           design-system primitives (tokens → RN)          │
│    i18n/         { en, bn } tables + formatters (Dhaka/৳/+880)   │
│    features/     per-persona feature modules                     │
│    security/     secure store, cert pinning, screenshot guard    │
│    push/         expo-notifications registration + routing       │
│    config/       env, flavors, feature flags                     │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTPS (bearer + Idempotency-Key)
                            ▼
        rx.bd backend  /api/v1/*  +  /api/v1/fhir/r4/*   (unchanged)
```

The app talks to the **same `/api/v1/*` REST + FHIR surface** the web portals use. There is
no mobile-specific backend tier; where round-trips hurt, we add slim aggregate endpoints on
`main` (doc 07), not a separate BFF.

## 2. Code-reuse strategy with rx.bd (the important decision)

We deliberately **do not** import `src/` source directly into the RN app. Next.js/RN module
resolution, server-only imports, and bundler differences make direct source sharing fragile.
Instead we reuse via **stable, generated, or copied artifacts**:

| Reuse vector | Mechanism | Why robust |
|---|---|---|
| **API types + client** | Generate from `developer/openapi.json` (`openapi:emit` already exists) into `src/api/generated/` using `openapi-typescript` + a thin fetch client | Single contract; regenerated in CI; zero hand-maintained DTOs |
| **i18n shape** | Port the `{ en, bn }` table convention; mobile keeps its own tables (screens differ) but identical structure + Dhaka/৳/+880 formatters | Small, stable, screen-specific copy anyway |
| **Design tokens** | Transpile `--rxbd-*` CSS variables into a typed RN theme object (`src/ui/tokens.ts`), preserving the locked safety colors | Tokens change rarely; a generator script keeps them in sync |
| **Domain enums/constants** | Copy truly-shared, pure constants (e.g. reverify intents, role keys, status enums) into `src/config/domain.ts`; later optionally extract a tiny `@rxbd/shared` package | No runtime/server deps; safe to duplicate the few that matter |

> Rule: the **OpenAPI client is the contract**. If the app needs a field the spec doesn't
> describe, that's a backend task (doc 07), not a client-side cast.

## 3. Project structure (target)

```
mobile-app/
  app.config.ts            # Expo config (flavors, env-driven)
  eas.json                 # EAS build/submit/update profiles
  package.json             # isolated; own deps
  tsconfig.json            # strict; path aliases
  app/                     # Expo Router
    (auth)/                # login, mfa, otp, biometric-unlock
    (patient)/             # patient tab stack
    (doctor)/              # doctor tab stack
    (pharmacy)/ (lab)/ ... # one group per persona
    _layout.tsx            # root: theme, i18n, session gate, push
  src/
    api/
      generated/           # codegen output (gitignored or committed-pinned)
      client.ts            # fetch wrapper: bearer, refresh, idempotency, errors
      hooks/               # TanStack Query hooks per resource
    auth/
      sessionStore.ts      # tokens, role, branch/department, MFA state
      refresh.ts           # rotation; single-flight; logout on hard-fail
      biometric.ts         # app-unlock + step-up
      reverify.ts          # two-key intents → reverify token
    offline/
      cache.ts             # encrypted read cache (SQLite/MMKV + crypto)
      outbox.ts            # durable queued writes + idempotency keys
      sync.ts              # connectivity-driven replay + conflict surface
    ui/                    # Button, Field, Card, RxRow, EmptyState, ...
    i18n/
    features/<persona>/<domain>/
    security/
    push/
    config/
  __tests__/ , e2e/        # unit/component (Jest+RNTL) + Maestro flows
```

## 4. Core libraries (proposed; all need the standard dependency-approval step)

| Concern | Library | Note |
|---|---|---|
| App framework | **Expo (SDK latest stable)** + **Expo Router** | file-based nav, deep links, universal |
| Data fetching/cache | **TanStack Query** | retry, stale-while-revalidate, pairs with offline cache |
| Local persistence | **expo-sqlite** (+ **op-sqlite** if perf-critical) / **MMKV** | encrypted cache + outbox |
| Secure secrets | **expo-secure-store** | Keychain (iOS) / Keystore (Android) for tokens |
| Biometrics | **expo-local-authentication** | app-unlock + step-up reverify |
| Push | **expo-notifications** | wraps FCM + APNs (backend already speaks both) |
| Forms/validation | **react-hook-form** + **zod** | mirrors backend Zod patterns |
| State (non-server) | **Zustand** | session + UI state; minimal |
| Styling | tokens → **StyleSheet** / **Unistyles** | typed theme from `--rxbd-*` |
| Crypto (cache key) | **expo-crypto** + device keystore | encrypt cached PHI |
| Cert pinning | **react-native-ssl-pinning** or Expo config plugin | pin rx.bd API certs |
| i18n | lightweight `{ en, bn }` resolver (no heavy lib) | matches web convention |
| Crash/analytics | **Sentry (PHI-scrubbed)** | mirror web's masking discipline |
| E2E | **Maestro** | fast, CI-friendly device flows |

## 5. Bootstrapping (run on approval — do NOT run without dependency sign-off)

```bash
# from repo root, on the mobile-app branch
cd mobile-app
# 1) scaffold an Expo + TypeScript app IN PLACE (no extra nested folder)
npx create-expo-app@latest . --template expo-template-blank-typescript
# 2) add Expo Router + the approved libraries (list pinned in package.json PR)
npx expo install expo-router expo-secure-store expo-local-authentication \
    expo-notifications expo-sqlite expo-crypto
#    + TanStack Query, zustand, react-hook-form, zod, sentry-expo, maestro (dev)
# 3) generate the typed API client from the backend spec
#    (committed copy of developer/openapi.json or a fetch from a running API)
npx openapi-typescript ../src/app/api/v1/openapi.yaml -o src/api/generated/schema.ts
# 4) configure EAS
npx eas-cli@latest init
```

> The exact pinned dependency set ships as the **first PR on the `mobile-app` branch** so
> the owner approves the dependency list explicitly (rx.bd rule: no new deps without
> approval). Nothing is installed before that approval.

## 6. Environments & flavors

- **Flavors** (build-time): `patient-public`, `staff-internal` — select persona bundles +
  distribution target + app id/icon.
- **Env tiers**: `local`, `staging`, `production` API hosts via `app.config.ts` + EAS
  secrets. No secrets in the repo (`.env*` gitignored; `.env.example` documents keys).
- **Feature flags**: a small remote-config check at boot (reuse backend feature-flag
  surface if exposed) gates risky features without a store release.

## 7. Why not a monorepo merge with `src/`

Considered and rejected for v1: pulling the RN app into the Next.js pnpm workspace couples
two very different toolchains, risks server-only code leaking into the bundle, and
complicates the "never merge to main" isolation. The generated-client + token-generator
approach gives ~90% of the reuse benefit with none of the coupling. A small `@rxbd/shared`
package can be extracted later if duplication of pure constants becomes painful.
