# Threat Model

## Project Overview

Tabula Medica is a healthcare application with a React Native/Expo client, an Express/TypeScript backend, PostgreSQL via Drizzle ORM, and numerous healthcare/AI integrations. The production surface is primarily the Express server in `server/index.ts` and `server/routes.ts`, plus authenticated client flows in `client/` that call the API. The system stores and processes PHI, PII, session tokens, healthcare records, and third-party integration credentials.

Production assumptions for this scan:
- `NODE_ENV=production` in production.
- Replit mockup sandbox and development-only tooling are not deployed unless production reachability is demonstrated.
- TLS termination and certificate lifecycle are handled by the deployment platform, so transport encryption is assumed at the platform edge.

## Assets

- **User accounts and sessions** — password hashes, Apple/GCIP identities, session access tokens, refresh tokens, MFA state, device/session metadata. Compromise enables account takeover and downstream PHI access.
- **Protected health information (PHI)** — health records, attachments, clinical summaries, onboarding data, provider-facing notes, and patient profile data. This is the highest-sensitivity data in the system.
- **Integration credentials and secrets** — Auth0 configuration, webhook secrets, cloud credentials, app store/release credentials, AI API keys, and service account material. Exposure can enable account compromise, fraudulent API usage, or supply-chain abuse.
- **Business and compliance data** — audit logs, consent records, care coordination data, monitoring telemetry, subscription/feature gating state, and reviewer/demo access paths.
- **Provider and portal data** — provider dashboard state, clinical documentation, messaging, portal sessions, and tenant membership that gates portal PHI access.

## Trust Boundaries

- **Client / Server** — React Native/web clients are untrusted. Every API request must authenticate and authorize on the server regardless of client behavior.
- **Server / Database** — the Express server has broad PostgreSQL access. Broken access control or injection at the API layer can expose all stored PHI and account data.
- **Server / External Services** — the backend calls Auth0, Apple, Google Cloud, healthcare APIs, Twilio, RevenueCat, and AI providers. Incoming callbacks and outgoing requests cross a high-risk trust boundary.
- **Public / Authenticated / Privileged** — the app contains public landing/onboarding endpoints, authenticated patient APIs, partner callback routes, and provider/admin-style surfaces. These boundaries must be enforced server-side.
- **Production / Dev-only** — `server/testing/`, generated build outputs, and local helper flows are treated as dev-only unless production routing or runtime exposure is demonstrated. Repository-tracked historical secrets remain in scope because source exposure impacts production security.

## Scan Anchors

- **Production entry points:** `server/index.ts`, `server/routes.ts`, `server/portal-routes.ts`, `client/index.js`, `client/App.tsx`
- **Highest-risk code areas:** `server/routes/clinical-2.ts`, `server/routes/clinical-4.ts`, `server/routes/clinical-5.ts`, `server/routes/collab-2.ts`, `server/routes/integrations-1.ts`, `server/routes/analytics.ts`, `server/portal-routes.ts`, `server/storage.ts`, `server/background-sync-service.ts`
- **Public surfaces:** `/api/auth/*`, public onboarding/landing endpoints, uninsurance verification/callback routes, FHIR monitoring ingestion, web/portal entry pages, webhook endpoints
- **Authenticated surfaces:** most `/api/*` patient, AI, clinical, analytics, and integration endpoints protected by `requireAuth`
- **Usually ignore unless proven reachable in prod:** `server/testing/`, generated `dist/` and `server_dist/`, local mobile build artifacts, and `attached_assets/` except when checking for committed-secret exposure in tracked history

## Confirmed Production-Relevant Anchors From This Scan

- **Portal patient-membership boundary:** `server/portal-routes.ts` enrollment and downstream patient-scoped portal reads remain a primary PHI authorization boundary.
- **Clinical documentation object and patient-binding boundary:** `server/routes/clinical-2.ts` plus `server/storage.ts` contain note, transcript, case-review, prior-auth, and note-context flows that still trust foreign object IDs or stored patient IDs in some creation paths.
- **Clinical workflow patient-binding boundary:** `server/routes/clinical-5.ts` and `server/lab-ordering-service.ts` still let authenticated callers bind new orders to arbitrary patient IDs before later privileged actions trust that binding.
- **Shared monitoring/admin-adjacent surfaces:** `server/routes/integrations-1.ts`, `server/routes/collab-2.ts`, and their backing services expose shared operational/compliance data that is not patient-scoped.
- **Background job scheduler boundary:** `server/routes/analytics.ts`, `server/background-sync-service.ts`, and boot-time scheduler initialization in `server/index.ts` form a production DoS surface.
- **Public callback and audit-integrity boundary:** `server/routes/clinical-4.ts` and `server/routes/_helpers.ts` still record externally sourced identities as internal audit actors on uninsurance flows.
- **Repository-tracked operational access material:** reviewer-account handling scripts, deployment workflows, and tracked history under `attached_assets/` remain worth checking for credential exposure.

## Confirmed Findings To Prioritize On Future Scans

- **Portal enrollment can still be abused to claim arbitrary patients.** `POST /api/portal/patients/:id/enroll` in `server/portal-routes.ts` only checks that a supplied `users.id` exists and is not already active in another tenant, so a portal admin who knows a victim user ID can enroll that user into their tenant and unlock downstream portal PHI access.
- **Clinical generation APIs still dereference foreign sensitive objects by raw ID.** `server/routes/clinical-2.ts` loads transcripts, case reviews, and clinical notes through unconstrained storage lookups during note generation and prior-auth creation, allowing cross-account PHI disclosure via AI-generated output.
- **Clinical notes still trust attacker-chosen patient bindings.** The note create/update paths in `server/routes/clinical-2.ts` allow caller-controlled `patientId`, and the note-context endpoint later trusts that stored value to return another patient's labs, medications, and appointments.
- **Lab-order creation still allows arbitrary patient targeting.** `server/routes/clinical-5.ts` and `server/lab-ordering-service.ts` let any authenticated caller create an order for any `patientId`, then later submit or simulate results that are written into the targeted patient's chart.
- **FHIR monitoring remains broadly under-protected.** `server/routes/integrations-1.ts` allows unauthenticated callers to inject monitoring metrics and create alerts, while normal authenticated users can view and resolve global alerts without privileged authorization.
- **Compliance monitoring still leaks shared operational data to any authenticated user.** `server/routes/collab-2.ts` exposes organization-wide compliance alerts, rules, access reviews, and PHI-access telemetry behind `requireAuth` only.
- **Background sync registration remains a shared DoS surface.** `server/routes/analytics.ts` and `server/background-sync-service.ts` allow unlimited in-memory sync-job registration per authenticated user, and the global scheduler scans this shared state continuously.
- **Public uninsurance routes still compromise audit provenance.** `server/routes/clinical-4.ts` sets `req._authenticatedUserId` from externally verified tokens or shared-secret callback material before calling `auditLog()`, so third-party callback traffic can create user-attributed audit entries and trigger user-scoped follow-on processing.
- **A real reviewer password remains exposed in tracked git history.** A repository-tracked `attached_assets/` path still has a historical revision containing an unredacted production reviewer credential, which remains production-relevant because reviewer-login smoke tests and deployment docs confirm the account is live.

## Validated Non-Findings To De-Prioritize On Future Scans

- On `requireAuth`-protected routes, the server still derives identity from `req._authenticatedUserId` and rewrites `x-user-id` from the validated auth context; do not re-propose broad header-spoofing findings on protected paths without fresh evidence of a route that still consumes raw headers outside that flow.
- The earlier portal tenant-slug collision theory appears stale. `server/portal-routes.ts` now fails closed on `provider.tenantId` and I did not reconfirm a production-reachable organization-name collision path.
- Consultation-summary detail and rating routes in `server/routes/clinical-2.ts` now enforce `summary.userId === userId`; do not re-propose the older broad consultation-summary IDOR without new evidence.
- Provider-discovery session routes in `server/routes/clinical-5.ts` now enforce `session.userId === userId`; the older cross-account session UUID finding was not reconfirmed.
- The earlier lineage-mutation finding appears fixed. The reviewed `/api/lineage/*` mutations in `server/routes/analytics.ts` now check `lineageRecord.userId === userId` before write actions.
- The previous broad lab-order detail/result IDOR has narrowed. Current detail reads enforce caller match on `order.providerId` or `order.patientId`; the remaining live issue is arbitrary patient binding at order creation.
- `GET /api/data-aggregation/storage/documents/:documentId` still looks suspicious, but the current handler does not `await` `getDocumentMetadata()` and I did not confirm a live disclosure path from current production behavior.
- The public treatment-efficacy visualization routes in `server/routes/analytics.ts` still appear backed by demo/in-memory data rather than live PHI; do not re-propose them without fresh validation.
- `POST /api/auth/forgot-password` still returns a fixed `501 PASSWORD_RESET_UNAVAILABLE` response, so it is not a live password-reset takeover path in the present production code.
- `POST /api/auth/apple` still requires `identityToken` and verifies it with `verifyAppleIdentityToken()`, so the earlier body-parameter spoofing concern is not currently a confirmed production finding.
- The reviewer shortcut inside `POST /api/auth/login` remains narrowly gated on non-empty reviewer secrets. Without fresh evidence that those secrets are exposed or that the resulting session has elevated privileges, do not re-propose it as a standalone auth bypass finding.
- Primary webhook routes in `server/webhook-routes.ts` and `server/webhook-security-service.ts` still appeared to enforce signature verification and replay handling for the production paths reviewed.
- Epic logging in `server/routes/integrations-2.ts` and `server/epic-integration-service.ts` did not yield a fresh, high-confidence PHI-in-logs finding in this scan; the older theory should be treated as stale until reconfirmed.
- `/api/clinical-ai-audit*` is still public, but the reviewed implementation in `server/clinical-ai-audit-service.ts` remains an in-memory demo dataset rather than a persistent production audit store; without evidence of live data wiring, treat it as low-priority noise.
- Local release-signing artifacts such as `appstore-api-key.p8`, `dist_cert.p12`, and `profile.mobileprovision` were present locally but are not repo-tracked in the current repository state, so they are not current committed-secret findings.

## Threat Categories

### Spoofing

The application supports GCIP-backed user sessions, Apple Sign-In, portal sessions, and service-to-service or partner callback flows. The server must derive user identity from verified credentials or signed tokens only, and it must not conflate third-party callback identities with first-party authenticated user principals. Reviewer/demo access and compatibility fallbacks remain sensitive because they can silently bypass the normal identity proofing path.

Required guarantees:
- All protected endpoints MUST derive the acting user from a validated server-side session or verified identity token.
- Federated login and cross-app callback flows MUST reject unverifiable or unsigned caller-supplied identity claims in production.
- Password recovery and special reviewer/demo login paths MUST provide equivalent assurance to standard authentication.
- Webhooks and partner callbacks MUST verify signatures or comparable authenticators before accepting state changes.

### Tampering

The client sends onboarding data, health inputs, AI prompts, uploaded files, provider operations, monitoring events, and integration parameters across the API boundary. Business logic, ownership checks, and feature entitlements must be enforced on the server, not implied by UI state, stored foreign IDs, or shared operational tables.

Required guarantees:
- User-controlled identifiers, route params, and stored foreign keys MUST NOT change which records a caller can read or modify unless server-side ownership checks pass.
- File/document processing MUST validate type, size, and destination and keep uploads outside unsafe execution contexts.
- Integration state changes and token storage MUST be bound to the authenticated user and verified callback source.
- Client-side feature gating MUST be backed by server-side enforcement on sensitive routes.
- Shared monitoring and alerting state MUST only be writable or dismissible by explicitly authorized principals.

### Information Disclosure

This system handles PHI, PII, audit data, attachments, operational telemetry, and secrets. Disclosure risks include broken object-level authorization, privileged dashboards exposed to normal users, verbose API responses, PHI leakage to logs, and committed credentials in repository history.

Required guarantees:
- API responses MUST be scoped to the authenticated user or authorized privileged role on every request.
- Secrets, signing material, reviewer credentials, and release credentials MUST NOT be committed to the repository or exposed to clients.
- Logs and error responses MUST avoid leaking PHI, tokens, passwords, or sensitive integration state.
- Browser/webview message handling MUST validate message origin and expected sender before acting on sensitive events.
- Admin/compliance dashboards MUST be role-restricted and must not expose global telemetry to ordinary authenticated users.

### Denial of Service

The server exposes public auth, onboarding, callback, chat, sync, and integration endpoints, some of which trigger expensive AI or external-service work. Attackers could abuse unauthenticated or weakly limited endpoints to exhaust compute, fill in-memory job queues, or poison monitoring systems.

Required guarantees:
- Public authentication, onboarding, callback, and AI-assisted endpoints MUST have effective rate limits and bounded work.
- External-service calls MUST use timeouts and fail safely.
- Upload and document-processing flows MUST bound request size and processing cost.
- Shared schedulers, background-job registries, and monitoring ingestion endpoints MUST impose quotas, deduplication, and backpressure so a single low-privilege account cannot degrade the service.

### Elevation of Privilege

The backend centralizes a very large number of healthcare, provider, and admin-adjacent routes. Any missing authorization guard, unsafe trust in `patientId` or other raw foreign IDs, exposed admin/compliance dashboard, or insecure enrollment flow can expand a normal user's privileges or expose another user's PHI.

Required guarantees:
- Every route that reads or mutates user or patient data MUST enforce authentication and per-object authorization server-side.
- Provider/admin/portal/compliance functions MUST require an explicit privileged authorization check, not just a valid session.
- Compatibility code paths, demo behavior, and fallback identities MUST be disabled or strongly constrained in production.
- Database operations and storage-layer helpers MUST not accept client-controlled user identity or patient binding without a validated upstream auth decision.
