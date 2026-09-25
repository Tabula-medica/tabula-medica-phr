# Quarterly Access Review Procedure

**Control:** AC-04 — Access Reviews
**Frameworks:** SOC 2 CC6.2/CC6.3 | HIPAA 164.308(a)(3)(ii)(B) | ISO 27001 A.5.18
**Owner:** Security Officer (Rajiv Aggarwal, rajiv@tabulamedica.com)
**Effective Date:** 2026-01-01
**Review Cycle:** Annual (or upon material change)
**Evidence Retention:** 3 years from review date

---

## 1. Purpose

This procedure ensures that access rights across all Tabula Medica LLC systems are reviewed
regularly to verify they remain appropriate, that stale or orphaned accounts are removed, and
that MFA is enforced. Reviews occur quarterly to satisfy continuous control requirements under
SOC 2, HIPAA, and ISO 27001.

---

## 2. Schedule

| Quarter | Review Window | Due Date |
|---------|--------------|----------|
| Q1 | January 1 – March 31 | January 31 |
| Q2 | April 1 – June 30 | April 30 |
| Q3 | July 1 – September 30 | October 15 |
| Q4 | October 1 – December 31 | October 31 |

Reviews must be completed and signed off within 15 days of the quarter end.

---

## 3. Scope — Systems Reviewed

| System | Scope Details |
|--------|--------------|
| GCP IAM — Org (780509095720) | All projects: uninsurance-care-2026, united-planet-485003-n7-9f345, worldehr-app, sawd-app-2026, tabula-medica-bfd3d, underinsured-app-2026, tabula-cognita-prod, tabula-attentiva-phi, ltfm-health-2026, tabula-secrets |
| GitHub Org (Tabula-medica) | All org members, teams, outside collaborators, and Deploy Keys |
| Google Workspace (tabulamedica.com) | All accounts; suspended/archived accounts included in review |
| GCIP Tenants | All active GCIP tenants for: Uninsurance, PHR, WorldEHR, SAWD, ACO, Underinsured, Cognita, Attentiva, LTFM |
| Stripe | SAWD dashboard users and API keys |
| Plaid | SAWD dashboard users and API keys |
| GCP Service Accounts | All service accounts across all org projects; flag any with user-managed keys |

---

## 4. Review Steps

### Step 1 — Export User Lists

For each in-scope system, generate a current user/access list:

- **GCP IAM:** `gcloud asset search-all-iam-policies --scope=organizations/780509095720` — export to CSV
- **GitHub Org:** Settings > People > Export members list (CSV)
- **Google Workspace:** Admin console > Users > Download user list (CSV)
- **GCIP:** For each tenant, Admin SDK or console — export user list with MFA status
- **Stripe:** Dashboard > Team > export or screenshot members list
- **Plaid:** Dashboard > Team > export or screenshot members list
- **GCP Service Accounts:** `gcloud iam service-accounts list --project=<project>` for each project; flag any with `createTime` > 90 days and no recent key usage

### Step 2 — Verify Each Account

For each account, confirm all three of the following:

1. **Active user:** Account belongs to a current employee, contractor, or system identity (no former staff, no test accounts left active in production).
2. **Role is appropriate:** Role or permission set reflects minimum-necessary access for the user's current function. Elevated roles (Owner, Editor, Admin) require explicit justification.
3. **MFA is enabled:** Confirm MFA/TOTP is active. For GCIP tenants, verify enforcement policy is on. For Google Workspace, verify 2-Step Verification enrollment.

Flag any account that fails any criterion.

### Step 3 — Remediate Findings

For each flagged account:

- **Stale/orphaned account:** Disable immediately; schedule deletion after 30-day hold period.
- **Overly broad role:** Reduce to minimum-necessary; document the change.
- **MFA not enrolled:** Send enrollment reminder; if not resolved within 5 business days, suspend account pending enrollment.
- **Unrecognized account:** Treat as a potential security incident; invoke Incident Response Procedure (IR-02).

All remediations must be completed before sign-off, or tracked in the Risk Register with an owner and due date.

### Step 4 — Document Findings

Complete a quarterly access review record (see template in Section 7) capturing:

- Total accounts reviewed per system
- Findings (stale accounts, role mismatches, MFA gaps)
- Actions taken
- Any residual items tracked in the Risk Register

### Step 5 — Sign Off and File

Reviewer signs the record with name, title, and date. File the completed record at:

```
ventures/_ops/compliance-console/evidence/shared/
```

File naming convention: `Q<N>-<YYYY>-access-review-record.md`

---

## 5. Joiner Checklist (New Employee or Contractor)

Complete all steps before the new joiner's first day of access. Each step requires a dated entry
in the access log.

| Step | Action | System | Notes |
|------|--------|--------|-------|
| 1 | Create Google Workspace account | tabulamedica.com | Assign license appropriate to role |
| 2 | Enroll in Google 2-Step Verification | Google Workspace | Mandatory before any other access |
| 3 | Provision GCP IAM roles | GCP Org | Minimum-necessary; use predefined roles, not primitive Owner/Editor |
| 4 | Add to GitHub Org and team | Tabula-medica | Team membership scoped to relevant repos only |
| 5 | Enroll GCIP account | Relevant tenants only | Require TOTP MFA enrollment at first login |
| 6 | Grant Stripe/Plaid access if required | SAWD only | Restricted to users whose role requires it; read-only by default |
| 7 | Document in access log | Compliance console | Record date provisioned, systems, roles, approver |

**MFA requirement:** No joiner may access any production system or PHI-bearing service until
MFA enrollment is confirmed.

**Principle of minimum necessary:** All role assignments must be justified in the access log.
Broad roles (Owner, Admin) require written approval from the Security Officer.

---

## 6. Leaver Checklist (Employee or Contractor Departure)

Complete all steps on or before the last day of employment. For involuntary terminations,
complete Steps 1–4 immediately upon notification.

| Step | Action | System | Priority |
|------|--------|--------|----------|
| 1 | Suspend Google Workspace account | tabulamedica.com | Immediate |
| 2 | Revoke all GCP IAM roles | All org projects | Immediate |
| 3 | Remove from GitHub Org | Tabula-medica | Immediate |
| 4 | Disable GCIP accounts | All tenants | Immediate |
| 5 | Revoke personal API keys | GCP, GitHub PATs, Stripe, Plaid | Within 24 hours |
| 6 | Audit and rotate service account keys the leaver had access to | GCP Org | Within 24 hours |
| 7 | Transfer asset ownership (Drive files, repos) | Google Drive, GitHub | Within 7 days |
| 8 | Document in access log | Compliance console | Within 24 hours |
| 9 | Confirm completion in next quarterly access review | Access review record | At next review |

**Data retention:** After Workspace suspension, the account is retained for 30 days before
permanent deletion to allow data transfer. PHI access logs are retained per the data retention
schedule (minimum 6 years for HIPAA-covered records).

---

## 7. Quarterly Access Review Record Template

```markdown
# Quarterly Access Review Record — Q<N> <YYYY>

Review Period: <start date> – <end date>
Review Date: <YYYY-MM-DD>
Reviewer: <Name>, <Title>
Next Review Due: <date>

## Systems Reviewed

| System | Accounts Reviewed | Findings | Actions Taken | Residual Risk Register Ref |
|--------|------------------|----------|---------------|---------------------------|
| GCP IAM Org | | | | |
| GitHub Tabula-medica | | | | |
| Google Workspace | | | | |
| GCIP Tenants | | | | |
| Stripe (SAWD) | | | | |
| Plaid (SAWD) | | | | |

## Summary of Findings

<narrative>

## Outstanding Items

<list any items tracked in risk register>

## Sign-Off

Reviewer: _____________________________ Date: ____________
Security Officer: ______________________ Date: ____________
```

---

## 8. References

- SOC 2 CC6.2 (logical access provisioning), CC6.3 (access removal)
- HIPAA 45 CFR 164.308(a)(3)(ii)(B) — Workforce clearance procedure
- HIPAA 45 CFR 164.308(a)(3)(ii)(C) — Termination procedures
- ISO 27001:2022 A.5.18 — Access rights
- Tabula Medica Information Security Policy (00-information-security-policy.md)
- Tabula Medica Access Control Policy (01-access-control-and-access-review.md)
- Risk Register: Desktop/compliance-readiness/RISK-REGISTER-2026-08-20.md
