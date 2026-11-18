import type { Pool } from 'pg';
import type { Repositories } from '../../ports/repositories.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';
import { PgAppointmentRepository } from './pg-appointment-repository.js';
import { PgExamTypeRepository, PgPatientRepository } from './pg-catalog-repositories.js';
import { PgReportRepository } from './pg-report-repository.js';
import { PgUserRepository } from './pg-user-repository.js';
import type { Queryable } from './queryable.js';

function buildRepositories(db: Queryable): Repositories {
  return {
    users: new PgUserRepository(db),
    appointments: new PgAppointmentRepository(db),
    reports: new PgReportRepository(db),
    patients: new PgPatientRepository(db),
    examTypes: new PgExamTypeRepository(db),
  };
}

/**
 * READ COMMITTED + explicit row locks + constraints. Flows that span tables lock the
 * appointment row first, so lock order is uniform and deadlocks cannot form.
 */
export class PgUnitOfWork implements UnitOfWork {
  constructor(private readonly pool: Pool) {}

  async run<T>(work: (repositories: Repositories) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    let discard = false;
    try {
      await client.query('BEGIN');
      const result = await work(buildRepositories(client));
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        discard = true;
      }
      throw error;
    } finally {
      client.release(discard);
    }
  }

  read<T>(work: (repositories: Repositories) => Promise<T>): Promise<T> {
    return work(buildRepositories(this.pool));
  }
}
