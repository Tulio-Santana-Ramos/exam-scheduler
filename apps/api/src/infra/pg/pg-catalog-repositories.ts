import type { ExamTypeSummary, PatientSummary } from '../../ports/read-models.js';
import type { ExamTypeRepository, PatientRepository } from '../../ports/repositories.js';
import type { Queryable } from './queryable.js';

export class PgPatientRepository implements PatientRepository {
  constructor(private readonly db: Queryable) {}

  async exists(id: string): Promise<boolean> {
    const { rows } = await this.db.query('SELECT 1 FROM patients WHERE id = $1', [id]);
    return rows.length > 0;
  }

  async list(limit: number): Promise<PatientSummary[]> {
    const { rows } = await this.db.query<{ id: string; full_name: string }>(
      `SELECT p.id, u.full_name
         FROM patients p JOIN users u ON u.id = p.user_id
        ORDER BY u.full_name, p.id
        LIMIT $1`,
      [limit],
    );
    return rows.map((row) => ({ id: row.id, fullName: row.full_name }));
  }
}

export class PgExamTypeRepository implements ExamTypeRepository {
  constructor(private readonly db: Queryable) {}

  async exists(id: string): Promise<boolean> {
    const { rows } = await this.db.query('SELECT 1 FROM exam_types WHERE id = $1', [id]);
    return rows.length > 0;
  }

  async list(): Promise<ExamTypeSummary[]> {
    const { rows } = await this.db.query<ExamTypeSummary>(
      'SELECT id, code, name FROM exam_types ORDER BY name',
    );
    return rows;
  }
}
