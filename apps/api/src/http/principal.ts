import type { FastifyRequest } from 'fastify';
import type { Principal } from '../domain/principal.js';

export interface TokenClaims {
  sub: string;
  role: 'CLINIC' | 'PATIENT';
  patientId?: string;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: TokenClaims;
    user: TokenClaims;
  }
}

export class UnauthenticatedError extends Error {
  readonly statusCode = 401;
  constructor() {
    super('Authentication required');
  }
}

export function claimsOf(principal: Principal): TokenClaims {
  return principal.role === 'CLINIC'
    ? { sub: principal.userId, role: 'CLINIC' }
    : { sub: principal.userId, role: 'PATIENT', patientId: principal.patientId };
}

/** Verifies the bearer token and rebuilds the principal. Authorization itself stays in the use cases. */
export async function requirePrincipal(request: FastifyRequest): Promise<Principal> {
  await request.jwtVerify();
  const claims = request.user;
  if (claims.role === 'CLINIC') return { role: 'CLINIC', userId: claims.sub };
  if (!claims.patientId) throw new UnauthenticatedError();
  return { role: 'PATIENT', userId: claims.sub, patientId: claims.patientId };
}
