import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../api/http';
import type {
  Appointment,
  BookAppointmentInput,
  ClinicAppointment,
  ClinicReport,
  ExamType,
  PatientSummary,
  ReportInput,
  SlotAvailability,
} from '../api/types';
import { useToken } from '../auth/session';

export interface AppointmentFilters {
  date?: string | undefined;
  patientId?: string | undefined;
}

export function useExamTypes() {
  const token = useToken();
  return useQuery({
    queryKey: ['exam-types'],
    queryFn: () => apiRequest<ExamType[]>('/exam-types', { token }),
    staleTime: 5 * 60_000,
  });
}

export function usePatients() {
  const token = useToken();
  return useQuery({
    queryKey: ['patients'],
    queryFn: () => apiRequest<PatientSummary[]>('/patients', { token, query: { limit: 200 } }),
    staleTime: 60_000,
  });
}

export function useClinicAppointments(filters: AppointmentFilters) {
  const token = useToken();
  return useQuery({
    queryKey: ['appointments', filters],
    queryFn: () =>
      apiRequest<ClinicAppointment[]>('/appointments', {
        token,
        query: { date: filters.date, patientId: filters.patientId },
      }),
  });
}

export function useClinicAppointment(appointmentId: string) {
  const token = useToken();
  return useQuery({
    queryKey: ['appointment', appointmentId],
    queryFn: () => apiRequest<ClinicAppointment>(`/appointments/${appointmentId}`, { token }),
  });
}

export function useAvailability(date: string | undefined) {
  const token = useToken();
  return useQuery({
    queryKey: ['availability', date],
    queryFn: () => apiRequest<SlotAvailability[]>('/availability', { token, query: { date } }),
    enabled: Boolean(date),
  });
}

export function useBookAppointment() {
  const token = useToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BookAppointmentInput) =>
      apiRequest<Appointment>('/appointments', { method: 'POST', token, body: input }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['appointments'] });
      void queryClient.invalidateQueries({ queryKey: ['availability'] });
    },
  });
}

export function useCancelAppointment() {
  const token = useToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (appointmentId: string) =>
      apiRequest<Appointment>(`/appointments/${appointmentId}/cancel`, { method: 'POST', token }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['appointments'] });
      void queryClient.invalidateQueries({ queryKey: ['appointment'] });
      void queryClient.invalidateQueries({ queryKey: ['availability'] });
    },
  });
}

/** Only fetched when the appointment already has a report, so "no report yet" is never a 404. */
export function useClinicReport(appointmentId: string, exists: boolean) {
  const token = useToken();
  return useQuery({
    queryKey: ['report', appointmentId],
    queryFn: () => apiRequest<ClinicReport>(`/appointments/${appointmentId}/report`, { token }),
    enabled: exists,
  });
}

/** Seeds the report cache from the mutation response, then refreshes what depends on it. */
function useReportSync(appointmentId: string) {
  const queryClient = useQueryClient();
  return (report: ClinicReport | undefined) => {
    if (report) queryClient.setQueryData(['report', appointmentId], report);
    void queryClient.invalidateQueries({ queryKey: ['appointment', appointmentId] });
    void queryClient.invalidateQueries({ queryKey: ['appointments'] });
  };
}

export function useSaveReportDraft(appointmentId: string) {
  const token = useToken();
  const sync = useReportSync(appointmentId);
  return useMutation({
    mutationFn: (input: ReportInput) =>
      apiRequest<ClinicReport>(`/appointments/${appointmentId}/report`, {
        method: 'PUT',
        token,
        body: input,
      }),
    onSettled: sync,
  });
}

export function usePublishReport(appointmentId: string) {
  const token = useToken();
  const sync = useReportSync(appointmentId);
  return useMutation({
    mutationFn: () =>
      apiRequest<ClinicReport>(`/appointments/${appointmentId}/report/publish`, {
        method: 'POST',
        token,
      }),
    onSettled: sync,
  });
}
