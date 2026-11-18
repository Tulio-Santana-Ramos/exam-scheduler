import { describe, expect, it } from 'vitest';
import { formatDateTime, formatDay, formatTime, todayIn, utcOffsetLabel } from './time';

const TZ = 'America/Sao_Paulo';

describe('time helpers', () => {
  it('formats a UTC instant on the clinic wall clock', () => {
    expect(formatTime('2026-11-16T13:00:00.000Z', TZ)).toBe('10:00');
    expect(formatDateTime('2026-11-16T13:00:00.000Z', TZ)).toBe('16/11/2026, 10:00');
  });

  it('keeps late-evening local slots on their local date', () => {
    expect(formatDateTime('2026-11-17T01:30:00.000Z', TZ)).toBe('16/11/2026, 22:30');
  });

  it('computes today on the clinic clock, not the UTC clock', () => {
    expect(todayIn(TZ, new Date('2026-11-16T01:00:00Z'))).toBe('2026-11-15');
    expect(todayIn(TZ, new Date('2026-11-16T03:00:00Z'))).toBe('2026-11-16');
  });

  it('spells a calendar day without shifting it across timezones', () => {
    expect(formatDay('2026-11-18')).toBe('quarta-feira, 18 de novembro de 2026');
  });

  it('labels the offset', () => {
    expect(utcOffsetLabel(TZ, new Date('2026-11-16T12:00:00Z'))).toBe('UTC-3');
  });
});
