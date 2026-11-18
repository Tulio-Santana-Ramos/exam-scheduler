import { randomUUID } from 'node:crypto';
import type { Runtime } from '../ports/runtime.js';

export const systemRuntime: Runtime = {
  clock: { now: () => new Date() },
  ids: { next: () => randomUUID() },
};
