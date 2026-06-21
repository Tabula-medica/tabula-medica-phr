# Unified Architecture Plan — Tabula Medica + Uninsurance

**Status:** PLANNING DOCUMENT — no code, no schema, no config.
**Filed:** 2026-04-18 (Saturday architectural session).
**Source directives:**
- `attached_assets/Pasted-Tell-the-Replit-agent-architecture-planning-session-Sta_1776567271269.txt` (original, 8 confirmed inputs + 10 sections)
- `attached_assets/Pasted-Updated-directive-to-the-Replit-agent-I-m-refining-the-_1776567421427.txt` (refinement: cousins relationship + Aristotelian balance → Sections 11 + 12)

**Reader prerequisite:** familiar with HIPAA Covered Entity vs Business Associate distinction, SMART on FHIR OAuth 2.0 + PKCE, Stripe Connect vs separate-merchant patterns, Auth0 tenants/applications/connections.

---

## Confirmed inputs from Rajiv

These 8 inputs are taken as canonical. If any are misremembered or have changed, flag at review and the plan re-derives from corrected inputs.

1. Uninsurance is a **separate legal entity** — separate LLC for Virginia DMPO regulatory isolation. Tabula Medica LLC is a HIPAA Covered Entity; Uninsurance LLC is not.
2. Backend linking: Uninsurance patients can **OPTIONALLY** connect to Tabula Medica for unified health records. Default state is unlinked.
3. Payments: **Separate Stripe merchant accounts** per entity. RevenueCat used for both apps.
4. Authentication: **Shared Auth0 tenant** — one Auth0 account grants access to either app depending on entitlements.
5. Integration protocol: **SMART on FHIR** — standard protocol governs how Uninsurance reads Tabula Medica records.
6. Branding: Uninsurance is **white-labeled** in the original directive. Refined directive overrides this with the "cousins" model — Section 11 below clarifies. **Read Section 11 as the authoritative branding posture; the original directive's "white-labeled" wording is superseded.**
7. Virginia DMPO: Uninsurance carries its own DMPO registration separate from HIPAA posture.
8. UX: Two apps, backend linking, surfaced as tabs in the unified experience.

---

## Pre-flight findings (existing codebase reality check)

Before designing what should exist, naming what does:

- **`CARE_BRIDGE_SECRET`** is a real environment variable — wired into `server/security/phi-encryption.ts:30` as part of the startup key-fingerprint logging banner. Its actual encryption/signing usage in request-bridging code is **not visible in the current codebase**. The variable exists; the consumer service does not.
- **`client/src/pages/care-index.tsx`** is a real page titled "Care Access" — UI surface only, no routing into a bridge backend visible in this codebase pass.
- **No `server/care-access/` directory** exists. No `careAccessBridge` / `careBridgeService` / `careAccessClient` modules visible.
- **No `uninsuranceTable`** or other Uninsurance-named tables in `shared/schema.ts`. Schema has many `care*` tables but those map to clinical-care concepts (care plans, caregivers, care teams), not the Uninsurance product.
- **`tabula-medica-mobile/src/screens/UninsuranceScreen.tsx`** exists — Uninsurance-product UI lives in the **mobile companion repo** (`tabula-medica-mobile/`), with services like `optumEdi.service.ts`, `medicareRates.service.ts`, `goodFaithEstimate.service.ts`, `uninsuredIdentityVault.service.ts`, `hrsa.service.ts`. **This is the de facto Uninsurance app today** — embedded in the Tabula Medica mobile shell, not yet split out as its own deployable.
- **`replit.md`** does not document the Uninsurance product, the cousins relationship, or the Care Access microservice. (Documented for follow-up after this plan is approved.)

**Implication for the plan:** "Current state: Care Access microservice already sits as the bridge" (per the original directive's project-memory framing) is **partially aspirational from this codebase's POV** — the env var exists, the UI page exists, but there is no active Care Access microservice code running in this repo. Section 8 Open Questions surfaces this for confirmation. The plan below is written assuming the directive's intent is correct (microservice is planned or lives elsewhere) — if it doesn't exist anywhere, Phase 1 of the implementation roadmap absorbs the build-the-bridge work.

---

## Section 1 — Entity Map

### 1.1 The two legal entities

| Entity | Type | Regulatory posture | Operates |
|---|---|---|---|
| **Tabula Medica LLC** | LLC | HIPAA Covered Entity (CE) | Tabula Medica patient health-record PWA + iOS/Android |
| **Uninsurance LLC** | LLC | Virginia DMPO registrant. **NOT insurance.** Affordable care access membership ("payment for access, not reimbursement") | Uninsurance app/membership ($75/month) |

### 1.2 Inter-entity relationship — RECOMMENDED: sibling LLCs

Three options, with trade-offs:

**Option A — Sibling LLCs under a common holding company (RECOMMENDED).**
- Holding company (e.g. Tabula Holdings LLC or similar) owns 100% of both Tabula Medica LLC and Uninsurance LLC.
- Each subsidiary has its own EIN, bank account, books, and contracts.
- **Why recommended:** clean regulatory firewall (DMPO posture stays in Uninsurance LLC; HIPAA posture stays in Tabula Medica LLC), clean cap-table for fundraising ("we own both entities" is a one-line answer), simplest tax filing pattern (consolidated return at parent), and the inter-entity data-sharing agreement (see §1.3) lives between two clearly-defined sibling subs.
- **Trade-off:** legal cost to form the holding company + draft three-party charters; ~$2-5k one-time. Optional now, hard-to-do-later if you wait.

**Option B — Parent/subsidiary (Tabula Medica LLC owns Uninsurance LLC, or vice versa).**
- One entity is the parent; the other is a wholly-owned sub.
- **Why not recommended:** if Tabula Medica LLC owns Uninsurance LLC, Tabula Medica's HIPAA Covered-Entity posture potentially extends to its sub's operations under "affiliated covered entity" doctrine — exactly the regulatory leak the separate-LLC structure is designed to prevent. The reverse (Uninsurance owns Tabula Medica) puts the DMPO entity over the CE, which is a worse story for healthcare regulators.

**Option C — Fully arms-length (no common ownership; just a contracted partnership).**
- **Why not recommended:** if both entities have the same founders/owners, this is a fiction that doesn't survive corporate-veil scrutiny. Easier to be honest about common ownership and structure it as Option A.

**Open question for Section 8:** which option matches Rajiv's actual current legal structure?

### 1.3 Contractual linkage between the entities

When a user authorizes Uninsurance to read their Tabula Medica health records, **Uninsurance LLC becomes a HIPAA Business Associate of Tabula Medica LLC** for that user's PHI. Three contracts are needed:

1. **BAA (Business Associate Agreement)** between Tabula Medica LLC (Covered Entity) and Uninsurance LLC (Business Associate). Standard HHS-template BAA, executed at the entity level once, applies to all linked users.
2. **Data Sharing Agreement (DSA)** — operational addendum to the BAA describing exactly which FHIR scopes Uninsurance may request, retention rules, audit-log delivery cadence, breach-notification timelines, sub-processor list.
3. **Inter-Company Services Agreement (ICSA)** — covers shared infrastructure cost-allocation (Auth0 tenant fees, GCP costs, shared engineering time) so the two LLCs can transact at arm's length per IRS transfer-pricing rules.

**Trigger model:** BAA + DSA are entity-level (executed once); per-user authorization is the SMART-on-FHIR consent flow (§2.3, §4.4).

---

## Section 2 — Identity Architecture

### 2.1 Shared Auth0 tenant

Single Auth0 tenant (e.g. `tabula-medica.us.auth0.com`) hosts:

- **One Auth0 user database** — single source of truth for `auth0_user_id`, email, MFA factors, password.
- **Two Auth0 Applications** registered in the tenant:
  - `tabula-medica-app` (clientId for the Tabula Medica PWA + Capacitor wrappers)
  - `uninsurance-app` (clientId for the Uninsurance app)
- **Optional third Application:** `uninsurance-fhir-client` registered as the SMART-on-FHIR OAuth client that requests FHIR scopes from the Tabula Medica authorization server. Distinct from `uninsurance-app` user-facing client. (See §4.5.)

### 2.2 Entitlements model — single account, multi-product access

Two industry patterns; recommendation below.

**Option A — Roles claim in ID token.**
- Auth0 stores `entitlements: ["tabula-medica", "uninsurance"]` (or absence) on the user's `app_metadata`.
- Both apps inspect the JWT claim at login and reject if their entitlement is absent.
- New signup for an unentitled product = silent provisioning of the entitlement.
- **Pro:** single source of truth, token-based check, works offline-first.
- **Con:** entitlement changes require token refresh.

**Option B — Per-app database flag.**
- Auth0 stores user identity only; each app's backend has its own `account_enabled` flag.
- **Pro:** apps can revoke without touching Auth0.
- **Con:** two sources of truth for who can access what; sync drift inevitable.

**Recommendation: Option A** with a thin per-app revoke-flag in the backend as defense-in-depth (a `disabled_at` column on the per-app account row that overrides the Auth0 claim). Best of both.

### 2.3 Existing-account handling at signup

Scenario: user with a Tabula Medica account opens the Uninsurance app for the first time.

1. Uninsurance app login → Auth0 universal-login → user enters existing email + password.
2. Auth0 returns ID token with `sub` (existing `auth0_user_id`) and current `entitlements` claim.
3. Uninsurance backend sees `auth0_user_id` exists in Auth0 but no row in Uninsurance's local user table → **provisioning step**:
   - Create local Uninsurance user row keyed by `auth0_user_id`.
   - Issue Uninsurance entitlement to Auth0 via Management API (`app_metadata.entitlements.push("uninsurance")`).
   - Force token refresh → user proceeds with new entitlement.
4. UX: no second password creation; no "you already have an account" friction; clean unified-identity feel.

The reverse (Uninsurance user opens Tabula Medica) is identical with the apps swapped. The provisioning step is the **inflection point where the user is offered the linking flow** (§4.4) — opt-in from day one rather than buried later.

### 2.4 Account-level privacy boundaries

Three states a user can be in:

| State | Tabula Medica app sees | Uninsurance app sees |
|---|---|---|
| Tabula Medica only | full PHI, FHIR, all features | (no account) |
| Uninsurance only | (no account) | membership data, GFE, payment lanes, no PHI |
| Linked (both, with FHIR consent active) | full PHI + Uninsurance membership status (read-only display) | membership data + scoped FHIR data per consent |

**Privacy boundary rule:** Uninsurance app NEVER sees PHI without an active SMART-on-FHIR authorization grant from the user. Membership data NEVER leaves Uninsurance LLC's systems into Tabula Medica's PHI tables (one-way data flow at the regulatory boundary).

### 2.5 Session/token handling across apps

- **No SSO cookie sharing across native apps** — iOS/Android apps run in their own sandboxes; cookies don't cross.
- **Web → Web SSO:** if both apps are on `*.tabulamedica.health` subdomains (e.g. `app.tabulamedica.health` for Tabula Medica, `members.uninsurance.health` for Uninsurance), Auth0's universal-login session cookie can give silent SSO when user navigates between subdomains in the same browser.
- **Cross-app deep links** (§5): when one native app deep-links to the other and the target app isn't installed, fall back to a web view of the target's universal-login URL with a return-deep-link parameter.

---

## Section 3 — Payment Architecture

### 3.1 Stripe topology

- **Tabula Medica LLC Stripe account** — own publishable key, secret key, webhook signing secret. Receives Tabula Medica Pro subscription revenue ($9.99/month per existing project memory).
- **Uninsurance LLC Stripe account** — own publishable key, secret key, webhook signing secret. Receives Uninsurance membership revenue ($75/month per directive).
- **NO Stripe Connect** — these are independent merchant accounts, not platform-marketplace. Stripe Connect would imply one entity is the "platform" taking a fee on the other's revenue, which complicates the regulatory firewall and creates an accounting nightmare for Uninsurance's DMPO reporting.

### 3.2 RevenueCat layer — both apps

- One RevenueCat project per app (mirrors Stripe structure): `revenuecat-tabula-medica`, `revenuecat-uninsurance`.
- iOS/Android in-app purchases route through the respective RevenueCat project, which then maps to the respective Stripe account for any web-side billing or refund issuance.
- Existing secrets in this environment (`VITE_REVENUECAT_ANDROID_KEY`, `VITE_REVENUECAT_IOS_KEY`, `VITE_REVENUECAT_WEB_KEY`, `REVENUECAT_PROJECT_ID`) are **all Tabula Medica's** — Uninsurance will need a parallel set when the Uninsurance app gets its own deployment.

### 3.3 Subscription routing

- User pays Uninsurance $75/month → Uninsurance LLC Stripe account (and Uninsurance RevenueCat for in-app).
- User pays Tabula Medica Pro $9.99/month → Tabula Medica LLC Stripe account.
- A user can subscribe to both independently. The two subscriptions are separate, billed by separate entities, and refunded separately. This is the cleanest possible billing posture.

### 3.4 Refund / dispute handling per entity

- Each entity handles its own refunds, chargebacks, and dispute responses through its own Stripe dashboard.
- Customer support workflows: a user who emails Tabula Medica support about a Uninsurance billing question gets routed to Uninsurance support (handoff script needed; not a same-system lookup).
- **Anti-pattern to avoid:** processing Uninsurance refunds from Tabula Medica's Stripe account as a "convenience." Pierces the corporate veil; commingles revenue; breaks DMPO reporting.

### 3.5 Tax + accounting

- Each LLC files its own state and federal returns.
- Inter-entity charges (e.g. Tabula Medica engineering time supporting Uninsurance) flow through the Inter-Company Services Agreement (§1.3) at arm's-length pricing, invoiced and paid between the two LLCs.
- **Recommendation (out of scope for this plan but flagged):** retain a CPA who has worked with healthcare-adjacent multi-entity structures before launching the second product. Saves $10-50k of cleanup later.

---

## Section 4 — Data Flow & Linking

### 4.1 The four data domains

| Domain | Owner | Data type | Where it lives |
|---|---|---|---|
| **A. PHI / FHIR** | Tabula Medica LLC (CE) | Encrypted PHI, FHIR R4 resources | `phiDb` tables in Tabula Medica's Postgres |
| **B. Anonymized category signals** | Tabula Medica LLC (CE) | De-identified per HIPAA Safe Harbor; converted from PHI before crossing the bridge | Bridge transit only; not persisted on either side as PHI |
| **C. Uninsurance membership data** | Uninsurance LLC (DMPO) | Membership status, payment history, GFE records, provider-network selections | Uninsurance's own Postgres (separate from Tabula Medica's) |
| **D. Shared identity** | Auth0 tenant | `auth0_user_id`, email, entitlements | Auth0 only; mirrored as foreign keys in each app's local user table |

**Flow rules:**
- A → B (PHI to anonymized signals): Tabula Medica's bridge module does the de-identification (HIPAA Safe Harbor, 18-identifier scrub) before any data crosses into Care Access territory.
- B → Uninsurance: only de-identified signals cross by default. Used for personalization (e.g. "users with similar conditions on Uninsurance saved $X").
- A → Uninsurance (raw FHIR): only via SMART-on-FHIR authorized scopes after explicit per-user consent (§4.4).
- C → Tabula Medica: never. Membership data does not back-flow into PHI tables.
- D → both: shared identity only.

### 4.2 Care Access microservice — the bridge

**Per directive's project memory:** Care Access microservice sits between Tabula Medica's PHI store and Uninsurance's personalization layer. Its FHIR-bridge endpoint converts clinical data to anonymized category signals before crossing.

**What Care Access is responsible for:**
1. Receive read-requests from Uninsurance for anonymized signals (e.g. "is this user in cohort X?").
2. Look up the user's PHI (with appropriate Tabula Medica internal authorization).
3. Run the de-identification pipeline (existing `PHI-Deidentification` service, per Start application boot logs: "HIPAA Safe Harbor method supported, 18 PHI identifier types tracked").
4. Return ONLY the de-identified signal — never raw FHIR.
5. Sign the response with `CARE_BRIDGE_SECRET` so Uninsurance can verify it came from the authorized Tabula Medica bridge.

**What Care Access is NOT responsible for:**
- Writing to FHIR (read-only against Tabula Medica's PHI store).
- Authoritative SMART-on-FHIR authorization (that's the Tabula Medica SMART authorization server in §4.5; Care Access uses a different, internal-trust pattern for the de-identified-signals path).
- Bidirectional sync (Care Access is one-way, A → B → Uninsurance).

**Codebase reality:** see Pre-flight findings — Care Access service code is not yet in this repo. Phase 1 of §7 covers building/wiring this if it doesn't exist elsewhere.

### 4.3 SMART on FHIR for raw-FHIR access

SMART on FHIR is the standard for the **second integration path** — when Uninsurance needs raw FHIR data, not just anonymized signals. Standards-compliant pattern:

1. Tabula Medica runs a **SMART-on-FHIR authorization server** at e.g. `app.tabulamedica.health/smart/authorize` and `/smart/token`. Existing services in the codebase (`smart-on-fhir-apps-service.ts`, `smart-app-launch.ts`, `smart-oauth2-management-routes.ts`, `smart-app-registration-service.ts`) provide the server-side scaffolding for SMART scopes; this is a real, partially-built capability today.
2. Uninsurance's FHIR-client OAuth app (§2.1) is registered with the Tabula Medica SMART authorization server with a known client_id, redirect_uri, and pre-declared scope set.
3. User in Uninsurance app clicks "Connect to my Tabula Medica records" → redirected to Tabula Medica's authorization server → consent screen (§4.4) → callback to Uninsurance with auth code → token exchange → Uninsurance gets a scoped FHIR access token.
4. Uninsurance uses the token to call Tabula Medica's FHIR R4 API directly. Token TTL is short (e.g. 1 hour); refresh tokens issued separately and bound to the active consent grant.

### 4.4 User consent model

**Two layers:**

1. **Account-link consent** (one-time, can revoke). User explicitly agrees: "Allow Uninsurance to access my Tabula Medica health records." Stored in Tabula Medica's database as a row in a `linkConsentsTable` (to-be-designed; out of scope for this plan).
2. **Scope consent** (per-grant, with expiry). User picks which FHIR scopes Uninsurance can request. Mediated by the SMART authorization server's consent screen.

**Default scopes recommended for Uninsurance:**
- `patient/Coverage.read` — insurance coverage info (relevant to Uninsurance's gap analysis)
- `patient/Condition.read` — diagnoses (relevant to provider-recommendation matching)
- `patient/MedicationRequest.read` — current medications (relevant to refill cost-shopping)
- **NOT recommended by default:** `patient/*.read` blanket scope. Data minimization principle — Uninsurance should justify each scope it requests.

### 4.5 Revocation

User can revoke account-link consent OR individual scopes at any time:

1. Revocation is a single API call into Tabula Medica's consent system.
2. Tabula Medica's SMART authorization server **immediately invalidates all access tokens and refresh tokens** issued under the revoked consent.
3. Audit-log entry written: `consent.revoke {auth0_user_id, revoked_scopes, revoked_at}` to both Tabula Medica audit log and (mirrored) Uninsurance audit log via Care Access.
4. Uninsurance app's local cache of FHIR data must be **purged within 30 days per BAA** (or sooner per app preference). This is a contractual requirement codified in the §1.3 DSA.

### 4.6 Data minimization summary

| Data | Default visibility to Uninsurance | Override mechanism |
|---|---|---|
| Anonymized cohort signals | Yes (always, for personalization) | User opts out of personalization globally |
| Coverage / Condition / MedicationRequest | No until linked + scoped | SMART-on-FHIR consent grant |
| Everything else (Observation, AllergyIntolerance, DocumentReference, etc.) | No | Future SMART consent expansion if user explicitly agrees |
| Identifying PHI (name, DOB, MRN) | No, ever | None — Uninsurance gets `auth0_user_id` only |

---

## Section 5 — UX Pattern (Tabs with Backend Linking)

### 5.1 In-app tab structure

**In Uninsurance app:**
- Top-level tab: **"My Health Records"** (label TBD; could also be "Records" or "Health History")
- Empty state (unlinked): "Connect your Tabula Medica account to see your medications, conditions, and lab results in one place. [Connect button]"
- Connected state: scoped FHIR data view (medications, conditions, coverage at MVP per §4.4 default scopes), with a banner: "Powered by your Tabula Medica records. [Manage permissions]"

**In Tabula Medica app:**
- Top-level tab: **"My Uninsurance Membership"** (or "Membership" / "Affordable Care")
- Empty state (no Uninsurance account): "Save on care visits with Uninsurance — affordable membership for the uninsured. [Learn more / Sign up]"
- Connected state: read-only mirror of Uninsurance membership status, current plan tier, next billing date, and a "Manage in Uninsurance app" deep link.

### 5.2 Deep-link vs embedded vs unified-dashboard — design decision

Three patterns; trade-offs:

| Pattern | Pro | Con | Recommendation |
|---|---|---|---|
| **Deep link (native handoff)** | Each app stays focused; clean separation of concerns; native UX per app | Requires both apps installed; cross-app context loss; double-MFA risk | **Use for write actions** (e.g. "Update payment method" → handoff to Uninsurance app) |
| **Embedded WebView** | One app to install; consistent visual; works without other app installed | WebView is a poor UX on iOS (Apple Guideline 4.7 risk if it's "just a webview"); can't access native features; auth complexity | **Avoid as primary pattern** — only acceptable as deep-link fallback when other app not installed |
| **Unified dashboard (single app, both data domains)** | Best UX; one identity; one install | Defeats the cousins-not-merged design; recombines the regulatory firewall in the UI; HIPAA blast radius grows | **Avoid** — would erode Section 12's Aristotelian boundary |

**Recommendation:** **Read = native UI in each app, fed by APIs across the bridge. Write = deep-link handoff to the authoritative app for that domain.** Each app reads the other's data via the bridge to render its tab natively (no webview). Mutating the other domain (e.g. cancelling Uninsurance membership from inside Tabula Medica) opens a deep link to the other app. This pattern preserves the Aristotelian balance (§12) while feeling unified to the user.

### 5.3 Empty states — "Connect your other account"

Both empty-state CTAs link to a single canonical flow:

1. User taps "Connect."
2. App initiates the SMART-on-FHIR authorization flow OR account-link flow (depending on direction).
3. Other-app login (Auth0 universal login, no second password thanks to shared tenant).
4. Consent screen with explicit scope listing.
5. Return to original app with linking active.
6. Tab refreshes; data populates.

**Anti-pattern to avoid:** showing "linking failed" without telling the user what to fix. Linking can fail because: other-app account doesn't exist (offer signup), other-app account exists but with different email (offer email-merge flow), Auth0 MFA challenge timed out (offer retry), or scope grant declined (explain what each scope does).

### 5.4 Visual cues for linked state

- Both apps show a small "linked" badge (e.g. a subtle teal dot per Section 11's brand-family color) on the tab when data is flowing.
- Settings page in each app has a "Connected accounts" section listing the other entity, scopes granted, last sync time, and a "Disconnect" button (§4.5 revocation).

---

## Section 6 — Regulatory Boundaries

### 6.1 HIPAA posture by entity

| Entity | HIPAA role | Triggers |
|---|---|---|
| **Tabula Medica LLC** | Covered Entity (CE) | Operates the patient health-record platform; receives PHI directly from EHRs and patients |
| **Uninsurance LLC (default)** | Not a HIPAA-regulated entity | DMPO membership is a payment-for-access model, not insurance; no PHI received by default |
| **Uninsurance LLC (when user has linking active)** | Business Associate (BA) of Tabula Medica LLC | Receives PHI via SMART-on-FHIR consent → BA status triggered for that data, that user, that scope |

### 6.2 BAA execution mechanics

- BAA between Tabula Medica LLC and Uninsurance LLC is **executed once at the entity level** (a single PDF signed by both LLCs' authorized officers).
- Per-user activation is implicit: when a user authorizes linking, the existing entity-level BAA covers the data flow. No new BAA per user.
- Revocation by user: BAA itself stays in force at the entity level; the user-specific data flow stops. If linking is later re-enabled, no new BAA needed.
- BAA termination at entity level: requires Uninsurance to purge all PHI received from Tabula Medica within 60 days (HHS standard) or document why purge is infeasible and apply equivalent protections.

### 6.3 DMPO posture clarification

- Virginia DMPO ("Discount Medical Plan Organization") registration is a **state-level consumer-protection regime** separate from HIPAA.
- Key DMPO rules: cannot use the word "insurance" in marketing; must clearly disclose "this is not insurance"; price disclosures must be specific; no surprise billing.
- DMPO posture is **fully internal to Uninsurance LLC** — Tabula Medica's CE posture does not extend to DMPO compliance and vice versa.
- Both regulatory regimes coexist on the linked-user data flow: PHI is HIPAA-governed in transit and at rest in Uninsurance's systems (BAA), while membership pricing/marketing is DMPO-governed within Uninsurance.

### 6.4 Other compliance regimes touching the unified architecture

| Regime | Relevance | Owner |
|---|---|---|
| **CCPA / CPRA** (California) | If either app serves CA residents (essentially: yes) | Both entities; existing privacy policy work covers Tabula Medica |
| **VCDPA** (Virginia, post-2023) | Triggers at ~100k consumers OR ~25k consumers + 50% revenue from data sales | Both entities; not yet triggered per Action Item R triage |
| **HHS Section 1557** (anti-discrimination in healthcare) | Tabula Medica yes; Uninsurance probably (DMPO providing care access likely counted as "health program") | Both, with stricter scrutiny on Uninsurance's provider-network selections |
| **ERISA** | NO for either (DMPO explicitly not insurance; Tabula Medica not a plan administrator) | N/A |
| **State medical-licensing boards** | Indirectly via provider-network credentialing in Uninsurance | Uninsurance |

### 6.5 Audit-log handling at the boundary

- Tabula Medica logs every consent grant, revocation, FHIR scope read, and Care Access bridge call to its `hipaaAuditLogsTable` (existing).
- Uninsurance must keep a **mirror** of audit events for PHI it has received (BAA requirement). Bridge propagates these via signed payloads.
- Mirror pattern: Care Access publishes audit events to a dedicated topic; Uninsurance subscribes and writes to its own audit table. **Eventual consistency is OK; loss is not.** Use a durable queue (Cloud Pub/Sub or equivalent) — out of scope for this plan to design, in scope to flag.

---

## Section 7 — Implementation Phases

Phase numbering deliberately starts at 0 to mark the "no-code-yet" architectural prep work distinct from build phases.

### Phase 0 — Architectural prep (THIS DOCUMENT + decisions)

Owner: Rajiv (legal + business decisions) + agent (technical documentation).

- [ ] Approve this planning document or send back for revision.
- [ ] Confirm or correct the entity-relationship choice in §1.2 (Option A recommended).
- [ ] Form holding-company LLC if going with Option A (legal counsel work).
- [ ] Draft and execute BAA, DSA, ICSA between the two LLCs (legal counsel).
- [ ] Decide entitlements model A vs B (§2.2; A recommended).
- [ ] Decide canonical scope set for Uninsurance default linking (§4.4 recommends Coverage + Condition + MedicationRequest).
- [ ] Verify or open second Stripe merchant account for Uninsurance LLC.
- [ ] Verify Auth0 tenant configuration matches §2.1 (one tenant, two/three apps).
- [ ] Resolve Open Question §8.1 about Care Access microservice's actual current state.

**Exit criteria:** all decisions in §1-§6 are finalized; any "Option A vs B" choices are made; Section 8 open questions are answered.

### Phase 1 — Foundation (shared layer)

Owner: agent.

**Per §8.1 resolution (2026-04-20):** Care Access microservice is confirmed planned-but-not-built. Phase 1 expanded into three sub-phases below to make the build-the-bridge work concrete and estimable. Session estimates assume current agent velocity (~2-3hr productive coding per session).

#### Phase 1.1 — Care Access microservice scaffolding (~3-5 sessions)

- [ ] Create `server/care-access/` module directory with `index.ts` mounting on the Express app.
- [ ] Wire `CARE_BRIDGE_SECRET` for response signing (HMAC-SHA256 over canonical payload).
- [ ] Internal-trust authentication layer (signed-request verification from Uninsurance side).
- [ ] Health-check + observability (structured logging via `tabula/no-string-form-logger`-compliant object form per Action Item T).
- [ ] PHI-redaction middleware on all responses (defense-in-depth — even though deidentification runs upstream, never let raw PHI hit the wire).
- [ ] Unit + integration test scaffolding (Vitest; gated on Action Item V resolution).
- [ ] `replit.md` Care Access section updated from "planned" to "deployed (Phase 1.1 complete)" once shipped.

**Exit criteria:** `server/care-access/` boots clean, health-check returns 200 with signed response, request signature verification works end-to-end.

#### Phase 1.2 — FHIR bridge endpoint (~2 sessions)

- [ ] Endpoint `/care-access/signal/:cohort` (GET, returns de-identified cohort signal).
- [ ] Wire to existing `PHI-Deidentification` service (HIPAA Safe Harbor, 18-identifier scrub — already running per Start application boot logs).
- [ ] Cohort taxonomy definition (initial set: e.g. `coverage-status`, `chronic-condition-flag`, `medication-class`).
- [ ] Audit-log writer for every bridge call (`hipaaAuditLogsTable` insert with `action=care_bridge_read`, encrypted user identifier per existing PHI-encryption patterns).
- [ ] Rate-limiting + abuse protection (per-client-id quotas).

**Exit criteria:** Uninsurance can request a cohort signal for a known user, receive a signed de-identified response, and verify the signature.

#### Phase 1.3 — SMART on FHIR authorization server (~3-4 sessions)

- [ ] Verify existing SMART scaffolding (`smart-on-fhir-apps-service.ts`, `smart-app-launch.ts`, `smart-oauth2-management-routes.ts`, `smart-app-registration-service.ts`) is production-ready for an EXTERNAL client (most existing scaffolding may be for testing/admin flows).
- [ ] Authorization endpoint hardening (PKCE-only, no implicit flow, scope allowlist enforcement).
- [ ] Token endpoint hardening (short TTL access tokens ~1hr, refresh tokens bound to active consent grant).
- [ ] Discovery endpoint at `/.well-known/smart-configuration` (SMART standards requirement).
- [ ] Consent screen UI (the "Allow Uninsurance to access your records" view with scope-level toggles).
- [ ] Add `linkConsentsTable` to `shared/schema.ts` (HARD DEPENDENCY: Action Item N — drizzle drift reconcile — must land first; see §9).
- [ ] Token-revocation cascade: revoking a consent invalidates all access + refresh tokens issued under it.

**Exit criteria:** Uninsurance can complete a SMART-on-FHIR OAuth 2.0 + PKCE flow against Tabula Medica's authorization server, receive a scoped FHIR access token, and successfully read scoped FHIR resources from Tabula Medica's FHIR R4 API.

#### Phase 1 — Cross-cutting items (any sub-phase)

- [ ] Provision separate Stripe webhook endpoint for Uninsurance LLC's Stripe account (assuming Uninsurance app deploys to a separate Replit project — confirmed §8.4).
- [ ] Update `replit.md` cousins-relationship section + Uninsurance-as-separate-Replit-project note (initial reconciliation done 2026-04-20; deeper updates after each sub-phase exit).

**Phase 1 total estimate:** ~8-11 sessions sequential, or ~5-7 sessions if 1.2 and 1.3 partially parallelize after 1.1's scaffolding is solid.

**Phase 1 exit criteria (overall):** Tabula Medica side can register Uninsurance as a SMART client and respond to consent + token requests against test data; Care Access bridge serves de-identified signals end-to-end with audit trail.

### Phase 2 — Linking flow

Owner: agent.

- [ ] User-facing consent UI in Tabula Medica app (the "Allow Uninsurance to access your records" screen + scope selection).
- [ ] Consent persistence in `linkConsentsTable`.
- [ ] Audit-log writers for grant/revoke events (extends existing HIPAA audit infrastructure).
- [ ] Uninsurance OAuth client registration with Tabula Medica's SMART authorization server (configuration only, no UI).
- [ ] FHIR scope enforcement — verify token-exchange returns ONLY the user-granted scopes.
- [ ] Revocation API + UI (in Tabula Medica's settings → Connected accounts).

**Exit criteria:** end-to-end linking flow works in a staging environment with a dummy Uninsurance client.

### Phase 3 — UX integration

Owner: agent.

- [ ] "My Uninsurance Membership" tab in Tabula Medica app (read-only, deep-link writes).
- [ ] "My Health Records" tab in Uninsurance app (assumes Uninsurance app exists or is built in parallel; this plan does not commit to Uninsurance app build scope).
- [ ] Empty states for both tabs.
- [ ] Cross-app deep-link infrastructure (universal links on iOS, app links on Android, fallback web URLs).

**Exit criteria:** a user with linking active sees data populated in both tabs; a user without linking sees the connect-CTA empty state.

### Phase 4 — Polish + compliance documentation

Owner: agent + Rajiv (compliance docs).

- [ ] Revocation UI polish — confirmation modals, audit-trail display ("Last revoked on...").
- [ ] Audit-log mirror queue from Tabula Medica → Uninsurance (durable Pub/Sub).
- [ ] Update Privacy Policy + HIPAA Notice in both apps to reflect linking flows.
- [ ] Update Termly content to cover cross-entity data sharing.
- [ ] Compliance evidence collection (Comp AI uploads if applicable).

**Exit criteria:** ready for App Store re-review with linking active and a security audit signed off.

---

## Section 8 — Open Questions to User

Questions that can't be answered from context alone. Numbered for easy reference at review.

### 8.1 — Care Access microservice current state

**RESOLVED 2026-04-20 by user (reality reconciliation directive):** Option (c) — **planned but not yet built.** The `CARE_BRIDGE_SECRET` env var and `client/src/pages/care-index.tsx` UI stub are scaffolding only; the server-side microservice does not yet exist in this repo or any other. Phase 1 of §7 has been expanded into three sub-phases (1.1, 1.2, 1.3) to make the build-the-bridge work concrete and estimable. See §7 Phase 1 for the revised breakdown.

Original options preserved for traceability:
- (a) In this repo, but I missed it during recon — please point to the file
- (b) In a separate repo — please name it
- (c) **Planned but not yet built — Phase 1 of §7 absorbs the build** ← CONFIRMED
- (d) The term refers to the `/care-index` page + `CARE_BRIDGE_SECRET` env, which is currently a stub awaiting a backend implementation

### 8.2 — Inter-entity legal structure

§1.2 recommends Option A (sibling LLCs under a common holding company). What is the actual current structure today, and is forming a holding company in scope or out of scope for this initiative?

### 8.3 — Entitlements implementation

§2.2 recommends Option A (Auth0 claims + per-app revoke flag). Confirm or pick Option B.

### 8.4 — Uninsurance app deployment topology

The Uninsurance product currently lives inside `tabula-medica-mobile/` (per pre-flight finding). Plan assumes Uninsurance becomes its own deployable (own iOS app ID, own Android package, own web hostname). Is that the actual roadmap, or does Uninsurance ship as a "tab inside the Tabula Medica app" first and split out later?

### 8.5 — Default scope set

§4.4 recommends `patient/Coverage.read + patient/Condition.read + patient/MedicationRequest.read` as the default scope set for Uninsurance. Does this match Uninsurance's actual personalization needs, or is the scope set wider/narrower?

### 8.6 — Brand color execution

Section 11 (cousins) recommends a teal-family anchor (Tabula Medica's existing `#0D9488` per Action Item X). What is Uninsurance's exact teal-family variant? (e.g. a darker shade `#0F766E`, a lighter shade `#14B8A6`, or a sibling hue like a teal-leaning emerald.)

### 8.7 — Holding-company name (if Option A in §1.2)

If forming a holding company, does it have a working name, or is this TBD?

### 8.8 — Common-officer disclosure

Are both LLCs founded/officered by the same individual (Rajiv)? Affects how arms-length the inter-company services agreement needs to look on paper.

### 8.9 — Data-deletion default

When a user deletes their Tabula Medica account but retains their Uninsurance account, what happens to (a) their PHI in Tabula Medica, (b) the linking grant, (c) the Uninsurance-side cache of previously-fetched FHIR data? Default proposal: PHI deleted per existing Tabula Medica deletion policy, linking grant terminated, Uninsurance cache purged within 30 days. Confirm or adjust.

### 8.10 — Cross-app analytics

Is there a desire to do cross-app analytics (e.g. "users who use both apps engage 2x more")? If yes, this requires a separate analytics-only data-sharing track that is NOT covered by the BAA (because analytics data is de-identified). Out of scope for this plan; flagging only.

---

## Section 9 — Dependencies on Existing Action Items

| Action Item | Relationship | Blocking? |
|---|---|---|
| **N — drizzle schema reconcile** | Hard prerequisite for any new schema work, including `linkConsentsTable` (§7 Phase 1) | YES — Phase 1 cannot start until N is done |
| **R — cookie consent banner + preference center** | Cross-product linking consent UX is a sibling pattern to R; preference center should host the linking-consent toggle (§4.5 revocation UI) | NO — but co-design saves rework |
| **Q — AI opt-out** | Linking opt-in/opt-out is conceptually similar to AI opt-in/opt-out; same UI pattern works for both | NO — but pattern reuse expected |
| **U — accessibility remediation** | Any new linking UI must inherit U's button base sizing (44pt iOS HIG) and contrast-token fixes from Top 5 findings | NO — but new UI built before U lands inherits the failures |
| **L — versioned ciphertext envelope + key ring** | If Uninsurance receives encrypted FHIR data and needs to participate in re-encryption windows, key versioning matters | NO at MVP — token-based access avoids ciphertext crossing the boundary; flag for Phase 4+ |
| **M — key escrow + recovery runbook** | Inter-entity escrow may need a different runbook than single-entity | NO — current runbook covers Tabula Medica; Uninsurance gets a parallel runbook in Phase 4 |
| **P — push notifications** | Linking events (grant, revoke, sync complete) are good candidates for push; both apps would push independently | NO — but plan notification copy in Phase 3 |
| **S — CI pipeline** | Already shipped; covers Tabula Medica only. Uninsurance app will need its own CI when split out | NO at MVP |
| **T — logger ESLint rule** | Already shipped; new Care Access service code should use object-form logging from day 1 | NO — but enforce |
| **X — LegalDocument styling** | Privacy Policy + BAA-derived disclosures in both apps will use the LegalDocument component; X's styling work directly applies | NO — but co-deliver |
| **F1 encryption migration (services backlog)** | Care Access bridge MUST NOT introduce new string-form loggers or unencrypted PHI columns | NO — but enforce via existing F1 program |

---

## Section 10 — Non-Goals for This Document

To avoid scope creep:

- **No code written.** Zero source files modified, zero new source files created.
- **No schema changes.** `linkConsentsTable` is named in §7 Phase 1 but not designed in detail; Drizzle definition deferred to Phase 1 build session.
- **No Auth0 configuration changes.** Tenant settings, application registrations, and role definitions are described in §2 but not modified.
- **No Stripe configuration changes.** Account separation described in §3 but no API calls made.
- **No Phase 1 implementation kickoff.** This document is the gating deliverable; Phase 1 starts only after explicit go-ahead from Rajiv.
- **No legal-entity formation.** Holding-company recommendation in §1.2 is technical advice; legal counsel + Rajiv's decision drives actual entity work.
- **No BAA/DSA/ICSA drafting.** Document templates and execution are a legal-counsel deliverable, not an agent deliverable. This plan describes what they should cover.
- **No Uninsurance app build commitment.** This plan is silent on when/how the Uninsurance app itself is built — that's a separate scoping conversation tied to §8.4.

---

## Section 11 — Brand Family Relationship ("Cousins")

Per refined directive: Tabula Medica and Uninsurance are **same-family cousins** — neither white-label nor parent/subsidiary nor unrelated brands. Recognizable as related without confusion.

### 11.1 Shared brand layer

| Element | Shared value |
|---|---|
| **Color anchor** | Teal `#0D9488` (Tabula Medica's existing brand color, per Action Item X). Both brands use this teal-family palette as their backbone. |
| **Color variant** | Uninsurance uses a sibling teal — e.g. a slightly darker `#0F766E` or a complementary hue within the same family. Concrete value pending §8.6 decision. |
| **Typography** | Inter / system-ui stack, identical across both apps. Type scale, weight ramp, and rhythm match. |
| **Component library** | Shadcn/ui + Radix primitives + the shared utilities in this repo's `client/src/components/ui/`. Uninsurance app pulls from a shared NPM package or git submodule (deployment topology TBD). |
| **Icon set** | lucide-react (Tabula Medica's existing standard) for both apps. |
| **Voice / tone** | Plain-language, accessibility-first, non-alarming. Both apps avoid medical jargon by default; both expose simplified-language modes via accessibility settings. |

### 11.2 Distinct brand layer

| Element | Tabula Medica | Uninsurance |
|---|---|---|
| **Logo** | Records-motif (e.g. layered document pages, a stethoscope, or the existing Tabula Medica wordmark) | Membership-motif (e.g. an open door, a key, an inclusive arch — distinct visual metaphor for affordable access) |
| **Tagline** | TBD; currently absent from `replit.md` | TBD |
| **Marketing surface** | `tabulamedica.health` | `uninsurance.health` (or similar; domain TBD) |
| **App Store presentation** | Two separate App Store listings, two screenshots packs, two App Store Connect entries |

### 11.3 The "cousins recognized without confusion" test

User opens Tabula Medica, then opens Uninsurance. Should think: "These feel like they come from the same people, but they do different things." Should NOT think: "Am I in the same app? Where's my Uninsurance membership? Why are these so different?"

**Operational test:** put both app icons next to each other on a home screen. A user who has used one should be able to find the other based on visual family resemblance alone.

### 11.4 Anti-patterns

- **Co-branding within an app** ("Tabula Medica × Uninsurance") — feels like a partnership ad, undermines the cousins framing. Don't do.
- **Identical visual treatment** — eliminates the distinct-products signal. The user should know which app they're in at a glance.
- **Fully divergent design systems** — defeats the family. Custom typefaces or wildly different palettes break recognition.

---

## Section 12 — Shared vs Separate (Aristotelian Balance)

The architecture sits between two failure modes:

- **Fully coupled** (one codebase, one entity, one product with two faces) — consolidates the regulatory blast radius, mixes DMPO and HIPAA postures, makes the Stripe/legal split meaningless. Apple reviewers, HHS auditors, and Virginia BOI all see commingling.
- **Fully decoupled** (two completely independent companies that happen to be founded by the same person) — duplicates Auth0 cost, duplicates engineering effort, gives users no benefit of the unified experience, makes the linking promise harder to fulfill technically.

The Aristotelian mean: **share what is safe to share; separate what must be separated.**

### 12.1 The boundary table

| **SHARED layer (coupled)** | Why shared |
|---|---|
| Auth0 tenant + user identity | One account = lower friction; identity is not regulated PHI; cost saving |
| Design tokens (color, typography, spacing) | Brand-family recognition (§11) |
| Component library (shadcn/ui base) | Consistency without duplication; fixes shipped to both apps in one PR |
| **Care Access microservice** | The bridge IS the unified-experience enabler; can only be one canonical bridge |
| **FHIR bridge endpoint** | Same reason — the de-identification pipeline is a single audited surface |
| **SMART on FHIR authorization server** | Standards demand a single authoritative AS for a given FHIR resource server |
| Inter-Company Services Agreement (the legal vehicle for shared engineering) | Allows shared engineering without piercing the entity firewall |

| **SEPARATE layer (decoupled)** | Why separate |
|---|---|
| Legal entities (LLCs) | Regulatory firewall — HIPAA CE vs DMPO posture cannot commingle |
| Stripe merchant accounts | Revenue accounting per entity; refund handling per entity; DMPO reporting clean |
| DMPO registration | Belongs to Uninsurance only; Tabula Medica must not be associated with DMPO marketing |
| HIPAA Covered Entity status | Belongs to Tabula Medica only; Uninsurance is BA-only when linked, never CE |
| Brand execution (logos, taglines, marketing surfaces) | Distinct products (§11) |
| **Data stores at the FHIR boundary** | PHI lives in Tabula Medica's encrypted Postgres only; Uninsurance never persists raw FHIR beyond the BAA-defined cache window |
| Audit logs (with mirroring) | Each entity owns its audit log; bridge mirrors PHI-touching events to Uninsurance per BAA |
| App Store listings | Two products = two listings (Apple's rule too) |
| Privacy Policies, Terms of Use, HIPAA Notices | Per entity; cross-references where linking is described |

### 12.2 Anti-patterns — what happens if you violate the boundary

**Violating the SEPARATE side (over-coupling):**
- "Just use one Stripe account for both" → Uninsurance refunds come out of Tabula Medica's revenue ledger; DMPO state filings show wrong revenue numbers; both LLCs' accountants quit.
- "Just put PHI in Uninsurance's database for fast access" → Uninsurance's DMPO posture is now also a HIPAA-regulated environment; double-regulation; no upside; massive compliance cost increase.
- "Just call them one product internally" → developers stop thinking about the firewall; first PHI leak across entities is when you find out.

**Violating the SHARED side (over-decoupling):**
- "Each app needs its own user database" → users have to create two accounts; reset-password flows fork; account-merge requests become a support nightmare.
- "Each app uses its own component library" → button sizing diverges; one app fixes WCAG findings, the other doesn't; brand family fades.
- "Each app builds its own SMART-on-FHIR client/server" → standards drift; security audits multiply; one app fixes a token-exchange bug, the other ships it for another year.

### 12.3 Decision rule for future "should this be shared or separate?" questions

When in doubt, ask:
1. Does this concern touch PHI, money, or regulatory posture? → **Separate.**
2. Does this concern touch developer ergonomics, brand recognition, or user identity? → **Shared.**
3. Does this concern straddle both? → **Bridge it.** A bridge has a clear contract, a signed payload, and an audit log. Care Access is the canonical example.

---

## Document close

This planning document is the gating deliverable for the unified Tabula Medica + Uninsurance architecture. No code, schema, or configuration changes flow from this document directly. Phase 0 of §7 is the next user-side action: review this plan, answer §8 open questions, and approve the entity-relationship + entitlements + scope-set decisions before Phase 1 begins.

**Filed by:** Replit agent, Saturday architectural session, 2026-04-18.
**Status:** AWAITING USER REVIEW.
