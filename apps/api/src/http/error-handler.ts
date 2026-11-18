import type { FastifyError, FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { DomainError, type DomainErrorCode } from '../domain/errors.js';

/** Exhaustive on purpose: adding a DomainErrorCode without an HTTP status fails to compile. */
const STATUS_BY_CODE: Record<DomainErrorCode, number> = {
  INVALID_INPUT: 400,
  INVALID_CREDENTIALS: 401,
  FORBIDDEN: 403,
  PATIENT_NOT_FOUND: 404,
  EXAM_TYPE_NOT_FOUND: 404,
  APPOINTMENT_NOT_FOUND: 404,
  REPORT_NOT_FOUND: 404,
  SLOT_UNAVAILABLE: 409,
  APPOINTMENT_ALREADY_CANCELLED: 409,
  APPOINTMENT_HAS_PUBLISHED_REPORT: 409,
  APPOINTMENT_CANCELLED: 409,
  REPORT_ALREADY_PUBLISHED: 409,
  SLOT_IN_PAST: 422,
  SLOT_MISALIGNED: 422,
  SLOT_OUTSIDE_OPENING_HOURS: 422,
  APPOINTMENT_IN_PAST: 422,
};

const errorBody = (code: string, message: string) => ({ error: { code, message } });

const hasStatusCode = (error: Error): error is Error & { statusCode: number } =>
  'statusCode' in error && typeof error.statusCode === 'number';

export function registerErrorHandling(app: FastifyInstance): void {
  app.setNotFoundHandler((request, reply) =>
    reply.status(404).send(errorBody('ROUTE_NOT_FOUND', `${request.method} ${request.url} does not exist`)),
  );

  app.setErrorHandler((error: FastifyError | Error, request, reply) => {
    if (error instanceof DomainError) {
      return reply.status(STATUS_BY_CODE[error.code]).send(errorBody(error.code, error.message));
    }
    if (error instanceof ZodError) {
      const message = error.issues.map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`).join('; ');
      return reply.status(400).send(errorBody('INVALID_INPUT', message));
    }
    if (hasStatusCode(error) && error.statusCode < 500) {
      const code = error.statusCode === 401 ? 'UNAUTHENTICATED' : error.statusCode === 429 ? 'RATE_LIMITED' : 'BAD_REQUEST';
      return reply.status(error.statusCode).send(errorBody(code, error.message));
    }
    request.log.error({ err: error }, 'unhandled error');
    return reply.status(500).send(errorBody('INTERNAL', 'Internal server error'));
  });
}
