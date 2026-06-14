# 08 — Risk Register

> L = Likelihood, I = Impact (both Low/Med/High). Reviewed at each phase gate.

| ID | Risk | L | I | Mitigation |
|---|---|---|---|---|
| R-01 | PHI leaks via cache extraction on a lost/rooted device | M | H | Encrypted store + keystore key; TTL + wipe-on-revoke; root posture blocks PHI; pen-test |
| R-02 | Token theft / session hijack | L | H | Secure enclave only; refresh rotation + single-flight; hard logout on replay; cert pinning |
| R-03 | Cert-pinning bricks the app on cert rotation | M | H | Pin intermediate + backup pin; documented rotation runbook; remote kill-switch via min-version |
| R-04 | Offline write replay double-applies an effect | M | H | Client Idempotency-Key + server idempotency (already enforced); airplane-mode E2E proves single effect |
| R-05 | Conflicting offline clinical write auto-merges incorrectly | L | H | Never auto-merge clinical data; explicit conflict screen; reverify intents not queued offline |
| R-06 | Fabricated/demo data ships (audit's CRITICAL class) | M | H | No-fabricated-data lint gate; empty/loading/error states only; code review |
| R-07 | Bangla rendering breaks (conjuncts, truncation, numerals) | M | M | Quality Bengali font; RNTL bilingual render tests; manual Bangla device pass |
| R-08 | Low-end Android perf (cold-start, jank, memory) | M | M | Perf budget anchored to low-end device; Hermes; list virtualization; profiling each phase |
| R-09 | Store rejection (health-data policy, privacy labels) | M | M | Early data-safety/privacy work; health-program checklist; staged rollout; TestFlight first |
| R-10 | OTA pushes a behavioral change to a safety flow | L | H | OTA policy forbids clinical/native/security changes via OTA; clinical logic is server-side |
| R-11 | Backend contract drift vs generated client | M | M | OpenAPI is the contract; CI contract check; regenerate after every backend merge (doc 07) |
| R-12 | GitHub Actions blocked at account level | H | M | All gates run locally + on EAS; EAS pipeline independent of GH Actions; unblock tracked with owner |
| R-13 | New-dependency sprawl / unvetted SDKs touching PHI | M | M | Dependency-approval PR; vet every SDK for PHI access; PHI-free analytics/push only |
| R-14 | Scope blow-out from "all personas in parallel" | M | M | Shell-first; Patient+Doctor to prod before facility personas; strict phase exits |
| R-15 | iPad/tablet treated as stretched phone | M | M | Master-detail layout system; tablet-first personas designed for large screens; device-matrix sign-off |
| R-16 | Push consent / TCPA-adjacent compliance miss | L | M | Explicit opt-in; honor backend opt-out registry; generic notification titles |
| R-17 | Mobile branch accidentally merged to main | L | M | Documented hard rule (README); branch protection/PR-target guard; reviewer checklist |
