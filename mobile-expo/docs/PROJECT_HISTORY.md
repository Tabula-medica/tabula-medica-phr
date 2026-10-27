# Project History & Detailed Notes

This file holds the long-form historical context, resolved task narratives, and
detailed operational notes that used to live in `replit.md`. `replit.md` keeps the
durable, currently-relevant rules and points here for the full story.

## Search indexing submission preflight — 2026-10-25 (blocked)

**Submission date: not yet submitted. Search Console property URL: not yet
confirmed.** No Google Search Console or Bing Webmaster Tools connection was
available during this attempt; no submission or indexing success is claimed.

Live checks against `https://tabulamedica.health` found:

- `/sitemap.xml` returned HTTP 200 and parseable XML, but omitted all eight
  requested URLs: `/care/california`, `/care/texas`, `/care/florida`,
  `/care/new-york`, `/symptom-checker`, `/drug-savings`, `/find-free-care`,
  and `/insurance-learning`. The live sitemap differed from both sitemap sources
  in this repository.
- All eight page URLs returned HTTP 200. Their initial HTML JSON-LD contained no
  `FAQPage` nodes. This is not a rendered-page validation: client-side scripts
  could add markup after load.
- Opening Google's Rich Results Test for the California URL returned
  “Something went wrong — Log in and try again.” No Google Rich Results Test
  passes were obtained for any of the eight pages.
- This project's deployment metadata listed `https://tabulamedica.us` as primary,
  with `https://tabulamedica.world` and the Replit app domain as additional URLs;
  it did not list the `.health` domain. Confirm which hosting project serves
  `.health` before assuming changes here affect those live URLs.

To resume, confirm the intended canonical domain and the exact verified Search
Console property URL, resolve the live sitemap/content mismatch in the owning
hosting project, and use authorized Search Console and Bing Webmaster Tools
sessions to submit the sitemap. Run Google's Rich Results Test on all eight
rendered URLs and record the result links, actual submission date, and verified
property URL here. Do not replace these pending statuses with success until
confirmed by the external services.

Sitemap submission aids discovery but does not guarantee indexing, AI Overview
citations, or knowledge-panel inclusion. Valid FAQPage markup also does not
guarantee FAQ rich results; Google limits eligibility to well-known,
authoritative government- or health-focused sites. References:
[Google sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap),
[Google FAQPage guidance](https://developers.google.com/search/docs/appearance/structured-data/faqpage),
[Bing sitemap submission](https://www.bing.com/webmasters/help/sitemaps-3b5cf6ed).

## App Store metadata push — full safeguards

`scripts/push-asc-metadata.mjs` wraps `eas metadata:push`. All four reviewer fields
in `apple.review` (`demoAccountName`, `demoAccountPassword`, `email`, `phone`) are
stored in the committed `store.config.json` as the sentinel string
`"SET_VIA_ENVIRONMENT_SECRET"` so nothing reviewer-facing can ever be pushed from the
bare config. The wrapper substitutes the env-supplied values into `store.config.json`,
runs `eas metadata:push`, then restores the placeholder file from a temp backup in a
`finally` block (even on failure) — credentials are never committed to the repo.

iOS-only scope is enforced structurally: the wrapper fails if `store.config.json`
contains an `android` / `googlePlay` block, and rejects `--platform <non-ios>` if
passed. (The `--platform ios` flag is not forwarded to eas because the current
`eas metadata:push` beta CLI does not accept it; metadata is iOS-only by virtue of the
apple-only config.) The wrapper also refuses to push if any field is still the
sentinel, if `apple.review.phone` / `apple.review.email` match known dummy patterns
(`+18005551234`, the `555-01xx` fictional range, `support@tabulamedica.health`,
`example.com/org`), or if `apple.review.notes` contains any of those same dummy contact
patterns embedded in the free-text reviewer instructions. Extra args are passed through
to `eas` (e.g. `… push-asc-metadata.mjs --json`).

Required env vars: `APPLE_REVIEWER_DEMO_EMAIL`, `APPLE_REVIEWER_DEMO_PASSWORD`,
`APPLE_REVIEW_CONTACT_EMAIL`, `APPLE_REVIEW_CONTACT_PHONE`. Optional overrides:
`APPLE_REVIEW_CONTACT_FIRST_NAME`, `APPLE_REVIEW_CONTACT_LAST_NAME`. Store the four
required values in EAS secrets (`eas secret:create --scope project --name … `) or the
CI secret store; never in shell history or the repo.

**Pre-push reviewer login verification (Task #124):** Before injecting credentials and
invoking `eas metadata:push`, the wrapper does a live `POST /api/auth/login` against the
production backend using `APPLE_REVIEWER_DEMO_EMAIL` / `APPLE_REVIEWER_DEMO_PASSWORD`
and aborts the push on anything other than HTTP 200 with an `accessToken` in the body —
so if Apple's reviewer account has been password-rotated, disabled, locked out, or the
login contract regresses, we fail locally/in-CI instead of waiting for a rejection
email from App Review. Tunables: `REVIEWER_LOGIN_API_BASE` (defaults to
`https://api.tabulamedica.health`) and `SKIP_REVIEWER_LOGIN_CHECK=1` as an emergency
escape hatch (logs a WARN; only use when the runner genuinely can't reach prod and you
have already verified the reviewer login by hand). The check has a 15s timeout and
surfaces hints for common failure codes (401 = rotated/disabled, 423 = lockout,
403 = TLS/policy, 5xx = backend). `scripts/smoke-test-reviewer-login.sh` is still
available for manual ad-hoc verification.

## Server regression tests — detail

`npm run test:server` runs every `*.test.ts` under `server/__tests__/` via
`node --import tsx` (see `scripts/run-server-tests.mjs`). Coverage includes the GCIP
auth path (`auth-gcip.test.ts`), the `requireAuth` middleware (`require-auth.test.ts`),
the AI-policy HIPAA guardrail (`ai-policy.test.ts`), and web host routing
(`web-host-routing.test.ts`). (`auth0-gcip-migration.test.ts` was deleted in Task #115.)
Wired into CI as a blocking `server-tests` job in `.github/workflows/ci-cd.yml` (runs on
every push and PR to any branch) and as a deploy gate in
`.github/workflows/deploy-cloudrun.yml` — failures block the Cloud Run deploy. New
server-side regression tests added to that directory are picked up automatically.

## AI Provider Strategy — full detail

All production server-side AI inference flows through `chatComplete()` in
`server/ai-client.ts`, which routes to Google Vertex AI (Gemini) under the existing GCP
BAA. The legacy OpenAI-shaped templates under `server/replit_integrations/` and the
fail-closed shim `server/utils/disabled-openai-stub.ts` were deleted in Phase 4 cleanup
(Task #88); every prior call site using `new OpenAI(...)`,
`openai.chat.completions.create(...)`, or `openai.audio.transcriptions.create(...)` has
been migrated. Audio transcription routes through `transcribeMedicalAudio()` in
`server/gcp-medical-speech.ts` (also under the GCP BAA); OpenAI Whisper is no longer used
for any PHI. A boot-time `assertEnvPolicy()` guard refuses to start the server in
production if any `AI_INTEGRATIONS_OPENAI_*`, `AI_INTEGRATIONS_GEMINI_*`, or
`AI_INTEGRATIONS_ANTHROPIC_*` env var is present. The CI guardrail in
`server/__tests__/ai-policy.test.ts` enforces that no file can reintroduce imports from
`replit_integrations/` or `disabled-openai-stub`, and that there is no direct
OpenAI/Vertex SDK usage outside the adapter allow-list.

## Web Frontend Compatibility Layer (Task 2026-05-23 consolidation)

The separate React+Vite web project (serving www/app/portal.tabulamedica.health) was
consolidated onto this mobile Express backend to eliminate a duplicate server + Postgres
(~50% compute savings). `server/routes/web-compat-aliases.ts` provides 6 URL-rewrite
aliases for endpoint renames (`/api/auth/gcip/session`→`/api/auth/gcip`,
`/api/auth/user`→`/api/auth/me`, `/api/auth/mfa/status`→`/api/security/mfa/status`,
`/api/mfa/confirm`→`/api/security/mfa/confirm`,
`/api/mfa/backup-codes/regenerate`→`/api/security/mfa/generate-backup-codes`,
`/api/mfa/resend`→`/api/security/mfa/enroll`) plus real handlers for `POST /api/logout`
(deletes from `sessionManagement.sessionToken`) and `GET/PATCH /api/user-profile`
(backed by `storage.getUser`/`updateUser`; phone field is no-op until a schema
migration). CORS origins for `www`/`app`/`portal.tabulamedica.health` and
`tabula-medica-web-verion.replit.app` were added to `server/index.ts`. iOS app remains
hardcoded to `api.tabulamedica.health` and is unaffected.

## Web Frontend Source Co-located (Task 2026-05-28)

The web client (previously a separate Replit project at
`tabula-medica-web-verion.replit.app`) now lives in this repo under `web/` as an **npm
workspace** (`web/package.json` name=`tabula-medica-web`, root `"workspaces": ["web"]`).
Their `server/` tree was discarded — our Express server in `server/index.ts` is
canonical for both web + mobile. Build pipeline: `npm run build:web` invokes `vite build`
inside the workspace and emits `dist/web/` at repo root. Dev pipeline: `npm run dev:web`
runs Vite on its default port (5173) independently of the Expo Metro+Express dev workflow
on 5000/8081. Express host-routing in `server/index.ts` (production branch): a
`WEB_HOSTS` set (`www|app|portal.tabulamedica.health` + the legacy preview host)
short-circuits requests on those hosts to serve `dist/web/index.html` SPA via history-API
fallback, BEFORE the existing Expo `dist/` static middleware — so web hosts never serve
the mobile bundle, and EAS / api.* clients never see the web SPA. The 27 deps that
overlap with root (notably React 18.3 vs root's React 19) are isolated inside
`web/node_modules/` by npm's workspace hoist rules, so the mobile Expo tree is untouched.
`web/` is in `.easignore` so EAS mobile builds never ingest it.

**Production safety:** if `dist/web/` is missing at boot, the server logs a WARN and web
hosts return HTTP 503 `{code:"WEB_BUNDLE_MISSING"}` rather than silently falling through
to the Expo bundle. The host/path routing matrix (web hosts serve SPA;
`api.tabulamedica.health` never serves SPA; `/api`/`/webhooks` always fall through to
handlers) is extracted into `server/web-host-routing.ts` and locked down by
`server/__tests__/web-host-routing.test.ts` (12 assertions, wired into
`npm run test:server`). `metro.config.js` blockList excludes `web/` so the Vite React-18
tree never enters the Metro/RN resolver.

**Resolved follow-ups:**
- **(a) API routing — RESOLVED 2026-05-29 via hosting-only consolidation.** Audit found
  the web client calls ~2,137 distinct `/api/*` endpoints but the mobile Express backend
  only implements ~75 of them (~2,062 have NO handler — whole namespaces like
  `infrastructure`, `caregiver`, `survivorship`, `policy-lifecycle`, `diabetes`,
  `advanced-reporting`, `ai-care-plan`, `ai-document-generation`, `fhir-api-integration`
  are absent). Root cause: the web app's real backend was the discarded standalone
  `server/` tree; the mobile backend is a different API surface. **Decision (per product
  owner): keep the two backends SEPARATE — consolidate frontend hosting only, route web
  API traffic back to the web app's own dedicated backend.** Implemented in the web client
  via `web/client/src/lib/api-base.ts`: a build-time `VITE_API_BASE_URL` env var + a
  global `fetch` interceptor (`installApiBaseInterceptor()`, wired in
  `web/client/src/main.tsx`) that rewrites every root-relative `/api` and `/webhooks`
  request to the dedicated backend origin and forces `credentials: "include"`; plus
  `resolveWsUrl()` repointing the 4 `/ws*` WebSocket builders (`use-fhir-event-stream`,
  `use-messaging-websocket`, `clinician-video-room`, `video-room`). The interceptor is a
  single chokepoint covering `apiRequest`, the TanStack `getQueryFn`, and all ~40 direct
  `fetch("/api/...")` call sites without editing each. **When `VITE_API_BASE_URL` is
  unset it is a no-op (same-origin) — so set it to the dedicated web backend's URL at web
  build/deploy time** (`VITE_API_BASE_URL=https://<dedicated-web-backend-host> npm run
  build:web`). The dedicated backend MUST send CORS `Access-Control-Allow-Origin: <web
  host>` + `Access-Control-Allow-Credentials: true` for the web origins so credentialed
  cross-origin calls succeed. The mobile Express backend is untouched.
- **(b)** `web/client/src/pages/medical-scribe.tsx` imports
  `../../replit_integrations/audio/useVoiceRecorder` — this module DOES exist at
  `web/client/replit_integrations/audio/useVoiceRecorder.ts` (a complete MediaRecorder
  hook); the earlier "not ported / will throw at runtime" claim was a false alarm.
- **(c)** Vite production bundle has an ~895 KB main chunk (~242 KB gzip); chunk-size
  warning emitted but acceptable for now.

## Auth0 retirement (Tasks #71, #104, #115)

- **User login + per-user Auth0 ID storage RETIRED (Tasks #71, #104).** The three legacy
  endpoints (`/api/auth/auth0-config`, `/api/auth/auth0`, `/api/auth/auth0/exchange`)
  respond HTTP 410 `{ code: "auth0_user_login_retired" }`. `users.auth0_id` column was
  dropped; `external_identities` rows with `provider="auth0"` were deleted; payer tokens
  moved to `payer_token_connections` (encrypted with `PHI_ENCRYPTION_KEY`) via
  `migrations/0002_payer_token_connections.sql`. Do not reintroduce: `signInWithAuth0`,
  `api.auth.auth0`, `AUTH0_BAA_EXECUTED`, `storage.getUserByAuth0Id`,
  `scripts/migrate-auth0-to-gcip.ts`, `AUTH0_MGMT_*`, or the deleted files
  (`server/auth/auth0-verify.ts`, `server/auth0-healthcare-hardening.ts`). Auth0 imports
  remain only in `server/auth0-fhir-broker.ts` (OIDC issuer URL via `AUTH0_DOMAIN` only)
  and `server/uninsurance-token-verifier.ts`.
- **Bulk-migration tooling RETIRED (Task #115).** No `users.auth0_id` column or Auth0-only
  DB rows exist anymore, so a bulk migration has no source of truth. Do not reintroduce
  `scripts/migrate-auth0-to-gcip.ts`, `storage.getUserByAuth0Id`, `users.auth0_id`,
  `GET /api/ops/auth0-gcip-migration`, `server/auth0-gcip-migration-routes.ts`, or
  `server/__tests__/auth0-gcip-migration.test.ts`. Follow-on monitoring tasks #111/#112
  are closed for the same reason.

## Firebase Identity Platform (GCIP) — sole user-login IdP (Tasks #68, #71)

GCIP is the only HIPAA-compliant identity provider wired into user login. The
`external_identities` table (`shared/schema.ts`) decouples auth provider sub from
internal `users.id`. Server-side verification lives in `server/auth/gcip.ts` (uses
`jose` — `createRemoteJWKSet` + `jwtVerify`). `server/middleware/require-auth.ts` accepts
a raw GCIP/Firebase JWT first, then falls back to one of our opaque session tokens
(covers Apple + email/password sessions and GCIP-exchange sessions). Each request gets
`req._authProvider = "gcip" | "session"` and an `x-auth-provider` response header for log
tagging. `POST /api/auth/gcip` accepts a Firebase ID token and mints one of our session
tokens. Client side: `client/lib/gcip.ts` lazy-loads `firebase/app` + `firebase/auth`;
`useAuth.ts` `signInWithEmail` / `signUpWithEmail` / `signInWithGoogle` route through
GCIP when `EXPO_PUBLIC_GCIP_*` envs are set, falling back to the legacy local users-table
endpoints otherwise. Auto-link on first GCIP sign-in is gated by
`email_verified === true` (account-takeover defense). Boot-time
`runIdempotentMigrations()` applies `migrations/0001_external_identities.sql` and
`migrations/0002_payer_token_connections.sql`. **Required env in prod:** `GCIP_PROJECT_ID`
(server), `EXPO_PUBLIC_GCIP_API_KEY` / `EXPO_PUBLIC_GCIP_AUTH_DOMAIN` /
`EXPO_PUBLIC_GCIP_PROJECT_ID` (client). SMART-on-FHIR / TEFCA still uses Auth0 per
architecture decision (server-only broker, not a user-login path).

## AI duplicate-matching degraded — on-call alerting (Task #220)

### Sustained-degradation reminders

After the fifth consecutive AI failure opens an incident, the same `sendOpsAlert`
helper sends a critical **STILL DEGRADED** reminder every **30 minutes**, including
elapsed hours/minutes since the degraded threshold was crossed. There is one
timer per incident per server process; continued failures do not create timers or
send extra pages. Reminders continue even without new comparison traffic, meaning
the message reports that no AI recovery has been observed, not a new health probe.
The first successful AI comparison cancels the timer, clears its start time, and
sends the existing **RECOVERED** alert. A later incident starts a fresh cadence.
Delivery failures/missing Slack configuration retain the same bounded cadence
rather than causing rapid retries.

This is an in-process, best-effort reminder: it does not survive process restarts,
run while a Cloud Run instance is suspended/scaled to zero, or coordinate pages
across instances. The timer is unreferenced so it cannot keep a process alive.
External monitoring is still needed to cover an unavailable app process.

Task #134 made AI-path degradation observable (the `[VertexDedup] AI matching
DEGRADED` log line + the authenticated `aiMatchingDegraded` field on
`GET /api/phr/dedup/status`), but nobody was paged. Task #220 wires the
degrade/recovery state transitions in `server/vertex-deduplication-service.ts`
into `sendOpsAlert()` (`server/utils/ops-alert.ts`), which posts to the team's
existing Slack incoming webhook — **no new secret is introduced.**

**Threshold:** the alert fires the moment `consecutiveAiFailures` first reaches
`AI_DEGRADED_ALERT_THRESHOLD` (currently `5`) consecutive AI-path failures
(Vertex provider error, AI-policy block, or unparseable response) — the same
threshold that flips `aiMatchingDegraded` true. It fires **once** per degraded
episode (guarded by `aiDegradedAlertActive`), not per failing comparison, so a
sustained outage produces one page, not a flood.

**Auto-resolve:** the next successful AI comparison resets the streak and emits a
`resolved` "AI duplicate-matching RECOVERED" alert, then clears the flag.

**Routing:** delivery uses `SLACK_WEBHOOK_URL` (the same secret already used by
the SOC 2 remediation notifier and the CI deploy notifier — see
`docs/CLOUD_RUN_DEPLOYMENT.md`). The target channel defaults to `#engineering`
and is overridable via `OPS_ALERT_SLACK_CHANNEL`. When `SLACK_WEBHOOK_URL` is
unset (local/dev, BAA-restricted envs) the helper is a safe no-op that only logs
(`skipped`). Delivery is fire-and-forget: `sendOpsAlert()` never throws and never
blocks the dedup comparison loop; a non-2xx/failed webhook degrades to a logged
warning (`failed`). The high-severity log line remains, so a GCP Cloud Monitoring
log-based metric/alert on `"AI matching DEGRADED"` can be layered on top as a
backstop without code changes.

**Tests:** `server/__tests__/dedup-ai-degradation-alert.test.ts` (picked up by
`npm run test:server`) injects a fake `fetch` via
`__setOpsAlertFetchImplForTesting` and asserts the no-op/sent/failed outcomes plus
the single-DEGRADED / single-RECOVERED transition behaviour. Run directly:
`node --import tsx server/__tests__/dedup-ai-degradation-alert.test.ts`.

## Branch-protection hard-failure verification — 2026-06-17

The "Assert all critical CI jobs are in branch-protection required-checks" step in
`.github/workflows/ci-cd.yml` has two enforcement modes that needed local verification:

**Hard mode (GitHub App token present — `APP_TOKEN_AVAILABLE=true`):**
- API returns 401 or 403 → step exits 1 (app misconfigured or missing permission)
- API returns 200 but any of `server-tests`, `jest-tests`, `reviewer-login-gate`, or
  `script-tests` is absent from the required-checks list → step exits 1

**Soft mode (no App token — fork / `GITHUB_TOKEN` fallback, `APP_TOKEN_AVAILABLE=false`):**
- API returns 403 (expected — GITHUB_TOKEN lacks repo-administration scope) → step exits 0
  with a loud WARNING annotation only; job does not fail so forks remain usable

### Smoke-test runbook

`scripts/smoke-test-branch-protection-check.sh` is a self-contained script that
replicates the exact bash + Python logic from the CI workflow step and exercises all
four scenarios with injected HTTP status codes and canned JSON payloads — no live GitHub
API call or real GitHub App credentials required.

```
bash scripts/smoke-test-branch-protection-check.sh
```

**Test cases:**

| TC | HTTP status | APP_TOKEN_AVAILABLE | Expected exit | Failure mode verified |
|----|-------------|---------------------|---------------|-----------------------|
| 1  | 403         | true                | 1             | App misconfigured / missing "Administration: Read" permission |
| 2  | 403         | false               | 0             | Fork / GITHUB_TOKEN soft-warning path |
| 3  | 200         | true                | 1             | `server-tests` absent from required-checks list |
| 4  | 200         | true                | 0             | All four gates present — healthy state |

### Verified result (2026-06-17)

All four test cases passed:

```
Branch-protection check smoke test
===================================

TC1: HTTP 403 + APP_TOKEN_AVAILABLE=true  (bad/missing app permission)
       Expected: exit 1 (hard fail — app misconfigured)
  PASS  TC1 (exit 1)

TC2: HTTP 403 + APP_TOKEN_AVAILABLE=false (fork / GITHUB_TOKEN fallback)
       Expected: exit 0 (soft warning only)
  PASS  TC2 (exit 0)

TC3: HTTP 200 + server-tests absent from required-checks list
       Expected: exit 1 (required check removed)
FAIL: 1 critical CI gate(s) missing from required-status-checks: server-tests
  PASS  TC3 (exit 1)

TC4: HTTP 200 + all four critical gates present
       Expected: exit 0 (healthy state)
OK: all critical CI gates confirmed in branch-protection required-status-checks for 'main'.
  PASS  TC4 (exit 0)

===================================
Results: 4/4 passed

SMOKE TEST PASSED — all hard-failure paths verified correct.
```

**Conclusion:** enforcement is live. With `GH_APP_ID` / `GH_APP_PRIVATE_KEY` secrets
configured, any PR run where (a) the app token is misconfigured or (b) any of the four
critical gates is removed from required-checks will exit 1 and block the merge. The fork
soft-warning path (TC2) correctly avoids blocking contributors who don't have access to
org secrets.

To re-run the smoke test after any future change to the CI step logic, run
`bash scripts/smoke-test-branch-protection-check.sh` locally. It exits 0 only when all
four hard/soft paths behave as specified.

## Record-creation 500 — DEPLOY UNBLOCKED 2026-05-23

Prod `GET /api/version` returns `sha=51a6813` (built 2026-05-21), and
`git merge-base --is-ancestor 3a67201 51a6813` passes — the Task #13 hardening
(`server/routes/create-record-handler.ts`) is live. The Cloud Run deploy pipeline that
was failing on `secrets.GCP_WORKLOAD_IDENTITY_PROVIDER` was repaired, and the
Replit→GitHub mirror is publishing again. **Action:** run
`REVIEWER_EMAIL=… REVIEWER_PASSWORD=… node scripts/canary-create-record.mjs` against prod
and grep for the `[Records] …` lines to close the original Task #95 symptom. Historical
diagnosis (Task #95) ruled out schema drift, encryption-key mismatch, and gamification
side-effects — do not reopen as a root-cause hunt without first confirming an actual
`[Records] storage.createHealthRecord failed:` line in prod logs.
