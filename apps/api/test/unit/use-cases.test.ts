import { beforeEach, describe, expect, it } from 'vitest';
import type { Principal } from '../../src/domain/principal.js';
import {
  BookAppointmentUseCase,
  CancelAppointmentUseCase,
} from '../../src/use-cases/clinic-appointments.js';
import {
  PublishReportUseCase,
  SaveReportDraftUseCase,
} from '../../src/use-cases/clinic-reports.js';
import {
  EXAM_TYPE_ID,
  FUTURE_SLOT,
  OTHER_PATIENT_ID,
  PATIENT_ID,
  UNKNOWN_ID,
  createFakes,
  type Fakes,
} from '../support/fakes.js';

const clinic: Principal = { role: 'CLINIC', userId: 'staff-1' };
const patient: Principal = { role: 'PATIENT', userId: 'user-1', patientId: PATIENT_ID };
const reportBody = { title: 'Ultrassom', body: 'Normal.', professionalName: 'Dra. Helena' };

describe('clinic use cases', () => {
  let fakes: Fakes;
  let book: BookAppointmentUseCase;
  let cancel: CancelAppointmentUseCase;
  let saveDraft: SaveReportDraftUseCase;
  let publish: PublishReportUseCase;

  const bookDefault = (slotStart = FUTURE_SLOT, patientId = PATIENT_ID) =>
    book.execute({ principal: clinic, patientId, examTypeId: EXAM_TYPE_ID, slotStart });

  beforeEach(() => {
    fakes = createFakes();
    const deps = { uow: fakes.uow, context: fakes.context };
    book = new BookAppointmentUseCase(deps);
    cancel = new CancelAppointmentUseCase(deps);
    saveDraft = new SaveReportDraftUseCase(deps);
    publish = new PublishReportUseCase(deps);
  });

  describe('booking', () => {
    it('books a future slot and returns UTC ISO output', async () => {
      const result = await bookDefault();
      expect(result).toMatchObject({ status: 'SCHEDULED', slotStart: FUTURE_SLOT, patientId: PATIENT_ID });
    });

    it('rejects a slot in the past and stores nothing', async () => {
      await expect(bookDefault('2026-11-14T13:00:00Z')).rejects.toMatchObject({ code: 'SLOT_IN_PAST' });
      expect(fakes.appointments.rows.size).toBe(0);
    });

    it('rejects a second active appointment in the same slot', async () => {
      await bookDefault();
      await expect(bookDefault(FUTURE_SLOT, OTHER_PATIENT_ID)).rejects.toMatchObject({
        code: 'SLOT_UNAVAILABLE',
      });
    });

    it('lets a cancelled slot be booked again', async () => {
      const first = await bookDefault();
      await cancel.execute({ principal: clinic, appointmentId: first.id });
      await expect(bookDefault(FUTURE_SLOT, OTHER_PATIENT_ID)).resolves.toMatchObject({
        status: 'SCHEDULED',
      });
    });

    it('rejects a slot outside the 07:00-19:00 clinic hours and stores nothing', async () => {
      await expect(bookDefault('2026-11-16T22:00:00Z')).rejects.toMatchObject({
        code: 'SLOT_OUTSIDE_OPENING_HOURS',
      });
      expect(fakes.appointments.rows.size).toBe(0);
    });

    it('rejects malformed ids before touching storage', async () => {
      await expect(bookDefault(FUTURE_SLOT, 'not-a-uuid')).rejects.toMatchObject({ code: 'INVALID_INPUT' });
      await expect(
        book.execute({ principal: clinic, patientId: PATIENT_ID, examTypeId: '1; DROP TABLE x', slotStart: FUTURE_SLOT }),
      ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    });

    it('rejects unknown patient and unknown exam type', async () => {
      await expect(bookDefault(FUTURE_SLOT, UNKNOWN_ID)).rejects.toMatchObject({ code: 'PATIENT_NOT_FOUND' });
      await expect(
        book.execute({ principal: clinic, patientId: PATIENT_ID, examTypeId: UNKNOWN_ID, slotStart: FUTURE_SLOT }),
      ).rejects.toMatchObject({ code: 'EXAM_TYPE_NOT_FOUND' });
    });

    it('is forbidden for patients, regardless of the ids they send', async () => {
      await expect(
        book.execute({ principal: patient, patientId: PATIENT_ID, examTypeId: EXAM_TYPE_ID, slotStart: FUTURE_SLOT }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });
  });

  describe('cancelling', () => {
    it('cancels an appointment', async () => {
      const booked = await bookDefault();
      const result = await cancel.execute({ principal: clinic, appointmentId: booked.id });
      expect(result.status).toBe('CANCELLED');
    });

    it('is forbidden for patients', async () => {
      const booked = await bookDefault();
      await expect(
        cancel.execute({ principal: patient, appointmentId: booked.id }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('refuses once the report is published, and keeps the appointment active', async () => {
      const booked = await bookDefault();
      await saveDraft.execute({ principal: clinic, appointmentId: booked.id, ...reportBody });
      await publish.execute({ principal: clinic, appointmentId: booked.id });

      await expect(
        cancel.execute({ principal: clinic, appointmentId: booked.id }),
      ).rejects.toMatchObject({ code: 'APPOINTMENT_HAS_PUBLISHED_REPORT' });
      expect(fakes.appointments.rows.get(booked.id)?.status).toBe('SCHEDULED');
    });

    it('refuses once the appointment has started, even with no report', async () => {
      const booked = await bookDefault();
      fakes.advanceClock(Date.parse(FUTURE_SLOT) - Date.parse('2026-11-15T12:00:00Z'));
      await expect(
        cancel.execute({ principal: clinic, appointmentId: booked.id }),
      ).rejects.toMatchObject({ code: 'APPOINTMENT_IN_PAST' });
      expect(fakes.appointments.rows.get(booked.id)?.status).toBe('SCHEDULED');
    });

    it('rejects a malformed appointment id', async () => {
      await expect(
        cancel.execute({ principal: clinic, appointmentId: 'abc' }),
      ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    });

    it('still cancels when only a draft exists', async () => {
      const booked = await bookDefault();
      await saveDraft.execute({ principal: clinic, appointmentId: booked.id, ...reportBody });
      const result = await cancel.execute({ principal: clinic, appointmentId: booked.id });
      expect(result.status).toBe('CANCELLED');
    });
  });

  describe('reports', () => {
    it('saves a draft, then edits it in place (one report per appointment)', async () => {
      const booked = await bookDefault();
      const first = await saveDraft.execute({ principal: clinic, appointmentId: booked.id, ...reportBody });
      const second = await saveDraft.execute({
        principal: clinic,
        appointmentId: booked.id,
        ...reportBody,
        title: 'Revisado',
      });
      expect(second.id).toBe(first.id);
      expect(second).toMatchObject({ title: 'Revisado', status: 'DRAFT', publishedAt: null });
      expect(fakes.reports.rows.size).toBe(1);
    });

    it('publishes and records the publication date from the clock', async () => {
      const booked = await bookDefault();
      await saveDraft.execute({ principal: clinic, appointmentId: booked.id, ...reportBody });
      fakes.advanceClock(60_000);
      const published = await publish.execute({ principal: clinic, appointmentId: booked.id });
      expect(published).toMatchObject({ status: 'PUBLISHED', publishedAt: '2026-11-15T12:01:00.000Z' });
    });

    it('refuses edits after publication', async () => {
      const booked = await bookDefault();
      await saveDraft.execute({ principal: clinic, appointmentId: booked.id, ...reportBody });
      await publish.execute({ principal: clinic, appointmentId: booked.id });
      await expect(
        saveDraft.execute({ principal: clinic, appointmentId: booked.id, ...reportBody }),
      ).rejects.toMatchObject({ code: 'REPORT_ALREADY_PUBLISHED' });
    });

    it('refuses reports on cancelled appointments', async () => {
      const booked = await bookDefault();
      await cancel.execute({ principal: clinic, appointmentId: booked.id });
      await expect(
        saveDraft.execute({ principal: clinic, appointmentId: booked.id, ...reportBody }),
      ).rejects.toMatchObject({ code: 'APPOINTMENT_CANCELLED' });
    });

    it('cannot publish without a draft', async () => {
      const booked = await bookDefault();
      await expect(
        publish.execute({ principal: clinic, appointmentId: booked.id }),
      ).rejects.toMatchObject({ code: 'REPORT_NOT_FOUND' });
    });

    it('is forbidden for patients', async () => {
      const booked = await bookDefault();
      await expect(
        saveDraft.execute({ principal: patient, appointmentId: booked.id, ...reportBody }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(
        publish.execute({ principal: patient, appointmentId: booked.id }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });
  });
});
