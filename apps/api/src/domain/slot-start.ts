import type { ClinicHours } from './clinic-hours.js';
import { InvalidInputError, SlotInPastError, SlotMisalignedError } from './errors.js';

export const SLOT_MINUTES = 30;
const SLOT_MS = SLOT_MINUTES * 60_000;

const ISO_WITH_OFFSET =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/;

/** Start of a 30-minute slot: on the :00/:30 grid, strictly in the future, inside opening hours. */
export class SlotStart {
  private constructor(readonly instant: Date) {}

  /** Rejects ISO strings without an explicit offset, so the server never guesses a timezone. */
  static fromIso(iso: string, now: Date, hours: ClinicHours): SlotStart {
    if (!ISO_WITH_OFFSET.test(iso)) {
      throw new InvalidInputError('slotStart must be an ISO-8601 instant with a Z or ±HH:MM offset');
    }
    const instant = new Date(iso);
    if (Number.isNaN(instant.getTime())) {
      throw new InvalidInputError('slotStart is not a valid date');
    }
    return SlotStart.schedulable(instant, now, hours);
  }

  static schedulable(instant: Date, now: Date, hours: ClinicHours): SlotStart {
    if (instant.getTime() % SLOT_MS !== 0) throw new SlotMisalignedError();
    if (instant.getTime() <= now.getTime()) throw new SlotInPastError();
    hours.assertSlotFits(instant);
    return new SlotStart(instant);
  }

  get end(): Date {
    return new Date(this.instant.getTime() + SLOT_MS);
  }
}
