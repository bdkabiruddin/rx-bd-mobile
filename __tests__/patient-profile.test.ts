// Patient profile / allergies / contacts / DSAR — pure logic suite (Node
// environment, no RN imports).
//
// Validation assertions mirror the backend rules so a drift in either
// direction shows up here:
//   - bdNationalIdentifiers.ts (NID 10/13/17, BRN 17, health-ID 4–32)
//   - upsertMyPatientProfileSchema (heightCm 0<h≤300, YYYY-MM-DD birthDate)
//   - createMyEmergencyContactSchema (^\+8801\d{9}$, email required key)
//   - recordAllergySchema (allergen.display + severity required)
//   - CancelMyDsarRequestHandler (PENDING → CANCELLED only)

import {
  ALLERGY_SEVERITIES,
  allergySeverityTone,
  bloodTypeDisplay,
  buildEmergencyContactBody,
  buildRecordAllergyBody,
  buildUpsertProfileBody,
  dsarStatusTone,
  emptyAllergyForm,
  emptyContactForm,
  emptyProfileForm,
  isCancellableDsar,
  isEmptyProfileForm,
  isValidBrn,
  isValidHealthId,
  isValidNid,
  isValidPastDate,
  maskIdentifier,
  partitionAllergies,
  seedProfileForm,
  sortContactsByPriority,
  type ProfileFormValues,
} from '@/features/patient-profile/logic';
import type { AllergyView, PatientProfileView } from '@/features/patient-profile/types';

const NOW_MS = Date.parse('2026-07-10T12:00:00+06:00');

// ── Identifier masking ──────────────────────────────────────────────────

describe('maskIdentifier', () => {
  it('shows only the last four characters', () => {
    expect(maskIdentifier('1234567890')).toBe('••••7890');
  });
  it('fully masks short values (never reveals a 4-char id)', () => {
    expect(maskIdentifier('1234')).toBe('••••');
  });
  it('returns empty for empty input', () => {
    expect(maskIdentifier('  ')).toBe('');
  });
});

// ── Blood group display ─────────────────────────────────────────────────

describe('bloodTypeDisplay', () => {
  it('maps enum codes to clinical notation', () => {
    expect(bloodTypeDisplay('A_POS')).toBe('A+');
    expect(bloodTypeDisplay('O_NEG')).toBe('O−');
    expect(bloodTypeDisplay('AB_POS')).toBe('AB+');
  });
  it('returns null for UNKNOWN / unrecognized / missing (no fabrication)', () => {
    expect(bloodTypeDisplay('UNKNOWN')).toBeNull();
    expect(bloodTypeDisplay('SOMETHING_NEW')).toBeNull();
    expect(bloodTypeDisplay(null)).toBeNull();
    expect(bloodTypeDisplay(undefined)).toBeNull();
  });
});

// ── Tone maps ───────────────────────────────────────────────────────────

describe('allergySeverityTone', () => {
  it('escalates danger for SEVERE and ANAPHYLAXIS', () => {
    expect(allergySeverityTone('ANAPHYLAXIS')).toBe('danger');
    expect(allergySeverityTone('SEVERE')).toBe('danger');
    expect(allergySeverityTone('MODERATE')).toBe('warning');
    expect(allergySeverityTone('MILD')).toBe('info');
  });
  it('degrades unknown severities to neutral', () => {
    expect(allergySeverityTone('WEIRD')).toBe('neutral');
  });
});

describe('dsarStatusTone / isCancellableDsar', () => {
  it('maps the DSAR lifecycle', () => {
    expect(dsarStatusTone('PENDING')).toBe('warning');
    expect(dsarStatusTone('APPROVED')).toBe('info');
    expect(dsarStatusTone('IN_PROGRESS')).toBe('info');
    expect(dsarStatusTone('COMPLETED')).toBe('success');
    expect(dsarStatusTone('REJECTED')).toBe('danger');
    expect(dsarStatusTone('CANCELLED')).toBe('neutral');
    expect(dsarStatusTone('EXPIRED')).toBe('neutral');
  });
  it('only PENDING requests are subject-cancellable (backend transition rule)', () => {
    expect(isCancellableDsar('PENDING')).toBe(true);
    for (const s of ['APPROVED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED', 'EXPIRED']) {
      expect(isCancellableDsar(s)).toBe(false);
    }
  });
});

// ── Contact ordering ────────────────────────────────────────────────────

describe('sortContactsByPriority', () => {
  it('sorts priority 1 first, missing priority last, ties by name', () => {
    const sorted = sortContactsByPriority([
      { name: 'Zed', priority: 2 },
      { name: 'Ana' },
      { name: 'Mim', priority: 1 },
      { name: 'Bob', priority: 2 },
    ]);
    expect(sorted.map((c) => c.name)).toEqual(['Mim', 'Bob', 'Zed', 'Ana']);
  });
});

// ── Allergy partition ───────────────────────────────────────────────────

describe('partitionAllergies', () => {
  const a = (id: string, severity: string, status: string): AllergyView => ({
    id,
    allergenDisplay: `allergen-${id}`,
    severity,
    status,
  });

  it('splits active/resolved and orders active most-severe-first', () => {
    const { active, resolved } = partitionAllergies([
      a('1', 'MILD', 'ACTIVE'),
      a('2', 'ANAPHYLAXIS', 'ACTIVE'),
      a('3', 'MODERATE', 'RESOLVED'),
      a('4', 'SEVERE', 'ACTIVE'),
    ]);
    expect(active.map((x) => x.id)).toEqual(['2', '4', '1']);
    expect(resolved.map((x) => x.id)).toEqual(['3']);
  });

  it('treats unknown statuses as active (fail-safe: never hides a possible allergy)', () => {
    const { active, resolved } = partitionAllergies([a('1', 'MILD', 'SOMETHING_NEW')]);
    expect(active).toHaveLength(1);
    expect(resolved).toHaveLength(0);
  });
});

// ── Date helper ─────────────────────────────────────────────────────────

describe('isValidPastDate', () => {
  it('accepts a real past date and rejects malformed / future values', () => {
    expect(isValidPastDate('1990-01-25', NOW_MS)).toBe(true);
    expect(isValidPastDate('2027-01-01', NOW_MS)).toBe(false);
    expect(isValidPastDate('01-25-1990', NOW_MS)).toBe(false);
    expect(isValidPastDate('not-a-date', NOW_MS)).toBe(false);
  });
});

// ── BD identifiers (mirror bdNationalIdentifiers.ts) ────────────────────

describe('BD identifier shape checks', () => {
  it('NID accepts 10/13/17 digits, with separators stripped', () => {
    expect(isValidNid('1234567890')).toBe(true);
    expect(isValidNid('1234567890123')).toBe(true);
    expect(isValidNid('1234-5678-90')).toBe(true);
    expect(isValidNid('123456789')).toBe(false);
    expect(isValidNid('12345678901')).toBe(false);
    expect(isValidNid('abcdefghij')).toBe(false);
  });
  it('BRN is exactly 17 digits', () => {
    expect(isValidBrn('12345678901234567')).toBe(true);
    expect(isValidBrn('1234567890123456')).toBe(false);
  });
  it('health ID is 4–32 alphanumeric/hyphen', () => {
    expect(isValidHealthId('HID-2024-XYZ')).toBe(true);
    expect(isValidHealthId('ab1')).toBe(false);
    expect(isValidHealthId('has space')).toBe(false);
  });
});

// ── Profile body builder ────────────────────────────────────────────────

describe('buildUpsertProfileBody', () => {
  const server: PatientProfileView = {
    userId: 'u1',
    birthDate: '1980-02-02',
    gender: 'female',
    bloodType: 'B_POS',
    lactationStatus: 'UNKNOWN',
    heightCm: '160',
    nationalId: '1234567890',
    birthRegNo: null,
    healthId: null,
  };

  const values = (over: Partial<ProfileFormValues>): ProfileFormValues => ({
    ...emptyProfileForm(),
    ...over,
  });

  it('sends filled fields, clears server-held fields the user emptied, omits the rest', () => {
    const res = buildUpsertProfileBody(
      values({ birthDate: '1990-01-25', heightCm: '172.5', healthId: 'HID-1234' }),
      server,
      NOW_MS,
    );
    expect(res).toEqual({
      ok: true,
      body: {
        birthDate: '1990-01-25',
        gender: null, // server had female, user unselected → explicit clear
        bloodType: null, // server had B_POS → explicit clear
        heightCm: 172.5,
        nationalId: null, // server had a NID, field emptied → explicit clear
        healthId: 'HID-1234',
        // birthRegNo omitted: empty AND server never held one
        // lactationStatus omitted: no null clear on the wire; unselected = unchanged
      },
    });
  });

  it('omits empty fields entirely when there is no server profile (no accidental wipe)', () => {
    const res = buildUpsertProfileBody(values({ gender: 'male' }), null, NOW_MS);
    expect(res).toEqual({ ok: true, body: { gender: 'male' } });
  });

  it('rejects a future birth date', () => {
    const res = buildUpsertProfileBody(values({ birthDate: '2030-01-01' }), null, NOW_MS);
    expect(res).toEqual({ ok: false, issue: { field: 'birthDate', kind: 'FUTURE' } });
  });

  it('rejects malformed birth date, out-of-range height and bad identifiers', () => {
    expect(buildUpsertProfileBody(values({ birthDate: '25/01/1990' }), null, NOW_MS)).toEqual({
      ok: false,
      issue: { field: 'birthDate', kind: 'INVALID' },
    });
    expect(buildUpsertProfileBody(values({ heightCm: '350' }), null, NOW_MS)).toEqual({
      ok: false,
      issue: { field: 'heightCm', kind: 'INVALID' },
    });
    expect(buildUpsertProfileBody(values({ nationalId: '12345' }), null, NOW_MS)).toEqual({
      ok: false,
      issue: { field: 'nationalId', kind: 'INVALID' },
    });
    expect(buildUpsertProfileBody(values({ birthRegNo: '123' }), null, NOW_MS)).toEqual({
      ok: false,
      issue: { field: 'birthRegNo', kind: 'INVALID' },
    });
    expect(buildUpsertProfileBody(values({ healthId: 'x' }), null, NOW_MS)).toEqual({
      ok: false,
      issue: { field: 'healthId', kind: 'INVALID' },
    });
  });

  it('sends lactationStatus only when the user picked one (UNKNOWN is the reset)', () => {
    const res = buildUpsertProfileBody(values({ lactationStatus: 'UNKNOWN' }), null, NOW_MS);
    expect(res).toEqual({ ok: true, body: { lactationStatus: 'UNKNOWN' } });
  });

  it('detects the untouched empty form', () => {
    expect(isEmptyProfileForm(emptyProfileForm())).toBe(true);
    expect(isEmptyProfileForm(values({ healthId: 'HID-1' }))).toBe(false);
  });

  it('seeds the form from a server profile and degrades unknown enums to unselected', () => {
    const seeded = seedProfileForm({ ...server, gender: 'SOMETHING_NEW', bloodType: 'B_POS' });
    expect(seeded.gender).toBe('');
    expect(seeded.bloodType).toBe('B_POS');
    expect(seeded.birthDate).toBe('1980-02-02');
    expect(seedProfileForm(null)).toEqual(emptyProfileForm());
  });
});

// ── Emergency contact body builder ──────────────────────────────────────

describe('buildEmergencyContactBody', () => {
  it('normalizes a local phone to +880 and includes email: null when absent', () => {
    const res = buildEmergencyContactBody({
      ...emptyContactForm(),
      name: '  Rahima Khatun ',
      relationship: 'Mother',
      phone: '01712345678',
    });
    expect(res).toEqual({
      ok: true,
      body: {
        name: 'Rahima Khatun',
        relationship: 'Mother',
        phoneE164: '+8801712345678',
        email: null,
      },
    });
  });

  it('keeps a valid email and trims notes into the body', () => {
    const res = buildEmergencyContactBody({
      name: 'Karim',
      relationship: 'Brother',
      phone: '+8801912345678',
      email: 'karim@example.com',
      notes: '  speaks English  ',
    });
    expect(res).toEqual({
      ok: true,
      body: {
        name: 'Karim',
        relationship: 'Brother',
        phoneE164: '+8801912345678',
        email: 'karim@example.com',
        notes: 'speaks English',
      },
    });
  });

  it('rejects missing name/relationship, non-BD phones and bad emails', () => {
    expect(
      buildEmergencyContactBody({ ...emptyContactForm(), relationship: 'x', phone: '01712345678' }),
    ).toEqual({ ok: false, issue: { field: 'name', kind: 'REQUIRED' } });
    expect(
      buildEmergencyContactBody({ ...emptyContactForm(), name: 'x', phone: '01712345678' }),
    ).toEqual({ ok: false, issue: { field: 'relationship', kind: 'REQUIRED' } });
    expect(
      buildEmergencyContactBody({ ...emptyContactForm(), name: 'x', relationship: 'y', phone: '12345' }),
    ).toEqual({ ok: false, issue: { field: 'phone', kind: 'INVALID' } });
    expect(
      buildEmergencyContactBody({
        ...emptyContactForm(),
        name: 'x',
        relationship: 'y',
        phone: '01712345678',
        email: 'not-an-email',
      }),
    ).toEqual({ ok: false, issue: { field: 'email', kind: 'INVALID' } });
  });
});

// ── Allergy body builder ────────────────────────────────────────────────

describe('buildRecordAllergyBody', () => {
  it('builds the minimal body (allergen.display + severity, system pinned custom)', () => {
    const res = buildRecordAllergyBody(
      { ...emptyAllergyForm(), allergen: ' Penicillin ', severity: 'SEVERE' },
      NOW_MS,
    );
    expect(res).toEqual({
      ok: true,
      body: { allergen: { display: 'Penicillin', system: 'custom' }, severity: 'SEVERE' },
    });
  });

  it('includes trimmed reaction and a valid past onset date', () => {
    const res = buildRecordAllergyBody(
      {
        allergen: 'Peanuts',
        severity: 'ANAPHYLAXIS',
        reaction: ' swelling ',
        onsetDate: '2019-05-01',
      },
      NOW_MS,
    );
    expect(res).toEqual({
      ok: true,
      body: {
        allergen: { display: 'Peanuts', system: 'custom' },
        severity: 'ANAPHYLAXIS',
        reaction: 'swelling',
        onsetDate: '2019-05-01',
      },
    });
  });

  it('rejects missing allergen, missing severity and future onset', () => {
    expect(buildRecordAllergyBody({ ...emptyAllergyForm(), severity: 'MILD' }, NOW_MS)).toEqual({
      ok: false,
      issue: { field: 'allergen', kind: 'REQUIRED' },
    });
    expect(buildRecordAllergyBody({ ...emptyAllergyForm(), allergen: 'Dust' }, NOW_MS)).toEqual({
      ok: false,
      issue: { field: 'severity', kind: 'REQUIRED' },
    });
    expect(
      buildRecordAllergyBody(
        { ...emptyAllergyForm(), allergen: 'Dust', severity: 'MILD', onsetDate: '2030-01-01' },
        NOW_MS,
      ),
    ).toEqual({ ok: false, issue: { field: 'onsetDate', kind: 'INVALID' } });
  });

  it('exposes the backend severity vocabulary in order', () => {
    expect(ALLERGY_SEVERITIES).toEqual(['MILD', 'MODERATE', 'SEVERE', 'ANAPHYLAXIS']);
  });
});
