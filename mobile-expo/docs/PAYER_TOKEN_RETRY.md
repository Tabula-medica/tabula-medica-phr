# Payer/EHR token refresh recovery

The server starts the retry scheduler after boot-time migrations, independently
of reminder/integration initialization. It runs immediately and every minute,
processing up to 50 due `payer_token_connections` per sweep.

- Only `sync_status = 'error'` is retried. `needs_reauth` requires patient action
  and remains available through the existing connection-health API.
- Consecutive failures wait 5, 10, 20, 40, 80, … minutes, capped at 6 hours.
  Counts and due times are persisted. Older error rows without retry metadata
  become eligible 5 minutes after their last refresh attempt.
- HTTP 408/429/5xx, network timeouts, malformed responses, and server-side
  configuration/decryption errors remain retryable. Rejected credentials remain
  `needs_reauth`. Token requests (including body reads) time out after 20 seconds.
- An atomic per-row 5-minute lease prevents scheduled workers on multiple app
  instances from refreshing the same due connection. A crashed worker's lease
  expires; a local single-flight guard prevents overlapping sweeps.
- At five consecutive failures the worker emits a `logger.critical("system", …)`
  event with `event = payer_token_refresh_exhausted`. The connection's alert
  timestamp limits these events to once every 24 hours across restarts/replicas.
  It also sends a critical notification through the existing `sendOpsAlert`
  Slack path. Retries continue after escalation. Failed/skipped notification
  delivery releases the alert cooldown so a later retry can notify again.
- Successful refresh or reconnect clears the failure count, due time, and alert
  cooldown. Tokens stay encrypted at rest.

## Ops response

The existing ops channel uses `SLACK_WEBHOOK_URL` and optionally
`OPS_ALERT_SLACK_CHANNEL` (defaults to `#engineering`). Without a configured
webhook, alerts are explicitly logged as undelivered and notification is retried
on a later due sweep; logs alone are not a page. Notification requests time out
after 10 seconds. Inspect error-status connections using authorized
internal tooling, then check the upstream token service and SMART client
configuration. The alert intentionally contains no patient or connection IDs,
arbitrary source metadata, tokens, URLs, or upstream response bodies.

A `payer_token_retry_sweep_failed` critical event indicates the scheduler could
not query/process its queue (for example, missing migration or database outage).
Verify database availability and that the additive migration
`migrations/0008_payer_token_refresh_retry.sql` was applied. The boot migration
runner logs migration failures but does not block the rest of the server.
Sweep-failure notifications are rate-limited locally for 24 hours after delivery
or 5 minutes after failed delivery, since the database may be unavailable.

## Regression checks

Run `node --import tsx server/__tests__/payer-token-retry.test.ts`.
The suite uses synthetic tokens, stubbed database calls and HTTP responses, and
checks retry policy, recovery, exclusion, leases, escalation/cooldown, SQL
predicates, broker status persistence, and scheduler lifecycle.
