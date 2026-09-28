# Acceptable Use Policy

> **DRAFT — attorney review required.** Internal planning document, not legal advice.

**Owner:** Founder / acting ISO
**Approver:** Founder
**Version:** 0.1 (draft) — **Date:** 2026-09-03
**Review cadence:** Annual, or on material change.

---

## 1. Purpose
Define the acceptable and prohibited uses of SAWD information assets so that workforce members handle systems and data — especially taxpayer return information — responsibly and lawfully.

## 2. Scope
All workforce members and all SAWD assets: company and personal devices used for SAWD work (BYOD), accounts, networks, SaaS tools, code repositories, and data. Applies whenever a person acts on SAWD's behalf or accesses SAWD data.

## 3. Policy Statements
1. **Business use.** SAWD assets and data are for authorized SAWD business only. Incidental personal use of general tools (e.g., email) must not degrade security or violate other policies.
2. **Protect taxpayer & financial data.** Taxpayer return information and financial-account data may only be accessed on a need-to-know basis for a permitted purpose, and never used or disclosed except as allowed by the Data Privacy Policy and applicable §7216 consent. Personal use of taxpayer data is strictly prohibited.
3. **Device security.** Any device used for SAWD work must have: full-disk encryption, a screen lock, an active OS with current patches, and endpoint protection where available. Lost/stolen devices are reported immediately.
   > ⚠️ **GAP TO REMEDIATE:** SAWD has no MDM/endpoint-management baseline enforced, and secrets have historically lived on the founder's Desktop. Endpoint encryption/lock and secret hygiene must be verified per device before this statement is truthfully attestable (CC6.7, CC6.8).
4. **No secrets on local disk / in code.** Credentials, API keys, and tokens must live in a secrets manager (GCP Secret Manager) — never in source code, chat, plaintext files, or the desktop filesystem. Any secret found on local disk is rotated and removed.
   > ⚠️ **GAP TO REMEDIATE:** Secrets historically stored on Desktop (per memory). Sweep, rotate, and migrate to Secret Manager; confirm none remain before attesting.
5. **Prohibited actions.** No sharing of credentials; no disabling of security controls; no unapproved software that touches SAWD data; no exfiltration of data to personal storage; no unauthorized use of production data in test/dev.
6. **AI tool use.** Only approved AI services in approved configurations may process SAWD data. Pasting taxpayer/financial data into unapproved AI tools is prohibited. Approved AI paths (Claude on Vertex, Gemini) must run under ZDR/no-retention terms per the Data Privacy and Vendor policies.
   > ⚠️ **GAP TO REMEDIATE:** ZDR/no-retention is *intended* but must be contractually confirmed and configured for Vertex/Gemini before staff are told these are "approved."
7. **Email & phishing.** Workforce members must not click suspicious links, must verify unusual payment/data requests out-of-band, and must report phishing.
8. **Physical security.** Screens holding sensitive data are not left unlocked/unattended in public; printed material with PII is shredded.

## 4. Roles / Responsibilities
- **ISO:** Maintains the approved-tools list and the AUP; investigates violations.
- **Workforce members:** Read, accept, and comply; report loss, phishing, and suspected misuse.

## 5. SOC 2 Mapping
CC1.1, CC1.5, CC2.2, CC6.7, CC6.8 (control environment expectations, communication of responsibilities, endpoint/malware protection).

## 6. Enforcement
Violations may result in access revocation and disciplinary action up to termination; misuse of taxpayer data is referred to counsel for §7216/§6713 exposure.

## 7. Review
Reviewed annually (next: 2027-09-03) and on material tooling change.
