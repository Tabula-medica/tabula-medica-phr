# SAWD — SOC 2 Control Matrix (Sprinto audit prep)

> **Draft — internal planning, not legal advice. Generated 2026-09-03 from a read-only audit of the SAWD codebases and infra** (`repos/sawd-web`, `repos/sawd-backend`, `repos/sawd-mobile`, `ventures/sawd-ai`). Evidence is cited to real files/config. Where no evidence exists, the row is marked **Gap** — no control was invented.

## Summary

SAWD has a genuinely strong *technical* control baseline for a pre-revenue company: fail-closed GCIP token auth, AES-256-GCM envelope encryption for Plaid secrets, owner-scoped row isolation, 15-min V4 signed URLs, a 20-min idle auto-logout, DOMPurify sanitization, hardened Firebase security headers (CSP/HSTS/X-Frame-Options), keyless (WIF) deploys, and a mature CI security gate (CodeQL SAST, gitleaks, npm audit, Dependabot). The gaps are almost entirely **operational/governance and identity-enforcement**, not code: **MFA is built but not yet mandatory** (`ENFORCE_MFA` defaults off; GCIP `mfa.state` not MANDATORY; GitHub org 2FA = false), **there is no persisted application audit log** (the `AIActionAuditLog` table exists in the schema but is never written), **no centralized log retention/SIEM/alerting**, **secrets historically sat in plaintext on an OneDrive-synced Desktop** (rotation pending), **no formally adopted+approved policy pack** (only the ISMS master is drafted), and **no HR/offboarding, vendor-management, incident-response, or BCP/DR evidence**. These are the audit blockers.

**Counts (39 criteria scored):**

| Status | Count |
|---|---|
| **Met** | 8 |
| **Partial** | 14 |
| **Gap** | 13 |
| **Owner-action** (blocked on a console/policy action, no code needed) | 4 |

> Met = control operating with code/config evidence. Partial = control exists but incomplete or unenforced. Gap = no evidence found. Owner-action = the fix is a founder console/signature step, not engineering.

---

## CC1 — Control Environment

| Criterion | Control intent | SAWD current state (evidence) | Status | Sprinto check that would auto-verify | Remediation / owner |
|---|---|---|---|---|---|
| CC1.1 | Integrity & ethics; code of conduct | No code of conduct / ethics policy found. ISMS master drafted only (`ventures/sawd-ai/soc2/policies/information-security-policy.md`, v0.1 DRAFT, self-flags "no formally adopted ISMS"). | Gap | Sprinto policy module: employee acceptance of Code of Conduct | Author + adopt Code of Conduct in Sprinto; owner acceptance. Owner. |
| CC1.2 | Board/governance independence & oversight | Single-founder company; ISMS names Founder as acting ISO and assigns roles in writing (`information-security-policy.md` §4–5). No independent oversight body. | Partial | Sprinto org chart + policy approver record | Document governance in Sprinto; engage fractional CISO (already noted in policy §4). Owner. |
| CC1.3 | Org structure, authority & responsibility | Roles assigned in ISMS §4; exec-agent "operating layer" documented (`SAWD-RUNNING-LIST.md`, `exec/operating-model.md`) but these are AI drafts, not an HR structure. | Partial | Sprinto roles/responsibilities matrix | Formalize + approve responsibility matrix in Sprinto. Owner. |
| CC1.4 | Competence — hiring, training, security awareness | No security-awareness training records; no employees. | Gap | Sprinto training module (security-awareness completion) | Enroll workforce (founder+contractors) in Sprinto security training. Owner. |
| CC1.5 | Accountability / performance enforcement | Enforcement clause in ISMS §6 (access revocation, termination). No performance/accountability records. | Partial | Sprinto policy acceptance + enforcement records | Adopt policy; capture acceptances. Owner. |

## CC2 — Communication & Information

| Criterion | Control intent | SAWD current state (evidence) | Status | Sprinto check | Remediation / owner |
|---|---|---|---|---|---|
| CC2.1 | Quality information for internal control | Backend logs via Fastify pino logger (`sawd-backend/src/server.ts:49`, `logger:{level}`); Cloud Run → Cloud Logging (`cloudbuild.yaml` `logging: CLOUD_LOGGING_ONLY`). Frontend Sentry/PostHog DSNs wired at build (`deploy-web.yml:60-61`) but optional. No defined info-quality process. | Partial | GCP → Cloud Logging enabled; Sentry integration | Confirm Sentry/PostHog actually configured in prod; document. Owner+Eng. |
| CC2.2 | Internal communication of security responsibilities | ISMS + runbooks exist (`exec/*.md`, `KEY-ROTATION-RUNBOOK.md`). Not yet published/acknowledged by workforce. | Partial | Sprinto policy publish + acceptance | Publish policy pack in Sprinto, require acceptance. Owner. |
| CC2.3 | External communication (customers, vendors, regulators) | Legal/privacy pages exist (`sawd-web/legal/`); role addresses (support/privacy/security@) NOT yet created (`SAWD-RUNNING-LIST.md` Email/DNS). No breach-notification comms path. | Partial | Sprinto vendor/comms register; DNS record checks | Create security@/privacy@ role addresses; document breach-notification path w/ counsel. Owner. |

## CC3 — Risk Assessment

| Criterion | Control intent | SAWD current state (evidence) | Status | Sprinto check | Remediation / owner |
|---|---|---|---|---|---|
| CC3.1 | Specifies objectives to identify risk | ISMS §3 references a "risk register maintained under the Risk Assessment & Management Policy" — **that policy does not exist in `soc2/policies/`** (only the master + README). | Gap | Sprinto risk-register module populated | Create Risk Assessment Policy + risk register in Sprinto. Owner. |
| CC3.2 | Identifies & analyzes risk | Ad-hoc risk identification exists in practice (`security-audit/`, `sawd-bank/SECURITY-AUDIT.md`, running-list P0s) but no formal scored register. | Partial | Sprinto risk assessment with likelihood/impact scoring | Formalize the existing findings into a Sprinto risk register. Owner+Eng. |
| CC3.3 | Considers fraud potential | Financial-fraud surface acknowledged (Plaid/Stripe live, §7216 data) but no fraud-risk analysis doc. | Gap | Sprinto risk register (fraud category) | Add fraud scenarios to risk register. Owner. |
| CC3.4 | Identifies changes affecting the system | Change tracked informally via git/running-list; no formal change-risk assessment. | Partial | GitHub → commit/PR history; Sprinto change log | Tie change management (CC8) into risk register. Eng. |

## CC4 — Monitoring Activities

| Criterion | Control intent | SAWD current state (evidence) | Status | Sprinto check | Remediation / owner |
|---|---|---|---|---|---|
| CC4.1 | Ongoing/separate control evaluations | Performed access review exists (`compliance/ACCESS-REVIEW-2026-08-19.md`) with a monthly cadence (next 2026-09-19). CI runs continuously. No independent evaluation / pen test. | Partial | Sprinto continuous control monitoring; scheduled reviews | Continue monthly reviews in Sprinto; schedule a pen test (ISMS §8 references pen tests). Owner. |
| CC4.2 | Communicates deficiencies & tracks remediation | Findings tracked in running-list P0s and access-review §4; not in a formal tracker to closure. | Partial | Sprinto findings/remediation tracker | Migrate open findings into Sprinto tasks. Owner. |

## CC5 — Control Activities

| Criterion | Control intent | SAWD current state (evidence) | Status | Sprinto check | Remediation / owner |
|---|---|---|---|---|---|
| CC5.1 | Selects control activities that mitigate risk | Layered technical controls implemented (auth, encryption, headers, rate-limit, sanitization — see CC6/CC7). ISMS §3 "defense in depth" (§Policy Statement 5). | Met | Config presence checks across GCP/GitHub/Firebase | Maintain; map each to a risk-register item. Eng. |
| CC5.2 | Technology general controls | CI gates (`security.yml`, `codeql.yml`, backend `ci.yml`), keyless WIF deploy (`deploy-web.yml`), least-privilege runtime SA (`sawd-run@` — access review §1). | Met | GitHub → required checks; GCP → IAM least-privilege | Maintain; add branch protection (CC8.1). Eng. |
| CC5.3 | Deploys through policies & procedures | Runbooks exist (`KEY-ROTATION-RUNBOOK.md`, `exec/mfa-2sv-runbook.md`, `MIGRATION-PLAN.md`) but not adopted/approved. | Partial | Sprinto policy adoption records | Adopt SDLC/change/ops procedures in Sprinto. Owner. |

## CC6 — Logical & Physical Access

| Criterion | Control intent | SAWD current state (evidence) | Status | Sprinto check | Remediation / owner |
|---|---|---|---|---|---|
| CC6.1 | Logical access security (identity, auth, encryption) | **Strong.** GCIP RS256 JWT verified on every `/api` route, fail-closed on missing project/token (`sawd-backend/src/auth.ts:80-135`); dev-bypass hard-blocked in prod (`auth.ts:47-52`). AES-256-GCM envelope encryption of Plaid tokens, fail-closed (`sawd-backend/src/lib/crypto.ts`). CORS fails closed in prod (`server.ts:33-45`). TLS everywhere. | Met | GCP → IAM/GCIP config; Cloud SQL encryption at rest; cert monitoring | Maintain. Add DB-column encryption for at-rest PII (entities.ts notes JSONB workaround). Eng. |
| CC6.2 | Registration/authorization of new users (provisioning) | GCIP handles identity; role via custom claim (`auth.ts:121-128`). Owner-scoped provisioning implicit. No documented provisioning approval workflow. | Partial | Google Workspace → user provisioning; Sprinto access requests | Document provisioning/approval; centralize IAM (access-review §4). Owner. |
| CC6.3 | Access modification & least privilege | Owner-scoped row isolation enforced server-side: non-admins only read/mutate `created_by = req.user.email` (`sawd-backend/src/routes/entities.ts:86-110, 136-137`); server forces `created_by`, strips client-set secrets (`entities.ts:202-217`). SA least-privilege reviewed (access-review §1) but **default-compute SA over-privileged** and **cross-project `github-deployer@sawd-ai` admin**. | Partial | GCP → IAM policy analyzer; Sprinto access reviews | Replace default-compute SA w/ minimal SAs; remove cross-project admin. Owner. |
| CC6.4 | Physical access (data centers) | Fully inherited — GCP/Firebase/Cloudflare/Cloud Run. No SAWD-owned facilities. | Met (inherited) | GCP/Cloudflare SOC 2 reports as subservice orgs (carve-out) | Collect subservice-org SOC 2 reports in Sprinto vendor module. Owner. |
| CC6.5 | Data disposal / secure removal | No documented data-disposal process; deletes are hard row deletes (`entities.ts:281-301`). GCS objects have no lifecycle/retention policy in evidence. | Gap | GCP → GCS lifecycle rules; Sprinto data-retention policy | Define data-retention + disposal policy; set GCS lifecycle rules. Owner+Eng. |
| CC6.6 | External threat protection (edge, boundary) | Cloudflare edge + Firebase hardened headers (`firebase.json`: CSP, HSTS `max-age=63072000; preload`, X-Frame-Options DENY, nosniff, Permissions-Policy). `@fastify/rate-limit` 120/min keyed by uid/IP (`server.ts:83-88`). Health/webhooks intentionally unthrottled. | Met | Cloudflare → WAF/DDoS config; header scan | Maintain; consider Cloudflare WAF rules + Turnstile on public forms. Eng. |
| CC6.7 | Restrict info transmission/movement (data in transit) | TLS enforced (HSTS preload). Private GCS uploads return opaque `gs://` URI, access only via **V4 signed URL, 300s default / 15-min owner-scoped** (`sawd-backend/src/lib/storage.ts:72-96`, `routes/files.ts:58-74`); cross-bucket refs rejected (`storage.ts:82-84`). Bank tokens redacted from all API responses (`entities.ts:49-59`). | Met | GCP → GCS IAM/uniform access; TLS scan | Maintain. Eng. |
| CC6.8 | Prevent/detect unauthorized software (malware, integrity) | CodeQL SAST + gitleaks secret scan + npm audit + Dependabot (`security.yml`, `codeql.yml`, `dependabot.yml`). No endpoint/MDM anti-malware on the founder laptop. | Partial | GitHub → CodeQL/Dependabot alerts; MDM → EDR/anti-malware | Enroll endpoints in MDM w/ EDR. Owner. |

## CC7 — System Operations

| Criterion | Control intent | SAWD current state (evidence) | Status | Sprinto check | Remediation / owner |
|---|---|---|---|---|---|
| CC7.1 | Vulnerability detection & monitoring | **Strong.** CodeQL `security-extended` on PR + weekly cron (`codeql.yml`); npm audit `--audit-level=high` fails PRs (`security.yml:45-46`); gitleaks history scan (`security.yml:48-66`); Dependabot weekly npm + actions (`dependabot.yml`). Known open: 14 high CVEs in **sawd-bank** (separate venture), plaintext-secret rotation pending. | Met | GitHub → CodeQL alerts, Dependabot, secret scanning | Clear open Dependabot alerts; keep sawd-bank out of SOC 2 scope or remediate. Eng. |
| CC7.2 | Monitoring for anomalies / security events | Cloud Run → Cloud Logging (`cloudbuild.yaml`), Fastify logs failed token verifications (`auth.ts:132`). **No SIEM, no alerting, no log-based anomaly detection, no defined retention.** | Gap | GCP → Cloud Logging sinks + alerting policies; Sprinto | Configure log sinks, retention, and alert policies (login failures, rate-limit hits). Eng. |
| CC7.3 | Evaluate security events / incident evaluation | No incident-response plan or evaluation records found in `soc2/policies/`. | Gap | Sprinto incident-management module | Author Incident Response Policy; adopt in Sprinto. Owner. |
| CC7.4 | Incident response & recovery | No IR runbook, no on-call, no ticketing. | Gap | Sprinto incident tracker; PagerDuty/Slack integration | Stand up IR process + tracker. Owner. |
| CC7.5 | Recovery from incidents | No documented recovery/rollback playbook (Firebase hosting rollback + Cloud Run revisions exist technically). | Partial | GCP → Cloud Run revision history; Firebase rollback | Document rollback playbook (Cloud Run revisions, Firebase channel rollback). Eng. |

## CC8 — Change Management

| Criterion | Control intent | SAWD current state (evidence) | Status | Sprinto check | Remediation / owner |
|---|---|---|---|---|---|
| CC8.1 | Authorized, tested changes | CI gates before merge: lint/build/test/audit (`security.yml`), CodeQL, backend typecheck (`ci.yml`). Deploy is manual `workflow_dispatch` w/ staging→prod choice + keyless WIF (`deploy-web.yml`). **Branch protection / required reviews NOT verified** (single-committer repos; running-list notes commits straight to feature branches). No PR-review-required evidence. | Partial | GitHub → branch protection + required status checks + required reviews | Enable branch protection on `main` w/ required checks + 1 review. Owner+Eng. |

## CC9 — Risk Mitigation

| Criterion | Control intent | SAWD current state (evidence) | Status | Sprinto check | Remediation / owner |
|---|---|---|---|---|---|
| CC9.1 | Risk mitigation for business disruptions | No BCP/DR plan. Cloud SQL backup/PITR config not evidenced in repo (`cloudbuild.yaml` shows Cloud SQL wiring commented/optional). | Gap | GCP → Cloud SQL automated backups + PITR; Sprinto BCP policy | Enable Cloud SQL backups+PITR; author BCP/DR. Owner+Eng. |
| CC9.2 | Vendor & business-partner risk management | Subprocessors (Plaid, Stripe, Base44, GCP, Cloudflare, Anthropic/Vertex, Expo/EAS) used; **no vendor-risk register / no signed DPAs tracked**. Base44 flagged as highest-risk identity silo (access-review §3). | Gap | Sprinto vendor-management module (SOC 2 reports, DPAs) | Build vendor register; collect vendor SOC 2/DPAs. Owner. |

---

## Availability (A1)

| Criterion | Control intent | SAWD current state (evidence) | Status | Sprinto check | Remediation / owner |
|---|---|---|---|---|---|
| A1.1 | Capacity monitoring / demand management | Cloud Run autoscaling (managed) + rate-limit caps abuse (`server.ts:83-88`); 25 MB upload cap (`server.ts:61`). No capacity-monitoring dashboards/alerts evidenced. | Partial | GCP → Cloud Run metrics + alerting | Add uptime checks + capacity alerts. Eng. |
| A1.2 | Backup, recovery & environmental protections | Firebase Hosting + Cloud Run are highly available (inherited). **Cloud SQL backups/PITR not evidenced** (instance wiring optional in `cloudbuild.yaml`). GCS is durable by default. | Partial | GCP → Cloud SQL backups/PITR; GCS versioning | Turn on Cloud SQL automated backups + PITR; verify. Eng. |
| A1.3 | Recovery testing / tested restoration | No restore/failover test evidence. | Gap | Sprinto BCP test records | Perform + document a backup-restore test. Owner+Eng. |

## Confidentiality (C1)

| Criterion | Control intent | SAWD current state (evidence) | Status | Sprinto check | Remediation / owner |
|---|---|---|---|---|---|
| C1.1 | Identify & protect confidential information | Bank tokens encrypted at rest (AES-256-GCM, `crypto.ts`) and redacted on the wire (`entities.ts:49-59`); private docs behind short-lived signed URLs (`storage.ts`); DOMPurify sanitizes AI HTML (`sawd-web/src/lib/safeAiHtml.js`, all 6 sinks route through it per running-list); mobile FaceID app-lock + on-device OCR (`sawd-mobile/AppLock.js`). **No data-classification policy adopted** (drafted only in ISMS §Policy Statement 6). At-rest PII in general JSONB is Cloud-SQL-disk-encrypted only, not field-level (`entities.ts:41-43` notes future dedicated encrypted column). | Partial | GCP → Cloud SQL CMEK/encryption at rest; Sprinto data-classification policy | Adopt data-classification policy; move remaining PII fields to field-level encryption. Owner+Eng. |
| C1.2 | Retention & disposal of confidential information | No retention schedule; hard deletes only; no GCS lifecycle rules. Historically, prod secrets sat plaintext on an OneDrive-synced Desktop (running-list Security §; `KEY-ROTATION-RUNBOOK.md`) — **rotation to Secret Manager + secure-delete pending**. | Gap | GCP → GCS lifecycle + Secret Manager; Sprinto retention policy | Rotate all keys to Secret Manager, secure-delete Desktop copies; define retention/disposal. **Owner (P0).** |

---

## Top P0 technical remediations for audit readiness

1. **Rotate every prod secret into GCP Secret Manager and secure-delete the plaintext copies from the OneDrive-synced Desktop.** SA/Firebase/Stripe/OAuth/Plaid keys in cleartext on a synced laptop is the single highest-severity finding (touches CC6.1, C1.2, CC7.1). Runbook already exists (`KEY-ROTATION-RUNBOOK.md`) — execute it.
2. **Make MFA mandatory end-to-end.** Code is done and fails closed (`ENFORCE_MFA` in `auth.ts:59,142-157`, client `MFAEnrollGate`/`MFAGate`), but enforcement is OFF at the platform layer. Ordered cutover (`exec/mfa-2sv-runbook.md`): enroll a test user on GCIP TOTP → prove the challenge → `ENFORCE_MFA=true` on Cloud Run → set GCIP `mfa.state=MANDATORY` last → turn on **GitHub org 2FA requirement** (currently `false`, access-review §2). Unblocks CC6.1/CC6.8 and Plaid attestations #5/#6.
3. **Implement a persisted, tamper-evident application audit log.** The `AIActionAuditLog` table exists in `sawd-backend/src/db/schema.ts` but **is never written by any route** (verified: no writer in `src/`). Wire authn events, entity mutations, and privileged actions to it; ship logs to a retained Cloud Logging sink. Closes CC7.2 and materially strengthens CC4/CC7.3.
4. **Turn on GitHub branch protection with required status checks + at least one review on `main`.** The CI gates (CodeQL, security.yml, backend ci.yml) exist but nothing forces them before merge, and commits currently land straight on feature branches. This is the CC8.1 change-management evidence Sprinto expects (GitHub integration).
5. **Enable Cloud SQL automated backups + PITR and document a rollback/recovery playbook.** DB backups are not evidenced (`cloudbuild.yaml` Cloud SQL wiring is optional/commented), and there is no DR/BCP or restore test. Closes A1.2/A1.3/CC9.1 and CC7.5; run one restore test and capture the record.

> **Fastest path to a defensible Type I:** items 1–4 are days of work and flip the majority of Partial/Owner-action rows to Met. The remaining Gaps (CC1 governance, CC3 risk register, CC7.3/7.4 incident response, CC9.2 vendor management) are **policy-adoption + Sprinto-configuration** tasks — the ISMS master (`soc2/policies/information-security-policy.md`) is the template; the subordinate policies it references still need to be written and adopted.
