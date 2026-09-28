# HR Security — Onboarding & Offboarding Policy

> **DRAFT — attorney review required.** Background-check scope and employment terms MUST be confirmed by counsel/HR for legal compliance (FCRA, state law).

**Owner:** Founder / acting ISO
**Approver:** Founder
**Version:** 0.1 (draft) — **Date:** 2026-09-03
**Review cadence:** Annual, or on material change.

---

## 1. Purpose
Ensure that people who access SAWD systems and taxpayer/financial data are vetted, trained, bound to confidentiality, and promptly de-provisioned when they leave.

## 2. Scope
All workforce members — employees and contractors — with access to SAWD systems or data.

## 3. Policy Statements
1. **Background checks.** Prior to being granted access to Tier 1 data, workforce members undergo a background check appropriate to role and permitted by law (identity, criminal, and where relevant, credit for finance-sensitive roles).
   > ⚠️ **GAP TO REMEDIATE:** No background-check process is in place. Establish one (FCRA-compliant, counsel-reviewed) before onboarding staff with Tier 1 access; CC1.4 expects competence/screening evidence.
2. **Confidentiality & policy acceptance.** Before access, each person signs a confidentiality/NDA agreement and acknowledges the security policy pack (via Sprinto), including taxpayer-data (§7216) obligations.
3. **Security training.** Workforce members complete security-awareness training at onboarding and at least annually, covering phishing, data handling, §7216/GLBA basics, and incident reporting. Completion is tracked.
   > ⚠️ **GAP TO REMEDIATE:** No recurring security-awareness training program exists. Stand one up (Sprinto module or equivalent) and record completion (CC1.4/CC2.2).
4. **Onboarding provisioning.** Access is provisioned per the Access Control Policy (role-based, least privilege, MFA) only after approvals and signed agreements.
5. **Role changes.** On role change, entitlements are re-baselined (Access Control JML).
6. **Offboarding.** On departure, all access is revoked within **24 hours** (immediately for involuntary termination): SSO/Workspace, GCP/GCIP, GitHub, Cloudflare, Base44, Plaid, Stripe, Sprinto, and any shared secrets rotated. Devices are returned/wiped; the offboarding checklist is completed and retained.
   > ⚠️ **GAP TO REMEDIATE:** No documented offboarding checklist exists yet. Create one so revocation is evidenced (CC6.2/CC6.3).
7. **Contractors.** Contractors are held to the same access, confidentiality, and offboarding standards; access is time-boxed to the engagement.
8. **Disciplinary process.** Policy violations follow a defined disciplinary process, up to termination and referral to counsel/authorities for taxpayer-data misuse.
9. **Roles & competence.** The Founder defines security responsibilities and ensures individuals are competent for security-relevant duties (CC1.4).

## 4. Roles / Responsibilities
- **Founder / ISO (acting HR):** Owns onboarding/offboarding, approves access, ensures training and screening.
- **Counsel/HR advisor:** Confirms background-check and employment-law compliance.
- **Workforce members:** Complete training, sign agreements, return assets on exit.

## 5. SOC 2 Mapping
CC1.4 (competence, screening), CC1.5 (accountability), CC2.2 (internal communication/training), CC6.2 (registration/authorization of users), CC6.3 (removal of access).

## 6. Enforcement
Granting Tier 1 access without screening/agreements, or failing to revoke access on exit, is a control violation escalated to the ISO.

## 7. Review
Reviewed annually (next: 2027-09-03) and when team structure changes.
