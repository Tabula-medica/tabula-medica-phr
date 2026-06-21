# GCIP Migration Plan — Auth0 → Google Cloud Identity Platform

**Status:** DRAFT — awaiting sign-off before execution
**Owner:** Engineering
**Supersedes:** `docs/auth0-vs-firebase-decision.md` (Option A: stay on Auth0) — REVERSED
**Date:** 2026-05-11

---

## 1. Decision

Migrate authentication from **Auth0** to **Google Cloud Identity Platform (GCIP)**.

**Reason:** Auth0 BAA is gated behind Enterprise tier pricing that does not fit the freemium-funded runway. GCIP is explicitly on Google's HIPAA-eligible services list and is already covered under the existing Google Cloud BAA already in force for Vertex AI and Healthcare API. Net effect: one vendor, one BAA, no incremental compliance contract.

**Note on naming:** "Firebase Auth" and "GCIP" share the same SDK surface and console. Only **GCIP** (the GCP-billed enterprise SKU, enabled per GCP project) is BAA-covered. Plain Firebase Auth is not. All references below mean GCIP, accessed via the Firebase / Identity Toolkit SDKs but provisioned as a GCIP tenant under the BAA-covered GCP project `united-planet-485003-n7`.

---

## 2. Current Auth0 Surface (Inventory)

~25 files, ~1,200 LOC. See `.local/explore-output` history for the full file list. Key clusters:

| Cluster | Files | Notes |
|---|---|---|
| Server core | `server/replit_integrations/auth/replitAuth.ts`, `server/index.ts` | passport + openid-client, Postgres session store via `connect-pg-simple` |
| Middleware | `server/replit_integrations/auth/replitAuth.ts:422` (`isAuthenticated`), `server/middleware/rbac-authorization.ts` (`requireRole`) | Used by ~40 route files (just hardened in Tasks #39–#44) |
| Mobile API | `server/mobile-api-routes.ts:64` (`verifyAuth0Token`), `:259` (audit) | Dual: local JWT signed by `SESSION_SECRET` + raw Auth0 token via `jose.createRemoteJWKSet` |
| Mobile client | `tabula-medica-mobile/src/services/auth.ts` | Expo Auth0 client |
| Frontend | `client/src/hooks/use-auth.ts`, `/api/login`, `/auth/callback` | Server-proxied; frontend has no direct Auth0 SDK call |
| Identity stamping | `users.id = auth0_sub` (PK), `production-logger.ts:168`, audit logs | **Schema-coupled** |
| SMART-on-FHIR | `server/services/ehr-integration-service.ts`, `server/routes.ts:418` | Uses `fhirUser` claim and `launch/patient` scope on downstream EHR OAuth |
| Infra | `terraform/main.tf` (Auth0 secrets in GCP Secret Manager) | Decommission after cutover |
| Packages | `openid-client`, `jose`, `passport-openidconnect`, `@auth0/auth0-react` (unused) | `jose` stays (still useful); others can go |
| Env vars | `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_BASE_URL`, `AUTH0_AUDIENCE` (missing) | Decommission after cutover |

---

## 3. Critical Risk: User Identity Migration

`users.id` is currently the Auth0 `sub` claim (e.g. `auth0|abc123` or `google-oauth2|xyz`). Every foreign key in the system — patient records, audit logs, share grants, AI request ownership, RBAC assignments, sessions — points at this string.

**GCIP issues a different `sub`** (a Firebase UID, e.g. `aB3xY9...`). We cannot just swap auth providers and expect users to land back on their data.

**Strategy:** add a `users.external_identities` lookup table mapping (provider, external_sub) → internal `users.id`. Keep the existing `users.id` as a stable internal ID. Auth resolution becomes a two-step lookup. This decouples future auth changes from the schema.

Migration of existing users:
1. Match by **verified email** (Auth0 → GCIP user import supports email-as-key).
2. Bulk export Auth0 users → GCIP import via `gcloud identity-platform users:import` (supports password hash migration for native users; OIDC/Google-federated users re-link automatically on first GCIP login).
3. Stamp the Auth0 sub into `external_identities` so existing FK references continue to resolve.

---

## 4. Phased Cutover

### Phase 0 — Prep (no user-visible change) — 0.5 day
- Provision GCIP tenant on GCP project `united-planet-485003-n7`
- Verify GCIP appears under the project's BAA coverage in GCP console
- Add `external_identities` table to schema (Drizzle migration)
- Backfill `external_identities` rows from existing `users.id` (provider=`auth0`)
- Set up GCIP Admin SDK credentials (service account JSON, store as `GCIP_SERVICE_ACCOUNT_JSON` secret)
- Configure GCIP allowed redirect URIs and domains

### Phase 1 — Parallel verification (no user-visible change) — 1 day
- New module `server/auth/gcip.ts` exposing `verifyGcipToken(token)` mirroring `verifyAuth0Token`
- `isAuthenticated` and mobile bearer validation accept **either** Auth0 or GCIP tokens; resolve to internal `users.id` via `external_identities`
- Logging tags which provider validated each request — used as cutover dashboard
- All 40+ secured routes keep working unchanged (they call `isAuthenticated`, not provider-specific code)

### Phase 2 — Frontend & mobile cutover — 1 day
- Frontend: replace `/api/login` redirect with GCIP web SDK (`signInWithPopup` / `signInWithRedirect` for Google, email/password)
- Mobile: replace Auth0 Expo client with `@react-native-firebase/auth` configured against the GCIP tenant
- New users only: hit GCIP. Existing users with Auth0 sessions: continue working until session expiry (parallel-run window).

### Phase 3 — User migration — 1 day
- Bulk export Auth0 users (CSV with email, name, provider, sub, hashed password if local)
- `gcloud identity-platform users:import` into GCIP tenant
- For each migrated user, ensure `external_identities` has both auth0 and gcip rows pointing at the same internal `users.id`
- Email all users a one-time "we've upgraded our login system, sign in again" notice (optional — sessions just expire)

### Phase 4 — Auth0 decommission — 0.5 day
- Stop accepting Auth0 tokens (delete `verifyAuth0Token`, remove passport strategy)
- Remove `@auth0/*`, `passport-openidconnect`, `openid-client` from dependencies
- Delete Auth0 secrets from Replit + GCP Secret Manager
- Remove Auth0 module from `terraform/main.tf`
- Update SMART-on-FHIR `fhirUser` claim wiring to read from GCIP custom claims
- Reverse `docs/auth0-vs-firebase-decision.md` (mark as superseded)
- Update `replit.md` and `threat_model.md`

### Phase 5 — Verification — 0.5 day
- E2E test: signup, login, logout, password reset, social login (Google, Apple), mobile login, SMART-on-FHIR launch, role-protected route, share-link claim
- Audit log spot-check: actor IDs resolve to internal `users.id`, not raw GCIP sub
- Penetration smoke: token from wrong GCP project rejected, expired token rejected, missing audience rejected

**Total: ~3.5–4.5 days of focused work.**

---

## 5. Rollback Plan

Each phase is independently revertable up through Phase 4:
- **Phase 0–1**: pure additive; no rollback needed
- **Phase 2**: revert frontend/mobile commits; Auth0 still accepted server-side
- **Phase 3**: GCIP user import is non-destructive to Auth0; Auth0 tenant remains live
- **Phase 4**: point of no return — keep Auth0 tenant in suspended-but-restorable state for 30 days before deletion

---

## 6. SMART-on-FHIR Considerations

The `fhirUser` claim is the key binding for SMART launch context. GCIP supports custom claims via the Admin SDK (`setCustomUserClaims`). Plan:
- On first GCIP login, look up the user's FHIR Patient/Practitioner resource ID
- Stamp it as a custom claim: `{ fhirUser: "Patient/abc123" }`
- Update `server/services/ehr-integration-service.ts` to read from GCIP custom claims rather than Auth0 ID token claims

This is the only piece where the migration is more than a token-validator swap.

---

## 7. Open Questions Before Execution

1. **GCIP tenant region:** GCP project is `us-central1`. Confirm GCIP tenant should also be US-only (relevant for international wave-1 rollout: BR/MX/IN/PH/NG/ID — GCIP supports multi-region but pricing differs).
2. **Existing Auth0 user count:** how many real users to migrate? If <100 (current likely state), do it manually rather than via bulk import.
3. **Social providers:** which social logins are currently enabled in Auth0 (Google, Apple, Microsoft)? Each needs to be reconfigured in GCIP with OAuth client IDs from the respective provider consoles.
4. **Replit Auth integration:** the current path is `server/replit_integrations/auth/replitAuth.ts`. Is the Replit-managed auth piece itself wanted, or is GCIP fully replacing both Replit Auth and Auth0?

---

## 8. Sign-off Required

Before I start Phase 0, confirm:
- [ ] GCIP tenant will be provisioned on project `united-planet-485003-n7` (same project as existing GCP BAA)
- [ ] Phased cutover (not big-bang) is acceptable
- [ ] Open questions in §7 answered
- [ ] User-migration approach (`external_identities` lookup, bulk import) is acceptable
