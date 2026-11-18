import type { FastifyInstance } from 'fastify';
import type { Container } from '../../container.js';
import { requirePrincipal } from '../principal.js';
import { PatientAppointmentsQuery, ReportIdParams } from '../schemas.js';

type PatientUseCases = Pick<Container, 'listMyAppointments' | 'getMyReport'>;

/** Routes under /me only: the patient is always the authenticated one, never a path parameter. */
export class PatientController {
  constructor(private readonly useCases: PatientUseCases) {}

  register(app: FastifyInstance): void {
    app.get('/me/appointments', async (request) => {
      const principal = await requirePrincipal(request);
      const query = PatientAppointmentsQuery.parse(request.query);
      return this.useCases.listMyAppointments.execute({ principal, ...query });
    });

    app.get('/me/reports/:reportId', async (request) => {
      const principal = await requirePrincipal(request);
      const { reportId } = ReportIdParams.parse(request.params);
      return this.useCases.getMyReport.execute({ principal, reportId });
    });
  }
}
