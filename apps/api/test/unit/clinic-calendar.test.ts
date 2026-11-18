import { describe, expect, it } from 'vitest';
import { ClinicCalendar } from '../../src/domain/clinic-calendar.js';

describe('ClinicCalendar', () => {
  const saoPaulo = new ClinicCalendar('America/Sao_Paulo');

  it('maps a Sao Paulo day to UTC-3 boundaries', () => {
    const range = saoPaulo.dayRange('2026-11-15');
    expect(range.from.toISOString()).toBe('2026-11-15T03:00:00.000Z');
    expect(range.to.toISOString()).toBe('2026-11-16T03:00:00.000Z');
  });

  it('puts a 22:00 local slot inside the same local day even though it is next-day UTC', () => {
    const range = saoPaulo.dayRange('2026-11-15');
    const lateEvening = new Date('2026-11-16T01:00:00.000Z');
    expect(lateEvening >= range.from && lateEvening < range.to).toBe(true);
  });

  it('is DST-safe: the spring-forward day in New York is 23 hours long', () => {
    const range = new ClinicCalendar('America/New_York').dayRange('2026-03-08');
    expect(range.from.toISOString()).toBe('2026-03-08T05:00:00.000Z');
    expect(range.to.toISOString()).toBe('2026-03-09T04:00:00.000Z');
  });

  it('gives local minutes since midnight regardless of the UTC date', () => {
    expect(saoPaulo.minutesOfDay(new Date('2026-11-16T10:00:00Z'))).toBe(7 * 60);
    expect(saoPaulo.minutesOfDay(new Date('2026-11-17T02:30:00Z'))).toBe(23 * 60 + 30);
    expect(saoPaulo.minutesOfDay(new Date('2026-11-16T03:00:00Z'))).toBe(0);
  });

  it('resolves a local wall-clock time to its UTC instant', () => {
    expect(saoPaulo.instantAt('2026-11-16', 7 * 60).toISOString()).toBe('2026-11-16T10:00:00.000Z');
    expect(saoPaulo.instantAt('2026-11-16', 18 * 60 + 30).toISOString()).toBe('2026-11-16T21:30:00.000Z');
    expect(new ClinicCalendar('America/New_York').instantAt('2026-03-08', 12 * 60).toISOString()).toBe(
      '2026-03-08T16:00:00.000Z',
    );
  });

  it.each(['2026-11-15T00:00', '15/11/2026', '2026-02-30', '2026-13-01'])(
    'rejects %s',
    (value) => {
      expect(() => saoPaulo.dayRange(value)).toThrowError(
        expect.objectContaining({ code: 'INVALID_INPUT' }),
      );
    },
  );
});
