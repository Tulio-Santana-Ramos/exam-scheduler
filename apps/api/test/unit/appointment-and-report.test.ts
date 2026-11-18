import { describe, expect, it } from 'vitest';
import { Appointment } from '../../src/domain/appointment.js';
import { Report } from '../../src/domain/report.js';
import { ReportContent } from '../../src/domain/report-content.js';
import { SlotStart } from '../../src/domain/slot-start.js';
import { CLINIC_HOURS } from '../support/fakes.js';

const NOW = new Date('2026-11-15T12:00:00.000Z');
const LATER = new Date('2026-11-15T13:00:00.000Z');
const AFTER_SLOT = new Date('2026-11-16T13:00:00.000Z');

const content = ReportContent.create({
  title: 'Tórax PA',
  body: 'Sem alterações.',
  professionalName: 'Dra. Helena',
});

const scheduled = () =>
  Appointment.schedule(
    {
      id: 'a1',
      patientId: 'p1',
      examTypeId: 'e1',
      slot: SlotStart.fromIso('2026-11-16T13:00:00Z', NOW, CLINIC_HOURS),
    },
    NOW,
  );

describe('Appointment', () => {
  it('cancels and records when', () => {
    const cancelled = scheduled().cancel(null, LATER);
    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.cancelledAt).toEqual(LATER);
  });

  it('cannot be cancelled once its slot has started', () => {
    expect(() => scheduled().cancel(null, AFTER_SLOT)).toThrowError(
      expect.objectContaining({ code: 'APPOINTMENT_IN_PAST' }),
    );
    expect(() => scheduled().cancel(null, new Date('2026-11-16T14:30:00.000Z'))).toThrowError(
      expect.objectContaining({ code: 'APPOINTMENT_IN_PAST' }),
    );
  });

  it('can still be cancelled one millisecond before the slot starts', () => {
    const almost = new Date(AFTER_SLOT.getTime() - 1);
    expect(scheduled().cancel(null, almost).status).toBe('CANCELLED');
  });

  it('rejects cancelling twice', () => {
    const cancelled = scheduled().cancel(null, LATER);
    expect(() => cancelled.cancel(null, LATER)).toThrowError(
      expect.objectContaining({ code: 'APPOINTMENT_ALREADY_CANCELLED' }),
    );
  });

  it('can be cancelled while its report is only a draft', () => {
    const draft = Report.draft('r1', 'a1', content, NOW);
    expect(scheduled().cancel(draft, LATER).status).toBe('CANCELLED');
  });

  it('cannot be cancelled once its report is published', () => {
    const published = Report.draft('r1', 'a1', content, NOW).publish(LATER);
    expect(() => scheduled().cancel(published, LATER)).toThrowError(
      expect.objectContaining({ code: 'APPOINTMENT_HAS_PUBLISHED_REPORT' }),
    );
  });

  it('refuses reports once cancelled', () => {
    expect(() => scheduled().cancel(null, LATER).assertAcceptsReport()).toThrowError(
      expect.objectContaining({ code: 'APPOINTMENT_CANCELLED' }),
    );
  });
});

describe('Report', () => {
  it('starts as an unpublished draft', () => {
    const draft = Report.draft('r1', 'a1', content, NOW);
    expect(draft.status).toBe('DRAFT');
    expect(draft.publishedAt).toBeNull();
  });

  it('allows editing a draft', () => {
    const edited = Report.draft('r1', 'a1', content, NOW).withContent(
      ReportContent.create({ title: 'Novo', body: 'Texto', professionalName: 'Dr. João' }),
      LATER,
    );
    expect(edited.content.title).toBe('Novo');
    expect(edited.updatedAt).toEqual(LATER);
  });

  it('records the publication instant', () => {
    const published = Report.draft('r1', 'a1', content, NOW).publish(LATER);
    expect(published.status).toBe('PUBLISHED');
    expect(published.publishedAt).toEqual(LATER);
  });

  it('is immutable once published', () => {
    const published = Report.draft('r1', 'a1', content, NOW).publish(LATER);
    expect(() => published.withContent(content, LATER)).toThrowError(
      expect.objectContaining({ code: 'REPORT_ALREADY_PUBLISHED' }),
    );
    expect(() => published.publish(LATER)).toThrowError(
      expect.objectContaining({ code: 'REPORT_ALREADY_PUBLISHED' }),
    );
  });
});

describe('ReportContent', () => {
  it('trims and requires every field', () => {
    expect(ReportContent.create({ title: ' A ', body: ' B ', professionalName: ' C ' }).title).toBe('A');
    expect(() => ReportContent.create({ title: '  ', body: 'b', professionalName: 'c' })).toThrowError(
      expect.objectContaining({ code: 'INVALID_INPUT' }),
    );
  });

  it('enforces maximum lengths', () => {
    expect(() =>
      ReportContent.create({ title: 'x'.repeat(201), body: 'b', professionalName: 'c' }),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_INPUT' }));
  });
});

describe('Appointment.isCancellable', () => {
  const slotStart = new Date('2026-11-16T13:00:00.000Z');
  const upcoming = LATER;

  it.each([
    ['upcoming, no report', 'SCHEDULED', null, upcoming, true],
    ['upcoming, draft report', 'SCHEDULED', 'DRAFT', upcoming, true],
    ['upcoming, published report', 'SCHEDULED', 'PUBLISHED', upcoming, false],
    ['already cancelled', 'CANCELLED', null, upcoming, false],
    ['slot started', 'SCHEDULED', null, AFTER_SLOT, false],
  ] as const)('%s -> %s', (_label, status, reportStatus, now, expected) => {
    expect(Appointment.isCancellable({ status, slotStart, reportStatus }, now)).toBe(expected);
  });

  it('agrees with cancel() on every case above', () => {
    const draft = Report.draft('r1', 'a1', content, NOW);
    const published = draft.publish(LATER);
    const attempt = (report: Report | null, now: Date) => {
      try {
        scheduled().cancel(report, now);
        return true;
      } catch {
        return false;
      }
    };
    expect(attempt(null, upcoming)).toBe(true);
    expect(attempt(draft, upcoming)).toBe(true);
    expect(attempt(published, upcoming)).toBe(false);
    expect(attempt(null, AFTER_SLOT)).toBe(false);
  });
});
