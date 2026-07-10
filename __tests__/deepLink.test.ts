// Push deep-linking — pure route-resolution suite (Node environment, no
// RN imports). Covers every mapped notification type, web→mobile path
// translation, persona gating, and the never-throws contract on
// malformed / hostile payloads.

import { useSession } from '@/auth/sessionStore';
import {
  pushDataCandidates,
  routeForNotification,
  routeForNotificationResponse,
  routeForPersona,
} from '@/push/deepLink';

afterEach(() => {
  useSession.getState().clear();
});

// ── Type → route, patient persona ────────────────────────────────────────────

describe('routeForPersona — patient type mapping', () => {
  it('maps lab result types (producer casing) to the lab-order detail', () => {
    expect(
      routeForPersona('patient', { type: 'lab-result.ready', entityId: 'ord-1' }),
    ).toBe('/(patient)/labs/ord-1');
    expect(
      routeForPersona('patient', { type: 'lab-result.critical', entityId: 'ord-2' }),
    ).toBe('/(patient)/labs/ord-2');
    // Preference-matrix event key alias.
    expect(routeForPersona('patient', { type: 'lab_critical', entityId: 'ord-3' })).toBe(
      '/(patient)/labs/ord-3',
    );
    // Entity-specific id field.
    expect(
      routeForPersona('patient', { type: 'lab-result.ready', labOrderId: 'ord-4' }),
    ).toBe('/(patient)/labs/ord-4');
  });

  it('maps vitals, queue, consent types to their static routes', () => {
    expect(routeForPersona('patient', { type: 'vital.trend_alert' })).toBe(
      '/(patient)/vitals',
    );
    expect(routeForPersona('patient', { type: 'queue.entry_called' })).toBe(
      '/(patient)/queue',
    );
    expect(routeForPersona('patient', { type: 'CONSENT_REQUEST_RECEIVED' })).toBe(
      '/(patient)/profile/privacy',
    );
  });

  it('maps medication types to the prescription detail', () => {
    expect(
      routeForPersona('patient', { type: 'medication.dose-reminder', entityId: 'rx-1' }),
    ).toBe('/(patient)/meds/rx-1');
    expect(
      routeForPersona('patient', { type: 'refill_ready', prescriptionId: 'rx-2' }),
    ).toBe('/(patient)/meds/rx-2');
    expect(
      routeForPersona('patient', { type: 'prescription_dispensed', entityId: 'rx-3' }),
    ).toBe('/(patient)/meds/rx-3');
  });

  it('maps appointment and billing types to their detail routes', () => {
    expect(
      routeForPersona('patient', { type: 'appointment_reminder', entityId: 'apt-1' }),
    ).toBe('/(patient)/appointments/apt-1');
    expect(
      routeForPersona('patient', { type: 'booking_confirmed', appointmentId: 'apt-2' }),
    ).toBe('/(patient)/appointments/apt-2');
    expect(
      routeForPersona('patient', { type: 'billing_invoice', invoiceId: 'inv-1' }),
    ).toBe('/(patient)/billing/inv-1');
    // Numeric ids (iOS userInfo may carry numbers) coerce safely.
    expect(routeForPersona('patient', { type: 'billing_invoice', entityId: 42 })).toBe(
      '/(patient)/billing/42',
    );
  });

  it('reads the type from category/eventType fallbacks', () => {
    expect(routeForPersona('patient', { category: 'vital.trend_alert' })).toBe(
      '/(patient)/vitals',
    );
    expect(
      routeForPersona('patient', { eventType: 'booking_confirmed', entityId: 'apt-9' }),
    ).toBe('/(patient)/appointments/apt-9');
  });

  it('returns null for a detail-route type with a missing or unsafe id', () => {
    expect(routeForPersona('patient', { type: 'lab-result.ready' })).toBeNull();
    expect(
      routeForPersona('patient', { type: 'lab-result.ready', entityId: 'a/b' }),
    ).toBeNull();
    expect(
      routeForPersona('patient', { type: 'medication.dose-reminder', entityId: '../x' }),
    ).toBeNull();
    expect(
      routeForPersona('patient', { type: 'billing_invoice', entityId: '' }),
    ).toBeNull();
  });

  it('returns null for types with no mobile surface (honest no-op)', () => {
    expect(routeForPersona('patient', { type: 'MESSAGE_RECEIVED' })).toBeNull();
    expect(routeForPersona('patient', { type: 'anc-visit.reminder' })).toBeNull();
    expect(
      routeForPersona('patient', { type: 'patient.legacy-data-reconcile' }),
    ).toBeNull();
    expect(routeForPersona('patient', { type: 'SECURITY_ALERT' })).toBeNull();
    expect(routeForPersona('patient', { type: 'totally_unknown_type' })).toBeNull();
  });
});

// ── Type → route, doctor persona ─────────────────────────────────────────────

describe('routeForPersona — doctor type mapping', () => {
  it('maps the care-plan recall to the patient chart', () => {
    expect(
      routeForPersona('doctor', { type: 'CARE_PLAN_REVIEW_OVERDUE', entityId: 'pt-1' }),
    ).toBe('/(doctor)/patients/pt-1');
    expect(
      routeForPersona('doctor', { type: 'CARE_PLAN_REVIEW_OVERDUE', patientId: 'pt-2' }),
    ).toBe('/(doctor)/patients/pt-2');
    expect(routeForPersona('doctor', { type: 'CARE_PLAN_REVIEW_OVERDUE' })).toBeNull();
  });

  it('maps lab-result types to the results inbox (no id required)', () => {
    expect(routeForPersona('doctor', { type: 'lab-result.critical' })).toBe(
      '/(doctor)/orders/inbox',
    );
    expect(routeForPersona('doctor', { type: 'lab-result.ready' })).toBe(
      '/(doctor)/orders/inbox',
    );
  });

  it('does not leak patient-only types into the doctor stack', () => {
    expect(
      routeForPersona('doctor', { type: 'medication.dose-reminder', entityId: 'rx-1' }),
    ).toBeNull();
    expect(routeForPersona('doctor', { type: 'vital.trend_alert' })).toBeNull();
    expect(
      routeForPersona('doctor', { type: 'billing_invoice', entityId: 'inv-1' }),
    ).toBeNull();
  });
});

// ── Web-path translation ─────────────────────────────────────────────────────

describe('routeForPersona — web deepLink translation', () => {
  it('translates real patient producer paths', () => {
    // NotifyPatientOfLabResultConsumer → /dashboard/patient/results/{labOrderId}
    expect(routeForPersona('patient', { deepLink: '/dashboard/patient/results/ord-9' })).toBe(
      '/(patient)/labs/ord-9',
    );
    // DoseReminderFiringCron → /dashboard/patient/prescriptions/{id}
    expect(
      routeForPersona('patient', { deepLink: '/dashboard/patient/prescriptions/rx-7' }),
    ).toBe('/(patient)/meds/rx-7');
    // NotifyOnVitalTrendAlertConsumer → /dashboard/patient/vitals
    expect(routeForPersona('patient', { link: '/dashboard/patient/vitals' })).toBe(
      '/(patient)/vitals',
    );
    // RequestConsentHandler → /dashboard/patient/consents
    expect(routeForPersona('patient', { deepLink: '/dashboard/patient/consents' })).toBe(
      '/(patient)/profile/privacy',
    );
  });

  it('translates the remaining patient portal sections in the route table', () => {
    expect(
      routeForPersona('patient', { deepLink: '/dashboard/patient/appointments/apt-3' }),
    ).toBe('/(patient)/appointments/apt-3');
    expect(routeForPersona('patient', { deepLink: '/dashboard/patient/billing/inv-2' })).toBe(
      '/(patient)/billing/inv-2',
    );
    expect(routeForPersona('patient', { deepLink: '/dashboard/patient/queue' })).toBe(
      '/(patient)/queue',
    );
    expect(routeForPersona('patient', { deepLink: '/dashboard/patient/notifications' })).toBe(
      '/(patient)/notifications',
    );
    expect(routeForPersona('patient', { deepLink: '/dashboard/patient/labs/ord-1' })).toBe(
      '/(patient)/labs/ord-1',
    );
    expect(routeForPersona('patient', { deepLink: '/dashboard/patient/dsar' })).toBe(
      '/(patient)/profile/privacy',
    );
  });

  it('translates doctor portal paths', () => {
    // CarePlanRecallCron → /dashboard/doctor/patients/{patientId}
    expect(routeForPersona('doctor', { deepLink: '/dashboard/doctor/patients/pt-5' })).toBe(
      '/(doctor)/patients/pt-5',
    );
    expect(routeForPersona('doctor', { deepLink: '/dashboard/doctor/queue' })).toBe(
      '/(doctor)/queue',
    );
    expect(routeForPersona('doctor', { deepLink: '/dashboard/doctor/lab-orders' })).toBe(
      '/(doctor)/orders/inbox',
    );
    expect(routeForPersona('doctor', { deepLink: '/dashboard/doctor/results-inbox' })).toBe(
      '/(doctor)/orders/inbox',
    );
    expect(routeForPersona('doctor', { deepLink: '/dashboard/doctor/referrals' })).toBe(
      '/(doctor)/referrals',
    );
    expect(
      routeForPersona('doctor', { deepLink: '/dashboard/doctor/medical-certificates' }),
    ).toBe('/(doctor)/certificates');
    // Portal root → Today.
    expect(routeForPersona('doctor', { deepLink: '/dashboard/doctor' })).toBe('/(doctor)');
  });

  it('strips query strings and ignores trailing sub-paths safely', () => {
    expect(
      routeForPersona('patient', { deepLink: '/dashboard/patient/results/ord-9?src=push' }),
    ).toBe('/(patient)/labs/ord-9');
    expect(
      routeForPersona('patient', { deepLink: '/dashboard/patient/notifications/archive' }),
    ).toBe('/(patient)/notifications');
  });

  it('prefers deepLink over the legacy link (RT-314 contract)', () => {
    expect(
      routeForPersona('patient', {
        deepLink: '/dashboard/patient/vitals',
        link: '/dashboard/patient/queue',
      }),
    ).toBe('/(patient)/vitals');
  });

  it('falls through to the type mapping when the link has no persona signal', () => {
    // MESSAGE_RECEIVED rows carry link '/messages' — not translatable, but
    // it must not block an otherwise-mappable type.
    expect(
      routeForPersona('patient', { link: '/messages', type: 'vital.trend_alert' }),
    ).toBe('/(patient)/vitals');
  });

  it('rejects list paths without an id (strict target table)', () => {
    expect(
      routeForPersona('patient', { deepLink: '/dashboard/patient/prescriptions' }),
    ).toBeNull();
    expect(routeForPersona('doctor', { deepLink: '/dashboard/doctor/patients' })).toBeNull();
  });

  it('rejects absolute, protocol-relative and non-portal paths', () => {
    expect(
      routeForPersona('patient', { deepLink: 'https://evil.example/dashboard/patient/vitals' }),
    ).toBeNull();
    expect(
      routeForPersona('patient', { deepLink: 'https://app.rx.bd/dashboard/patient/vitals' }),
    ).toBeNull();
    expect(
      routeForPersona('patient', { deepLink: '//evil.example/dashboard/patient/vitals' }),
    ).toBeNull();
    expect(routeForPersona('patient', { deepLink: '/dashboard/patient/profile' })).toBeNull();
    expect(
      routeForPersona('patient', { deepLink: '/dashboard/patient/maternal-care' }),
    ).toBeNull();
    expect(routeForPersona('doctor', { deepLink: '/dashboard/doctor/schedule' })).toBeNull();
  });

  it('accepts already-mobile routes only when they match the target table', () => {
    expect(routeForPersona('patient', { deepLink: '/(patient)/labs/ord-1' })).toBe(
      '/(patient)/labs/ord-1',
    );
    expect(routeForPersona('patient', { deepLink: '/(patient)/profile/privacy' })).toBe(
      '/(patient)/profile/privacy',
    );
    expect(routeForPersona('doctor', { deepLink: '/(doctor)/orders/inbox' })).toBe(
      '/(doctor)/orders/inbox',
    );
    expect(routeForPersona('doctor', { deepLink: '/(doctor)' })).toBe('/(doctor)');
    // Not in the table → null, never echoed through.
    expect(routeForPersona('patient', { deepLink: '/(patient)/records' })).toBeNull();
    expect(routeForPersona('doctor', { deepLink: '/(doctor)/prescribe/pt-1' })).toBeNull();
  });
});

// ── Persona gating ───────────────────────────────────────────────────────────

describe('routeForPersona — persona gate', () => {
  it("drops the other persona's web links", () => {
    expect(routeForPersona('doctor', { deepLink: '/dashboard/patient/vitals' })).toBeNull();
    expect(
      routeForPersona('patient', { deepLink: '/dashboard/doctor/patients/pt-1' }),
    ).toBeNull();
    expect(routeForPersona('patient', { deepLink: '/(doctor)/queue' })).toBeNull();
  });

  it('drops payloads whose explicit persona/role targets someone else', () => {
    expect(
      routeForPersona('doctor', { persona: 'patient', type: 'lab-result.critical' }),
    ).toBeNull();
    expect(
      routeForPersona('doctor', { role: 'PATIENT', type: 'lab-result.critical' }),
    ).toBeNull();
    expect(
      routeForPersona('patient', { audience: 'doctor', type: 'vital.trend_alert' }),
    ).toBeNull();
    // Non-mobile portal roles never resolve.
    expect(
      routeForPersona('patient', { role: 'HOSPITAL_ADMIN', type: 'vital.trend_alert' }),
    ).toBeNull();
    // Matching stamp still resolves.
    expect(routeForPersona('patient', { persona: 'patient', type: 'vital.trend_alert' })).toBe(
      '/(patient)/vitals',
    );
    expect(routeForPersona('patient', { role: 'PATIENT', type: 'vital.trend_alert' })).toBe(
      '/(patient)/vitals',
    );
  });

  it('treats mixed signals as untrusted (foreign link + mappable type)', () => {
    expect(
      routeForPersona('patient', {
        deepLink: '/dashboard/doctor/patients/pt-1',
        type: 'lab-result.ready',
        entityId: 'ord-1',
      }),
    ).toBeNull();
    // Admin portal link poisons the payload too.
    expect(
      routeForPersona('patient', {
        deepLink: '/dashboard/admin/audit',
        type: 'vital.trend_alert',
      }),
    ).toBeNull();
  });

  it('returns null for personas without a mobile stack', () => {
    const payload = { type: 'lab-result.ready', entityId: 'ord-1' };
    expect(routeForPersona('pharmacy', payload)).toBeNull();
    expect(routeForPersona('admin', payload)).toBeNull();
    expect(routeForPersona('staff', payload)).toBeNull();
    expect(routeForPersona('', payload)).toBeNull();
  });
});

// ── Malformed payloads — never throws ────────────────────────────────────────

describe('routeForPersona — malformed payloads', () => {
  const junk: unknown[] = [
    null,
    undefined,
    7,
    true,
    [],
    [{ type: 'vital.trend_alert' }],
    'not json',
    '[1,2]',
    '{broken json',
    {},
    { type: 99 },
    { type: '   ' },
    { type: { nested: true } },
    { deepLink: 123 },
    { deepLink: { path: '/dashboard/patient/vitals' } },
    { entityId: 'ord-1' }, // id without a type
    { dataString: 42 },
    { dataString: '{broken' },
  ];

  it.each(junk.map((value) => [value] as [unknown]))(
    'resolves %p to null without throwing',
    (value) => {
      expect(() => routeForPersona('patient', value)).not.toThrow();
      expect(routeForPersona('patient', value)).toBeNull();
      expect(() => routeForPersona('doctor', value)).not.toThrow();
      expect(routeForPersona('doctor', value)).toBeNull();
    },
  );

  it('survives hostile objects with throwing getters', () => {
    const evil = {};
    Object.defineProperty(evil, 'type', {
      enumerable: true,
      get() {
        throw new Error('boom');
      },
    });
    expect(() => routeForPersona('patient', evil)).not.toThrow();
    expect(routeForPersona('patient', evil)).toBeNull();
  });

  it('parses JSON-string payloads (re-serialized data blocks)', () => {
    expect(routeForPersona('patient', '{"type":"vital.trend_alert"}')).toBe(
      '/(patient)/vitals',
    );
    expect(
      routeForPersona('patient', {
        dataString: '{"deepLink":"/dashboard/patient/results/ord-3"}',
      }),
    ).toBe('/(patient)/labs/ord-3');
  });
});

// ── Active-persona entry point (sessionAccess) ───────────────────────────────

describe('routeForNotification — session-derived persona', () => {
  it('resolves with the signed-in role and goes null when no session', () => {
    useSession.setState({ status: 'active', role: 'PATIENT' });
    expect(routeForNotification({ type: 'lab-result.ready', entityId: 'ord-1' })).toBe(
      '/(patient)/labs/ord-1',
    );

    useSession.setState({ role: 'DOCTOR' });
    expect(
      routeForNotification({ type: 'CARE_PLAN_REVIEW_OVERDUE', entityId: 'pt-1' }),
    ).toBe('/(doctor)/patients/pt-1');
    expect(routeForNotification({ type: 'lab-result.ready', entityId: 'ord-1' })).toBe(
      '/(doctor)/orders/inbox',
    );

    useSession.getState().clear(); // anon — role '' → no mobile persona
    expect(routeForNotification({ type: 'lab-result.ready', entityId: 'ord-1' })).toBeNull();
  });
});

// ── NotificationResponse extraction ──────────────────────────────────────────

describe('routeForNotificationResponse — payload locations', () => {
  it('reads request.content.data (canonical location)', () => {
    useSession.setState({ status: 'active', role: 'PATIENT' });
    const response = {
      actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
      notification: {
        date: 1752130000000,
        request: {
          identifier: 'n-1',
          content: { data: { type: 'lab-result.ready', entityId: 'ord-7' } },
          trigger: { type: 'push' },
        },
      },
    };
    expect(routeForNotificationResponse(response)).toBe('/(patient)/labs/ord-7');
  });

  it('falls back to the Android trigger.remoteMessage.data block', () => {
    useSession.setState({ status: 'active', role: 'PATIENT' });
    const response = {
      actionIdentifier: 'default',
      notification: {
        date: 1,
        request: {
          identifier: 'n-2',
          content: { data: undefined },
          trigger: {
            type: 'push',
            remoteMessage: { data: { deepLink: '/dashboard/patient/vitals' } },
          },
        },
      },
    };
    expect(routeForNotificationResponse(response)).toBe('/(patient)/vitals');
  });

  it('falls back to the iOS trigger.payload (userInfo) block', () => {
    useSession.setState({ status: 'active', role: 'PATIENT' });
    const response = {
      actionIdentifier: 'default',
      notification: {
        date: 2,
        request: {
          identifier: 'n-3',
          content: {},
          trigger: {
            type: 'push',
            payload: { aps: { alert: 'x' }, type: 'CONSENT_REQUEST_RECEIVED' },
          },
        },
      },
    };
    expect(routeForNotificationResponse(response)).toBe('/(patient)/profile/privacy');
  });

  it('tries later candidates when the first data block is unmappable', () => {
    useSession.setState({ status: 'active', role: 'PATIENT' });
    const response = {
      notification: {
        request: {
          content: { data: { type: 'unknown_type' } },
          trigger: {
            remoteMessage: { data: { type: 'vital.trend_alert' } },
          },
        },
      },
    };
    expect(routeForNotificationResponse(response)).toBe('/(patient)/vitals');
  });

  it('returns null for empty / malformed responses without throwing', () => {
    useSession.setState({ status: 'active', role: 'PATIENT' });
    expect(routeForNotificationResponse(null)).toBeNull();
    expect(routeForNotificationResponse(undefined)).toBeNull();
    expect(routeForNotificationResponse({})).toBeNull();
    expect(routeForNotificationResponse({ notification: { request: {} } })).toBeNull();
    expect(routeForNotificationResponse('garbage')).toBeNull();
  });

  it('pushDataCandidates collects every location in priority order', () => {
    const response = {
      notification: {
        request: {
          content: { data: { a: 1 } },
          trigger: { remoteMessage: { data: { b: 2 } }, payload: { c: 3 } },
        },
      },
    };
    expect(pushDataCandidates(response)).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }]);
    expect(pushDataCandidates(null)).toEqual([]);
    expect(pushDataCandidates({})).toEqual([]);
  });
});
