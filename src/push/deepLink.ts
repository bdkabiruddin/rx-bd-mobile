// Push deep-linking — pure route resolution. No React / React Native /
// Expo imports: this module is unit-tested in the Node jest environment
// (__tests__/deepLink.test.ts). The expo-notifications wiring lives in
// src/push/register.ts (usePushDeepLinks), which resolves taps through
// the functions here.
//
// Payload contract (mirrored READ-ONLY from the rx.bd backend):
//   - FCM PUSH sends a `data: Record<string, string>` block
//     (src/modules/notification/domain/INotificationDelivery.ts —
//     PushPayload.data: "Optional in-app deep link (route +
//     identifiers)"). No producer populates it yet, so we accept the
//     documented field set: type / category / entityId / deepLink.
//   - In-app notification rows (the bell feed the pushes mirror) carry
//     `type`, a legacy web `link`, and an RT-314 `deepLink` that takes
//     precedence (src/modules/notification/domain/
//     INotificationRepository.ts). Observed producer values:
//       lab-result.ready / lab-result.critical → /dashboard/patient/results/{labOrderId}
//       vital.trend_alert                      → /dashboard/patient/vitals
//       medication.dose-reminder               → /dashboard/patient/prescriptions/{id}
//       CONSENT_REQUEST_RECEIVED               → /dashboard/patient/consents
//       CARE_PLAN_REVIEW_OVERDUE               → /dashboard/doctor/patients/{patientId}
//       appointment_reminder                   → (no link)
//       MESSAGE_RECEIVED                       → /messages          (no mobile surface)
//       anc-visit.reminder / pnc-visit.reminder→ /dashboard/patient/maternal-care (no mobile surface)
//       patient.legacy-data-reconcile          → /dashboard/patient/profile (no mobile surface)
//       SECURITY_ALERT / BREACH_* / template test → admin portal only
//
// Safety rules (clinical-safety honesty):
//   - Routes are REBUILT from a fixed whitelist — raw payload strings are
//     never echoed into the router. Unknown / unmappable → null, never a
//     guessed route.
//   - Persona gate: a payload targeting the other persona resolves to
//     null, even when a same-named route exists for the active persona.
//   - Absolute / protocol-relative URLs are rejected (a push must not be
//     able to steer the app via a foreign host's path).
//   - Never throws — hostile or malformed payloads resolve to null.

import { sessionAccess } from '@/auth/sessionStore';
import { personaForRole } from '@/config/domain';

/** The two personas this app ships stacks for. Every other portal role
 *  (pharmacy, hospital, admin, …) has no mobile surface → null. */
type MobilePersona = 'patient' | 'doctor';

const MAX_JSON_PAYLOAD_CHARS = 16 * 1024;

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Map a push payload `data` object onto an in-app route for the ACTIVE
 * persona (from sessionAccess.getPersona()). Returns null for unknown
 * payloads, the other persona's payloads, or when no session role is
 * loaded yet. Never throws.
 */
export function routeForNotification(data: unknown): string | null {
  return routeForPersona(sessionAccess.getPersona(), data);
}

/**
 * Persona-explicit variant of `routeForNotification` — the pure core,
 * exported for tests and for callers that already hold the persona.
 */
export function routeForPersona(persona: string, data: unknown): string | null {
  try {
    const mobilePersona: MobilePersona | null =
      persona === 'patient' ? 'patient' : persona === 'doctor' ? 'doctor' : null;
    if (!mobilePersona) return null;
    const record = toRecord(data);
    if (!record) return null;

    const direct = resolveFromRecord(mobilePersona, record);
    if (direct) return direct;

    // Some transports re-serialize the data block as a JSON string under
    // `dataString` (expo-notifications background payload shape).
    const nested = toRecord(record['dataString']);
    return nested ? resolveFromRecord(mobilePersona, nested) : null;
  } catch {
    // Hostile payloads (throwing getters, exotic objects) must never
    // crash the tap handler.
    return null;
  }
}

/**
 * Resolve a full expo-notifications NotificationResponse (typed `unknown`
 * so this module stays free of expo imports). Tries, in order, the
 * platform locations a remote payload's data block can land in:
 *   1. response.notification.request.content.data          (both platforms)
 *   2. …request.trigger.remoteMessage.data                 (Android FCM)
 *   3. …request.trigger.payload                            (iOS userInfo)
 */
export function routeForNotificationResponse(response: unknown): string | null {
  for (const candidate of pushDataCandidates(response)) {
    const route = routeForNotification(candidate);
    if (route) return route;
  }
  return null;
}

/** Extract every location a push data block may ride in. Pure + total. */
export function pushDataCandidates(response: unknown): unknown[] {
  const out: unknown[] = [];
  try {
    const resp = asRecord(response);
    const notification = asRecord(resp?.['notification']);
    const request = asRecord(notification?.['request']);
    const content = asRecord(request?.['content']);
    if (content && content['data'] !== undefined) out.push(content['data']);
    const trigger = asRecord(request?.['trigger']);
    const remoteMessage = asRecord(trigger?.['remoteMessage']);
    if (remoteMessage && remoteMessage['data'] !== undefined) {
      out.push(remoteMessage['data']);
    }
    if (trigger && trigger['payload'] !== undefined) out.push(trigger['payload']);
  } catch {
    // fall through — whatever was collected so far is still usable
  }
  return out;
}

// ── Core resolution ──────────────────────────────────────────────────────────

function resolveFromRecord(
  persona: MobilePersona,
  src: Record<string, unknown>,
): string | null {
  // Explicit audience field wins first: a payload stamped for someone
  // else is dropped outright.
  const target = personaTarget(src);
  if (target && target !== persona) return null;

  // 1 — deepLink translation. RT-314: `deepLink` takes precedence over
  //     the legacy `link`.
  const link = firstString(src, ['deepLink', 'deeplink', 'link']);
  if (link) {
    const viaPath = routeForPath(persona, link);
    if (viaPath) return viaPath;
    // A link that clearly belongs to another persona/portal poisons the
    // whole payload — do NOT fall back to the type mapping (mixed
    // signals are treated as untrusted).
    const linkPersona = pathPersona(link);
    if (linkPersona && linkPersona !== persona) return null;
  }

  // 2 — type / entity mapping.
  const type = normalizeType(firstString(src, ['type', 'category', 'eventType']));
  if (!type) return null;
  return persona === 'patient'
    ? patientRouteForType(type, src)
    : doctorRouteForType(type, src);
}

/** Notification type → route, patient persona. Type strings are the
 *  backend producers' values, normalized ('.'/'-'/space → '_', lowered).
 *  Detail routes REQUIRE a safe entity id — a known type without its id
 *  resolves to null rather than a guessed landing. */
function patientRouteForType(type: string, src: Record<string, unknown>): string | null {
  switch (type) {
    case 'lab_result_ready':
    case 'lab_result_critical':
    case 'lab_critical': {
      const id = idFrom(src, 'entityId', 'labOrderId');
      return id ? `/(patient)/labs/${id}` : null;
    }
    case 'vital_trend_alert':
      return '/(patient)/vitals';
    case 'medication_dose_reminder':
    case 'refill_ready':
    case 'prescription_dispensed': {
      const id = idFrom(src, 'entityId', 'prescriptionId');
      return id ? `/(patient)/meds/${id}` : null;
    }
    case 'appointment_reminder':
    case 'booking_confirmed': {
      const id = idFrom(src, 'entityId', 'appointmentId');
      return id ? `/(patient)/appointments/${id}` : null;
    }
    case 'billing_invoice': {
      const id = idFrom(src, 'entityId', 'invoiceId');
      return id ? `/(patient)/billing/${id}` : null;
    }
    case 'consent_request_received':
      // Mobile's consent / data-rights surface is the privacy screen.
      return '/(patient)/profile/privacy';
    case 'queue_entry_called':
      // Backend domain event queue.entry_called (no push producer yet —
      // mapped ahead of one landing).
      return '/(patient)/queue';
    default:
      return null;
  }
}

/** Notification type → route, doctor persona. */
function doctorRouteForType(type: string, src: Record<string, unknown>): string | null {
  switch (type) {
    case 'care_plan_review_overdue': {
      const id = idFrom(src, 'entityId', 'patientId');
      return id ? `/(doctor)/patients/${id}` : null;
    }
    case 'lab_result_ready':
    case 'lab_result_critical':
    case 'lab_critical':
      // The results inbox is the doctor's unseen-results surface; it
      // needs no id (critical rows already sort first there).
      return '/(doctor)/orders/inbox';
    default:
      return null;
  }
}

// ── Path translation ─────────────────────────────────────────────────────────

/**
 * Translate an in-app path from the payload onto a whitelisted mobile
 * route. Accepts two shapes:
 *   - web portal paths:  /dashboard/{patient|doctor}/…  (RT-314 deepLinks)
 *   - mobile routes:     /(patient)/… or /(doctor)/…    (future producers)
 * Anything else — absolute URLs, other portals, unknown sections — null.
 */
function routeForPath(persona: MobilePersona, raw: string): string | null {
  const segments = pathSegments(raw);
  if (!segments) return null;
  const head = segments[0];

  if (head === '(patient)' || head === '(doctor)') {
    const linkPersona: MobilePersona = head === '(patient)' ? 'patient' : 'doctor';
    if (linkPersona !== persona) return null;
    return mobileRouteFromSegments(persona, segments.slice(1));
  }

  if (head !== 'dashboard') return null;
  const audience = segments[1];
  if (audience !== 'patient' && audience !== 'doctor') return null;
  if (audience !== persona) return null;

  const section = segments[2];
  const id = safeId(segments[3]);
  return persona === 'patient'
    ? patientRouteForWebSection(section, id)
    : doctorRouteForWebSection(section, id);
}

/** Web patient-portal section → mobile route. Section names are the real
 *  producer paths (results/, prescriptions/, …) plus the portal's own
 *  page names for the same surfaces. */
function patientRouteForWebSection(
  section: string | undefined,
  id: string | null,
): string | null {
  switch (section) {
    case 'prescriptions':
    case 'medications':
      return id ? `/(patient)/meds/${id}` : null;
    case 'results':
    case 'labs':
    case 'lab-results':
      return id ? `/(patient)/labs/${id}` : null;
    case 'appointments':
      return id ? `/(patient)/appointments/${id}` : null;
    case 'billing':
      return id ? `/(patient)/billing/${id}` : null;
    case 'vitals':
      return '/(patient)/vitals';
    case 'queue':
      return '/(patient)/queue';
    case 'notifications':
      return '/(patient)/notifications';
    case 'consents':
    case 'dsar':
      return '/(patient)/profile/privacy';
    default:
      return null;
  }
}

/** Web doctor-portal section → mobile route. */
function doctorRouteForWebSection(
  section: string | undefined,
  id: string | null,
): string | null {
  switch (section) {
    case undefined:
      return '/(doctor)'; // /dashboard/doctor → Today
    case 'queue':
      return '/(doctor)/queue';
    case 'lab-orders':
    case 'results-inbox':
      return '/(doctor)/orders/inbox';
    case 'referrals':
      return '/(doctor)/referrals';
    case 'medical-certificates':
      return '/(doctor)/certificates';
    case 'patients':
      return id ? `/(doctor)/patients/${id}` : null;
    default:
      return null;
  }
}

/** Validate a mobile-route payload path against the fixed target table,
 *  rebuilding the route from validated parts. */
function mobileRouteFromSegments(
  persona: MobilePersona,
  segments: string[],
): string | null {
  const head = segments[0];
  if (persona === 'patient') {
    switch (head) {
      case 'queue':
        return '/(patient)/queue';
      case 'notifications':
        return '/(patient)/notifications';
      case 'vitals':
        return '/(patient)/vitals';
      case 'profile':
        return segments[1] === 'privacy' ? '/(patient)/profile/privacy' : null;
      case 'appointments':
      case 'meds':
      case 'labs':
      case 'billing': {
        const id = safeId(segments[1]);
        return id ? `/(patient)/${head}/${id}` : null;
      }
      default:
        return null;
    }
  }
  switch (head) {
    case undefined:
      return '/(doctor)'; // bare /(doctor) → Today
    case 'queue':
      return '/(doctor)/queue';
    case 'referrals':
      return '/(doctor)/referrals';
    case 'certificates':
      return '/(doctor)/certificates';
    case 'orders':
      return segments[1] === 'inbox' ? '/(doctor)/orders/inbox' : null;
    case 'patients': {
      const id = safeId(segments[1]);
      return id ? `/(doctor)/patients/${id}` : null;
    }
    default:
      return null;
  }
}

/** Which persona a payload path belongs to — used to hard-drop payloads
 *  whose link points at someone else's portal. 'other' covers admin /
 *  pharmacy / any non-mobile portal; null = no persona signal at all. */
function pathPersona(raw: string): MobilePersona | 'other' | null {
  const segments = pathSegments(raw);
  if (!segments) return null;
  const head = segments[0];
  if (head === '(patient)') return 'patient';
  if (head === '(doctor)') return 'doctor';
  if (head === 'dashboard') {
    if (segments[1] === 'patient') return 'patient';
    if (segments[1] === 'doctor') return 'doctor';
    return 'other';
  }
  return null;
}

/** Relative in-app paths only. Strips query/hash; rejects absolute and
 *  protocol-relative URLs. Returns null when the shape is not a path. */
function pathSegments(raw: string): string[] | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return null;
  const bare = trimmed.split(/[?#]/, 1)[0] ?? '';
  return bare.split('/').filter((segment) => segment.length > 0);
}

// ── Field extraction helpers ─────────────────────────────────────────────────

/** Explicit audience stamped on the payload: persona ('patient'), or a
 *  portal role name ('PATIENT', 'DOCTOR', …) mapped through the shared
 *  role→persona table. */
function personaTarget(
  src: Record<string, unknown>,
): MobilePersona | 'other' | null {
  const raw = firstString(src, ['persona', 'audience', 'role']);
  if (!raw) return null;
  const lowered = raw.trim().toLowerCase();
  if (lowered === 'patient') return 'patient';
  if (lowered === 'doctor') return 'doctor';
  const viaRole = personaForRole(raw.trim().toUpperCase());
  if (viaRole === 'patient' || viaRole === 'doctor') return viaRole;
  return 'other';
}

/** Producer type strings arrive in mixed shapes ('lab-result.ready',
 *  'CONSENT_REQUEST_RECEIVED', 'appointment_reminder'); canonicalize to
 *  lower snake_case for the switch tables. */
function normalizeType(raw: string | null): string {
  return (raw ?? '').trim().toLowerCase().replace(/[\s.-]+/g, '_');
}

/** First safe entity id among the given keys ('entityId' first, then the
 *  entity-specific field the backend domain uses — prescriptionId,
 *  labOrderId, …). Named ids can't be cross-wired to the wrong entity. */
function idFrom(src: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const id = safeId(src[key]);
    if (id) return id;
  }
  return null;
}

/** An id is interpolated into a route path — accept only compact opaque
 *  identifiers (UUID / cuid shaped). Slashes, dots ('..'), spaces → null. */
function safeId(value: unknown): string | null {
  const raw =
    typeof value === 'string'
      ? value.trim()
      : typeof value === 'number' && Number.isFinite(value)
        ? String(value)
        : null;
  if (!raw) return null;
  return /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(raw) ? raw : null;
}

function firstString(src: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = src[key];
    if (typeof value === 'string' && value.trim().length > 0) return value;
  }
  return null;
}

/** Coerce the payload into a record: plain objects pass through; JSON
 *  strings (some transports re-serialize the data block) are parsed,
 *  size-bounded. Arrays / primitives / parse failures → null. */
function toRecord(data: unknown): Record<string, unknown> | null {
  const direct = asRecord(data);
  if (direct) return direct;
  if (typeof data === 'string' && data.length <= MAX_JSON_PAYLOAD_CHARS) {
    const trimmed = data.trim();
    if (!trimmed.startsWith('{')) return null;
    try {
      return asRecord(JSON.parse(trimmed));
    } catch {
      return null;
    }
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}
