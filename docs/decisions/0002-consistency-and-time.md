# 0002 — Consistency (ACID), time and business rules

## Rules and who enforces them

| Rule | Enforced by |
|---|---|
| One active appointment per slot; a cancelled slot can be reused | Partial unique index `appointments_active_slot_key (slot_start) WHERE status = 'SCHEDULED'`. `23505` is mapped to `SlotUnavailableError`. There is no check-then-insert, so no race window |
| Slots sit on a 30-minute grid | Domain (`SlotStart`) and CHECK `appointments_slot_on_grid` |
| No appointment in the past | Domain (`SlotStart`, strictly after `Clock.now()`); not a DB constraint because "now" moves |
| Clinic hours 07:00–19:00 (clinic-local): a slot must fit entirely inside, so the last start is 18:30 | Domain (`ClinicHours`). Configurable (`CLINIC_OPEN_HOUR`/`CLINIC_CLOSE_HOUR`), so it is deliberately **not** a DB constraint |
| Only upcoming appointments can be cancelled (a slot that already started cannot) | Domain (`Appointment.cancel`); `Appointment.isCancellable` is the same rule as a yes/no, exposed to clients as `cancellable` so the UI never re-implements it |
| One report per appointment | `UNIQUE (appointment_id)` |
| Published report is immutable | Domain, the repository (`UPDATE … WHERE status = 'DRAFT'`) and a trigger |
| `published_at` set exactly when published; `cancelled_at` set exactly when cancelled | CHECK constraints |
| Cancelled appointment gets no report; appointment with published report cannot be cancelled | Row lock, see below |
| Ids are well-formed UUIDs | Core (`requireUuid` in the use cases), so every caller is protected, not only HTTP. Malformed → `INVALID_INPUT` (400) instead of a Postgres `22P02` surfacing as a 500 |

## Cross-table race: cancel vs publish

No constraint can express the last rule, and a trigger would not help under READ COMMITTED (it would not see the other transaction's uncommitted write). So every flow that touches an appointment and its report (`cancel`, `saveDraft`, `publish`) starts with `SELECT … FOR UPDATE` on the appointment row. The two transactions serialize, and the second one re-reads committed state.

The lock order is always appointment → report, so deadlocks cannot form. Isolation stays at READ COMMITTED; the locks and constraints do the work, so serialization-failure retries are not needed.

### How this is tested (and how the tests were checked)

`test/integration/concurrency.test.ts` and `http.test.ts` run against real Postgres: 10 parallel bookings for one slot (one wins), the same over HTTP, cancel vs publish over 15 rounds (exactly one wins, never cancelled + published), and operations that must wait while another transaction holds the appointment lock.

These were mutation-checked: dropping the unique index fails the booking tests, and removing `FOR UPDATE` fails the cancel-vs-publish, publish-waits and draft-race tests. A first version of the draft-race test passed even without the lock, because a cold pool opens connections lazily and nothing actually overlapped; the pool is now warmed, and the deterministic "waits for the lock" tests were added.

## Time

- Every instant is stored as `timestamptz` and exchanged as ISO-8601 UTC.
- Input must carry an explicit `Z` or `±HH:MM` offset. A bare `2026-11-16T10:00` is rejected, because accepting it would mean the server guesses a timezone.
- The clinic timezone is `America/Sao_Paulo` (`CLINIC_TIME_ZONE`). It is used to turn a `YYYY-MM-DD` filter into a UTC range, to judge opening hours, and to generate the day's slots (`ClinicCalendar`). All of it is DST-safe and independent of the server's timezone.
- The browser only formats instants in the clinic timezone (`GET /config` provides it) and never does timezone arithmetic: slot lists come from `GET /availability`.

## Known gaps (deliberate)

- Opening hours apply to every day of the week; the PDF defines no closed days or holidays.
- `GET /availability` is advisory. Two staff members can see the same free slot; the unique index decides, and the loser gets `SLOT_UNAVAILABLE`.
- "Save and publish" in the UI is two calls (save draft, then publish). If publishing fails, the draft stays saved.
- Lists are capped (default 100, max 200) with no cursor.
- A cancelled appointment keeps its draft report (never publishable, since publishing needs a live appointment).
