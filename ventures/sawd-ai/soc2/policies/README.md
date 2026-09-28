# SAWD SOC 2 Policy Pack — Index

**Status:** DRAFT — owner + counsel review required before publishing in Sprinto.
**Scope:** SOC 2 Type II — Trust Services Criteria **Security (CC1–CC9)**, **Availability (A1)**, and **Confidentiality (C1)**.
**Company:** SAWD Corporation (Delaware) — tax-prep + family-wealth fintech.
**Owner of pack:** Rajiv Aggarwal (Founder / acting ISO).
**Version:** 0.1 (draft) — Date: 2026-09-03.

---

## What this is

A tailored SOC 2 policy set for SAWD's actual architecture — Vite/React on Firebase Hosting (sawd.ai) behind Cloudflare, Base44 primary backend with a GCP (Cloud Run / Cloud SQL) adjunct in project `sawd-ai`, GCIP identity on `sawd-app-2026`, Plaid + Stripe integrations, Expo/EAS mobile, and Claude-on-Vertex + Gemini in the data path (ZDR intended). These are **drafts for approval**, not adopted policy. Every file is marked `DRAFT — attorney review required`.

**These are internal governance documents, not legal or tax advice.** §7216/§6713, GLBA Safeguards, and state-privacy interpretations must be confirmed by licensed counsel before SAWD relies on them or attests to any control.

---

## The policy set

| # | File | Governs | Primary TSC |
|---|------|---------|-------------|
| 1 | `information-security-policy.md` | Master ISMS, program governance | CC1–CC9 |
| 2 | `access-control-policy.md` | MFA, least privilege, JML | CC6.1–CC6.3 |
| 3 | `acceptable-use-policy.md` | Sanctioned use of assets | CC1.1, CC1.5 |
| 4 | `password-authentication-policy.md` | Credential strength, SSO/MFA | CC6.1 |
| 5 | `change-management-sdlc-policy.md` | Code review, branch protection, CI/CD gates | CC8.1 |
| 6 | `incident-response-policy.md` | Detection, response, breach notification | CC7.3, CC7.4, CC7.5 |
| 7 | `business-continuity-disaster-recovery-policy.md` | RTO/RPO, backups, failover | A1.2, A1.3 |
| 8 | `risk-assessment-management-policy.md` | Risk identification, treatment, register | CC3.1–CC3.4 |
| 9 | `vendor-third-party-risk-management-policy.md` | Subprocessor due diligence | CC9.2 |
| 10 | `data-classification-handling-policy.md` | Data tiers (tax/PII/financial) | CC6.1, C1.1 |
| 11 | `data-retention-disposal-policy.md` | Retention schedule, secure disposal | C1.2, CC6.5 |
| 12 | `encryption-cryptography-policy.md` | At-rest/in-transit, key mgmt, PQC roadmap | CC6.1, CC6.7 |
| 13 | `vulnerability-management-policy.md` | Scanning, pen test, patch SLAs | CC7.1, CC7.2 |
| 14 | `logging-monitoring-policy.md` | Log collection, alerting, review | CC7.1, CC7.2 |
| 15 | `hr-security-onboarding-offboarding-policy.md` | Background checks, training, revocation | CC1.4, CC6.2 |
| 16 | `data-privacy-policy.md` | Internal privacy; §7216/GLBA linkage | C1.1, P-series (mapped internally) |

---

## Sprinto adopt → publish → accept workflow

Sprinto (like Vanta/Drata) treats each policy as a controlled document with an evidence trail. The lifecycle SAWD will follow:

1. **Draft** — these files. Author = acting ISO; reviewer = external counsel + fractional CISO/security partner.
2. **Owner + counsel review** — resolve every `⚠️ GAP TO REMEDIATE` note. A gap must be either (a) remediated so the policy statement is true, or (b) the policy statement softened to match reality and re-approved. Do **not** publish a policy that asserts a control SAWD does not operate — that manufactures an audit exception.
3. **Import to Sprinto** — paste/upload each approved policy into Sprinto's Policy module; set Owner, Approver, and annual Review date. Sprinto version-stamps on publish.
4. **Management approval** — the designated approver (Founder) formally approves inside Sprinto (this becomes CC1/CC5 evidence of governance).
5. **Publish** — Sprinto marks the policy Active and generates the acceptance campaign.
6. **Employee acceptance** — every workforce member (and relevant contractor) e-acknowledges each policy in Sprinto. Sprinto tracks acceptance % and re-prompts on the annual cycle or on policy version change. Acceptance is the CC1.1/CC2.2 evidence auditors sample.
7. **Continuous monitoring** — Sprinto connects to GCP, GitHub, Cloudflare, etc. to auto-collect control evidence (MFA state, branch protection, backup success). **Automated checks will fail loudly wherever a `⚠️ GAP` is unremediated** — treat the gap list below as the pre-audit punch list.

---

## Remediation punch list (unremediated gaps, aggregated)

The individual policies carry inline `⚠️ GAP TO REMEDIATE` notes. The highest-priority gaps — controls asserted by policy that SAWD does **not yet operate** — are summarized at hand-off. Resolve these before attesting or before Sprinto's automated checks run against production.

---

*End of index. All files in this directory are DRAFT — attorney review required.*
