import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../api/http';
import type { PatientAppointment, PatientReport } from '../api/types';
import { useToken } from '../auth/session';

export function useMyAppointments() {
  const token = useToken();
  return useQuery({
    queryKey: ['me', 'appointments'],
    queryFn: () => apiRequest<PatientAppointment[]>('/me/appointments', { token }),
  });
}

export function useMyReport(reportId: string) {
  const token = useToken();
  return useQuery({
    queryKey: ['me', 'report', reportId],
    queryFn: () => apiRequest<PatientReport>(`/me/reports/${reportId}`, { token }),
  });
}
