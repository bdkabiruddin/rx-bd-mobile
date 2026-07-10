// Patient vitals — pure logic suite (Node environment, no RN imports).
//
// The plausibility assertions mirror the backend VitalReading domain
// factory (src/modules/vital-reading/domain/VitalReading.ts) so a drift in
// either direction shows up here.

import {
  buildRecordVitalBody,
  dayKeyDhaka,
  dhakaDateTimeParts,
  filterByType,
  formatVitalValue,
  groupReadingsByDay,
  makeEmptyDraft,
  parseDhakaDateTimeMs,
  parseValueInput,
  typesPresent,
  unitSymbol,
  vitalStatusTone,
  type VitalDraftValues,
} from '@/features/patient-vitals/logic';
import type { VitalReadingView } from '@/features/patient-vitals/types';

// 2026-07-10 08:30 Dhaka (+06:00) — a fixed, DST-free reference instant.
const MEASURED_DHAKA = { date: '2026-07-10', time: '08:30' };
const MEASURED_MS = Date.parse('2026-07-10T08:30:00+06:00');
const NOW_MS = MEASURED_MS + 60 * 60 * 1000; // an hour after the reading

function draft(overrides: Partial<VitalDraftValues>): VitalDraftValues {
  return {
    vitalType: 'HEART_RATE',
    value: '',
    secondary: '',
    ...MEASURED_DHAKA,
    notes: '',
    ...overrides,
  };
}

describe('buildRecordVitalBody — happy paths', () => {
  it('builds a blood-pressure body with both limbs, pinned unit and source', () => {
    const res = buildRecordVitalBody(
      draft({ vitalType: 'BLOOD_PRESSURE', value: '120', secondary: '80', notes: '  after walk  ' }),
      NOW_MS,
    );
    expect(res).toEqual({
      ok: true,
      body: {
        vitalType: 'BLOOD_PRESSURE',
        valueQuantity: 120,
        valueSecondary: 80,
        unit: 'mmHg',
        source: 'PATIENT',
        effectiveAt: new Date(MEASURED_MS).toISOString(),
        notes: 'after walk',
      },
    });
  });

  it('accepts a pain score of zero (ordinal-zero exemption) and omits empty notes', () => {
    const res = buildRecordVitalBody(draft({ vitalType: 'PAIN_SCORE', value: '0' }), NOW_MS);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.body).toEqual({
        vitalType: 'PAIN_SCORE',
        valueQuantity: 0,
        unit: 'score',
        source: 'PATIENT',
        effectiveAt: new Date(MEASURED_MS).toISOString(),
      });
      expect('valueSecondary' in res.body).toBe(false);
      expect('notes' in res.body).toBe(false);
    }
  });

  it('accepts a decimal temperature in celsius', () => {
    const res = buildRecordVitalBody(draft({ vitalType: 'TEMPERATURE', value: '36.8' }), NOW_MS);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.body.valueQuantity).toBe(36.8);
      expect(res.body.unit).toBe('celsius');
    }
  });
});

describe('buildRecordVitalBody — mirrored plausibility gate', () => {
  it('refuses out-of-band systolic/diastolic (30–350 mmHg)', () => {
    const high = buildRecordVitalBody(
      draft({ vitalType: 'BLOOD_PRESSURE', value: '400', secondary: '80' }),
      NOW_MS,
    );
    expect(high).toEqual({
      ok: false,
      issue: { kind: 'RANGE', field: 'value', min: 30, max: 350 },
    });
    const low = buildRecordVitalBody(
      draft({ vitalType: 'BLOOD_PRESSURE', value: '120', secondary: '20' }),
      NOW_MS,
    );
    expect(low).toEqual({
      ok: false,
      issue: { kind: 'RANGE', field: 'diastolic', min: 30, max: 350 },
    });
  });

  it('requires the diastolic limb for BP', () => {
    const res = buildRecordVitalBody(
      draft({ vitalType: 'BLOOD_PRESSURE', value: '120' }),
      NOW_MS,
    );
    expect(res).toEqual({ ok: false, issue: { kind: 'DIASTOLIC_REQUIRED' } });
  });

  it('mirrors per-type bands (glucose 10–1000, pain ≤ 10, SpO₂ ≤ 100)', () => {
    expect(buildRecordVitalBody(draft({ vitalType: 'BLOOD_GLUCOSE', value: '5' }), NOW_MS)).toEqual({
      ok: false,
      issue: { kind: 'RANGE', field: 'value', min: 10, max: 1000 },
    });
    expect(buildRecordVitalBody(draft({ vitalType: 'PAIN_SCORE', value: '11' }), NOW_MS)).toEqual({
      ok: false,
      issue: { kind: 'RANGE', field: 'value', min: 0, max: 10 },
    });
    expect(
      buildRecordVitalBody(draft({ vitalType: 'OXYGEN_SATURATION', value: '110' }), NOW_MS),
    ).toEqual({ ok: false, issue: { kind: 'RANGE', field: 'value', min: 30, max: 100 } });
  });

  it('refuses zero/negative/non-numeric values for non-ordinal vitals', () => {
    expect(buildRecordVitalBody(draft({ value: '0' }), NOW_MS)).toEqual({
      ok: false,
      issue: { kind: 'VALUE_INVALID' },
    });
    expect(buildRecordVitalBody(draft({ value: '-5' }), NOW_MS)).toEqual({
      ok: false,
      issue: { kind: 'VALUE_INVALID' },
    });
    expect(buildRecordVitalBody(draft({ value: 'abc' }), NOW_MS)).toEqual({
      ok: false,
      issue: { kind: 'VALUE_INVALID' },
    });
    expect(buildRecordVitalBody(draft({ value: '' }), NOW_MS)).toEqual({
      ok: false,
      issue: { kind: 'VALUE_REQUIRED' },
    });
  });

  it('refuses an unknown (corrupt-draft) vital type instead of posting it', () => {
    const res = buildRecordVitalBody(
      draft({ vitalType: 'NOT_A_TYPE' as unknown as VitalDraftValues['vitalType'], value: '10' }),
      NOW_MS,
    );
    expect(res).toEqual({ ok: false, issue: { kind: 'VALUE_INVALID' } });
  });
});

describe('buildRecordVitalBody — measured-at', () => {
  it('refuses malformed or impossible dates/times', () => {
    for (const [date, time] of [
      ['2026-02-30', '08:30'], // non-existent day
      ['2026-07-10', '24:00'],
      ['2026-07-10', '9:5'],
      ['10-07-2026', '08:30'],
      ['', ''],
    ] as const) {
      expect(buildRecordVitalBody(draft({ value: '70', date, time }), NOW_MS)).toEqual({
        ok: false,
        issue: { kind: 'DATETIME_INVALID' },
      });
    }
  });

  it('refuses a future time beyond clock-skew tolerance, accepts within it', () => {
    const now = MEASURED_MS; // reading timestamped exactly "now"
    expect(buildRecordVitalBody(draft({ value: '70' }), now).ok).toBe(true);
    // 10 minutes before the reading — beyond the 5-minute tolerance.
    expect(buildRecordVitalBody(draft({ value: '70' }), now - 10 * 60 * 1000)).toEqual({
      ok: false,
      issue: { kind: 'DATETIME_FUTURE' },
    });
    // 2 minutes before the reading — inside the tolerance.
    expect(buildRecordVitalBody(draft({ value: '70' }), now - 2 * 60 * 1000).ok).toBe(true);
  });
});

describe('Dhaka wall-clock helpers', () => {
  it('round-trips parts ⇄ epoch at the fixed +06:00 offset', () => {
    expect(parseDhakaDateTimeMs('2026-07-10', '08:30')).toBe(MEASURED_MS);
    const parts = dhakaDateTimeParts(new Date('2026-07-09T20:15:00Z'));
    expect(parts).toEqual({ date: '2026-07-10', time: '02:15' }); // crosses midnight in Dhaka
  });

  it('keys days by Dhaka-local calendar date', () => {
    expect(dayKeyDhaka('2026-07-09T18:30:00Z')).toBe('2026-07-10'); // 00:30 Dhaka
    expect(dayKeyDhaka('2026-07-09T17:30:00Z')).toBe('2026-07-09'); // 23:30 Dhaka
    expect(dayKeyDhaka('not-a-date')).toBeNull();
  });

  it('makeEmptyDraft defaults measured-at to now (Dhaka) with BP preselected', () => {
    const d = makeEmptyDraft(new Date('2026-07-10T02:30:00Z'));
    expect(d).toEqual({
      vitalType: 'BLOOD_PRESSURE',
      value: '',
      secondary: '',
      date: '2026-07-10',
      time: '08:30',
      notes: '',
    });
  });
});

describe('history grouping + filtering', () => {
  const reading = (id: string, vitalType: string, effectiveAt: string): VitalReadingView => ({
    vitalReadingId: id,
    vitalType,
    valueQuantity: 1,
    unit: 'bpm',
    effectiveAt,
  });

  it('groups newest-first by Dhaka day (UTC evening rolls to the next Dhaka day)', () => {
    const groups = groupReadingsByDay([
      reading('a', 'HEART_RATE', '2026-07-08T10:00:00Z'),
      reading('b', 'WEIGHT', '2026-07-09T18:30:00Z'), // 2026-07-10 Dhaka
      reading('c', 'HEART_RATE', '2026-07-09T02:00:00Z'),
    ]);
    expect(groups.map((g) => g.day)).toEqual(['2026-07-10', '2026-07-09', '2026-07-08']);
    expect(groups.map((g) => g.items.map((r) => r.vitalReadingId))).toEqual([
      ['b'],
      ['c'],
      ['a'],
    ]);
  });

  it('orders multiple same-day readings newest first', () => {
    const groups = groupReadingsByDay([
      reading('early', 'HEART_RATE', '2026-07-09T02:00:00Z'),
      reading('late', 'HEART_RATE', '2026-07-09T09:00:00Z'),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.items.map((r) => r.vitalReadingId)).toEqual(['late', 'early']);
  });

  it('lists present types in canonical order and filters by type', () => {
    const rows = [
      reading('a', 'WEIGHT', '2026-07-08T10:00:00Z'),
      reading('b', 'BLOOD_PRESSURE', '2026-07-09T10:00:00Z'),
      reading('c', 'WEIGHT', '2026-07-10T10:00:00Z'),
    ];
    expect(typesPresent(rows)).toEqual(['BLOOD_PRESSURE', 'WEIGHT']);
    expect(typesPresent(undefined)).toEqual([]);
    expect(filterByType(rows, 'WEIGHT').map((r) => r.vitalReadingId)).toEqual(['a', 'c']);
    expect(filterByType(rows, null)).toHaveLength(3);
  });
});

describe('display helpers', () => {
  it('formats values with symbols; BP joins both limbs; scores show their scale', () => {
    expect(
      formatVitalValue(
        { vitalType: 'BLOOD_PRESSURE', valueQuantity: 120, valueSecondary: 80, unit: 'mmHg' },
        'en',
      ),
    ).toBe('120/80 mmHg');
    expect(
      formatVitalValue(
        { vitalType: 'TEMPERATURE', valueQuantity: 36.8, valueSecondary: null, unit: 'celsius' },
        'en',
      ),
    ).toBe('36.8 °C');
    expect(
      formatVitalValue(
        { vitalType: 'PAIN_SCORE', valueQuantity: 7, valueSecondary: null, unit: 'score' },
        'en',
      ),
    ).toBe('7/10');
    expect(
      formatVitalValue(
        { vitalType: 'GCS', valueQuantity: 14, valueSecondary: null, unit: 'score' },
        'en',
      ),
    ).toBe('14/15');
  });

  it('falls back to the raw unit for unknown units', () => {
    expect(unitSymbol('mmHg')).toBe('mmHg');
    expect(unitSymbol('breaths/min')).toBe('/min');
    expect(unitSymbol('furlongs')).toBe('furlongs');
  });

  it('maps statuses to locked pill tones (unknown degrades to neutral)', () => {
    expect(vitalStatusTone('OBSERVED_OUT_OF_RANGE')).toBe('danger');
    expect(vitalStatusTone('AMENDED')).toBe('info');
    expect(vitalStatusTone('RECORDED')).toBe('neutral');
    expect(vitalStatusTone('SOMETHING_NEW')).toBe('neutral');
    expect(vitalStatusTone(undefined)).toBe('neutral');
  });

  it('parses lenient numeric input', () => {
    expect(parseValueInput(' 98.6 ')).toBe(98.6);
    expect(parseValueInput('120')).toBe(120);
    expect(parseValueInput('')).toBeNull();
    expect(parseValueInput('12,5')).toBeNull();
    expect(parseValueInput('Infinity')).toBeNull();
  });
});
