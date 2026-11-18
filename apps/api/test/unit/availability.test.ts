import { beforeEach, describe, expect, it } from 'vitest';
import {
  BookAppointmentUseCase,
  CancelAppointmentUseCase,
  ListAvailabilityUseCase,
} from '../../src/use-cases/clinic-appointments.js';
import { EXAM_TYPE_ID, PATIENT_ID, createFakes, type Fakes } from '../support/fakes.js';

const clinic = { role: 'CLINIC', userId: 'staff-1' } as const;

describe('ListAvailabilityUseCase', () => {
  let fakes: Fakes;
  let availability: ListAvailabilityUseCase;
  let book: BookAppointmentUseCase;
  let cancel: CancelAppointmentUseCase;

  beforeEach(() => {
    fakes = createFakes();
    const deps = { uow: fakes.uow, context: fakes.context };
    availability = new ListAvailabilityUseCase(deps);
    book = new BookAppointmentUseCase(deps);
    cancel = new CancelAppointmentUseCase(deps);
  });

  const stateOf = async (date: string, slotStart: string) =>
    (await availability.execute({ principal: clinic, date })).find((s) => s.slotStart === slotStart)?.state;

  it('marks booked slots as taken and a freed slot as available again', async () => {
    const booked = await book.execute({
      principal: clinic,
      patientId: PATIENT_ID,
      examTypeId: EXAM_TYPE_ID,
      slotStart: '2026-11-16T13:00:00Z',
    });
    expect(await stateOf('2026-11-16', '2026-11-16T13:00:00.000Z')).toBe('TAKEN');
    expect(await stateOf('2026-11-16', '2026-11-16T13:30:00.000Z')).toBe('AVAILABLE');

    await cancel.execute({ principal: clinic, appointmentId: booked.id });
    expect(await stateOf('2026-11-16', '2026-11-16T13:00:00.000Z')).toBe('AVAILABLE');
  });

  it('marks slots that already started as past (clock is 2026-11-15 09:00 local)', async () => {
    expect(await stateOf('2026-11-15', '2026-11-15T10:00:00.000Z')).toBe('PAST');
    expect(await stateOf('2026-11-15', '2026-11-15T12:00:00.000Z')).toBe('PAST');
    expect(await stateOf('2026-11-15', '2026-11-15T12:30:00.000Z')).toBe('AVAILABLE');
  });

  it('is clinic-only and validates the date', async () => {
    await expect(
      availability.execute({ principal: { role: 'PATIENT', userId: 'u', patientId: PATIENT_ID }, date: '2026-11-16' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(availability.execute({ principal: clinic, date: '16/11/2026' })).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    });
  });
});
