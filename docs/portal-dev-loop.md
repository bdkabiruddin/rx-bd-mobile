# Patient + Doctor portal — development loop log

Self-paced feature / UI-UX loop (branch `claude/mobile-portal-dev-loop`). Each
slice: implement end-to-end → verify (typecheck + lint + test, and live on the
Android emulator where the changed surface is reachable) → commit + push.
Priority: **doctor → patient**. Safety rules hold (no weakening the fail-closed
codec, reverify two-key, or prescribe interlock; no new deps without approval).

Live env: emulator `emulator-5554`, Metro `:8081` (`adb reverse`), backend
rx-bd `:3000`, seed login `patient@rx.bd` / `DemoPass123!`.

> **Verification cadence:** every slice runs tsc + eslint + jest. On-device
> screenshot is done immediately when the changed surface is reachable from the
> current app state; surfaces behind a login-switch or deep nav (e.g. the doctor
> patient-chart) are batched into a periodic per-portal walkthrough pass.

## Shipped

- **#3 (doctor, FEATURE GAP) — appointment status actions on Today.** The
  doctor's landing was 100% read-only. Tapping an appointment now opens a status
  action sheet (check-in → start visit → complete, or no-show / cancel with a
  reason) → `PATCH /appointments/{id}/status` → refresh. The backend owns the
  authoritative transition rules; the client offers the plausible next actions
  and surfaces any rejection honestly. New `AppointmentActionSheet` + a theme
  `scrim` token + `nextStatusActions`/`statusNeedsReason` with a transition-
  matrix unit test. Verified: tsc 0, eslint 0, jest 385/385; on-device
  doctor-Today walkthrough batched with the chart-freshness verify.
- **#2 (doctor) — per-section freshness + "couldn't refresh" marker on the
  patient chart.** Each clinical section (`PatientSummary.tsx`) now shows its own
  last-updated line; when a background refresh fails over stale cache
  (`error && hasData`) it renders "Couldn't refresh — showing saved data · N min
  ago" in the AA `warningText` amber instead of silently presenting stale
  allergies/meds as current (audit M7). Verified: tsc 0, eslint 0, jest 380/380;
  doctor-chart screenshot pending the next doctor-portal walkthrough.
- **#1 (a11y, both portals) — dark-mode warning text meets WCAG AA.** Split a
  theme-aware `warningText` token from the chip-only `warning`; dark scheme
  lightens it (amber-400) so the clinical honesty disclosures (allergy/med
  source unavailable) and queue staleness notices read AA (~11:1, was ~3.5:1)
  on the dark background. Contrast regression test added. Verified: tsc 0,
  eslint 0, jest 380/380, clean dark-mode render on device.

## Backlog — FEATURE GAPS (2026-07-11 gap audit; all MOBILE-ONLY unless noted)

The backend endpoints already exist; the mobile app just lacks the surface.
Order ≈ value × feasibility. Reuse map: reads `useCachedQuery`, writes
`useWrite`, safety-critical writes reverify (`performReverifiedAction`);
list→detail = `doctor-orders/inbox`; patient-scoped compose = `(doctor)/orders/
new`; cancel-in-list = `referrals/index`; cancel/reschedule = `(patient)/
appointments/[id]`.

DOCTOR (finish first):
- [x] Appointment status actions on Today (shipped #3). Follow-up: reschedule
      (needs a date/time picker) + a tappable appointment-detail screen.
- [ ] Refill-approval queue — `GET /doctors/{id}/refills/pending` + **← next**
      `/refills/{id}/safety-eval` + `PATCH approve|deny`. Clone orders/inbox.
- [ ] Incoming-referrals inbox + respond/complete — `GET /referrals/inbox`,
      `PATCH /referrals/{id}/respond|complete`.
- [ ] Add allergy from chart — `POST /patients/{id}/allergies` (safety-positive).
- [ ] Add/update condition from chart — `POST /patients/{id}/conditions`,
      `PATCH /conditions/{id}/status`.
- [ ] Record vital from chart — `POST /patients/{id}/vitals`.
- [ ] Request access on a consent-locked section — `POST /patients/{id}/
      consents/requests` (converts the dead-end locked state into an action).
- [ ] Prescription detail + PDF + cancel from chart — `GET /prescriptions/{id}`,
      `POST /me/prescriptions/{id}/pdf`, `PATCH /prescriptions/{id}/status`.
- [ ] Cancel a pending lab order — `PATCH /lab-orders/{id}/status`.
- [ ] Add a recurring schedule slot (only remove exists today) —
      `POST /doctors/me/schedule/recurring` (append + republish).
- [ ] EPIC (phased): clinical encounter / visit notes from queue Complete —
      `/appointments/{id}/encounter`, `/encounters/{id}/{notes,diagnoses,finalize}`.
- [ ] Minor: Rx template create/delete; issued-cert PDF; doctor profile edit.

PATIENT (after doctor):
- [ ] Chronic conditions list + self-record — `GET/POST /me/conditions`
      (clone allergies). Fastest patient win.
- [ ] Refill request on an ACTIVE Rx — `POST /refills/request` (clone reorder).
- [ ] Rx PDF download — `POST /me/prescriptions/{id}/pdf` (confirm URL envelope).
- [ ] Pay a bill (bKash/Nagad/…) — `POST /payments/initiate` (confirm envelope).
- [ ] GDPR processing-objection — `GET/POST /me/processing-objections`.
- [ ] Immunization/EPI record — `GET /patients/{id}/vaccinations`, `/epi-schedule`.
- [ ] My referrals / certificates (read-only) — `GET /patients/{id}/referrals`,
      `/medical-certificates`.
- [ ] Account security (MFA/password/email/phone) via reverify two-key.
- [ ] Larger: insurance policies+claims; family/dependents; e-pharmacy orders.

BACKEND-BLOCKED (need a new endpoint — NOT quick wins): patient lab-result
acknowledge; patient lab-report PDF.

## Polish track (separate from feature gaps)
- Dark-mode `danger` text contrast (danger-family on-bg split, like slice #1).
- Bangla numerals for reminder times + freshness; 40dp reminder chip.
- Black screen after JS reload / config-change (boot/splash gate).
- Language-preference persistence — GOVERNANCE: owner ruling (web is
  English-only; mobile diverges) before touching.
