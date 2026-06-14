# 05 — Delivery: CI/CD, Distribution & Testing

## 1. Build & release pipeline (EAS)

| Stage | Tool | Output |
|---|---|---|
| Build | **EAS Build** | Signed Android `.aab`/`.apk` + iOS `.ipa`, per flavor + env |
| Submit | **EAS Submit** | Play Console + App Store Connect uploads |
| OTA | **EAS Update** | JS-only over-the-air updates **within policy** (see §3) |
| Signing | EAS-managed credentials / Apple + Google keystores | Keys never in repo |

Profiles in `eas.json`: `development` (dev client), `preview` (internal QA), `staging`,
`production-patient` (public), `production-staff` (MDM/internal).

## 2. Dual distribution (decision: both)

### Patient app — public stores
- **Google Play:** production + internal/closed testing tracks; Data safety form; health
  declarations; staged rollout.
- **Apple App Store:** TestFlight → review → release; Privacy Nutrition Labels; health/
  medical guideline compliance.
- Store assets (icons, screenshots, descriptions) bilingual EN/বাংলা.

### Staff/clinical/admin apps — enterprise/MDM
- **Android:** Play **managed** distribution / private app, or MDM (Intune, etc.) push to
  facility-issued tablets; or internal App Sharing for closed pilots.
- **iOS:** Apple Business Manager + MDM for iPad fleets (custom apps / managed
  distribution), bypassing public review.
- Device enrollment, kiosk/single-app mode for shared ward tablets where appropriate.

## 3. OTA update policy (healthcare-safe)
- **Allowed via OTA (EAS Update):** JS/UI bug fixes, copy/i18n, non-clinical tweaks.
- **NOT allowed via OTA — requires a full store/MDM build:** any change to native modules,
  permissions, security posture (pinning, secure store), or **anything affecting clinical
  logic/flows**. (Clinical correctness lives server-side anyway; the client must not OTA a
  behavioral change to a safety flow.)
- OTA channel pinned per release train; rollback supported; update prompts respect the
  force-upgrade endpoint (a backend task — doc 07).

## 4. Versioning & force-upgrade
- SemVer; build number auto-incremented by EAS.
- Boot-time **minimum-supported-version** check (backend endpoint) → soft prompt or hard
  block for security-critical upgrades.

## 5. Testing strategy

| Layer | Tooling | Scope |
|---|---|---|
| Unit | **Jest** | formatters (৳/Dhaka/+880), token/refresh logic, outbox/idempotency, reducers |
| Component | **React Native Testing Library** | primitives, screens, bilingual render, a11y labels |
| Contract | generated client vs OpenAPI | fail CI if the app uses a field the spec dropped |
| E2E | **Maestro** | login→biometric→PHI, book-appointment offline→sync, prescribe→reverify, deep-link from push |
| Security | SAST + dep-CVE + custom lints | no-PHI-in-logs, screenshot-guard present, no secrets |
| Manual | device matrix (§6) | gestures, perf, Bangla rendering, tablet master-detail |

### Quality gates (block merge on the `mobile-app` branch)
- `tsc --noEmit` clean · ESLint clean · Jest + RNTL green · Maestro smoke green ·
  no-fabricated-data lint · no-PHI-in-logs lint · coverage ratchet (non-decreasing).

## 6. Device matrix (Bangladesh-representative)
- **Android low-end:** 2–3 GB RAM, Android 10–12 (the volume market) — perf budget anchor.
- **Android mid + tablet:** Android 13+, 7–10" tablet (nursing-station class).
- **iOS:** a current iPhone + an **iPad** (patient iOS minority, but iPad matters for
  clinical/facility staff per the brief).
- Network conditions: 2G/3G throttle, high-latency, packet-loss, airplane mode.

## 7. Observability
- **Sentry (PHI-scrubbed):** crashes, JS errors, performance traces, release health.
- App-level metrics: cold-start time, screen TTI, API error rates, offline-queue depth,
  OTA adoption — surfaced on a dashboard; alert thresholds for crash-free-sessions.

## 8. CI note (account constraint)
GitHub Actions is currently blocked at the rx.bd account level (per the platform audit), so
remote CI may not execute until the owner unblocks it. **All gates above run locally and on
EAS**; the GitHub workflow files land ready-to-run. EAS Build/Submit run on Expo's
infrastructure independent of GitHub Actions, so the build pipeline is not blocked.
