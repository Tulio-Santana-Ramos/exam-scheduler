import { loadDatabaseEnv } from '../config/env.js';
import { migrate } from '../infra/pg/migrate.js';
import { createPool, MIGRATIONS_DIR } from '../infra/pg/pool.js';

const env = loadDatabaseEnv();
const pool = createPool(env.DATABASE_URL, 1);
try {
  const applied = await migrate(pool, MIGRATIONS_DIR);
  console.log(applied.length > 0 ? `Applied: ${applied.join(', ')}` : 'Database up to date');
} finally {
  await pool.end();
}
