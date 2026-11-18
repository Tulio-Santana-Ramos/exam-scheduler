export type DomainErrorCode =
  | 'INVALID_INPUT'
  | 'INVALID_CREDENTIALS'
  | 'FORBIDDEN'
  | 'SLOT_IN_PAST'
  | 'SLOT_MISALIGNED'
  | 'SLOT_OUTSIDE_OPENING_HOURS'
  | 'SLOT_UNAVAILABLE'
  | 'APPOINTMENT_IN_PAST'
  | 'PATIENT_NOT_FOUND'
  | 'EXAM_TYPE_NOT_FOUND'
  | 'APPOINTMENT_NOT_FOUND'
  | 'APPOINTMENT_ALREADY_CANCELLED'
  | 'APPOINTMENT_HAS_PUBLISHED_REPORT'
  | 'APPOINTMENT_CANCELLED'
  | 'REPORT_NOT_FOUND'
  | 'REPORT_ALREADY_PUBLISHED';

export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidInputError extends DomainError {
  constructor(message: string) {
    super('INVALID_INPUT', message);
  }
}

export class InvalidCredentialsError extends DomainError {
  constructor() {
    super('INVALID_CREDENTIALS', 'Invalid email or password');
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Action not allowed for this profile') {
    super('FORBIDDEN', message);
  }
}

export class SlotInPastError extends DomainError {
  constructor() {
    super('SLOT_IN_PAST', 'Appointments cannot be scheduled in the past');
  }
}

export class SlotMisalignedError extends DomainError {
  constructor() {
    super('SLOT_MISALIGNED', 'Slots start on the hour or half hour (30-minute grid)');
  }
}

export class SlotOutsideOpeningHoursError extends DomainError {
  constructor(opens: string, closes: string) {
    super(
      'SLOT_OUTSIDE_OPENING_HOURS',
      `The clinic is open from ${opens} to ${closes}; a slot must fit entirely inside that window`,
    );
  }
}

export class AppointmentInPastError extends DomainError {
  constructor() {
    super('APPOINTMENT_IN_PAST', 'Appointments that have already started cannot be cancelled');
  }
}

export class SlotUnavailableError extends DomainError {
  constructor() {
    super('SLOT_UNAVAILABLE', 'There is already an active appointment in this slot');
  }
}

export class PatientNotFoundError extends DomainError {
  constructor() {
    super('PATIENT_NOT_FOUND', 'Patient not found');
  }
}

export class ExamTypeNotFoundError extends DomainError {
  constructor() {
    super('EXAM_TYPE_NOT_FOUND', 'Exam type not found');
  }
}

export class AppointmentNotFoundError extends DomainError {
  constructor() {
    super('APPOINTMENT_NOT_FOUND', 'Appointment not found');
  }
}

export class AppointmentAlreadyCancelledError extends DomainError {
  constructor() {
    super('APPOINTMENT_ALREADY_CANCELLED', 'Appointment is already cancelled');
  }
}

export class AppointmentHasPublishedReportError extends DomainError {
  constructor() {
    super(
      'APPOINTMENT_HAS_PUBLISHED_REPORT',
      'Appointments with a published report cannot be cancelled',
    );
  }
}

export class AppointmentCancelledError extends DomainError {
  constructor() {
    super('APPOINTMENT_CANCELLED', 'Cancelled appointments cannot receive reports');
  }
}

export class ReportNotFoundError extends DomainError {
  constructor() {
    super('REPORT_NOT_FOUND', 'Report not found');
  }
}

export class ReportAlreadyPublishedError extends DomainError {
  constructor() {
    super('REPORT_ALREADY_PUBLISHED', 'Published reports cannot be changed');
  }
}
