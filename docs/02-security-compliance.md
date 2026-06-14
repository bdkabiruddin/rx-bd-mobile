# 02 — Security & Compliance (Mobile)

The mobile app handles PHI. It must meet the same bar as the web platform: HIPAA technical
safeguards, GDPR (incl. DSAR parity), TCPA-adjacent consent for push, and BMDC/DGHS
expectations — adapted to a device that lives in a pocket, on shared ward tablets, and on
untrusted networks. This doc is the audit surface.

## 1. Threat model (mobile-specific)

| Threat | Vector | Control |
|---|---|---|
| Device loss/theft | Unlocked phone with cached PHI | Biometric app-lock + short re-auth TTL; encrypted cache; remote wipe on session revoke |
| Shoulder-surfing | Shared ward tablet | Screenshot/recording block on PHI screens; auto-blur on background; idle timeout |
| Network MITM | Public/cafe Wi-Fi, hostile ISP | TLS + **certificate pinning**; no plaintext; reject on pin failure |
| Compromised OS | Rooted/jailbroken device | Root/jailbreak **posture check**; degrade (block PHI) per policy, audited |
| Token theft | Backup extraction, malware | Tokens only in Keychain/Keystore (`expo-secure-store`), never in JS/AsyncStorage/logs |
| Data exfil via logs | Crash/analytics payloads | PHI-scrubbed Sentry; logger redaction; no PHI in breadcrumbs |
| Stale-permission access | Role/branch changed server-side | Short access-token TTL; refresh re-fetches role/branch; server is authoritative |
| Malicious deep link | Crafted push/URL | Validate + authorize every deep-link target server-side before render |

## 2. PHI-on-device rules (the cache contract)

1. **Minimize:** cache only what a screen needs; never bulk-pull a tenant's data.
2. **Encrypt:** cached PHI lives in an encrypted SQLite/MMKV store; the key is held in the
   device keystore, never in JS.
3. **TTL + evict:** every cached record carries a TTL; expired PHI is purged on launch and
   on a timer.
4. **Wipe triggers:** logout, server session-revoke (detected on 401/`session_revoked`),
   biometric-fail lockout, and remote-wipe signal all clear the cache + secure store.
5. **No PHI in:** logs, analytics, crash reports, screenshots, the app switcher preview
   (blur on background), clipboard auto-copy, or push notification bodies (titles are
   generic; details fetched after authenticated open).

## 3. Authentication & session security
(Full flow in doc 03.) Security-relevant invariants:
- Access token: short TTL, bearer in `Authorization`, stored in secure enclave.
- Refresh token: rotation on every use (backend already rotates); single-flight refresh;
  any rotation/replay failure = hard logout + wipe.
- **Biometric app-unlock** on cold start and after idle timeout; PIN fallback respects OS.
- **Two-key reverify** for the 12 sensitive intents (prescription-sign,
  controlled-substance dispense, death-cert issue, etc.) → biometric step-up → reverify
  token attached to the mutation.
- MFA + phone OTP parity with web.

## 4. Transport security
- TLS 1.2+ only; **certificate pinning** to the rx.bd API host(s) with a documented
  rotation procedure (pin the intermediate + a backup pin to avoid bricking on cert
  rotation). Pin failure blocks the request and surfaces a security error.
- All traffic to first-party hosts only; third-party SDKs (Sentry, push) vetted and
  PHI-free.

## 5. Platform hardening
- **Android:** `FLAG_SECURE` on PHI activities (blocks screenshots + recents preview);
  Keystore-backed crypto; Play Integrity / root signals; `cleartextTrafficPermitted=false`;
  `allowBackup=false`.
- **iOS:** screenshot/recording awareness + privacy blur on background; Keychain with
  `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`; jailbreak signals; no PHI in iCloud
  backup (exclude paths); App Transport Security strict.

## 6. Compliance mapping

| Requirement | Mobile control |
|---|---|
| HIPAA — Access control (§164.312(a)) | Per-user auth, role/branch from server, biometric lock, idle timeout |
| HIPAA — Audit controls (§164.312(b)) | Every PHI read/write hits server routes that already audit; mobile adds client-side access events where required |
| HIPAA — Integrity (§164.312(c)) | Server is authoritative; idempotent writes; no client-side clinical computation |
| HIPAA — Transmission security (§164.312(e)) | TLS + cert pinning |
| HIPAA — Encryption (§164.312(a)(2)(iv)) | Secure-enclave tokens + encrypted PHI cache |
| GDPR — DSAR / erasure / portability | App surfaces the existing `/gdpr/*` flows; local cache wiped on erasure |
| GDPR/TCPA — consent for push | Explicit opt-in for notifications; opt-out honored; respects backend opt-out registry |
| BMDC/DGHS — verified prescriber | App never lets an unverified doctor prescribe (server-gated); shows verification state |
| Data residency / self-hosted | Talks only to rx.bd self-hosted API; no third-party PHI processing |

## 7. Store/privacy disclosures
- Google Play **Data safety** + Apple **Privacy Nutrition Labels**: declare PHI categories,
  encryption-in-transit/at-rest, no third-party sale, deletion path.
- In-app privacy policy + consent screens (EN/বাংলা) at first run.
- Health-app program compliance (Play health declarations; App Store health/medical
  guidelines) tracked as a launch checklist in doc 05.

## 8. Security testing (gates)
- SAST on the app code; dependency CVE scanning in CI.
- Pen-test pass before public launch (token storage, pinning bypass, screenshot leak,
  deep-link authz, offline-cache extraction).
- Automated checks: a lint/test gate asserting no PHI keys appear in logger/analytics
  calls (mirrors the web `phi-console-leak` lint), and that PHI screens carry the
  screenshot-guard wrapper.
