# 0001 — Layering: Controller → UseCase → Service → Repository

## Decision

Dependencies point one way, toward the domain. Each layer has one job.

| Layer | Owns | Must not |
|---|---|---|
| Domain (`src/domain`) | Entities and value objects with their invariants: 30-min grid, state transitions, "published is immutable" | Know about SQL, HTTP or the clock (time is passed in) |
| Repository (`src/ports/repositories.ts`, `src/infra/pg`) | Persistence; interfaces live in `ports`, Postgres adapters in `infra` | Hold business rules; translating DB errors into domain errors is its only logic |
| Service (`src/services`) | Reusable business rules over repositories (`SchedulingService`, `ReportService`) | Open transactions or know who the caller is |
| UseCase (`src/use-cases`) | One operation: authorize the principal, open one unit of work, call services, map to DTOs | Contain business rules |
| Controller (`src/http/controllers`) | Parse the request shape (zod), verify the bearer token into a `Principal`, call one use case; `DomainError.code` is mapped to an HTTP status in one exhaustive table (`src/http/error-handler.ts`) | Touch repositories or services |

## Why

- A use case is the transaction boundary (`UnitOfWork.run`); services are rebuilt per unit of work (`createServices`) so they always use the transaction's repositories.
- Cross-cutting concerns wrap use cases rather than leaking into them: logging is a decorator (`withLogging`, see ADR 0003).
- Authorization lives in use cases (`requireClinic` / `requirePatient`), and the patient id comes from the authenticated principal, never from the request. A new controller cannot forget the check, and ids are validated in the core too (`requireUuid`), not only at the HTTP edge.
- Patient-facing read models are separate types (`PatientAppointmentView`, `PatientReportView`). They have no field that can carry a draft, so a shared serializer cannot leak one.

## Trade-offs

- Read-only use cases (lists, single lookups, `GetMyReport`) call repositories directly and skip the service layer on purpose: there is no rule to reuse, and a pass-through service would only add indirection. The first rule that lands in a read (say, a visibility filter) moves into a service.
- `AuthenticationService` is the one service that is long-lived rather than built per unit of work, because it caches the decoy hash that keeps unknown-email logins as slow as wrong-password ones.
- Services are thin today. They earn their place as soon as a second flow (batch import, reschedule) needs the same rules.
- `UnitOfWork.read` runs single statements without a transaction. Anything that must see a consistent multi-statement snapshot has to use `run`.
