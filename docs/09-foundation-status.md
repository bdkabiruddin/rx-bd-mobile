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
| Offline | `offline/{codec,encryptionKey,db,cache,outbox,connectivity,sync,submit,wipe}.ts` | Fail-closed PHI codec; SQLite cache+outbox; idempotent queued-write replay; conflict surface |
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

## Verification status (honest)
- **Not yet typechecked / linted / tested in this environment** — the Expo
  toolchain and dependencies are not installed (the sandbox cannot install
  the RN/Expo native toolchain, and per the rx.bd rule deps need owner
  approval first). The code is written to compile under the manifest's
  versions; the first post-approval step is `npm install` →
  `npm run typecheck && npm test`.
- The three unit suites are designed to pass in Node (no native deps).
- Native-binding modules (secure store, sqlite, biometric, screen-capture,
  push) are written against the documented Expo APIs; they exercise on device
  via Maestro flows in Phase 1.

## Immediate next steps (Phase 0 → 1)
1. Owner approves `package.json`; run `npx create-expo-app . ` reconcile +
   `npx expo install` to pin native versions, then `npm install`.
2. `npm run api:generate` to emit the typed client from `openapi.yaml`.
3. Wire a real AES-256-GCM `Codec` (SQLCipher DB key + value codec) into
   boot — until then the cache is fail-closed.
4. `npm run typecheck && npm test`; add Maestro smoke (login→unlock→PHI).
5. Build the remaining auth surfaces (phone-OTP, OAuth, MFA screen) and the
   branch/department switchers.

## Traceability
Backend stays unchanged so far. Any backend need that surfaces during
integration goes through `docs/07-backend-change-protocol.md` (separate
branch → main), e.g. confirming the MFA interim-token contract and the
push deep-link payload fields.
