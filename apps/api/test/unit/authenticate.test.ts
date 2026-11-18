import { beforeEach, describe, expect, it } from 'vitest';
import { AuthenticationService } from '../../src/services/authentication-service.js';
import { AuthenticateUseCase } from '../../src/use-cases/authenticate.js';
import { FakePasswordHasher, PATIENT_ID, createFakes, type Fakes } from '../support/fakes.js';

describe('AuthenticateUseCase', () => {
  let fakes: Fakes;
  let hasher: FakePasswordHasher;
  let authenticate: AuthenticateUseCase;

  beforeEach(() => {
    fakes = createFakes();
    hasher = new FakePasswordHasher();
    authenticate = new AuthenticateUseCase({ uow: fakes.uow, service: new AuthenticationService(hasher) });
    fakes.users.add('clinica@demo.test', {
      userId: 'staff-1',
      passwordHash: 'hashed:secret',
      role: 'CLINIC',
      patientId: null,
    });
    fakes.users.add('ana@demo.test', {
      userId: 'user-ana',
      passwordHash: 'hashed:secret',
      role: 'PATIENT',
      patientId: PATIENT_ID,
    });
    fakes.users.add('orphan@demo.test', {
      userId: 'user-orphan',
      passwordHash: 'hashed:secret',
      role: 'PATIENT',
      patientId: null,
    });
  });

  it('returns a clinic principal', async () => {
    await expect(authenticate.execute({ email: 'clinica@demo.test', password: 'secret' })).resolves.toEqual({
      role: 'CLINIC',
      userId: 'staff-1',
    });
  });

  it('returns a patient principal carrying the patient id from storage, ignoring email case and padding', async () => {
    await expect(authenticate.execute({ email: '  ANA@demo.test ', password: 'secret' })).resolves.toEqual({
      role: 'PATIENT',
      userId: 'user-ana',
      patientId: PATIENT_ID,
    });
  });

  it('rejects a wrong password', async () => {
    await expect(authenticate.execute({ email: 'ana@demo.test', password: 'nope' })).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('rejects an unknown email with the same error, after doing the same hashing work', async () => {
    await expect(authenticate.execute({ email: 'ghost@demo.test', password: 'secret' })).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
    expect(hasher.verifyCalls).toBe(1);
  });

  it('fails loudly when a patient account has no patient record', async () => {
    await expect(authenticate.execute({ email: 'orphan@demo.test', password: 'secret' })).rejects.toThrow(
      /no patient record/,
    );
  });
});
