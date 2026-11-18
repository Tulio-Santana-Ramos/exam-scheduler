import type { Pool } from 'pg';
import { ClinicCalendar } from './domain/clinic-calendar.js';
import { ClinicHours } from './domain/clinic-hours.js';
import { SLOT_MINUTES } from './domain/slot-start.js';
import { scryptPasswordHasher } from './infra/password-hasher.js';
import { PgUnitOfWork } from './infra/pg/pg-unit-of-work.js';
import { AuthenticationService } from './services/authentication-service.js';
import type { LogFields, Logger } from './ports/logger.js';
import type { Runtime } from './ports/runtime.js';
import { AuthenticateUseCase } from './use-cases/authenticate.js';
import { ListExamTypesUseCase, ListPatientsUseCase } from './use-cases/catalog.js';
import {
  BookAppointmentUseCase,
  CancelAppointmentUseCase,
  GetClinicAppointmentUseCase,
  ListAvailabilityUseCase,
  ListClinicAppointmentsUseCase,
} from './use-cases/clinic-appointments.js';
import {
  GetAppointmentReportUseCase,
  PublishReportUseCase,
  SaveReportDraftUseCase,
} from './use-cases/clinic-reports.js';
import { actorFields, withLogging } from './use-cases/logged-use-case.js';
import { GetMyReportUseCase, ListMyAppointmentsUseCase } from './use-cases/patient-access.js';

export interface ContainerDeps {
  pool: Pool;
  runtime: Runtime;
  logger: Logger;
  timeZone: string;
  openHour: number;
  closeHour: number;
}

/** Composition root: the only place that knows which adapters back the ports. */
export function buildContainer({ pool, runtime, logger, timeZone, openHour, closeHour }: ContainerDeps) {
  const uow = new PgUnitOfWork(pool);
  const calendar = new ClinicCalendar(timeZone);
  const hours = new ClinicHours(calendar, openHour, closeHour);
  const transactional = { uow, context: { ...runtime, hours } };
  const logged = <Input, Output>(
    useCase: { execute(input: Input): Promise<Output> },
    event: string,
    describe: (input: Input, output: Output | null) => LogFields,
    successLevel: 'debug' | 'info' = 'info',
  ) => withLogging(useCase, logger, { event, describe, successLevel });

  return {
    clinic: { timeZone, openHour, closeHour, slotMinutes: SLOT_MINUTES },

    authenticate: logged(
      new AuthenticateUseCase({ uow, service: new AuthenticationService(scryptPasswordHasher) }),
      'auth.login',
      (_input, principal) => (principal ? actorFields(principal) : {}),
    ),
    bookAppointment: logged(
      new BookAppointmentUseCase(transactional),
      'appointment.book',
      (input, appointment) => ({
        ...actorFields(input.principal),
        patientId: input.patientId,
        examTypeId: input.examTypeId,
        slotStart: input.slotStart,
        appointmentId: appointment?.id,
      }),
    ),
    cancelAppointment: logged(
      new CancelAppointmentUseCase(transactional),
      'appointment.cancel',
      (input) => ({ ...actorFields(input.principal), appointmentId: input.appointmentId }),
    ),
    getAppointment: logged(
      new GetClinicAppointmentUseCase({ uow, clock: runtime.clock }),
      'appointment.view',
      (input) => ({ ...actorFields(input.principal), appointmentId: input.appointmentId }),
      'debug',
    ),
    listAvailability: logged(
      new ListAvailabilityUseCase(transactional),
      'appointment.availability',
      (input, slots) => ({ ...actorFields(input.principal), date: input.date, count: slots?.length }),
      'debug',
    ),
    listClinicAppointments: logged(
      new ListClinicAppointmentsUseCase({ uow, calendar, clock: runtime.clock }),
      'appointment.list',
      (input, rows) => ({
        ...actorFields(input.principal),
        date: input.date,
        patientId: input.patientId,
        count: rows?.length,
      }),
      'debug',
    ),
    saveReportDraft: logged(
      new SaveReportDraftUseCase(transactional),
      'report.save_draft',
      (input, report) => ({
        ...actorFields(input.principal),
        appointmentId: input.appointmentId,
        reportId: report?.id,
      }),
    ),
    publishReport: logged(
      new PublishReportUseCase(transactional),
      'report.publish',
      (input, report) => ({
        ...actorFields(input.principal),
        appointmentId: input.appointmentId,
        reportId: report?.id,
      }),
    ),
    getAppointmentReport: logged(
      new GetAppointmentReportUseCase(transactional),
      'report.clinic_view',
      (input) => ({ ...actorFields(input.principal), appointmentId: input.appointmentId }),
      'debug',
    ),
    listMyAppointments: logged(
      new ListMyAppointmentsUseCase({ uow, calendar }),
      'patient.appointment.list',
      (input, rows) => ({ ...actorFields(input.principal), count: rows?.length }),
      'debug',
    ),
    getMyReport: logged(
      new GetMyReportUseCase({ uow }),
      'patient.report.view',
      (input) => ({ ...actorFields(input.principal), reportId: input.reportId }),
    ),
    listPatients: logged(
      new ListPatientsUseCase({ uow }),
      'patient.list',
      (input) => actorFields(input.principal),
      'debug',
    ),
    listExamTypes: logged(
      new ListExamTypesUseCase({ uow }),
      'exam_type.list',
      (input) => actorFields(input.principal),
      'debug',
    ),
  };
}

export type Container = ReturnType<typeof buildContainer>;
