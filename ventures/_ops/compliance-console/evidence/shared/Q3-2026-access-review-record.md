# Quarterly Access Review Record — Q3 2026

**Control:** AC-04 — Access Reviews
**Frameworks:** SOC 2 CC6.2/CC6.3 | HIPAA 164.308(a)(3)(ii)(B) | ISO 27001 A.5.18
**Review Period:** July 1, 2026 – September 30, 2026
**Review Date:** 2026-09-28 (updated; initial draft 2026-09-19 — see addendum)
**Reviewer:** Rajiv Aggarwal, Security Officer, Tabula Medica LLC
**Next Review Due:** 2027-01-31 (Q4 2026 review)
**Status:** COMPLETE

---

## Systems Reviewed

### 1. GCP IAM — Organization 780509095720

| Field | Value |
|-------|-------|
| Projects reviewed | 10 (uninsurance-care-2026, united-planet-485003-n7-9f345, worldehr-app, sawd-app-2026, tabula-medica-bfd3d, underinsured-app-2026, tabula-cognita-prod, tabula-attentiva-phi, ltfm-health-2026, tabula-secrets) |
| Human accounts reviewed | 2 (rajiv@tabulamedica.com — Security Officer; abhi@tabulamedica.com — co-owner/heir) |
| Service accounts reviewed | ~14 across all projects (Cloud Run SAs, CI/CD deploy SAs, GCS access SAs) |
| Stale/orphaned accounts found | 0 human; 0 unused service accounts |
| Role mismatches found | 1 — abhi@tabulamedica.com held `owner` role on sawd-app-2026 and united-planet-485003-n7 (see addendum) |
| MFA status | rajiv@tabulamedica.com: confirmed active. abhi@tabulamedica.com: MFA was absent at initial review; remediated 2026-09-28 (see addendum) |
| Findings | (1) Uninsurance SA user-managed key age >90 days (R-003). (2) abhi@ owner-role on two projects — pending least-privilege remediation. (3) abhi@ Google Workspace MFA not enrolled — remediated 2026-09-28. |
| Actions taken | R-003 confirmed in risk register. abhi@ MFA enforced 2026-09-28 via Workspace admin. Owner-role demotion tracked as AC-01 open item. |
| Residual risk | R-003 (SA key rotation due 2026-10-01); AC-01 (abhi@ IAM least-privilege — active, intentional co-owner pending role scoping) |

---

### 2. GitHub Org — Tabula-medica

| Field | Value |
|-------|-------|
| Org members reviewed | 2 (rajivka4@gmail.com — owner; abhiaggarwalmd@gmail.com — owner, co-owner/heir) |
| Outside collaborators | 0 |
| Deploy keys | Reviewed per active repo; all associated with CI/CD workflows |
| Stale accounts | 0 |
| MFA enforcement | GitHub Org MFA requirement confirmed enabled |
| Findings | No unauthorized access; no stale members or collaborators detected |
| Actions taken | None required |
| Residual risk | None |

---

### 3. Google Workspace — tabulamedica.com

| Field | Value |
|-------|-------|
| Accounts reviewed | 2 active accounts (rajiv@tabulamedica.com; abhi@tabulamedica.com) |
| Suspended/archived accounts | 0 |
| MFA status | rajiv@tabulamedica.com: 2SV confirmed enrolled. abhi@tabulamedica.com: NOT enrolled at initial review — **remediated 2026-09-28** (2SV enforcement enabled org-wide via Workspace Admin; abhi enrollment confirmed) |
| Stale accounts | 0 |
| Findings | abhi@tabulamedica.com MFA gap — remediated same day (see addendum) |
| Actions taken | Org-wide 2-Step Verification enforcement enabled 2026-09-28 |
| Residual risk | None — MFA now enforced for all Workspace accounts |

Note: Additional Google accounts used in the portfolio (rajivka4@gmail.com, rajivka2@gmail.com)
are personal accounts not under Workspace policy enforcement. These accounts have Google 2-Step
Verification enabled as individually confirmed. Access via these accounts is limited to
non-PHI development and CI/CD contexts.

---

### 4. GCIP Tenants — All Active Ventures

| Venture | Tenant | MFA Policy | Accounts Reviewed | Findings |
|---------|--------|-----------|------------------|----------|
| Uninsurance | GCIP (uninsurance-care-2026) | TOTP enforcement ON | Admin: 1 | No issues |
| PHR (Tabula Medica PHR) | GCIP (united-planet-485003-n7-9f345) | TOTP enforcement ON | Admin: 1 | No issues |
| WorldEHR (omnihealth) | GCIP (worldehr-app) | TOTP enforcement ON | Admin: 1 | No issues |
| SAWD | GCIP (sawd-app-2026) | TOTP enforcement ON | Admin: 1 | No issues |
| ACO | GCIP (tabula-medica-bfd3d) | TOTP enforcement ON | Admin: 1 | No issues |
| Cognita | GCIP (tabula-cognita-prod) | TOTP enforcement ON | Admin: 1 | No issues |
| Attentiva | GCIP (tabula-attentiva-phi) | TOTP enforcement ON | Admin: 1 | No issues |
| LTFM | GCIP (ltfm-health-2026) | TOTP enforcement ON | Admin: 1 | No issues |
| Underinsured | GCIP (underinsured-app-2026) | TOTP enforcement PENDING | Admin: 1 | MFA enforcement not yet enabled — see findings below |

**Underinsured MFA Finding:**
GCIP MFA enforcement is not yet enabled on the underinsured-app-2026 tenant. This is a
known gap awaiting an IdP configuration upgrade. The venture carries no PHI (low risk rating).
This gap is acknowledged and tracked as a compensating control gap; the remediation path is
enabling GCIP TOTP enforcement following the same pattern as all other tenants.

---

### 5. Stripe — SAWD

| Field | Value |
|-------|-------|
| Dashboard users reviewed | 1 (rajivka4@gmail.com — sole admin) |
| API keys reviewed | Restricted keys only; no unrestricted secret keys in application config |
| MFA status | Stripe account MFA confirmed active |
| Stale accounts | 0 |
| Findings | No issues |
| Actions taken | None required |
| Residual risk | None |

---

### 6. Plaid — SAWD

| Field | Value |
|-------|-------|
| Dashboard users reviewed | 1 (sole admin) |
| API keys reviewed | Sandbox keys in use; production key integration pending backend deploy |
| MFA status | Plaid dashboard MFA confirmed active |
| Stale accounts | 0 |
| Findings | No issues |
| Actions taken | None required |
| Residual risk | None |

---

## Summary of Findings

**Total systems reviewed:** 6 (GCP IAM, GitHub Org, Google Workspace, 9 GCIP tenants, Stripe, Plaid)

**Total human accounts reviewed:** 2 individuals (Rajiv Aggarwal — Security Officer; Abhishek Aggarwal — co-owner/heir)

**Total service accounts reviewed:** ~14 GCP service accounts across all projects

**Findings:**

| # | Finding | Severity | Status |
|---|---------|---------|--------|
| 1 | Uninsurance SA user-managed key age >90 days (R-003) | Medium | Open — tracked in risk register; rotation due 2026-10-01 |
| 2 | Underinsured GCIP tenant MFA enforcement not enabled | Low | Open — tracked as compensating control gap; no PHI in scope; remediation scheduled |
| 3 | abhi@tabulamedica.com Google Workspace MFA not enrolled | Medium | **Remediated 2026-09-28** — org-wide 2SV enforcement enabled |
| 4 | abhi@tabulamedica.com holds `owner` role on sawd-app-2026 + united-planet-485003-n7 | Low | Open — intentional co-owner; least-privilege scoping (editor role) in progress |

**No unauthorized access detected.** All active accounts are associated with authorized
users. No orphaned, stale, or unrecognized accounts were found in any system.

---

## Outstanding Items

| Ref | Item | Owner | Due Date |
|-----|------|-------|----------|
| R-003 | Rotate uninsurance-care-2026 deploy SA user-managed key | Rajiv Aggarwal | 2026-10-01 |
| MFA-GAP-01 | Enable GCIP TOTP enforcement on underinsured-app-2026 tenant | Rajiv Aggarwal | 2026-11-01 |
| AC-01 | Demote abhi@tabulamedica.com from `owner` to `editor` on sawd-app-2026 + united-planet-485003-n7 | Rajiv Aggarwal | 2026-10-15 |

---

## Sign-Off

**Reviewer:** Rajiv Aggarwal, Security Officer, Tabula Medica LLC
**Review Date:** 2026-09-28 (addendum; original sign-off 2026-09-19)
**Signature (electronic):** Rajiv Aggarwal — authenticated via Google Workspace GCIP TOTP-MFA session

This review satisfies the Q3 2026 quarterly access review requirement under:
- SOC 2 CC6.2 (logical and physical access controls — provisioning)
- SOC 2 CC6.3 (logical and physical access controls — removal)
- HIPAA 45 CFR 164.308(a)(3)(ii)(B) — Workforce clearance procedure
- ISO 27001:2022 A.5.18 — Access rights

Next review: Q4 2026, due 2027-01-31.

---

## Addendum — 2026-09-28

**Reason:** Two findings discovered post-initial-review during Sprinto automated compliance scan.

### Finding 3 — abhi@tabulamedica.com MFA (REMEDIATED)
- **Discovered:** Sprinto automated scan flagged abhi@tabulamedica.com as failing "Google Workspace user should have MFA enabled" control
- **Root cause:** Google Workspace 2-Step Verification was not enforced org-wide; abhi@tabulamedica.com was not enrolled
- **Remediation:** 2-Step Verification enforcement enabled org-wide in Google Workspace Admin Console on 2026-09-28 by Rajiv Aggarwal. abhi@tabulamedica.com MFA confirmed enrolled.
- **Status:** CLOSED

### Finding 4 — abhi@tabulamedica.com IAM Owner Role (OPEN)
- **Discovered:** abhi@tabulamedica.com holds `roles/owner` on sawd-app-2026 and united-planet-485003-n7 GCP projects
- **Justification:** Abhishek Aggarwal is a co-owner and heir of Tabula Medica LLC; access is authorized
- **Least-privilege gap:** `roles/owner` is broader than required for day-to-day operations
- **Remediation plan:** Demote to `roles/editor` + specific role bindings by 2026-10-15
- **Status:** OPEN — tracked as AC-01 in outstanding items table above
