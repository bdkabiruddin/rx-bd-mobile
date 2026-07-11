// Doctor lab orders + results inbox — pure logic suite (Node environment,
// no RN imports).

import {
  buildOrderTest,
  buildPlaceOrderBody,
  catalogEntryLabel,
  clampQuery,
  countUnacknowledged,
  detectCritical,
  emptyOrderDraft,
  filterCentres,
  flagTone,
  inboxTestsLine,
  isSearchable,
  isTestSelected,
  joinParts,
  MAX_NOTES_LEN,
  normalizeResultPayload,
  orderStatusTone,
  patientRefLabel,
  priorityTone,
  refRangeText,
  shortPatientRef,
  testNamesLine,
  toggleTest,
  visibleInboxRows,
  isCancellableOrderStatus,
} from '@/features/doctor-orders/logic';
import type { ResultsInboxRow } from '@/features/doctor-orders/types';

describe('isCancellableOrderStatus', () => {
  it('is true only for PENDING / IN_PROGRESS', () => {
    expect(isCancellableOrderStatus('PENDING')).toBe(true);
    expect(isCancellableOrderStatus('IN_PROGRESS')).toBe(true);
  });
  it('is false for terminal / unknown / undefined', () => {
    for (const s of ['COMPLETED', 'CANCELLED', 'REJECTED', undefined]) {
      expect(isCancellableOrderStatus(s)).toBe(false);
    }
  });
});

describe('pill tones — locked mappings', () => {
  it('maps the order lifecycle (red reserved for result flags)', () => {
    expect(orderStatusTone('PENDING')).toBe('neutral');
    expect(orderStatusTone('IN_PROGRESS')).toBe('info');
    expect(orderStatusTone('COMPLETED')).toBe('success');
    expect(orderStatusTone('CANCELLED')).toBe('warning');
    expect(orderStatusTone('SOMETHING_NEW')).toBe('neutral');
    expect(orderStatusTone(undefined)).toBe('neutral');
  });

  it('maps priority (STAT = drop everything)', () => {
    expect(priorityTone('STAT')).toBe('danger');
    expect(priorityTone('URGENT')).toBe('warning');
    expect(priorityTone('ROUTINE')).toBe('neutral');
    expect(priorityTone(undefined)).toBe('neutral');
  });
});

describe('flagTone — abnormality vocabulary union', () => {
  it('maps tagged-payload words', () => {
    expect(flagTone('normal')).toBe('success');
    expect(flagTone('high')).toBe('warning');
    expect(flagTone('low')).toBe('warning');
    expect(flagTone('abnormal')).toBe('warning');
    expect(flagTone('critical-high')).toBe('danger');
    expect(flagTone('critical-low')).toBe('danger');
  });

  it('maps lab-portal interpretation letters (A is stamped for criticals)', () => {
    expect(flagTone('N')).toBe('success');
    expect(flagTone('H')).toBe('warning');
    expect(flagTone('L')).toBe('warning');
    expect(flagTone('A')).toBe('danger');
    expect(flagTone('C-H')).toBe('danger');
    expect(flagTone('C-L')).toBe('danger');
  });

  it('treats an unknown non-empty flag as warning (under-alerting is unsafe)', () => {
    expect(flagTone('FUTURE-FLAG')).toBe('warning');
  });

  it('renders NO pill without a flag', () => {
    expect(flagTone(null)).toBeNull();
    expect(flagTone(undefined)).toBeNull();
    expect(flagTone('')).toBeNull();
    expect(flagTone('   ')).toBeNull();
  });
});

describe('display helpers', () => {
  it('shortPatientRef takes the first UUID group, uppercased', () => {
    expect(shortPatientRef('ab12cd34-0000-1111-2222-333344445555')).toBe('AB12CD34');
    expect(shortPatientRef('plain')).toBe('PLAIN');
  });

  it('patientRefLabel prefers the server token, falls back honestly', () => {
    expect(patientRefLabel({ patientInitials: 'PT-9F2A' })).toBe('PT-9F2A');
    expect(patientRefLabel({ patientId: 'ab12cd34-1-2-3-4' })).toBe('AB12CD34');
    expect(patientRefLabel({})).toBe('');
  });

  it('testNamesLine prefers names, falls back to codes, drops blanks', () => {
    expect(
      testNamesLine([
        { code: 'CBC', name: 'Complete Blood Count' },
        { code: 'HBA1C' },
        { code: '', name: '  ' },
      ]),
    ).toBe('Complete Blood Count, HBA1C');
    expect(testNamesLine(undefined)).toBe('');
    expect(testNamesLine(null)).toBe('');
  });

  it('inboxTestsLine joins plain names and drops blanks', () => {
    expect(inboxTestsLine([' CBC ', '', 'RBS'])).toBe('CBC, RBS');
    expect(inboxTestsLine(undefined)).toBe('');
  });

  it('joinParts skips empty segments', () => {
    expect(joinParts(['a', null, undefined, ' ', 'b'])).toBe('a · b');
  });

  it('catalogEntryLabel localizes when Bangla is available', () => {
    const entry = { code: 'CBC', displayName: 'Complete Blood Count', displayNameBn: 'সিবিসি' };
    expect(catalogEntryLabel(entry, 'en')).toBe('Complete Blood Count');
    expect(catalogEntryLabel(entry, 'bn')).toBe('সিবিসি');
    expect(catalogEntryLabel({ code: 'X' }, 'bn')).toBe('X');
  });

  it('clamps search queries to the server cap', () => {
    expect(clampQuery('  ab  ')).toBe('ab');
    expect(clampQuery('x'.repeat(500))).toHaveLength(100);
    expect(isSearchable('  ')).toBe(false);
    expect(isSearchable('a')).toBe(true);
  });
});

describe('inbox — unacknowledged model', () => {
  const row = (id: string, over: Partial<ResultsInboxRow> = {}): ResultsInboxRow => ({
    labOrderId: `order-${id}`,
    latestResultId: id,
    latestResultAt: '2026-07-01T00:00:00Z',
    ...over,
  });

  it('filters server-confirmed acknowledgements and rows without a result id', () => {
    const rows = [
      row('r1'),
      row('r2'),
      { labOrderId: 'order-x' } as ResultsInboxRow, // no latestResultId → unopenable
    ];
    const visible = visibleInboxRows(rows, { r1: true });
    expect(visible.map((r) => r.latestResultId)).toEqual(['r2']);
    expect(countUnacknowledged(rows, { r1: true })).toBe(1);
    expect(countUnacknowledged(rows, {})).toBe(2);
  });

  it('orders critical first, then newest result', () => {
    const rows = [
      row('old', { latestResultAt: '2026-07-01T00:00:00Z' }),
      row('new', { latestResultAt: '2026-07-09T00:00:00Z' }),
      row('crit', { latestResultAt: '2026-06-01T00:00:00Z', hasCritical: true }),
    ];
    expect(visibleInboxRows(rows, {}).map((r) => r.latestResultId)).toEqual([
      'crit',
      'new',
      'old',
    ]);
  });

  it('handles empty / missing lists', () => {
    expect(visibleInboxRows(undefined, {})).toEqual([]);
    expect(visibleInboxRows(null, {})).toEqual([]);
    expect(countUnacknowledged(undefined, {})).toBe(0);
  });
});

describe('normalizeResultPayload — honest narrowing', () => {
  it('renders the tagged numeric shape with range + flag', () => {
    const out = normalizeResultPayload({
      kind: 'numeric',
      analyte: 'K',
      value: 6.9,
      unit: 'mmol/L',
      refRangeLow: 3.5,
      refRangeHigh: 5.1,
      flag: 'critical-high',
    });
    expect(out).toEqual({
      kind: 'analytes',
      panel: null,
      rows: [
        {
          key: 'numeric-0',
          analyte: 'K',
          value: '6.9',
          unit: 'mmol/L',
          refRange: '3.5–5.1',
          flag: 'critical-high',
        },
      ],
    });
  });

  it('renders multi-analyte panels and skips malformed items', () => {
    const out = normalizeResultPayload({
      kind: 'multi-analyte',
      panel: 'CBC',
      items: [
        { kind: 'numeric', analyte: 'WBC', value: 7.2, unit: '10^9/L' },
        { kind: 'numeric', analyte: 'BAD', value: 'oops', unit: 'x' },
      ],
    });
    expect(out.kind).toBe('analytes');
    if (out.kind === 'analytes') {
      expect(out.panel).toBe('CBC');
      expect(out.rows).toHaveLength(1);
      expect(out.rows[0]?.analyte).toBe('WBC');
    }
  });

  it('renders the tagged text shape', () => {
    expect(
      normalizeResultPayload({ kind: 'text', value: 'No growth after 48h', analyte: 'CULTURE' }),
    ).toEqual({ kind: 'text', analyte: 'CULTURE', text: 'No growth after 48h' });
  });

  it('refuses unknown tagged shapes instead of guessing', () => {
    expect(normalizeResultPayload({ kind: 'hologram', value: 1 })).toEqual({
      kind: 'unstructured',
    });
  });

  it('renders the lab-portal legacy numeric shape (interpretation + nested range)', () => {
    const out = normalizeResultPayload({
      code: 'RBS',
      shape: 'numeric',
      value: 105,
      unit: 'mg/dL',
      referenceRange: { normalLow: 70, normalHigh: 140, unit: 'mg/dL' },
      interpretation: 'N',
    });
    expect(out).toEqual({
      kind: 'analytes',
      panel: null,
      rows: [
        {
          key: 'legacy-0',
          analyte: 'RBS',
          value: '105',
          unit: 'mg/dL',
          refRange: '70–140',
          flag: 'N',
        },
      ],
    });
  });

  it('renders lab-portal categorical and free-text shapes as text', () => {
    expect(
      normalizeResultPayload({ code: 'BG', shape: 'categorical', value: 'O_POS' }),
    ).toEqual({ kind: 'text', analyte: 'BG', text: 'O_POS' });
    expect(
      normalizeResultPayload({ code: 'XR', shape: 'free-text', report: 'Clear lung fields.' }),
    ).toEqual({ kind: 'text', analyte: 'XR', text: 'Clear lung fields.' });
  });

  it('renders the LIS legacy map shape and skips meta keys', () => {
    const out = normalizeResultPayload({
      criticalFlag: true,
      'CBC.WBC': { value: 7.2, unit: '10^9/L', interpretation: 'N' },
      'CBC.HGB': { result: 'low-ish' },
      comment: 'not-a-record-entry',
    });
    expect(out.kind).toBe('analytes');
    if (out.kind === 'analytes') {
      expect(out.rows.map((r) => r.analyte).sort()).toEqual(['CBC.HGB', 'CBC.WBC']);
      const wbc = out.rows.find((r) => r.analyte === 'CBC.WBC');
      expect(wbc?.flag).toBe('N');
    }
  });

  it('degrades everything else to an honest unstructured marker', () => {
    expect(normalizeResultPayload(null)).toEqual({ kind: 'unstructured' });
    expect(normalizeResultPayload('raw')).toEqual({ kind: 'unstructured' });
    expect(normalizeResultPayload([1, 2])).toEqual({ kind: 'unstructured' });
    expect(normalizeResultPayload({})).toEqual({ kind: 'unstructured' });
    expect(normalizeResultPayload({ criticalFlag: true })).toEqual({ kind: 'unstructured' });
    expect(normalizeResultPayload({ kind: 'numeric', value: 'NaN-ish' })).toEqual({
      kind: 'unstructured',
    });
  });

  it('formats reference bands with open ends', () => {
    expect(refRangeText(3.5, 5.1)).toBe('3.5–5.1');
    expect(refRangeText(3.5, undefined)).toBe('≥ 3.5');
    expect(refRangeText(undefined, 5.1)).toBe('≤ 5.1');
    expect(refRangeText(undefined, undefined)).toBeNull();
  });
});

describe('detectCritical — server-provided markers only', () => {
  it('detects each writer variant', () => {
    expect(detectCritical({ criticalFlag: true })).toBe(true);
    expect(detectCritical({ hasCritical: true })).toBe(true);
    expect(detectCritical({ criticalValue: true })).toBe(true);
  });

  it('never infers criticality', () => {
    expect(detectCritical({ criticalFlag: false })).toBe(false);
    expect(detectCritical({ kind: 'numeric', value: 99999 })).toBe(false);
    expect(detectCritical(undefined)).toBe(false);
    expect(detectCritical('critical')).toBe(false);
  });
});

describe('new-order form logic', () => {
  const CBC = { code: 'CBC', displayName: 'Complete Blood Count' };
  const RBS = { code: 'RBS', displayName: 'Random Blood Sugar' };

  it('buildOrderTest captures the canonical English name (code fallback)', () => {
    expect(buildOrderTest(CBC)).toEqual({ code: 'CBC', name: 'Complete Blood Count' });
    expect(buildOrderTest({ code: 'X' })).toEqual({ code: 'X', name: 'X' });
  });

  it('toggleTest adds then removes by code', () => {
    const once = toggleTest([], CBC);
    expect(once).toEqual([{ code: 'CBC', name: 'Complete Blood Count' }]);
    expect(isTestSelected(once, 'CBC')).toBe(true);
    const twice = toggleTest(once, RBS);
    expect(twice).toHaveLength(2);
    expect(toggleTest(twice, CBC).map((t) => t.code)).toEqual(['RBS']);
  });

  it('validates before building the body', () => {
    const draft = emptyOrderDraft();
    expect(buildPlaceOrderBody('', draft)).toEqual({
      ok: false,
      issue: { kind: 'NO_PATIENT' },
    });
    expect(buildPlaceOrderBody('p-1', draft)).toEqual({
      ok: false,
      issue: { kind: 'NO_TESTS' },
    });
    const withTests = { ...draft, tests: [buildOrderTest(CBC)] };
    expect(buildPlaceOrderBody('p-1', withTests)).toEqual({
      ok: false,
      issue: { kind: 'NO_CENTRE' },
    });
    const longNotes = {
      ...withTests,
      centreId: 'c-1',
      notes: 'x'.repeat(MAX_NOTES_LEN + 1),
    };
    expect(buildPlaceOrderBody('p-1', longNotes)).toEqual({
      ok: false,
      issue: { kind: 'NOTES_TOO_LONG' },
    });
  });

  it('builds the strict body — notes omitted when blank, tests are {code,name} only', () => {
    const built = buildPlaceOrderBody('p-1', {
      tests: [buildOrderTest(CBC)],
      priority: 'URGENT',
      centreId: ' c-1 ',
      notes: '   ',
    });
    expect(built).toEqual({
      ok: true,
      centreId: 'c-1',
      body: {
        patientId: 'p-1',
        tests: [{ code: 'CBC', name: 'Complete Blood Count' }],
        priority: 'URGENT',
      },
    });

    const withNotes = buildPlaceOrderBody('p-1', {
      tests: [buildOrderTest(CBC)],
      priority: 'ROUTINE',
      centreId: 'c-1',
      notes: ' fasting sample ',
    });
    expect(withNotes.ok).toBe(true);
    if (withNotes.ok) {
      expect(withNotes.body.notes).toBe('fasting sample');
      expect(Object.keys(withNotes.body.tests[0] ?? {}).sort()).toEqual(['code', 'name']);
    }
  });

  it('filterCentres matches name/city/district, any case', () => {
    const centres = [
      { centreId: '1', name: 'Popular Diagnostics', city: 'Dhaka' },
      { centreId: '2', name: 'Ibn Sina', city: 'Sylhet', district: 'Sylhet' },
    ];
    expect(filterCentres(centres, '')).toHaveLength(2);
    expect(filterCentres(centres, 'popular')).toHaveLength(1);
    expect(filterCentres(centres, 'SYL')).toHaveLength(1);
    expect(filterCentres(centres, 'nowhere')).toHaveLength(0);
  });
});
