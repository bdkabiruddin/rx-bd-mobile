# 00 — Master Plan: rx.bd Enterprise Mobile

> The single source of truth for *what* we are building, *why*, and *in what order*. Deep
> detail lives in the numbered companion docs; this is the map and the contract.

---

## 1. Mission

Deliver an enterprise-grade, compliance-first mobile application for rx.bd that brings the
right slice of all twelve role portals to **Android phones, Android tablets, and iPads** —
fast on low-end devices, usable on intermittent Bangladeshi networks, fully bilingual
(EN / বাংলা), and safe enough to handle PHI under HIPAA technical safeguards, GDPR, and
BMDC/DGHS expectations.

The mobile app is a **new client of the existing rx.bd backend**, not a rewrite. The
backend is already mobile-ready (see §4). We add a native client; we change the backend
only where genuinely required, and only via `main` (never on this branch).

---

## 2. Locked decisions & rationale

### 2.1 Framework — React Native + Expo (TypeScript)
- **Maximal reuse** of rx.bd's existing investment: the OpenAPI spec generates a fully
  typed API client; the `{ en, bn }` i18n table shape ports directly; the `--rxbd-*`
  design tokens become a typed RN theme; Zod validation patterns and domain enums port
  with minimal change.
- **One codebase → three form factors.** Expo's responsive primitives + a master-detail
  layout system cover phone, Android tablet, and iPad without separate apps.
- **Enterprise-ready ecosystem:** `expo-secure-store` (Keychain/Keystore), `expo-local-authentication`
  (biometrics), `expo-notifications` (wraps FCM + APNs — which the backend already speaks),
  EAS Build/Submit/Update pipeline, certificate pinning, SQLite for offline.
- **Hiring:** the largest mobile talent pool in Bangladesh is React/React Native.

### 2.2 First-release scope — all personas in parallel
We build the **shared mobile shell once** (auth, session, navigation, theme, i18n, offline
engine, push, error model) and then deliver each persona's flows on top of it. "In
parallel" is scoped by the roadmap (doc 06): the shell + patient + doctor land in the first
production wave; pharmacy/lab/diagnostic/hospital/facility-staff and the admin-lite surface
follow in close succession on the same shell. Nothing is rebuilt per persona.

### 2.3 Offline — read cache + ONLINE-ONLY writes (revised 2026-06-14)
- **Reads:** every screen renders the last successfully-fetched payload from an encrypted
  on-device cache, with an explicit "stale / offline" indicator and background refresh.
- **Writes (add / edit / delete):** **online-only.** When offline, a mutation is refused
  with a clear "reconnect to make changes" prompt — never queued. The Idempotency-Key is
  still attached so a mid-request network drop + user retry cannot double-apply.
- **Why not a queued-write outbox** (the earlier plan): a deferred queue introduced real
  silent-loss vectors (a queued mutation rejected on later sync, or wiped on session
  revoke) and — decisively — **clinical mutations cannot be safely queued**: prescription
  sign, dispense, and allergy/dose checks rely on the server's authoritative, live safety
  interlocks; acting on stale offline state is unsafe. Online-only is simpler, loss-free,
  and clinically correct.
- **Future option:** selective offline writes MAY be added later for specific low-risk,
  non-clinical convenience actions (e.g. an appointment *request*, a personal vitals-diary
  entry) — explicitly per action, with conflict surfacing — never as a blanket default and
  never for clinical/financial/safety mutations. Details in doc 03 §Offline.

### 2.4 Distribution — public stores + enterprise/MDM
- **Patient app** → Google Play + Apple App Store, with the full health-data privacy
  review, data-safety forms, and store assets.
- **Staff/clinical apps** → internal/MDM track (Play internal/managed, Apple Business
  Manager / MDM) for facility-issued tablets and iPads, bypassing public review.
- **One codebase, build-time flavors** select persona bundles + distribution target.

---

## 3. Non-negotiable principles (the mobile engineering contract)

1. **The backend is the source of truth.** No business rules are re-implemented on the
   client. The client validates for UX; the server validates for correctness. No clinical
   decision (allergy, dose, interaction) is ever computed on-device as authoritative.
2. **PHI on device is encrypted, evictable, and minimized.** Tokens in the secure
   enclave; cached PHI in an encrypted store with TTL + remote-wipe; nothing sensitive in
   logs, analytics, or crash reports; screenshots blocked on PHI screens.
3. **Every write carries an Idempotency-Key.** Replays are safe by construction.
4. **Bilingual or it doesn't ship.** Every string resolves from a typed `{ en, bn }`
   table; numerals, dates (Asia/Dhaka), currency (৳ paisa), and phone (+880) are
   locale-aware. No hardcoded user-facing copy.
5. **Accessibility is a gate, not a nicety.** Screen-reader labels, AAA contrast on safety
   surfaces, dynamic type, and large touch targets (shared-tablet ward use).
6. **No fabricated data, ever.** Mirrors the web platform's hard rule — empty/loading/error
   states only; never demo values styled as real (a CRITICAL class in the 2026-06-11 audit).
7. **Backend changes flow through `main`** on their own branch (doc 07). The mobile branch
   never carries backend code.

---

## 4. Why the backend is already mobile-ready (de-risk summary)

Verified against the current `main`:

| Capability | Evidence | Mobile impact |
|---|---|---|
| Bearer-token auth (not cookie-only) | `auth/login` issues tokens for "Bearer-API consumers"; `auth/refresh` accepts the refresh token in the request body for API/CLI clients | **No backend auth change needed** — mobile uses bearer + body-refresh |
| Mobile push already modeled | `device-token.schemas.ts` = `enum(['ANDROID','IOS','WEB'])`; `POST /api/v1/me/notifications/push-tokens` | Register Expo/FCM/APNs tokens directly |
| Typed contract | `openapi:emit` build step → `developer/openapi.json` + `openapi.yaml` | Generate a typed API client; contract stays in lockstep |
| Two-key high-risk actions | 12 reverify intents (prescription-sign, controlled-substance dispense, death-cert issue, tenant lifecycle, …) | Mobile reuses the reverify token flow for sensitive mutations |
| Multi-branch / multi-department | `auth/my-branches`, `switch-branch`, `my-departments`, `switch-department` | Mobile session model mirrors web branch/department context |
| MFA, phone OTP, OAuth, sessions | `auth/mfa`, `auth/phone/otp/*`, `auth/oauth/*`, `auth/sessions` | Full mobile auth parity available |
| FHIR R4 + REST | `/api/v1/fhir/r4/*` + `/api/v1/*` | Standards-based clinical reads |

**Anticipated backend tasks for mobile** (each via its own branch → `main`): CORS/allowed
origins for the app's API host, a mobile minimum-version / force-upgrade endpoint, possibly
a slim "mobile home" aggregate endpoint per persona to cut round-trips, and push-payload
deep-link fields. None are blockers for starting the client. See doc 07.

---

## 5. Success criteria (definition of done for v1.0)

- ✅ Shared shell: bearer auth + biometric unlock + refresh rotation + MFA + reverify +
  multi-branch, all bilingual, all accessible.
- ✅ Patient + Doctor production flows shippable; remaining personas on the same shell in
  the published roadmap with no shell rework.
- ✅ Offline: read cache + queued-write replay proven on airplane-mode test scripts.
- ✅ Security: PHI encrypted at rest, screenshot-blocked PHI screens, cert pinning,
  root/jailbreak posture, remote wipe on logout/session-revoke — all verified.
- ✅ Push: FCM (Android) + APNs (iOS) delivering, deep-linking into the right screen.
- ✅ Tablet/iPad: master-detail layouts on ≥ sw600dp / iPad, not stretched phone UI.
- ✅ Compliance: data-safety/privacy forms, DSAR parity, audit trail of mobile PHI access.
- ✅ CI/CD: EAS pipeline green; public + MDM tracks producing signed builds; OTA policy
  documented and enforced (no native/clinical-logic changes via OTA).
- ✅ Quality gates: typecheck, lint, unit + component + E2E (Maestro) green on the device
  matrix; no fabricated data; coverage ratchet.

---

## 6. Roadmap at a glance (full detail in doc 06)

| Phase | Theme | Headline outcome |
|---|---|---|
| **P0** Foundations | Scaffold + shell + tooling | Expo app boots; typed API client; theme + i18n; CI on EAS |
| **P1** Secure session | Auth + security + offline core | Login→biometric→PHI screen, encrypted cache, queued writes |
| **P2** Patient + Doctor | First two personas to production | Appointments, prescriptions, lab results, queue, e-sign-lite |
| **P3** Facility personas | Pharmacy / Lab / Diagnostic / Hospital / Staff | Field + tablet workflows; dispense/sample/admission |
| **P4** Admin-lite + polish | Ops surface + a11y + perf | Approvals/notifications on the go; perf on low-end devices |
| **P5** Launch | Stores + MDM + monitoring | Public patient launch; MDM staff rollout; crash/perf dashboards |

---

## 7. How to use this plan

- Engineers: start at doc 01 (architecture) → 03 (auth/offline) before writing code.
- Security/compliance reviewers: doc 02 is the audit surface.
- PMs/leads: docs 06 (roadmap) + 08 (risks) drive sequencing and standups.
- Anyone touching the backend for mobile: doc 07 is mandatory.
