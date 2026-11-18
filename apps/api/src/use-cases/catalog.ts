import { requireClinic, type Principal } from '../domain/principal.js';
import type { ExamTypeSummary, PatientSummary } from '../ports/read-models.js';
import type { UnitOfWork } from '../ports/unit-of-work.js';
import { clampLimit } from './pagination.js';
import type { UseCase } from './use-case.js';

export interface ListPatientsInput {
  principal: Principal;
  limit?: number | undefined;
}

export class ListPatientsUseCase implements UseCase<ListPatientsInput, PatientSummary[]> {
  constructor(private readonly deps: { uow: UnitOfWork }) {}

  async execute(input: ListPatientsInput): Promise<PatientSummary[]> {
    requireClinic(input.principal);
    return this.deps.uow.read((repositories) =>
      repositories.patients.list(clampLimit(input.limit)),
    );
  }
}

export interface ListExamTypesInput {
  principal: Principal;
}

/** Any authenticated profile may read the catalog. */
export class ListExamTypesUseCase implements UseCase<ListExamTypesInput, ExamTypeSummary[]> {
  constructor(private readonly deps: { uow: UnitOfWork }) {}

  async execute(_input: ListExamTypesInput): Promise<ExamTypeSummary[]> {
    return this.deps.uow.read((repositories) => repositories.examTypes.list());
  }
}
