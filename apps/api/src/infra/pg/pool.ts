import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

export function createPool(connectionString: string, max: number): Pool {
  const pool = new Pool({ connectionString, max });
  // Hosted Postgres drops idle connections; without a listener an idle-client error kills the process.
  pool.on('error', (error) => {
    console.error('[pg] idle client error, connection discarded:', error.message);
  });
  return pool;
}

export const MIGRATIONS_DIR = fileURLToPath(new URL('../../../migrations', import.meta.url));
