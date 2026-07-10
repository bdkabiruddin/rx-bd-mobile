// Patient live queue position — pure logic suite (Node environment,
// no RN imports).

import {
  MAX_CANDIDATE_CHAMBERS,
  MAX_DISCOVERY_DOCTORS,
  deriveChamberCandidates,
  deriveDoctorCandidates,
  dhakaDayKey,
  estWaitMinutes,
  formatNumber,
  isSameDhakaDay,
  joinParts,
  peopleAhead,
  priorityTone,
  probeOrder,
  stageTone,
} from '@/features/patient-queue/logic';
import type { AppointmentRowLite } from '@/features/patient-queue/types';

describe('stage → tone mapping', () => {
  it('maps the two-stage queue lifecycle to locked pill tones', () => {
    expect(stageTone('CHECKED_IN')).toBe('info');
    expect(stageTone('ASSISTANT_PREP')).toBe('info');
    expect(stageTone('DOCTOR_READY')).toBe('success');
    expect(stageTone('IN_CONSULTATION')).toBe('success');
    expect(stageTone('NO_SHOW')).toBe('warning');
    expect(stageTone('CANCELLED')).toBe('warning');
  });

  it('degrades unknown/absent stages to neutral', () => {
    expect(stageTone('SOMETHING_NEW')).toBe('neutral');
    expect(stageTone(undefined)).toBe('neutral');
  });
});

describe('priorityTone — pill ONLY for elevated priorities', () => {
  it('maps elevated priorities', () => {
    expect(priorityTone('EMERGENCY')).toBe('danger');
    expect(priorityTone('URGENT')).toBe('warning');
  });

  it('renders NO pill for normal/absent/unknown priority', () => {
    expect(priorityTone('NORMAL')).toBeNull();
    expect(priorityTone(undefined)).toBeNull();
    expect(priorityTone(null)).toBeNull();
    expect(priorityTone('SOMETHING_NEW')).toBeNull();
  });
});

describe('peopleAhead — derived from the backend 1-based position only', () => {
  it('is position - 1 for valid positions', () => {
    expect(peopleAhead(1)).toBe(0);
    expect(peopleAhead(2)).toBe(1);
    expect(peopleAhead(17)).toBe(16);
  });

  it('never invents a count from an unusable position', () => {
    expect(peopleAhead(null)).toBeNull();
    expect(peopleAhead(undefined)).toBeNull();
    expect(peopleAhead(0)).toBeNull();
    expect(peopleAhead(-3)).toBeNull();
    expect(peopleAhead(Number.NaN)).toBeNull();
  });
});

describe('estWaitMinutes — 0 means "not estimated"', () => {
  it('passes through positive estimates (rounded)', () => {
    expect(estWaitMinutes(25)).toBe(25);
    expect(estWaitMinutes(12.6)).toBe(13);
  });

  it('renders nothing when the backend sent no positive estimate', () => {
    expect(estWaitMinutes(0)).toBeNull();
    expect(estWaitMinutes(-5)).toBeNull();
    expect(estWaitMinutes(undefined)).toBeNull();
    expect(estWaitMinutes(null)).toBeNull();
    expect(estWaitMinutes(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('formatNumber — locale-aware numerals', () => {
  it('uses Bangla digits for bn and Latin for en', () => {
    expect(formatNumber(3, 'bn')).toBe('৩');
    expect(formatNumber(3, 'en')).toBe('3');
    expect(formatNumber(1250, 'en')).toBe('1,250');
  });
});

describe('Dhaka day helpers (UTC+6)', () => {
  it('keys an instant by its Dhaka calendar day', () => {
    // 19:00Z = 01:00 next day in Dhaka.
    expect(dhakaDayKey('2026-07-09T19:00:00Z')).toBe('2026-07-10');
    // 17:59Z = 23:59 the same day in Dhaka.
    expect(dhakaDayKey('2026-07-09T17:59:00Z')).toBe('2026-07-09');
  });

  it('compares same-Dhaka-day across the UTC midnight boundary', () => {
    const now = new Date('2026-07-10T02:00:00Z'); // 08:00 Dhaka, 10 Jul
    expect(isSameDhakaDay('2026-07-09T19:00:00Z', now)).toBe(true); // 01:00 Dhaka, 10 Jul
    expect(isSameDhakaDay('2026-07-09T17:00:00Z', now)).toBe(false); // 23:00 Dhaka, 9 Jul
  });

  it('never treats a malformed timestamp as today', () => {
    expect(isSameDhakaDay('not-a-date')).toBe(false);
    expect(isSameDhakaDay('')).toBe(false);
  });
});

describe('deriveDoctorCandidates — today + active statuses only', () => {
  const now = new Date('2026-07-10T04:00:00Z'); // 10:00 Dhaka
  const row = (over: Partial<AppointmentRowLite>): AppointmentRowLite => ({
    appointmentId: 'a1',
    doctorUserId: 'doc-1',
    doctorName: 'Dr. Rahim',
    scheduledAt: '2026-07-10T05:00:00Z',
    status: 'CONFIRMED',
    ...over,
  });

  it('collects unique doctors from today’s active rows with their names', () => {
    const { doctorIds, doctorNameById } = deriveDoctorCandidates(
      [
        row({ appointmentId: 'a1', doctorUserId: 'doc-1' }),
        row({ appointmentId: 'a2', doctorUserId: 'doc-2', doctorName: 'Dr. Karim' }),
        row({ appointmentId: 'a3', doctorUserId: 'doc-1' }), // duplicate doctor
      ],
      now,
    );
    expect(doctorIds).toEqual(['doc-1', 'doc-2']);
    expect(doctorNameById.get('doc-1')).toBe('Dr. Rahim');
    expect(doctorNameById.get('doc-2')).toBe('Dr. Karim');
  });

  it('skips terminal statuses, other days, and doctor-less rows', () => {
    const { doctorIds } = deriveDoctorCandidates(
      [
        row({ status: 'CANCELLED' }),
        row({ status: 'COMPLETED' }),
        row({ scheduledAt: '2026-07-11T05:00:00Z' }), // tomorrow
        row({ doctorUserId: null }),
        row({ appointmentId: 'ok', doctorUserId: 'doc-9', status: 'CHECKED_IN' }),
      ],
      now,
    );
    expect(doctorIds).toEqual(['doc-9']);
  });

  it('bounds the doctor fan-out and tolerates absent lists', () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      row({ appointmentId: `a${i}`, doctorUserId: `doc-${i}` }),
    );
    expect(deriveDoctorCandidates(many, now).doctorIds).toHaveLength(
      MAX_DISCOVERY_DOCTORS,
    );
    expect(deriveDoctorCandidates(undefined, now).doctorIds).toEqual([]);
    expect(deriveDoctorCandidates(null, now).doctorIds).toEqual([]);
  });
});

describe('deriveChamberCandidates', () => {
  it('flattens, de-duplicates, keeps names, and bounds the probe set', () => {
    const { chamberIds, chamberNameById } = deriveChamberCandidates([
      [
        { id: 'c1', name: 'Green Care Chamber' },
        { id: 'c2', name: '' },
      ],
      null,
      [{ id: 'c1', name: 'Duplicate Name Ignored' }, { id: 'c3' }],
    ]);
    expect(chamberIds).toEqual(['c1', 'c2', 'c3']);
    expect(chamberNameById.get('c1')).toBe('Green Care Chamber');
    expect(chamberNameById.has('c2')).toBe(false); // empty name → no entry
    expect(chamberNameById.has('c3')).toBe(false);
  });

  it('caps the candidate list', () => {
    const big = [
      Array.from({ length: 10 }, (_, i) => ({ id: `c${i}` })),
    ];
    expect(deriveChamberCandidates(big).chamberIds).toHaveLength(
      MAX_CANDIDATE_CHAMBERS,
    );
  });
});

describe('probeOrder — locked chamber first', () => {
  it('moves the locked chamber to the front', () => {
    expect(probeOrder(['a', 'b', 'c'], 'b')).toEqual(['b', 'a', 'c']);
  });

  it('leaves order alone when nothing is locked or the lock is gone', () => {
    expect(probeOrder(['a', 'b'], null)).toEqual(['a', 'b']);
    expect(probeOrder(['a', 'b'], 'z')).toEqual(['a', 'b']);
  });
});

describe('joinParts', () => {
  it('joins only defined, non-empty parts', () => {
    expect(joinParts(['Token A-12', undefined, 'Serial 12', null, ''])).toBe(
      'Token A-12 · Serial 12',
    );
    expect(joinParts([undefined, null])).toBe('');
  });
});
