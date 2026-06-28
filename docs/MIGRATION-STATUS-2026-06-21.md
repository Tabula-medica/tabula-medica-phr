# Tabula Medica — Refactor Status (verified 2026-06-21)

Verified against the 2026-05-24 export now in `~/repos/tabula-medica-phr`.
**Headline: the deprecated-stack rip-out is ~90% already done.** What remains is
bounded cleanup + 2 decisions + env config — all of which needs a **build
environment** (Mac / Linux / WSL / Cloud Shell) to verify safely. Do NOT edit
`package.json` deps without `npm install` to resync `package-lock.json`, or
`npm ci` will break.

## Decisions locked (2026-06-21)
- Pre-launch: **no user migration** needed (no real users).
- **GCIP only** — replaces both Auth0 and Replit-managed auth.
- Social logins: **email/password + Apple + Google**.
- GCIP tenant region: **US-only** (default; revisit for international rollout).

## Item-by-item actual state

### #1 Consolidate to Capacitor — ✅ DONE
Standalone Expo app archived to `~/repos/_archive/tabula-medica-mobile-expo-archived-20260621`; removed from repo.

### #2 Auth0 → GCIP — ~90% DONE
- ✅ Patient login is GCIP-only: `server/auth/gcip.ts` (verify), `server/auth/local-auth.ts` (email/pw), `replitAuth.ts` `isAuthenticated` GCIP-only, `/api/auth/gcip/session` exchange, legacy `/api/login` + `/auth/callback` redirect away from Auth0. Client `use-auth.ts` has no Auth0 SDK.
- ⬜ Remove unused deps `express-openid-connect`, `@auth0/*` (0 import sites) — **needs build env** (lockfile resync).
- ⬜ **DECISION NEEDED:** the SMART-on-FHIR / NMN / TEFCA subsystem still uses Auth0 as an OAuth2 *authorization server* (not patient login). Files: `server/middleware/auth0-jwt-verify.ts`, `server/routes/nmn-auth0-routes.ts`, `server/services/auth0-smart-fhir-service.ts`, `server/routes/tefca-oidc-bridge-routes.ts`, `client/src/pages/nmn-auth0-smart.tsx` (~109KB total). It is **env-gated OFF** (loads only if `AUTH0_ISSUER_BASE_URL` + `AUTH0_AUDIENCE` set). GCIP is NOT a drop-in SMART-on-FHIR authz server. Options: (a) defer/remove the NMN SMART-provider feature, or (b) replace the authz-server role (real design work). Until decided, it stays inert.

### #3 Medplum / Aidbox → Cloud Healthcare API — mostly DONE
- ✅ Cloud Healthcare API implemented: `server/services/gcp/cloudHealthcareApi.ts`, `gcp-healthcare-enhanced-service.ts`; selected via `FHIR_PROVIDER=cloud_healthcare_api`.
- ✅ Medplum already unwired: **0 import sites**. Dead files remain (`server/medplum-routes.ts`, `client/src/pages/medplum-fhir.tsx`) — likely dynamic-imported by `routes.ts`; verify before deleting.
- ⬜ Set `FHIR_PROVIDER=cloud_healthcare_api` in the deployed env (default is `mock`).
- ⬜ Drop Aidbox provider path + `@aidbox/node-server-sdk` dep — **needs build env**.
- ⬜ Remove `@medplum/*` deps — **needs build env**.

### #4 De-Replit — small
- `vite.config` does not reference `@replit/*` plugins. `@replit/*` remain in `package.json` (incl. `@replit/revenuecat-sdk`, used by RevenueCat gatekeeper — check before removing). Deploy target is already Cloud Run.

### #5 F1 PHI-encryption guardrail — IN PROGRESS
~84 violations remained of 102+ (per README). Security hardening, needs build/test.

### #6 Native iOS/Android builds — USER'S MAC ONLY
Capacitor + EAS; interactive, account-bound, macOS-required for iOS. Can't run from here.

## Why the rest can't be finished on the current (Windows) box
Every remaining item is verify-by-build: dependency removal (lockfile resync),
dead-file deletion (tsc typecheck), `FHIR_PROVIDER` cutover (run + FHIR smoke
test), F1 (test suite). Making these edits blind on a HIPAA app would risk
shipping a broken auth/PHI path. Run them in a build env (WSL/Linux/Cloud Shell/
Mac) where the agent can `npm ci`, `npm run check`, `npm test`, and deploy.
