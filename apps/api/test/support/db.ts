import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { buildContainer, type Container } from '../../src/container.js';
import type { Principal } from '../../src/domain/principal.js';
import { hashPassword } from '../../src/infra/password-hasher.js';
import { createPool } from '../../src/infra/pg/pool.js';
import type { Runtime } from '../../src/ports/runtime.js';
import { RecordingLogger } from './fakes.js';

const DEFAULT_URL = 'postgres://exam:exam@localhost:5433/exam_scheduler_test';

export const NOW = new Date('2026-11-15T12:00:00.000Z');

export function testDatabaseUrl(): string {
  const url = process.env['TEST_DATABASE_URL'] ?? DEFAULT_URL;
  const database = new URL(url).pathname.slice(1);
  if (!database.endsWith('_test')) {
    throw new Error(`Refusing to run destructive tests on "${database}": name must end in _test`);
  }
  return url;
}

export const TEST_PASSWORD = 'test-password';
export const emailFor = (userId: string): string => `${userId}@test.local`;

export const fixedClockRuntime: Runtime = {
  clock: { now: () => NOW },
  ids: { next: () => randomUUID() },
};

export interface Fixtures {
  clinic: Principal;
  patientA: Extract<Principal, { role: 'PATIENT' }>;
  patientB: Extract<Principal, { role: 'PATIENT' }>;
  examTypeId: string;
}

export async function resetAndSeed(pool: Pool): Promise<Fixtures> {
  await pool.query('TRUNCATE reports, appointments, patients, exam_types, users CASCADE');

  const clinicUser = randomUUID();
  const userA = randomUUID();
  const userB = randomUUID();
  const patientA = randomUUID();
  const patientB = randomUUID();
  const examTypeId = randomUUID();

  const passwordHash = await hashPassword(TEST_PASSWORD);
  const insertUser = (id: string, role: string, name: string) =>
    pool.query(
      'INSERT INTO users (id, email, password_hash, role, full_name) VALUES ($1, $2, $3, $4, $5)',
      [id, emailFor(id), passwordHash, role, name],
    );
  await insertUser(clinicUser, 'CLINIC', 'Clinic Staff');
  await insertUser(userA, 'PATIENT', 'Patient A');
  await insertUser(userB, 'PATIENT', 'Patient B');
  await pool.query('INSERT INTO patients (id, user_id) VALUES ($1, $2), ($3, $4)', [
    patientA,
    userA,
    patientB,
    userB,
  ]);
  await pool.query('INSERT INTO exam_types (id, code, name) VALUES ($1, $2, $3)', [
    examTypeId,
    'XRAY',
    'Raio-X',
  ]);

  return {
    clinic: { role: 'CLINIC', userId: clinicUser },
    patientA: { role: 'PATIENT', userId: userA, patientId: patientA },
    patientB: { role: 'PATIENT', userId: userB, patientId: patientB },
    examTypeId,
  };
}

export interface TestContext {
  pool: Pool;
  container: Container;
  fixtures: Fixtures;
  logger: RecordingLogger;
}

/** A fresh pool opens connections lazily, which would let racing calls run one after another. */
export async function warmPool(pool: Pool, size: number): Promise<void> {
  const clients = await Promise.all(Array.from({ length: size }, () => pool.connect()));
  for (const client of clients) client.release();
}

export async function openContext(): Promise<TestContext> {
  const pool = createPool(testDatabaseUrl(), 12);
  const logger = new RecordingLogger();
  const container = buildContainer({
    pool,
    runtime: fixedClockRuntime,
    logger,
    timeZone: 'America/Sao_Paulo',
    openHour: 7,
    closeHour: 19,
  });
  await warmPool(pool, 10);
  const fixtures = await resetAndSeed(pool);
  return { pool, container, fixtures, logger };
}
