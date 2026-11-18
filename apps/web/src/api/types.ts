export type Role = 'CLINIC' | 'PATIENT';
export type AppointmentStatus = 'SCHEDULED' | 'CANCELLED';
export type ReportStatus = 'DRAFT' | 'PUBLISHED';
export type SlotState = 'AVAILABLE' | 'TAKEN' | 'PAST';

export type SessionUser =
  | { role: 'CLINIC'; userId: string }
  | { role: 'PATIENT'; userId: string; patientId: string };

export interface LoginResponse {
  token: string;
  user: SessionUser;
}

export interface ClinicConfig {
  timeZone: string;
  openHour: number;
  closeHour: number;
  slotMinutes: number;
}

export interface ExamType {
  id: string;
  code: string;
  name: string;
}

export interface PatientSummary {
  id: string;
  fullName: string;
}

export interface SlotAvailability {
  slotStart: string;
  state: SlotState;
}

export interface Appointment {
  id: string;
  patientId: string;
  examTypeId: string;
  slotStart: string;
  status: AppointmentStatus;
  cancelledAt: string | null;
}

export interface ClinicAppointment {
  id: string;
  patient: PatientSummary;
  examType: ExamType;
  slotStart: string;
  status: AppointmentStatus;
  cancelledAt: string | null;
  report: { id: string; status: ReportStatus } | null;
  cancellable: boolean;
}

export interface ReportInput {
  title: string;
  body: string;
  professionalName: string;
}

export interface ClinicReport extends ReportInput {
  id: string;
  appointmentId: string;
  status: ReportStatus;
  publishedAt: string | null;
  updatedAt: string;
}

export interface PatientAppointment {
  id: string;
  examType: ExamType;
  slotStart: string;
  status: AppointmentStatus;
  hasPublishedReport: boolean;
  publishedReportId: string | null;
}

export interface PatientReport extends ReportInput {
  id: string;
  appointmentId: string;
  publishedAt: string;
  examType: ExamType;
  slotStart: string;
}

export interface BookAppointmentInput {
  patientId: string;
  examTypeId: string;
  slotStart: string;
}
