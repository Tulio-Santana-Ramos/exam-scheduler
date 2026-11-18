import { InvalidInputError } from './errors.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Rejects malformed ids before they reach SQL (Postgres would otherwise raise 22P02 and surface as a 500). */
export function requireUuid(value: string, field: string): string {
  if (!UUID.test(value)) throw new InvalidInputError(`${field} must be a valid UUID`);
  return value.toLowerCase();
}
