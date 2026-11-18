import type { ReactNode } from 'react';
import type { AppointmentStatus, ReportStatus } from '../api/types';
import { messageFor } from '../lib/messages';

export function ErrorMessage({ error }: { error: Error | null }) {
  const message = messageFor(error);
  return message ? <p role="alert" className="error">{message}</p> : null;
}

export function QueryState({
  isPending,
  error,
  children,
}: {
  isPending: boolean;
  error: Error | null;
  children: ReactNode;
}) {
  if (isPending) return <p className="muted" role="status">Carregando…</p>;
  if (error) return <div className="notice danger"><ErrorMessage error={error} /></div>;
  return <>{children}</>;
}

export function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
        <path d="M12 4v16M4 12h16" />
      </svg>
    </span>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function EmptyState({ message, children }: { message: string; children?: ReactNode }) {
  return (
    <div className="card empty">
      <p>{message}</p>
      {children}
    </div>
  );
}

export interface ReportMeta {
  label: string;
  value: string;
}

/** Read-only view of a report, shared by the clinic (published) and the patient. */
export function ReportDocument({
  title,
  body,
  professionalName,
  meta,
}: {
  title: string;
  body: string;
  professionalName: string;
  meta: ReportMeta[];
}) {
  return (
    <article className="card doc">
      <h1>{title}</h1>
      <dl className="meta">
        {meta.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
      <p className="report-body">{body}</p>
      <p className="signature">
        Profissional responsável
        <strong>{professionalName}</strong>
      </p>
    </article>
  );
}

const APPOINTMENT_LABEL: Record<AppointmentStatus, string> = {
  SCHEDULED: 'Agendado',
  CANCELLED: 'Cancelado',
};

const REPORT_LABEL: Record<ReportStatus, string> = {
  DRAFT: 'Rascunho',
  PUBLISHED: 'Publicado',
};

export function AppointmentPill({ status }: { status: AppointmentStatus }) {
  return <span className={`pill ${status.toLowerCase()}`}>{APPOINTMENT_LABEL[status]}</span>;
}

export function ReportPill({ status }: { status: ReportStatus | null }) {
  if (!status) return <span className="muted">Sem laudo</span>;
  return <span className={`pill report-${status.toLowerCase()}`}>{REPORT_LABEL[status]}</span>;
}
