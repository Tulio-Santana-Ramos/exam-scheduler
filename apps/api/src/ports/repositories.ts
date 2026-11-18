import type { Appointment } from '../domain/appointment.js';
import type { Report } from '../domain/report.js';
import type {
  AppointmentSearch,
  ClinicAppointmentView,
  ExamTypeSummary,
  PatientAppointmentView,
  PatientReportView,
  PatientSummary,
} from './read-models.js';

export interface AppointmentRepository {
  /** Throws SlotUnavailableError when an active appointment already holds the slot. */
  insert(appointment: Appointment): Promise<void>;
  findById(id: string): Promise<Appointment | null>;
  /** Row lock held until the surrounding transaction ends; serializes cross-table rules. */
  findByIdForUpdate(id: string): Promise<Appointment | null>;
  update(appointment: Appointment): Promise<void>;
  /** Start instants of active appointments in [from, to), served by the partial unique index. */
  findActiveSlotStarts(from: Date, to: Date): Promise<Date[]>;
  searchForClinic(search: AppointmentSearch): Promise<ClinicAppointmentView[]>;
  searchForPatient(
    patientId: string,
    search: Pick<AppointmentSearch, 'from' | 'to' | 'limit'>,
  ): Promise<PatientAppointmentView[]>;
}

export interface ReportRepository {
  insert(report: Report): Promise<void>;
  /** Persists only while the stored row is still a draft; throws ReportAlreadyPublishedError otherwise. */
  update(report: Report): Promise<void>;
  findByAppointmentId(appointmentId: string): Promise<Report | null>;
  /** Null for drafts and for reports of other patients, indistinguishably. */
  findPublishedForPatient(reportId: string, patientId: string): Promise<PatientReportView | null>;
}

export interface PatientRepository {
  exists(id: string): Promise<boolean>;
  list(limit: number): Promise<PatientSummary[]>;
}

export interface ExamTypeRepository {
  exists(id: string): Promise<boolean>;
  list(): Promise<ExamTypeSummary[]>;
}

export interface UserCredentials {
  userId: string;
  passwordHash: string;
  role: 'CLINIC' | 'PATIENT';
  /** Set only for patient accounts. */
  patientId: string | null;
}

export interface UserRepository {
  /** Email is matched case-insensitively. */
  findCredentialsByEmail(email: string): Promise<UserCredentials | null>;
}

export interface Repositories {
  users: UserRepository;
  appointments: AppointmentRepository;
  reports: ReportRepository;
  patients: PatientRepository;
  examTypes: ExamTypeRepository;
}
