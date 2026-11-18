import { InvalidInputError } from './errors.js';

export interface UtcRange {
  from: Date;
  to: Date;
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Resolves clinic-local calendar days to UTC ranges. Storage stays UTC; only filtering is local. */
export class ClinicCalendar {
  private readonly formatter: Intl.DateTimeFormat;

  constructor(readonly timeZone: string) {
    this.formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
  }

  /** Half-open range [local 00:00, next local 00:00); DST-safe because both ends are resolved separately. */
  dayRange(date: string): UtcRange {
    const { year, month, day } = this.parseDate(date);
    return {
      from: this.localInstant(year, month, day, 0),
      to: this.localInstant(year, month, day + 1, 0),
    };
  }

  /** The UTC instant at which the clinic wall clock shows `minutesOfDay` on the given local date. */
  instantAt(date: string, minutesOfDay: number): Date {
    const { year, month, day } = this.parseDate(date);
    return this.localInstant(year, month, day, minutesOfDay);
  }

  private parseDate(date: string): { year: number; month: number; day: number } {
    const match = DATE_ONLY.exec(date);
    if (!match) throw new InvalidInputError('date must be formatted as YYYY-MM-DD');
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const probe = new Date(Date.UTC(year, month - 1, day));
    if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
      throw new InvalidInputError('date is not a valid calendar day');
    }
    return { year, month, day };
  }

  private localInstant(year: number, month: number, day: number, minutesOfDay: number): Date {
    const wallClockAsUtc = Date.UTC(year, month - 1, day, 0, minutesOfDay);
    let guess = wallClockAsUtc - this.offsetMs(wallClockAsUtc);
    guess = wallClockAsUtc - this.offsetMs(guess);
    return new Date(guess);
  }

  /** Minutes elapsed since local midnight at the given instant. */
  minutesOfDay(instant: Date): number {
    const parts = this.localParts(instant.getTime());
    return (parts['hour'] ?? 0) * 60 + (parts['minute'] ?? 0);
  }

  private localParts(utcMs: number): Record<string, number> {
    const parts: Record<string, number> = {};
    for (const part of this.formatter.formatToParts(new Date(utcMs))) {
      if (part.type !== 'literal') parts[part.type] = Number(part.value);
    }
    return parts;
  }

  private offsetMs(utcMs: number): number {
    const parts = this.localParts(utcMs);
    const localAsUtc = Date.UTC(
      parts['year'] ?? 0,
      (parts['month'] ?? 1) - 1,
      parts['day'] ?? 1,
      parts['hour'] ?? 0,
      parts['minute'] ?? 0,
      parts['second'] ?? 0,
    );
    return localAsUtc - Math.floor(utcMs / 1000) * 1000;
  }
}
