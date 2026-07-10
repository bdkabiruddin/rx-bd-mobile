import {
  isCellLocked,
  isCellOptedOut,
  isChannelOptedOut,
  isUnread,
  mapDeepLinkToRoute,
  normalizeQuietTime,
  normalizeType,
  notificationTone,
  sortNewestFirst,
  toggleTuple,
} from '@/features/patient-notifications/logic';
import type { NotificationItem } from '@/features/patient-notifications/types';

describe('normalizeType', () => {
  it('canonicalizes producer casings and separators', () => {
    expect(normalizeType('MESSAGE_RECEIVED')).toBe('message_received');
    expect(normalizeType('appointment_reminder')).toBe('appointment_reminder');
    expect(normalizeType('Lab Result-Critical')).toBe('lab_result_critical');
    expect(normalizeType(undefined)).toBe('');
  });
});

describe('notificationTone', () => {
  it('locks CRITICAL level to danger regardless of type', () => {
    expect(notificationTone('CRITICAL', 'booking_confirmed')).toBe('danger');
    expect(notificationTone('CRITICAL', undefined)).toBe('danger');
  });

  it('maps known types and keeps unknown values neutral', () => {
    expect(notificationTone('ROUTINE', 'lab_result_critical')).toBe('danger');
    expect(notificationTone('ROUTINE', 'prescription_dispensed')).toBe('success');
    expect(notificationTone('ROUTINE', 'appointment_reminder')).toBe('info');
    expect(notificationTone('ROUTINE', 'billing_invoice')).toBe('warning');
    expect(notificationTone('ROUTINE', 'some_future_type')).toBe('neutral');
    expect(notificationTone(undefined, undefined)).toBe('neutral');
  });
});

describe('mapDeepLinkToRoute', () => {
  it('maps known patient web deep-links onto mobile routes', () => {
    expect(mapDeepLinkToRoute('/dashboard/patient/prescriptions/abc-123', null)).toBe(
      '/(patient)/meds/abc-123',
    );
    expect(mapDeepLinkToRoute('/dashboard/patient/prescriptions', null)).toBe('/(patient)/meds');
    expect(mapDeepLinkToRoute('/dashboard/patient/appointments/apt-1', null)).toBe(
      '/(patient)/appointments/apt-1',
    );
    expect(mapDeepLinkToRoute('/dashboard/patient/labs/lab-9?src=push', null)).toBe(
      '/(patient)/labs/lab-9',
    );
  });

  it('prefers deepLink over the legacy link (RT-314)', () => {
    expect(
      mapDeepLinkToRoute('/dashboard/patient/appointments', '/dashboard/patient/prescriptions'),
    ).toBe('/(patient)/appointments');
    expect(mapDeepLinkToRoute(null, '/dashboard/patient/prescriptions')).toBe('/(patient)/meds');
  });

  it('returns null for unmappable, foreign or absolute links', () => {
    expect(mapDeepLinkToRoute('/dashboard/patient/consents', null)).toBeNull();
    expect(mapDeepLinkToRoute('/dashboard/doctor/patients/p-1', null)).toBeNull();
    expect(mapDeepLinkToRoute('https://evil.example/dashboard/patient/labs', null)).toBeNull();
    expect(mapDeepLinkToRoute(null, null)).toBeNull();
    expect(mapDeepLinkToRoute('', '')).toBeNull();
  });
});

describe('sortNewestFirst / isUnread', () => {
  const items: NotificationItem[] = [
    { id: 'a', createdAt: '2026-07-01T10:00:00Z', readAt: null },
    { id: 'b', createdAt: '2026-07-03T10:00:00Z' },
    { id: 'c' }, // missing date sinks to the bottom
    { id: 'd', createdAt: '2026-07-02T10:00:00Z', readAt: '2026-07-02T11:00:00Z' },
  ];

  it('orders by createdAt desc without mutating input', () => {
    const sorted = sortNewestFirst(items);
    expect(sorted.map((n) => n.id)).toEqual(['b', 'd', 'a', 'c']);
    expect(items.map((n) => n.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('treats null/absent readAt as unread', () => {
    expect(isUnread({ id: 'a', readAt: null })).toBe(true);
    expect(isUnread({ id: 'b' })).toBe(true);
    expect(isUnread({ id: 'c', readAt: '2026-07-02T11:00:00Z' })).toBe(false);
  });
});

describe('event-type matrix tuples', () => {
  const base = [{ eventType: 'marketing', channel: 'SMS' }];

  it('adds a tuple idempotently', () => {
    const once = toggleTuple(base, 'refill_ready', 'PUSH', true);
    expect(once).toHaveLength(2);
    expect(isCellOptedOut(once, 'refill_ready', 'PUSH')).toBe(true);
    const twice = toggleTuple(once, 'refill_ready', 'PUSH', true);
    expect(twice).toHaveLength(2);
  });

  it('removes a tuple idempotently and never mutates', () => {
    const removed = toggleTuple(base, 'marketing', 'SMS', false);
    expect(removed).toHaveLength(0);
    expect(base).toHaveLength(1);
    expect(toggleTuple(removed, 'marketing', 'SMS', false)).toHaveLength(0);
    expect(toggleTuple(undefined, 'marketing', 'SMS', false)).toEqual([]);
  });

  it('locks only lab_critical × IN_APP (clinical safety)', () => {
    expect(isCellLocked('lab_critical', 'IN_APP')).toBe(true);
    expect(isCellLocked('lab_critical', 'SMS')).toBe(false);
    expect(isCellLocked('marketing', 'IN_APP')).toBe(false);
  });
});

describe('normalizeQuietTime', () => {
  it('pads to the strict 2-digit HH:mm the backend regex requires', () => {
    expect(normalizeQuietTime('7:05')).toBe('07:05');
    expect(normalizeQuietTime(' 22:00 ')).toBe('22:00');
    expect(normalizeQuietTime('00:00')).toBe('00:00');
  });

  it('rejects out-of-range and malformed values', () => {
    expect(normalizeQuietTime('24:00')).toBeNull();
    expect(normalizeQuietTime('12:60')).toBeNull();
    expect(normalizeQuietTime('12')).toBeNull();
    expect(normalizeQuietTime('12:5')).toBeNull();
    expect(normalizeQuietTime('')).toBeNull();
  });
});

describe('isChannelOptedOut', () => {
  it('matches registry rows by channel', () => {
    const rows = [{ channel: 'SMS' }, { channel: 'EMAIL' }];
    expect(isChannelOptedOut(rows, 'SMS')).toBe(true);
    expect(isChannelOptedOut(rows, 'PUSH')).toBe(false);
    expect(isChannelOptedOut(undefined, 'SMS')).toBe(false);
  });
});
