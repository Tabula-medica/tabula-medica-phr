# Web Replit → Mobile Backend Consolidation Handoff

**Date:** 2026-05-23
**Goal:** Repoint the React+Vite web project (serving www/app/portal.tabulamedica.health) at the existing mobile Express backend (`api.tabulamedica.health`) and shut down the duplicate Web Replit's Express server + Postgres for ~50% compute savings.

---

## What the mobile backend now provides for the web client

The mobile backend already serves every endpoint the web client uses, either directly or through the new compatibility layer (`server/routes/web-compat-aliases.ts`):

### Direct endpoints (no aliasing needed)
- `POST /api/auth/login` — email/password
- `POST /api/auth/gcip` — GCIP/Firebase ID token exchange
- `GET /api/auth/me` — current user
- `POST /api/security/mfa/*` — MFA enroll/verify/status/backup-codes

### URL-rewrite aliases (web's old paths → mobile's canonical paths)
| Web frontend calls | Mobile backend handles |
|---|---|
| `POST /api/auth/gcip/session` | `POST /api/auth/gcip` |
| `GET /api/auth/user` | `GET /api/auth/me` |
| `GET /api/auth/mfa/status` | `GET /api/security/mfa/status` |
| `POST /api/mfa/confirm` | `POST /api/security/mfa/confirm` |
| `POST /api/mfa/backup-codes/regenerate` | `POST /api/security/mfa/generate-backup-codes` |
| `POST /api/mfa/resend` | `POST /api/security/mfa/enroll` |

### Net-new real handlers (added to mobile to match web's contract)
- `POST /api/logout` — hashes the bearer token with sha256, looks up the session in `userSessions`, and calls `storage.revokeUserSession(session.id)`. Standard `fetch('/api/logout', { method: 'POST' })` works fine (browsers auto-send `Content-Length: 0`). Do **not** call with bare `curl -X POST` and no headers — Cloudflare's OWASP ruleset rejects truly headerless POSTs at the edge with 403.
- `GET /api/user-profile` — returns `{displayName, email, phone, avatarInitials}` from real `users` row (replaces the Sarah Johnson stub the web project currently returns)
- `PATCH /api/user-profile` — updates `users.name` and `users.email`. **`phone` is silently accepted but not persisted** (no `users.phone` column yet — schema migration deferred until after App Store approval to avoid risk to the locked iOS submission).

### CORS allowlist (already added to mobile `server/index.ts`)
- `https://www.tabulamedica.health`
- `https://app.tabulamedica.health`
- `https://portal.tabulamedica.health`
- `https://tabula-medica-web-verion.replit.app` (Web Replit preview, for transition)

---

## What the Web Replit agent needs to do (in order)

### 1. Repoint the API base
In the web project's env config (Vite):
```
VITE_API_BASE=https://api.tabulamedica.health
```
Make sure no `fetch()` calls hardcode the old `tabula-medica-web-verion.replit.app` API.

### 2. Rename the one orphan endpoint call
Search the web codebase for any remaining calls to:
- `GET /api/user` → change to `GET /api/auth/me` (note: response shape is `{ user: {...} }` not the user directly)

The other 6 rename mismatches are already handled by aliases on the mobile side, so existing code can stay as-is.

### 3. Delete the GCIP test page
- Delete `client/src/pages/__gcip-test.tsx` (and any route referencing it). It was a dev-only sanity page; not needed against the consolidated backend.

### 3a. **REMOVE the "Continue with Auth0" button (compliance — MUST)**
The login page on `app.tabulamedica.health` currently renders a **"Continue with Auth0"** button. This is dead UI and a compliance issue:
- Auth0 user-login was retired in Task #71 (April 2026). The three legacy endpoints on the mobile backend (`/api/auth/auth0-config`, `/api/auth/auth0`, `/api/auth/auth0/exchange`) now return **HTTP 410** with body `{ "code": "auth0_user_login_retired" }`. Clicking the button will error out.
- Per the HIPAA architecture decision, the only user-login IdPs are **GCIP** (email/password + Google federated) and **Apple Sign-In** (iOS native). Auth0 stays in the codebase only as a server-side SMART-on-FHIR / TEFCA OIDC broker — **never** as a user-login path.

**Remove from the web frontend:**
- The "Continue with Auth0" button on the login/landing pages
- Any `signInWithAuth0` / `useAuth0` / `@auth0/auth0-react` / `@auth0/auth0-spa-js` imports
- Any client config referencing `AUTH0_DOMAIN` / `AUTH0_CLIENT_ID` / `auth0Config` (those are server-side broker-only)
- Any route or callback handler for `/callback`, `/auth0-callback`, etc. on the web side

Keep: the "Sign In" (email/password → GCIP), "Continue with Google" (GCIP federated), and "Try Demo" buttons. Apple Sign-In is iOS-only and should not appear on the web.

### 4. Verify GCIP/Firebase web config matches
Confirm the web project's `VITE_GCIP_*` (or equivalent Firebase web config) keys point to GCP project **`united-planet-485003-n7`** — the same project the iOS app and mobile backend use. If they currently point to a different project, tokens will be rejected by the mobile backend's `server/auth/gcip.ts` (`jose` JWKS verification ties to a specific project ID).

### 5. End-to-end smoke test on `app.tabulamedica.health`
After steps 1–4 deploy, run this full flow in the browser:
- **Login** — submit credentials, confirm a session token comes back and is stored
- **Session check** — refresh the page; confirm `GET /api/auth/me` returns the user and the UI stays authenticated
- **Profile** — open settings, confirm `GET /api/user-profile` returns the *real* user (not "Sarah Johnson")
- **Logout** — click logout, confirm `POST /api/logout` returns 200 and the session token is gone

### 6. Stop the Web Replit's Express server + Postgres
Only after step 5 is fully green. The Web Replit's Postgres has no production data (confirmed empty), so no migration is needed — just stop the workflow and unprovision the database to lock in the compute savings.

---

## ⚠️ Critical blocker — Cloudflare WAF rejects CORS preflights

**Mobile backend status (2026-05-23, post-deploy):** prod `api.tabulamedica.health` now runs `sha=bb576b4` ✓. Aliases verified live: `POST /api/mfa/confirm` → 401 from app (rewrite working), `GET /api/user-profile` → 401 from app. Web-compat code is deployed correctly.

**But:** `OPTIONS /api/auth/me` (CORS preflight) and `POST /api/logout` return **HTTP 403 with `server: cloudflare`** — Cloudflare's WAF / Bot Fight Mode is rejecting at the edge before the request reaches Cloud Run. Until this is fixed, **no cross-origin request from `app.tabulamedica.health` will work** (browsers send OPTIONS before every non-simple request and abort on 403).

**Fix (Cloudflare dashboard for `api.tabulamedica.health` — not code):**
1. **Security → Bots → Bot Fight Mode** — turn OFF (it famously breaks CORS preflights from browsers it doesn't trust).
2. **Security → WAF → Custom Rules** — add Skip rule:
   ```
   When: (http.request.method eq "OPTIONS") and (http.host eq "api.tabulamedica.health")
   Then: Skip → All remaining custom rules + Managed Ruleset
   ```
3. **Security → WAF → Managed Rules** — review for any rule blocking bare `OPTIONS` or `POST` without body; set to `Log` for `/api/*`.
4. **Configuration Rules** for `api.tabulamedica.health/*`:
   - Browser Integrity Check: Off
   - Security Level: Essentially Off (the app does its own auth + rate limiting)

**Verify after Cloudflare change:**
```bash
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
curl -i -X OPTIONS https://api.tabulamedica.health/api/auth/me \
  -H "User-Agent: $UA" \
  -H "Origin: https://app.tabulamedica.health" \
  -H "Access-Control-Request-Method: GET" | grep -iE "^(HTTP|access-control-allow-origin)"
# expect: HTTP/2 200  AND  access-control-allow-origin: https://app.tabulamedica.health
```

Once that's green, the Web Replit agent can proceed with step 5 (E2E smoke test) above.
