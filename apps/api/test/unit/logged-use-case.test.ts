import { describe, expect, it } from 'vitest';
import { InvalidInputError } from '../../src/domain/errors.js';
import { withLogging } from '../../src/use-cases/logged-use-case.js';
import { RecordingLogger } from '../support/fakes.js';

describe('withLogging', () => {
  it('logs success at info with outcome, duration and described fields', async () => {
    const logger = new RecordingLogger();
    const useCase = withLogging(
      { execute: async (input: { id: string }) => ({ ok: input.id }) },
      logger,
      { event: 'thing.do', describe: (input, output) => ({ id: input.id, result: output?.ok }) },
    );

    await expect(useCase.execute({ id: 'x1' })).resolves.toEqual({ ok: 'x1' });

    expect(logger.entries).toHaveLength(1);
    expect(logger.entries[0]).toMatchObject({
      level: 'info',
      message: 'thing.do',
      fields: { event: 'thing.do', outcome: 'ok', id: 'x1', result: 'x1' },
    });
    expect(typeof logger.entries[0]?.fields['durationMs']).toBe('number');
  });

  it('logs domain rejections at warn with the error code, and rethrows', async () => {
    const logger = new RecordingLogger();
    const useCase = withLogging<void, string>(
      {
        execute: async (): Promise<string> => {
          throw new InvalidInputError('nope');
        },
      },
      logger,
      { event: 'thing.do' },
    );

    await expect(useCase.execute()).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(logger.entries[0]).toMatchObject({
      level: 'warn',
      fields: { outcome: 'rejected', errorCode: 'INVALID_INPUT' },
    });
  });

  it('logs unexpected failures at error with the stack, and rethrows', async () => {
    const logger = new RecordingLogger();
    const useCase = withLogging<void, string>(
      {
        execute: async (): Promise<string> => {
          throw new Error('db exploded');
        },
      },
      logger,
      { event: 'thing.do' },
    );

    await expect(useCase.execute()).rejects.toThrow('db exploded');
    expect(logger.entries[0]).toMatchObject({
      level: 'error',
      fields: { outcome: 'failed', error: 'db exploded' },
    });
    expect(logger.entries[0]?.fields['stack']).toContain('db exploded');
  });

  it('honours a lower success level for noisy read operations', async () => {
    const logger = new RecordingLogger();
    const useCase = withLogging<void, number>({ execute: async () => 1 }, logger, { event: 'x.list', successLevel: 'debug' });
    await useCase.execute();
    expect(logger.entries[0]?.level).toBe('debug');
  });
});
