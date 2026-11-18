import type { UserCredentials, UserRepository } from '../../ports/repositories.js';
import type { Queryable } from './queryable.js';

interface CredentialsRow {
  id: string;
  password_hash: string;
  role: 'CLINIC' | 'PATIENT';
  patient_id: string | null;
}

export class PgUserRepository implements UserRepository {
  constructor(private readonly db: Queryable) {}

  async findCredentialsByEmail(email: string): Promise<UserCredentials | null> {
    const { rows } = await this.db.query<CredentialsRow>(
      `SELECT u.id, u.password_hash, u.role, p.id AS patient_id
         FROM users u LEFT JOIN patients p ON p.user_id = u.id
        WHERE lower(u.email) = lower($1)`,
      [email],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      userId: row.id,
      passwordHash: row.password_hash,
      role: row.role,
      patientId: row.patient_id,
    };
  }
}
