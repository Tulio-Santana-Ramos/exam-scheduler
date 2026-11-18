import type { Repositories } from './repositories.js';

export interface UnitOfWork {
  /** All repositories share one transaction: commit on resolve, rollback on throw. */
  run<T>(work: (repositories: Repositories) => Promise<T>): Promise<T>;
  /** Single-statement reads; no transaction is opened. */
  read<T>(work: (repositories: Repositories) => Promise<T>): Promise<T>;
}
