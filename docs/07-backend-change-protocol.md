# 07 — Backend-Change Protocol (for mobile)

The mobile app is a client. When it needs the backend to change, that change is a
**first-class rx.bd backend task** and follows the normal `main` workflow — it never lands
on the `mobile-app` branch.

## The rule

```
Need a backend change for mobile?
  1. git fetch origin && git checkout -b feat/<scope> origin/main   # fresh from latest main
  2. implement on src/ with the platform's standards (defineRoute, Result/ApiError,
     RLS/tenant scoping, audit, Zod, tests, conventional commits)
  3. open a PR → review → merge to main
  4. on the mobile-app branch:  git merge origin/main   # pull the new contract down
```

- Backend code lives only under `src/` on `main`. The `mobile-app` branch carries only
  `mobile-app/`.
- The OpenAPI spec is the contract boundary. A backend PR that changes the mobile-facing
  API **must** keep `openapi:emit` output current; mobile regenerates its client after the
  merge.
- While the backend PR is in flight, mobile may develop against the **agreed OpenAPI delta**
  (a typed mock), then swap to the real endpoint once merged and pulled.

## Anticipated backend tasks (each its own branch → main)

> None block starting the client; the existing surface covers the bulk of v1.

| Task | Why | Notes |
|---|---|---|
| **CORS / allowed origins** for the mobile API host(s) | Native fetch + any web-view bits | Small config; verify bearer-from-mobile works end-to-end |
| **Minimum-supported-version / force-upgrade** endpoint | Security-critical upgrade enforcement | `GET /api/v1/mobile/min-version` returning per-platform floors |
| **Push deep-link payload fields** | Route a notification to the exact screen | Add `deepLink`/`resourceType`/`resourceId` to notification payload (generic title; no PHI in body) |
| **Slim per-persona "mobile home" aggregate** (optional) | Cut N round-trips on the dashboard over 2G/3G | e.g. `GET /api/v1/patient/home` returning the home bundle; read-only, cache-friendly |
| **Device-token niceties** (optional) | Expo token format / token TTL housekeeping | Existing `push-tokens` route already accepts ANDROID/IOS |
| **DSAR/erasure "wipe device cache" signal** (optional) | GDPR erasure should invalidate mobile cache | A session-revoke / cache-bust flag the app honors |

Each must respect every platform hard rule (encryption, audit, RLS/tenant scoping, consent,
no PHI in logs) — same as any other backend change. Clinical-safety-adjacent endpoints need
the usual reviewer sign-off.

## What is NOT a backend task
- UI, layout, offline behavior, token storage, biometric, theming, i18n copy — all
  client-side, all on the `mobile-app` branch.
- Re-implementing server validation on the client — forbidden (server is authoritative).

## Traceability
Every backend task spawned for mobile is logged here (append a row) with its branch, PR,
and the mobile feature that required it, so the mobile↔backend dependency is auditable.

| Date | Backend branch | PR | Merged | Mobile feature that needed it |
|---|---|---|---|---|
| _(none yet)_ | | | | |
