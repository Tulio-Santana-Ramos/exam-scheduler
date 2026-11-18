import type { Appointment } from '../../src/domain/appointment.js';
import { ReportAlreadyPublishedError, SlotUnavailableError } from '../../src/domain/errors.js';
import type { Report } from '../../src/domain/report.js';
import type {
  AppointmentRepository,
  ExamTypeRepository,
  PatientRepository,
  Repositories,
  ReportRepository,
  UserCredentials,
  UserRepository,
} from '../../src/ports/repositories.js';
import { ClinicCalendar } from '../../src/domain/clinic-calendar.js';
import { ClinicHours } from '../../src/domain/clinic-hours.js';
import type { LogFields, Logger } from '../../src/ports/logger.js';
import type { Runtime } from '../../src/ports/runtime.js';
import type { ServiceContext } from '../../src/services/index.js';
import type { PasswordHasher } from '../../src/ports/security.js';
import type { UnitOfWork } from '../../src/ports/unit-of-work.js';

export const NOW = new Date('2026-11-15T12:00:00.000Z');
export const PATIENT_ID = '00000000-0000-4000-8000-0000000000a2';
export const OTHER_PATIENT_ID = '00000000-0000-4000-8000-0000000000a3';
export const EXAM_TYPE_ID = '00000000-0000-4000-8000-0000000000b1';
export const UNKNOWN_ID = '00000000-0000-4000-8000-00000000dead';
/** 10:00 in America/Sao_Paulo, inside opening hours. */
export const FUTURE_SLOT = '2026-11-16T13:00:00.000Z';
export const CLINIC_HOURS = new ClinicHours(new ClinicCalendar('America/Sao_Paulo'), 7, 19);

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  fields: LogFields;
}

export class RecordingLogger implements Logger {
  readonly entries: LogEntry[] = [];
  debug(fields: LogFields, message: string): void {
    this.entries.push({ level: 'debug', message, fields });
  }
  info(fields: LogFields, message: string): void {
    this.entries.push({ level: 'info', message, fields });
  }
  warn(fields: LogFields, message: string): void {
    this.entries.push({ level: 'warn', message, fields });
  }
  error(fields: LogFields, message: string): void {
    this.entries.push({ level: 'error', message, fields });
  }
}

const SEARCH_NOT_FAKED = 'Search queries are covered by the integration suite';

class InMemoryAppointments implements AppointmentRepository {
  readonly rows = new Map<string, Appointment>();

  async insert(appointment: Appointment): Promise<void> {
    const taken = [...this.rows.values()].some(
      (row) => row.status === 'SCHEDULED' && row.slotStart.getTime() === appointment.slotStart.getTime(),
    );
    if (taken) throw new SlotUnavailableError();
    this.rows.set(appointment.id, appointment);
  }

  async findById(id: string): Promise<Appointment | null> {
    return this.rows.get(id) ?? null;
  }

  findByIdForUpdate(id: string): Promise<Appointment | null> {
    return this.findById(id);
  }

  async update(appointment: Appointment): Promise<void> {
    this.rows.set(appointment.id, appointment);
  }

  async findActiveSlotStarts(from: Date, to: Date): Promise<Date[]> {
    return [...this.rows.values()]
      .filter((row) => row.status === 'SCHEDULED' && row.slotStart >= from && row.slotStart < to)
      .map((row) => row.slotStart);
  }

  async searchForClinic(): Promise<never> {
    throw new Error(SEARCH_NOT_FAKED);
  }

  async searchForPatient(): Promise<never> {
    throw new Error(SEARCH_NOT_FAKED);
  }
}

class InMemoryReports implements ReportRepository {
  readonly rows = new Map<string, Report>();

  async insert(report: Report): Promise<void> {
    this.rows.set(report.id, report);
  }

  async update(report: Report): Promise<void> {
    const stored = this.rows.get(report.id);
    if (stored?.isPublished) throw new ReportAlreadyPublishedError();
    this.rows.set(report.id, report);
  }

  async findByAppointmentId(appointmentId: string): Promise<Report | null> {
    return [...this.rows.values()].find((r) => r.appointmentId === appointmentId) ?? null;
  }

  async findPublishedForPatient(): Promise<never> {
    throw new Error(SEARCH_NOT_FAKED);
  }
}

class InMemoryUsers implements UserRepository {
  private readonly byEmail = new Map<string, UserCredentials>();

  add(email: string, credentials: UserCredentials): void {
    this.byEmail.set(email.toLowerCase(), credentials);
  }

  async findCredentialsByEmail(email: string): Promise<UserCredentials | null> {
    return this.byEmail.get(email.toLowerCase()) ?? null;
  }
}

/** Reversible on purpose: lets tests assert on hashes without paying for scrypt. */
export class FakePasswordHasher implements PasswordHasher {
  verifyCalls = 0;

  async hash(password: string): Promise<string> {
    return `hashed:${password}`;
  }

  async verify(password: string, stored: string): Promise<boolean> {
    this.verifyCalls += 1;
    return stored === `hashed:${password}`;
  }
}

class InMemoryPatients implements PatientRepository {
  async exists(id: string): Promise<boolean> {
    return id === PATIENT_ID || id === OTHER_PATIENT_ID;
  }

  async list(): Promise<never> {
    throw new Error(SEARCH_NOT_FAKED);
  }
}

class InMemoryExamTypes implements ExamTypeRepository {
  async exists(id: string): Promise<boolean> {
    return id === EXAM_TYPE_ID;
  }

  async list(): Promise<never> {
    throw new Error(SEARCH_NOT_FAKED);
  }
}

export interface Fakes {
  repositories: Repositories;
  appointments: InMemoryAppointments;
  reports: InMemoryReports;
  users: InMemoryUsers;
  uow: UnitOfWork;
  runtime: Runtime;
  context: ServiceContext;
  advanceClock(milliseconds: number): void;
}

/** No rollback emulation: transactional behaviour is proven against Postgres, not here. */
export function createFakes(): Fakes {
  const appointments = new InMemoryAppointments();
  const reports = new InMemoryReports();
  const users = new InMemoryUsers();
  const repositories: Repositories = {
    users,
    appointments,
    reports,
    patients: new InMemoryPatients(),
    examTypes: new InMemoryExamTypes(),
  };
  let current = NOW.getTime();
  let sequence = 0;
  const runtime: Runtime = {
    clock: { now: () => new Date(current) },
    ids: { next: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}` },
  };
  const uow: UnitOfWork = {
    run: (work) => work(repositories),
    read: (work) => work(repositories),
  };
  return {
    repositories,
    appointments,
    reports,
    users,
    uow,
    runtime,
    context: { ...runtime, hours: CLINIC_HOURS },
    advanceClock: (milliseconds) => {
      current += milliseconds;
    },
  };
}
