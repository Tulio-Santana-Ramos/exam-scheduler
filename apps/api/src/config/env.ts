import { z } from 'zod';

const DatabaseEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
});

const ServerEnvSchema = DatabaseEnvSchema.extend({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default('0.0.0.0'),
  CLINIC_TIME_ZONE: z.string().default('America/Sao_Paulo'),
  CLINIC_OPEN_HOUR: z.coerce.number().int().min(0).max(23).default(7),
  CLINIC_CLOSE_HOUR: z.coerce.number().int().min(1).max(24).default(19),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must have at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  TRUST_PROXY: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(10),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),
  SERVICE_NAME: z.string().default('exam-scheduler-api'),
  LOKI_URL: z.string().url().optional(),
  LOKI_USER: z.string().optional(),
  LOKI_API_KEY: z.string().optional(),
});

export type DatabaseEnv = z.infer<typeof DatabaseEnvSchema>;
export type ServerEnv = z.infer<typeof ServerEnvSchema>;

function parse<Schema extends z.ZodType>(schema: Schema, source: NodeJS.ProcessEnv): z.infer<Schema> {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment: ${problems.join('; ')}`);
  }
  return parsed.data;
}

/** Enough for scripts that only touch the database (migrate, seed). */
export function loadDatabaseEnv(source: NodeJS.ProcessEnv = process.env): DatabaseEnv {
  return parse(DatabaseEnvSchema, source);
}

export function loadServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  const env = parse(ServerEnvSchema, source);
  new Intl.DateTimeFormat('en-US', { timeZone: env.CLINIC_TIME_ZONE });
  if (env.CLINIC_CLOSE_HOUR <= env.CLINIC_OPEN_HOUR) {
    throw new Error('Invalid environment: CLINIC_CLOSE_HOUR must be greater than CLINIC_OPEN_HOUR');
  }
  const lokiFields = [env.LOKI_URL, env.LOKI_USER, env.LOKI_API_KEY];
  if (lokiFields.some(Boolean) && !lokiFields.every(Boolean)) {
    throw new Error('Invalid environment: LOKI_URL, LOKI_USER and LOKI_API_KEY must be set together');
  }
  return env;
}
