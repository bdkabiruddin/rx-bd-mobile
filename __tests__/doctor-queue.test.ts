// Doctor chamber queue — pure logic suite (Node environment, no RN imports).

import {
  chamberNameOf,
  effectiveChamberId,
  formatNumber,
  isWalkIn,
  joinParts,
  minutesBetween,
  pickNowServing,
  priorityTone,
  toWaitingList,
} from '@/features/doctor-queue/logic';
import {
  inConsultLabel,
  priorityLabel,
  waitShortLabel,
} from '@/features/doctor-queue/strings';
import type { ChamberLite, DoctorQueueEntry } from '@/features/doctor-queue/types';

const entry = (over: Partial<DoctorQueueEntry> & { id: string }): DoctorQueueEntry => ({
  stage: 'DOCTOR_READY',
  ...over,
});

describe('pickNowServing — the IN_CONSULTATION card is never invented', () => {
  it('returns the first IN_CONSULTATION entry (server priority order)', () => {
    const entries = [
      entry({ id: 'a', stage: 'DOCTOR_READY' }),
      entry({ id: 'b', stage: 'IN_CONSULTATION' }),
      entry({ id: 'c', stage: 'IN_CONSULTATION' }),
    ];
    expect(pickNowServing(entries, null)?.id).toBe('b');
  });

  it('returns null when nobody is in consultation / list empty / absent', () => {
    expect(pickNowServing([entry({ id: 'a', stage: 'CHECKED_IN' })], null)).toBeNull();
    expect(pickNowServing([], null)).toBeNull();
    expect(pickNowServing(null, null)).toBeNull();
    expect(pickNowServing(undefined, null)).toBeNull();
  });

  it("skips another doctor's patient in a shared chamber", () => {
    const entries = [
      entry({ id: 'other', stage: 'IN_CONSULTATION', doctorUserId: 'dr-2' }),
      entry({ id: 'mine', stage: 'IN_CONSULTATION', doctorUserId: 'dr-1' }),
    ];
    expect(pickNowServing(entries, 'dr-1')?.id).toBe('mine');
  });

  it('trusts entries without a doctorUserId (doctor-owned chamber)', () => {
    const entries = [entry({ id: 'x', stage: 'IN_CONSULTATION' })];
    expect(pickNowServing(entries, 'dr-1')?.id).toBe('x');
  });
});

describe('toWaitingList — defensive DOCTOR_READY filter, server order kept', () => {
  it('keeps only DOCTOR_READY rows in their incoming order', () => {
    const entries = [
      entry({ id: 'a', stage: 'DOCTOR_READY' }),
      entry({ id: 'b', stage: 'IN_CONSULTATION' }),
      entry({ id: 'c', stage: 'DOCTOR_READY' }),
      entry({ id: 'd', stage: 'COMPLETED' }),
    ];
    expect(toWaitingList(entries).map((e) => e.id)).toEqual(['a', 'c']);
  });

  it('degrades absent payloads to an empty list', () => {
    expect(toWaitingList(null)).toEqual([]);
    expect(toWaitingList(undefined)).toEqual([]);
  });
});

describe('effectiveChamberId — selected > primary > first, active only', () => {
  const chambers: ChamberLite[] = [
    { id: 'c1', name: 'Dhanmondi', isActive: true },
    { id: 'c2', name: 'Uttara', isPrimary: true, isActive: true },
    { id: 'c3', name: 'Closed', isActive: false },
  ];

  it('honours an explicit selection that is still usable', () => {
    expect(effectiveChamberId(chambers, 'c1')).toBe('c1');
  });

  it('falls back to the primary chamber when nothing is selected', () => {
    expect(effectiveChamberId(chambers, null)).toBe('c2');
  });

  it('falls back to the first chamber when no primary exists', () => {
    expect(effectiveChamberId([{ id: 'c9' }, { id: 'c10' }], null)).toBe('c9');
  });

  it('ignores inactive chambers and stale selections', () => {
    expect(effectiveChamberId(chambers, 'c3')).toBe('c2');
    expect(effectiveChamberId([{ id: 'c3', isActive: false }], null)).toBeNull();
  });

  it('is null for an empty/absent chamber list', () => {
    expect(effectiveChamberId([], null)).toBeNull();
    expect(effectiveChamberId(null, 'c1')).toBeNull();
  });
});

describe('chamberNameOf', () => {
  it('resolves a trimmed display name', () => {
    expect(chamberNameOf([{ id: 'c1', name: '  Dhanmondi  ' }], 'c1')).toBe('Dhanmondi');
  });

  it('never invents a name', () => {
    expect(chamberNameOf([{ id: 'c1', name: '' }], 'c1')).toBeNull();
    expect(chamberNameOf([{ id: 'c1' }], 'c2')).toBeNull();
    expect(chamberNameOf([], null)).toBeNull();
  });
});

describe('minutesBetween — snapshot-relative, clamped, never invented', () => {
  const at = Date.parse('2026-07-10T10:30:00.000Z');

  it('floors whole minutes since the ISO instant', () => {
    expect(minutesBetween('2026-07-10T10:00:00.000Z', at)).toBe(30);
    expect(minutesBetween('2026-07-10T10:29:31.000Z', at)).toBe(0);
  });

  it('clamps future instants to 0 (clock skew)', () => {
    expect(minutesBetween('2026-07-10T11:00:00.000Z', at)).toBe(0);
  });

  it('is null on absent/malformed input', () => {
    expect(minutesBetween(null, at)).toBeNull();
    expect(minutesBetween(undefined, at)).toBeNull();
    expect(minutesBetween('', at)).toBeNull();
    expect(minutesBetween('not-a-date', at)).toBeNull();
  });
});

describe('priority pills — only elevated priorities get a pill', () => {
  it('maps elevated priorities', () => {
    expect(priorityTone('EMERGENCY')).toBe('danger');
    expect(priorityTone('URGENT')).toBe('warning');
    expect(priorityLabel('EMERGENCY')?.en).toBe('Emergency');
    expect(priorityLabel('URGENT')?.bn).toBe('জরুরি');
  });

  it('renders NO pill for normal/absent/unknown priority', () => {
    expect(priorityTone('NORMAL')).toBeNull();
    expect(priorityTone(undefined)).toBeNull();
    expect(priorityLabel('NORMAL')).toBeNull();
    expect(priorityLabel('SOMETHING_NEW')).toBeNull();
  });
});

describe('formatNumber — locale-aware numerals', () => {
  it('uses Bangla digits for bn and Latin for en', () => {
    expect(formatNumber(3, 'bn')).toBe('৩');
    expect(formatNumber(3, 'en')).toBe('3');
    expect(formatNumber(1250, 'en')).toBe('1,250');
  });
});

describe('localized derived labels', () => {
  it('builds the short waiting badge in both languages', () => {
    expect(waitShortLabel(32).en).toBe('32m');
    expect(waitShortLabel(32).bn).toBe('৩২ মি');
  });

  it('builds the in-consultation line, falling back without a start time', () => {
    expect(inConsultLabel(5).en).toBe('In consultation · 5 min');
    expect(inConsultLabel(5).bn).toBe('পরামর্শ চলছে · ৫ মিনিট');
    expect(inConsultLabel(null).en).toBe('In consultation');
  });
});

describe('row helpers', () => {
  it('flags walk-ins only', () => {
    expect(isWalkIn('WALK_IN')).toBe(true);
    expect(isWalkIn('SCHEDULED')).toBe(false);
    expect(isWalkIn(undefined)).toBe(false);
  });

  it('joins only defined, non-empty parts', () => {
    expect(joinParts(['Ready', null, 'Token A-4', undefined, ''])).toBe(
      'Ready · Token A-4',
    );
    expect(joinParts([null, undefined])).toBe('');
  });
});
