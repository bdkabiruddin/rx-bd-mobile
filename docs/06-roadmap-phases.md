# 06 — Roadmap & Phases

> Sequencing for "all personas in parallel": build the shared shell **once**, then layer
> personas onto it. Patient + Doctor reach production first; the rest follow on the same
> shell with no rework. Durations are nominal engineering windows for a small focused team;
> compress with more parallel workstreams.

## Phase 0 — Foundations (shell + tooling)
**Outcome:** Expo app boots on all three form factors; typed API client; theme + i18n; EAS
pipeline; quality gates wired.
- Scaffold Expo + TypeScript + Expo Router (after dependency approval PR).
- Generate typed API client from `openapi.yaml`; build the fetch wrapper (bearer, refresh,
  idempotency, Result/ApiError error model).
- Port `--rxbd-*` tokens → typed RN theme; build core UI primitives; bilingual resolver +
  Dhaka/৳/+880 formatters.
- EAS profiles (dev/preview/staging/prod-patient/prod-staff); Sentry; lints; Maestro smoke.
**Exit:** "hello, authenticated ping" build runs on a low-end Android + an iPad; CI gates green.

## Phase 1 — Secure session & offline core
**Outcome:** the security + offline backbone every persona depends on.
- Login (password + MFA + phone OTP + OAuth) → secure-store tokens → refresh rotation
  (single-flight) → biometric app-lock + idle timeout.
- Two-key reverify step-up wired to the 12 intents.
- Multi-branch/department context + switchers.
- Offline: encrypted read cache + freshness badges; durable write outbox + idempotency +
  connectivity-driven replay + conflict surface.
- Security hardening: cert pinning, screenshot guard, background blur, root/jailbreak
  posture, remote-wipe on revoke; no-PHI-in-logs lint.
**Exit:** login→biometric→PHI screen; book-offline→reconnect→single effect proven;
pen-test-lite checklist green.

## Phase 2 — Patient + Doctor to production
**Outcome:** first two personas shippable.
- **Patient:** appointments (book/reschedule/cancel), prescriptions + medications, lab
  results, live queue position, vitals diary, notifications, profile, billing/pay status,
  DSAR entry.
- **Doctor:** schedule, chamber queue (call-next/complete), patient summary, prescribe +
  **e-sign (reverify)**, referrals/certificates (+cancel), lab orders.
- Push deep-linking into the right screen; tablet master-detail for doctor.
**Exit:** end-to-end Maestro flows green on device matrix; store/MDM internal builds out to
pilot users; no fabricated data; a11y + bilingual gates pass.

## Phase 3 — Facility personas
**Outcome:** the tablet-first operational apps on the same shell.
- **Pharmacy:** dispense queue + prescription validation + dispense record + deliveries
  (OTP) + refill approvals (controlled-substance reverify).
- **Lab / Diagnostic:** worklist, sample collection/accession, result entry, report
  release, QC view.
- **Hospital:** admissions board, ward/bed status, nursing notes (append-only), discharge
  planning, shifts.
- **Facility staff / Assistant / Delivery couriers:** branch-scoped queues, triage,
  chain-of-custody.
**Exit:** each persona's field flow validated on a 7–10" tablet/iPad; offline tested for
the realistic disconnected cases.

## Phase 4 — Admin-lite + polish
**Outcome:** on-the-go ops + production-grade quality.
- **Admin-lite:** approvals (grants, doctor-verification), notifications, break-glass
  review, incident acknowledge (with `ADMIN_*` reverify) — the operational subset, not the
  full console.
- **Vendor:** claims/agreements/commissions view.
- Performance pass on low-end Android (cold-start, TTI, memory); a11y audit; Bangla
  rendering polish; battery/data-usage tuning.
**Exit:** perf budgets met on the anchor low-end device; full a11y + bilingual audit green.

## Phase 5 — Launch & operate
**Outcome:** public + internal rollout under monitoring.
- Public **patient** launch (Play + App Store) with staged rollout; data-safety/privacy
  reviews cleared.
- **Staff/clinical** MDM rollout to facility fleets.
- Full pen-test sign-off; crash-free-session + perf dashboards live; OTA train established;
  force-upgrade endpoint enforced.
**Exit:** v1.0 GA; on-call + release runbook in place.

## Workstreams → team mapping
| Workstream | Owns | Phases |
|---|---|---|
| WS-Shell | Expo shell, navigation, theme, i18n, primitives | P0, ongoing |
| WS-Security | auth, secure store, biometric, reverify, pinning, hardening | P1, ongoing |
| WS-Offline | cache, outbox, sync, conflict UX | P1, ongoing |
| WS-Patient | patient features | P2 |
| WS-Clinical | doctor + facility personas | P2–P3 |
| WS-Platform | EAS, CI/CD, distribution, observability, backend-task liaison (doc 07) | all |
| WS-QA | unit/component/E2E, device matrix, gates, pen-test coordination | all |

## Dependencies & ordering rules
- No persona work starts before WS-Shell + WS-Security + WS-Offline reach their Phase-1
  exit (the shell must be real first).
- Any backend gap discovered mid-phase → a backend task on its own branch → `main` (doc 07);
  mobile mocks the contract from the agreed OpenAPI delta until it merges, then pulls.
