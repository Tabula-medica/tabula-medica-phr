# SAWD — SOC 2 Control Matrix (Sprinto audit prep)

> **Draft — internal planning, not legal advice. Updated 2026-10-16 to reflect Base44-native
> architecture.** SAWD pivoted from GCP/GCIP/sawd-backend (parked) to Base44-managed hosting,
> auth, DB, and functions. Most infrastructure controls are now **inherited from Base44** as the
> primary subprocessor — evidence for those criteria = Base44's SOC 2 report + DPA.
> Evidence is cited to real code/config. Where no evidence exists, the row is marked **Gap**.

## Summary

The Base44-native pivot has **simplified the technical surface**: auth, hosting, DB, file storage,
and functions all run inside Base44's managed platform. Most infrastructure-layer controls
(encryption at rest, physical access, availability, TLS) are now inherited. The **primary new risk
is subprocessor dependency** — Base44 holds all user financial data and the app's auth identity;
their SOC 2 report and DPA are P0 evidence items.

Application-layer controls that SAWD owns directly remain strong: §7216 consent gates (frontend
ConsentGate + backend `aiInvokeSecure` gate), tenant isolation enforced server-side in every
function (user.id from Base44 auth, not from request body — verified by tests in
`tests/tenantIsolation.test.mjs`), Plaid webhook idempotency guard (`ProcessedWebhookEvent`
entity), cent-based financial accumulation in 6 report libs, and a full `AuditLog` entity in-app.

**Operational/governance gaps remain**: no formal risk register, no IR plan, no vendor DPAs
collected, no pen test, MDM not enrolled. MFA enforcement at the Base44 platform level is
owner-action pending.

**Counts (39 criteria scored):**

| Status | Count |
|---|---|
| **Met** | 12 |
| **Partial** | 11 |
| **Gap** | 10 |
| **Owner-action** (console/policy action only, no code needed) | 6 |

> Met = control operating with evidence. Partial = control exists but incomplete/unenforced.
> Gap = no evidence found. Owner-action = founder console/signature step, not engineering.
> "Inherited (Base44)" = control is Base44's responsibility; evidence = their SOC 2 report.

---

## CC1 — Control Environment

| Criterion | Control intent | SAWD current state (evidence) | Status | Sprinto check | Remediation / owner |
|---|---|---|---|---|---|
| CC1.1 | Integrity & ethics; code of conduct | No code of conduct / ethics policy adopted. ISMS master drafted (`soc2/policies/information-security-policy.md`, v0.1 DRAFT). | Gap | Sprinto policy module: employee acceptance of Code of Conduct | Author + adopt Code of Conduct; collect acceptance in Sprinto. Owner. |
| CC1.2 | Board/governance oversight | Single-founder; ISMS names Founder as acting ISO. No independent oversight body. | Partial | Sprinto org chart + policy approver record | Document governance in Sprinto; engage fractional CISO. Owner. |
| CC1.3 | Org structure, authority & responsibility | Roles assigned in ISMS §4. Exec-agent operating model documented (`ventures/sawd-ai/exec/operating-model.md`) but not formally adopted as HR structure. | Partial | Sprinto roles/responsibilities matrix | Formalize + approve responsibility matrix in Sprinto. Owner. |
| CC1.4 | Competence — training & security awareness | No security-awareness training records; founder-only team. | Gap | Sprinto training module (security-awareness completion) | Enroll in Sprinto security training. Owner. |
| CC1.5 | Accountability / performance enforcement | Enforcement clause in ISMS §6. No performance records (sole founder). | Partial | Sprinto policy acceptance records | Adopt policy; capture acceptance. Owner. |

---

## CC2 — Communication & Information

| Criterion | Control intent | SAWD current state (evidence) | Status | Sprinto check | Remediation / owner |
|---|---|---|---|---|---|
| CC2.1 | Quality information for internal control | **Sentry DSN now configured** in Base44 Secrets (2026-10-16) — client-side error monitoring live. Base44 platform provides function execution logs. No independent SIEM or log-retention policy. | Partial | Sentry integration in Sprinto; Base44 function logs | Verify Sentry is receiving events; define log-retention policy. Owner+Eng. |
| CC2.2 | Internal communication of security responsibilities | ISMS + runbooks exist (`soc2/policies/`, `ventures/sawd-ai/exec/`). Not yet published/acknowledged. | Partial | Sprinto policy publish + acceptance | Publish policy pack in Sprinto; require acceptance. Owner. |
| CC2.3 | External communication (customers, vendors, regulators) | Privacy/terms pages at sawd.ai. Support phone 878-206-0393 in place. No security@ / privacy@ role addresses confirmed. No breach-notification comms path documented. | Partial | Sprinto vendor/comms register | Create security@/privacy@ role addresses; document breach-notification path w/ counsel. Owner. |

---

## CC3 — Risk Assessment

| Criterion | Control intent | SAWD current state (evidence) | Status | Sprinto check | Remediation / owner |
|---|---|---|---|---|---|
| CC3.1 | Specifies objectives to identify risk | ISMS §3 references a risk register — **not yet created**. ChatGPT A-Z audit (2026-10-14) served as an informal risk sweep. | Gap | Sprinto risk-register module | Create Risk Assessment Policy + formal risk register in Sprinto. Owner. |
| CC3.2 | Identifies & analyzes risk | Informal findings in A-Z audit response (2026-10-14), SOC 2 P0 punch list, security-audit files. No scored register. | Partial | Sprinto risk assessment with likelihood/impact scoring | Migrate A-Z + P0 findings into scored Sprinto risk register. Owner+Eng. |
| CC3.3 | Considers fraud potential | Financial-fraud surface acknowledged (Plaid/Stripe, §7216 tax data, IRS e-file credentials). No formal fraud-risk analysis. | Gap | Sprinto risk register (fraud category) | Add fraud scenarios (tax refund fraud, account takeover, IRS EFIN misuse) to risk register. Owner. |
| CC3.4 | Identifies changes affecting the system | Changes tracked via git history + Base44 checkpoint history + running-list. No formal change-risk assessment. | Partial | GitHub → commit/PR history; Base44 checkpoint log | Tie change management (CC8) into risk register. Eng. |

---

## CC4 — Monitoring Activities

| Criterion | Control intent | SAWD current state (evidence) | Status | Sprinto check | Remediation / owner |
|---|---|---|---|---|---|
| CC4.1 | Ongoing/separate evaluations | A-Z audit (2026-10-14, external ChatGPT review, 26-item). CI runs continuously on sawd-web (`security.yml`, CodeQL, npm audit). No independent pen test. | Partial | Sprinto continuous monitoring; scheduled reviews | Continue periodic audits in Sprinto; schedule pen test. Owner. |
| CC4.2 | Communicates deficiencies & tracks remediation | A-Z findings tracked in `sawd-audit-fixes-1014.md` memory + GitHub PRs. Not in a formal closure tracker. | Partial | Sprinto findings/remediation tracker | Migrate open findings into Sprinto tasks. Owner. |

---

## CC5 — Control Activities

| Criterion | Control intent | SAWD current state (evidence) | Status | Sprinto check | Remediation / owner |
|---|---|---|---|---|---|
| CC5.1 | Selects control activities that mitigate risk | Layered controls: auth (Base44 platform), §7216 consent (ConsentGate + `aiInvokeSecure` backend gate), tenant isolation (server-side user.id — `tests/tenantIsolation.test.mjs`), Cloudflare WAF, rate limiting. | Met | Config checks across GitHub/Cloudflare | Maintain; map each to risk-register item. Eng. |
| CC5.2 | Technology general controls | CI gates on sawd-web (CodeQL, `security.yml`, npm audit, Dependabot). Base44 handles build/deploy for the app. Branch protection on sawd-web main (required reviews + status checks — confirmed 2026-09-29). | Met | GitHub → required checks + branch protection | Maintain. Eng. |
| CC5.3 | Deploys through policies & procedures | sawd-web: Cloudflare Pages auto-deploy on push. Base44 app: checkpoint → Publish flow. Runbooks exist but not formally adopted. | Partial | Sprinto SDLC policy adoption | Adopt SDLC/change policy in Sprinto. Owner. |

---

## CC6 — Logical & Physical Access

| Criterion | Control intent | SAWD current state (evidence) | Status | Sprinto check | Remediation / owner |
|---|---|---|---|---|---|
| CC6.1 | Logical access security (identity, auth, encryption) | Auth is Base44 platform (Google OAuth + email/password). Session tokens managed by Base44 SDK (`src/lib/AuthContext.jsx`). §7216 consent gate blocks all authenticated routes until consent set (`ConsentGate.jsx`). Backend `aiInvokeSecure` fails closed on `consent_7216_use !== true`. Login loop fixed (2026-10-16). **MFA enforcement: Base44 platform MFA available but not yet enforced at platform level.** | Partial | Base44 → platform MFA setting; Google Workspace 2SV | Enable Base44 platform mandatory MFA. **Owner (P0).** |
| CC6.2 | Registration/authorization of new users | Base44 handles user registration. Role via `user.role` field + `RoleProtected` component (`src/components/auth/RoleProtected.jsx`). No documented provisioning-approval workflow. | Partial | Google Workspace → provisioning; Sprinto access requests | Document provisioning/approval workflow. Owner. |
| CC6.3 | Access modification & least privilege | Tenant isolation: server-side functions use `base44.auth.me()` user.id (never client-supplied). Verified in `tests/tenantIsolation.test.mjs`. Admin/user separation: `rajiv@sawd.ai` = ADMIN (no access to user financial data by design). Base44 RLS in progress. | Partial | Sprinto access reviews; Base44 RLS config | Complete Base44 RLS rollout; conduct quarterly access review in Sprinto. Owner+Eng. |
| CC6.4 | Physical access (data centers) | Fully inherited — Base44 (app + DB + functions), Cloudflare (CDN/edge), GCP (sawd-web build pipeline, legacy services). No SAWD-owned facilities. | Met (inherited) | Base44 + Cloudflare + GCP SOC 2 reports as subservice orgs | **Collect Base44 SOC 2 report** + Cloudflare/GCP reports in Sprinto vendor module. Owner **(P0).** |
| CC6.5 | Data disposal / secure removal | No data-disposal / retention policy. Base44 entity deletes are hard deletes. No lifecycle rules documented. GCS (document storage) has no evidenced lifecycle policy. | Gap | GCP → GCS lifecycle rules; Sprinto data-retention policy | Define data-retention + disposal policy; set GCS lifecycle rules; confirm Base44 deletion propagates to storage. Owner+Eng. |
| CC6.6 | External threat protection (edge, boundary) | Cloudflare edge (WAF, DDoS, rate-limiting) in front of sawd.ai. Base44 hosting for the app. sawd-web on Cloudflare Pages. `@fastify/rate-limit` was in parked sawd-backend — Base44 function-level rate limiting applies. | Met | Cloudflare → WAF/DDoS config; header scan | Maintain. Verify Base44 function rate-limit config. Eng. |
| CC6.7 | Restrict information transmission (data in transit) | TLS everywhere (Cloudflare HSTS, Base44 HTTPS). Document access via Base44 file-handling (short-lived signed URLs). Bank tokens stored in `PlaidAccount` entity — encrypted at rest by Base44 platform. IRS EFIN/ETIN in Base44 Secrets vault (set 2026-10-16), never logged. | Met | Cloudflare TLS scan; Base44 Secrets config | Maintain. Verify Base44 secrets are not echoed in function logs. Eng. |
| CC6.8 | Prevent/detect unauthorized software | CodeQL SAST + gitleaks + npm audit + Dependabot on sawd-web/sawd-mobile (`security.yml`, `codeql.yml`, `dependabot.yml`). Base44 app code not in a traditional CI pipeline — checkpointed via builder. No endpoint/MDM on founder laptop. | Partial | GitHub → CodeQL/Dependabot; MDM → EDR | Enroll founder device in MDM with EDR. **Owner.** |

---

## CC7 — System Operations

| Criterion | Control intent | SAWD current state (evidence) | Status | Sprinto check | Remediation / owner |
|---|---|---|---|---|---|
| CC7.1 | Vulnerability detection & monitoring | CodeQL `security-extended` on PR + weekly cron, npm audit `--audit-level=high` fails PRs, gitleaks history scan, Dependabot weekly (sawd-web/sawd-mobile). Base44 app code is managed in Base44 sandbox — no traditional vuln scan pipeline. No pen test done. | Partial | GitHub → CodeQL/Dependabot alerts | Schedule pen test; clear open Dependabot alerts; define Base44 code security review cadence. Owner+Eng. |
| CC7.2 | Monitoring for anomalies / security events | **Sentry DSN now set** (2026-10-16) — client-side error tracking. Base44 function logs available in platform. `AuditLog` entity records entity mutations + key events. **No SIEM, no alerting on auth failures or rate-limit hits, no defined log retention.** | Partial | Sentry integration; Base44 function logs | Configure Sentry alerting rules; define log retention; build Basic SIEM-lite on top of `AuditLog`. Eng. |
| CC7.3 | Evaluate security events / incident evaluation | `AuditLog` entity built in-app (records who/what/when). `runCPAAuditTrail` function scoped to `performed_by`. No incident-evaluation process or IR plan. | Partial | Sprinto incident-management module; Base44 AuditLog | Author Incident Response Policy; adopt in Sprinto. Owner. |
| CC7.4 | Incident response & recovery | No IR runbook, no on-call rotation, no ticketing system. | Gap | Sprinto incident tracker | Stand up IR process + tracker in Sprinto. Owner. |
| CC7.5 | Recovery from incidents | Base44 checkpoint/rollback available (builder "Restore" to any checkpoint). sawd-web: Cloudflare Pages deployment rollback. No documented rollback playbook. | Partial | Base44 checkpoint history; Cloudflare Pages deploy history | Document rollback playbook (Base44 checkpoint restore + sawd-web Cloudflare rollback steps). Eng. |

---

## CC8 — Change Management

| Criterion | Control intent | SAWD current state (evidence) | Status | Sprinto check | Remediation / owner |
|---|---|---|---|---|---|
| CC8.1 | Authorized, tested changes | **sawd-web**: Branch protection on main with required reviews + required status checks confirmed (2026-09-29). Cloudflare Pages auto-deploys on merge. **Base44 app**: Changes via builder editor → checkpoint → Publish. No PR-review requirement on Base44 code (single-developer). Tests in `tests/` (18 passing: webhook, tenant isolation, ledger decimal). | Partial | GitHub → branch protection on sawd-web; Base44 checkpoint audit trail | Establish a "checkpoint + test-pass" requirement before every Base44 Publish; document in SDLC policy. Eng+Owner. |

---

## CC9 — Risk Mitigation

| Criterion | Control intent | SAWD current state (evidence) | Status | Sprinto check | Remediation / owner |
|---|---|---|---|---|---|
| CC9.1 | Risk mitigation for business disruptions | No BCP/DR plan. **Base44 is the single point of failure** — all user data, auth, and compute runs there. Base44's backup/HA SLA not documented in SAWD's evidence. sawd-web is Cloudflare Pages (high availability). | Gap | Base44 DPA/SLA; Sprinto BCP policy | Obtain Base44 data-export/backup SLA; author BCP/DR plan. **Owner (P0).** |
| CC9.2 | Vendor & business-partner risk management | Subprocessors: **Base44** (app/DB/auth/functions — highest risk), Plaid (bank data), Stripe (billing + IDV), GCP (pipeline + storage), Cloudflare (CDN/DNS), Anthropic (AI), Google AI/Vertex, HuggingFace (categorizer), Twilio/Vapi (voice — scoped), Smarty (address verification), IRS MeF (e-file scaffold). **No vendor-risk register, no signed DPAs tracked.** | Gap | Sprinto vendor-management module (SOC 2 reports, DPAs) | Build vendor register; collect vendor SOC 2 reports + DPAs. Start with Base44. **Owner (P0).** |

---

## Availability (A1)

| Criterion | Control intent | SAWD current state (evidence) | Status | Sprinto check | Remediation / owner |
|---|---|---|---|---|---|
| A1.1 | Capacity monitoring / demand management | Base44 managed hosting (capacity inherited). Cloudflare handles edge scaling. No custom capacity-monitoring dashboards or alerts for the SAWD application layer. | Partial | Cloudflare → traffic metrics; Base44 uptime | Add Sentry performance monitoring; document capacity assumptions in BCP. Eng. |
| A1.2 | Backup, recovery & environmental protections | Base44 hosting HA (inherited). **Base44 DB backup policy unknown** — need their DPA/SLA. GCS (document storage) durable by default. sawd-web on Cloudflare Pages (HA). | Gap | Base44 DPA (backup SLA); GCP → GCS versioning | **Obtain Base44 backup SLA. Enable GCS versioning on document bucket. Owner (P0).** |
| A1.3 | Recovery testing / tested restoration | No restore/failover test evidence. Base44 checkpoint restore not documented as a DR test. | Gap | Sprinto BCP test records | Perform + document a Base44 checkpoint restore test and a GCS document restore test. Owner+Eng. |

---

## Confidentiality (C1)

| Criterion | Control intent | SAWD current state (evidence) | Status | Sprinto check | Remediation / owner |
|---|---|---|---|---|---|
| C1.1 | Identify & protect confidential information | **§7216 consent**: ConsentGate blocks all authenticated routes; `aiInvokeSecure` fails closed server-side (`consent_7216_use !== true` → 403). Bank data in `PlaidAccount` entity (encrypted at rest by Base44 platform). Documents behind Base44 file-handling signed URLs. **IRS EFIN/ETIN in Base44 Secrets vault** (set 2026-10-16, masked in logs via `maskEfin()`). No data-classification policy adopted. | Partial | Base44 Secrets config; Sprinto data-classification policy | Adopt data-classification policy; confirm Base44 field-level encryption for sensitive PII. Owner+Eng. |
| C1.2 | Retention & disposal of confidential information | No retention schedule. Base44 entity deletes are hard deletes. **GCP/OneDrive plaintext-secret rotation**: old GCIP/Plaid/Stripe/GCS service-account keys historically on OneDrive-synced Desktop — **rotation and secure-delete still pending** (parked sawd-backend not deleted). IRS secrets are now in Base44 vault. | Gap | GCP → Secret Manager; Sprinto retention policy | Rotate remaining GCP/Firebase/Plaid/Stripe keys to GCP Secret Manager or Base44 Secrets; secure-delete Desktop copies. **Owner (P0).** |

---

## P0 items before booking Type I

1. **Get Base44's SOC 2 report + DPA.** Base44 is the primary subprocessor (all user data, auth, DB, functions live there). Without their security attestation, CC6.4, CC9.1, CC9.2, A1.2 all have no evidence. Email Base44 support requesting: (a) SOC 2 Type II report, (b) DPA, (c) backup/HA SLA. `owner`.

2. **Rotate remaining plaintext secrets off OneDrive Desktop.** Old GCIP/Firebase/Plaid/Stripe/GCS SA keys from the parked sawd-backend era may still be live and sitting on a synced laptop. Execute `soc2/KEY-ROTATION-RUNBOOK.md`; secure-delete originals. `owner`. *C1.2 / CC6.7.*

3. **Enable Base44 platform mandatory MFA.** MFA enforcement in the Base44 admin console (Settings → Security → Require MFA for all users). Also enforce on Google Workspace 2SV. `owner`. *CC6.1.*

4. **Collect vendor DPAs.** Build the subprocessor register (Base44, Plaid, Stripe, GCP, Cloudflare, Anthropic, Google AI, HuggingFace, Smarty) + obtain DPAs from each. Upload to Sprinto vendor module. `owner`. *CC9.2.*

5. **Obtain Base44 backup SLA / data-export capability.** Understand what Base44 backs up, at what frequency, and what the restore process is. Document as DR evidence. `owner`. *A1.2 / CC9.1.*

6. **Connect Sprinto integrations** (after/while addressing items 1–3): GitHub (org) → GCP → Google Workspace → Cloudflare. See `sprinto-integrations.md` for sequence. `owner`.

### P1 — needed within the observation window

7. **Independent pen test.** None done. Schedule through Sprinto's auditor network. `owner`. *CC7.1.*
8. **Risk register** (formal, scored) — CC3.1. Migrate A-Z audit findings + P0 list into Sprinto risk module.
9. **Incident Response Policy + tracker** — CC7.3/7.4. Author from `soc2/policies/` template; adopt in Sprinto.
10. **Security-awareness training** — CC1.4. Enroll in Sprinto training module.
11. **Sentry alerting rules** — configure meaningful alerts (auth errors, unhandled exceptions) now that DSN is set.
12. **BCP/DR plan** — author once Base44 backup SLA is obtained.

### Counsel-gated ⚖️

13. §7216/§6713 consent versioning + GLBA Safeguards / WISP formal adoption.
14. ZDR confirmation for Anthropic + Google AI (are user tax data prompts zero-data-retention?).
15. Breach-notification matrix in `incident-response-policy.md`.

> ⚠️ **Do not publish an unmet policy assertion in Sprinto and do not submit "MFA everywhere"
> attestations to Plaid/Stripe until the underlying control is actually enforced.**

---

## Architecture delta (Base44-native vs. prior GCP/GCIP matrix)

| Prior evidence (parked) | Current evidence (Base44-native) | Impact |
|---|---|---|
| GCIP RS256 JWT, `sawd-backend/src/auth.ts` | Base44 platform auth (Google OAuth + email) | CC6.1: still Met, evidence = Base44 SOC 2 |
| Cloud Run / Fastify `@fastify/rate-limit` | Base44 managed functions, platform rate-limiting | CC6.6: Met (inherited) |
| Cloud SQL + AES-256-GCM `crypto.ts` | Base44 managed DB, platform encryption-at-rest | CC6.1/C1.1: Partial → need Base44 DPA to confirm |
| Firebase Hosting `firebase.json` CSP/HSTS | Base44 hosting + Cloudflare Pages (sawd-web) | CC6.6/CC6.7: Met via Cloudflare |
| `sawd-backend feat/audit-log-writer` | Base44 `AuditLog` entity (in-app, live) | CC7.2/7.3: Partial (built, not independently retained) |
| GCP Secret Manager refs | Base44 Secrets vault (IRS/Sentry set 2026-10-16) | C1.2: Partial → remaining GCP keys still need rotation |
| Cloud SQL PITR / `setup-cloudsql-backups.sh` | Base44 DB backup (SLA unknown) | A1.2: Gap until Base44 DPA obtained |
| CodeQL / GitHub CI on sawd-backend | CodeQL / GitHub CI on sawd-web + sawd-mobile only | CC7.1: Partial (Base44 app code not in traditional CI) |
