import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openContext, type TestContext } from '../support/db.js';

const DRAFT_SECRET = 'CONTEUDO-SIGILOSO-DO-RASCUNHO';

describe('patient access to appointments and reports', () => {
  let ctx: TestContext;
  let appointmentId: string;

  beforeAll(async () => {
    ctx = await openContext();
    const booked = await ctx.container.bookAppointment.execute({
      principal: ctx.fixtures.clinic,
      patientId: ctx.fixtures.patientA.patientId,
      examTypeId: ctx.fixtures.examTypeId,
      slotStart: '2026-11-16T13:00:00.000Z',
    });
    appointmentId = booked.id;
  });

  afterAll(async () => {
    await ctx.pool.end();
  });

  const saveDraft = (title = 'Laudo') =>
    ctx.container.saveReportDraft.execute({
      principal: ctx.fixtures.clinic,
      appointmentId,
      title,
      body: DRAFT_SECRET,
      professionalName: 'Dra. Helena',
    });

  const draftReportId = async (): Promise<string> => (await saveDraft()).id;

  it('hides drafts: no content in the list and not found by id', async () => {
    const reportId = await draftReportId();
    const { patientA } = ctx.fixtures;

    const list = await ctx.container.listMyAppointments.execute({ principal: patientA });
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ hasPublishedReport: false, publishedReportId: null });
    expect(JSON.stringify(list)).not.toContain(DRAFT_SECRET);

    await expect(
      ctx.container.getMyReport.execute({ principal: patientA, reportId }),
    ).rejects.toMatchObject({ code: 'REPORT_NOT_FOUND' });
  });

  it('denies another patient access to a published report, indistinguishably from a missing one', async () => {
    const reportId = await draftReportId();
    await ctx.container.publishReport.execute({ principal: ctx.fixtures.clinic, appointmentId });
    const { patientB } = ctx.fixtures;

    await expect(
      ctx.container.getMyReport.execute({ principal: patientB, reportId }),
    ).rejects.toMatchObject({ code: 'REPORT_NOT_FOUND' });
    await expect(
      ctx.container.getMyReport.execute({
        principal: patientB,
        reportId: '00000000-0000-4000-8000-00000000ffff',
      }),
    ).rejects.toMatchObject({ code: 'REPORT_NOT_FOUND' });
    await expect(ctx.container.listMyAppointments.execute({ principal: patientB })).resolves.toEqual([]);
  });

  it('exposes the published report to the right patient only', async () => {
    const { patientA, clinic } = ctx.fixtures;
    const stored = await ctx.container.getAppointmentReport.execute({ principal: clinic, appointmentId });
    expect(stored.status).toBe('PUBLISHED');

    const list = await ctx.container.listMyAppointments.execute({ principal: patientA });
    expect(list[0]).toMatchObject({ hasPublishedReport: true, publishedReportId: stored.id });

    const report = await ctx.container.getMyReport.execute({ principal: patientA, reportId: stored.id });
    expect(report).toMatchObject({
      id: stored.id,
      appointmentId,
      body: DRAFT_SECRET,
      professionalName: 'Dra. Helena',
      publishedAt: '2026-11-15T12:00:00.000Z',
    });
  });

  it('forbids clinic staff on patient endpoints and patients on clinic endpoints', async () => {
    const { clinic, patientA } = ctx.fixtures;
    await expect(ctx.container.listMyAppointments.execute({ principal: clinic })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(
      ctx.container.getAppointmentReport.execute({ principal: patientA, appointmentId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      ctx.container.listClinicAppointments.execute({ principal: patientA }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
