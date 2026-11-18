import {
  AppointmentAlreadyCancelledError,
  AppointmentCancelledError,
  AppointmentHasPublishedReportError,
  AppointmentInPastError,
} from './errors.js';
import type { Report, ReportStatus } from './report.js';
import type { SlotStart } from './slot-start.js';

export type AppointmentStatus = 'SCHEDULED' | 'CANCELLED';

export interface AppointmentProps {
  id: string;
  patientId: string;
  examTypeId: string;
  slotStart: Date;
  status: AppointmentStatus;
  createdAt: Date;
  cancelledAt: Date | null;
}

export class Appointment {
  private constructor(private readonly props: AppointmentProps) {}

  static schedule(
    input: { id: string; patientId: string; examTypeId: string; slot: SlotStart },
    now: Date,
  ): Appointment {
    return new Appointment({
      id: input.id,
      patientId: input.patientId,
      examTypeId: input.examTypeId,
      slotStart: input.slot.instant,
      status: 'SCHEDULED',
      createdAt: now,
      cancelledAt: null,
    });
  }

  static rehydrate(props: AppointmentProps): Appointment {
    return new Appointment(props);
  }

  get id(): string {
    return this.props.id;
  }
  get patientId(): string {
    return this.props.patientId;
  }
  get examTypeId(): string {
    return this.props.examTypeId;
  }
  get slotStart(): Date {
    return this.props.slotStart;
  }
  get status(): AppointmentStatus {
    return this.props.status;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get cancelledAt(): Date | null {
    return this.props.cancelledAt;
  }
  get isCancelled(): boolean {
    return this.props.status === 'CANCELLED';
  }

  /** Same rule as `cancel`, as a yes/no for read models that have no entity. */
  static isCancellable(
    view: { status: AppointmentStatus; slotStart: Date; reportStatus: ReportStatus | null },
    now: Date,
  ): boolean {
    return (
      view.status === 'SCHEDULED' &&
      view.slotStart.getTime() > now.getTime() &&
      view.reportStatus !== 'PUBLISHED'
    );
  }

  /** Only upcoming appointments can be cancelled. A draft does not block it; a published report does. */
  cancel(report: Report | null, now: Date): Appointment {
    if (this.isCancelled) throw new AppointmentAlreadyCancelledError();
    if (this.props.slotStart.getTime() <= now.getTime()) throw new AppointmentInPastError();
    if (report?.isPublished) throw new AppointmentHasPublishedReportError();
    return new Appointment({ ...this.props, status: 'CANCELLED', cancelledAt: now });
  }

  assertAcceptsReport(): void {
    if (this.isCancelled) throw new AppointmentCancelledError();
  }
}
