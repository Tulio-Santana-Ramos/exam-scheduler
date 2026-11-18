import type { FastifyInstance } from 'fastify';
import type { Container } from '../../container.js';
import { requirePrincipal } from '../principal.js';
import { AppointmentIdParams, ReportBody } from '../schemas.js';

type ReportUseCases = Pick<Container, 'saveReportDraft' | 'publishReport' | 'getAppointmentReport'>;

export class ReportController {
  constructor(private readonly useCases: ReportUseCases) {}

  register(app: FastifyInstance): void {
    app.put('/appointments/:appointmentId/report', async (request) => {
      const principal = await requirePrincipal(request);
      const { appointmentId } = AppointmentIdParams.parse(request.params);
      const body = ReportBody.parse(request.body);
      return this.useCases.saveReportDraft.execute({ principal, appointmentId, ...body });
    });

    app.get('/appointments/:appointmentId/report', async (request) => {
      const principal = await requirePrincipal(request);
      const { appointmentId } = AppointmentIdParams.parse(request.params);
      return this.useCases.getAppointmentReport.execute({ principal, appointmentId });
    });

    app.post('/appointments/:appointmentId/report/publish', async (request) => {
      const principal = await requirePrincipal(request);
      const { appointmentId } = AppointmentIdParams.parse(request.params);
      return this.useCases.publishReport.execute({ principal, appointmentId });
    });
  }
}
