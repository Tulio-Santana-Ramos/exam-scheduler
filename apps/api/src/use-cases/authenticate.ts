import type { Principal } from '../domain/principal.js';
import type { UnitOfWork } from '../ports/unit-of-work.js';
import type { AuthenticationService } from '../services/authentication-service.js';
import type { UseCase } from './use-case.js';

export interface AuthenticateInput {
  email: string;
  password: string;
}

/** The only place a Principal is built. Token format and transport belong to the HTTP layer. */
export class AuthenticateUseCase implements UseCase<AuthenticateInput, Principal> {
  constructor(private readonly deps: { uow: UnitOfWork; service: AuthenticationService }) {}

  execute(input: AuthenticateInput): Promise<Principal> {
    return this.deps.uow.read((repositories) =>
      this.deps.service.authenticate(repositories.users, input.email, input.password),
    );
  }
}
