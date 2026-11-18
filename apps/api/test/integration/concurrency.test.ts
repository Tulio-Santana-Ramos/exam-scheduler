import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { openContext, type TestContext } from '../support/db.js';

const SLOT = '2026-11-16T13:00:00.000Z';
const reportBody = { title: 'Laudo', body: 'Texto do laudo.', professionalName: 'Dra. Helena' };

describe('concurrency against real Postgres', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    if (ctx) await ctx.pool.end();
    ctx = await openContext();
  });

  afterAll(async () => {
    await ctx.pool.end();
  });

  const book = (slotStart: string, patientId: string) =>
    ctx.container.bookAppointment.execute({
      principal: ctx.fixtures.clinic,
      patientId,
      examTypeId: ctx.fixtures.examTypeId,
      slotStart,
    });

  it('accepts exactly one of many simultaneous bookings for the same slot', async () => {
    const { patientA, patientB } = ctx.fixtures;
    const attempts = Array.from({ length: 10 }, (_, i) =>
      book(SLOT, i % 2 === 0 ? patientA.patientId : patientB.patientId),
    );

    const results = await Promise.allSettled(attempts);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(9);
    for (const failure of rejected) {
      expect(failure.reason).toMatchObject({ code: 'SLOT_UNAVAILABLE' });
    }
    const { rows } = await ctx.pool.query("SELECT 1 FROM appointments WHERE status = 'SCHEDULED'");
    expect(rows).toHaveLength(1);
  });

  it('lets a cancelled slot be reused, then blocks it again', async () => {
    const { patientA, patientB, clinic } = ctx.fixtures;
    const first = await book(SLOT, patientA.patientId);
    await ctx.container.cancelAppointment.execute({ principal: clinic, appointmentId: first.id });

    const second = await book(SLOT, patientB.patientId);
    expect(second.status).toBe('SCHEDULED');
    await expect(book(SLOT, patientA.patientId)).rejects.toMatchObject({ code: 'SLOT_UNAVAILABLE' });
  });

  it('serializes cancel against publish: exactly one wins and the invariant holds', async () => {
    const { patientA, clinic } = ctx.fixtures;

    for (let round = 0; round < 15; round++) {
      const slot = new Date(Date.parse(SLOT) + round * 30 * 60_000).toISOString();
      const appointment = await book(slot, patientA.patientId);
      await ctx.container.saveReportDraft.execute({
        principal: clinic,
        appointmentId: appointment.id,
        ...reportBody,
      });

      const [cancelled, published] = await Promise.allSettled([
        ctx.container.cancelAppointment.execute({ principal: clinic, appointmentId: appointment.id }),
        ctx.container.publishReport.execute({ principal: clinic, appointmentId: appointment.id }),
      ]);

      expect([cancelled.status, published.status].filter((s) => s === 'fulfilled')).toHaveLength(1);
      const { rows } = await ctx.pool.query<{ status: string; report_status: string }>(
        `SELECT a.status, r.status AS report_status
           FROM appointments a JOIN reports r ON r.appointment_id = a.id WHERE a.id = $1`,
        [appointment.id],
      );
      expect(rows[0]?.status === 'CANCELLED' && rows[0]?.report_status === 'PUBLISHED').toBe(false);
    }
  });

  it.each(['saveDraft', 'cancel', 'publish'] as const)(
    '%s waits for a transaction that holds the appointment lock',
    async (operation) => {
      const { patientA, clinic } = ctx.fixtures;
      const appointment = await book('2026-11-23T13:00:00.000Z', patientA.patientId);
      const draft = { title: 'Laudo', body: 'Texto', professionalName: 'Dra. Helena' };
      if (operation === 'publish') {
        await ctx.container.saveReportDraft.execute({ principal: clinic, appointmentId: appointment.id, ...draft });
      }
      const actions = {
        saveDraft: () =>
          ctx.container.saveReportDraft.execute({ principal: clinic, appointmentId: appointment.id, ...draft }),
        cancel: () => ctx.container.cancelAppointment.execute({ principal: clinic, appointmentId: appointment.id }),
        publish: () => ctx.container.publishReport.execute({ principal: clinic, appointmentId: appointment.id }),
      };

      const holder = await ctx.pool.connect();
      await holder.query('BEGIN');
      await holder.query('SELECT 1 FROM appointments WHERE id = $1 FOR UPDATE', [appointment.id]);
      let settled = false;
      const pending = actions[operation]().finally(() => {
        settled = true;
      });

      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(settled).toBe(false);

      await holder.query('COMMIT');
      holder.release();
      await pending;
      expect(settled).toBe(true);
    },
  );

  it('serializes simultaneous first drafts for one appointment into a single report', async () => {
    const { patientA, clinic } = ctx.fixtures;
    const appointment = await book(SLOT, patientA.patientId);

    const results = await Promise.allSettled(
      Array.from({ length: 6 }, (_, i) =>
        ctx.container.saveReportDraft.execute({
          principal: clinic,
          appointmentId: appointment.id,
          ...reportBody,
          title: `Versão ${i}`,
        }),
      ),
    );

    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    const { rows } = await ctx.pool.query('SELECT 1 FROM reports WHERE appointment_id = $1', [
      appointment.id,
    ]);
    expect(rows).toHaveLength(1);
  });
});
