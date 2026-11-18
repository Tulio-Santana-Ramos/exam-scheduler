import { describe, expect, it } from 'vitest';
import { SlotStart } from '../../src/domain/slot-start.js';
import { CLINIC_HOURS } from '../support/fakes.js';

const NOW = new Date('2026-11-15T12:00:00.000Z');
const slot = (iso: string) => SlotStart.fromIso(iso, NOW, CLINIC_HOURS);

describe('SlotStart', () => {
  it('accepts an aligned future instant', () => {
    const start = slot('2026-11-16T13:30:00Z');
    expect(start.instant.toISOString()).toBe('2026-11-16T13:30:00.000Z');
    expect(start.end.toISOString()).toBe('2026-11-16T14:00:00.000Z');
  });

  it('normalizes an offset instant to the same moment in UTC', () => {
    expect(slot('2026-11-16T10:00:00-03:00').instant.toISOString()).toBe('2026-11-16T13:00:00.000Z');
  });

  it('rejects a slot in the past', () => {
    expect(() => slot('2026-11-15T11:30:00Z')).toThrowError(expect.objectContaining({ code: 'SLOT_IN_PAST' }));
  });

  it('rejects the exact current instant: a slot must start in the future', () => {
    expect(() => slot('2026-11-15T12:00:00Z')).toThrowError(expect.objectContaining({ code: 'SLOT_IN_PAST' }));
  });

  it.each(['2026-11-16T13:15:00Z', '2026-11-16T13:00:01Z', '2026-11-16T13:00:00.500Z'])(
    'rejects %s because it is off the 30-minute grid',
    (iso) => {
      expect(() => slot(iso)).toThrowError(expect.objectContaining({ code: 'SLOT_MISALIGNED' }));
    },
  );

  it.each(['2026-11-16T13:00:00', '2026-11-16', 'tomorrow', '2026-13-40T10:00:00Z'])(
    'rejects %s as invalid input',
    (iso) => {
      expect(() => slot(iso)).toThrowError(expect.objectContaining({ code: 'INVALID_INPUT' }));
    },
  );
});

describe('SlotStart opening hours (07:00-19:00 America/Sao_Paulo, UTC-3)', () => {
  it.each([
    ['07:00 local, first slot of the day', '2026-11-16T10:00:00Z'],
    ['18:30 local, last slot of the day', '2026-11-16T21:30:00Z'],
    ['12:00 local', '2026-11-16T15:00:00Z'],
  ])('accepts %s', (_label, iso) => {
    expect(() => slot(iso)).not.toThrow();
  });

  it.each([
    ['06:30 local, before opening', '2026-11-16T09:30:00Z'],
    ['19:00 local, the slot would start at closing time', '2026-11-16T22:00:00Z'],
    ['19:30 local', '2026-11-16T22:30:00Z'],
    ['02:00 local', '2026-11-16T05:00:00Z'],
    ['23:30 local, which is already the next UTC day', '2026-11-17T02:30:00Z'],
  ])('rejects %s', (_label, iso) => {
    expect(() => slot(iso)).toThrowError(expect.objectContaining({ code: 'SLOT_OUTSIDE_OPENING_HOURS' }));
  });

  it('judges hours in the clinic timezone, whatever offset the client sends', () => {
    expect(() => slot('2026-11-16T07:00:00-03:00')).not.toThrow();
    expect(() => slot('2026-11-16T07:00:00Z')).toThrowError(
      expect.objectContaining({ code: 'SLOT_OUTSIDE_OPENING_HOURS' }),
    );
  });

  it('reports the past before the hours when both are violated', () => {
    expect(() => slot('2026-11-14T03:00:00Z')).toThrowError(expect.objectContaining({ code: 'SLOT_IN_PAST' }));
  });
});

describe('ClinicHours.slotStartsOn', () => {
  it('lists the 24 half-hour slots from 07:00 to 18:30 local, ending exactly at closing time', () => {
    const starts = CLINIC_HOURS.slotStartsOn('2026-11-16');
    expect(starts).toHaveLength(24);
    expect(starts[0]?.toISOString()).toBe('2026-11-16T10:00:00.000Z');
    expect(starts[23]?.toISOString()).toBe('2026-11-16T21:30:00.000Z');
    expect(() => starts.forEach((start) => SlotStart.fromIso(start.toISOString(), new Date('2026-11-01T00:00:00Z'), CLINIC_HOURS))).not.toThrow();
  });

  it('rejects an invalid date', () => {
    expect(() => CLINIC_HOURS.slotStartsOn('2026-02-30')).toThrowError(
      expect.objectContaining({ code: 'INVALID_INPUT' }),
    );
  });
});
