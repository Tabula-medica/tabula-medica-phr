# Auth0 vs Firebase / Identity Platform — Decision Memo
**Date:** 2026-05-06  **Decision needed by:** End of Wave-1A week 1  **Status:** Recommendation pending product sign-off

## Why this matters
The Wave-1A compliance closeout requires **a Business Associate Agreement covering all PHI-touching identity flows**. Auth0 default plans do **not** include a BAA. Two paths forward; the cost and engineering blast radius differ by an order of magnitude. This decision cascades through SOC 2 evidence collection, sub-processor list, and the multi-region rollout.

## Option A — Stay on Auth0, sign Enterprise BAA

| Dimension | Detail |
|---|---|
| Annual cost | ~$25K–$40K at our user count (Auth0 Enterprise, healthcare add-on for BAA) |
| Migration effort | None |
| Time to compliance | 2–6 weeks (legal negotiation only) |
| Sub-processor count | +1 (Okta as PHI processor) |
| Multi-region | Auth0 has EU and APAC tenants; covers Wave-1B and 1C cleanly |
| MFA | TOTP, SMS, Push, WebAuthn — already wired |
| SAML for Enterprise tier | First-class support |
| Risk | Vendor lock-in; Okta security incidents in 2022–2024 |

## Option B — Migrate to Firebase Auth / Google Cloud Identity Platform

| Dimension | Detail |
|---|---|
| Annual cost | ~$0–$5K (covered by GCP commit; per-MAU pricing is ~$0.0055 above 50K MAU) |
| Migration effort | 4–8 engineering weeks |
| Time to compliance | 8–12 weeks |
| Sub-processor count | 0 new — covered by existing Google Cloud BAA |
| Multi-region | Identity Platform is global, single endpoint |
| MFA | TOTP and SMS supported; WebAuthn via Identity Platform |
| SAML for Enterprise tier | Identity Platform supports SAML and OIDC at $0.015/MAU above tier |
| Risk | Engineering opportunity cost; downtime risk during user-table migration |

## Auth0 touch points (engineering blast radius if we migrate)

**Server (16 files):**
- `server/replit_integrations/auth/replitAuth.ts` — primary OIDC flow with Passport
- `server/replit_integrations/auth/routes.ts` — login/logout/callback
- `server/services/auth0-identity-service.ts` — MFA enrollment, user CRUD
- `server/routes/auth0-identity-routes.ts` — admin endpoints
- `server/mobile-api-routes.ts` — mobile JWT issuance + verification
- `server/middleware/require-feature.ts` — reads `req.user.sub`
- `server/security/api-protection.ts`, `server/security/mobile-security.ts`, `server/security/compliance-validator.ts`
- `server/routes/beta-consent-routes.ts`, `server/routes/ccpa-routes.ts`, `server/routes/compliance-dashboard-routes.ts`
- `server/services/gcp-secret-manager.ts` (only reads AUTH0_* env vars)
- `server/services/hitrust-csf-mapping-service.ts` (control mapping doc)
- `server/gcp-architecture-routes.ts`, `server/routes.ts`

**Mobile (1 file):**
- `tabula-medica-mobile/src/services/auth.ts`

**Frontend:**
- Auth0 SDK only used implicitly via session cookies; minimal client-side surface.

## Migration LOE if we choose Option B (week-by-week)

### Week 1 — Spike + design
- Stand up Identity Platform tenant in `tabula-medica-prod` GCP project.
- Configure email+password, Google SSO, SAML-for-Enterprise providers.
- Design user-table mapping: Auth0 `sub` (`auth0|abc123`) → Firebase `uid`.

### Week 2–3 — Server-side dual-write
- Implement Firebase Admin SDK initialization in `server/replit_integrations/auth/`.
- Build dual-write: every Auth0 login also creates/updates the Firebase user.
- Issue both Auth0 and Firebase ID tokens; verify either at the API layer.

### Week 4–5 — Mobile + frontend cutover
- Mobile: swap Auth0 SDK for Firebase Auth React Native SDK.
- Web: swap Auth0 React SDK for Firebase Auth web SDK.
- Migrate session middleware to verify Firebase ID tokens.

### Week 6 — User backfill
- Bulk-import Auth0 users via `firebase auth:import` (passwordless re-link via email; passwords cannot be migrated without scrypt hash export from Auth0 Enterprise).
- Notify users to re-authenticate; ~30% friction expected.

### Week 7 — MFA re-enrollment
- Force re-enrollment of TOTP/WebAuthn factors (cannot migrate secrets).
- Communicate at least 14 days in advance.

### Week 8 — Auth0 sunset
- Disable Auth0 logins; keep tenant for 30 days as escape hatch.
- Remove Auth0 SDK, env vars, sub-processor entry.

## Recommendation: **Option A (stay on Auth0, sign Enterprise BAA)** — for now

**Rationale:**
1. **Time-to-compliance dominates cost.** SOC 2 T1 in Q3 2026 is ~16 weeks away. Auth0 BAA closes in 2–6 weeks. Option B closes in 8–12 weeks plus a bumpy user re-auth event right before audit. Wrong time for that.
2. **Engineering opportunity cost.** 4–8 weeks of identity migration is 4–8 weeks not spent on Vertex migration, USCDI v4, multi-region infra, or Brazil/Mexico launch.
3. **Cost delta is modest.** ~$25K/yr is well under 10% of the compliance envelope.
4. **WebAuthn parity.** Auth0 already has WebAuthn for our healthcare workforce use case. Identity Platform's WebAuthn is newer and less battle-tested.

**Revisit Option B in 2027** after SOC 2 T2 is in observation, when:
- Vertex migration is complete (no other GCP-side migration distractions).
- Multi-region is live (we'd benefit more from Identity Platform's global endpoint).
- Enterprise tier MRR is funding the engineering team.

## Action items if Option A is chosen
- [ ] Procurement: open Auth0 Enterprise BAA negotiation — target close in 4 weeks.
- [ ] Set `AUTH0_AUDIENCE` env var (currently in missing_secrets list).
- [ ] Update Trust Center sub-processor table: Auth0 BAA "Pending → Signed".
- [ ] Add Auth0 to SOC 2 vendor management evidence pack.
- [ ] Document MFA enforcement policy in ISP.

## Action items if Option B is chosen
- [ ] Engineering lead confirms 4–8 weeks of capacity through end of June.
- [ ] User communication plan drafted for forced re-auth.
- [ ] Identity Platform tenant provisioned with CMEK.
- [ ] Risk acceptance memo for ~30% user churn during migration window.
