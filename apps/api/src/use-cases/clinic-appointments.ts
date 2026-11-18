import { AppointmentNotFoundError } from '../domain/errors.js';
import { requireUuid } from '../domain/identifiers.js';
import { requireClinic, type Principal } from '../domain/principal.js';
import type { ClinicCalendar } from '../domain/clinic-calendar.js';
import type { AppointmentSearch } from '../ports/read-models.js';
import type { Clock } from '../ports/runtime.js';
import type { UnitOfWork } from '../ports/unit-of-work.js';
import { createServices, type ServiceContext } from '../services/index.js';
import {
  toAppointmentDto,
  toClinicAppointmentDto,
  type AppointmentDto,
  type ClinicAppointmentDto,
} from './dtos.js';
import { clampLimit } from './pagination.js';
import type { UseCase } from './use-case.js';

interface Deps {
  uow: UnitOfWork;
  context: ServiceContext;
}

export interface BookAppointmentInput {
  principal: Principal;
  patientId: string;
  examTypeId: string;
  slotStart: string;
}

export class BookAppointmentUseCase implements UseCase<BookAppointmentInput, AppointmentDto> {
  constructor(private readonly deps: Deps) {}

  async execute(input: BookAppointmentInput): Promise<AppointmentDto> {
    requireClinic(input.principal);
    const appointment = await this.deps.uow.run((repositories) =>
      createServices(repositories, this.deps.context).scheduling.book({
        patientId: requireUuid(input.patientId, 'patientId'),
        examTypeId: requireUuid(input.examTypeId, 'examTypeId'),
        slotStartIso: input.slotStart,
      }),
    );
    return toAppointmentDto(appointment);
  }
}

export interface CancelAppointmentInput {
  principal: Principal;
  appointmentId: string;
}

export class CancelAppointmentUseCase implements UseCase<CancelAppointmentInput, AppointmentDto> {
  constructor(private readonly deps: Deps) {}

  async execute(input: CancelAppointmentInput): Promise<AppointmentDto> {
    requireClinic(input.principal);
    const appointment = await this.deps.uow.run((repositories) =>
      createServices(repositories, this.deps.context).scheduling.cancel(
        requireUuid(input.appointmentId, 'appointmentId'),
      ),
    );
    return toAppointmentDto(appointment);
  }
}

export interface ListClinicAppointmentsInput {
  principal: Principal;
  /** Clinic-local calendar day, YYYY-MM-DD. */
  date?: string | undefined;
  patientId?: string | undefined;
  limit?: number | undefined;
}

export class ListClinicAppointmentsUseCase
  implements UseCase<ListClinicAppointmentsInput, ClinicAppointmentDto[]>
{
  constructor(
    private readonly deps: { uow: UnitOfWork; calendar: ClinicCalendar; clock: Clock },
  ) {}

  async execute(input: ListClinicAppointmentsInput): Promise<ClinicAppointmentDto[]> {
    requireClinic(input.principal);
    const search: AppointmentSearch = {
      limit: clampLimit(input.limit),
      ...(input.date ? this.deps.calendar.dayRange(input.date) : {}),
      ...(input.patientId ? { patientId: requireUuid(input.patientId, 'patientId') } : {}),
    };
    const views = await this.deps.uow.read((repositories) =>
      repositories.appointments.searchForClinic(search),
    );
    const now = this.deps.clock.now();
    return views.map((view) => toClinicAppointmentDto(view, now));
  }
}

export interface ListAvailabilityInput {
  principal: Principal;
  /** Clinic-local calendar day, YYYY-MM-DD. */
  date: string;
}

export interface SlotAvailabilityDto {
  slotStart: string;
  state: 'AVAILABLE' | 'TAKEN' | 'PAST';
}

export class ListAvailabilityUseCase
  implements UseCase<ListAvailabilityInput, SlotAvailabilityDto[]>
{
  constructor(private readonly deps: Deps) {}

  async execute(input: ListAvailabilityInput): Promise<SlotAvailabilityDto[]> {
    requireClinic(input.principal);
    const slots = await this.deps.uow.read((repositories) =>
      createServices(repositories, this.deps.context).availability.forDay(input.date),
    );
    return slots.map((slot) => ({ slotStart: slot.slotStart.toISOString(), state: slot.state }));
  }
}

export interface GetClinicAppointmentInput {
  principal: Principal;
  appointmentId: string;
}

export class GetClinicAppointmentUseCase
  implements UseCase<GetClinicAppointmentInput, ClinicAppointmentDto>
{
  constructor(private readonly deps: { uow: UnitOfWork; clock: Clock }) {}

  async execute(input: GetClinicAppointmentInput): Promise<ClinicAppointmentDto> {
    requireClinic(input.principal);
    const appointmentId = requireUuid(input.appointmentId, 'appointmentId');
    const [view] = await this.deps.uow.read((repositories) =>
      repositories.appointments.searchForClinic({ appointmentId, limit: 1 }),
    );
    if (!view) throw new AppointmentNotFoundError();
    return toClinicAppointmentDto(view, this.deps.clock.now());
  }
}
