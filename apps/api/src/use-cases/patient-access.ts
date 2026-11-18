import type { ClinicCalendar } from '../domain/clinic-calendar.js';
import { ReportNotFoundError } from '../domain/errors.js';
import { requireUuid } from '../domain/identifiers.js';
import { requirePatient, type Principal } from '../domain/principal.js';
import type { UnitOfWork } from '../ports/unit-of-work.js';
import {
  toPatientAppointmentDto,
  toPatientReportDto,
  type PatientAppointmentDto,
  type PatientReportDto,
} from './dtos.js';
import { clampLimit } from './pagination.js';
import type { UseCase } from './use-case.js';

export interface ListMyAppointmentsInput {
  principal: Principal;
  date?: string | undefined;
  limit?: number | undefined;
}

/** The patient id always comes from the authenticated principal, never from the request. */
export class ListMyAppointmentsUseCase
  implements UseCase<ListMyAppointmentsInput, PatientAppointmentDto[]>
{
  constructor(private readonly deps: { uow: UnitOfWork; calendar: ClinicCalendar }) {}

  async execute(input: ListMyAppointmentsInput): Promise<PatientAppointmentDto[]> {
    const { patientId } = requirePatient(input.principal);
    const range = input.date ? this.deps.calendar.dayRange(input.date) : {};
    const views = await this.deps.uow.read((repositories) =>
      repositories.appointments.searchForPatient(patientId, {
        ...range,
        limit: clampLimit(input.limit),
      }),
    );
    return views.map(toPatientAppointmentDto);
  }
}

export interface GetMyReportInput {
  principal: Principal;
  reportId: string;
}

/** Drafts and other patients' reports both surface as not found, so nothing can be probed. */
export class GetMyReportUseCase implements UseCase<GetMyReportInput, PatientReportDto> {
  constructor(private readonly deps: { uow: UnitOfWork }) {}

  async execute(input: GetMyReportInput): Promise<PatientReportDto> {
    const { patientId } = requirePatient(input.principal);
    const reportId = requireUuid(input.reportId, 'reportId');
    const view = await this.deps.uow.read((repositories) =>
      repositories.reports.findPublishedForPatient(reportId, patientId),
    );
    if (!view) throw new ReportNotFoundError();
    return toPatientReportDto(view);
  }
}
