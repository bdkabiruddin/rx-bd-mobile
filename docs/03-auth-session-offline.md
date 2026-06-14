# 03 — Auth, Session & Offline

## Part A — Authentication & session

### A.1 Login flow (bearer, not cookies)
The backend already issues bearer tokens for non-browser clients, so the mobile flow is:

```
1. POST /api/v1/auth/login  { identifier, password }      → { accessToken, refreshToken,
                                                              accessTokenExpiresIn,
                                                              refreshTokenExpiresIn, mfaRequired? }
2. if mfaRequired:  POST /api/v1/auth/mfa/verify { code }  (or phone OTP issue/verify)
3. store accessToken + refreshToken in expo-secure-store (NEVER AsyncStorage)
4. fetch session context: role, my-branches, my-departments
5. arm biometric app-lock
```

OAuth (`/auth/oauth/[provider]/start|callback`) and phone OTP (`/auth/phone/otp/*`) are
available for parity; patient onboarding can prefer phone-OTP (ubiquitous in BD).

### A.2 Token lifecycle
- **Access token:** short TTL, attached as `Authorization: Bearer …` on every request.
- **Refresh:** on 401 (or pre-emptive near-expiry), `POST /api/v1/auth/refresh` with the
  refresh token **in the body** (the route accepts body tokens for API clients). Backend
  rotates both tokens; we persist the new pair.
- **Single-flight:** concurrent 401s share one refresh; others await its result.
- **Hard failure** (refresh rejected / rotation replay / `session_revoked`) → wipe secure
  store + encrypted cache → route to login.

### A.3 Biometric app-lock & step-up
- **App-lock:** cold start and post-idle require `expo-local-authentication` (Face/Touch/
  fingerprint) before any PHI renders. PIN fallback per OS policy.
- **Step-up (two-key):** sensitive intents require a fresh biometric + a **reverify token**.

### A.4 Two-key reverify intents (reuse backend)
The backend defines 12 reverify intents. The app maps each sensitive action to its intent,
performs biometric step-up, obtains the reverify token via `/api/v1/auth/reverify`, and
attaches it to the mutation:

```
PRESCRIPTION_SIGN · PRESCRIPTION_EDIT · DISPENSE_CONTROLLED_SUBSTANCE ·
DEATH_CERTIFICATE_ISSUE · TENANT_LIFECYCLE · ADMIN_USER_MERGE · ADMIN_IMPERSONATE ·
AUDIT_LOG_EXPORT · ADMIN_MFA_DISABLE · ADMIN_USER_SUSPEND · CRON_MANUAL_RUN · …
```

### A.5 Multi-branch / multi-department context
Mirrors web: after login, `GET /auth/my-branches` + `/auth/my-departments`; the active
branch/department is part of session state and sent as the server expects. Switching uses
`/auth/switch-branch` + `/auth/switch-department`, which re-issue context. The branch
switcher is shown **only** for personas with multiple assignments (same rule as web).

### A.6 Session state model (Zustand + secure store)
```ts
type Session = {
  status: 'anon' | 'locked' | 'active';
  accessToken: string;          // mirrored in secure store; memory copy for headers
  role: RoleKey;
  activeBranchId: string | null;
  activeDepartmentId: string | null;
  mfaSatisfied: boolean;
  lastActivityAt: number;       // drives idle-lock
};
```
Tokens persist in secure store; the in-memory copy is cleared on background + re-read on
unlock.

## Part B — Offline (read cache + online-only writes)

### B.1 Goals (revised 2026-06-14)
Render usefully with no/poor network for **reads**, and keep **writes safe** — without
re-implementing server business logic. Writes are **online-only**: there is no deferred
queue, which removes the silent-loss vectors a queue introduces and is mandatory for
clinical correctness (see B.3).

### B.2 Read cache
- TanStack Query is the in-memory layer; an **encrypted SQLite persistor** (AES-256-GCM,
  `offline/aesCodec.ts`) is the durable layer.
- Every query result is written to the cache with `{ fetchedAt, ttl, tenantId, userId }`.
- On screen mount: render cached data immediately with a **freshness badge**
  (`Live` / `Updated 5m ago` / `Offline — last synced …`), then background-refresh.
- PHI cache entries obey the doc-02 encryption + TTL + wipe rules.

### B.3 Writes — ONLINE-ONLY (`offline/submit.ts` → `submitWrite`)
```
User action → submitWrite({ method, path, body, reverifyToken? })
            → if OFFLINE:  return OFFLINE result → UI shows "reconnect to make changes"
            → if ONLINE:   send now with an Idempotency-Key; return the Result
```
- Add / edit / delete **never queue**. Offline mutations are refused, not deferred.
- **Why:** (1) a deferred queue can silently lose intent — a queued write rejected on later
  sync, or wiped on session-revoke; (2) clinical mutations (prescription sign, dispense,
  allergy/dose checks) depend on the server's **live, authoritative safety interlocks** —
  queuing them means acting on stale safety state, which is unsafe.
- **Idempotency-Key** is still attached so a mid-request network drop + user retry cannot
  double-apply at the server (the backend enforces idempotency).
- Sensitive (reverify-gated) actions go through `performReverifiedAction`, which is also
  online-only and additionally requires a fresh biometric step-up.

### B.4 What is NOT available offline
- All writes (add/edit/delete), real-time queue position, video telemedicine, payment
  initiation, and any controlled-substance flow require connectivity — explicit offline
  states are shown.

### B.5 Future option (not in v1)
- Selective offline writes for specific **low-risk, non-clinical** convenience actions
  (e.g. an appointment *request*, a personal vitals-diary entry) MAY be added later —
  explicitly per action, with conflict surfacing — never as a default, never for
  clinical/financial/safety mutations.

### B.6 Testing
- Pure-logic: AES codec round-trip/tamper/wrong-key (jest, green).
- Maestro (device): cache renders offline; an add/edit/delete attempt while offline is
  **blocked** with the reconnect prompt; the same action succeeds once online.

---

## Part C — Data-loss prevention (audit 2026-06-14)

A deep review for "can a user lose data in any way?" found three real vectors
beyond the offline-write question. All are now closed in the foundation; the
two hooks below are MANDATORY for every Phase-2 input form.

### C.1 Idle-lock no longer destroys in-progress input  ✅ fixed
- **Was:** idle-lock did `router.replace('/(auth)/unlock')`, which UNMOUNTED the
  current screen — a half-typed clinical note / form was lost, and unlock
  returned to the persona home, not the form.
- **Now:** `locked` renders `LockOverlay` ON TOP of the live screen (no
  navigation). The screen + its form state stay mounted; unlocking returns the
  user exactly where they were. (`app/_layout.tsx`, `src/auth/LockOverlay.tsx`.)

### C.2 Lost-response + retry can no longer duplicate  ✅ fixed
- **Was:** the Idempotency-Key was regenerated on every attempt — even the
  internal 401-refresh retry minted a new key, and a user-driven retry always
  did — so "response lost to a network drop → user taps again" could create a
  DUPLICATE (double appointment / payment / prescription).
- **Now:** (1) `client.ts` threads the SAME key through the refresh-retry;
  (2) `useWrite()` holds a STABLE key per action — reused across retries of a
  failed write, reset only after success. **Every screen mutation MUST go
  through `useWrite`** (not raw `submitWrite`).

### C.3 In-progress input survives app-kill / background / eviction  ✅ added
- Mobile OSes kill backgrounded apps; without persistence, unsaved input is
  gone. `useDraft(key, initial)` autosaves form state (encrypted, PHI-safe) and
  restores it on return. **Every Phase-2 input form MUST use `useDraft`.**
- Tradeoff: drafts live in the encrypted cache and are wiped on hard-logout /
  session-revoke (with all PHI). Idle-lock does NOT lose them (C.1). A future
  enhancement may warn before a session-expiry logout if an unsaved draft exists.

### Mandatory pattern for Phase-2 forms
```
const draft = useDraft('rx-note:<patientId>', '');   // survives kill/lock/bg
const { submit, busy } = useWrite();                  // stable idempotency key
// …bind draft.value/draft.setValue to inputs…
const res = await submit({ method: 'POST', path: '/api/v1/…', body: {…} });
if (res.ok) draft.clear();                            // remove the saved draft
```
