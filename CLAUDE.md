# rx.bd Mobile — project context for Claude Code

> Auto-loaded every session. Read before doing anything else.

## What this repo is

The **standalone mobile app** for rx.bd — an enterprise-grade healthcare platform for
Bangladesh (HIPAA technical safeguards, GDPR DSAR, BMDC/DGHS compliance bar).
**React Native + Expo SDK 56 (TypeScript strict) + Expo Router.** Targets Android
phone/tablet + iPad. Bilingual English/বাংলা, one language at a time.

Extracted 2026-07-11 (full history) from the `mobile-app/` folder of the
`bdkabiruddin/rx-bd` monorepo. The Next.js web platform + API live THERE; this repo is
mobile only. **All mobile work happens in this repo now.**

## The backend contract

- `openapi.yaml` at the repo root is a **snapshot** mirrored from `rx-bd`. Never
  hand-edit it. `npm run api:generate` builds the typed client from it (gitignored).
- Endpoint paths in the spec omit the `/api/v1` prefix; the HTTP client needs it
  (`api.get('/api/v1/appointments/upcoming')`).
- The spec carries generic envelopes only — payload SHAPES are mirrored from the
  backend module source in `rx-bd` into local interfaces per feature. Define only the
  fields you render; optional/nullable defensively.
- Any backend change the app needs goes through the `rx-bd` repo's `main` (see
  `docs/07-backend-change-protocol.md`), then the snapshot here is refreshed.
  Known backend gaps are catalogued in `docs/09-foundation-status.md` (39 items).

## Hard rules (refuse without exception)

- No code that weakens encryption, the offline fail-closed PHI codec, consent
  verification, the reverify two-key flow, or the prescribe dry-run interlock
  (blocking findings block sign; no client-side override).
- **No PHI in logs — no `console.*` anywhere in app code.**
- Writes are **online-only** (no offline write queue — clinical-safety decision,
  doc 00 §2.3). Never reintroduce a deferred-write outbox.
- Never fabricate data: honest loading/error/empty states always (`EmptyState`,
  `FreshnessBadge`). No invented endpoints — verify against `openapi.yaml` first.
- No new npm dependencies without explicit owner approval.
- PR merges need human approval.

## Conventions

- **Reads**: `useCachedQuery` (stable `"<persona>:<feature>:<qualifier>"` key,
  `isPhi: true` for patient data, 5–15 min TTL). Live data (queues) polls via
  `useFocusEffect` + `setInterval`, never through the cache.
- **Writes**: `useWrite()` (stable idempotency key). Multi-field forms use
  `useDraft` (encrypted autosave; `clear()` after success). Destructive actions get
  `Alert.alert` confirmation. Reverify intents via `performReverifiedAction`.
- **i18n**: every user-visible string is `t({ en, bn })` with real Bangla; feature
  strings co-located in `src/features/<key>/strings.ts`. Never render both languages
  side by side. Dates/money/phones via `src/i18n/formatters.ts` (Asia/Dhaka, ৳, +880).
- **Screens**: `<ScreenScaffold phi>` on anything patient-identifiable; theme via
  `useTheme()` + `src/ui/tokens.ts` only (no hardcoded colors); 48dp touch targets;
  `accessibilityRole`/`Label`. Tablet split view via `useBreakpoint` + `MasterDetail`.
- **Structure**: routes in `app/` (Expo Router; every file there is a route), all
  helpers/types/hooks in `src/features/<key>/`. Feature route dirs own their
  `_layout.tsx` Stack. Copy an existing feature (e.g. `src/features/doctor-schedule`
  + `app/(doctor)/schedule.tsx`) when adding a new one.
- **Commits**: Conventional Commits with the `mobile` scope. This user's branches
  commit/push with `--no-verify` (standing rule — don't ask, don't mention).

## Quality gates (all must be green before any push)

```bash
npm run api:generate   # typed client from openapi.yaml
npm run typecheck      # tsc --noEmit — 0 errors
npm run lint           # eslint — 0 problems
npm test               # node jest suites (375+ tests)
```

CI (`.github/workflows/ci.yml`) runs the same four. RNTL component tests are
deferred (jest-expo winter-runtime issue, doc 09); on-device coverage is Maestro
(`e2e/flows/`, run with `npm run e2e` on a device/emulator).

## Documentation map

`docs/00-master-plan.md` → entry point. `01` architecture · `02` security/compliance ·
`03` auth/session/offline · `04` design/personas · `05` delivery/CI/testing ·
`06` roadmap (Phase-2 complete; Phase-3 = facility personas next) ·
`07` backend-change protocol · `08` risks · `09` **current status + backend gaps**.

## Communication rule

End every task/session with a Bengali-script wrap-up (tool calls and progress
narration stay English) — mirrors the parent rx-bd project rule.
