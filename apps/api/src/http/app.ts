import { randomUUID } from 'node:crypto';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import Fastify, { LogController, type FastifyBaseLogger, type FastifyInstance } from 'fastify';
import type { Logger as PinoInstance } from 'pino';
import type { Pool } from 'pg';
import type { ServerEnv } from '../config/env.js';
import type { Container } from '../container.js';
import { requestContext } from '../infra/logging/request-context.js';
import { AppointmentController } from './controllers/appointment-controller.js';
import { AuthController } from './controllers/auth-controller.js';
import { CatalogController } from './controllers/catalog-controller.js';
import { PatientController } from './controllers/patient-controller.js';
import { ReportController } from './controllers/report-controller.js';
import { registerErrorHandling } from './error-handler.js';

export type AppEnv = Pick<
  ServerEnv,
  'JWT_SECRET' | 'JWT_EXPIRES_IN' | 'CORS_ORIGIN' | 'TRUST_PROXY' | 'LOGIN_RATE_LIMIT_MAX'
>;

export interface AppDeps {
  container: Container;
  pool: Pool;
  env: AppEnv;
  logger: PinoInstance;
}

const REQUEST_ID_HEADER = 'x-request-id';
const SAFE_REQUEST_ID = /^[\w-]{8,64}$/;

export async function buildApp({ container, pool, env, logger }: AppDeps): Promise<FastifyInstance> {
  const baseLogger: FastifyBaseLogger = logger;
  const app = Fastify({
    loggerInstance: baseLogger,
    logController: new LogController({ requestIdLogLabel: 'requestId', disableRequestLogging: true }),
    trustProxy: env.TRUST_PROXY,
    genReqId: (request) => {
      const incoming = request.headers[REQUEST_ID_HEADER];
      return typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
    },
  });

  app.addHook('onRequest', (request, reply, done) => {
    void reply.header(REQUEST_ID_HEADER, request.id);
    requestContext.run({ requestId: request.id }, done);
  });

  app.addHook('onResponse', (request, reply, done) => {
    if (request.method !== 'OPTIONS' && request.url !== '/health') {
      const status = reply.statusCode;
      const fields = {
        event: 'http.request',
        method: request.method,
        route: request.routeOptions.url ?? 'unmatched',
        status,
        durationMs: Math.round(reply.elapsedTime),
      };
      if (status >= 500) request.log.error(fields, 'http.request');
      else if (status >= 400) request.log.warn(fields, 'http.request');
      else request.log.info(fields, 'http.request');
    }
    done();
  });

  await app.register(cors, {
    origin: env.CORS_ORIGIN.split(',').map((origin) => origin.trim()),
    methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
  });
  await app.register(rateLimit, { global: false });
  await app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: { algorithm: 'HS256', expiresIn: env.JWT_EXPIRES_IN },
    verify: { algorithms: ['HS256'] },
  });

  registerErrorHandling(app);
  new AuthController(container, { loginRateLimitMax: env.LOGIN_RATE_LIMIT_MAX }).register(app);
  new CatalogController(container, pool).register(app);
  new AppointmentController(container).register(app);
  new ReportController(container).register(app);
  new PatientController(container).register(app);

  return app;
}
