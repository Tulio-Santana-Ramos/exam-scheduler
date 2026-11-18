import type { Repositories } from '../ports/repositories.js';
import type { ServiceContext } from './index.js';

export type SlotState = 'AVAILABLE' | 'TAKEN' | 'PAST';

export interface DaySlot {
  slotStart: Date;
  state: SlotState;
}

/** Advisory view for the booking form. Only the unique index decides who actually gets a slot. */
export class AvailabilityService {
  constructor(
    private readonly repositories: Repositories,
    private readonly context: ServiceContext,
  ) {}

  async forDay(date: string): Promise<DaySlot[]> {
    const starts = this.context.hours.slotStartsOn(date);
    const first = starts[0];
    const last = starts[starts.length - 1];
    if (!first || !last) return [];

    const taken = await this.repositories.appointments.findActiveSlotStarts(
      first,
      new Date(last.getTime() + 1),
    );
    const takenAt = new Set(taken.map((instant) => instant.getTime()));
    const now = this.context.clock.now().getTime();

    return starts.map((slotStart) => ({
      slotStart,
      state:
        slotStart.getTime() <= now ? 'PAST' : takenAt.has(slotStart.getTime()) ? 'TAKEN' : 'AVAILABLE',
    }));
  }
}
