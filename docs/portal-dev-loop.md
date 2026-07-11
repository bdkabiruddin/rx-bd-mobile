# Patient + Doctor portal — development loop log

Self-paced feature / UI-UX loop (branch `claude/mobile-portal-dev-loop`). Each
slice: implement end-to-end → verify (typecheck + lint + test, and live on the
Android emulator where the changed surface is reachable) → commit + push.
Priority: **doctor → patient**. Safety rules hold (no weakening the fail-closed
codec, reverify two-key, or prescribe interlock; no new deps without approval).

Live env: emulator `emulator-5554`, Metro `:8081` (`adb reverse`), backend
rx-bd `:3000`, seed login `patient@rx.bd` / `DemoPass123!`.

## Shipped

- **#1 (a11y, both portals) — dark-mode warning text meets WCAG AA.** Split a
  theme-aware `warningText` token from the chip-only `warning`; dark scheme
  lightens it (amber-400) so the clinical honesty disclosures (allergy/med
  source unavailable) and queue staleness notices read AA (~11:1, was ~3.5:1)
  on the dark background. Contrast regression test added. Verified: tsc 0,
  eslint 0, jest 380/380, clean dark-mode render on device.

## Backlog (prioritized, unranked within tier)

Doctor:
- Per-section freshness + "couldn't refresh" markers on the patient chart
  (`PatientSummary.tsx`) — stale allergies/meds must not look current (audit M7).
- Dark-mode `danger` text contrast (blocking findings, allergy banner, errors)
  — same on-bg-vs-chip split as warning, for the `danger` family.
- Prescribe `doSign` defense-in-depth: re-assert `blockReason` at the top.

Patient:
- Bangla numerals for reminder times + freshness strings (i18n consistency).
- 40dp touch target on the reminder time-removal chip (`meds/reminders.tsx`).

Cross-cutting / investigate:
- **Black screen after JS reload / config-change** before content paints —
  a fresh launch renders fine; a reload lands on a blank frame for a beat.
  Likely a boot/splash gate; improve the loading state.
- Language-preference persistence — GOVERNANCE: parent web is English-only;
  mobile diverges (bilingual). Needs an owner ruling before touching.
