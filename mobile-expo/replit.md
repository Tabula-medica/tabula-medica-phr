# Tabula Medica

Tabula Medica is a patient-facing mobile application providing a unified, deduplicated, and chronologically summarized complete health record, leveraging AI for personalized insights and proactive healthcare workflow automation.

## Run & Operate

> Long-form history, resolved-task narratives, and full operational detail live in
> `docs/PROJECT_HISTORY.md`. This file keeps the durable, currently-relevant rules.

*   **Server regression tests:** `npm run test:server` — runs every `*.test.ts` under `server/__tests__/` (GCIP auth, `requireAuth`, AI-policy guardrail, web host routing). Blocking CI job on every push/PR and a Cloud Run deploy gate. New tests in that dir are picked up automatically. (Detail: `docs/PROJECT_HISTORY.md`.)

*   **Build EAS (iOS):**
    ```bash
    EAS_NO_VCS=1 EAS_BUILD_NO_EXPO_GO_WARNING=true eas build --platform ios --profile production --non-interactive --no-wait --auto-submit --message "..."
    ```
    Before triggering via CI (`build-ios` / `submit-ios`), the pipeline runs three gates ahead of the EAS build:
    1. **Reviewer login gate** (`reviewer-login-gate` job, `scripts/smoke-test-reviewer-login.sh`) — POSTs `/api/auth/login` against prod with `APPLE_REVIEWER_DEMO_EMAIL` / `APPLE_REVIEWER_DEMO_PASSWORD` (CI secrets) and fails if login is anything other than HTTP 200 with an `accessToken`. Catches a broken reviewer account before an EAS build credit is burned. Mirrors the check in `scripts/push-asc-metadata.mjs` at metadata-push time.
    2. **GCIP launch-crash guard test** (`jest-tests` job, `client/lib/__tests__/gcip.test.tsx`) — blocks a regression that reintroduces the `useIdTokenAuthRequest` render-time invariant crash (App Review Guideline 2.1(a)).
    3. **iOS Google client ID check** (`scripts/check-ios-google-client-id.sh`) — fails the build if `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` is absent or an unsubstituted `$EXPO_PUBLIC_*` placeholder. Store the real value in the GitHub repo secret `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`. To intentionally ship without Google Sign-In set `SKIP_IOS_GOOGLE_CLIENT_ID_CHECK=1` as a GitHub/EAS secret (emits a loud warning, exits 0).

    **Android gate (`build-android` / `submit-android`):** the `eas-build-android` job mirrors the iOS gating — it `needs` `jest-tests` and runs **`scripts/check-android-google-client-id.sh`** before `eas build`. The check fails the build if `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` is absent or an unsubstituted `$EXPO_PUBLIC_*` placeholder. Unlike iOS this is not a launch crash (the `gcip.ts` guard hides the Google button on Android), but a missing ID ships a Play Store build with Google Sign-In silently broken. Store the real value in the GitHub repo secret `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`. To intentionally ship without Google Sign-In set `SKIP_ANDROID_GOOGLE_CLIENT_ID_CHECK=1` as a GitHub/EAS secret (emits a loud warning, exits 0).

*   **Push App Store metadata (with reviewer demo login):**
    ```bash
    APPLE_REVIEWER_DEMO_EMAIL=… APPLE_REVIEWER_DEMO_PASSWORD=… \
    APPLE_REVIEW_CONTACT_EMAIL=… APPLE_REVIEW_CONTACT_PHONE=… \
    node scripts/push-asc-metadata.mjs
    ```
    Wraps `eas metadata:push`. Reviewer credentials are never committed — they live in EAS/CI secrets and the wrapper injects them at push time, restoring the sentinel placeholder afterward. The wrapper enforces iOS-only scope, blocks dummy/placeholder contact values, and does a live prod `POST /api/auth/login` pre-check so a rotated/disabled reviewer account fails the push locally instead of via an App Review rejection. Required env: `APPLE_REVIEWER_DEMO_EMAIL`, `APPLE_REVIEWER_DEMO_PASSWORD`, `APPLE_REVIEW_CONTACT_EMAIL`, `APPLE_REVIEW_CONTACT_PHONE` (store in EAS/CI secrets, never the repo). Full safeguards, tunables (`REVIEWER_LOGIN_API_BASE`, `SKIP_REVIEWER_LOGIN_CHECK`), and failure-code hints: `docs/PROJECT_HISTORY.md`.

*   **Required Environment Variables:**
    - `PHI_ENCRYPTION_SALT`: REQUIRED in production. ≥32 random chars. Boot guard refuses to start without it. Never change it — changing breaks all encrypted PHI.
    - `OPENAI_API_KEY`: (Only for development/fallback; removed from prod)
    - GCP project details for Vertex AI, Identity Platform (GCIP), and Cloud Run.
    - `AUTH0_DOMAIN`: required by the SMART-on-FHIR / TEFCA broker (`server/auth0-fhir-broker.ts`, as the OIDC issuer URL only) and the Uninsurance JWT verifier (`server/uninsurance-token-verifier.ts`). Not used for user login (retired in Task #71). `AUTH0_MGMT_CLIENT_ID` / `AUTH0_MGMT_CLIENT_SECRET` were retired in Task #104 along with the per-user Auth0 ID storage — do not reintroduce.
- `AUTH0_BAA_EXECUTED`: **removed in Task #71.** Do not re-introduce this flag. The user-login Auth0 path that read it is gone; the HIPAA-compliant identity provider for user login is GCIP under the GCP BAA.

## Stack

- **Frontend:** React Native, Expo, React Navigation, TanStack Query, AsyncStorage
- **Backend:** Node.js, Express.js
- **Database:** PostgreSQL, Drizzle ORM
- **Authentication:** GCIP / Firebase Identity Platform (sole user-login IdP, under GCP BAA — email/password and Google federated sign-in route through GCIP), Apple Sign-In (native iOS path, server-verified via Apple JWKS). Auth0 retained server-side only as the SMART-on-FHIR / TEFCA OIDC broker (`server/auth0-fhir-broker.ts`) and as the issuer for Uninsurance JWTs (`server/uninsurance-token-verifier.ts`); no client-side or user-login Auth0 wiring remains.
- **AI/ML:** Google Vertex AI (Gemini 2.5 Pro), Claude 3.5 Sonnet, GPT-4o, OpenAI (fallback)
- **Cloud:** Google Cloud Platform (GCP), Google Cloud Storage (GCS), Google Cloud Healthcare API, Cloud Run
- **Build Tool:** EAS Build (Expo Application Services)
- **i18n:** 50+ languages, RTL support
- **Other:** RevenueCat (subscriptions)

## Where things live

- **UI/UX Design:** `exports/UI-MODERNIZATION.md` (for web codebase mirroring)
- **Database Schema:** `drizzle/schema.ts` (Defined via Drizzle ORM migrations)
- **API Contracts:** _Populate as you build_
- **EAS Build Configuration:** `eas.json` (for build profiles)
- **App Store Listing Metadata:** `store.config.json`
- **AI Migration Design Doc:** `.local/phase2-design.md`
- **Project History / Detailed Notes:** `docs/PROJECT_HISTORY.md` (long-form history, resolved-task narratives, full operational detail)
- **Cloud Run Deployment Docs:** `docs/CLOUD_RUN_DEPLOYMENT.md`, `.github/workflows/deploy-cloudrun.yml`, `cloudbuild.yaml`, `scripts/bootstrap-gcp-cloudrun.sh`
- **Payer-Token Sandbox Smoke-Test Runbook:** `docs/PAYER_TOKEN_SANDBOX_SMOKE_TEST.md` (live-Postgres verification + operator-gated Cigna/Epic OAuth steps)
- **Theme Files:** Root-level theme configuration for iOS 26 Liquid Glass and Material 3 Expressive

## Architecture decisions

- **PHI Handling:** Strict compartmentalization; PHI stored only in HIPAA-compliant GCS buckets and GCP Cloud Healthcare API FHIR store. PHI/PII is sanitized before interaction with third-party AI services. Replit is not used for PHI storage.
- **AI Provider Strategy:** All production server-side AI inference flows through `chatComplete()` in `server/ai-client.ts` (Google Vertex AI / Gemini under the GCP BAA). Audio transcription uses `transcribeMedicalAudio()` in `server/gcp-medical-speech.ts` (GCP BAA); no OpenAI for any PHI. A boot-time `assertEnvPolicy()` guard blocks startup in prod if any `AI_INTEGRATIONS_*` env var is present, and `server/__tests__/ai-policy.test.ts` blocks reintroducing `replit_integrations/` / `disabled-openai-stub` imports or direct SDK usage. Detail + retired internals: `docs/PROJECT_HISTORY.md`.
- **Hosting Environment:** Migrating production backend to GCP Cloud Run due to Replit's lack of HIPAA BAA.
- **Authentication Hardening:** User login goes exclusively through GCIP (BAA-covered under the existing GCP BAA) — email/password and Google federated sign-in. Apple Sign-In remains for native iOS. The `requireAuth` middleware (`server/middleware/require-auth.ts`) accepts a raw GCIP/Firebase JWT or one of our opaque session tokens; the Auth0 user-validation path was removed in Task #71. Auth0 stays in the codebase only for the SMART-on-FHIR / TEFCA OIDC broker and the Uninsurance JWT verifier, both of which are server-side and never touch the user-login flow.
- **No Middle Name (NMN) Enforcement:** Implemented at three layers to ensure consistent three-part legal names for patient identification.
- **Data Deduplication:** Master Patient Index (MPI) uses deterministic and probabilistic algorithms for health record deduplication and semantic normalization.
- **Design System:** Adherence to iOS 26 Liquid Glass principles and WCAG 2.1 Level AA accessibility, with automatic fallbacks for older iOS/Android.
- **Web frontend co-located with hosting-only consolidation (Tasks 2026-05-23, 2026-05-28, 2026-05-29).** The React+Vite web client (www/app/portal.tabulamedica.health) lives in this repo under `web/` as an npm workspace; its original `server/` tree was discarded. `server/index.ts` is the canonical Express server and serves the web SPA on `WEB_HOSTS` (history-API fallback to `dist/web/index.html`, before the Expo static middleware; returns 503 `WEB_BUNDLE_MISSING` if `dist/web/` is absent). The web React-18 tree is isolated from the mobile Expo/React-19 tree via workspace `node_modules` hoist rules, `.easignore`, and `metro.config.js` blockList. Build: `npm run build:web`; dev: `npm run dev:web` (Vite 5173). Host/path routing locked down by `server/web-host-routing.ts` + `server/__tests__/web-host-routing.test.ts`.
  - **The two backends stay SEPARATE — frontend hosting is consolidated, but web API traffic routes to the web app's own dedicated backend, NOT the mobile Express backend.** Do not add web endpoints to the mobile backend. Set `VITE_API_BASE_URL=https://<dedicated-web-backend>` at web build time; a global fetch interceptor (`web/client/src/lib/api-base.ts`, wired in `web/client/src/main.tsx`) + `resolveWsUrl()` rewrite all `/api`, `/webhooks`, and `/ws` traffic there with credentials. Unset = same-origin no-op. The dedicated backend must send CORS allow-origin + allow-credentials for the web hosts. iOS app is hardcoded to `api.tabulamedica.health` and unaffected.
  - Full detail (audit numbers, compat aliases in `server/routes/web-compat-aliases.ts`, migration history): `docs/PROJECT_HISTORY.md` and `.agents/memory/web-mobile-api-divergence.md`.

## Product
- **Core Functionality:** Unified, deduplicated, and chronologically summarized complete health record.
- **AI Features:** AI-powered insights, 24/7 AI Health Assistant, Clinical Decision Support, Proactive Safety Analysis, Clinical Data Linking, Documentation Assistance, Clinical Automation.
- **Integrations:** FHIR R4 support, major EHRs (Epic, eClinicalWorks), Fasten Health, Healow Connect4, dental practice software (Open Dental, Henry Schein Dentrix, Patterson Eaglesoft), TEFCA QHINs via Auth0 OIDC.
- **Key Workflows:** Annual Health Review wizard, Pharmacy & Provider Selection, Provider Share Summary.
- **Compliance & Security:** HIPAA, SOC 2 alignment, AES-256-GCM encryption, TLS 1.3, audit logging, MFA, field-level encryption for PHI, API rate limiting, CSP headers.
- **Specialized Platforms:** Uninsured Patient Platform (insurance learning, provider directory, GFE generator, financial assistance), DoD/Field Deployment (offline sync, CAC/PIV auth).
- **Subscription Model:** Freemium-to-Enterprise with feature gating via RevenueCat (18 feature gates).
- **Dual-Mode Ecosystem:** (Tabula Medica ↔ Uninsurance.care) for integrated patient support.

## User preferences

- HIPAA compliance is critical
- SOC 2 alignment required
- FHIR integration for health data
- Clean, medical-professional aesthetic

## Gotchas

- **PHI Storage:** Do not store PHI on Replit infrastructure. Utilize BAA-covered services only.
- **GCIP is the sole user-login IdP** (HIPAA-compliant under the GCP BAA): email/password + Google federated sign-in. Apple Sign-In remains for native iOS. `requireAuth` accepts a raw GCIP/Firebase JWT first, then an opaque session token. Required prod env: `GCIP_PROJECT_ID` (server), `EXPO_PUBLIC_GCIP_API_KEY` / `EXPO_PUBLIC_GCIP_AUTH_DOMAIN` / `EXPO_PUBLIC_GCIP_PROJECT_ID` (client). First-sign-in auto-link is gated on `email_verified === true`. Full wiring: `docs/PROJECT_HISTORY.md`.
- **Auth0 user login, per-user Auth0 ID storage, and the Auth0→GCIP bulk-migration tooling are all RETIRED.** Legacy login endpoints respond HTTP 410. Do NOT reintroduce: `signInWithAuth0`, `api.auth.auth0`, `AUTH0_BAA_EXECUTED`, `AUTH0_MGMT_*`, `users.auth0_id`, `storage.getUserByAuth0Id`, `scripts/migrate-auth0-to-gcip.ts`, `server/auth0-gcip-migration-routes.ts`, `server/auth/auth0-verify.ts`, `server/auth0-healthcare-hardening.ts`. Auth0 survives ONLY in `server/auth0-fhir-broker.ts` (OIDC issuer via `AUTH0_DOMAIN`) and `server/uninsurance-token-verifier.ts`. Full retirement record: `docs/PROJECT_HISTORY.md`.
- **No OpenAI/Replit AI proxy for PHI.** All prod AI inference goes through `chatComplete()` (`server/ai-client.ts`, Vertex AI / GCP BAA); audio via `server/gcp-medical-speech.ts`. Do NOT reintroduce `replit_integrations/` or `disabled-openai-stub` imports or direct AI SDK usage (CI guardrail `ai-policy.test.ts` blocks it).
- **EAS Builds in Replit:** Use a long-running Workflow (`EAS_NO_VCS=1`) to avoid timeouts and `git stash` issues.
- **BAA Guard Bypass (pending cleanup — do not extend):** `ALLOW_NON_BAA_AI_PROXY_INJECTION` deployment secret neutralizes the boot-time `assertEnvPolicy()` guard because Replit's AI Integration auto-injects `AI_INTEGRATIONS_OPENAI_*` env vars (runtime routing still Vertex AI under BAA). Retire in strict order: (1) disable the AI Integration at workspace level, (2) redeploy + confirm no `AI_INTEGRATIONS_*` in boot logs, (3) delete the secret, (4) final redeploy with guard armed. Skipping step 1 crashes the next deploy. If the guard trips, fix the root cause — do not reintroduce the bypass.
- **60 plaintext PHI-shaped rows in prod `health_records` — BLOCKED ON OPS.** Reviewer-seed rows (Jan 29–Feb 1 2026) predate the encryption layer. `scripts/backfill-encrypt-demo-records.ts` is idempotent + dry-run by default. Operator with prod DB write + prod `PHI_ENCRYPTION_KEY`/`SALT`: run dry-run (must report 60 candidates — any other number, stop), then `--apply`, confirm `plaintext row count: 0`, then replace this line with the post-apply result.

## Pointers

### Linked payer/EHR reauthorization

Mobile reconnect notices use the payer-token broker, not the Fasten import widget. Each source needs its registered OAuth configuration under `SMART_<SOURCE>_CLIENT_ID`, `SMART_<SOURCE>_AUTHORIZATION_URL`, and `SMART_<SOURCE>_TOKEN_URL` (e.g. `SOURCE=CIGNA` or `EPIC`). Set `SMART_<SOURCE>_CLIENT_SECRET` only for confidential clients. Register `tabulamedica://payer-reconnect` for native callbacks, or configure `SMART_<SOURCE>_REDIRECT_URI` to the registered callback. Browser reconnection additionally requires `SMART_<SOURCE>_WEB_REDIRECT_URI` pointing to the HTTPS app entry point where Expo completes the auth popup. Optional `SMART_<SOURCE>_SCOPES` must include the source's read and offline-access scopes. Store secrets through the environment's secret manager; never commit values. Missing source configuration fails explicitly and does not clear the patient's reconnect notice. Authorization-code exchange and encrypted token replacement occur server-side.

- **FHIR R4 Standard:** [https://hl7.org/fhir/R4/](https://hl7.org/fhir/R4/)
- **Drizzle ORM Documentation:** [https://orm.drizzle.team/](https://orm.drizzle.team/)
- **React Native Documentation:** [https://reactnative.dev/docs](https://reactnative.dev/docs)
- **Expo Documentation:** [https://docs.expo.dev/](https://docs.expo.dev/)
- **Auth0 Healthcare Hardening:** [https://auth0.com/solutions/healthcare](https://auth0.com/solutions/healthcare)
- **GCP Vertex AI Docs:** [https://cloud.google.com/vertex-ai/docs](https://cloud.google.com/vertex-ai/docs)
- **GCP Cloud Run Deployment Guide:** `docs/CLOUD_RUN_DEPLOYMENT.md`
- **UI Modernization Handoff:** `exports/UI-MODERNIZATION.md`
- **WCAG 2.1 AA Guidelines:** [https://www.w3.org/WAI/WCAG21/quickref/](https://www.w3.org/WAI/WCAG21/quickref/)
