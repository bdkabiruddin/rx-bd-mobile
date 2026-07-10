// Doctor prescribe + e-sign — pure interlock logic suite (Node
// environment, no RN imports). The load-bearing assertions: there is NO
// input combination that enables signing without a fresh dry-run, unknown
// safety tiers fail CLOSED, and blocking findings cannot be acknowledged
// away.

import {
  activeAllergies,
  buildDraftBody,
  buildDryRunBody,
  emptyComposeState,
  emptyItem,
  extractServerBlock,
  isControlledFrequencyCode,
  isPristine,
  isValidIcd10,
  itemIssues,
  itemsFingerprint,
  openDraftToCompose,
  parseBoundedInt,
  parseDiagnosisCodes,
  severityTone,
  signBlockReason,
  summarizeDryRun,
  templateItemsToCompose,
  tierTone,
} from '@/features/doctor-prescribe/logic';
import type {
  ComposeItem,
  DrugLite,
  ItemDryRun,
} from '@/features/doctor-prescribe/types';

const completeItem = (over: Partial<ComposeItem> = {}): ComposeItem => ({
  drugName: 'Paracetamol',
  strength: '500 mg',
  dose: '500 mg',
  frequency: 'TID',
  durationDays: '5',
  route: 'oral',
  instructions: 'After food',
  ...over,
});

const cleanRun = (itemIndex: number, drugName = 'Paracetamol'): ItemDryRun => ({
  itemIndex,
  drugName,
  result: {
    clear: true,
    assessments: [],
    absoluteBlocks: [],
    overridableBlocks: [],
    advisories: [],
  },
  errorMessage: null,
});

describe('sign gate — no path to sign skips the dry-run', () => {
  const base = {
    items: [completeItem()],
    diagnosisText: 'J45.20',
    acknowledged: false,
  };

  it('demands a fresh dry-run even when everything else is complete', () => {
    expect(
      signBlockReason({
        ...base,
        dryRunFresh: false,
        summary: summarizeDryRun(null, 1),
      }),
    ).toBe('dry-run');
  });

  it('signs only after a clean, fresh dry-run', () => {
    expect(
      signBlockReason({
        ...base,
        dryRunFresh: true,
        summary: summarizeDryRun([cleanRun(0)], 1),
      }),
    ).toBeNull();
  });

  it('blocking findings cannot be acknowledged away', () => {
    const summary = summarizeDryRun(
      [
        {
          ...cleanRun(0),
          result: {
            clear: false,
            assessments: [{ primitive: 'allergy', tier: 'BLOCKING', reason: 'match' }],
            overridableBlocks: ['allergy'],
          },
        },
      ],
      1,
    );
    expect(
      signBlockReason({ ...base, dryRunFresh: true, summary, acknowledged: true }),
    ).toBe('safety-block');
  });

  it('advisories require explicit acknowledgement', () => {
    const summary = summarizeDryRun(
      [
        {
          ...cleanRun(0),
          result: {
            clear: true,
            assessments: [{ primitive: 'hepatic', tier: 'ADVISORY', reason: 'unknown LFTs' }],
          },
        },
      ],
      1,
    );
    expect(
      signBlockReason({ ...base, dryRunFresh: true, summary, acknowledged: false }),
    ).toBe('ack');
    expect(
      signBlockReason({ ...base, dryRunFresh: true, summary, acknowledged: true }),
    ).toBeNull();
  });

  it('content gates fire before the interlock', () => {
    const summary = summarizeDryRun([cleanRun(0)], 1);
    expect(
      signBlockReason({
        items: [],
        diagnosisText: 'J45.20',
        dryRunFresh: true,
        summary,
        acknowledged: false,
      }),
    ).toBe('no-items');
    expect(
      signBlockReason({
        items: [completeItem({ strength: '' })],
        diagnosisText: 'J45.20',
        dryRunFresh: true,
        summary,
        acknowledged: false,
      }),
    ).toBe('incomplete-item');
    expect(
      signBlockReason({
        items: [completeItem()],
        diagnosisText: 'not-a-code',
        dryRunFresh: true,
        summary,
        acknowledged: false,
      }),
    ).toBe('diagnosis');
  });
});

describe('summarizeDryRun — fail closed on anything unrecognized', () => {
  it('treats an unknown tier as BLOCKING', () => {
    const s = summarizeDryRun(
      [
        {
          ...cleanRun(0),
          result: {
            clear: true,
            assessments: [{ primitive: 'x', tier: 'WEIRD_NEW_TIER', reason: 'y' }],
          },
        },
      ],
      1,
    );
    expect(s.hasBlocking).toBe(true);
  });

  it('treats clear:false with no recognizable detail as BLOCKING', () => {
    const s = summarizeDryRun([{ ...cleanRun(0), result: { clear: false } }], 1);
    expect(s.hasBlocking).toBe(true);
  });

  it('a failed or missing item result means the dry-run did NOT run', () => {
    expect(
      summarizeDryRun([{ ...cleanRun(0), result: null, errorMessage: 'boom' }], 1).ran,
    ).toBe(false);
    // Count mismatch (item added after the run) → not run.
    expect(summarizeDryRun([cleanRun(0)], 2).ran).toBe(false);
    expect(summarizeDryRun(null, 1).ran).toBe(false);
    expect(summarizeDryRun([], 0).ran).toBe(false);
  });

  it('collects ABSOLUTE from either the arrays or the assessments', () => {
    expect(
      summarizeDryRun(
        [{ ...cleanRun(0), result: { clear: false, absoluteBlocks: ['allergy'] } }],
        1,
      ).hasAbsolute,
    ).toBe(true);
    expect(
      summarizeDryRun(
        [
          {
            ...cleanRun(0),
            result: {
              clear: false,
              assessments: [{ primitive: 'allergy', tier: 'ABSOLUTE', reason: 'anaphylaxis' }],
            },
          },
        ],
        1,
      ).hasAbsolute,
    ).toBe(true);
  });

  it('unknown tiers render danger', () => {
    expect(tierTone('ADVISORY')).toBe('warning');
    expect(tierTone('BLOCKING')).toBe('danger');
    expect(tierTone('ABSOLUTE')).toBe('danger');
    expect(tierTone(undefined)).toBe('danger');
    expect(tierTone('??')).toBe('danger');
  });
});

describe('fingerprint — any safety-relevant edit invalidates the dry-run', () => {
  it('changes when dose / drug / frequency / duration / route / strength change', () => {
    const a = [completeItem()];
    expect(itemsFingerprint(a)).toBe(itemsFingerprint([completeItem()]));
    for (const patch of [
      { drugName: 'Ibuprofen' },
      { strength: '250 mg' },
      { dose: '1 g' },
      { frequency: 'BID' },
      { durationDays: '7' },
      { route: 'IV' },
    ] satisfies Partial<ComposeItem>[]) {
      expect(itemsFingerprint([completeItem(patch)])).not.toBe(itemsFingerprint(a));
    }
  });

  it('ignores instruction-only edits (not a safety input)', () => {
    expect(itemsFingerprint([completeItem({ instructions: 'x' })])).toBe(
      itemsFingerprint([completeItem({ instructions: 'y' })]),
    );
  });
});

describe('item completeness (sign-time mirror of writePrescriptionSchema)', () => {
  it('accepts a fully-specified item', () => {
    expect(itemIssues(completeItem())).toEqual([]);
  });

  it('requires strength (charter §3.2) and a controlled frequency (§3.3)', () => {
    expect(itemIssues(completeItem({ strength: ' ' }))).toContain('strength');
    expect(itemIssues(completeItem({ frequency: '1+0+1' }))).toContain('frequency');
    expect(itemIssues(completeItem({ frequency: 'tid' }))).toEqual([]);
  });

  it('bounds duration to 1–365 days', () => {
    expect(itemIssues(completeItem({ durationDays: '0' }))).toContain('durationDays');
    expect(itemIssues(completeItem({ durationDays: '366' }))).toContain('durationDays');
    expect(itemIssues(completeItem({ durationDays: 'abc' }))).toContain('durationDays');
  });
});

describe('vocabulary + parsing', () => {
  it('controlled frequency codes are case-insensitive members', () => {
    expect(isControlledFrequencyCode('TID')).toBe(true);
    expect(isControlledFrequencyCode(' q6h ')).toBe(true);
    expect(isControlledFrequencyCode('twice daily')).toBe(false);
  });

  it('validates ICD-10 shape', () => {
    expect(isValidIcd10('J45.20')).toBe(true);
    expect(isValidIcd10('i10')).toBe(true); // upper-cased before test
    expect(isValidIcd10('XYZ')).toBe(false);
    expect(isValidIcd10('')).toBe(false);
  });

  it('parses + de-dupes diagnosis codes', () => {
    expect(parseDiagnosisCodes('j45.20, I10; j45.20\nZ79.899')).toEqual([
      'J45.20',
      'I10',
      'Z79.899',
    ]);
    expect(parseDiagnosisCodes('  ')).toEqual([]);
  });

  it('parseBoundedInt rejects out-of-range and non-numeric input', () => {
    expect(parseBoundedInt('5', 1, 365)).toBe(5);
    expect(parseBoundedInt('0', 1, 365)).toBeNull();
    expect(parseBoundedInt('-2', 0, 12)).toBeNull();
    expect(parseBoundedInt('3.5', 1, 365)).toBeNull();
    expect(parseBoundedInt('', 1, 365)).toBeNull();
  });
});

describe('payload builders (mirrors of the backend zod schemas)', () => {
  it('buildDryRunBody omits empty optionals (exactOptionalPropertyTypes-safe)', () => {
    const body = buildDryRunBody(completeItem({ dose: ' ', frequency: '' }), 'p-1');
    expect(body).toEqual({ patientUserId: 'p-1', newDrugName: 'Paracetamol' });
    const full = buildDryRunBody(completeItem(), 'p-1');
    expect(full.prescribedDoseString).toBe('500 mg');
    expect(full.prescribedFrequency).toBe('TID');
  });

  it('buildDraftBody drops nameless rows, caps arrays and omits blank meta', () => {
    const state = {
      ...emptyComposeState(),
      items: [completeItem(), completeItem({ drugName: '  ' })],
      diagnosisText: 'J45.20',
      notes: '  ',
      refillsAllowed: '13', // out of range → omitted
      validUntilDays: '30',
    };
    const body = buildDraftBody(state, 'p-1');
    expect(body.patientId).toBe('p-1');
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.durationDays).toBe(5);
    expect(body.diagnosisCodes).toEqual(['J45.20']);
    expect('notes' in body).toBe(false);
    expect('refillsAllowed' in body).toBe(false);
    expect(body.validUntilDays).toBe(30);
  });

  it('draft items with an unparseable duration fall back to 0 (draft-only)', () => {
    const state = {
      ...emptyComposeState(),
      items: [completeItem({ durationDays: '' })],
    };
    expect(buildDraftBody(state, 'p-1').items[0]?.durationDays).toBe(0);
  });
});

describe('server 409 SAFETY_BLOCK extraction', () => {
  it('finds findings in the real backend envelope', () => {
    const body = {
      success: false,
      error: {
        message: 'One or more items failed the clinical safety dry-run',
        details: {
          safetyBlockCode: 'SAFETY_BLOCK',
          overridable: true,
          findings: [{ itemIndex: 0, drugName: 'Aspirin', flaggedPrimitives: ['allergy'] }],
        },
      },
      code: 'CONFLICT',
      statusCode: 409,
    };
    const block = extractServerBlock(body);
    expect(block).not.toBeNull();
    expect(block?.findings).toHaveLength(1);
    expect(block?.findings[0]?.drugName).toBe('Aspirin');
    expect(block?.message).toContain('safety dry-run');
  });

  it('returns null for payloads without findings', () => {
    expect(extractServerBlock(null)).toBeNull();
    expect(extractServerBlock({ error: { message: 'nope' } })).toBeNull();
    expect(extractServerBlock('string')).toBeNull();
  });
});

describe('templates → compose rows', () => {
  const catalog = new Map<string, DrugLite>([
    ['d1', { id: 'd1', genericName: 'Amoxicillin', strengthDisplay: '500 mg' }],
  ]);

  it('resolves catalog ids, converts weeks and keeps only controlled frequencies', () => {
    const rows = templateItemsToCompose(
      [
        {
          drugId: 'd1',
          doseText: '1 capsule',
          frequency: 'tid',
          durationValue: 1,
          durationUnit: 'weeks',
          route: 'oral',
          instructions: 'after food',
        },
        {
          drugId: 'missing',
          doseText: '5 ml',
          frequency: '1+0+1',
          durationValue: 5,
          durationUnit: 'days',
        },
      ],
      catalog,
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]?.drugName).toBe('Amoxicillin');
    expect(rows[0]?.strength).toBe('500 mg');
    expect(rows[0]?.frequency).toBe('TID');
    expect(rows[0]?.durationDays).toBe('7');
    // Unresolvable drug → honest blank; bespoke frequency → must re-pick.
    expect(rows[1]?.drugName).toBe('');
    expect(rows[1]?.frequency).toBe('');
    expect(rows[1]?.durationDays).toBe('5');
  });

  it('rejects non-array JSON payloads', () => {
    expect(templateItemsToCompose('junk', catalog)).toEqual([]);
    expect(templateItemsToCompose({ a: 1 }, catalog)).toEqual([]);
    expect(templateItemsToCompose([null, 'x'], catalog)).toEqual([]);
  });
});

describe('compose state hydration', () => {
  it('openDraftToCompose maps the server OpenDraftView defensively', () => {
    const s = openDraftToCompose({
      prescriptionId: 'rx-1',
      items: [{ drugName: 'Metformin', durationDays: 30 }],
      diagnosisCodes: ['E11.9'],
      refillsAllowed: 2,
      notes: null,
      validUntilDays: 90,
    });
    expect(s.serverDraftId).toBe('rx-1');
    expect(s.items[0]?.drugName).toBe('Metformin');
    expect(s.items[0]?.strength).toBe('');
    expect(s.items[0]?.durationDays).toBe('30');
    expect(s.diagnosisText).toBe('E11.9');
    expect(s.refillsAllowed).toBe('2');
    expect(s.validUntilDays).toBe('90');
    expect(s.notes).toBe('');
  });

  it('isPristine is true only for untouched state', () => {
    expect(isPristine(emptyComposeState())).toBe(true);
    expect(isPristine({ ...emptyComposeState(), items: [emptyItem()] })).toBe(false);
    expect(isPristine({ ...emptyComposeState(), notes: 'x' })).toBe(false);
  });
});

describe('allergy banner helpers', () => {
  it('keeps ACTIVE and unknown-status allergies, drops RESOLVED', () => {
    const list = activeAllergies([
      { status: 'ACTIVE' },
      { status: 'RESOLVED' },
      {},
    ]);
    expect(list).toHaveLength(2);
  });

  it('maps severity to locked tones, unknown loudly', () => {
    expect(severityTone('ANAPHYLAXIS')).toBe('danger');
    expect(severityTone('SEVERE')).toBe('danger');
    expect(severityTone('MODERATE')).toBe('warning');
    expect(severityTone('MILD')).toBe('neutral');
    expect(severityTone(undefined)).toBe('warning');
  });
});
