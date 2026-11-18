import { DatabaseError, type QueryResult, type QueryResultRow } from 'pg';

export type SqlValue = string | number | boolean | Date | null;

/** The slice of Pool/PoolClient that repositories use, so they run in or out of a transaction. */
export interface Queryable {
  query<Row extends QueryResultRow>(
    text: string,
    values?: readonly SqlValue[],
  ): Promise<QueryResult<Row>>;
}

export function isUniqueViolation(error: Error, constraint: string): boolean {
  return error instanceof DatabaseError && error.code === '23505' && error.constraint === constraint;
}
