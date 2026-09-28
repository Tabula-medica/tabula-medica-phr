# Data Privacy Policy (Internal)

> **DRAFT — attorney review required.** This is an INTERNAL governance policy, not the customer-facing privacy notice and not legal advice. §7216/§6713 and GLBA interpretations and any consumer disclosures MUST be confirmed and drafted by counsel. Mandatory §7216 consent language is inserted by counsel verbatim — never paraphrased.

**Owner:** Founder / acting ISO (with counsel)
**Approver:** Founder
**Version:** 0.1 (draft) — **Date:** 2026-09-03
**Review cadence:** Annual, or on material change / regulatory change.

---

## 1. Purpose
Govern how SAWD collects, uses, discloses, and protects personal, taxpayer, and financial-account data internally, and link SAWD's privacy obligations to the controlling legal regimes: IRC **§7216/§6713**, the **GLBA Safeguards Rule**, and applicable **state privacy** law.

## 2. Scope
All personal data SAWD processes about taxpayers/customers and their households, across all systems and vendors/subprocessors.

## 3. Policy Statements
1. **Lawful, limited use.** Personal and taxpayer data is processed only for disclosed, permitted purposes. Taxpayer return information is used or disclosed only with a permitted purpose or valid §7216 written consent.
2. **§7216 consent discipline.** USE and DISCLOSURE consents are separate written documents, each naming purpose/recipient/scope, allowing the taxpayer to decline without losing service, valid ≤1 year, with SSN masked for non-US recipients. The exact IRS-prescribed mandatory language (Rev. Proc. 2013-14) is inserted by counsel — SAWD's systems store which consent version a taxpayer signed and when.
   > ⚠️ **GAP TO REMEDIATE:** Confirm the consent capture flow stores versioned consent records (type, purpose, recipient, timestamp, expiry) and that mandatory language is counsel-approved before any use/disclosure relying on consent. AI processing of TRI may itself require §7216 consent — counsel must confirm.
3. **GLBA Safeguards linkage.** SAWD's information-security program (this pack) serves as the WISP required by the GLBA Safeguards Rule. The WISP is adopted post-counsel; service-provider oversight, access controls, encryption, monitoring, and IR are the Safeguards elements, satisfied by the corresponding policies here.
   > ⚠️ **GAP TO REMEDIATE:** WISP is drafted/de-bracketed but not yet formally adopted. Adopt post-counsel; GLBA requires a designated qualified individual, risk assessment, and safeguards — map each to this pack.
4. **Data minimization & purpose limitation.** Collect only what is needed; do not repurpose data beyond disclosed/consented uses.
5. **Disclosure controls.** Personal/taxpayer data is disclosed to vendors only under DPAs and §7216-consistent terms (Vendor policy). No sale of personal data.
6. **AI in the data path.** AI processing (Claude on Vertex, Gemini) must run under confirmed ZDR/no-training terms; TRI is not sent to AI absent a permitted purpose/consent confirmed by counsel.
   > ⚠️ **GAP TO REMEDIATE:** ZDR intended, not confirmed; §7216 applicability to AI processing not settled. Resolve both before routing TRI through AI.
7. **Individual rights.** SAWD supports applicable rights (access, correction, deletion) under state privacy law, subject to legal retention (Retention policy). Requests are logged and fulfilled within legal timeframes as advised by counsel.
8. **Transparency.** A customer-facing privacy notice (drafted by counsel) accurately describes SAWD's practices and subprocessors; this internal policy stays consistent with it.
9. **Cross-border.** SSN masking for non-US recipients is enforced; cross-border transfers are assessed by counsel.
10. **Breach coupling.** Privacy incidents trigger the Incident Response Policy and its counsel-owned notification analysis.

## 4. Roles / Responsibilities
- **Founder / ISO + Counsel:** Jointly own privacy compliance; counsel owns §7216/GLBA/state-law interpretation and consumer disclosures.
- **Engineering:** Implements consent capture/versioning, minimization, masking, and rights fulfillment.
- **Workforce members:** Handle personal/taxpayer data per this policy and the Data Classification Policy.

## 5. SOC 2 Mapping
C1.1 (confidential information protected), C1.2 (disposal), CC2.3 (external communication of commitments), and internally mapped Privacy (P-series) criteria if SAWD later adds the Privacy category. Regulatory linkage: §7216/§6713, GLBA Safeguards, state privacy (counsel-confirmed).

## 6. Enforcement
Unauthorized use/disclosure of taxpayer data is a serious violation carrying potential §7216/§6713 criminal/civil exposure; referred to counsel and subject to disciplinary action up to termination.

## 7. Review
Reviewed annually (next: 2027-09-03) and on any regulatory change or new data use.
