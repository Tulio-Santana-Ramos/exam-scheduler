import { z } from 'zod';

/** Shape only. Business validation (UUIDs, lengths, slot rules) lives in the core. */
export const LoginBody = z.object({
  email: z.string().min(1).max(254),
  password: z.string().min(1).max(200),
});

export const BookAppointmentBody = z.object({
  patientId: z.string(),
  examTypeId: z.string(),
  slotStart: z.string(),
});

export const ReportBody = z.object({
  title: z.string(),
  body: z.string(),
  professionalName: z.string(),
});

export const AppointmentIdParams = z.object({ appointmentId: z.string() });
export const ReportIdParams = z.object({ reportId: z.string() });

export const ClinicAppointmentsQuery = z.object({
  date: z.string().optional(),
  patientId: z.string().optional(),
  limit: z.coerce.number().int().optional(),
});

export const PatientAppointmentsQuery = z.object({
  date: z.string().optional(),
  limit: z.coerce.number().int().optional(),
});

export const AvailabilityQuery = z.object({ date: z.string() });

export const LimitQuery = z.object({ limit: z.coerce.number().int().optional() });
