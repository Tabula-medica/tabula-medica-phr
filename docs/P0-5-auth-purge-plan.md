# P0-5 — Fallback-identity purge plan (for review before mass edit)

**Goal:** replace every `(req…).userId || "system"` (and `"patient-001"` etc.) with
`getUserId(req)` (which 401s on missing auth), and mount `requireUser` on every
PHI route — WITHOUT adding auth to genuinely public routes and WITHOUT removing
any route or feature.

**Scope remaining:** 589 occurrences across 77 `server/**` files (P0-2 and P0-4
already cleared vaccine-routes + document-ocr). Guardrail
`tabulaAuth/no-fallback-identity` is live at WARN.

## Execution categories

**A. Router-based PHI files (majority — e.g. `diabetes-management-routes.ts`,
`ai-*-routes.ts`, `fhir-*-routes.ts`, `data-governance-routes.ts`, `rbac-routes.ts`):**
add `router.use(requireUser)` once at the top, then `|| "system"` → `getUserId(req)`.
These are cohesive authenticated resources — low risk.

**B. `register*(app)` / `app.get|post(...)` files (no router — e.g.
`smart-oauth2-management-routes.ts`, `public-health-*-routes.ts`,
`ai-deep-fhir-analytics-routes.ts`):** add `requireUser` per route (no router to
`use`).

**C. Already-gated routes** (carry `requireRole(...)` / `requirePermission(...)`,
e.g. lines in `comprehensive-audit-trail-routes.ts`, `routes.ts:866`): just
replace the fallback — do NOT double-gate.

**D. `server/routes.ts` (139 — the 1.5 MB monolith): DO LAST, per-route.** It
mixes public and authed handlers; a blanket `router.use` is unsafe here. Each of
the 139 handlers gets `requireUser` inline unless it's on the public list below.

## Public routes to EXCLUDE from auth (drop the fallback only) — PLEASE CONFIRM

These are the only endpoints I plan to leave unauthenticated. Everything else gets
`requireUser`. Confirm this list (or add/remove):

- Health / liveness: `/health`, `/status`, `/ping`, `/api/queue/status`
  (already admin-gated), `state-iis-routes.ts:/health`.
- Auth/login endpoints (session/GCIP/local login, logout, password reset).
- SMART-on-FHIR discovery: `/.well-known/*`, `/smart/discovery`, `/smart/config`.
- Fasten connect config: `/api/fasten-connect/config` (public client id only).
- Legal pages: `/api/legal/*`.
- `/api/health-content/categories` + `/types` (non-PHI reference content) —
  **verify these carry no PHI before leaving public.**

## NOT public (despite the name) — these DO get auth

- `public-health-*` routes → aggregate reporting, still authenticated staff use.
- `*/config`, `*/configurations` → resource endpoints, not app config.
- `health-trends/`, `health-graph/`, `health-trend-forecast` → PHI.

## Verification per file
- After each file: `npm run build` (fast gate) + `grep -c '|| "system"'` → 0.
- Batch `npm run check` (8GB tsc) at boundaries — no NEW errors vs baseline.
- Also in this pass: remove the hard-coded `patient-001`/"John Smith" sample in
  `ai-medical-assistant-routes.ts` (return the caller's own profiles or empty).
- After full purge: flip `tabulaAuth/no-fallback-identity` WARN → ERROR.

## Risk callout
The blanket `router.use(requireUser)` on **reference-data** sub-routes (like the
`/cvx-*` routes already gated in P0-2) will 401 any existing UNauthenticated
caller. Before the server deploy, confirm the live web app / in-review mobile app
always send the bearer token to these routers (they should — the mobile client
attaches it to every request).
