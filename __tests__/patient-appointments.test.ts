// Patient appointments — pure logic suite (Node env, no RN imports).

import {
  DEFAULT_CHUNK_MINUTES,
  expandWindowsToChunks,
  formatMinuteOfDay,
  groupChunksByDate,
  isActionableStatus,
  isUpcoming,
  mapChamberToFacility,
  partitionAppointments,
  slotIso,
  slotStartMs,
  statusTone,
} from '@/features/patient-appointments/logic';

describe('statusTone', () => {
  it('maps every appointment status to a pill tone', () => {
    expect(statusTone('SCHEDULED')).toBe('info');
    expect(statusTone('CONFIRMED')).toBe('success');
    expect(statusTone('CHECKED_IN')).toBe('info');
    expect(statusTone('IN_PROGRESS')).toBe('warning');
    expect(statusTone('COMPLETED')).toBe('neutral');
    expect(statusTone('NO_SHOW')).toBe('warning');
    expect(statusTone('CANCELLED')).toBe('danger');
    expect(statusTone('SOMETHING_NEW')).toBe('neutral');
  });
});

describe('isActionableStatus', () => {
  it('only SCHEDULED/CONFIRMED are patient-actionable', () => {
    expect(isActionableStatus('SCHEDULED')).toBe(true);
    expect(isActionableStatus('CONFIRMED')).toBe(true);
    expect(isActionableStatus('CHECKED_IN')).toBe(false);
    expect(isActionableStatus('CANCELLED')).toBe(false);
    expect(isActionableStatus('COMPLETED')).toBe(false);
  });
});

describe('partitionAppointments', () => {
  const now = Date.parse('2026-07-10T10:00:00Z');
  const items = [
    { appointmentId: 'a', scheduledAt: '2026-07-12T04:00:00Z', status: 'SCHEDULED' },
    { appointmentId: 'b', scheduledAt: '2026-07-01T04:00:00Z', status: 'COMPLETED' },
    { appointmentId: 'c', scheduledAt: '2026-07-11T04:00:00Z', status: 'CONFIRMED' },
    // Future-dated but cancelled → past bucket (honest status).
    { appointmentId: 'd', scheduledAt: '2026-07-13T04:00:00Z', status: 'CANCELLED' },
    // Started 15 min ago but 30-min window still running → upcoming.
    {
      appointmentId: 'e',
      scheduledAt: '2026-07-10T09:45:00Z',
      status: 'IN_PROGRESS',
      durationMinutes: 30,
    },
  ];

  it('splits by status + elapsed time and sorts each side', () => {
    const { upcoming, past } = partitionAppointments(items, now);
    expect(upcoming.map((i) => i.appointmentId)).toEqual(['e', 'c', 'a']);
    expect(past.map((i) => i.appointmentId)).toEqual(['d', 'b']);
  });

  it('isUpcoming rejects unparsable dates', () => {
    expect(isUpcoming({ scheduledAt: 'not-a-date', status: 'SCHEDULED' }, now)).toBe(false);
  });
});

describe('slot time math (Dhaka, UTC+6)', () => {
  it('converts a Dhaka-local date + minute-of-day to UTC ISO', () => {
    // 09:30 Dhaka = 03:30 UTC.
    expect(slotIso('2026-07-15', 9 * 60 + 30)).toBe('2026-07-15T03:30:00.000Z');
    expect(slotStartMs('2026-07-15', 0)).toBe(Date.parse('2026-07-14T18:00:00Z'));
  });

  it('formats minute-of-day as a clock label', () => {
    expect(formatMinuteOfDay(9 * 60 + 30, 'en')).toBe('09:30');
    expect(formatMinuteOfDay(0, 'en')).toBe('00:00');
  });
});

describe('expandWindowsToChunks', () => {
  const nowMs = Date.parse('2026-07-14T00:00:00Z'); // day before the windows

  it('subdivides by the chamber-declared grain and keeps chamberId', () => {
    const chunks = expandWindowsToChunks({
      windows: [
        {
          date: '2026-07-15',
          dayOfWeek: 'WEDNESDAY',
          startMinuteOfDay: 540, // 09:00
          endMinuteOfDay: 600, // 10:00
          facilityId: 'chamber-1',
        },
      ],
      chambers: [
        {
          id: 'chamber-1',
          schedules: [
            { dayOfWeek: 3, startMinuteOfDay: 540, endMinuteOfDay: 600, slotDurationMinutes: 20 },
          ],
        },
      ],
      bookedRanges: [],
      nowMs,
    });
    expect(chunks.map((c) => c.startMinuteOfDay)).toEqual([540, 560, 580]);
    expect(chunks.every((c) => c.chamberId === 'chamber-1')).toBe(true);
    expect(chunks[0]?.endMinuteOfDay).toBe(560);
  });

  it('falls back to the default grain without a chamber schedule', () => {
    const chunks = expandWindowsToChunks({
      windows: [
        { date: '2026-07-15', startMinuteOfDay: 540, endMinuteOfDay: 660, facilityId: null },
      ],
      chambers: [],
      bookedRanges: [],
      nowMs,
    });
    expect(DEFAULT_CHUNK_MINUTES).toBe(30);
    expect(chunks.map((c) => c.startMinuteOfDay)).toEqual([540, 570, 600, 630]);
  });

  it('removes already-booked chunks for the same chamber only', () => {
    const chunks = expandWindowsToChunks({
      windows: [
        { date: '2026-07-15', startMinuteOfDay: 540, endMinuteOfDay: 600, facilityId: null },
      ],
      chambers: [],
      bookedRanges: [
        // 09:00 Dhaka = 03:00 UTC — blocks the first chunk (same facility null).
        { scheduledAt: '2026-07-15T03:00:00.000Z', durationMinutes: 30, facilityId: null },
        // Same time at another chamber must NOT block (per-chamber semantics).
        { scheduledAt: '2026-07-15T03:30:00.000Z', durationMinutes: 30, facilityId: 'other' },
      ],
      nowMs,
    });
    expect(chunks.map((c) => c.startMinuteOfDay)).toEqual([570]);
  });

  it('drops past chunks and invalid windows', () => {
    const chunks = expandWindowsToChunks({
      windows: [
        // Whole window already elapsed.
        { date: '2026-07-10', startMinuteOfDay: 540, endMinuteOfDay: 600, facilityId: null },
        // Inverted window ignored.
        { date: '2026-07-15', startMinuteOfDay: 600, endMinuteOfDay: 540, facilityId: null },
      ],
      chambers: [],
      bookedRanges: [],
      nowMs: Date.parse('2026-07-12T00:00:00Z'),
    });
    expect(chunks).toEqual([]);
  });

  it('groups sorted chunks by date', () => {
    const groups = groupChunksByDate([
      { date: '2026-07-15', startMinuteOfDay: 540, endMinuteOfDay: 570, chamberId: null },
      { date: '2026-07-15', startMinuteOfDay: 570, endMinuteOfDay: 600, chamberId: null },
      { date: '2026-07-16', startMinuteOfDay: 540, endMinuteOfDay: 570, chamberId: null },
    ]);
    expect(groups.map((g) => g.date)).toEqual(['2026-07-15', '2026-07-16']);
    expect(groups[0]?.chunks).toHaveLength(2);
  });
});

describe('mapChamberToFacility (web Wave-240 mirror)', () => {
  const chambers = [
    { id: 'tele', type: 'TELE_CLINIC', hospitalId: null },
    { id: 'in-hosp', type: 'HOSPITAL_CHAMBER', hospitalId: 'hosp-9' },
    { id: 'standalone', type: 'PRIVATE_CLINIC', hospitalId: null },
  ];

  it('tele-clinic → TELEMEDICINE pinned', () => {
    expect(mapChamberToFacility('tele', chambers)).toEqual({
      facilityType: 'TELEMEDICINE',
      facilityId: null,
      isTeleClinic: true,
    });
  });

  it('hospital chamber → HOSPITAL + hospitalId', () => {
    expect(mapChamberToFacility('in-hosp', chambers)).toEqual({
      facilityType: 'HOSPITAL',
      facilityId: 'hosp-9',
      isTeleClinic: false,
    });
  });

  it('standalone chamber / no chamber → TELEMEDICINE fallback', () => {
    expect(mapChamberToFacility('standalone', chambers).facilityType).toBe('TELEMEDICINE');
    expect(mapChamberToFacility(null, chambers).facilityType).toBe('TELEMEDICINE');
    expect(mapChamberToFacility('unknown-id', chambers).facilityType).toBe('TELEMEDICINE');
  });
});
