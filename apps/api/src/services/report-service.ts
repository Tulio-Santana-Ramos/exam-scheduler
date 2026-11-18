import { AppointmentNotFoundError, ReportNotFoundError } from '../domain/errors.js';
import { Report } from '../domain/report.js';
import { ReportContent, type ReportContentInput } from '../domain/report-content.js';
import type { Appointment } from '../domain/appointment.js';
import type { Repositories } from '../ports/repositories.js';
import type { Runtime } from '../ports/runtime.js';

export class ReportService {
  constructor(
    private readonly repositories: Repositories,
    private readonly runtime: Runtime,
  ) {}

  /** Creates the draft or edits the existing one; published reports are immutable. */
  async saveDraft(appointmentId: string, input: ReportContentInput): Promise<Report> {
    const content = ReportContent.create(input);
    const appointment = await this.lockAppointment(appointmentId);
    appointment.assertAcceptsReport();

    const now = this.runtime.clock.now();
    const existing = await this.repositories.reports.findByAppointmentId(appointmentId);
    if (!existing) {
      const draft = Report.draft(this.runtime.ids.next(), appointmentId, content, now);
      await this.repositories.reports.insert(draft);
      return draft;
    }

    const edited = existing.withContent(content, now);
    await this.repositories.reports.update(edited);
    return edited;
  }

  async publish(appointmentId: string): Promise<Report> {
    const appointment = await this.lockAppointment(appointmentId);
    appointment.assertAcceptsReport();

    const report = await this.repositories.reports.findByAppointmentId(appointmentId);
    if (!report) throw new ReportNotFoundError();

    const published = report.publish(this.runtime.clock.now());
    await this.repositories.reports.update(published);
    return published;
  }

  async getForAppointment(appointmentId: string): Promise<Report> {
    const appointment = await this.repositories.appointments.findById(appointmentId);
    if (!appointment) throw new AppointmentNotFoundError();

    const report = await this.repositories.reports.findByAppointmentId(appointmentId);
    if (!report) throw new ReportNotFoundError();
    return report;
  }

  private async lockAppointment(appointmentId: string): Promise<Appointment> {
    const appointment = await this.repositories.appointments.findByIdForUpdate(appointmentId);
    if (!appointment) throw new AppointmentNotFoundError();
    return appointment;
  }
}
