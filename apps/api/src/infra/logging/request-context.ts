import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  requestId: string;
}

/** Lets use-case log lines carry the id of the HTTP request that triggered them. */
export const requestContext = new AsyncLocalStorage<RequestContext>();
