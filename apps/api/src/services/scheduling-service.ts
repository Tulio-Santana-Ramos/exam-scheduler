import { Appointment } from '../domain/appointment.js';
import {
  AppointmentNotFoundError,
  ExamTypeNotFoundError,
  PatientNotFoundError,
} from '../domain/errors.js';
import type { ClinicHours } from '../domain/clinic-hours.js';
import { SlotStart } from '../domain/slot-start.js';
import type { Repositories } from '../ports/repositories.js';
import type { Runtime } from '../ports/runtime.js';

export interface BookAppointmentCommand {
  patientId: string;
  examTypeId: string;
  slotStartIso: string;
}

export class SchedulingService {
  constructor(
    private readonly repositories: Repositories,
    private readonly runtime: Runtime,
    private readonly hours: ClinicHours,
  ) {}

  /** No check-then-insert: the partial unique index is the only arbiter of slot ownership. */
  async book(command: BookAppointmentCommand): Promise<Appointment> {
    const now = this.runtime.clock.now();
    const slot = SlotStart.fromIso(command.slotStartIso, now, this.hours);

    if (!(await this.repositories.patients.exists(command.patientId))) {
      throw new PatientNotFoundError();
    }
    if (!(await this.repositories.examTypes.exists(command.examTypeId))) {
      throw new ExamTypeNotFoundError();
    }

    const appointment = Appointment.schedule(
      {
        id: this.runtime.ids.next(),
        patientId: command.patientId,
        examTypeId: command.examTypeId,
        slot,
      },
      now,
    );
    await this.repositories.appointments.insert(appointment);
    return appointment;
  }

  async cancel(appointmentId: string): Promise<Appointment> {
    const appointment = await this.repositories.appointments.findByIdForUpdate(appointmentId);
    if (!appointment) throw new AppointmentNotFoundError();

    const report = await this.repositories.reports.findByAppointmentId(appointmentId);
    const cancelled = appointment.cancel(report, this.runtime.clock.now());
    await this.repositories.appointments.update(cancelled);
    return cancelled;
  }
}
