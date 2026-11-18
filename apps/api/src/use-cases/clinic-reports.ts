import { requireUuid } from '../domain/identifiers.js';
import { requireClinic, type Principal } from '../domain/principal.js';
import type { ReportContentInput } from '../domain/report-content.js';
import type { UnitOfWork } from '../ports/unit-of-work.js';
import { createServices, type ServiceContext } from '../services/index.js';
import { toClinicReportDto, type ClinicReportDto } from './dtos.js';
import type { UseCase } from './use-case.js';

interface Deps {
  uow: UnitOfWork;
  context: ServiceContext;
}

export interface SaveReportDraftInput extends ReportContentInput {
  principal: Principal;
  appointmentId: string;
}

export class SaveReportDraftUseCase implements UseCase<SaveReportDraftInput, ClinicReportDto> {
  constructor(private readonly deps: Deps) {}

  async execute(input: SaveReportDraftInput): Promise<ClinicReportDto> {
    requireClinic(input.principal);
    const report = await this.deps.uow.run((repositories) =>
      createServices(repositories, this.deps.context).reports.saveDraft(
        requireUuid(input.appointmentId, 'appointmentId'),
        {
          title: input.title,
          body: input.body,
          professionalName: input.professionalName,
        },
      ),
    );
    return toClinicReportDto(report);
  }
}

export interface PublishReportInput {
  principal: Principal;
  appointmentId: string;
}

export class PublishReportUseCase implements UseCase<PublishReportInput, ClinicReportDto> {
  constructor(private readonly deps: Deps) {}

  async execute(input: PublishReportInput): Promise<ClinicReportDto> {
    requireClinic(input.principal);
    const report = await this.deps.uow.run((repositories) =>
      createServices(repositories, this.deps.context).reports.publish(
        requireUuid(input.appointmentId, 'appointmentId'),
      ),
    );
    return toClinicReportDto(report);
  }
}

export class GetAppointmentReportUseCase implements UseCase<PublishReportInput, ClinicReportDto> {
  constructor(private readonly deps: Deps) {}

  async execute(input: PublishReportInput): Promise<ClinicReportDto> {
    requireClinic(input.principal);
    const report = await this.deps.uow.read((repositories) =>
      createServices(repositories, this.deps.context).reports.getForAppointment(
        requireUuid(input.appointmentId, 'appointmentId'),
      ),
    );
    return toClinicReportDto(report);
  }
}
