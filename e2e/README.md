# E2E flows (Maestro)

Device-level end-to-end flows for the rx.bd mobile app. Maestro drives a real
build on an emulator/device or in CI (it is NOT run by `jest`).

## Run

```bash
# install Maestro once: https://maestro.mobile.dev
maestro test e2e/flows/
# or a single flow
maestro test e2e/flows/01-login-unlock-phi.yaml
```

These flows exercise the surfaces unit tests can't: biometric unlock,
SQLite-backed offline cache, screenshot guard, push deep-links, and the
online-only write policy (offline writes blocked, not queued). They are the verification of
record for the React Native / native binding layer (see docs/05 §5–6).

## Flows
- `01-login-unlock-phi.yaml` — login → MFA → biometric unlock → a PHI screen
  renders; backgrounding blurs; screenshots are blocked.
- `02-offline-writes-blocked.yaml` — go offline: reads render from cache, but
  an add/edit/delete attempt is BLOCKED with a reconnect prompt (online-only
  writes, no queue); the same action succeeds once back online.

## Env
Flows expect seeded test accounts + a reachable staging API. Credentials are
injected via Maestro env vars (never committed) — see each flow's `env:` block.
