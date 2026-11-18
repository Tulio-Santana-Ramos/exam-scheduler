import { Link, useParams } from 'react-router-dom';
import { useClinicConfig } from '../../auth/clinic-config';
import { QueryState, ReportDocument } from '../../components/ui';
import { useMyReport } from '../../hooks/patient';
import { formatDateTime } from '../../lib/time';

export function MyReportPage() {
  const { reportId = '' } = useParams();
  const { timeZone } = useClinicConfig();
  const report = useMyReport(reportId);

  return (
    <>
      <Link className="back" to="/my/appointments">← Meus exames</Link>
      <QueryState isPending={report.isPending} error={report.error}>
        {report.data && (
          <ReportDocument
            title={report.data.title}
            body={report.data.body}
            professionalName={report.data.professionalName}
            meta={[
              { label: 'Exame', value: report.data.examType.name },
              { label: 'Data do exame', value: formatDateTime(report.data.slotStart, timeZone) },
              { label: 'Laudo publicado em', value: formatDateTime(report.data.publishedAt, timeZone) },
            ]}
          />
        )}
      </QueryState>
    </>
  );
}
