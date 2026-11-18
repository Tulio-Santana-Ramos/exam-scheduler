import { ForbiddenError } from './errors.js';

export type ClinicPrincipal = { role: 'CLINIC'; userId: string };
export type PatientPrincipal = { role: 'PATIENT'; userId: string; patientId: string };
export type Principal = ClinicPrincipal | PatientPrincipal;

export function requireClinic(principal: Principal): ClinicPrincipal {
  if (principal.role !== 'CLINIC') throw new ForbiddenError();
  return principal;
}

export function requirePatient(principal: Principal): PatientPrincipal {
  if (principal.role !== 'PATIENT') throw new ForbiddenError();
  return principal;
}
