import { Link } from 'react-router-dom';
import { useClinicConfig } from '../../auth/clinic-config';
import { AppointmentPill, EmptyState, PageHeader, QueryState, ReportPill } from '../../components/ui';
import { useMyAppointments } from '../../hooks/patient';
import { formatDateTime } from '../../lib/time';

export function MyAppointmentsPage() {
  const { timeZone } = useClinicConfig();
  const appointments = useMyAppointments();

  return (
    <>
      <PageHeader title="Meus exames" subtitle="Seus agendamentos e os laudos já publicados pela clínica." />
      <QueryState isPending={appointments.isPending} error={appointments.error}>
        {appointments.data?.length === 0 ? (
          <EmptyState message="Você ainda não tem exames agendados." />
        ) : (
          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th>Exame</th><th>Data e horário</th><th>Situação</th><th>Laudo</th>
                  <th className="col-actions"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {appointments.data?.map((a) => (
                  <tr key={a.id} className={a.status === 'CANCELLED' ? 'is-cancelled' : undefined}>
                    <td data-label="Exame" className="cell-main cell-title">{a.examType.name}</td>
                    <td data-label="Data e horário">{formatDateTime(a.slotStart, timeZone)}</td>
                    <td data-label="Situação"><AppointmentPill status={a.status} /></td>
                    <td data-label="Laudo">
                      {a.publishedReportId ? (
                        <ReportPill status="PUBLISHED" />
                      ) : (
                        <span className="muted">{a.status === 'CANCELLED' ? '—' : 'Ainda não disponível'}</span>
                      )}
                    </td>
                    <td className="cell-actions">
                      <div className="actions">
                        {a.publishedReportId && (
                          <Link className="button secondary small" to={`/my/reports/${a.publishedReportId}`}>Ler laudo</Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </QueryState>
    </>
  );
}
