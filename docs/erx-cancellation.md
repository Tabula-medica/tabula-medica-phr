# eRx cancellation & auto-discontinuation

Sends NCPDP SCRIPT **CancelRx** messages to a pharmacy so a prescription that
should no longer be filled is stopped before it is dispensed.

Three workflows feed one pipeline:

| Trigger | Fires when | Approval |
| --- | --- | --- |
| Dose change | A medication's dose is edited via `PATCH /api/medication-management/medications/:id` | Prescriber, unless a clinician made the edit |
| Manual cancellation | `POST /api/erx-cancellation/requests` | Prescriber, unless a clinician made the request |
| Patient demise | `POST /api/erx-cancellation/mortality` with an authoritative source | Auto-approved; batch-cancels every open prescription |

## Layout

| File | Role |
| --- | --- |
| `server/services/erx-script-messages.ts` | Message construction, dose comparison, response interpretation, waste estimation. No DB or network imports — this is the unit-tested core. |
| `server/services/erx-transport.ts` | Outbound delivery. `SurescriptsHttpTransport` when credentials exist, `QueuedErxTransport` otherwise. |
| `server/services/erx-cancellation-service.ts` | Lifecycle orchestration and persistence. |
| `server/erx-cancellation-routes.ts` | REST API, mounted at `/api/erx-cancellation`. |
| `client/src/pages/erx-cancellations.tsx` | Patient view at `/erx-cancellations`. |
| `tests/erx-cancellation.spec.ts` | Hermetic tests for the core logic. |

Tables: `erx_cancellation_requests`, `erx_cancellation_events`,
`patient_mortality_records`. All PHI columns are registered in
`server/security/phi-column-map.ts` and encrypted at rest through `phiDb`.

## Configuration

The gateway is off until every variable is set. With any of them missing, the
`QueuedErxTransport` takes over and requests sit in `queued` — they are **not**
delivered, and `GET /api/erx-cancellation/admin/queue-health` says so.

| Variable | Purpose |
| --- | --- |
| `SURESCRIPTS_ERX_ENDPOINT` | Gateway URL that accepts the CancelRx payload |
| `SURESCRIPTS_ACCOUNT_ID` | Account identifier sent as `X-Account-Id` |
| `SURESCRIPTS_API_KEY` | Bearer credential |
| `SURESCRIPTS_SENDER_ID` | Our SCRIPT `From` identifier |
| `SURESCRIPTS_SENDER_NAME` | Optional display name |
| `SURESCRIPTS_SCRIPT_VERSION` | Optional SCRIPT version override (default `2017071`) |
| `SURESCRIPTS_TIMEOUT_MS` | Optional request timeout (default 20s) |
| `ERX_WEBHOOK_SECRET` | Shared secret for the inbound `CancelRxResponse` webhook. Without it the webhook returns 503 rather than accepting unauthenticated traffic. |

## Endpoints

```
GET    /api/erx-cancellation/metadata
GET    /api/erx-cancellation/requests            ?status= &triggerType= &limit=
POST   /api/erx-cancellation/requests
GET    /api/erx-cancellation/requests/:id        (includes the event trail)
POST   /api/erx-cancellation/requests/:id/approve    (prescriber only)
POST   /api/erx-cancellation/requests/:id/transmit
POST   /api/erx-cancellation/requests/:id/withdraw
GET    /api/erx-cancellation/savings
GET    /api/erx-cancellation/mortality
POST   /api/erx-cancellation/mortality
POST   /api/erx-cancellation/mortality/verify        (prescriber only)
POST   /api/erx-cancellation/mortality/rescind
POST   /api/erx-cancellation/webhooks/cancel-rx-response   (shared-secret auth)
GET    /api/erx-cancellation/admin/queue-health      (admin only)
POST   /api/erx-cancellation/admin/process-queue     (admin only)
```

## Design decisions worth keeping

**A cosmetic dose edit must not reach a pharmacy.** `assessDoseChange` normalises
whitespace, case and mass units, so `10mg → 10 MG` and `1000 mcg → 1 mg` are
both non-events. A spurious CancelRx disrupts a pharmacy as much as a missed one.
A text change with no readable magnitude (`"as directed" → "taper as tolerated"`)
is flagged as material so a human decides rather than the parser.

**Roles come from the session, never the request body.** `initiatorRole` is not
an accepted field: a caller able to name their own role could claim `prescriber`
and skip the approval step. The same applies to the mortality `source` — a
patient or caregiver session claiming `clinician_attested` is downgraded to
`family_reported` and the report is held for verification instead of cancelling
anything.

**Death reports are reversible.** `POST /mortality/rescind` withdraws every
cancellation in the batch that has not yet been transmitted and reports back the
ones that already reached a pharmacy, which can only be resolved by phone. This
is deliberately *not* gated behind a clinician role: whoever notices the error
must be able to stop it.

**The no-gateway path does not lie.** `QueuedErxTransport` reports `queued`, not
`acknowledged`. A simulated success would tell a prescriber a prescription had
been cancelled when the pharmacy had never heard of it. Queued requests retry
with exponential backoff (30s → 6h ceiling) and go out once a gateway is
configured.

**Savings are reported twice.** `confirmedWasteAvoidedCents` counts only
cancellations a pharmacy acknowledged before dispensing; `projected` includes
requests still in flight. A denial carrying a "returned to stock" code (`AK`)
still counts as avoided; `AH` (already picked up) zeroes the estimate. The
per-day cost tiers are coarse estimates for reporting only — never billing, and
never shown to a patient as a price.

**Idempotency is enforced in the database.** Every request carries a SHA-256 key
over `(profile, medication, trigger, Rx number, discriminator)` behind a unique
index, so a double-save cannot produce two CancelRx messages. Dose changes add
the `old→new` transition as the discriminator, so a second titration of the same
drug is a distinct request rather than a collision.

**Payloads are hashed, not stored.** `erx_cancellation_events.payload_hash` holds
a SHA-256 of what was transmitted. The outbound message references the patient by
opaque profile id; the gateway resolves it to the demographics the network needs,
so no patient name enters this repo's queue or logs.

## Before enabling a live connection

1. **Reconcile the code tables.** `CANCEL_REASON_BY_TRIGGER` and
   `SCRIPT_DENIAL_REASON_CODES` follow published SCRIPT conventions but have not
   been validated against a certified implementation guide — this repo holds no
   certification artefacts. Check both against the guide for the SCRIPT version
   the connection is certified on.
2. **Add the XML serialiser.** The transport currently posts the normalised JSON
   representation. The envelope a gateway accepts differs per SCRIPT version and
   per connection, so serialisation belongs in the adapter.
3. **Schedule the queue sweep.** `processPendingTransmissions()` is exposed via
   `POST /admin/process-queue` but is not yet wired into `server/sync-scheduler.ts`.
   Until it is, retries only happen when the endpoint is called.
4. **Confirm prescriber identity.** Approval currently checks the repo's
   `isProvider`/`role === "provider"` session convention. A live connection needs
   the approver's DEA/NPI bound to the outbound message.

## Running the tests

```
npx vitest run tests/erx-cancellation.spec.ts
npx tsx scripts/check-phi-db-access.ts
```
