# 04 — Design System, Bilingual UX, Tablet/iPad & Per-Persona Scope

## 1. Design tokens → React Native

The web theme (`src/styles/themes/rx-bd.css`) is a two-layer token system: a reference
palette (`--rxbd-teal-*`, `--rxbd-coral-*`, neutrals) and a semantic layer
(`--color-bg`, `--color-fg`, `--color-accent`, status colors). We port it faithfully:

- A small generator reads the CSS variables and emits `src/ui/tokens.ts` — a typed theme
  object (light + dark) with the **same names**.
- **Tenant override is limited to the `--color-accent*` family** (same constraint as web).
- **Safety colors are locked** — clinical-critical reds/ambers are never tenant-overridable
  and meet AAA contrast on safety surfaces.
- Primitives (`Button`, `Field`, `Card`, `Badge`, `EmptyState`, `RxRow`, `ReasonDialog`,
  `ConfirmSheet`) are rebuilt in RN against these tokens, matching web semantics (e.g. the
  `clinicalCritical` destructive treatment, the localized confirm/reason dialog pattern).

## 2. Bilingual (EN / বাংলা) — a gate, not an option

- Every user-facing string resolves from a typed `{ en, bn }` table (web convention).
- One language at a time, cookie/preference-persisted equivalent (secure pref); a topbar
  EN ⇄ বাংলা toggle. Never render both side by side (Wave 59 web rule, mirrored).
- **Bangla typography:** bundle a quality Bengali font with correct conjunct rendering;
  test line-height/truncation for Bangla (taller glyphs); verify numerals.
- **Locale formatters:** dates in `Asia/Dhaka`, currency `৳` from paisa (BigInt-safe),
  phone `+880`, locale numerals where appropriate.

## 3. Accessibility (gate)
- Screen-reader labels on every actionable element; `accessibilityRole`/`State` correct.
- AAA contrast on safety surfaces; dynamic type (respect OS font scaling) without breaking
  layouts.
- Large touch targets (≥ 48dp) — shared ward tablets are touched fast and gloved.
- Focus order, error announcements, reduced-motion honored.

## 4. Tablet & iPad adaptivity (not stretched phone UI)
- **Responsive layout system:** breakpoint at ≥ sw600dp (Android tablet) / iPad → switch
  from single-column stacks to **master-detail** (list + detail side-by-side).
- Multi-column dashboards, persistent side-nav on large screens, modals become side-sheets.
- iPad: support split-view/stage-manager sizing; landscape + portrait.
- Facility/clinical personas are tablet-first (nursing stations, pharmacy counters, lab
  benches); patient/doctor are phone-first but tablet-correct.

## 5. Per-persona mobile scope (all 12)

> Scope = the high-value mobile slice of each web portal. Not every web screen belongs on a
> phone; we ship the field-critical flows first. Form-factor: 📱 phone-first · 🔲 tablet-first.

| Persona | Form | First-wave mobile scope | Notable reverify/PHI |
|---|---|---|---|
| **Patient** 📱 | Appointments (book/reschedule/cancel), prescriptions + meds, lab results, live queue position, vitals diary, notifications, profile, DSAR, billing/pay status | Consent gates; PHI screens screenshot-blocked |
| **Doctor** 📱 | Today's schedule, chamber queue (call-next/complete), patient summary, prescribe + e-sign (reverify), referrals/certificates, lab orders | `PRESCRIPTION_SIGN`, `DEATH_CERTIFICATE_ISSUE` step-up |
| **Pharmacy** 🔲 | Dispense queue, prescription validation, dispense record, deliveries board (OTP handover), inventory glance, refill approvals | `DISPENSE_CONTROLLED_SUBSTANCE` step-up |
| **Lab** 🔲 | Order worklist, sample collection/accession, result entry, report release, QC view | Result release authority; PHI |
| **Diagnostic centre** 🔲 | Appointments, sample/scan workflow, report delivery | PHI |
| **Hospital** 🔲 | Admissions board, ward/bed status, nursing notes (append-only), discharge planning, shifts | Nursing-note write; PHI |
| **Facility staff** 🔲 | Branch-scoped queue, check-in/triage, staff tasks | Branch context |
| **Assistant** 📱 | Doctor-linked queue prep, scheduling support | Delegated scope |
| **Vendor** 📱 | Claims queue, agreements, commissions, API-token-free ops view | Financial; no PHI |
| **Diagnostic/Lab couriers / delivery** 📱 | Delivery tasks, chain-of-custody OTP, status | OTP custody |
| **Admin (lite)** 📱 | Approvals (grants, doctor-verification), notifications, break-glass review, incident acknowledge — *operational on-the-go subset, not the full console* | `ADMIN_*` reverify intents |
| **Marketing/public** 📱 | Pre-auth: facility/doctor discovery, signup entry (patient), pricing → onboarding | No PHI |

Distribution split (doc 05): **Patient** (+ public discovery) → public stores;
**all staff/clinical/admin** personas → enterprise/MDM track.

## 6. Shared UX patterns
- **Freshness badge** on every data surface (offline-aware, doc 03).
- **Optimistic + pending-sync markers** for queued writes.
- **Localized confirm/reason dialogs** for destructive + reverify actions (port of the
  web `ReasonDialog`/`ConfirmSheet`), replacing any `window.confirm`-style prompts.
- **Empty / loading / error** states everywhere — never fabricated placeholder data.
