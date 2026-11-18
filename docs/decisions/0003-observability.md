# 0003 — Logging and observability (Grafana-ready)

## Decision

Structured JSON logs (pino), one line per event, on stdout (`LOG_FORMAT=pretty` swaps in a readable form for local use; the compose stack does). Optionally also pushed straight to **Grafana Cloud Loki** with `pino-loki` when `LOKI_URL`, `LOKI_USER` and `LOKI_API_KEY` are set. Either path works on a free host: stdout suits a platform log drain or Grafana Alloy; the direct push suits hosts that cannot run a sidecar.

## What gets logged

- **Every use case**, by decoration (`withLogging` in `src/use-cases/logged-use-case.ts`), so no operation can forget it: `event` (stable name such as `appointment.book`), `outcome` (`ok` / `rejected` / `failed`), `errorCode`, `durationMs`, `actorId`, `actorRole` and the relevant ids.
  - `info` for successful writes and report views; `debug` for listings.
  - `warn` for expected rejections (a taken slot, a forbidden call, bad credentials); `error` with the stack for anything unexpected.
- **Every HTTP request**, one self-contained `http.request` line: `method`, `route` (the pattern, such as `/appointments/:id`, never the raw URL), `status`, `durationMs`, `requestId`. `warn` for 4xx, `error` for 5xx. `/health` and CORS preflights are excluded; Fastify's own incoming/completed lines are disabled.
- **Correlation:** the `requestId` (taken from a safe incoming `x-request-id`, or generated) is on the request lines and, through `AsyncLocalStorage`, on the use-case lines of the same request. It is echoed back as a response header.
- **Lifecycle:** `server.started`, `server.shutdown`, pool idle-client errors.

## What is never logged

Passwords, tokens (the `authorization` header is redacted), emails on login, and report text. Test `never writes tokens, passwords or report text to the logs` asserts it.

## Grafana setup (Grafana Cloud free)

1. In Grafana Cloud open **Connections → Loki** (or the Loki details of your stack) and note the push URL host, the user (instance id) and create a token with the `logs:write` scope.
2. Set on the API: `LOKI_URL=https://logs-prod-XXX.grafana.net`, `LOKI_USER=<instance id>`, `LOKI_API_KEY=<token>`.
3. Labels are only `service`, `env`, `level`. Everything else stays in the JSON body (labels must stay low-cardinality). Query it with `| json`:

```logql
{service="exam-scheduler-api"} | json | event="appointment.book" | outcome="rejected"
{service="exam-scheduler-api", level="error"}
sum by (errorCode) (count_over_time({service="exam-scheduler-api"} | json | outcome="rejected" [5m]))
{service="exam-scheduler-api"} | json | requestId="<id from the x-request-id header>"
```

Useful alerts: any `level="error"`, a spike of `auth.login` rejections (credential stuffing), a sustained rate of `SLOT_UNAVAILABLE` (contention), `durationMs` p95 per event.

## Verified vs not verified

Verified: JSON output, request/use-case correlation, redaction, the transport pushing batches with basic auth, correct `level` labels and nanosecond timestamps to a local stand-in Loki (pino-loki needs `replaceTimestamp` and `propsToLabels: ['level']` because we log ISO time and string levels), and the API continuing to serve and shut down cleanly when Loki is unreachable.
**Not verified:** a push to a real Grafana Cloud stack (no account was used). Check current free-tier limits and retention on Grafana's pricing page; they change.

## Trade-offs

- Logging is a decorator at the use-case boundary, so services and repositories stay silent. A failure deep in a repository is still logged (with its stack) by the use case that triggered it.
- Metrics and tracing are not set up. Durations in logs give per-event latency in Loki; real metrics would be the next step if needed.
