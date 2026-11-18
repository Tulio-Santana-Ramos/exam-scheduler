import { migrate } from '../../src/infra/pg/migrate.js';
import { createPool, MIGRATIONS_DIR } from '../../src/infra/pg/pool.js';
import { testDatabaseUrl } from './db.js';

export default async function setup(): Promise<void> {
  const pool = createPool(testDatabaseUrl(), 1);
  try {
    await migrate(pool, MIGRATIONS_DIR);
  } finally {
    await pool.end();
  }
}
