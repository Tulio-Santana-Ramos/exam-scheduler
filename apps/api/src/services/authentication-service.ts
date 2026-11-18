import { InvalidCredentialsError } from '../domain/errors.js';
import type { Principal } from '../domain/principal.js';
import type { UserRepository } from '../ports/repositories.js';
import type { PasswordHasher } from '../ports/security.js';

/**
 * Builds the Principal from credentials. Long-lived (not per unit of work): it caches a decoy
 * hash so unknown emails cost the same hashing work as wrong passwords, hiding which accounts exist.
 */
export class AuthenticationService {
  private decoyHash: Promise<string> | null = null;

  constructor(private readonly hasher: PasswordHasher) {}

  async authenticate(users: UserRepository, email: string, password: string): Promise<Principal> {
    const credentials = await users.findCredentialsByEmail(email.trim());

    if (!credentials) {
      await this.hasher.verify(password, await this.getDecoyHash());
      throw new InvalidCredentialsError();
    }
    if (!(await this.hasher.verify(password, credentials.passwordHash))) {
      throw new InvalidCredentialsError();
    }

    if (credentials.role === 'CLINIC') return { role: 'CLINIC', userId: credentials.userId };
    if (!credentials.patientId) {
      throw new Error(`Patient account ${credentials.userId} has no patient record`);
    }
    return { role: 'PATIENT', userId: credentials.userId, patientId: credentials.patientId };
  }

  private getDecoyHash(): Promise<string> {
    this.decoyHash ??= this.hasher.hash('decoy-password-never-matches');
    return this.decoyHash;
  }
}
