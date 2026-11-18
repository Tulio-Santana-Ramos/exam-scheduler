import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import type { Container } from '../../container.js';
import { requirePrincipal } from '../principal.js';
import { LimitQuery } from '../schemas.js';

type CatalogUseCases = Pick<Container, 'listPatients' | 'listExamTypes' | 'clinic'>;

export class CatalogController {
  constructor(
    private readonly useCases: CatalogUseCases,
    private readonly pool: Pool,
  ) {}

  register(app: FastifyInstance): void {
    app.get('/exam-types', async (request) => {
      const principal = await requirePrincipal(request);
      return this.useCases.listExamTypes.execute({ principal });
    });

    app.get('/patients', async (request) => {
      const principal = await requirePrincipal(request);
      const { limit } = LimitQuery.parse(request.query);
      return this.useCases.listPatients.execute({ principal, limit });
    });

    app.get('/config', async () => this.useCases.clinic);

    app.get('/health', async (_request, reply) => {
      try {
        await this.pool.query('SELECT 1');
        return { status: 'ok' };
      } catch {
        return reply.status(503).send({ status: 'database_unavailable' });
      }
    });
  }
}
