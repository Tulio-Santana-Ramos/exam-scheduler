import type { AppointmentStatus } from '../domain/appointment.js';
import type { ReportStatus } from '../domain/report.js';

export interface PatientSummary {
  id: string;
  fullName: string;
}

export interface ExamTypeSummary {
  id: string;
  code: string;
  name: string;
}

/** Clinic sees every report state. */
export interface ClinicAppointmentView {
  id: string;
  patient: PatientSummary;
  examType: ExamTypeSummary;
  slotStart: Date;
  status: AppointmentStatus;
  cancelledAt: Date | null;
  report: { id: string; status: ReportStatus } | null;
}

/** Patient shape has no field able to carry a draft: only published reports are joined. */
export interface PatientAppointmentView {
  id: string;
  examType: ExamTypeSummary;
  slotStart: Date;
  status: AppointmentStatus;
  publishedReport: { id: string; publishedAt: Date } | null;
}

export interface PatientReportView {
  id: string;
  appointmentId: string;
  title: string;
  body: string;
  professionalName: string;
  publishedAt: Date;
  examType: ExamTypeSummary;
  slotStart: Date;
}

export interface AppointmentSearch {
  from?: Date;
  to?: Date;
  patientId?: string;
  appointmentId?: string;
  limit: number;
}
