import type { FastifyInstance } from 'fastify';
import type { Container } from '../../container.js';
import { claimsOf, requirePrincipal } from '../principal.js';
import { LoginBody } from '../schemas.js';

interface AuthSettings {
  loginRateLimitMax: number;
}

export class AuthController {
  constructor(
    private readonly useCases: Pick<Container, 'authenticate'>,
    private readonly settings: AuthSettings,
  ) {}

  register(app: FastifyInstance): void {
    app.post(
      '/auth/login',
      { config: { rateLimit: { max: this.settings.loginRateLimitMax, timeWindow: '1 minute' } } },
      async (request) => {
        const body = LoginBody.parse(request.body);
        const principal = await this.useCases.authenticate.execute(body);
        const token = app.jwt.sign(claimsOf(principal));
        return { token, user: principal };
      },
    );

    app.get('/me', async (request) => ({ user: await requirePrincipal(request) }));
  }
}
