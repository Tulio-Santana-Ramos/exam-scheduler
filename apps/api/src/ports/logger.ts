export type LogFields = Record<string, string | number | boolean | null | undefined>;

/**
 * Structured logging port. Never put secrets, passwords or report contents in fields:
 * logs are shipped to a third-party aggregator.
 */
export interface Logger {
  debug(fields: LogFields, message: string): void;
  info(fields: LogFields, message: string): void;
  warn(fields: LogFields, message: string): void;
  error(fields: LogFields, message: string): void;
}
