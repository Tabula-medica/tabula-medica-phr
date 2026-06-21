# Three-Site Compliance Matrix
**Prepared for:** healthcare counsel review (BAA template + risk register)
**As of:** 2026-05-03
**Sites in scope:**
- **TM** = `tabulamedica.health` — Tabula Medica LLC (patient-centric PHR, SMART-on-FHIR)
- **UI** = `uninsurance.care` — Uninsurance LLC (Virginia DMPO, membership-for-access)
- **SAWD** = `sawd.ai` — entity TBD (currently `Disallow: /` in robots; public posture undecided)

Cell legend: **A** = Applies (compliance obligations triggered today); **C** = Conditional (triggered only when X happens); **N/A** = Not applicable; **TBD** = depends on entity / strategy decision pending.

---

## 1. Federal / sectoral health frameworks

| Framework | TM (Tabula Medica) | UI (Uninsurance) | SAWD | Owner / Evidence Needed |
|---|---|---|---|---|
| **HIPAA Privacy Rule (45 CFR §164 subpart E)** | **A** — Covered Entity (PHR receiving PHI from EHRs) | **C** — Business Associate of TM **only** when a user activates SMART linking; otherwise N/A | TBD — A only if SAWD touches PHI from TM/UI | TM: NPP, BAA template, minimum-necessary policy. UI: BAA-with-TM signed at entity level (one PDF). |
| **HIPAA Security Rule (45 CFR §164 subpart C)** | **A** — Admin/Physical/Technical safeguards | **C** — same trigger as above | TBD | TM: risk analysis, encryption at rest (AES-256-GCM in `phi-encryption.ts`), audit log retention 6yr (`hipaaAuditLogsTable`). |
| **HIPAA Breach Notification Rule (45 CFR §164 subpart D)** | **A** | **C** (when BA-active) | TBD | Both: documented IR runbook, 60-day HHS notice + media notice if ≥500 individuals. |
| **HITECH Act / Omnibus Rule** | **A** — patient right of access in 30 days, electronic copy obligation | **C** | TBD | TM: portability via FHIR R4 export endpoint. |
| **42 CFR Part 2** (substance-use records) | **C** — only if user imports SUD treatment records from a Part 2 program | **C** — inherits if BA-active and data flows | **N/A** unless SAWD touches treatment data | TM: segregation flag on `documentsTable.isSensitive`; written re-disclosure consent before sharing. |
| **HHS §1557 (anti-discrimination)** | **A** — health program receiving federal financial assistance (likely, via Medicare/Medicaid pass-through eventually) | **A** — DMPO providing care access likely qualifies; stricter scrutiny on provider-network curation | **C** — only if SAWD becomes a health program | Both: language-access plan, accessibility (WCAG 2.1 AA — see `section-508-vpat.md`), non-discrimination notice. |
| **FDA SaMD (Software as a Medical Device)** | **C** — symptom-checker (`/api/symptom-checker/triage`) is currently positioned as "informational triage", **not** diagnostic. If positioning shifts to "tells user the diagnosis" → 510(k) Class II likely | **N/A** | TBD per SAWD product | TM: enforce informational disclaimers in UI (already present); maintain `RED_FLAG_RULES` evidence base. |
| **FTC Health Breach Notification Rule** (PHR vendors) | **A** — TM is a personal health record vendor; FTC enforces breach notice **in addition to** HIPAA | **C** | TBD | TM: 60-day FTC notice on breach of unsecured PHR identifiable health info. |
| **CMS Interoperability & Patient Access (45 CFR §170)** | **A on the receiving side** — TM consumes USCDI v3 via SMART-on-FHIR | **N/A** | **N/A** | TM: USCDI v3 mapping table in `server/services/fhir-resource-mapper.ts`. |
| **ONC Information Blocking** | **C** — only if TM ever holds EHI as actor; today TM is a patient-side aggregator, not a regulated actor | **N/A** | **N/A** | TM: monitor scope changes. |

---

## 2. State health-business frameworks

| Framework | TM | UI | SAWD | Owner / Evidence Needed |
|---|---|---|---|---|
| **Virginia DMPO (§38.2-6300 et seq.)** | **N/A** | **A** — registration filed/pending; "this is not insurance" disclosure mandatory; cannot use word "insurance" in marketing | **N/A** | UI: state filing, marketing review, member complaint log. |
| **State medical-licensing boards** | **C** — only if TM ever brokers a licensed clinician interaction | **A** — provider-network credentialing | **N/A** | UI: credentialing files, primary-source verification. |
| **State PHR / health-data laws** (CA AB 352, NY SHIELD Act, TX HB 300, WA My Health My Data) | **A** for TX HB 300 (PHR vendor); **A** for WA MHMDA (consumer health data, even non-HIPAA) | **A** — WA MHMDA covers consumer health data regardless of HIPAA status | **C** — A under WA MHMDA if SAWD touches consumer health data | Both: WA MHMDA consent flow, geofence sensitive-location protections, separate data-broker registration if selling. |
| **State breach-notification laws (50 states)** | **A** | **A** | **A** if any PI collected | Both: matrix of state notice deadlines (typically 30–60 days, CA + IL + NY most aggressive). |

---

## 3. Consumer-privacy frameworks

| Framework | TM | UI | SAWD | Owner / Evidence Needed |
|---|---|---|---|---|
| **CCPA / CPRA (California)** | **A** — exceeds revenue/consumer thresholds expected once public; today A as conservative posture | **A** — same | **A** if any CA traffic | All three: privacy policy with CCPA disclosures, "Do Not Sell or Share" link (TM has `/do-not-sell-or-share` route), opt-out of sensitive-PI processing. |
| **VCDPA (Virginia)** | **C** — triggers at 100k consumers OR 25k consumers + 50% revenue from data sales (per `f1-action-items.md` Action R triage: not yet triggered) | **C** — same threshold | **C** | All three: data inventory; trigger DPIA when threshold hit. |
| **CPA / CTDPA / UCPA / TDPSA / IDP** (CO, CT, UT, TX, IN — comprehensive state laws live 2024-26) | **C** — same threshold pattern as VCDPA | **C** | **C** | All three: monitor consumer count by state; UCPA exempts HIPAA-CE-as-CE, others vary. |
| **GDPR / UK-GDPR** | **C** — only if EU/UK residents sign up; today TM is US-focused but `client/src/i18n` includes EU locales | **C** — same | **C** | All three: Art. 6 lawful basis, Art. 9 explicit consent for health data, Art. 15-22 DSR endpoints, DPO appointment if scale crosses Art. 37 trigger. **Usercentrics CMP loader added 2026-05-03; awaiting settings ID.** |
| **PIPEDA (Canada)** | **C** | **C** | **C** | Monitor cross-border traffic. |

---

## 4. Marketing / commerce frameworks

| Framework | TM | UI | SAWD | Owner / Evidence Needed |
|---|---|---|---|---|
| **FTC Act §5 (unfair or deceptive practices)** | **A** — landing-page claims must be truthful (✅ "SOC 2 Type II" softened to "In Progress" 2026-05-03 — fixed) | **A** — DMPO marketing especially scrutinized; "not insurance" disclosure | **A** — any future SAWD marketing claims | All three: claims-substantiation file, screenshot archive of marketing pages with timestamps. |
| **CAN-SPAM** | **A** if marketing emails sent | **A** | **A** | All three: physical postal address in footer, one-click unsubscribe. |
| **TCPA** (SMS/voice) | **A** if any SMS/voice outreach | **A** | **A** | All three: prior express written consent for marketing SMS. |
| **DMCA / IP** | **A** — designated agent registered? | **A** | **A** | All three: designated agent filed at copyright.gov ($6/yr). |

---

## 5. Payment / financial frameworks

| Framework | TM | UI | SAWD | Owner / Evidence Needed |
|---|---|---|---|---|
| **PCI-DSS** | **N/A direct** — Stripe Checkout offloads card handling (SAQ-A) | **N/A direct** — same Stripe pattern | **N/A** | Both: SAQ-A self-attestation annually. |
| **ERISA** | **N/A** — TM not a plan administrator | **N/A** — DMPO explicitly **not** insurance/plan | **N/A** | Counsel confirm in BAA / membership-agreement language. |
| **FTC Negative Option / "Click-to-Cancel"** (effective 2025) | **A** — auto-renew tier billing must support same-channel cancellation | **A** — DMPO membership renewal | **C** | Both: cancel-in-app flow visible from billing screen. |

---

## 6. Cross-entity contracts and data flows

| Contract | Parties | Trigger | Owner / Status |
|---|---|---|---|
| **TM ↔ UI Business Associate Agreement** | Tabula Medica LLC (CE) ↔ Uninsurance LLC (BA) | Executed once at entity level; per-user activation implicit when user authorizes SMART linking | **PENDING** — template needed from counsel. Section 6 of `unified-architecture-plan.md` is the spec. |
| **TM ↔ each EHR vendor** | TM ↔ Epic / Cerner / etc. | TM is the SMART-on-FHIR app developer; SMART app developer agreement, not BAA, because patient is the actor | **PARTIAL** — Epic Sandbox + Fasten Connect terms in place; production-vendor agreements pending Epic App Orchard / Cerner Code production access. |
| **TM ↔ subprocessors** | TM ↔ GCP, Auth0, OpenAI, Plausible, Usercentrics, Stripe, RevenueCat, Sentry | Each vendor handling PHI or PI requires DPA | **PARTIAL** — GCP BAA in place; Auth0 BAA in place; OpenAI Enterprise BAA needed (currently using API w/o BAA — **ACTION**); Stripe DPA standard; Plausible DPA (no PHI exposure given path-exclusion); Usercentrics DPA. |
| **TM ↔ user** | TM ↔ patient/beta participant | Beta participant agreement gates real-PHI flow | **SHIPPED** 2026-05-03 — `beta_consent_agreements` table + `requirePhiAccess` middleware + `/beta-consent` page. |

---

## 7. Risk-register hot items (counsel attention requested)

1. **OpenAI subprocessor without BAA** — `OPENAI_API_KEY` is used in `server/routes/symptom-checker-routes.ts` with `response_format: json_object`. The symptom checker accepts user-typed symptom text which is not technically PHI when not tied to identifiable account, but route runs while authenticated and request body could contain identifying detail. **Options:** (a) sign OpenAI Enterprise BAA, (b) move to Vertex AI on GCP under existing GCP BAA, (c) strip identifiers server-side before send.
2. **Cloudflare WAF / robots.txt template override** — Cloudflare is currently serving a custom robots.txt template that overrides the origin file, blocking GPTBot et al. **Action:** disable in Cloudflare dashboard for `tabulamedica.health` AND `sawd.ai` zones. (Action not in counsel scope; flagged here for awareness.)
3. **SAWD entity / posture undecided** — without a registered legal entity for SAWD this matrix cannot mark obligations as Owner=SAWD-LLC. Counsel needed to confirm whether SAWD ships as (a) DBA of TM, (b) DBA of UI, (c) third sibling LLC.
4. **Minor age-of-majority transition** — system now flags child profiles whose DOB+18y has passed (`profile.transitionStatus = 'pending'`). Need counsel-approved language for the in-app notice to both former-guardian and new-adult, and the consent flow for the new adult to claim their own account.
5. **Beta-PHI exposure prior to 2026-05-03** — any account that connected a real EHR before this date did so without signing the new agreement. **Recommend:** retroactive notice to those accounts asking them to sign current version OR re-confirm; pause SMART connections for accounts that don't.
6. **No completed SOC 2 Type II** — landing-page wording softened to "in progress" but procurement teams will still ask. Need a SOC 2 readiness letter from auditor on letterhead to attach to RFP responses.

---

## 8. Control-evidence index (for the certifying auditor)

Auditors (HITRUST, SOC 2, HIPAA RA firms) will not ask "do you comply" — they ask "show me the control and the evidence." This table maps every control we already have in code to (a) the file/path that implements it and (b) where the runtime evidence lives. Any cell marked **GAP** is open work.

### 8.1 HIPAA Security Rule — Technical Safeguards (45 CFR §164.312)

| Standard | Control | Implementation (path) | Evidence location |
|---|---|---|---|
| §164.312(a)(1) Access control | Unique user identification | Auth0 `sub` + `accounts.id` UUID | `accounts` table; Auth0 logs |
| §164.312(a)(2)(i) Unique user ID | Per-account UUID + email-hash bridge | `shared/schema.ts` accounts table | DB row per user |
| §164.312(a)(2)(iii) Automatic logoff | Session timeout middleware | `server/security/index.ts` → `sessionTimeoutMiddleware`, `startSessionCleanupScheduler` | Workflow log: `[SessionTimeout] Session cleanup scheduler started (every 300s)` |
| §164.312(a)(2)(iv) Encryption & decryption | AES-256-GCM at field level | `server/security/phi-encryption.ts` | `logPhiKeyFingerprints()` boot log |
| §164.312(b) Audit controls | Append-only audit log w/ hash chain | `server/services/worm-audit-log-service.ts`; `hipaaAuditLogsTable` | Workflow log: `[WORMAuditLog] Tamper-evident logging enabled` |
| §164.312(c)(1) Integrity | WORM semantics + SHA-256 hash chain | Same as above | DB rows append-only |
| §164.312(d) Person/entity authentication | Auth0 SSO + optional MFA | `server/replit_integrations/auth/replitAuth.ts`; `mfaSecretsTable` | `mfa_enabled` column per account |
| §164.312(e)(1) Transmission security | TLS 1.2+ enforced | Cloudflare edge + Express HSTS via `helmetMiddleware` | Cloudflare SSL config + `securityHeaders` |
| **§164.312(b) Beta-PHI consent** *(new control)* | Real-PHI access gated by signed agreement | `server/middleware/require-phi-access.ts`; `server/routes/beta-consent-routes.ts` | `beta_consent_agreements` table — one row per signing with SHA-256, IP, UA |

### 8.2 HIPAA Security Rule — Administrative & Organizational Safeguards (§164.308 / §164.314)

| Standard | Control | Implementation | Evidence | Status |
|---|---|---|---|---|
| §164.308(a)(1)(i) Security mgmt process | Risk analysis | `.local/deliverables/key-management-audit.md`, `f1-encryption-plan-v2.md` | Doc files | ✅ |
| §164.308(a)(1)(ii)(D) Information system activity review | Audit-log review cadence | **GAP** — no documented monthly review SOP | Need: SOP doc | 🔴 |
| §164.308(a)(3) Workforce security | Background checks, separation of duties | **GAP** — solo founder; document compensating controls | Need: WISP / written info-sec program | 🔴 |
| §164.308(a)(4) Information access management | RBAC + minimum necessary | `server/services/feature-gates.ts`; `server/middleware/require-feature.ts` | Per-route gate metadata | ✅ |
| §164.308(a)(5) Security awareness training | Annual training | **GAP** — N/A solo, document on hire-1 | Need: training log | 🔴 |
| §164.308(a)(6) Security incident procedures | IR runbook | `.local/deliverables/audit-methodology-notes.md` (partial) | **GAP** — need named runbook | 🟡 |
| §164.308(a)(7) Contingency plan | Backup + DR | GCP Cloud SQL automated backups | **GAP** — no documented restore drill | 🟡 |
| §164.308(a)(8) Evaluation | Periodic technical evaluation | This document + scans | Doc + scan output | 🟡 |
| §164.308(b) Business associate contracts | BAA with subprocessors | GCP ✅, Auth0 ✅, OpenAI 🔴, Stripe ✅, RevenueCat ✅, Plausible 🟡, Usercentrics 🟡 | Signed BAAs in folder | 🟡 |
| §164.314(a) BA contracts | Entity-level BAA TM↔UI | **PENDING** counsel template | Will be PDF in legal folder | 🔴 |

### 8.3 HIPAA Privacy Rule — Patient Rights (§164.524–.528)

| Right | Implementation | Evidence |
|---|---|---|
| §164.524 Right of access (30 days) | FHIR R4 export + per-resource API | `server/routes` (multiple); response time tracked in audit log | ✅ |
| §164.526 Right to amend | **GAP** — no in-app amendment-request flow | Need: `/privacy/manage` amendment form | 🔴 |
| §164.528 Accounting of disclosures | `hipaaAuditLogsTable` + `/api/my-audit-trail/*` | Patient-facing audit-trail page | ✅ |
| §164.522 Right to request restriction | `/api/gdpr/*`, `/api/ccpa/*` | Self-serve dashboards | ✅ |

### 8.4 SOC 2 Trust Services Criteria (Common Criteria + Security)

| TSC | Control | Implementation | Evidence |
|---|---|---|---|
| CC1.1 Demonstrates commitment to integrity | Code of conduct | **GAP** — needed pre-audit | 🔴 |
| CC2.1 Communicates information internally | This doc + `replit.md` | Repo files | ✅ |
| CC3.1 Risk identification | Risk register §7 above | This doc | ✅ |
| CC4.1 Monitoring activities | `unifiedComplianceMiddleware` + workflow logs | `server/security/compliance-middleware.ts` | ✅ |
| CC5.1 Control activities | Per-route middleware stack | `server/index.ts` lines 131-146 | ✅ |
| CC6.1 Logical access — provisioning | Auth0 + first-party `accounts` | Code + Auth0 dashboard | ✅ |
| CC6.2 Logical access — auth | Auth0 + MFA toggle | `mfa_enabled` column | ✅ |
| CC6.3 Logical access — removal | `delete account` flow | `server/routes` deletion endpoints | ✅ |
| CC6.6 Boundary protection | Cloudflare WAF + rate limiters | `apiRateLimiter`, `applyAuthRateLimiting` | ✅ |
| CC6.7 Data transmission | TLS + CSP | `helmetMiddleware`, `corsMiddleware` | ✅ |
| CC6.8 Malware prevention | Dependency audit | `npm audit` + `runDependencyAudit` skill | 🟡 (run + retain output) |
| CC7.1 System monitoring | Plausible (perf/usage) + workflow logs | Plausible dashboard, GCP logs | ✅ |
| CC7.2 Anomaly detection | **GAP** — no SIEM/alerting on auth-fail spikes | Need: alerting rules | 🔴 |
| CC7.3 Incident evaluation | IR runbook | Same gap as §164.308(a)(6) | 🟡 |
| CC7.4 Incident response | Same | Same | 🟡 |
| CC8.1 Change management | Git + Replit checkpoints | Git history | ✅ |
| CC9.2 Vendor management | Subprocessor list + DPAs | Need: maintained vendor inventory doc | 🟡 |

### 8.5 Pre-audit checklist (12-week prep before auditor walks in)

| Week | Deliverable | Owner |
|---|---|---|
| 1 | Pick auditor (HITRUST CSF Validated vs SOC 2 Type II vs HIPAA RA firm) | Founder |
| 1 | Sign engagement letter + scope ROC | Founder + Counsel |
| 2 | WISP (Written Information Security Program) — required by §164.308(a)(1) | Counsel + Founder |
| 2 | IR runbook (named, version-controlled) | Founder |
| 3 | Vendor inventory + DPA folder | Founder |
| 3 | OpenAI BAA signed OR migrate symptom-checker to Vertex AI | Founder |
| 4 | Backup & DR runbook + first restore drill (screen-record) | Founder |
| 4 | Audit-log review SOP (monthly cadence, sample size, sign-off) | Founder |
| 5 | Right-to-amend in-app flow built | Engineering |
| 5 | SIEM/alerting on auth-fail spikes + admin actions | Engineering |
| 6 | TM↔UI entity-level BAA executed | Counsel |
| 6 | Subprocessor BAAs gap-closed (OpenAI, Plausible, Usercentrics) | Founder |
| 7 | Penetration test (external firm, $8-15k typical) | External vendor |
| 8 | Pen-test remediation | Engineering |
| 9 | Tabletop IR exercise (documented) | Founder + advisor |
| 10 | Internal pre-audit walkthrough using this matrix as scorecard | Founder |
| 11 | Auditor fieldwork begins | Auditor |
| 12 | Findings response + remediation plan | Founder + Auditor |

### 8.6 Quick-reference: "what auditor will type in the first hour"

The auditor will spend the first hour asking three questions. Answers below are pre-written:

> **Q: Show me your data flow diagram including all subprocessors and where PHI rests.**
> A: §1 of `unified-architecture-plan.md` + this matrix §6. Subprocessors: GCP (storage + Cloud SQL, BAA signed), Auth0 (identity, BAA signed), OpenAI (symptom checker, BAA pending — see §7 risk #1), Stripe (billing, no PHI exposure), RevenueCat (mobile billing, no PHI), Plausible (web analytics, path-excluded from PHI surfaces — see `client/index.html`), Usercentrics (CMP, no PHI), Sentry (errors, scrub-rules in place).

> **Q: How do you know your audit log is tamper-evident?**
> A: `server/services/worm-audit-log-service.ts` implements append-only with SHA-256 hash-chain. Every row's `hash` includes the prior row's hash; chain verification endpoint at `/api/worm-audit/verify`.

> **Q: What's your encryption-at-rest strategy?**
> A: Two layers — (1) GCP Cloud SQL platform encryption (AES-256, GCP KMS), (2) field-level encryption on PHI columns via `server/security/phi-encryption.ts` (AES-256-GCM, key from `PHI_ENCRYPTION_KEY` env, salt rotation supported via `PHI_ENCRYPTION_SALT_V2` — currently in flight, see `f1-encryption-plan-v2.md`). Key fingerprints logged at boot for evidence; master keys never logged.

---

*This document is a working aid for counsel review and pre-audit prep. It is not legal advice and is not authoritative on any obligation. All compliance posture decisions must be confirmed by licensed counsel of record for each entity, and all control claims must be independently verified by the engaged auditor.*
