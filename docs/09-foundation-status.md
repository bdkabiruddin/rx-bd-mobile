# 09 — Foundation Status (Phase 0 source)

This records the Phase-0 foundation source authored on the `mobile-app`
branch. It is **real, reviewable TypeScript** that slots into the Expo
project once the dependency manifest is approved and installed.

## What was built

### Project & tooling
- `package.json` — the **dependency-approval manifest** (Expo SDK 53 / RN 0.79
  target). Nothing installed yet.
- `app.config.ts` — env- + flavor-driven Expo config (patient-public /
  staff-internal; iPad `supportsTablet`; secure Android defaults).
- `eas.json` — build/submit/update profiles incl. `production-patient`
  (public) and `production-staff` (MDM/internal).
- `tsconfig.json` (strict + path aliases), `babel.config.js`,
  `jest.config.js`, `eslint.config.mjs`, `.env.example`, `.gitignore`,
  `expo-env.d.ts`, `scripts/generate-tokens.mjs`.

### Core shell (`src/`)
| Area | Files | Notes |
|---|---|---|
| Config | `config/env.ts`, `config/domain.ts` | API host; reverify intents, role keys, persona routing (mirrored from backend) |
| Design | `ui/tokens.ts`, `ui/theme.ts` | Faithful `--rxbd-*` port; locked safety colors; light/dark |
| i18n | `i18n/{types,formatters,strings,index}.ts` | `{en,bn}` resolver; Dhaka/৳-paisa/+880/freshness formatters |
| API | `api/{errors,idempotency,client,useCachedQuery}.ts` | Result/ApiError model; bearer + single-flight refresh + idempotency; cached-query read hook |
| Auth | `auth/{secureStore,sessionStore,refresh,biometric,reverify,jwt,boot}.ts` | Secure-enclave tokens; login/MFA; biometric lock + step-up; reverify; hard-logout wipe |
| Offline | `offline/{codec,encryptionKey,db,cache,connectivity,init,submit,wipe}.ts` | Fail-closed PHI codec; encrypted SQLite read cache; **online-only writes** (`submitWrite` — offline blocked, not queued) |
| Security | `security/screenshotGuard.tsx` | FLAG_SECURE / screen-capture block for PHI screens |
| Push | `push/register.ts` | FCM/APNs device-token registration to the existing backend route |
| UI | `ui/{Button,FreshnessBadge,EmptyState,OfflineBanner,ScreenScaffold}.tsx` | Token-driven, accessible, min-48dp, never-fabricated empty states |

### App shell (`app/` — Expo Router)
- `_layout.tsx` — providers + boot (auth bridge, connectivity, sync, hydrate,
  AppState idle-lock) + the session-gate router.
- `index.tsx` splash · `(auth)/login.tsx` · `(auth)/unlock.tsx` ·
  `(patient)/index.tsx` (example wiring the full read stack with PHI guard).

### Tests (`__tests__/`)
- `formatters.test.ts`, `errors.test.ts`, `jwt.test.ts` — pure-logic, run in
  Node once jest is installed.

## Verification status (VERIFIED ✅)
Dependencies were installed and the foundation verified in-repo against the
real **Expo SDK 56** toolchain (React 19.2, RN 0.85):

- **`tsc --noEmit` → 0 errors** (strict, `exactOptionalPropertyTypes`,
  `noUncheckedIndexedAccess`).
- **`jest` → 11/11 passing** across 3 suites (formatters, error model, JWT
  decode) under a fast Node project (the jest-expo preset is reserved for
  `*.test.tsx` component suites).
- **`eslint .` → 0 errors** (Expo flat config + React-compiler purity rules).
- **`npm run api:generate` → typed client generated** from the repo-root
  `openapi.yaml` (551 routes, ~50k LOC). Gitignored; regenerated on demand.

Toolchain notes captured for reproducibility:
- `.npmrc` sets `legacy-peer-deps=true` — resolves an expo-router *web*
  react/react-dom transitive peer mismatch (does not affect the native app).
- `overrides` pin `jest-util`/`jest-mock`/`jest-snapshot` to 30.4.1 (a jest
  29 util leaked from jest-expo's bundled watch plugin).
- ESLint pinned to 9.x (eslint-plugin-react isn't ESLint-10-compatible yet).
- `package-lock.json` committed for reproducible installs.

Native-binding modules (secure store, sqlite, biometric, screen-capture,
push) compile and typecheck against the real Expo APIs; they exercise on
device via Maestro flows in Phase 1 (a device/emulator, not available in
this sandbox).

## Immediate next steps (Phase 0 → 1)
1. Owner approves `package.json`; run `npx create-expo-app . ` reconcile +
   `npx expo install` to pin native versions, then `npm install`.
2. `npm run api:generate` to emit the typed client from `openapi.yaml`.
3. Wire a real AES-256-GCM `Codec` (SQLCipher DB key + value codec) into
   boot — until then the cache is fail-closed.
4. `npm run typecheck && npm test`; add Maestro smoke (login→unlock→PHI).
5. Build the remaining auth surfaces (phone-OTP, OAuth, MFA screen) and the
   branch/department switchers.

## Phase 1 progress (in flight)

Landed on top of the verified foundation (all gates still green: tsc 0,
eslint 0, jest 15/15):

- **Real AES-256-GCM codec** (`offline/aesCodec.ts`) — Web Crypto, per-message
  random IV, authenticated (GCM). Decoupled from native key fetch so it is
  unit-tested under Node: **4 codec tests** prove round-trip, IV randomness,
  tamper-detection, and wrong-key rejection. `offline/init.ts` fetches the
  secure-enclave key and installs it at boot (`app/_layout.tsx`), so the cache
  leaves fail-closed mode on a real device while staying fail-closed if
  SubtleCrypto is ever unavailable.
- **Codec is now async** end-to-end; `cache.ts` awaits it.
- **Offline writes revised → ONLINE-ONLY (2026-06-14).** Removed the write
  outbox + sync engine; add/edit/delete are blocked offline with a reconnect
  prompt (never queued). Eliminates silent-loss vectors and is mandatory for
  clinical safety (server holds the live interlocks). Reads still cached.
  See doc 00 §2.3 / doc 03 §B.
- **MFA screen** (`app/(auth)/mfa.tsx`) — completes the login→MFA→session flow.
- **Multi-branch/department context** (`auth/context.ts`) — fetch my-branches /
  my-departments and switch (re-issues tokens); `ui/BranchSwitcher.tsx` shows
  only for multi-branch users (mirrors the web rule).
- **Maestro E2E flows** (`e2e/flows/`) — `01-login-unlock-phi`,
  `02-offline-writes-blocked` (offline write blocked → reconnect → succeeds). These
  run on device/CI, not jest.

### Component-test note
RNTL component tests (`*.test.tsx`) are **deferred**: jest-expo (SDK 56) + jest
30 + the new-arch "winter" runtime trips jest's module-scope guard on the lazy
global `fetch`. RNTL + `test-renderer` are installed for when that upstream
issue is fixed; until then the RN component/native surface is covered by the
Maestro flows. The jest gate runs the fast Node logic suites (incl. the AES
codec).

## Remaining Phase 1 / Phase 2 next steps
- Phone-OTP + OAuth login surfaces; reverify step-up UI for the 12 intents.
- Resolve the RNTL/jest-expo winter-runtime issue (or pin a compatible combo)
  and add component tests.
- Patient + Doctor feature screens (Phase 2) on this shell.

## Traceability
Backend stays unchanged so far. Any backend need that surfaces during
integration goes through `docs/07-backend-change-protocol.md` (separate
branch → main), e.g. confirming the MFA interim-token contract and the
push deep-link payload fields.
