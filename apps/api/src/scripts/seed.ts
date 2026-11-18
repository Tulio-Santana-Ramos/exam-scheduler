import { loadDatabaseEnv } from '../config/env.js';
import { hashPassword } from '../infra/password-hasher.js';
import { createPool } from '../infra/pg/pool.js';

const DEMO_PASSWORD = 'demo1234';

const USERS = [
  { id: '00000000-0000-4000-8000-000000000001', email: 'clinica@demo.test', role: 'CLINIC', name: 'Equipe da Clínica' },
  { id: '00000000-0000-4000-8000-000000000002', email: 'paciente1@demo.test', role: 'PATIENT', name: 'Ana Souza' },
  { id: '00000000-0000-4000-8000-000000000003', email: 'paciente2@demo.test', role: 'PATIENT', name: 'Bruno Lima' },
] as const;

const PATIENTS = [
  { id: '00000000-0000-4000-8000-0000000000a2', userId: USERS[1].id },
  { id: '00000000-0000-4000-8000-0000000000a3', userId: USERS[2].id },
] as const;

const EXAM_TYPES = [
  { id: '00000000-0000-4000-8000-0000000000b1', code: 'XRAY', name: 'Raio-X' },
  { id: '00000000-0000-4000-8000-0000000000b2', code: 'ULTRASOUND', name: 'Ultrassom' },
  { id: '00000000-0000-4000-8000-0000000000b3', code: 'MRI', name: 'Ressonância magnética' },
] as const;

const env = loadDatabaseEnv();
const pool = createPool(env.DATABASE_URL, 1);
const client = await pool.connect();
try {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  await client.query('BEGIN');
  for (const user of USERS) {
    await client.query(
      `INSERT INTO users (id, email, password_hash, role, full_name)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
      [user.id, user.email, passwordHash, user.role, user.name],
    );
  }
  for (const patient of PATIENTS) {
    await client.query(
      'INSERT INTO patients (id, user_id) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING',
      [patient.id, patient.userId],
    );
  }
  for (const examType of EXAM_TYPES) {
    await client.query(
      'INSERT INTO exam_types (id, code, name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
      [examType.id, examType.code, examType.name],
    );
  }
  await client.query('COMMIT');
  console.log(`Seeded demo data. Demo password for every account: ${DEMO_PASSWORD}`);
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
