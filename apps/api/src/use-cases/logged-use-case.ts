import { DomainError } from '../domain/errors.js';
import type { Principal } from '../domain/principal.js';
import type { LogFields, Logger } from '../ports/logger.js';
import type { UseCase } from './use-case.js';

export interface LoggingOptions<Input, Output> {
  /** Stable, dot-separated name, e.g. `appointment.book`. This is what dashboards filter on. */
  event: string;
  /** Extra fields; receives the output only on success. Must not include secrets or report text. */
  describe?: (input: Input, output: Output | null) => LogFields;
  successLevel?: 'debug' | 'info';
}

export const actorFields = (principal: Principal): LogFields => ({
  actorId: principal.userId,
  actorRole: principal.role,
});

/**
 * Decorates a use case with one structured log line per execution: outcome, duration and
 * error code. Expected rejections are `warn`; anything else is `error` with the stack.
 */
export function withLogging<Input, Output>(
  useCase: UseCase<Input, Output>,
  logger: Logger,
  options: LoggingOptions<Input, Output>,
): UseCase<Input, Output> {
  const describe = options.describe ?? (() => ({}));

  return {
    async execute(input: Input): Promise<Output> {
      const startedAt = performance.now();
      const elapsed = () => Math.round(performance.now() - startedAt);
      try {
        const output = await useCase.execute(input);
        logger[options.successLevel ?? 'info'](
          { event: options.event, outcome: 'ok', durationMs: elapsed(), ...describe(input, output) },
          options.event,
        );
        return output;
      } catch (error) {
        if (error instanceof DomainError) {
          logger.warn(
            {
              event: options.event,
              outcome: 'rejected',
              errorCode: error.code,
              durationMs: elapsed(),
              ...describe(input, null),
            },
            options.event,
          );
        } else {
          logger.error(
            {
              event: options.event,
              outcome: 'failed',
              durationMs: elapsed(),
              error: error instanceof Error ? error.message : 'non-error value thrown',
              stack: error instanceof Error ? error.stack : undefined,
              ...describe(input, null),
            },
            options.event,
          );
        }
        throw error;
      }
    },
  };
}
