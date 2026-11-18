import { useRef, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { ReportInput } from '../../api/types';
import { useClinicConfig } from '../../auth/clinic-config';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { AppointmentPill, ErrorMessage, PageHeader, QueryState, ReportDocument, ReportPill } from '../../components/ui';
import { useConfirm } from '../../hooks/confirm';
import {
  useClinicAppointment,
  useClinicReport,
  usePublishReport,
  useSaveReportDraft,
} from '../../hooks/clinic';
import { formatDateTime } from '../../lib/time';

function readForm(form: HTMLFormElement): ReportInput {
  const data = new FormData(form);
  return {
    title: String(data.get('title') ?? ''),
    body: String(data.get('body') ?? ''),
    professionalName: String(data.get('professionalName') ?? ''),
  };
}

export function ReportEditorPage() {
  const { appointmentId = '' } = useParams();
  const { timeZone } = useClinicConfig();
  const formRef = useRef<HTMLFormElement>(null);
  const appointment = useClinicAppointment(appointmentId);
  const report = useClinicReport(appointmentId, Boolean(appointment.data?.report));
  const save = useSaveReportDraft(appointmentId);
  const publish = usePublishReport(appointmentId);
  const confirm = useConfirm();

  const published = report.data?.status === 'PUBLISHED';
  const cancelled = appointment.data?.status === 'CANCELLED';
  const busy = save.isPending || publish.isPending;

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save.mutate(readForm(event.currentTarget));
  }

  /** Two calls: save the form, then publish. If publishing fails the saved draft remains. */
  function askToPublish() {
    const form = formRef.current;
    if (!form?.reportValidity()) return;
    confirm.ask({
      title: 'Publicar o laudo?',
      message: 'O paciente passará a ver este laudo. Depois de publicado, ele não poderá ser editado.',
      confirmLabel: 'Publicar laudo',
      tone: 'primary',
      onConfirm: () => save.mutate(readForm(form), { onSuccess: () => publish.mutate() }),
    });
  }

  const subtitle = appointment.data
    ? `${appointment.data.patient.fullName} · ${appointment.data.examType.name} · ${formatDateTime(appointment.data.slotStart, timeZone)}`
    : undefined;
  const status = report.data?.status ?? appointment.data?.report?.status ?? null;

  return (
    <>
      <Link className="back" to="/appointments">← Agendamentos</Link>
      <PageHeader title="Laudo" {...(subtitle ? { subtitle } : {})}>
        {appointment.data && (
          <div className="row">
            <AppointmentPill status={appointment.data.status} />
            <ReportPill status={status} />
          </div>
        )}
      </PageHeader>
      <QueryState isPending={appointment.isPending || report.isLoading} error={appointment.error ?? report.error}>
        {cancelled && <p className="notice warning">Agendamentos cancelados não podem receber laudos.</p>}

        {report.data && (published || cancelled) ? (
          <div className="doc-wrap">
            {published && report.data.publishedAt && (
              <p className="notice success">Publicado em {formatDateTime(report.data.publishedAt, timeZone)}. Laudos publicados não podem ser editados.</p>
            )}
            <ReportDocument
              title={report.data.title}
              body={report.data.body}
              professionalName={report.data.professionalName}
              meta={[
                { label: 'Paciente', value: appointment.data?.patient.fullName ?? '' },
                { label: 'Exame', value: appointment.data?.examType.name ?? '' },
                { label: 'Situação do laudo', value: published ? 'Publicado' : 'Rascunho' },
              ]}
            />
          </div>
        ) : (
          !cancelled && (
            <form
              key={report.data?.updatedAt ?? 'new'}
              onSubmit={handleSave}
              className="card form-card stack"
              ref={formRef}
            >
              <label>
                Título
                <input name="title" defaultValue={report.data?.title ?? ''} maxLength={200} required />
              </label>
              <label>
                Texto do laudo
                <textarea name="body" rows={10} defaultValue={report.data?.body ?? ''} required />
              </label>
              <label>
                Profissional responsável
                <input name="professionalName" defaultValue={report.data?.professionalName ?? ''} maxLength={200} required />
              </label>
              <ErrorMessage error={save.error ?? publish.error} />
              {save.isSuccess && !publish.isSuccess && !save.isPending && (
                <p className="notice success" role="status">Rascunho salvo. Ele fica visível só para a clínica.</p>
              )}
              <div className="form-actions">
                <button type="button" disabled={busy} onClick={askToPublish}>Salvar e publicar</button>
                <button type="submit" className="secondary" disabled={busy}>Salvar rascunho</button>
              </div>
            </form>
          )
        )}
      </QueryState>
      <ConfirmDialog request={confirm.request} onClose={confirm.close} />
    </>
  );
}
