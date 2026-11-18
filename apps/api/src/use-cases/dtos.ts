import { Appointment, type AppointmentStatus } from '../domain/appointment.js';
import type { Report, ReportStatus } from '../domain/report.js';
import type {
  ClinicAppointmentView,
  ExamTypeSummary,
  PatientAppointmentView,
  PatientReportView,
} from '../ports/read-models.js';

/** All instants are ISO-8601 UTC strings; presentation timezone is the client's concern. */
export interface AppointmentDto {
  id: string;
  patientId: string;
  examTypeId: string;
  slotStart: string;
  status: AppointmentStatus;
  cancelledAt: string | null;
}

export interface ClinicReportDto {
  id: string;
  appointmentId: string;
  title: string;
  body: string;
  professionalName: string;
  status: ReportStatus;
  publishedAt: string | null;
  updatedAt: string;
}

export interface ClinicAppointmentDto {
  id: string;
  patient: { id: string; fullName: string };
  examType: ExamTypeSummary;
  slotStart: string;
  status: AppointmentStatus;
  cancelledAt: string | null;
  report: { id: string; status: ReportStatus } | null;
  /** Computed by the domain rule, so clients never duplicate it. */
  cancellable: boolean;
}

export interface PatientAppointmentDto {
  id: string;
  examType: ExamTypeSummary;
  slotStart: string;
  status: AppointmentStatus;
  hasPublishedReport: boolean;
  publishedReportId: string | null;
}

export interface PatientReportDto {
  id: string;
  appointmentId: string;
  title: string;
  body: string;
  professionalName: string;
  publishedAt: string;
  examType: ExamTypeSummary;
  slotStart: string;
}

export const toAppointmentDto = (appointment: Appointment): AppointmentDto => ({
  id: appointment.id,
  patientId: appointment.patientId,
  examTypeId: appointment.examTypeId,
  slotStart: appointment.slotStart.toISOString(),
  status: appointment.status,
  cancelledAt: appointment.cancelledAt?.toISOString() ?? null,
});

export const toClinicReportDto = (report: Report): ClinicReportDto => ({
  id: report.id,
  appointmentId: report.appointmentId,
  title: report.content.title,
  body: report.content.body,
  professionalName: report.content.professionalName,
  status: report.status,
  publishedAt: report.publishedAt?.toISOString() ?? null,
  updatedAt: report.updatedAt.toISOString(),
});

export const toClinicAppointmentDto = (view: ClinicAppointmentView, now: Date): ClinicAppointmentDto => ({
  id: view.id,
  patient: view.patient,
  examType: view.examType,
  slotStart: view.slotStart.toISOString(),
  status: view.status,
  cancelledAt: view.cancelledAt?.toISOString() ?? null,
  report: view.report,
  cancellable: Appointment.isCancellable(
    { status: view.status, slotStart: view.slotStart, reportStatus: view.report?.status ?? null },
    now,
  ),
});

export const toPatientAppointmentDto = (view: PatientAppointmentView): PatientAppointmentDto => ({
  id: view.id,
  examType: view.examType,
  slotStart: view.slotStart.toISOString(),
  status: view.status,
  hasPublishedReport: view.publishedReport !== null,
  publishedReportId: view.publishedReport?.id ?? null,
});

export const toPatientReportDto = (view: PatientReportView): PatientReportDto => ({
  id: view.id,
  appointmentId: view.appointmentId,
  title: view.title,
  body: view.body,
  professionalName: view.professionalName,
  publishedAt: view.publishedAt.toISOString(),
  examType: view.examType,
  slotStart: view.slotStart.toISOString(),
});
