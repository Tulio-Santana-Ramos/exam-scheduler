import { Link, useSearchParams } from 'react-router-dom';
import type { ClinicAppointment } from '../../api/types';
import { useClinicConfig } from '../../auth/clinic-config';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { AppointmentPill, EmptyState, ErrorMessage, PageHeader, QueryState, ReportPill } from '../../components/ui';
import { useConfirm } from '../../hooks/confirm';
import { useCancelAppointment, useClinicAppointments, usePatients } from '../../hooks/clinic';
import { formatDateTime, formatDay, todayIn } from '../../lib/time';

function reportActionLabel(appointment: ClinicAppointment): string {
  if (appointment.report?.status === 'PUBLISHED') return 'Ver laudo';
  return appointment.report ? 'Editar rascunho' : 'Escrever laudo';
}

export function AppointmentsPage() {
  const { timeZone } = useClinicConfig();
  const [params, setParams] = useSearchParams();
  const today = todayIn(timeZone);
  const dateParam = params.get('date');
  const date = dateParam === null ? today : dateParam || undefined;
  const patientId = params.get('patientId') ?? undefined;
  const justBooked = params.get('booked') === '1';

  const appointments = useClinicAppointments({ date, patientId });
  const patients = usePatients();
  const cancel = useCancelAppointment();
  const confirm = useConfirm();

  function setParam(name: 'date' | 'patientId' | 'booked', value: string | null) {
    const next = new URLSearchParams(params);
    if (value === null || (value === '' && name !== 'date')) next.delete(name);
    else next.set(name, value);
    setParams(next, { replace: true });
  }

  function askToCancel(appointment: ClinicAppointment) {
    confirm.ask({
      title: 'Cancelar este agendamento?',
      message: `${appointment.patient.fullName} · ${appointment.examType.name} · ${formatDateTime(appointment.slotStart, timeZone)}. O horário ficará livre para um novo agendamento.`,
      confirmLabel: 'Cancelar agendamento',
      tone: 'danger',
      onConfirm: () => cancel.mutate(appointment.id),
    });
  }

  const subtitle = date ? `${formatDay(date)}${date === today ? ' (hoje)' : ''}` : 'Todas as datas';

  return (
    <>
      <PageHeader title="Agendamentos" subtitle={subtitle}>
        <Link className="button" to="/appointments/new">Novo agendamento</Link>
      </PageHeader>

      {justBooked && (
        <div className="notice success" role="status">
          <span>Agendamento criado com sucesso.</span>
          <button type="button" className="ghost small" onClick={() => setParam('booked', null)}>Fechar</button>
        </div>
      )}

      <div className="filters">
        <label>
          Data
          <input type="date" value={date ?? ''} onChange={(e) => setParam('date', e.target.value)} />
        </label>
        <label>
          Paciente
          <select value={patientId ?? ''} onChange={(e) => setParam('patientId', e.target.value)}>
            <option value="">Todos os pacientes</option>
            {patients.data?.map((p) => (
              <option key={p.id} value={p.id}>{p.fullName}</option>
            ))}
          </select>
        </label>
        <div className="row">
          <button type="button" className="toggle" aria-pressed={date === today} onClick={() => setParam('date', today)}>Hoje</button>
          <button type="button" className="toggle" aria-pressed={date === undefined} onClick={() => setParam('date', '')}>Todas as datas</button>
        </div>
      </div>

      <ErrorMessage error={cancel.error} />
      <QueryState isPending={appointments.isPending} error={appointments.error}>
        {appointments.data?.length === 0 ? (
          <EmptyState message="Nenhum agendamento encontrado para este filtro.">
            <Link className="button" to="/appointments/new">Novo agendamento</Link>
          </EmptyState>
        ) : (
          <>
            <p className="count">{appointments.data?.length} agendamento(s)</p>
            <div className="table-card">
              <table>
                <thead>
                  <tr>
                    <th>Horário</th><th>Paciente</th><th>Exame</th><th>Situação</th><th>Laudo</th>
                    <th className="col-actions"><span className="sr-only">Ações</span></th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.data?.map((a) => (
                    <tr key={a.id} className={a.status === 'CANCELLED' ? 'is-cancelled' : undefined}>
                      <td data-label="Horário" className="cell-main cell-title">{formatDateTime(a.slotStart, timeZone)}</td>
                      <td data-label="Paciente">{a.patient.fullName}</td>
                      <td data-label="Exame">{a.examType.name}</td>
                      <td data-label="Situação"><AppointmentPill status={a.status} /></td>
                      <td data-label="Laudo"><ReportPill status={a.report?.status ?? null} /></td>
                      <td className="cell-actions">
                        <div className="actions">
                          {a.status === 'SCHEDULED' && (
                            <Link className="button secondary small" to={`/appointments/${a.id}/report`}>
                              {reportActionLabel(a)}
                            </Link>
                          )}
                          {a.cancellable && (
                            <button type="button" className="ghost danger small" disabled={cancel.isPending} onClick={() => askToCancel(a)}>
                              Cancelar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </QueryState>
      <ConfirmDialog request={confirm.request} onClose={confirm.close} />
    </>
  );
}
