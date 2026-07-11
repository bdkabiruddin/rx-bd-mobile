// Doctor Today + schedule management — pure logic suite (Node environment,
// no RN imports).

import {
  MAX_BLOCK_RANGE_DAYS,
  appointmentStatusTone,
  buildBlockBody,
  buildRemoveSlotBody,
  chamberDisplayName,
  dhakaDateTimeParts,
  dhakaDayKey,
  dhakaMinuteOfDay,
  filterTodays,
  formatMinuteOfDay,
  formatNumber,
  groupSlotsByDay,
  makeEmptyBlockDraft,
  nextStatusActions,
  parseDhakaDateTimeMs,
  shortPatientRef,
  statusNeedsReason,
} from '@/features/doctor-schedule/logic';
import type { MyScheduleSlot } from '@/features/doctor-schedule/types';

describe('nextStatusActions (doctor Today status transitions)', () => {
  it('offers check-in / no-show / cancel from SCHEDULED and CONFIRMED', () => {
    expect(nextStatusActions('SCHEDULED')).toEqual(['CHECKED_IN', 'NO_SHOW', 'CANCELLED']);
    expect(nextStatusActions('CONFIRMED')).toEqual(['CHECKED_IN', 'NO_SHOW', 'CANCELLED']);
  });
  it('advances CHECKED_IN → start / no-show / cancel', () => {
    expect(nextStatusActions('CHECKED_IN')).toEqual(['IN_PROGRESS', 'NO_SHOW', 'CANCELLED']);
  });
  it('offers only complete / cancel while IN_PROGRESS', () => {
    expect(nextStatusActions('IN_PROGRESS')).toEqual(['COMPLETED', 'CANCELLED']);
  });
  it('returns no actions for terminal / unknown statuses', () => {
    for (const s of ['COMPLETED', 'NO_SHOW', 'CANCELLED', 'WEIRD']) {
      expect(nextStatusActions(s)).toEqual([]);
    }
  });
  it('requires a reason only for cancel / no-show', () => {
    expect(statusNeedsReason('CANCELLED')).toBe(true);
    expect(statusNeedsReason('NO_SHOW')).toBe(true);
    expect(statusNeedsReason('CHECKED_IN')).toBe(false);
    expect(statusNeedsReason('IN_PROGRESS')).toBe(false);
    expect(statusNeedsReason('COMPLETED')).toBe(false);
  });
});

describe('appointmentStatusTone — locked pill tones', () => {
  it('maps the appointment lifecycle', () => {
    expect(appointmentStatusTone('SCHEDULED')).toBe('info');
    expect(appointmentStatusTone('CHECKED_IN')).toBe('info');
    expect(appointmentStatusTone('CONFIRMED')).toBe('success');
    expect(appointmentStatusTone('IN_PROGRESS')).toBe('warning');
    expect(appointmentStatusTone('NO_SHOW')).toBe('warning');
    expect(appointmentStatusTone('CANCELLED')).toBe('danger');
    expect(appointmentStatusTone('COMPLETED')).toBe('neutral');
  });

  it('degrades unknown statuses to neutral', () => {
    expect(appointmentStatusTone('SOMETHING_NEW')).toBe('neutral');
    expect(appointmentStatusTone('')).toBe('neutral');
  });
});

describe('Dhaka day/time math (UTC+6, no DST)', () => {
  it('rolls the day key at 18:00 UTC', () => {
    expect(dhakaDayKey('2026-07-09T17:59:00Z')).toBe('2026-07-09');
    expect(dhakaDayKey('2026-07-09T18:00:00Z')).toBe('2026-07-10');
  });

  it('returns null for unparseable timestamps', () => {
    expect(dhakaDayKey('not-a-date')).toBeNull();
    expect(dhakaMinuteOfDay('not-a-date')).toBeNull();
  });

  it('computes the Dhaka minute-of-day', () => {
    // 03:30 UTC → 09:30 Dhaka.
    expect(dhakaMinuteOfDay('2026-07-10T03:30:00Z')).toBe(9 * 60 + 30);
    // 18:00 UTC → 00:00 Dhaka (next day).
    expect(dhakaMinuteOfDay('2026-07-09T18:00:00Z')).toBe(0);
  });

  it('formats minute-of-day as a clock reading', () => {
    expect(formatMinuteOfDay(9 * 60 + 30, 'en')).toBe('09:30');
    expect(formatMinuteOfDay(0, 'en')).toBe('00:00');
  });

  it('uses Bangla numerals for bn', () => {
    expect(formatNumber(3, 'bn')).toBe('৩');
    expect(formatNumber(30, 'en')).toBe('30');
  });
});

describe('filterTodays — Dhaka calendar day, time order', () => {
  // "Now" = 2026-07-10 10:00 Dhaka (04:00 UTC).
  const nowMs = Date.parse('2026-07-10T04:00:00Z');

  it('keeps only today rows and sorts ascending', () => {
    const rows = [
      { appointmentId: 'c', scheduledAt: '2026-07-10T11:00:00+06:00', status: 'SCHEDULED' },
      { appointmentId: 'a', scheduledAt: '2026-07-10T10:30:00+06:00', status: 'CONFIRMED' },
      // Tomorrow (Dhaka) — 18:30 UTC today is already 2026-07-11 00:30 Dhaka.
      { appointmentId: 'x', scheduledAt: '2026-07-10T18:30:00Z', status: 'SCHEDULED' },
      // A completely different day.
      { appointmentId: 'y', scheduledAt: '2026-07-12T09:00:00+06:00', status: 'SCHEDULED' },
    ];
    expect(filterTodays(rows, nowMs).map((r) => r.appointmentId)).toEqual(['a', 'c']);
  });

  it('drops unparseable timestamps instead of mis-bucketing them', () => {
    const rows = [{ appointmentId: 'bad', scheduledAt: 'garbage', status: 'SCHEDULED' }];
    expect(filterTodays(rows, nowMs)).toEqual([]);
  });
});

describe('shortPatientRef — real id fragment, never fabricated', () => {
  it('returns the first 8 chars', () => {
    expect(shortPatientRef('a1b2c3d4-0000-0000-0000-000000000000')).toBe('a1b2c3d4');
  });

  it('returns null when there is no id', () => {
    expect(shortPatientRef(undefined)).toBeNull();
    expect(shortPatientRef('')).toBeNull();
  });
});

describe('groupSlotsByDay — canonical week order', () => {
  const slot = (
    id: string,
    dayOfWeek: string,
    start: number,
    end: number,
  ): MyScheduleSlot => ({ id, dayOfWeek, startMinuteOfDay: start, endMinuteOfDay: end });

  it('groups in MONDAY→SUNDAY order and sorts within a day', () => {
    const groups = groupSlotsByDay([
      slot('s3', 'FRIDAY', 540, 720),
      slot('s1', 'MONDAY', 900, 1020),
      slot('s2', 'MONDAY', 540, 720),
    ]);
    expect(groups.map((g) => g.day)).toEqual(['MONDAY', 'FRIDAY']);
    expect(groups[0]?.slots.map((s) => s.id)).toEqual(['s2', 's1']);
  });

  it('keeps unknown day values (honest) at the end', () => {
    const groups = groupSlotsByDay([
      slot('s1', 'NEWDAY', 540, 720),
      slot('s2', 'SUNDAY', 540, 720),
    ]);
    expect(groups.map((g) => g.day)).toEqual(['SUNDAY', 'NEWDAY']);
  });

  it('returns no groups for no slots', () => {
    expect(groupSlotsByDay([])).toEqual([]);
  });
});

describe('buildRemoveSlotBody — replace-semantics removal', () => {
  const slots: MyScheduleSlot[] = [
    { id: 'a', dayOfWeek: 'MONDAY', startMinuteOfDay: 540, endMinuteOfDay: 720, facilityId: 'cham-1' },
    { id: 'b', dayOfWeek: 'TUESDAY', startMinuteOfDay: 600, endMinuteOfDay: 780 },
  ];

  it('publishes the remaining slots (normalizing absent facilityId to null)', () => {
    expect(buildRemoveSlotBody(slots, 'a')).toEqual({
      slots: [
        { dayOfWeek: 'TUESDAY', startMinuteOfDay: 600, endMinuteOfDay: 780, facilityId: null },
      ],
    });
  });

  it('can remove the last slot (empty replace set is valid)', () => {
    expect(buildRemoveSlotBody(slots.slice(0, 1), 'a')).toEqual({ slots: [] });
  });

  it('returns null when the id is not in the set (no accidental republish)', () => {
    expect(buildRemoveSlotBody(slots, 'missing')).toBeNull();
  });
});

describe('parseDhakaDateTimeMs — strict wall-clock parsing', () => {
  it('parses a valid Dhaka datetime as UTC+6', () => {
    expect(parseDhakaDateTimeMs('2026-07-10', '09:30')).toBe(
      Date.parse('2026-07-10T09:30:00+06:00'),
    );
  });

  it('rejects bad formats and rolled-over calendar days', () => {
    expect(parseDhakaDateTimeMs('2026-7-10', '09:30')).toBeNull();
    expect(parseDhakaDateTimeMs('2026-07-10', '9:30')).toBeNull();
    expect(parseDhakaDateTimeMs('2026-07-10', '24:00')).toBeNull();
    expect(parseDhakaDateTimeMs('2026-02-30', '09:30')).toBeNull();
  });

  it('round-trips with dhakaDateTimeParts', () => {
    const now = new Date('2026-07-10T04:07:00Z');
    const { date, time } = dhakaDateTimeParts(now);
    expect(date).toBe('2026-07-10');
    expect(time).toBe('10:07');
    expect(parseDhakaDateTimeMs(date, time)).toBe(now.getTime());
  });
});

describe('buildBlockBody — mirrors the backend guards', () => {
  const base = {
    startDate: '2026-07-15',
    startTime: '09:00',
    endDate: '2026-07-15',
    endTime: '17:00',
    reason: '',
  };

  it('builds ISO UTC bounds and omits the empty reason', () => {
    const out = buildBlockBody(base);
    expect(out).toEqual({
      ok: true,
      body: {
        startsAt: new Date(Date.parse('2026-07-15T09:00:00+06:00')).toISOString(),
        endsAt: new Date(Date.parse('2026-07-15T17:00:00+06:00')).toISOString(),
      },
    });
  });

  it('trims and includes a non-empty reason', () => {
    const out = buildBlockBody({ ...base, reason: '  annual leave  ' });
    expect(out.ok && out.body.reason).toBe('annual leave');
  });

  it('flags invalid start / end inputs', () => {
    expect(buildBlockBody({ ...base, startDate: 'nope' })).toEqual({
      ok: false,
      issue: { kind: 'START_INVALID' },
    });
    expect(buildBlockBody({ ...base, endTime: '25:00' })).toEqual({
      ok: false,
      issue: { kind: 'END_INVALID' },
    });
  });

  it('requires end strictly after start', () => {
    expect(buildBlockBody({ ...base, endTime: '09:00' })).toEqual({
      ok: false,
      issue: { kind: 'END_NOT_AFTER_START' },
    });
    expect(buildBlockBody({ ...base, endTime: '08:00' })).toEqual({
      ok: false,
      issue: { kind: 'END_NOT_AFTER_START' },
    });
  });

  it('caps the range at MAX_BLOCK_RANGE_DAYS (90)', () => {
    expect(
      buildBlockBody({ ...base, endDate: '2026-10-13', endTime: '09:00' }),
    ).toMatchObject({ ok: true });
    expect(
      buildBlockBody({ ...base, endDate: '2026-10-13', endTime: '09:01' }),
    ).toEqual({ ok: false, issue: { kind: 'RANGE_TOO_LONG' } });
    expect(MAX_BLOCK_RANGE_DAYS).toBe(90);
  });

  it('caps the reason at 200 chars', () => {
    expect(buildBlockBody({ ...base, reason: 'x'.repeat(201) })).toEqual({
      ok: false,
      issue: { kind: 'REASON_TOO_LONG' },
    });
    expect(buildBlockBody({ ...base, reason: 'x'.repeat(200) })).toMatchObject({
      ok: true,
    });
  });
});

describe('makeEmptyBlockDraft — from now to the same wall-clock tomorrow', () => {
  it('prefills a 24h Dhaka range', () => {
    const draft = makeEmptyBlockDraft(new Date('2026-07-10T04:00:00Z'));
    expect(draft.startDate).toBe('2026-07-10');
    expect(draft.startTime).toBe('10:00');
    expect(draft.endDate).toBe('2026-07-11');
    expect(draft.endTime).toBe('10:00');
    expect(draft.reason).toBe('');
  });
});

describe('chamberDisplayName — honest resolution', () => {
  const chambers = [{ id: 'cham-1', name: 'Green Life Chamber' }, { id: 'cham-2' }];

  it('null facility = universal/telemedicine default', () => {
    expect(chamberDisplayName(null, chambers)).toEqual({ kind: 'universal' });
    expect(chamberDisplayName(undefined, chambers)).toEqual({ kind: 'universal' });
  });

  it('resolves a known chamber name', () => {
    expect(chamberDisplayName('cham-1', chambers)).toEqual({
      kind: 'named',
      name: 'Green Life Chamber',
    });
  });

  it('falls back to a short id — never fabricates a name', () => {
    expect(chamberDisplayName('cham-2', chambers)).toEqual({
      kind: 'unresolved',
      shortId: 'cham-2',
    });
    expect(chamberDisplayName('12345678-aaaa', chambers)).toEqual({
      kind: 'unresolved',
      shortId: '12345678',
    });
  });
});
