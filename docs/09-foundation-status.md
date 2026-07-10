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
- **Data-loss audit (2026-06-14)** — closed three in-progress-input loss vectors:
  (C.1) idle-lock now renders a LockOverlay instead of navigating, so form state
  survives lock/unlock; (C.2) stable idempotency key (client retry + useWrite)
  so a lost-response + retry can't duplicate; (C.3) useDraft autosaves
  encrypted form drafts surviving app-kill/background. useWrite + useDraft are
  mandatory for Phase-2 forms. See doc 03 §C.
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

---

# Phase 2 progress (2026-07-10) — patient persona complete; doctor 4/6

Built as a 16-workstream parallel build; 12 workstreams completed before an
owner-requested stop. Whole-project gates green at this point:
**tsc 0 errors · eslint 0 · jest 264/264 across 16 suites.** Every endpoint
used was verified against `openapi.yaml` and its payload shape mirrored from
the backend module source; where the contract fell short the feature ships
the honest subset and the miss is recorded below (no invented endpoints, no
fabricated data anywhere).

## Landed

**Shell additions** — session claims now carry `userId` (JWT `sub`) +
`tenantId`; patient/doctor tab navigators + hub screens; shared primitives
`ListRow`, `StatusPill`, `SectionHeader`, `TextField`, and the tablet
contract `useBreakpoint` + `MasterDetail`.

**Patient (all 8 features)**
| Feature | Screens | Notes |
|---|---|---|
| Appointments | list (upcoming/past), detail, cancel/reschedule, 4-step booking | doctor discovery is specialty-driven (no name-search endpoint) |
| Meds | prescriptions list/detail, current medications, reminders | reminders are POST-upsert keyed on prescriptionId |
| Labs | orders list, detail + released results | patient ack omitted (endpoint is doctor-gated) |
| Vitals diary | day-grouped history, add-reading with plausibility bands | celsius/mg-dL pinned (backend bands are unit-agnostic) |
| Live queue | 20s focus-scoped poll, chamber discovery chain | walk-ins not discoverable (no /me/queue-positions) |
| Notifications | inbox + read, preferences/quiet-hours/opt-outs | opt-out registry is one-way by design |
| Profile + DSAR | summary, edit (MPI duplicate notice), allergies, privacy/DSAR + access log | identifiers masked client-side |
| Billing | invoices list/detail, payments, balance — view-only | no invoiceNumber/facility name on the wire |

**Doctor (4 of 6 features)**
| Feature | Screens | Notes |
|---|---|---|
| Today + schedule | landing, weekly/recurring/blocks management | "Remaining appointments today" (no full-day endpoint) |
| Chamber queue | live 15s poll, call-next / complete / no-show | 2 requests/tick (no combined projection); skip unsupported server-side |
| Patients | id-search + panel, allergies-first summary bundle, tablet master-detail | list rows initials-only by PHI design |
| Prescribe + e-sign | allergy banner, item composer, templates, dry-run interlock, draft→two-key sign | blocking findings block sign — no client override path (safetyOverride deliberately not implemented) |

## Not built (stopped before start)
- **Doctor referrals + medical certificates** (partial files removed cleanly).
- **Doctor lab orders + results inbox.**
- **Push deep-linking** — Phase-1 token registration (`src/push/register.ts`)
  stands; notification-tap → route mapping was never started.
- Doctor-queue tablet master-detail adoption (small follow-up now that
  `MasterDetail` exists).

## Shared-seam follow-ups
- `src/i18n/formatters.ts`: add a Dhaka time-only `formatTime` — three
  features shipped local copies pending consolidation.
- `src/auth/reverifiedAction.ts`: optional body-token field (e.g.
  `tokenBodyField`) for `enforcedInHandler` sign-style routes;
  prescribe composes the identical flow feature-locally today.
- `e2e/flows/02-offline-writes-blocked.yaml`: booking choreography needs the
  4-step wizard steps (screens expose the expected testIDs already).

## Backend needs discovered (doc-07 candidates)
Verified against backend source during the build; each goes to `main` on its
own branch per `docs/07-backend-change-protocol.md`.

**Spec / contract mismatches**
1. `POST /auth/reverify` is implemented and used but **missing from
   `openapi.yaml`**.
2. `POST /prescriptions/{id}/sign` takes `reverifyToken` in the **body**
   while the platform convention is the `x-reverify-token` header.
3. `POST /me/refills/reorder` accepts source status `COMPLETED|EXPIRED`, but
   `COMPLETED` is not a `PrescriptionStatus` member — `DISPENSED` courses can
   never be reordered.
4. Web `QueuePositionWidget` gates on `facilityType === 'CHAMBER'`, which is
   absent from `AppointmentFacilityType` — likely never fires for
   standalone-chamber bookings (same ambiguity found from mobile).
5. `GET /me/allergies` applies the TREATMENT consent gate to the patient's
   own self-read (unlike `GetMyPatientProfile`'s self-bypass) — a fresh
   patient can 403 on their own allergy list.

**Display-name / projection gaps** (rows can't show names without N+1)
6. Prescription list/detail: no prescriber display name (`prescribingDoctorUserId` only).
7. Doctor appointment projections: no patient display name; no chamber/room name.
8. `GET /appointments/{id}`: detail omits the resolved doctorName/chamberName the list has.
9. `PrescriptionListView`: metadata-only — no drug names/summary for either persona.
10. Lab orders: no ordering-doctor or centre display names; patient results
    don't project the doctor's `doctorNote`.
11. Invoices: no human-readable `invoiceNumber`, no facility/branch name.
12. Prescription templates: items carry ids only — applying a template forces
    a full drug-catalog fetch to resolve names.

**Missing endpoints / operations**
13. No patient-facing `GET /me/queue-positions` (active entries + chamber
    ids) — the queue screen fans out up to 10 discovery requests/tick and
    cannot discover walk-ins.
14. No combined doctor-queue projection (now-serving + ready + chamber name).
15. No skip / return-to-queue queue transition (IN_CONSULTATION → DOCTOR_READY).
16. No DELETE/unblock for `doctor_schedule_blocks`; recurring schedule write
    is whole-set replace.
17. No patient amend/delete for own vitals despite the AMENDED domain status.
18. No patient-readable single lab-order GET; patient result-acknowledge
    endpoint absent (doctor-only today).
19. No doctor name/phone patient-search surface (HMAC `_hash` columns exist;
    handler matches patientId substrings only).
20. No free-text doctor search for booking (specialty-driven only).
21. No mark-all-read for notifications; no self-service opt-in restore
    (append-only registry); notification content is single-language.
22. No masked server projection for `GET /me/patient-profile`
    (nationalId/birthRegNo/healthId arrive decrypted; app masks client-side).
23. `GET /patients/{id}/appointments` lacks date/status filters (cap 200).
24. Vitals plausibility bands are unit-agnostic (°F / mmol/L can never pass).
25. Deferred backend crons noted on routes: medication-reminder delivery
    (RT-343), notification digests (RT-313); reminder schedules manage-only
    until they ship.

**Deferred client capabilities (need product/backend decisions)**
26. Prescription PDF download/share (authenticated binary pipeline).
27. `signatureProof` initials-capture for prescription sign (R-90 phase-1
    evidence recipe documented in the sign schema).
28. Dry-run `patientContext` (pregnancy/G6PD/renal/hepatic) + lactation not
    collected on mobile — server fail-closed UNKNOWN keeps previews
    conservative.
29. Reminders for OTC/self-recorded medications (no sourcePrescriptionId).
30. Patient-facing MPI duplicate follow-up (link/merge is admin-only).
