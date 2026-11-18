import { loadServerEnv } from './config/env.js';
import { buildContainer } from './container.js';
import { buildApp } from './http/app.js';
import { createPinoInstance, PinoLogger } from './infra/logging/pino-logger.js';
import { createPool } from './infra/pg/pool.js';
import { systemRuntime } from './infra/system-runtime.js';

const env = loadServerEnv();
const pino = createPinoInstance(env);
const pool = createPool(env.DATABASE_URL, env.DB_POOL_MAX);
const container = buildContainer({
  pool,
  runtime: systemRuntime,
  logger: new PinoLogger(pino),
  timeZone: env.CLINIC_TIME_ZONE,
  openHour: env.CLINIC_OPEN_HOUR,
  closeHour: env.CLINIC_CLOSE_HOUR,
});
const app = await buildApp({ container, pool, env, logger: pino });

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  pino.info({ event: 'server.shutdown', signal }, 'shutting down');
  await app.close();
  await pool.end();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

try {
  await app.listen({ port: env.PORT, host: env.HOST });
  pino.info(
    { event: 'server.started', port: env.PORT, timeZone: env.CLINIC_TIME_ZONE },
    'exam-scheduler api listening',
  );
} catch (error) {
  pino.fatal({ event: 'server.start_failed', err: error }, 'could not start');
  process.exit(1);
}
