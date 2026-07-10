// Doctor referrals + medical certificates — pure logic suite (Node
// environment, no RN imports).

import {
  CERTIFICATE_TYPES,
  REFERRAL_TYPES,
  REFERRAL_URGENCIES,
  buildCertificateBody,
  buildReferralBody,
  canCancelReferral,
  canRevokeCertificate,
  certificateStatusTone,
  clampSearchQuery,
  dhakaEndOfDayMs,
  formatNumber,
  isSearchable,
  joinParts,
  localizeDigits,
  makeEmptyCertificateDraft,
  makeEmptyReferralDraft,
  parseDhakaDateStartMs,
  referralStatusTone,
  shortPatientRef,
  sortByIssuedAtDesc,
  todayDhakaDate,
  urgencyTone,
} from '@/features/doctor-referrals/logic';

const PATIENT_ID = '0a1b2c3d-1111-4222-8333-444455556666';

describe('status → tone maps (locked pill tones)', () => {
  it('maps the referral lifecycle', () => {
    expect(referralStatusTone('ACTIVE')).toBe('info');
    expect(referralStatusTone('ACCEPTED')).toBe('success');
    expect(referralStatusTone('COMPLETED')).toBe('success');
    expect(referralStatusTone('FULFILLED')).toBe('success');
    expect(referralStatusTone('REDIRECTED')).toBe('warning');
    expect(referralStatusTone('EXPIRED')).toBe('warning');
    expect(referralStatusTone('DECLINED')).toBe('danger');
    expect(referralStatusTone('CANCELLED')).toBe('danger');
  });

  it('degrades unknown/absent statuses to neutral', () => {
    expect(referralStatusTone('SOMETHING_NEW')).toBe('neutral');
    expect(referralStatusTone(undefined)).toBe('neutral');
    expect(certificateStatusTone('SOMETHING_NEW')).toBe('neutral');
    expect(certificateStatusTone(undefined)).toBe('neutral');
  });

  it('maps certificate + urgency tones', () => {
    expect(certificateStatusTone('ACTIVE')).toBe('success');
    expect(certificateStatusTone('REVOKED')).toBe('danger');
    expect(urgencyTone('EMERGENT')).toBe('danger');
    expect(urgencyTone('URGENT')).toBe('warning');
    expect(urgencyTone('ROUTINE')).toBe('neutral');
    expect(urgencyTone(undefined)).toBe('neutral');
  });
});

describe('cancel affordances mirror the domain guards', () => {
  it('referrals: only ACTIVE is cancellable (sender cannot pull after triage)', () => {
    expect(canCancelReferral('ACTIVE')).toBe(true);
    for (const s of [
      'ACCEPTED',
      'DECLINED',
      'REDIRECTED',
      'COMPLETED',
      'FULFILLED',
      'EXPIRED',
      'CANCELLED',
      undefined,
    ]) {
      expect(canCancelReferral(s)).toBe(false);
    }
  });

  it('certificates: everything except REVOKED (and unknown-absent) is revocable', () => {
    expect(canRevokeCertificate('ACTIVE')).toBe(true);
    expect(canRevokeCertificate('REVOKED')).toBe(false);
    expect(canRevokeCertificate(undefined)).toBe(false);
  });
});

describe('search input clamping (server bound 1..100)', () => {
  it('trims and clamps to 100 chars', () => {
    expect(clampSearchQuery('  abc  ')).toBe('abc');
    expect(clampSearchQuery('x'.repeat(150))).toHaveLength(100);
  });

  it('isSearchable requires at least one clamped char', () => {
    expect(isSearchable('   ')).toBe(false);
    expect(isSearchable(' a ')).toBe(true);
  });
});

describe('display helpers', () => {
  it('shortPatientRef uppercases the first UUID group; null for absent', () => {
    expect(shortPatientRef(PATIENT_ID)).toBe('0A1B2C3D');
    expect(shortPatientRef('nodashes')).toBe('NODASHES');
    expect(shortPatientRef(undefined)).toBeNull();
    expect(shortPatientRef('')).toBeNull();
  });

  it('joinParts drops empties and joins with a middot', () => {
    expect(joinParts(['a', null, ' ', undefined, 'b'])).toBe('a · b');
  });

  it('localizeDigits converts to Bangla numerals only for bn', () => {
    expect(localizeDigits('20-30', 'bn')).toBe('২০-৩০');
    expect(localizeDigits('20-30', 'en')).toBe('20-30');
  });

  it('formatNumber uses Bangla numerals for bn', () => {
    expect(formatNumber(30, 'bn')).toBe('৩০');
    expect(formatNumber(30, 'en')).toBe('30');
  });

  it('sortByIssuedAtDesc puts newest first and sinks undated rows', () => {
    const rows = [
      { id: 'old', issuedAt: '2026-07-01T00:00:00Z' },
      { id: 'undated' },
      { id: 'new', issuedAt: '2026-07-09T00:00:00Z' },
    ];
    expect(sortByIssuedAtDesc(rows).map((r) => r.id)).toEqual([
      'new',
      'old',
      'undated',
    ]);
    // Non-mutating.
    expect(rows[0]?.id).toBe('old');
  });
});

describe('Dhaka day math (UTC+6, no DST)', () => {
  it('parses a Dhaka calendar day to its 00:00 local instant', () => {
    // 2026-07-10 00:00 Dhaka = 2026-07-09 18:00 UTC.
    const ms = parseDhakaDateStartMs('2026-07-10');
    expect(ms).not.toBeNull();
    expect(new Date(ms as number).toISOString()).toBe('2026-07-09T18:00:00.000Z');
  });

  it('rejects bad formats and impossible calendar days', () => {
    expect(parseDhakaDateStartMs('10/07/2026')).toBeNull();
    expect(parseDhakaDateStartMs('2026-7-10')).toBeNull();
    expect(parseDhakaDateStartMs('2026-02-30')).toBeNull();
    expect(parseDhakaDateStartMs('')).toBeNull();
  });

  it('dhakaEndOfDayMs is 23:59 local on the same day', () => {
    const start = parseDhakaDateStartMs('2026-07-10') as number;
    expect(new Date(dhakaEndOfDayMs(start)).toISOString()).toBe(
      '2026-07-10T17:59:00.000Z',
    );
  });

  it('todayDhakaDate rolls the key at 18:00 UTC', () => {
    expect(todayDhakaDate(new Date('2026-07-09T17:59:00Z'))).toBe('2026-07-09');
    expect(todayDhakaDate(new Date('2026-07-09T18:00:00Z'))).toBe('2026-07-10');
  });
});

describe('buildReferralBody — mirrors issueReferralSchema', () => {
  const base = (): ReturnType<typeof makeEmptyReferralDraft> => ({
    ...makeEmptyReferralDraft(PATIENT_ID),
    reason: '  Suspected cardiac ischaemia  ',
  });

  it('builds the minimal body, trimming and omitting empty optionals', () => {
    const out = buildReferralBody(base());
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.body).toEqual({
      patientId: PATIENT_ID,
      referralType: 'SPECIALIST',
      reason: 'Suspected cardiac ischaemia',
      urgency: 'ROUTINE',
    });
    expect('targetSpecialty' in out.body).toBe(false);
    expect('clinicalContext' in out.body).toBe(false);
    expect('validityDays' in out.body).toBe(false);
  });

  it('carries optionals when present', () => {
    const out = buildReferralBody({
      ...base(),
      targetSpecialty: ' Cardiology ',
      clinicalContext: 'ECG changes',
      validityDays: '60',
      referralType: 'SECOND_OPINION',
      urgency: 'URGENT',
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.body.targetSpecialty).toBe('Cardiology');
    expect(out.body.clinicalContext).toBe('ECG changes');
    expect(out.body.validityDays).toBe(60);
    expect(out.body.referralType).toBe('SECOND_OPINION');
    expect(out.body.urgency).toBe('URGENT');
  });

  it('requires a patient and a reason', () => {
    const noPatient = buildReferralBody({ ...base(), patientId: '  ' });
    expect(noPatient).toEqual({ ok: false, issue: { kind: 'PATIENT_REQUIRED' } });
    const noReason = buildReferralBody({ ...base(), reason: '   ' });
    expect(noReason).toEqual({ ok: false, issue: { kind: 'REASON_REQUIRED' } });
  });

  it('rejects unknown enum values (never sent to the server)', () => {
    expect(buildReferralBody({ ...base(), referralType: 'MAGIC' })).toEqual({
      ok: false,
      issue: { kind: 'TYPE_INVALID' },
    });
    expect(buildReferralBody({ ...base(), urgency: 'WHENEVER' })).toEqual({
      ok: false,
      issue: { kind: 'URGENCY_INVALID' },
    });
  });

  it('enforces the server char caps', () => {
    expect(
      buildReferralBody({ ...base(), reason: 'x'.repeat(5001) }),
    ).toEqual({ ok: false, issue: { kind: 'REASON_TOO_LONG' } });
    expect(
      buildReferralBody({ ...base(), targetSpecialty: 'x'.repeat(201) }),
    ).toEqual({ ok: false, issue: { kind: 'SPECIALTY_TOO_LONG' } });
    expect(
      buildReferralBody({ ...base(), clinicalContext: 'x'.repeat(5001) }),
    ).toEqual({ ok: false, issue: { kind: 'CONTEXT_TOO_LONG' } });
  });

  it('validityDays must be an integer 1..365', () => {
    for (const bad of ['0', '366', '30.5', '-3', 'abc']) {
      expect(buildReferralBody({ ...base(), validityDays: bad })).toEqual({
        ok: false,
        issue: { kind: 'VALIDITY_INVALID' },
      });
    }
    const edge = buildReferralBody({ ...base(), validityDays: '365' });
    expect(edge.ok).toBe(true);
  });

  it('client enum vocabularies match the backend literals', () => {
    expect(REFERRAL_TYPES).toEqual([
      'SPECIALIST',
      'DIAGNOSTIC',
      'HOSPITAL_ADMISSION',
      'SECOND_OPINION',
    ]);
    expect(REFERRAL_URGENCIES).toEqual(['ROUTINE', 'URGENT', 'EMERGENT']);
    expect(CERTIFICATE_TYPES).toEqual([
      'SICK_LEAVE',
      'FITNESS_TO_WORK',
      'FITNESS_TO_FLY',
      'FITNESS_TO_DRIVE',
      'OTHER',
    ]);
  });
});

describe('buildCertificateBody — mirrors issueCertificateSchema', () => {
  const now = new Date('2026-07-10T04:00:00Z'); // 10:00 Dhaka
  const base = (): ReturnType<typeof makeEmptyCertificateDraft> => ({
    ...makeEmptyCertificateDraft(now, PATIENT_ID),
    fromDate: '2026-07-10',
    untilDate: '2026-07-12',
    reason: ' Acute febrile illness, rest advised ',
  });

  it('serializes whole Dhaka days as UTC ISO with Z (00:00 → 23:59)', () => {
    const out = buildCertificateBody(base());
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.body.validFrom).toBe('2026-07-09T18:00:00.000Z');
    expect(out.body.validUntil).toBe('2026-07-12T17:59:00.000Z');
    expect(out.body.reason).toBe('Acute febrile illness, rest advised');
    expect(out.body.certificateType).toBe('SICK_LEAVE');
    expect('restrictions' in out.body).toBe(false);
  });

  it('a single-day certificate is valid (validUntil > validFrom holds)', () => {
    const out = buildCertificateBody({ ...base(), untilDate: '2026-07-10' });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(Date.parse(out.body.validUntil)).toBeGreaterThan(
      Date.parse(out.body.validFrom),
    );
  });

  it('rejects an end date before the start date', () => {
    expect(buildCertificateBody({ ...base(), untilDate: '2026-07-09' })).toEqual({
      ok: false,
      issue: { kind: 'UNTIL_BEFORE_FROM' },
    });
  });

  it('rejects invalid dates and missing required fields', () => {
    expect(buildCertificateBody({ ...base(), fromDate: 'nonsense' })).toEqual({
      ok: false,
      issue: { kind: 'FROM_INVALID' },
    });
    expect(buildCertificateBody({ ...base(), untilDate: '2026-02-30' })).toEqual({
      ok: false,
      issue: { kind: 'UNTIL_INVALID' },
    });
    expect(buildCertificateBody({ ...base(), patientId: '' })).toEqual({
      ok: false,
      issue: { kind: 'PATIENT_REQUIRED' },
    });
    expect(buildCertificateBody({ ...base(), reason: '  ' })).toEqual({
      ok: false,
      issue: { kind: 'REASON_REQUIRED' },
    });
    expect(buildCertificateBody({ ...base(), certificateType: 'MAGIC' })).toEqual({
      ok: false,
      issue: { kind: 'TYPE_INVALID' },
    });
  });

  it('enforces the reason/restrictions caps and carries trimmed restrictions', () => {
    expect(
      buildCertificateBody({ ...base(), reason: 'x'.repeat(5001) }),
    ).toEqual({ ok: false, issue: { kind: 'REASON_TOO_LONG' } });
    expect(
      buildCertificateBody({ ...base(), restrictions: 'x'.repeat(5001) }),
    ).toEqual({ ok: false, issue: { kind: 'RESTRICTIONS_TOO_LONG' } });
    const out = buildCertificateBody({
      ...base(),
      restrictions: '  Light duties only  ',
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.body.restrictions).toBe('Light duties only');
  });

  it('empty drafts default the window to today (Dhaka)', () => {
    const draft = makeEmptyCertificateDraft(now);
    expect(draft.fromDate).toBe('2026-07-10');
    expect(draft.untilDate).toBe('2026-07-10');
    expect(draft.patientId).toBe('');
  });
});
