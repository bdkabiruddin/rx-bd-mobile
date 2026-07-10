// Patient meds — pure logic suite (Node environment, no RN imports).

import {
  buildReminderUpsertBody,
  canReorder,
  joinParts,
  medNamesByPrescription,
  medicationStatusTone,
  normalizeReminderTime,
  prescriptionStatusTone,
  reminderStatusTone,
  sanitizeChannels,
} from '@/features/patient-meds/logic';

describe('status → tone mapping', () => {
  it('maps prescription lifecycle states to locked pill tones', () => {
    expect(prescriptionStatusTone('ACTIVE')).toBe('success');
    expect(prescriptionStatusTone('DISPENSED')).toBe('info');
    expect(prescriptionStatusTone('EXPIRED')).toBe('warning');
    expect(prescriptionStatusTone('CANCELLED')).toBe('danger');
    expect(prescriptionStatusTone('DRAFT')).toBe('neutral');
  });

  it('degrades unknown/absent statuses to neutral (no fabricated state)', () => {
    expect(prescriptionStatusTone('SOMETHING_NEW')).toBe('neutral');
    expect(prescriptionStatusTone(undefined)).toBe('neutral');
    expect(medicationStatusTone(undefined)).toBe('neutral');
    expect(reminderStatusTone(undefined)).toBe('neutral');
  });

  it('maps medication + reminder states', () => {
    expect(medicationStatusTone('ACTIVE')).toBe('success');
    expect(medicationStatusTone('PAUSED')).toBe('warning');
    expect(medicationStatusTone('DISCONTINUED')).toBe('neutral');
    expect(reminderStatusTone('ACTIVE')).toBe('success');
    expect(reminderStatusTone('PAUSED')).toBe('warning');
  });
});

describe('canReorder', () => {
  it('allows only the statuses the backend accepts as reorder sources', () => {
    expect(canReorder('EXPIRED')).toBe(true);
    expect(canReorder('COMPLETED')).toBe(true); // forward-compat with server check
    expect(canReorder('ACTIVE')).toBe(false);
    expect(canReorder('DISPENSED')).toBe(false);
    expect(canReorder('CANCELLED')).toBe(false);
    expect(canReorder(undefined)).toBe(false);
  });
});

describe('normalizeReminderTime', () => {
  it('normalizes valid 24h times to strict HH:MM', () => {
    expect(normalizeReminderTime('8:00')).toBe('08:00');
    expect(normalizeReminderTime('08:00')).toBe('08:00');
    expect(normalizeReminderTime(' 23:59 ')).toBe('23:59');
    expect(normalizeReminderTime('0:05')).toBe('00:05');
  });

  it('rejects invalid times', () => {
    expect(normalizeReminderTime('24:00')).toBeNull();
    expect(normalizeReminderTime('12:60')).toBeNull();
    expect(normalizeReminderTime('12:5')).toBeNull(); // minutes must be 2 digits
    expect(normalizeReminderTime('noon')).toBeNull();
    expect(normalizeReminderTime('')).toBeNull();
    expect(normalizeReminderTime('08.30')).toBeNull();
  });
});

describe('sanitizeChannels', () => {
  it('keeps only backend-accepted channels, deduped', () => {
    expect(sanitizeChannels(['push', 'in_app', 'push'])).toEqual(['push', 'in_app']);
  });
  it('defaults to in_app when nothing valid remains', () => {
    expect(sanitizeChannels(undefined)).toEqual(['in_app']);
    expect(sanitizeChannels([])).toEqual(['in_app']);
    expect(sanitizeChannels(['sms'])).toEqual(['in_app']);
  });
});

describe('buildReminderUpsertBody', () => {
  const row = {
    prescriptionId: '3f1a2b3c-0000-4000-8000-000000000001',
    reminderLabel: 'Napa 500 mg',
    reminderTimes: ['8:00', '20:00', '8:00'],
    channels: ['push', 'bogus'],
  };

  it('builds a full upsert body with normalized, deduped times', () => {
    expect(buildReminderUpsertBody(row, 'PAUSED')).toEqual({
      prescriptionId: row.prescriptionId,
      reminderLabel: 'Napa 500 mg',
      reminderTimes: ['08:00', '20:00'],
      channels: ['push'],
      status: 'PAUSED',
    });
  });

  it('refuses (null) when required pieces are missing — the route schema would 400', () => {
    const { prescriptionId: _noPrescription, ...withoutPrescription } = row;
    const { reminderLabel: _noLabel, ...withoutLabel } = row;
    expect(buildReminderUpsertBody(withoutPrescription, 'CANCELLED')).toBeNull();
    expect(buildReminderUpsertBody(withoutLabel, 'CANCELLED')).toBeNull();
    expect(buildReminderUpsertBody({ ...row, reminderTimes: [] }, 'CANCELLED')).toBeNull();
    expect(buildReminderUpsertBody({ ...row, reminderTimes: ['nope'] }, 'CANCELLED')).toBeNull();
  });

  it('caps times at the backend limit of 8', () => {
    const many = ['01:00', '02:00', '03:00', '04:00', '05:00', '06:00', '07:00', '08:00', '09:00'];
    const body = buildReminderUpsertBody({ ...row, reminderTimes: many }, 'ACTIVE');
    expect(body?.reminderTimes).toHaveLength(8);
  });
});

describe('medNamesByPrescription', () => {
  it('groups current-med drug names by source prescription, skipping OTC rows', () => {
    const map = medNamesByPrescription([
      { id: 'm1', sourcePrescriptionId: 'rx-1', drugName: 'Napa' },
      { id: 'm2', sourcePrescriptionId: 'rx-1', drugName: 'Seclo' },
      { id: 'm3', sourcePrescriptionId: 'rx-1', drugName: 'Napa' }, // dupe
      { id: 'm4', sourcePrescriptionId: null, drugName: 'OTC Vitamin' },
      { id: 'm5', sourcePrescriptionId: 'rx-2', drugName: '  ' }, // blank name
    ]);
    expect(map.get('rx-1')).toEqual(['Napa', 'Seclo']);
    expect(map.has('rx-2')).toBe(false);
    expect(map.size).toBe(1);
  });

  it('handles undefined input', () => {
    expect(medNamesByPrescription(undefined).size).toBe(0);
  });
});

describe('joinParts', () => {
  it('joins defined non-empty parts with a middle dot', () => {
    expect(joinParts(['a', undefined, '', 'b', null])).toBe('a · b');
    expect(joinParts([undefined, null])).toBe('');
  });
});
