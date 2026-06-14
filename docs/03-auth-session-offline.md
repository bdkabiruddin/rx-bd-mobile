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

## Part B — Offline (read cache + queued writes)

### B.1 Goals
Render usefully with no/poor network, capture user intent durably, and reconcile safely on
reconnect — without re-implementing server business logic or auto-merging clinical data.

### B.2 Read cache
- TanStack Query is the in-memory layer; an **encrypted SQLite/MMKV persistor** is the
  durable layer.
- Every query result is written to the cache with `{ fetchedAt, ttl, tenantId, userId }`.
- On screen mount: render cached data immediately with a **freshness badge**
  (`Live` / `Updated 5m ago` / `Offline — last synced …`), then background-refresh.
- PHI cache entries obey the doc-02 encryption + TTL + wipe rules.

### B.3 Write outbox
```
User action → build command { method, path, body, idempotencyKey, intent?, reverifyToken? }
            → if online: send now; on success, reconcile cache
            → if offline/failed-retryable: enqueue in durable outbox (encrypted)
            → show optimistic state with a "pending sync" marker
```
- **Idempotency-Key** is generated client-side per command (backend enforces idempotency).
- Outbox entries retry with backoff when connectivity returns (NetInfo-driven).
- **Non-retryable** (validation 4xx) → surface to user, drop from outbox, revert optimistic
  state.

### B.4 Conflict & safety policy
- Clinical writes are **never auto-merged**. If the server rejects a queued write because
  state changed (e.g., prescription already dispensed, slot taken), the app surfaces a
  clear conflict screen and asks the user to re-decide.
- Sensitive intents (reverify-gated) are **not** queued offline by default — they require a
  fresh biometric step-up, so they execute online or prompt when back online.
- Ordering: the outbox preserves per-resource ordering; cross-resource ordering is
  best-effort.

### B.5 What is NOT offline in v1
- Real-time queue position, video telemedicine, payment initiation, and any
  controlled-substance flow require connectivity. They show explicit offline states.

### B.6 Testing the offline engine
- Airplane-mode Maestro scripts: cache render, queue a booking offline, reconnect, assert
  single server-side effect (idempotency proven), assert conflict path on a forced
  server-state change.
