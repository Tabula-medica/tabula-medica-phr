# Access Control Policy

> **DRAFT — attorney review required.** Internal planning document, not legal advice.

**Owner:** Founder / acting ISO
**Approver:** Founder
**Version:** 0.1 (draft) — **Date:** 2026-09-03
**Review cadence:** Annual, or on material change.

---

## 1. Purpose
Ensure that access to SAWD systems and data is granted only to authorized individuals, at the minimum level required, and revoked promptly when no longer needed — protecting taxpayer and financial data from unauthorized use or disclosure.

## 2. Scope
All SAWD accounts, identities, and access grants across: GCIP (`sawd-app-2026`), GCP project `sawd-ai` (Cloud Run, Cloud SQL, IAM), Base44, Cloudflare, Firebase Hosting, GitHub, Plaid and Stripe dashboards, Google Workspace, Sprinto, and any SaaS holding SAWD data. Applies to human and service (machine) identities.

## 3. Policy Statements
1. **Unique identity.** Every user has a unique account. Shared or generic logins are prohibited. Service accounts are named, owned, and inventoried.
2. **MFA everywhere.** Multi-factor authentication is required on every system that supports it — Google Workspace, GCP/GCIP, GitHub, Cloudflare, Base44, Plaid, Stripe, and Sprinto. Phishing-resistant factors (passkeys/hardware keys) are preferred for admin accounts.
   > ⚠️ **GAP TO REMEDIATE:** MFA is **not yet enforced across all systems**. Per memory, MFA enforcement is a pending cutover item (Base44 exit / MFA cutover runbook). This policy statement is aspirational until enforcement is turned on and verified in each admin console. Do not attest CC6.1/CC6.6 MFA coverage until Sprinto shows 100% MFA on connected systems.
3. **Least privilege.** Access is granted at the least privilege necessary for a role. Broad/owner roles (GCP Owner, GitHub org admin, Stripe/Plaid full admin) are limited to the smallest possible set of individuals and reviewed quarterly.
4. **Role-based access.** Access is assigned by role, not ad hoc. A documented access matrix maps roles to systems and privilege levels.
5. **Joiner-Mover-Leaver (JML).**
   - **Joiner:** Access provisioned only after role approval; provisioned to role baseline, not "same as founder."
   - **Mover:** On role change, entitlements are re-baselined; access no longer needed is removed.
   - **Leaver:** All access is revoked within **24 hours** of departure (immediately for involuntary termination), including SaaS, repo, cloud, and integration dashboards; shared credentials (if any exist during transition) are rotated.
6. **Access reviews.** The ISO performs a documented access review at least **quarterly** covering all in-scope systems, confirming each grant is still justified. Excess access is removed and the review is retained as evidence.
7. **Privileged access.** Administrative access is separated from day-to-day access where feasible, logged, and subject to enhanced review. Production data access is limited to need-to-know and logged.
8. **Third-party / vendor access.** External access (contractors, vendors) is time-boxed, least-privilege, and removed at engagement end.
9. **Session controls.** Idle sessions time out; console access to production requires re-authentication.

## 4. Roles / Responsibilities
- **ISO:** Approves access requests to sensitive systems, runs quarterly reviews, owns the access matrix.
- **System owners:** Provision/deprovision within their system per approved requests.
- **Workforce members:** Request only needed access; never share credentials.
- **HR/onboarding owner (Founder):** Triggers JML events into the access workflow.

## 5. SOC 2 Mapping
CC6.1, CC6.2, CC6.3, CC6.6, CC6.7 (logical access provisioning, modification, removal, MFA, and restriction of privileged/production access).

## 6. Enforcement
Unauthorized access, credential sharing, or privilege escalation results in access revocation and disciplinary action. Access-review exceptions are tracked to closure by the ISO.

## 7. Review
Reviewed annually (next: 2027-09-03) and after any change to systems or roles. Quarterly access reviews are operational evidence, distinct from the annual policy review.
