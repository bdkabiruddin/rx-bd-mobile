# rx.bd Mobile — `mobile-app/`

Enterprise-grade **React Native + Expo (TypeScript)** mobile application for the rx.bd
healthcare platform. Targets **Android phone + Android tablet + iPad**, bilingual
(English / বাংলা), offline-tolerant for Bangladeshi network conditions, and built to the
same compliance bar as the web platform (HIPAA technical safeguards, GDPR DSAR, BMDC/DGHS).

> **This folder is isolated.** Everything mobile lives under `mobile-app/`. It has its own
> `package.json`, its own toolchain, and its own `node_modules`. It is NOT part of the
> Next.js web build and must never be imported by `src/`.

---

## The two hard workflow rules (read first)

1. **The `mobile-app` branch never merges into `main`.**
   It is a long-lived development branch. To stay current it *pulls from* `main`
   (`git merge origin/main`) — it never pushes back. Mobile code only ever exists on the
   `mobile-app` branch, under this folder.

2. **Any backend change the mobile app needs goes through `main` on its own branch.**
   If the app needs a new/changed `/api/v1/*` endpoint, a new push field, a CORS origin,
   etc., that work is done on a **separate feature branch cut from the latest `main`**,
   reviewed, and merged to `main` the normal way. The mobile branch then pulls it down.
   Backend changes never live on the `mobile-app` branch. See
   [`docs/07-backend-change-protocol.md`](docs/07-backend-change-protocol.md).

```
main ──────●───────●───────────●──────────────●─────────►   (web + API, source of truth)
            \       ↑ merge      ↑ merge        ↑
             \   feat/mobile-  feat/mobile-   feat/...      (backend tasks for mobile)
              \  push-fields   cors-origins
               \
   mobile-app ──●──────●(pull)──────●(pull)──────●(pull)─►   (RN/Expo app; never merges up)
```

---

## Documentation map

Read in order. The master plan is the entry point; the rest go deep on each pillar.

| Doc | What it covers |
|---|---|
| [`docs/00-master-plan.md`](docs/00-master-plan.md) | Executive plan, locked decisions, success criteria, roadmap-at-a-glance |
| [`docs/01-architecture.md`](docs/01-architecture.md) | RN/Expo architecture, code-reuse strategy with rx.bd, project structure |
| [`docs/02-security-compliance.md`](docs/02-security-compliance.md) | Mobile HIPAA/GDPR/BMDC safeguards, threat model, PHI-on-device rules |
| [`docs/03-auth-session-offline.md`](docs/03-auth-session-offline.md) | Bearer/refresh, MFA, two-key reverify, biometrics, multi-branch, offline sync engine |
| [`docs/04-design-personas.md`](docs/04-design-personas.md) | Design-token port, bilingual + Bangla type, tablet/iPad adaptivity, all 12 personas' scope |
| [`docs/05-delivery-cicd-testing.md`](docs/05-delivery-cicd-testing.md) | EAS build/update, OTA policy, dual distribution (stores + MDM), testing & device matrix |
| [`docs/06-roadmap-phases.md`](docs/06-roadmap-phases.md) | Phased milestones, workstreams, team mapping, timeline |
| [`docs/07-backend-change-protocol.md`](docs/07-backend-change-protocol.md) | How backend tasks for mobile flow to `main` |
| [`docs/08-risk-register.md`](docs/08-risk-register.md) | Risks, likelihood/impact, mitigations |

---

## Locked decisions (2026-06-14)

| Decision | Choice | Why |
|---|---|---|
| Framework | **React Native + Expo (TypeScript)** | Reuses rx.bd TS types/Zod/i18n/tokens; one codebase → Android phone+tablet+iPad; largest RN hiring pool in BD |
| First-release scope | **All personas in parallel** | Ship the shared shell + every role flow together (see roadmap for sequencing within this) |
| Offline | **Read cache + online-only writes** | Reads served from the encrypted cache offline; add/edit/delete require a live connection (blocked + "reconnect" prompt when offline). No write queue — eliminates silent-loss risk and is mandatory for clinical safety (the server holds the authoritative interlocks). Revised 2026-06-14 from "queued writes." |
| Distribution | **Public stores + Enterprise/MDM** | Patient app on Play/App Store; staff/clinical apps via MDM/internal track from one codebase |

---

## Status

**Phase 0 foundation source authored** — the shared shell is written as real, reviewable
TypeScript: API client (bearer + single-flight refresh + idempotency), auth/session
(secure-enclave tokens, biometric lock, two-key reverify, hard-logout wipe), the offline
engine (fail-closed PHI codec + SQLite read-cache + durable queued-write outbox + sync),
design tokens (faithful `--rxbd-*` port), bilingual i18n (Dhaka/৳/+880), security
(screenshot guard), push (FCM/APNs), UI primitives, the Expo Router shell, and unit tests.
See [`docs/09-foundation-status.md`](docs/09-foundation-status.md).

**Not yet installed/built.** No dependencies are installed and no native build has run — the
sandbox can't install the RN/Expo toolchain, and `package.json` is the dependency list
awaiting owner approval. After approval: `npx expo install` to pin native versions →
`npm install` → `npm run api:generate` → `npm run typecheck && npm test`. Bootstrapping
detail in [`docs/01-architecture.md`](docs/01-architecture.md) §"Bootstrapping".
