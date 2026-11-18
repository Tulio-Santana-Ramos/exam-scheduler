import type { ClinicCalendar } from './clinic-calendar.js';
import { SlotOutsideOpeningHoursError } from './errors.js';
import { SLOT_MINUTES } from './slot-start.js';

const pad = (hour: number): string => `${String(hour).padStart(2, '0')}:00`;

/** Daily opening window in clinic-local time. A slot must fit entirely inside it. */
export class ClinicHours {
  constructor(
    private readonly calendar: ClinicCalendar,
    readonly openHour: number,
    readonly closeHour: number,
  ) {
    const valid =
      Number.isInteger(openHour) && Number.isInteger(closeHour) && openHour >= 0 && closeHour <= 24;
    if (!valid || closeHour <= openHour) {
      throw new Error(`Invalid clinic hours: ${openHour}-${closeHour}`);
    }
  }

  get timeZone(): string {
    return this.calendar.timeZone;
  }

  /** Every slot start of one clinic-local day, in order. */
  slotStartsOn(date: string): Date[] {
    const starts: Date[] = [];
    for (let minute = this.openHour * 60; minute + SLOT_MINUTES <= this.closeHour * 60; minute += SLOT_MINUTES) {
      starts.push(this.calendar.instantAt(date, minute));
    }
    return starts;
  }

  assertSlotFits(slotStart: Date): void {
    const start = this.calendar.minutesOfDay(slotStart);
    if (start < this.openHour * 60 || start + SLOT_MINUTES > this.closeHour * 60) {
      throw new SlotOutsideOpeningHoursError(pad(this.openHour), pad(this.closeHour));
    }
  }
}
