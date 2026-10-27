# routes.ts Split Plan

> Status: **PLAN ONLY — no code changes yet.** Produced 2026-05-18 in response to audit C-2.
> Tracking task: project task #67.
> Read this end-to-end before executing any slice. Each slice is its own PR.

---

## 1. Current state

| Metric | Value |
| --- | --- |
| File | `server/routes.ts` |
| Total lines | **31,276** |
| Total HTTP endpoints (`app.{get,post,put,delete,patch}(…)`) | **1,347** |
| Distinct `/api/<segment>` prefixes | **187** |
| Static imports at top of file | **136** |
| Module-level helper functions | **~25** |
| `getUserId(req)` call sites | 589 |
| `requireAuth` references | 1,127 |
| `requireFeature(…)` references | 8 |
| `requireAdmin` references | 18 |
| Sub-routers already mounted via `app.use("/api/…", router)` | 15 |

The single function `registerRoutes(app)` starts at line 631 and runs effectively to the end of the file. The 34 enterprise initializers that used to live inside it were extracted to `server/index.ts` in audit fix C-1 (2026-05-18) — that work does **not** need to be redone here.

### 1a. Sub-routers already extracted (do not touch in this split)

These are already in their own files and mounted from `registerRoutes`:

```
/api/compliance                → server/compliance/compliance-routes.ts
/api/data-governance           → server/third-party-data-governance.ts
/api/integrations              → server/integration-routes.ts (separate)
/api/mpi                       → server/mpi-routes.ts
/api/testing                   → server/testing/testing-routes.ts
/api/savings                   → server/savings-routes.ts
/api/hrsa                      → server/hrsa-service.ts
/api/gfe                       → server/good-faith-estimate-service.ts
/api/identity-vault            → server/identity-vault-service.ts
/api/instamed                  → server/instamed-service.ts
/api/card-scan                 → server/card-scan-service.ts
/api/optum-edi                 → server/optum-edi-service.ts
/api/medicare-rates            → server/medicare-rates-service.ts
/api/encounters/uninsurance    → server/encounter-writeback-service.ts
/api/pets                      → server/pet-routes.ts
```

Plus several `app.use("/api/…", requireAuth, requireFeature(…))` guards (messaging, dental, dentrix, eaglesoft, deduplication, provider-collaboration, bulk export) that wrap *subsequent* inline route handlers — these will move into the new domain files as part of the split, not on their own.

---

## 2. Proposed file structure

```
server/
  routes.ts                           ← shrinks to ~80 lines: a composition root that
                                        registers sub-routers in the right order.
                                        Keeps the registerRoutes(app) export so
                                        server/index.ts does not change.
  routes/
    _helpers.ts                       ← shared helpers used across domains
    _middleware.ts                    ← re-exports requireAuth / requireFeature /
                                        requireAdmin so domain files import from one
                                        canonical path
    auth-routes.ts                    ← /api/auth/*, /api/auth0/*, /api/user/*
    patient-routes.ts                 ← /api/patient*, /api/family-members*,
                                        /api/my-health-*, /api/health-summary
    records-routes.ts                 ← /api/records/*, /api/health-records/*,
                                        /api/attachments, /api/reactions,
                                        /api/lab-results, /api/lab-orders/*
    fhir-routes.ts                    ← /api/fhir/*, /api/fhir-search/*,
                                        /api/fhir-hub/*, /api/fhir-connections/*,
                                        /api/fhir-bulk-export, /api/fhir-viewer,
                                        /api/fhir-networks, /api/interoperability,
                                        /api/harmonization, /api/terminology
    intake-routes.ts                  ← /api/intake/*, /api/onboarding/*,
                                        /api/medical-autocomplete
    encounters-routes.ts              ← /api/encounters, /api/episodes-of-care,
                                        /api/visits (telehealth handled separately)
    telehealth-routes.ts              ← /api/telehealth/*, /api/voice,
                                        /api/messaging
    medication-routes.ts              ← /api/medication-reminders,
                                        /api/reminders, /api/pharmacy-search
    consent-routes.ts                 ← /api/consents, /api/permissions,
                                        /api/access-control
    sharing-routes.ts                 ← /api/share/*, /api/packets,
                                        /api/provider-share-summary,
                                        /api/one-tap-share (if any)
    ai-routes.ts                      ← /api/ai-history, /api/ai-summary,
                                        /api/soap-note, /api/doc-assistant,
                                        /api/clinical-documentation,
                                        /api/clinical-linker, /api/clinical-safety,
                                        /api/safety-analysis, /api/case-reviews,
                                        /api/vertex-ai, /api/workflow-automation,
                                        /api/automation, /api/personalized-content,
                                        /api/document-generation
    ai-clinical-routes.ts             ← /api/cds, /api/medical-journey,
                                        /api/care-pathways, /api/pathway-*,
                                        /api/care-plans, /api/care-plan-adjustments,
                                        /api/care-summary, /api/health-journeys,
                                        /api/health-journey, /api/health-goals,
                                        /api/clinical-trials, /api/guidelines,
                                        /api/duplicate-prevention,
                                        /api/deduplication, /api/data-conflicts,
                                        /api/data-quality
    analytics-routes.ts               ← /api/analytics, /api/advanced-analytics,
                                        /api/health-graph, /api/visualization,
                                        /api/reports, /api/lineage, /api/monitoring,
                                        /api/metrics, /api/financial-health,
                                        /api/leaderboard, /api/gamification
    education-routes.ts               ← /api/education/*, /api/communities,
                                        /api/moderation
    integration-ehr-routes.ts         ← /api/epic, /api/fasten,
                                        /api/ehr-connectors, /api/smart-apps,
                                        /api/smart
    integration-dental-routes.ts      ← /api/dental, /api/dentrix, /api/eaglesoft
    integration-tefca-routes.ts       ← /api/tefca, /api/gcp-healthcare,
                                        /api/gcp, /api/gcp-secrets
    wearables-routes.ts               ← /api/wearables, /api/sensors,
                                        /api/womens-health
    provider-routes.ts                ← /api/provider*, /api/providers,
                                        /api/provider-dashboard,
                                        /api/provider-collaboration,
                                        /api/provider-discovery,
                                        /api/provider-messages,
                                        /api/provider-search,
                                        /api/provider-threads,
                                        /api/case-reviews (subset), /api/teams,
                                        /api/collaboration
    compliance-extra-routes.ts        ← /api/security, /api/baa-agreements,
                                        /api/vanta, /api/comp-ai, /api/soc2,
                                        /api/audit, /api/audit-logs,
                                        /api/data-aggregation (compliance-adjacent)
    sms-routes.ts                     ← /api/sms/*
    misc-routes.ts                    ← bucket for the long tail of 1-2 endpoint
                                        groups; periodically reviewed for promotion
                                        out into their own file
```

That's **~25 domain files + 2 shared modules + the composition root**. Average file size: ~1,200 lines (down from 31,276). The largest expected files are `ai-clinical-routes.ts`, `provider-routes.ts`, and `analytics-routes.ts` at roughly 2,000–3,500 lines each — large but no longer pathological.

### 2a. Composition root sketch

```ts
// server/routes.ts (post-split, ~80 lines)
import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { requireAuth } from "./middleware/require-auth";
import { requireFeature } from "./subscription-service";

// already-extracted sub-routers
import complianceRoutes from "./compliance/compliance-routes";
import { createDataGovernanceRouter } from "./third-party-data-governance";
import integrationRoutes from "./integration-routes";
import mpiRoutes from "./mpi-routes";
// … (the 15 existing ones)

// new domain routers from this split
import authRoutes from "./routes/auth-routes";
import patientRoutes from "./routes/patient-routes";
// … etc

export async function registerRoutes(app: Express): Promise<Server> {
  // 1. Pre-existing sub-routers (unchanged order)
  app.use("/api/compliance", complianceRoutes);
  app.use("/api/data-governance", createDataGovernanceRouter());
  app.use("/api/integrations", requireAuth, integrationRoutes);
  // …

  // 2. New domain routers (mounted in dependency-safe order)
  app.use("/api/auth", authRoutes);
  app.use(patientRoutes);          // self-mounting routers keep /api/* paths intact
  app.use(recordsRoutes);
  app.use(fhirRoutes);
  // …

  return createServer(app);
}
```

Two valid mount patterns:
- **Prefix-stripped routers** — domain file declares `router.get("/", …)` and the composition root mounts at `app.use("/api/auth", router)`. Cleaner, but every existing route inside that domain has to have its path rewritten.
- **Self-mounting routers** — domain file declares `router.get("/api/auth/login", …)` exactly as it appears today and the composition root mounts at `app.use(router)`. **Recommend this pattern for the first 2-3 slices** because the path-rewrite step is the most error-prone part of a split and we want to land slices without behavior changes. Once the split is complete and stable, convert routers to prefix-stripped form as a follow-up cleanup PR.

---

## 3. Endpoint inventory (by URL prefix, counts ≥ 5)

Listed in descending order of endpoint count. Line ranges in the **current** `routes.ts` will be filled in per-slice when that slice is executed (each slice does its own pre-flight `rg -n "app\.[a-z]+\(\"/api/<prefix>"` to capture exact ranges right before extraction, since the file changes between slices).

| Group | Endpoints | Target file |
| --- | ---:| --- |
| `/api/visualization` | 49 | analytics-routes.ts |
| `/api/collaboration` | 47 | provider-routes.ts |
| `/api/security` | 39 | compliance-extra-routes.ts |
| `/api/education` | 35 | education-routes.ts |
| `/api/fhir` | 31 | fhir-routes.ts |
| `/api/clinical-documentation` | 28 | ai-routes.ts |
| `/api/telehealth` | 27 | telehealth-routes.ts |
| `/api/tefca` | 26 | integration-tefca-routes.ts |
| `/api/data-aggregation` | 25 | compliance-extra-routes.ts |
| `/api/gcp-healthcare` | 21 | integration-tefca-routes.ts |
| `/api/reports` | 18 | analytics-routes.ts |
| `/api/epic` | 18 | integration-ehr-routes.ts |
| `/api/analytics` | 18 | analytics-routes.ts |
| `/api/workflow-automation` | 17 | ai-routes.ts |
| `/api/provider-dashboard` | 17 | provider-routes.ts |
| `/api/auth` | 17 | auth-routes.ts |
| `/api/onboarding` | 16 | intake-routes.ts |
| `/api/access-control` | 16 | consent-routes.ts |
| `/api/wearables` | 15 | wearables-routes.ts |
| `/api/lineage` | 13 | analytics-routes.ts |
| `/api/intake` | 13 | intake-routes.ts |
| `/api/health-goals` | 13 | ai-clinical-routes.ts |
| `/api/automation` | 13 | ai-routes.ts |
| `/api/terminology` | 12 | fhir-routes.ts |
| `/api/permissions` | 12 | consent-routes.ts |
| `/api/deduplication` | 12 | ai-clinical-routes.ts |
| `/api/comp-ai` | 12 | compliance-extra-routes.ts |
| `/api/ai-history` | 12 | ai-routes.ts |
| `/api/vanta` | 11 | compliance-extra-routes.ts |
| `/api/soc2` | 11 | compliance-extra-routes.ts |
| `/api/sensors` | 11 | wearables-routes.ts |
| `/api/records` | 11 | records-routes.ts |
| `/api/health-graph` | 11 | analytics-routes.ts |
| `/api/fhir-connections` | 11 | fhir-routes.ts |
| `/api/ehr-connectors` | 11 | integration-ehr-routes.ts |
| `/api/doc-assistant` | 11 | ai-routes.ts |
| `/api/communities` | 11 | education-routes.ts |
| `/api/advanced-analytics` | 11 | analytics-routes.ts |
| `/api/womens-health` | 10 | wearables-routes.ts |
| `/api/vertex-ai` | 10 | ai-routes.ts |
| `/api/share` | 10 | sharing-routes.ts |
| `/api/safety-analysis` | 10 | ai-routes.ts |
| `/api/medical-journey` | 10 | ai-clinical-routes.ts |
| `/api/eaglesoft` | 10 | integration-dental-routes.ts |
| `/api/duplicate-prevention` | 10 | ai-clinical-routes.ts |
| `/api/baa-agreements` | 10 | compliance-extra-routes.ts |
| `/api/auth0` | 10 | auth-routes.ts |
| `/api/smart-apps` | 9 | integration-ehr-routes.ts |
| `/api/interoperability` | 9 | fhir-routes.ts |
| `/api/harmonization` | 9 | fhir-routes.ts |
| `/api/gamification` | 9 | analytics-routes.ts |
| `/api/fhir-networks` | 9 | fhir-routes.ts |
| `/api/fasten` | 9 | integration-ehr-routes.ts |
| `/api/dentrix` | 9 | integration-dental-routes.ts |
| `/api/care-pathways` | 9 | ai-clinical-routes.ts |
| `/api/sms` | 8 | sms-routes.ts |
| `/api/provider-collaboration` | 8 | provider-routes.ts |
| `/api/health-journeys` | 8 | ai-clinical-routes.ts |
| `/api/episodes-of-care` | 8 | encounters-routes.ts |
| `/api/encounters` | 8 | encounters-routes.ts |
| `/api/consents` | 8 | consent-routes.ts |
| `/api/care-plans` | 8 | ai-clinical-routes.ts |
| `/api/user` | 7 | auth-routes.ts |
| `/api/provider-threads` | 7 | provider-routes.ts |
| `/api/pathway-assignments` | 7 | ai-clinical-routes.ts |
| `/api/messaging` | 7 | telehealth-routes.ts |
| `/api/medication-reminders` | 7 | medication-routes.ts |
| `/api/lab-orders` | 7 | records-routes.ts |
| `/api/fhir-search` | 7 | fhir-routes.ts |
| `/api/fhir-hub` | 7 | fhir-routes.ts |
| `/api/dental` | 7 | integration-dental-routes.ts |
| `/api/clinical-safety` | 7 | ai-routes.ts |
| `/api/clinical-linker` | 7 | ai-routes.ts |
| `/api/cds` | 7 | ai-clinical-routes.ts |
| `/api/case-reviews` | 7 | ai-routes.ts |
| `/api/teams` | 6 | provider-routes.ts |
| `/api/soap-note` | 6 | ai-routes.ts |
| `/api/reminders` | 6 | medication-routes.ts |
| `/api/provider-discovery` | 6 | provider-routes.ts |

**Long tail (≤ 5 endpoints, 110+ prefixes):** consolidate into `misc-routes.ts` initially. After the split is complete, periodically promote any that grow past ~10 endpoints into their own file.

---

## 4. Suggested execution order (least → most risky)

Each step is its own PR. Verify with `npx tsc --noEmit` and a server smoke test (`curl` the moved endpoints + restart workflow + confirm `[DeferredInit] 34/34` still appears) before merging the next slice.

| # | Slice | Why this order |
| --- | --- | --- |
| 0 | Extract `_helpers.ts` and `_middleware.ts` only | Pure refactor, zero route moves. Every later slice depends on it. Has to land first. |
| 1 | `sms-routes.ts` | 8 endpoints, single domain, no PHI in request bodies (Twilio webhooks aside, already separately verified). Lowest blast radius. |
| 2 | `wearables-routes.ts` (sensors, womens-health) | 36 endpoints, self-contained, no auth flow interaction. |
| 3 | `education-routes.ts` (education, communities, moderation) | 47 endpoints, mostly read-heavy, content domain. |
| 4 | `sharing-routes.ts` | 10–15 endpoints, but includes public share tokens — verify token validation still works end-to-end. |
| 5 | `integration-dental-routes.ts` | Dental EHRs are gated by `requireFeature("dental_integrations")` — feature flag makes regression easy to spot. |
| 6 | `integration-ehr-routes.ts` (Epic, Fasten, ehr-connectors, smart-apps) | ~50 endpoints; touches PHI but uses already-extracted services. |
| 7 | `integration-tefca-routes.ts` (TEFCA, GCP healthcare) | ~50 endpoints; TEFCA flows are well-tested. |
| 8 | `wearables-routes.ts` + `medication-routes.ts` consolidation pass | Medication reminders cross with wearables in scheduling helpers. |
| 9 | `analytics-routes.ts` | ~150 endpoints (visualization + reports + analytics + lineage + advanced-analytics + health-graph + gamification + financial-health + monitoring + metrics). Largest single slice — consider splitting into two PRs (viz vs. reports) if it gets unwieldy. |
| 10 | `ai-routes.ts` | All Vertex-AI-backed endpoints. AI client (`chatComplete()`) is already a stable seam, so route moves are mechanical. |
| 11 | `ai-clinical-routes.ts` | Care plans, pathways, CDS — touches clinical-decision support. Verify CDS regression with a synthetic patient. |
| 12 | `intake-routes.ts` + `encounters-routes.ts` | Onboarding flows; verify end-to-end onboarding still completes. |
| 13 | `consent-routes.ts` (consents, permissions, access-control) | Authorization-adjacent — high care required, but smaller than AI. |
| 14 | `records-routes.ts` (records, lab-orders, attachments) | Direct PHI surface. Re-run the audit's record-ownership test cases before/after. |
| 15 | `fhir-routes.ts` | Most cross-cutting, includes search/harmonization/terminology. Likely the largest leftover. |
| 16 | `telehealth-routes.ts` | Visits, chat, recordings — high-sensitivity. |
| 17 | `provider-routes.ts` + `compliance-extra-routes.ts` | Provider and admin-adjacent. |
| 18 | `patient-routes.ts` | Touches almost every other domain through joins; do near the end. |
| 19 | `auth-routes.ts` + `/api/auth0` + `/api/user` | **Do last.** Auth regressions are catastrophic. By this point everything else is stable. |
| 20 | Long-tail consolidation into `misc-routes.ts` + cleanup of `routes.ts` down to composition root | Final shape. |

**Hard rule:** no slice may modify business logic, change response shapes, or alter middleware order. The only allowed changes are (a) move route declarations into a new file, (b) update imports, (c) replace inline `requireAuth` definitions with imports from `_middleware.ts`. Any logic change is a separate PR.

---

## 5. Shared helpers to extract into `server/routes/_helpers.ts`

Lifted verbatim from current `routes.ts`. None of these need behavior changes during the split.

| Helper | Current line | Notes |
| --- | ---: | --- |
| `getHeader(req, name)` | 148 | Tiny utility |
| `getUserId(req)` | 156 | Used 589 times — single highest-traffic helper |
| `getParam(req, name)` | 160 | Tiny utility |
| `authRoute(handler)` | 170 | Wrapper that injects auth context |
| `auditLog(req, action, resourceType?, resourceId?, metadata?)` | 182 | PHI audit shim — keep imports of `AuditService` intact |
| `categorizeLabTest(title)` | 197 | Move to `records-routes.ts` (only used by lab endpoints) |
| `createAuthSession(userId, req)` | 212 | Move to `auth-routes.ts` (only auth uses it) |
| `metrics` object | 245 | Move to `_helpers.ts` (cross-domain monitoring) |
| `aggregateMetricsByHour(metrics)` | 252 | Move to `analytics-routes.ts` |
| `trackRequest(endpoint, duration, isError)` | 279 | Move to `_helpers.ts` (used by every handler) |
| `handleApiError(res, error, message, endpoint, startTime)` | 291 | Move to `_helpers.ts` |
| `getNestedValue(obj, path)` | 308 | Move to `_helpers.ts` |
| `applyTransformation(value, transform)` | 324 | Move to `_helpers.ts` |
| `getDefaultMappingTemplates()` | 400 | Move to `fhir-routes.ts` (only mapping flows use it) |
| `getDeployedVersionInfo()` | 585 | Move to `_helpers.ts` |
| `getSensorTypesForDevice(deviceType)` | 30,813 | Move to `wearables-routes.ts` |
| `generateMockSensorValue(dataType)` | 30,830 | Move to `wearables-routes.ts` |
| `getSensorUnit(dataType)` | 30,855 | Move to `wearables-routes.ts` |
| `checkAndCreateAlert(userId, deviceId, reading)` | 30,873 | Move to `wearables-routes.ts` |
| `analyzeWithAI(dataType, readings)` | 30,958 | Move to `wearables-routes.ts` |
| `generateInsights(dataType, avg, trend, anomalyCount)` | 31,037 | Move to `wearables-routes.ts` |
| `generateJourneyMilestones(journeyType, conditions)` | 31,068 | Move to `ai-clinical-routes.ts` |
| `triageMessage(message, category?)` | 31,089 | Move to `telehealth-routes.ts` |
| `generateMessageSuggestions(message, context?)` | 31,151 | Move to `telehealth-routes.ts` |
| `createDemoData(userId)` | 31,159 | Move to `_helpers.ts` (used by onboarding + admin) |

### 5a. Middleware re-exports in `server/routes/_middleware.ts`

```ts
export { requireAuth } from "../middleware/require-auth";   // canonical from audit M-3
export { requireFeature } from "../subscription-service";
export { requireAdmin } from "../enhanced-auth-service";    // verify exact path
```

Every domain file imports from `./_middleware` instead of mixing paths. This means a future security change to `requireAuth` updates one import line per domain file, not 1,127 inline references.

---

## 6. Risk register

| # | Risk | Severity | Mitigation |
| --- | --- | --- | --- |
| R1 | **Route registration order matters** — Express matches routes in the order they're registered. Today everything is in one file, so order is implicit and obvious. After splitting, the composition root must register sub-routers in an order that preserves current matching behavior, especially for catch-all and parameterized routes. | High | Before each slice, `rg -n "app\.(get\|post\|put\|delete\|patch)\(\"" server/routes.ts` and confirm the moved block is *contiguous* in current source. If it isn't, either move the whole non-contiguous range or restructure first. |
| R2 | **`getUserId` and friends are imported implicitly** — they live in the same file as the handlers today, so handlers don't import them. After extraction, every handler file needs an explicit import. | Medium | Slice 0 (helpers extraction) lands before any route moves, so by the time we move routes, the import path already exists. |
| R3 | **`requireAuth` was just consolidated in audit M-3** — `server/middleware/require-auth.ts` is the canonical impl. Some existing routes in `routes.ts` import it; others might still be relying on the local `requireAuth` we deleted. | Medium | `rg -n "requireAuth" server/routes.ts` before slice 0; confirm the only references are to the new canonical import. |
| R4 | **`PHI_ENCRYPTION_SALT` boot guard** added in audit M-2 runs before listen — none of this split changes that, but every smoke test for a slice must verify the server still boots clean. | Low | Include `restart_workflow("Start App") + grep "express server serving" + grep "DeferredInit] 34/34"` as the smoke gate for every slice. |
| R5 | **Tests are absent for most routes** — no Jest/supertest coverage on the bulk of these endpoints. Refactor without tests means manual smoke-testing every domain. | High | Per slice, write a 30-second smoke script (curl + assert HTTP 200/401 as appropriate) for at least 3 representative endpoints in the moved domain. Save under `scripts/smoke-<domain>.sh`. Reuse on every subsequent slice as regression coverage. |
| R6 | **Sub-routers that are gated by feature flags** (e.g. `app.use("/api/messaging", requireAuth, requireFeature("secure_messaging"))`) currently wrap subsequent inline routes. Moving those routes into a new file requires either (a) repeating the guard at each route, (b) applying it on the new router via `router.use(requireFeature(...))`, or (c) keeping the `app.use(...)` gating in the composition root. | Medium | Use option (b) — `router.use(requireFeature(...))` at the top of each gated domain router. Explicit > implicit. |
| R7 | **`x-user-id` header trust path** — audit confirmed several legacy routes derive identity from caller-controlled `x-user-id`. Splitting routes is the perfect moment to *not* propagate that — but doing so is a behavior change. | High | **Do not** "fix" `x-user-id` trust during the split. File those as separate security tasks (some are already in the threat model). Splits stay mechanical. |
| R8 | **Imports at top of routes.ts (136 of them)** — many of those services are only used by 1-2 endpoint blocks. Moving routes without moving their imports leaves dead imports; moving imports without moving routes breaks compilation. | Medium | After each slice, run `npx tsc --noEmit` and `rg "from \"./<service-name>\"" server/routes.ts` to detect orphaned imports. Remove them in the same PR as the slice. |
| R9 | **Streaming + multipart handlers** — `uploadMiddleware` (multer at line 143) wraps several routes. When those routes move, the multer instance has to move too, or be re-exported. | Low | Define one shared `uploadMiddleware` in `_helpers.ts` so any domain file can import it. |
| R10 | **Large PR review fatigue** — even a "small" slice can be 1,000+ lines because it's mostly verbatim code moves. Reviewers will rubber-stamp. | Medium | Each PR description must include the pre/post line counts and a `diff --stat` summary. Reviewer checks structure, not every moved line. |

---

## 7. Acceptance criteria for the overall split

The split is "done" when:

- `server/routes.ts` is ≤ 200 lines and contains only sub-router registrations.
- Every domain router lives in `server/routes/<domain>-routes.ts`.
- Largest domain file is ≤ 5,000 lines (preferably ≤ 3,000).
- `npx tsc --noEmit` produces zero new errors compared to baseline.
- `restart_workflow("Start App")` boots cleanly, prints `[DeferredInit] 34/34 enterprise services initialized`, and `/api/auth/me` returns 401 on unauth, 200 on auth (proves request pipeline is intact).
- Smoke scripts under `scripts/smoke-*.sh` cover ≥ 3 endpoints per domain.
- No new `requireAuth` implementations have been introduced; all domain files import from `./_middleware`.
- The 15 already-extracted sub-routers are unchanged.

---

## 8. Open questions for Rajiv

1. **Self-mounting vs. prefix-stripped routers** — recommendation in §2a is self-mounting for the first 2-3 slices, then convert to prefix-stripped as cleanup. Confirm.
2. **Test coverage budget** — R5 above proposes writing smoke scripts per slice. Acceptable, or want fuller Jest+supertest coverage as part of the split? (Adds ~30% to per-slice time.)
3. **PR cadence** — one slice per PR (recommended) vs. batched (faster but harder to revert)?
4. **Long-tail file (`misc-routes.ts`)** — acceptable as a temporary holding pen, or prefer to leave the long tail in `routes.ts` until each gets its own home?
5. **Naming convention** — `auth-routes.ts` or `auth.routes.ts` or `authRoutes.ts`? Existing repo uses kebab-case (`pet-routes.ts`, `savings-routes.ts`); plan assumes same.

---

*End of plan. No code has been changed by this document.*
