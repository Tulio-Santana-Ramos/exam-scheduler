import { randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildContainer } from '../../src/container.js';
import { buildApp, type AppEnv } from '../../src/http/app.js';
import { createPinoInstance, PinoLogger } from '../../src/infra/logging/pino-logger.js';
import { createPool } from '../../src/infra/pg/pool.js';
import {
  TEST_PASSWORD,
  emailFor,
  fixedClockRuntime,
  resetAndSeed,
  testDatabaseUrl,
  warmPool,
  type Fixtures,
} from '../support/db.js';

type LogLine = Record<string, string | number | boolean | null | undefined>;

class LineCapture extends Writable {
  readonly lines: LogLine[] = [];
  override _write(chunk: Buffer, _encoding: BufferEncoding, done: (error?: Error | null) => void): void {
    for (const text of chunk.toString().split('\n').filter(Boolean)) {
      const parsed: LogLine = JSON.parse(text);
      this.lines.push(parsed);
    }
    done();
  }
}

interface ErrorBody {
  error: { code: string; message: string };
}
interface LoginBody {
  token: string;
  user: { role: string };
}
interface AppointmentBody {
  id: string;
  status: string;
}
interface ReportBody {
  id: string;
  status: string;
}
interface MyAppointment {
  id: string;
  hasPublishedReport: boolean;
  publishedReportId: string | null;
}

const SLOT = '2026-11-16T13:00:00.000Z';
const SECRET_BODY = 'TEXTO-CLINICO-SIGILOSO-123';
const APP_ENV: AppEnv = {
  JWT_SECRET: 'test-secret-test-secret-test-secret-1234',
  JWT_EXPIRES_IN: '1h',
  CORS_ORIGIN: 'http://localhost:5173',
  TRUST_PROXY: false,
  LOGIN_RATE_LIMIT_MAX: 1000,
};

describe('HTTP API against real Postgres', () => {
  const capture = new LineCapture();
  const pool = createPool(testDatabaseUrl(), 12);
  let app: FastifyInstance;
  let fixtures: Fixtures;
  let clinicToken: string;
  let patientAToken: string;
  let patientBToken: string;

  const buildWith = async (env: AppEnv): Promise<FastifyInstance> => {
    const pino = createPinoInstance(
      { LOG_LEVEL: 'debug', LOG_FORMAT: 'json', SERVICE_NAME: 'test', NODE_ENV: 'test', LOKI_URL: undefined, LOKI_USER: undefined, LOKI_API_KEY: undefined },
      capture,
    );
    const container = buildContainer({
      pool,
      runtime: fixedClockRuntime,
      logger: new PinoLogger(pino),
      timeZone: 'America/Sao_Paulo',
      openHour: 7,
      closeHour: 19,
    });
    return buildApp({ container, pool, env, logger: pino });
  };

  const login = async (userId: string): Promise<string> => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: emailFor(userId), password: TEST_PASSWORD },
    });
    expect(response.statusCode).toBe(200);
    return response.json<LoginBody>().token;
  };

  const as = (token: string) => ({ authorization: `Bearer ${token}` });

  const book = (token: string, patientId: string, slotStart: string, headers: Record<string, string> = {}) =>
    app.inject({
      method: 'POST',
      url: '/appointments',
      headers: { ...as(token), ...headers },
      payload: { patientId, examTypeId: fixtures.examTypeId, slotStart },
    });

  beforeAll(async () => {
    await warmPool(pool, 10);
    fixtures = await resetAndSeed(pool);
    app = await buildWith(APP_ENV);
    clinicToken = await login(fixtures.clinic.userId);
    patientAToken = await login(fixtures.patientA.userId);
    patientBToken = await login(fixtures.patientB.userId);
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  describe('public and auth', () => {
    it('serves health and the clinic configuration', async () => {
      expect((await app.inject({ url: '/health' })).json<{ status: string }>().status).toBe('ok');
      expect((await app.inject({ url: '/config' })).json()).toEqual({
        timeZone: 'America/Sao_Paulo',
        openHour: 7,
        closeHour: 19,
        slotMinutes: 30,
      });
    });

    it('rejects missing, malformed and wrongly signed tokens with 401', async () => {
      for (const headers of [{}, as('garbage'), as(app.jwt.sign({ sub: 'x', role: 'CLINIC' }, { key: 'another-secret-another-secret-12345' }))]) {
        const response = await app.inject({ url: '/appointments', headers });
        expect(response.statusCode).toBe(401);
        expect(response.json<ErrorBody>().error.code).toBe('UNAUTHENTICATED');
      }
    });

    it('answers a wrong password and an unknown email identically', async () => {
      const wrong = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: emailFor(fixtures.clinic.userId), password: 'wrong-password' },
      });
      const unknown = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'ghost@test.local', password: 'wrong-password' },
      });
      expect(wrong.statusCode).toBe(401);
      expect(unknown.statusCode).toBe(401);
      expect(wrong.json()).toEqual(unknown.json());
    });

    it('rejects a login body of the wrong shape with 400', async () => {
      const response = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 5 } });
      expect(response.statusCode).toBe(400);
      expect(response.json<ErrorBody>().error.code).toBe('INVALID_INPUT');
    });

    it('returns the authenticated principal on /me', async () => {
      const response = await app.inject({ url: '/me', headers: as(patientAToken) });
      expect(response.json()).toEqual({
        user: { role: 'PATIENT', userId: fixtures.patientA.userId, patientId: fixtures.patientA.patientId },
      });
    });

    it('answers unknown routes and malformed JSON with structured errors', async () => {
      const missing = await app.inject({ url: '/nope' });
      expect(missing.statusCode).toBe(404);
      expect(missing.json<ErrorBody>().error.code).toBe('ROUTE_NOT_FOUND');

      const malformed = await app.inject({
        method: 'POST',
        url: '/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: '{not json',
      });
      expect(malformed.statusCode).toBe(400);
    });
  });

  describe('booking rules over HTTP', () => {
    it('books, then rejects a second booking in the same slot with 409', async () => {
      const first = await book(clinicToken, fixtures.patientA.patientId, SLOT);
      expect(first.statusCode).toBe(201);
      const second = await book(clinicToken, fixtures.patientB.patientId, SLOT);
      expect(second.statusCode).toBe(409);
      expect(second.json<ErrorBody>().error.code).toBe('SLOT_UNAVAILABLE');
    });

    it.each([
      ['a slot in the past', '2026-11-14T13:00:00Z', 422, 'SLOT_IN_PAST'],
      ['a slot off the 30-minute grid', '2026-11-17T13:10:00Z', 422, 'SLOT_MISALIGNED'],
      ['a slot before 07:00 local', '2026-11-17T09:30:00Z', 422, 'SLOT_OUTSIDE_OPENING_HOURS'],
      ['a slot starting at 19:00 local', '2026-11-17T22:00:00Z', 422, 'SLOT_OUTSIDE_OPENING_HOURS'],
      ['a timestamp without an offset', '2026-11-17T13:00:00', 400, 'INVALID_INPUT'],
    ])('rejects %s', async (_label, slotStart, status, code) => {
      const response = await book(clinicToken, fixtures.patientA.patientId, slotStart);
      expect(response.statusCode).toBe(status);
      expect(response.json<ErrorBody>().error.code).toBe(code);
    });

    it('validates ids: malformed is 400, well-formed but unknown is 404', async () => {
      const malformed = await book(clinicToken, 'not-a-uuid', '2026-11-18T13:00:00Z');
      expect(malformed.statusCode).toBe(400);
      const unknown = await book(clinicToken, randomUUID(), '2026-11-18T13:00:00Z');
      expect(unknown.statusCode).toBe(404);
      expect(unknown.json<ErrorBody>().error.code).toBe('PATIENT_NOT_FOUND');

      const badPath = await app.inject({
        method: 'POST',
        url: '/appointments/123/cancel',
        headers: as(clinicToken),
      });
      expect(badPath.statusCode).toBe(400);
      const badQuery = await app.inject({
        url: '/appointments?patientId=%27%20OR%201%3D1',
        headers: as(clinicToken),
      });
      expect(badQuery.statusCode).toBe(400);
    });

    it('accepts exactly one of many simultaneous requests for one slot', async () => {
      const slot = '2026-11-19T13:00:00.000Z';
      const responses = await Promise.all(
        Array.from({ length: 8 }, (_, i) =>
          book(clinicToken, i % 2 ? fixtures.patientA.patientId : fixtures.patientB.patientId, slot),
        ),
      );
      const statuses = responses.map((r) => r.statusCode).sort();
      expect(statuses.filter((s) => s === 201)).toHaveLength(1);
      expect(statuses.filter((s) => s === 409)).toHaveLength(7);
    });

    it('refuses to cancel an appointment whose slot already started', async () => {
      const pastId = randomUUID();
      await pool.query(
        `INSERT INTO appointments (id, patient_id, exam_type_id, slot_start, status, created_at)
         VALUES ($1, $2, $3, '2026-11-10T13:00:00Z', 'SCHEDULED', now())`,
        [pastId, fixtures.patientA.patientId, fixtures.examTypeId],
      );
      const response = await app.inject({
        method: 'POST',
        url: `/appointments/${pastId}/cancel`,
        headers: as(clinicToken),
      });
      expect(response.statusCode).toBe(422);
      expect(response.json<ErrorBody>().error.code).toBe('APPOINTMENT_IN_PAST');
    });

    it('cancels an upcoming appointment, frees the slot, and rejects a second cancel with 409', async () => {
      const slot = '2026-11-20T13:00:00.000Z';
      const booked = (await book(clinicToken, fixtures.patientA.patientId, slot)).json<AppointmentBody>();
      const cancel = () =>
        app.inject({ method: 'POST', url: `/appointments/${booked.id}/cancel`, headers: as(clinicToken) });

      expect((await cancel()).json<AppointmentBody>().status).toBe('CANCELLED');
      expect((await cancel()).statusCode).toBe(409);
      expect((await book(clinicToken, fixtures.patientB.patientId, slot)).statusCode).toBe(201);
    });
  });

  describe('authorization is enforced by the backend, not by the UI', () => {
    it('forbids patients on every clinic endpoint', async () => {
      const id = randomUUID();
      const calls = [
        { method: 'POST' as const, url: '/appointments', payload: { patientId: id, examTypeId: id, slotStart: SLOT } },
        { method: 'GET' as const, url: '/appointments' },
        { method: 'GET' as const, url: '/patients' },
        { method: 'POST' as const, url: `/appointments/${id}/cancel` },
        { method: 'PUT' as const, url: `/appointments/${id}/report`, payload: { title: 'a', body: 'b', professionalName: 'c' } },
        { method: 'GET' as const, url: `/appointments/${id}/report` },
        { method: 'POST' as const, url: `/appointments/${id}/report/publish` },
      ];
      for (const call of calls) {
        const response = await app.inject({ ...call, headers: as(patientAToken) });
        expect(response.statusCode, `${call.method} ${call.url}`).toBe(403);
        expect(response.json<ErrorBody>().error.code).toBe('FORBIDDEN');
      }
    });

    it('forbids clinic staff on patient endpoints', async () => {
      for (const url of ['/me/appointments', `/me/reports/${randomUUID()}`]) {
        expect((await app.inject({ url, headers: as(clinicToken) })).statusCode).toBe(403);
      }
    });
  });

  describe('report lifecycle and patient isolation', () => {
    const slot = '2026-11-21T13:00:00.000Z';
    let appointmentId: string;
    let reportId: string;

    const saveDraft = (title = 'Laudo de teste') =>
      app.inject({
        method: 'PUT',
        url: `/appointments/${appointmentId}/report`,
        headers: as(clinicToken),
        payload: { title, body: SECRET_BODY, professionalName: 'Dra. Helena' },
      });

    beforeAll(async () => {
      appointmentId = (await book(clinicToken, fixtures.patientA.patientId, slot)).json<AppointmentBody>().id;
    });

    it('saves and edits a draft, which stays invisible to the patient', async () => {
      const created = await saveDraft();
      expect(created.statusCode).toBe(200);
      reportId = created.json<ReportBody>().id;
      expect((await saveDraft('Título revisado')).json<ReportBody>().id).toBe(reportId);

      const mine = await app.inject({ url: '/me/appointments', headers: as(patientAToken) });
      const row = mine.json<MyAppointment[]>().find((a) => a.id === appointmentId);
      expect(row).toMatchObject({ hasPublishedReport: false, publishedReportId: null });
      expect(mine.body).not.toContain(SECRET_BODY);

      const draftRead = await app.inject({ url: `/me/reports/${reportId}`, headers: as(patientAToken) });
      expect(draftRead.statusCode).toBe(404);
      expect(draftRead.body).not.toContain(SECRET_BODY);
    });

    it('lets the clinic read the draft', async () => {
      const response = await app.inject({ url: `/appointments/${appointmentId}/report`, headers: as(clinicToken) });
      expect(response.json()).toMatchObject({ status: 'DRAFT', title: 'Título revisado', body: SECRET_BODY });
    });

    it('publishes, after which only the owner can open it', async () => {
      const published = await app.inject({
        method: 'POST',
        url: `/appointments/${appointmentId}/report/publish`,
        headers: as(clinicToken),
      });
      expect(published.statusCode).toBe(200);
      expect(published.json()).toMatchObject({ status: 'PUBLISHED', publishedAt: '2026-11-15T12:00:00.000Z' });

      const mine = await app.inject({ url: '/me/appointments', headers: as(patientAToken) });
      expect(mine.json<MyAppointment[]>().find((a) => a.id === appointmentId)).toMatchObject({
        hasPublishedReport: true,
        publishedReportId: reportId,
      });
      const owner = await app.inject({ url: `/me/reports/${reportId}`, headers: as(patientAToken) });
      expect(owner.statusCode).toBe(200);
      expect(owner.json()).toMatchObject({ body: SECRET_BODY, professionalName: 'Dra. Helena' });

      const intruder = await app.inject({ url: `/me/reports/${reportId}`, headers: as(patientBToken) });
      expect(intruder.statusCode).toBe(404);
      expect(intruder.body).not.toContain(SECRET_BODY);
      const theirs = await app.inject({ url: '/me/appointments', headers: as(patientBToken) });
      expect(theirs.json<MyAppointment[]>().some((a) => a.id === appointmentId)).toBe(false);
    });

    it('freezes the report and the appointment after publication (409)', async () => {
      expect((await saveDraft('Tentativa de edição')).statusCode).toBe(409);
      const cancel = await app.inject({
        method: 'POST',
        url: `/appointments/${appointmentId}/cancel`,
        headers: as(clinicToken),
      });
      expect(cancel.statusCode).toBe(409);
      expect(cancel.json<ErrorBody>().error.code).toBe('APPOINTMENT_HAS_PUBLISHED_REPORT');
    });
  });

  describe('CORS', () => {
    const preflight = (origin: string, method: string) =>
      app.inject({
        method: 'OPTIONS',
        url: '/appointments/x/report',
        headers: {
          origin,
          'access-control-request-method': method,
          'access-control-request-headers': 'authorization,content-type',
        },
      });

    it.each(['GET', 'POST', 'PUT'])('allows the web origin to call with %s (browser preflight)', async (method) => {
      const response = await preflight('http://localhost:5173', method);
      expect(response.statusCode).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      expect(response.headers['access-control-allow-methods']).toContain(method);
    });

    it('does not grant any other origin', async () => {
      const response = await preflight('https://evil.example', 'PUT');
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('single appointment', () => {
    it('returns the clinic view, 404 for unknown ids, 400 for malformed ones, 403 for patients', async () => {
      const booked = (await book(clinicToken, fixtures.patientA.patientId, '2026-11-24T13:00:00.000Z')).json<AppointmentBody>();
      const found = await app.inject({ url: `/appointments/${booked.id}`, headers: as(clinicToken) });
      expect(found.statusCode).toBe(200);
      expect(found.json()).toMatchObject({
        id: booked.id,
        patient: { fullName: 'Patient A' },
        examType: { name: 'Raio-X' },
        status: 'SCHEDULED',
        report: null,
        cancellable: true,
      });
      expect((await app.inject({ url: `/appointments/${randomUUID()}`, headers: as(clinicToken) })).statusCode).toBe(404);
      expect((await app.inject({ url: '/appointments/xyz', headers: as(clinicToken) })).statusCode).toBe(400);
      expect((await app.inject({ url: `/appointments/${booked.id}`, headers: as(patientAToken) })).statusCode).toBe(403);
    });
  });

  describe('availability', () => {
    it('lists 24 slots for a day, marking the booked one as taken', async () => {
      const response = await app.inject({ url: '/availability?date=2026-11-16', headers: as(clinicToken) });
      expect(response.statusCode).toBe(200);
      const slots = response.json<{ slotStart: string; state: string }[]>();
      expect(slots).toHaveLength(24);
      expect(slots.find((s) => s.slotStart === SLOT)?.state).toBe('TAKEN');
      expect(slots.filter((s) => s.state === 'AVAILABLE').length).toBeGreaterThan(0);
    });

    it('is clinic-only and requires a valid date', async () => {
      expect((await app.inject({ url: '/availability?date=2026-11-16', headers: as(patientAToken) })).statusCode).toBe(403);
      expect((await app.inject({ url: '/availability', headers: as(clinicToken) })).statusCode).toBe(400);
      expect((await app.inject({ url: '/availability?date=nope', headers: as(clinicToken) })).statusCode).toBe(400);
    });
  });

  describe('listing', () => {
    it('filters by clinic-local day and by patient, and returns patients and exam types', async () => {
      const byDay = await app.inject({ url: '/appointments?date=2026-11-16', headers: as(clinicToken) });
      expect(byDay.json<{ slotStart: string }[]>().map((a) => a.slotStart)).toEqual([SLOT]);
      const byPatient = await app.inject({
        url: `/appointments?patientId=${fixtures.patientB.patientId}&limit=500`,
        headers: as(clinicToken),
      });
      expect(byPatient.statusCode).toBe(200);
      expect((await app.inject({ url: '/appointments?date=16-11-2026', headers: as(clinicToken) })).statusCode).toBe(400);
      expect((await app.inject({ url: '/patients', headers: as(clinicToken) })).json<{ id: string }[]>()).toHaveLength(2);
      expect((await app.inject({ url: '/exam-types', headers: as(patientAToken) })).statusCode).toBe(200);
    });
  });

  describe('observability', () => {
    it('correlates request and use-case log lines by request id and echoes it back', async () => {
      const requestId = 'trace-id-for-test-0001';
      const response = await book(clinicToken, fixtures.patientB.patientId, '2026-11-22T13:00:00.000Z', {
        'x-request-id': requestId,
      });
      expect(response.headers['x-request-id']).toBe(requestId);

      const lines = capture.lines.filter((line) => line['requestId'] === requestId);
      expect(lines.some((line) => line['event'] === 'appointment.book' && line['outcome'] === 'ok')).toBe(true);
      expect(lines.find((line) => line['event'] === 'http.request')).toMatchObject({
        level: 'info',
        method: 'POST',
        route: '/appointments',
        status: 201,
      });
      const business = lines.find((line) => line['event'] === 'appointment.book');
      expect(business).toMatchObject({ service: 'test', env: 'test', actorRole: 'CLINIC', appointmentId: response.json<AppointmentBody>().id });
    });

    it('replaces an unsafe incoming request id', async () => {
      const response = await app.inject({ url: '/health', headers: { 'x-request-id': 'bad id with spaces\t' } });
      expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('logs rejections as warnings with the error code', async () => {
      await book(clinicToken, fixtures.patientA.patientId, SLOT);
      expect(
        capture.lines.some(
          (line) => line['event'] === 'appointment.book' && line['level'] === 'warn' && line['errorCode'] === 'SLOT_UNAVAILABLE',
        ),
      ).toBe(true);
    });

    it('never writes tokens, passwords or report text to the logs', () => {
      const everything = JSON.stringify(capture.lines);
      expect(everything).not.toContain(TEST_PASSWORD);
      expect(everything).not.toContain('wrong-password');
      expect(everything).not.toContain(SECRET_BODY);
      expect(everything).not.toContain(clinicToken);
      expect(everything).not.toContain(patientAToken);
    });
  });

  describe('login rate limiting', () => {
    it('answers 429 after too many attempts from one client', async () => {
      const limited = await buildWith({ ...APP_ENV, LOGIN_RATE_LIMIT_MAX: 3 });
      try {
        const attempt = () =>
          limited.inject({ method: 'POST', url: '/auth/login', payload: { email: 'x@test.local', password: 'nope' } });
        const statuses = [];
        for (let i = 0; i < 5; i++) statuses.push((await attempt()).statusCode);
        expect(statuses).toEqual([401, 401, 401, 429, 429]);
      } finally {
        await limited.close();
      }
    });
  });
});
