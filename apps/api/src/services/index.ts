import type { ClinicHours } from '../domain/clinic-hours.js';
import type { Repositories } from '../ports/repositories.js';
import type { Runtime } from '../ports/runtime.js';
import { AvailabilityService } from './availability-service.js';
import { ReportService } from './report-service.js';
import { SchedulingService } from './scheduling-service.js';

/** Everything a service needs besides repositories: time, ids and the clinic's opening window. */
export interface ServiceContext extends Runtime {
  hours: ClinicHours;
}

export interface Services {
  scheduling: SchedulingService;
  availability: AvailabilityService;
  reports: ReportService;
}

/** Services are bound per unit of work, so they always see the transaction's repositories. */
export function createServices(repositories: Repositories, context: ServiceContext): Services {
  return {
    scheduling: new SchedulingService(repositories, context, context.hours),
    availability: new AvailabilityService(repositories, context),
    reports: new ReportService(repositories, context),
  };
}
