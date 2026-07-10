// Doctor patient search + summary — pure logic suite (Node environment,
// no RN imports).

import type { ApiError } from '@/api/errors';
import {
  bloodTypeDisplay,
  clampSearchQuery,
  conditionSeverityTone,
  displayNameOf,
  extraAllergyStrings,
  formatVitalValue,
  isConsentDenied,
  isSearchable,
  joinParts,
  labOrderPriorityTone,
  labOrderStatusTone,
  labTestsSummary,
  localizeDigits,
  medicationStatusTone,
  prescriptionStatusTone,
  shortPatientRef,
  visibleAllergies,
  writesLocked,
} from '@/features/doctor-patients/logic';
import type { AllergyRow, VitalRow } from '@/features/doctor-patients/types';

const allergy = (over: Partial<AllergyRow> & { id: string }): AllergyRow => ({
  allergenDisplay: 'Penicillin',
  severity: 'SEVERE',
  status: 'ACTIVE',
  ...over,
});

describe('search query guards (server bounds: min 1, max 100)', () => {
  it('trims and clamps to 100 chars', () => {
    expect(clampSearchQuery('  abc  ')).toBe('abc');
    expect(clampSearchQuery('x'.repeat(150))).toHaveLength(100);
  });

  it('whitespace-only input is not searchable', () => {
    expect(isSearchable('   ')).toBe(false);
    expect(isSearchable('')).toBe(false);
    expect(isSearchable(' a ')).toBe(true);
  });
});

describe('shortPatientRef — the correlatable ID fragment', () => {
  it('uses the first UUID group, uppercased', () => {
    expect(shortPatientRef('07f9c2d1-1234-5678-9abc-def012345678')).toBe('07F9C2D1');
  });
  it('falls back to the whole id when there is no dash group', () => {
    expect(shortPatientRef('abc')).toBe('ABC');
  });
});

describe('displayNameOf — never fabricates a name', () => {
  it('returns the trimmed full name when present', () => {
    expect(displayNameOf({ patientId: 'p', fullName: ' Ayesha Rahman ' })).toBe(
      'Ayesha Rahman',
    );
  });
  it('returns null for empty / missing names (caller falls back to initials)', () => {
    expect(displayNameOf({ patientId: 'p', fullName: '' })).toBeNull();
    expect(displayNameOf({ patientId: 'p', fullName: '   ' })).toBeNull();
    expect(displayNameOf({ patientId: 'p' })).toBeNull();
    expect(displayNameOf(null)).toBeNull();
  });
});

describe('writesLocked — DECEASED record lock mirrors the backend', () => {
  it('locks only for DECEASED', () => {
    expect(writesLocked({ patientId: 'p', status: 'DECEASED' })).toBe(true);
    expect(writesLocked({ patientId: 'p', status: 'ACTIVE' })).toBe(false);
    expect(writesLocked({ patientId: 'p' })).toBe(false);
    expect(writesLocked(null)).toBe(false);
  });
});

describe('bloodTypeDisplay', () => {
  it('maps wire enums to display groups', () => {
    expect(bloodTypeDisplay('A_POS')).toBe('A+');
    expect(bloodTypeDisplay('O_NEG')).toBe('O−');
    expect(bloodTypeDisplay('AB_NEG')).toBe('AB−');
  });
  it('returns null for UNKNOWN / absent / unrecognized (no guessing)', () => {
    expect(bloodTypeDisplay('UNKNOWN')).toBeNull();
    expect(bloodTypeDisplay(null)).toBeNull();
    expect(bloodTypeDisplay(undefined)).toBeNull();
    expect(bloodTypeDisplay('WEIRD')).toBeNull();
  });
});

describe('localizeDigits', () => {
  it('converts ASCII digits to Bangla numerals for bn', () => {
    expect(localizeDigits('20–30', 'bn')).toBe('২০–৩০');
    expect(localizeDigits('90+', 'bn')).toBe('৯০+');
  });
  it('leaves en untouched', () => {
    expect(localizeDigits('20–30', 'en')).toBe('20–30');
  });
});

describe('isConsentDenied — 403 renders the honest locked state', () => {
  const err = (code: ApiError['code']): ApiError => ({ code, message: 'x' });
  it('true only for FORBIDDEN', () => {
    expect(isConsentDenied(err('FORBIDDEN'))).toBe(true);
    expect(isConsentDenied(err('SERVER_ERROR'))).toBe(false);
    expect(isConsentDenied(err('RESOURCE_NOT_FOUND'))).toBe(false);
    expect(isConsentDenied(null)).toBe(false);
  });
});

describe('visibleAllergies — fail-safe filter + severity-first ordering', () => {
  it('drops only explicitly RESOLVED rows (unknown statuses stay visible)', () => {
    const rows = [
      allergy({ id: 'a', status: 'RESOLVED' }),
      allergy({ id: 'b', status: 'ACTIVE' }),
      allergy({ id: 'c', status: 'SOMETHING_NEW' }),
    ];
    expect(visibleAllergies(rows).map((r) => r.id)).toEqual(['b', 'c']);
  });

  it('orders most severe first, stable within equal severity', () => {
    const rows = [
      allergy({ id: 'mild', severity: 'MILD' }),
      allergy({ id: 'ana', severity: 'ANAPHYLAXIS' }),
      allergy({ id: 'sev1', severity: 'SEVERE' }),
      allergy({ id: 'mod', severity: 'MODERATE' }),
      allergy({ id: 'sev2', severity: 'SEVERE' }),
    ];
    expect(visibleAllergies(rows).map((r) => r.id)).toEqual([
      'ana',
      'sev1',
      'sev2',
      'mod',
      'mild',
    ]);
  });

  it('handles null/undefined/empty input', () => {
    expect(visibleAllergies(null)).toEqual([]);
    expect(visibleAllergies(undefined)).toEqual([]);
    expect(visibleAllergies([])).toEqual([]);
  });
});

describe('extraAllergyStrings — bundle strings not already structured', () => {
  it('dedupes case-insensitively against structured rows and itself', () => {
    const detail = {
      patientId: 'p',
      structuredAllergyDisplays: ['penicillin', 'Peanut', 'PEANUT', '  ', 'Latex'],
    };
    const structured = [allergy({ id: 'a', allergenDisplay: 'Penicillin' })];
    expect(extraAllergyStrings(detail, structured)).toEqual(['Peanut', 'Latex']);
  });
  it('returns [] when the detail bundle is absent', () => {
    expect(extraAllergyStrings(null, [])).toEqual([]);
  });
});

describe('status → tone maps (locked theme semantics)', () => {
  it('prescriptions', () => {
    expect(prescriptionStatusTone('ACTIVE')).toBe('success');
    expect(prescriptionStatusTone('DISPENSED')).toBe('info');
    expect(prescriptionStatusTone('EXPIRED')).toBe('warning');
    expect(prescriptionStatusTone('CANCELLED')).toBe('danger');
    expect(prescriptionStatusTone('DRAFT')).toBe('neutral');
    expect(prescriptionStatusTone('FUTURE_STATE')).toBe('neutral');
  });
  it('lab orders + priority', () => {
    expect(labOrderStatusTone('COMPLETED')).toBe('success');
    expect(labOrderStatusTone('IN_PROGRESS')).toBe('info');
    expect(labOrderStatusTone('PENDING')).toBe('warning');
    expect(labOrderStatusTone('CANCELLED')).toBe('danger');
    expect(labOrderPriorityTone('STAT')).toBe('danger');
    expect(labOrderPriorityTone('URGENT')).toBe('warning');
    expect(labOrderPriorityTone('ROUTINE')).toBe('neutral');
    expect(labOrderPriorityTone(undefined)).toBe('neutral');
  });
  it('medications + condition severity', () => {
    expect(medicationStatusTone('ACTIVE')).toBe('success');
    expect(medicationStatusTone('PAUSED')).toBe('warning');
    expect(medicationStatusTone('DISCONTINUED')).toBe('neutral');
    expect(conditionSeverityTone('SEVERE')).toBe('danger');
    expect(conditionSeverityTone('MODERATE')).toBe('warning');
    expect(conditionSeverityTone('MILD')).toBe('neutral');
    expect(conditionSeverityTone(undefined)).toBe('neutral');
  });
});

describe('formatVitalValue', () => {
  const vital = (over: Partial<VitalRow>): VitalRow => ({
    vitalReadingId: 'v',
    vitalType: 'HEART_RATE',
    valueQuantity: 72,
    unit: 'bpm',
    effectiveAt: '2026-07-01T09:00:00Z',
    ...over,
  });

  it('renders BP as systolic/diastolic with unit', () => {
    expect(
      formatVitalValue(
        vital({ vitalType: 'BLOOD_PRESSURE', valueQuantity: 120, valueSecondary: 80, unit: 'mmHg' }),
        'en',
      ),
    ).toBe('120/80 mmHg');
  });

  it('renders single-limb readings and prettifies temperature units', () => {
    expect(formatVitalValue(vital({}), 'en')).toBe('72 bpm');
    expect(
      formatVitalValue(
        vital({ vitalType: 'TEMPERATURE', valueQuantity: 37.2, unit: 'celsius', valueSecondary: null }),
        'en',
      ),
    ).toBe('37.2 °C');
  });
});

describe('joinParts / labTestsSummary', () => {
  it('joins non-empty parts with a middot', () => {
    expect(joinParts(['a', null, ' ', undefined, 'b'])).toBe('a · b');
    expect(joinParts([null, undefined])).toBe('');
  });
  it('summarizes tests preferring names, falling back to codes', () => {
    expect(
      labTestsSummary([
        { code: '718-7', name: 'CBC' },
        { code: '4548-4' },
        { name: '' },
        {},
      ]),
    ).toBe('CBC, 4548-4');
    expect(labTestsSummary(null)).toBe('');
    expect(labTestsSummary(undefined)).toBe('');
  });
});
