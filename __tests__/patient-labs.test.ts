// Patient labs — pure logic suite (Node environment, no RN imports).

import {
  flagTone,
  joinParts,
  normalizeResultPayload,
  orderStatusTone,
  refRangeText,
  resultStatusTone,
  testNamesLine,
} from '@/features/patient-labs/logic';

describe('status → tone mapping', () => {
  it('maps the LabOrder lifecycle to locked pill tones', () => {
    expect(orderStatusTone('PENDING')).toBe('neutral');
    expect(orderStatusTone('IN_PROGRESS')).toBe('info');
    expect(orderStatusTone('COMPLETED')).toBe('success');
    expect(orderStatusTone('CANCELLED')).toBe('warning');
  });

  it('degrades unknown/absent order statuses to neutral', () => {
    expect(orderStatusTone('SOMETHING_NEW')).toBe('neutral');
    expect(orderStatusTone(undefined)).toBe('neutral');
  });

  it('maps result verification states', () => {
    expect(resultStatusTone('RELEASED')).toBe('success');
    expect(resultStatusTone('PRELIMINARY')).toBe('warning');
    expect(resultStatusTone(undefined)).toBe('neutral');
  });
});

describe('flagTone — pill ONLY when the backend provided a flag', () => {
  it('maps known flags', () => {
    expect(flagTone('normal')).toBe('success');
    expect(flagTone('low')).toBe('warning');
    expect(flagTone('high')).toBe('warning');
    expect(flagTone('abnormal')).toBe('warning');
    expect(flagTone('critical-low')).toBe('danger');
    expect(flagTone('critical-high')).toBe('danger');
  });

  it('renders NO pill when the backend sent no flag', () => {
    expect(flagTone(undefined)).toBeNull();
    expect(flagTone(null)).toBeNull();
    expect(flagTone('')).toBeNull();
  });

  it('treats an unrecognized future flag as attention-worthy (warning)', () => {
    expect(flagTone('borderline')).toBe('warning');
  });
});

describe('refRangeText', () => {
  it('formats two-sided, one-sided and absent bands', () => {
    expect(refRangeText(3.5, 5.1)).toBe('3.5–5.1');
    expect(refRangeText(3.5, undefined)).toBe('≥ 3.5');
    expect(refRangeText(undefined, 5.1)).toBe('≤ 5.1');
    expect(refRangeText(undefined, undefined)).toBeNull();
  });

  it('rejects non-finite bounds instead of rendering them', () => {
    expect(refRangeText(Number.NaN, 5)).toBe('≤ 5');
    expect(refRangeText(Number.POSITIVE_INFINITY, undefined)).toBeNull();
  });
});

describe('testNamesLine', () => {
  it('joins captured names and falls back to codes', () => {
    expect(
      testNamesLine([
        { code: 'CBC', name: 'Complete Blood Count' },
        { code: 'HBA1C', name: '' },
        { code: '', name: '  ' },
      ]),
    ).toBe('Complete Blood Count, HBA1C');
  });

  it('is empty for absent/empty test lists', () => {
    expect(testNamesLine(undefined)).toBe('');
    expect(testNamesLine([])).toBe('');
  });
});

describe('normalizeResultPayload', () => {
  it('maps a numeric payload to a single analyte row', () => {
    const normalized = normalizeResultPayload({
      kind: 'numeric',
      analyte: 'K',
      value: 5.9,
      unit: 'mmol/L',
      refRangeLow: 3.5,
      refRangeHigh: 5.1,
      flag: 'high',
      comment: 'Slight haemolysis',
    });
    expect(normalized).toEqual({
      kind: 'analytes',
      panel: null,
      rows: [
        {
          analyte: 'K',
          value: '5.9',
          unit: 'mmol/L',
          refRange: '3.5–5.1',
          flag: 'high',
          comment: 'Slight haemolysis',
        },
      ],
    });
  });

  it('keeps optional numeric fields honestly absent (no invented range/flag)', () => {
    const normalized = normalizeResultPayload({
      kind: 'numeric',
      value: 98,
      unit: 'mg/dL',
    });
    expect(normalized).toEqual({
      kind: 'analytes',
      panel: null,
      rows: [
        {
          analyte: null,
          value: '98',
          unit: 'mg/dL',
          refRange: null,
          flag: null,
          comment: null,
        },
      ],
    });
  });

  it('maps a multi-analyte panel, dropping malformed items', () => {
    const normalized = normalizeResultPayload({
      kind: 'multi-analyte',
      panel: 'CBC',
      items: [
        { kind: 'numeric', analyte: 'WBC', value: 7.2, unit: '10^9/L' },
        { kind: 'numeric', analyte: 'HGB', value: 'not-a-number', unit: 'g/dL' },
        { notNumeric: true },
      ],
    });
    expect(normalized.kind).toBe('analytes');
    if (normalized.kind === 'analytes') {
      expect(normalized.panel).toBe('CBC');
      expect(normalized.rows).toHaveLength(1);
      expect(normalized.rows[0]?.analyte).toBe('WBC');
    }
  });

  it('maps a text payload', () => {
    expect(
      normalizeResultPayload({
        kind: 'text',
        analyte: 'CULTURE.AEROBIC',
        value: 'No growth after 48 hours.',
      }),
    ).toEqual({
      kind: 'text',
      analyte: 'CULTURE.AEROBIC',
      text: 'No growth after 48 hours.',
    });
  });

  it('degrades legacy/malformed payloads to unstructured — never guesses', () => {
    // Legacy free-form LIS record (no `kind` discriminator).
    expect(normalizeResultPayload({ 'CBC.WBC': { value: 7.2 } })).toEqual({
      kind: 'unstructured',
    });
    // Malformed tagged shapes.
    expect(normalizeResultPayload({ kind: 'numeric', value: 'high' })).toEqual({
      kind: 'unstructured',
    });
    expect(normalizeResultPayload({ kind: 'multi-analyte', items: [] })).toEqual({
      kind: 'unstructured',
    });
    expect(normalizeResultPayload({ kind: 'text', value: '' })).toEqual({
      kind: 'unstructured',
    });
    // Non-object payloads.
    expect(normalizeResultPayload(undefined)).toEqual({ kind: 'unstructured' });
    expect(normalizeResultPayload(null)).toEqual({ kind: 'unstructured' });
    expect(normalizeResultPayload([1, 2])).toEqual({ kind: 'unstructured' });
    expect(normalizeResultPayload('raw')).toEqual({ kind: 'unstructured' });
  });
});

describe('joinParts', () => {
  it('joins only defined, non-empty parts', () => {
    expect(joinParts(['12 Jan 2026', undefined, 'Urgent', null, ''])).toBe(
      '12 Jan 2026 · Urgent',
    );
    expect(joinParts([undefined, null])).toBe('');
  });
});
