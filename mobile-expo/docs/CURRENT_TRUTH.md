# Tabula Medica — Current Truth (as of 2026-05-27)

Supersedes the "Critical Facts" section of the older *tabula medica unified* project doc, which is stale in several material ways. Use this page as the single source of truth for App Review, SOC 2 evidence requests, and onboarding new engineers. If anything below conflicts with another internal doc, this page wins until itself superseded.

## Phase

- **TestFlight live.** Production iOS build **#77** (`Build ID 68d69139-7804-47a5-8afb-33ea14ed656f`, app version 1.0.0) finished on EAS and is auto-submitting to App Store Connect (ASC App ID `6758421617`). Prior shipped builds: #67, #68, #71.
- App Store submission is iOS-only. Android is not in scope for this release.

## Stack (as actually deployed)

| Layer | What's actually in the repo |
|---|---|
| Mobile client | **Managed Expo + React Native** (SDK current; `app.json`, no `/ios/` Swift project). No Capacitor. No native shells. |
| Backend | Node.js / Express / TypeScript on **GCP Cloud Run** (under existing GCP BAA). PostgreSQL + Drizzle ORM. |
| Build / release | EAS Build (production profile) + EAS Submit auto-upload. `store.config.json` for ASC metadata via `scripts/push-asc-metadata.mjs`. |
| AI inference | **Vertex AI (Gemini 2.5 Pro)** via `chatComplete()` in `server/ai-client.ts`. Audio via GCP Medical Speech. All under GCP BAA. OpenAI removed from prod (Phase 4 cleanup). |
| Identity | See "Authentication" below. |

## Authentication (user login)

- **Sole user-login IdP: Google Cloud Identity Platform (GCIP) / Firebase Auth**, BAA-covered under the existing GCP BAA.
  - Email / password and Google federated sign-in route through GCIP.
  - Apple Sign-In remains for the native iOS path, server-verified against Apple JWKS.
- **Auth0 user login is retired** (Tasks #71, #104). The three legacy endpoints (`/api/auth/auth0-config`, `/api/auth/auth0`, `/api/auth/auth0/exchange`) return HTTP 410. The `users.auth0_id` column was dropped. `AUTH0_BAA_EXECUTED` and the Auth0 Management API client are gone.
- Auth0 remains in the codebase **server-side only**, in two narrow roles that never touch user login:
  1. SMART-on-FHIR / TEFCA OIDC broker (`server/auth0-fhir-broker.ts`, uses `AUTH0_DOMAIN` as issuer URL only).
  2. Issuer for Uninsurance JWTs (`server/uninsurance-token-verifier.ts`).
- Session enforcement: GCIP ID token verification via `jose` + opaque-session fallback in `server/middleware/require-auth.ts`. `req._authProvider` is tagged `"gcip" | "session"` on every request.

## PHI handling

- PHI lives only in BAA-covered services: GCP Cloud Healthcare API FHIR store, GCS buckets (`GCS_BUCKET_NAME`, `GCS_UNINSURANCE_BUCKET_NAME`), and the Cloud SQL database under the GCP BAA. **No PHI on Replit infrastructure.**
- Field-level encryption: AES-256-GCM with `PHI_ENCRYPTION_KEY` / `PHI_ENCRYPTION_SALT`. Boot guard refuses to start production without `PHI_ENCRYPTION_SALT` ≥ 32 chars.
- PHI/PII is sanitized before any third-party AI call. Production AI inference path is fully BAA-covered (Vertex).
- Audit trail: WORM hash-chained audit log service.

## Compliance posture

- **HIPAA:** GCP BAA active and covers compute, storage, AI inference, and speech. HIPAA technical safeguards (encryption, audit log, MFA, session timeout, idle/absolute caps) in place.
- **SOC 2 Type II:** in progress.
- **App Store representation alignment:** Firebase session tokens are persisted via the **secure persistence adapter in `client/lib/secure-firebase-persistence.ts`** (Keychain on iOS via `expo-secure-store`), matching what the App Review notes claim. This is the fix to the audit's C-1 finding.

## i18n

- **50+ languages** with RTL support (Arabic, Farsi, Hebrew, Urdu, Pashto). Machine-translated copy is flagged and the clinical disclaimer refuses to render machine-translated medical text, falling back to English.

## CI / CD

- GitHub Actions: `ci-cd.yml` runs the blocking `server-tests` job on every push and pull request to any branch. `deploy-cloudrun.yml` gates Cloud Run deploys on the same suite.
- `server/__tests__/ai-policy.test.ts` is a CI guardrail enforcing two invariants: (1) no direct OpenAI / Vertex SDK imports outside the adapter allow-list; (2) no imports from the deleted `replit_integrations/` or `disabled-openai-stub` paths anywhere in the repo.

## Known divergences from the older "unified" project doc

| Older doc said | Actual state |
|---|---|
| "Auth0 (SSO, social, Apple, MFA)" | Auth0 user login retired (Tasks #71, #104). GCIP is sole user-login IdP. |
| "Pre-TestFlight, MVP-in-development" | On TestFlight. Builds #67/#68/#71 shipped, #77 in flight to ASC. |
| "Capacitor for native wrappers" | No Capacitor in this repo. Managed Expo only. |
| "OpenAI without BAA" | Migrated to Vertex AI Gemini under GCP BAA (Phase 4 cleanup, Task #88). |
| "22 UI languages" | 50+ languages with RTL. |
| "SESSION_SECRET overloaded as 8+ purposes (incl. PHI key fallback)" | `PHI_ENCRYPTION_KEY` + `PHI_ENCRYPTION_SALT` are separated; boot-time guard refuses to start prod without them. |

## Open items (tracked, not blocking #77)

- **H-8** Certificate pinning for `api.tabulamedica.health`.
- **H-10** `expo-local-authentication` biometric gate on app foreground.
- **H-1 / H-2 / H-3** CI hardening: Semgrep, Gitleaks/TruffleHog, Trivy on the Cloud Run image.
- **`ALLOW_NON_BAA_AI_PROXY_INJECTION` retirement** — follow the 4-step sequence in `replit.md` Gotchas (disable AI Integration at workspace level first, then redeploy, then delete the secret, then final redeploy with guard armed). Skipping step 1 crashes the next deploy.
- **Sentry source-map upload** — `SENTRY_DISABLE_AUTO_UPLOAD=true` is set in `eas.json` so EAS builds skip sentry-cli upload. Runtime crash capture still works; symbolicated stack traces require wiring `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT` later.
- **60 plaintext PHI-shaped rows in prod `health_records`** — `scripts/backfill-encrypt-demo-records.ts` is idempotent and ready; blocked on an operator running it with prod DB write + prod `PHI_ENCRYPTION_KEY` / `SALT` in their own shell.

## Where to find things

- Run book: `replit.md` ("Run & Operate" section).
- Threat model: `threat_model.md`.
- Cloud Run deploy: `docs/CLOUD_RUN_DEPLOYMENT.md`, `.github/workflows/deploy-cloudrun.yml`, `cloudbuild.yaml`.
- ASC metadata push: `scripts/push-asc-metadata.mjs` (requires four `APPLE_REVIEW*` env vars).
- Schema: `drizzle/schema.ts` + `shared/schema.ts`.
