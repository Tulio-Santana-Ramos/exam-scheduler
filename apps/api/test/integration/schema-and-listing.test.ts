import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openContext, type TestContext } from '../support/db.js';

describe('schema guarantees', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await openContext();
  });

  afterAll(async () => {
    await ctx.pool.end();
  });

  it('rejects an off-grid slot even when written around the application', async () => {
    await expect(
      ctx.pool.query(
        `INSERT INTO appointments (id, patient_id, exam_type_id, slot_start, status, created_at)
         VALUES ($1, $2, $3, '2026-11-16T13:10:00Z', 'SCHEDULED', now())`,
        [randomUUID(), ctx.fixtures.patientA.patientId, ctx.fixtures.examTypeId],
      ),
    ).rejects.toMatchObject({ constraint: 'appointments_slot_on_grid' });
  });

  it('keeps published reports immutable at the database level', async () => {
    const { clinic, patientA, examTypeId } = ctx.fixtures;
    const booked = await ctx.container.bookAppointment.execute({
      principal: clinic,
      patientId: patientA.patientId,
      examTypeId,
      slotStart: '2026-11-17T13:00:00.000Z',
    });
    const report = await ctx.container.saveReportDraft.execute({
      principal: clinic,
      appointmentId: booked.id,
      title: 'T',
      body: 'B',
      professionalName: 'P',
    });
    await ctx.container.publishReport.execute({ principal: clinic, appointmentId: booked.id });

    await expect(
      ctx.pool.query("UPDATE reports SET body = 'tampered' WHERE id = $1", [report.id]),
    ).rejects.toMatchObject({ message: 'published reports are immutable' });
  });
});

describe('clinic listing', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await openContext();
    const { clinic, patientA, patientB, examTypeId } = ctx.fixtures;
    const book = (patientId: string, slotStart: string) =>
      ctx.container.bookAppointment.execute({ principal: clinic, patientId, examTypeId, slotStart });

    await book(patientA.patientId, '2026-11-15T21:30:00.000Z'); // 15/11 18:30 in Sao Paulo, last slot of the day
    await book(patientB.patientId, '2026-11-16T12:00:00.000Z'); // 16/11 09:00 in Sao Paulo
    const cancelled = await book(patientA.patientId, '2026-11-16T12:30:00.000Z');
    await ctx.container.cancelAppointment.execute({ principal: clinic, appointmentId: cancelled.id });
  });

  afterAll(async () => {
    await ctx.pool.end();
  });

  it('filters by clinic-local calendar day, not by UTC day', async () => {
    const { clinic } = ctx.fixtures;
    const nov15 = await ctx.container.listClinicAppointments.execute({ principal: clinic, date: '2026-11-15' });
    const nov16 = await ctx.container.listClinicAppointments.execute({ principal: clinic, date: '2026-11-16' });

    expect(nov15.map((a) => a.slotStart)).toEqual(['2026-11-15T21:30:00.000Z']);
    expect(nov16.map((a) => a.slotStart)).toEqual([
      '2026-11-16T12:00:00.000Z',
      '2026-11-16T12:30:00.000Z',
    ]);
  });

  it('filters by patient and keeps cancelled appointments visible with their status', async () => {
    const { clinic, patientA } = ctx.fixtures;
    const result = await ctx.container.listClinicAppointments.execute({
      principal: clinic,
      patientId: patientA.patientId,
    });
    expect(result.map((a) => a.status)).toEqual(['SCHEDULED', 'CANCELLED']);
    expect(result[0]?.patient.fullName).toBe('Patient A');
  });

  it('combines date and patient filters and honours the limit', async () => {
    const { clinic, patientA } = ctx.fixtures;
    const combined = await ctx.container.listClinicAppointments.execute({
      principal: clinic,
      date: '2026-11-16',
      patientId: patientA.patientId,
    });
    expect(combined).toHaveLength(1);

    const limited = await ctx.container.listClinicAppointments.execute({ principal: clinic, limit: 1 });
    expect(limited).toHaveLength(1);
  });

  it('lists patients and exam types for the booking form', async () => {
    const { clinic } = ctx.fixtures;
    const patients = await ctx.container.listPatients.execute({ principal: clinic });
    expect(patients.map((p) => p.fullName)).toEqual(['Patient A', 'Patient B']);
    const examTypes = await ctx.container.listExamTypes.execute({ principal: clinic });
    expect(examTypes).toHaveLength(1);
  });
});
