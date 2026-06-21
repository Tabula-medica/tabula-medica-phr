# Threat Model

## Project Overview

Tabula Medica is a healthcare platform that combines a React/Vite web client, an Express/TypeScript backend, and mobile clients in the same repository. The production backend is primarily routed through `server/index.ts`, `server/routes.ts`, and `server/mobile-api-routes.ts`, and it handles patient records, sharing flows, file/object storage, healthcare integrations, and AI-assisted workflows. The system processes PHI, patient account data, access tokens, uploaded documents and media, and operational audit data.

This scan is production-scoped. Mockup sandboxes and purely local development artifacts are out of scope unless production reachability is demonstrated. Platform-managed TLS is assumed in production.

## Assets

- **Patient health data and PHI** — medical records, summaries, labs, medications, conditions, encounters, and any derived healthcare views. Unauthorized disclosure would be a direct privacy and compliance failure.
- **Authentication material** — Auth0 tokens, session cookies, mobile JWTs, refresh tokens, and bearer tokens. Compromise enables impersonation across protected routes.
- **Authorization state and role boundaries** — user identity claims, role assignments, policy decisions, consent/sharing state, and access-control metadata. Integrity failures here can turn ordinary users into privileged actors or expose other patients' data.
- **Uploaded files and object-storage content** — profile photos, onboarding documents, attachments, and other private objects stored through Replit object storage. These objects may contain PHI or identifying information.
- **Share links, tokens, and audit metadata** — patient-initiated sharing tokens, recipient metadata, access logs, and download URLs. Exposure can bypass patient intent even if the underlying feature is partially stubbed.
- **Application secrets and configuration** — `SESSION_SECRET`, Auth0 configuration, database credentials, and object-storage environment variables. Weak defaults or permissive fallbacks can collapse the trust boundary for the whole app.

## Trust Boundaries

- **Browser/mobile client to Express API** — all request parameters, headers, cookies, and bearer tokens are untrusted until validated server-side.
- **Public to authenticated routes** — many routes are intentionally public, but patient data, account state, admin-like functions, share management, and object access must be protected with server-side authentication and authorization.
- **Authenticated user to other authenticated users** — patient IDs, profile IDs, share IDs, object paths, and resource IDs must be scoped to the acting user. Guessable identifiers, raw record IDs, or fallback identities create IDOR risk.
- **App server to object storage** — the server can mint upload/download URLs and map `/objects/*` paths into private buckets. ACL enforcement must happen before serving or signing object access.
- **App server to external identity provider** — Auth0 tokens must be verified against the correct issuer, audience, and expected token type. Accepting tenant-valid but app-invalid tokens breaks authentication.
- **App server to database/external integrations** — the backend can upsert users, store sessions, and invoke healthcare integrations. Any auth bypass on server routes can turn into broad downstream access.

## Scan Anchors

- **Production entry points:** `server/index.ts`, `server/routes.ts`, `server/mobile-api-routes.ts`
- **Highest-risk auth surfaces:** `server/replit_integrations/auth/replitAuth.ts`, `server/auth/gcip.ts`, mobile auth in `server/mobile-api-routes.ts`
- **Highest-risk inline route clusters in `server/routes.ts`:** `/api/export-control/*`, `/api/admin/analytics/*`, and `/api/ai-medication/*` must be checked individually because they are production-mounted and several rely on optional `req.user`, fallback identities, or caller-controlled patient identifiers
- **Highest-risk SMART/FHIR control planes:** `server/smart-fhir-routes.ts`, `server/services/smart-app-launch.ts`, `server/services/fhir-outbound-api.ts`
- **Confirmed public FHIR router cluster to re-check on future scans:** `server/fhir-r4-api-routes.ts`, `server/external-fhir-routes.ts`, and `server/fhir-search-routes.ts` because they are production-mounted and have previously exposed bearer-auth bypasses, public control-plane state, or runtime audit metadata
- **Additional production-mounted disclosure/IDOR surfaces to re-check:** `server/patient-export-routes.ts` and provider integration routes backed by `server/services/providerIntegration.ts`, especially referral and booking endpoints, because several routes trust caller-supplied or predictable record IDs without an ownership check
- **SMART helper split-brain warning:** `server/smart-fhir-routes.ts` mixes correctly PHI-gated routes with public `/api/smart/discovery/*` and public `/api/fhir/*` helper endpoints, so route-level auth must be reviewed per endpoint rather than assumed from the file
- **Highest-risk data/file surfaces:** `server/replit_integrations/object_storage/*`, `server/profile-photo-routes.ts`, `server/services/profile-photo-service.ts`, `server/secure-health-share-routes.ts`
- **Highest-risk patient portal surface:** `server/patient-experience-routes.ts` because it mixes patient-scoped reads/writes, caller-controlled `patientId` parameters, raw object-ID mutations, and a hard-coded `patient-001` fallback
- **Production-mounted demo/control-plane surfaces to re-check:** `server/user-role-management-routes.ts`, `server/services/user-role-management-service.ts`, `server/ai-conflict-resolution-routes.ts`, `server/services/ai-conflict-resolution-service.ts`, `server/ai-audit-log-routes.ts` because demo-backed routes can still create real AI-cost, tampering, or abuse side effects
- **Confirmed production-mounted provider/demo AI surfaces to re-check:** `server/ai-provider-dashboard-routes.ts`, `server/provider-communication-portal-routes.ts`, `server/ai-medical-assistant-routes.ts`, `server/ai-note-assistant-routes.ts`, `server/ai-medical-scribe-routes.ts` because provider-only tooling is sometimes mounted with authentication but without role isolation
- **Mixed patient/provider AI communication surfaces to re-check:** `/api/ai-communication/*` in `server/routes.ts` together with `server/services/aiCommunication.ts` because conversation IDs, thread IDs, and patient IDs are used across patient and provider roles and must always be bound to ownership or assignment server-side
- **Public vs authenticated boundary:** many routes are mounted directly in `server/routes.ts`; route-level auth must be verified per router rather than assumed globally
- **Seeded/sample data warning:** production-mounted demo services that seed share tokens, note records, conflict data, portal data, or audit/control-plane state remain in scope because they can expose healthcare-style data and create real operational or AI-cost side effects
- **Usually out of scope unless mounted in production:** `.local/`, docs, tests, purely client-side mock/demo artifacts; however sample/demo code inside mounted production routers remains in scope

## Threat Categories

### Spoofing

This project relies on Auth0 tokens, server sessions, and mobile bearer tokens to establish identity. The backend must reject tokens not intended for this application, must fail closed when signing secrets are missing, and must not keep production-accessible demo credentials or fallback identities. Any production route that accepts a bearer token or synthesizes a user ID must verify the caller belongs to the expected audience and authentication context.

Required guarantees:
- Protected routes MUST verify bearer tokens against the correct issuer and audience.
- Protected routes MUST reject ID tokens or other non-API token types when an API access token is required.
- Production auth/session code MUST fail closed if signing secrets are missing.
- Demo credentials and sample identities MUST NOT be reachable on production routes.
- Public telemetry endpoints MUST NOT expose authentication-event history.

### Tampering

The app exposes many write-capable healthcare and account-management APIs, including share creation/revocation, profile media operations, consent/state changes, audit/control-plane updates, and integration control paths. The server must not trust caller-supplied patient IDs, profile IDs, role-like fields, raw object IDs, or object paths without confirming ownership and permission. In-memory or sample-backed services still matter when they are mounted in production and can modify real runtime state or user-visible behavior.

Required guarantees:
- Sensitive write routes MUST bind operations to the authenticated subject server-side, not request parameters alone.
- Object metadata and upload confirmation endpoints MUST verify ownership before overwriting or deleting records.
- Sharing and token lifecycle operations MUST require the owning authenticated patient.
- Admin-like or provider-only control planes MUST enforce authentication and role checks before mutation.
- Audit-log and review-feedback endpoints MUST reject unauthenticated writes and must not accept forged actor identity fields from the request body.
- Public or patient-facing routes MUST NOT mutate records selected only by guessable object IDs without an ownership check.

### Information Disclosure

The backend handles PHI, object-storage paths, audit metadata, share tokens, signed URLs, and third-party EHR integration state. Disclosure can happen through missing route auth, over-broad metadata endpoints, public auth logs, seeded sample tokens, or serving private object paths without ACL checks. In a healthcare context, even metadata such as recipient identities, access logs, session launch context, or private media URLs can be sensitive.

Required guarantees:
- Patient- and account-scoped APIs MUST return data only to authorized users.
- Private object-storage content MUST NOT be served from public routes without ACL enforcement.
- Signed URLs, share tokens, and auth-event logs MUST be treated as sensitive secrets.
- SMART/FHIR session identifiers, launch context, OAuth client secrets, and outbound integration metadata MUST NOT be exposed from public routes.
- Error handling and sample-mode fallbacks MUST NOT expose private identifiers or operational details to anonymous users.
- Authenticated users MUST NOT be able to pivot into other patients' portal data by supplying another `patientId` or by exploiting fallback identities such as `patient-001`.

### Denial of Service

Anonymous upload URL minting, object uploads, token-validation endpoints, and AI-assisted operations can all be abused for storage, compute, or log-amplification costs if they are exposed without proper gating. Because the app integrates object storage and AI services, even example routes can create production abuse paths.

Required guarantees:
- Public upload and download routes MUST have explicit authentication/authorization or narrowly constrained abuse controls.
- Expensive AI or integration-triggering routes MUST require authenticated access and appropriate rate limits.
- Provider-oriented or privileged AI workflows MUST enforce role isolation so ordinary users cannot repurpose them as a paid compute surface.
- Storage-allocation endpoints MUST not allow unauthenticated arbitrary object creation in private buckets.

### Elevation of Privilege

The most important risk in this codebase is broken server-side authorization: accepting a token for the wrong audience, treating callers as a fallback patient, or assuming owner or staff privileges from route code instead of verified state. Because many backend features are mounted independently, a single weak router can bypass otherwise strong global middleware.

Required guarantees:
- Every mounted router that reads or mutates patient, account, provider, or admin data MUST enforce server-side authorization explicitly.
- Authorization decisions MUST derive from verified identity, role, and resource ownership, never from default IDs or optimistic role assumptions.
- Routes MUST reject missing auth context instead of substituting fallback identities such as `patient-default`, `patient-001`, `anonymous`, or `system` for patient, account, or control-plane operations.
- Routes that appear administrative, provider-only, or control-plane-like MUST be considered privileged until proven otherwise.
- Sample/demo logic inside production-mounted routers MUST NOT create alternate privilege paths.
