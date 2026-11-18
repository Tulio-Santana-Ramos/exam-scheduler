import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TEST_PASSWORD, emailFor, openContext, type TestContext } from '../support/db.js';

describe('authentication against real Postgres and scrypt', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await openContext();
  });

  afterAll(async () => {
    await ctx.pool.end();
  });

  it('builds the clinic principal', async () => {
    const principal = await ctx.container.authenticate.execute({
      email: emailFor(ctx.fixtures.clinic.userId),
      password: TEST_PASSWORD,
    });
    expect(principal).toEqual(ctx.fixtures.clinic);
  });

  it('builds the patient principal with the patient id resolved by the database', async () => {
    const principal = await ctx.container.authenticate.execute({
      email: emailFor(ctx.fixtures.patientA.userId).toUpperCase(),
      password: TEST_PASSWORD,
    });
    expect(principal).toEqual(ctx.fixtures.patientA);
  });

  it('rejects a wrong password and an unknown email identically', async () => {
    await expect(
      ctx.container.authenticate.execute({
        email: emailFor(ctx.fixtures.clinic.userId),
        password: 'wrong',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    await expect(
      ctx.container.authenticate.execute({ email: 'ghost@test.local', password: TEST_PASSWORD }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });
});
