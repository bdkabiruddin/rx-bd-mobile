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
queued-write → reconnect → exactly-once path. They are the verification of
record for the React Native / native binding layer (see docs/05 §5–6).

## Flows
- `01-login-unlock-phi.yaml` — login → MFA → biometric unlock → a PHI screen
  renders; backgrounding blurs; screenshots are blocked.
- `02-offline-booking-sync.yaml` — go offline, queue an appointment booking,
  reconnect, assert exactly one server-side effect (idempotency proven) and
  the freshness badge transitions.

## Env
Flows expect seeded test accounts + a reachable staging API. Credentials are
injected via Maestro env vars (never committed) — see each flow's `env:` block.
