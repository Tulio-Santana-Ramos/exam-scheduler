import type { FastifyInstance } from 'fastify';
import type { Container } from '../../container.js';
import { requirePrincipal } from '../principal.js';
import {
  AppointmentIdParams,
  AvailabilityQuery,
  BookAppointmentBody,
  ClinicAppointmentsQuery,
} from '../schemas.js';

type AppointmentUseCases = Pick<
  Container,
  'bookAppointment' | 'cancelAppointment' | 'listClinicAppointments' | 'listAvailability' | 'getAppointment'
>;

export class AppointmentController {
  constructor(private readonly useCases: AppointmentUseCases) {}

  register(app: FastifyInstance): void {
    app.post('/appointments', async (request, reply) => {
      const principal = await requirePrincipal(request);
      const body = BookAppointmentBody.parse(request.body);
      const appointment = await this.useCases.bookAppointment.execute({ principal, ...body });
      return reply.status(201).send(appointment);
    });

    app.get('/appointments', async (request) => {
      const principal = await requirePrincipal(request);
      const query = ClinicAppointmentsQuery.parse(request.query);
      return this.useCases.listClinicAppointments.execute({ principal, ...query });
    });

    app.get('/availability', async (request) => {
      const principal = await requirePrincipal(request);
      const { date } = AvailabilityQuery.parse(request.query);
      return this.useCases.listAvailability.execute({ principal, date });
    });

    app.get('/appointments/:appointmentId', async (request) => {
      const principal = await requirePrincipal(request);
      const { appointmentId } = AppointmentIdParams.parse(request.params);
      return this.useCases.getAppointment.execute({ principal, appointmentId });
    });

    app.post('/appointments/:appointmentId/cancel', async (request) => {
      const principal = await requirePrincipal(request);
      const { appointmentId } = AppointmentIdParams.parse(request.params);
      return this.useCases.cancelAppointment.execute({ principal, appointmentId });
    });
  }
}
