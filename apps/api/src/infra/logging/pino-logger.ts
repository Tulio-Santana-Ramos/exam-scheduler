import pino, { type DestinationStream, type Logger as PinoInstance, type StreamEntry } from 'pino';
import type { ServerEnv } from '../../config/env.js';
import type { LogFields, Logger } from '../../ports/logger.js';
import { requestContext } from './request-context.js';

type LoggingEnv = Pick<
  ServerEnv,
  'LOG_LEVEL' | 'LOG_FORMAT' | 'SERVICE_NAME' | 'NODE_ENV' | 'LOKI_URL' | 'LOKI_USER' | 'LOKI_API_KEY'
>;

/**
 * JSON on stdout (LOG_FORMAT=pretty swaps it for a human-readable form); with LOKI_* set, also
 * pushed to Grafana Cloud Loki as JSON. Only service, env and level are labels (low cardinality).
 */
export function createPinoInstance(env: LoggingEnv, destination?: DestinationStream): PinoInstance {
  const options = {
    level: env.LOG_LEVEL,
    base: { service: env.SERVICE_NAME, env: env.NODE_ENV },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: { level: (label: string) => ({ level: label }) },
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie', 'password', '*.password', '*.token'],
      censor: '[redacted]',
    },
  };

  if (destination) return pino(options, destination);

  const { LOKI_URL: url, LOKI_USER: user, LOKI_API_KEY: key } = env;
  const pretty = env.LOG_FORMAT === 'pretty';
  if (!pretty && !(url && user && key)) return pino(options);

  // One transport per stream: a custom level formatter is only safe with a single target each.
  const streams: StreamEntry[] = [{ level: env.LOG_LEVEL, stream: pretty ? prettyStream() : process.stdout }];
  if (url && user && key) streams.push({ level: env.LOG_LEVEL, stream: lokiStream(env, url, user, key) });
  return pino(options, pino.multistream(streams));
}

function prettyStream(): DestinationStream {
  return pino.transport({
    target: 'pino-pretty',
    options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l', ignore: 'pid,hostname,service,env' },
  });
}

function lokiStream(env: LoggingEnv, host: string, username: string, password: string): DestinationStream {
  return pino.transport({
    target: 'pino-loki',
    options: {
      host,
      basicAuth: { username, password },
      labels: { service: env.SERVICE_NAME, env: env.NODE_ENV },
      batching: true,
      interval: 5,
      // Our ISO `time` and string `level` are not what pino-loki parses (it expects epoch ms and numbers).
      replaceTimestamp: true,
      propsToLabels: ['level'],
    },
  });
}

/** Adds the current request id itself (Fastify's own request logs already carry one as a binding). */
export class PinoLogger implements Logger {
  constructor(private readonly pino: PinoInstance) {}

  debug(fields: LogFields, message: string): void {
    this.pino.debug(this.withRequest(fields), message);
  }
  info(fields: LogFields, message: string): void {
    this.pino.info(this.withRequest(fields), message);
  }
  warn(fields: LogFields, message: string): void {
    this.pino.warn(this.withRequest(fields), message);
  }
  error(fields: LogFields, message: string): void {
    this.pino.error(this.withRequest(fields), message);
  }

  private withRequest(fields: LogFields): LogFields {
    const context = requestContext.getStore();
    return context ? { requestId: context.requestId, ...fields } : fields;
  }
}
