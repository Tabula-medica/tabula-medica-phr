# Change Management & SDLC Policy

> **DRAFT — attorney review required.** Internal planning document, not legal advice.

**Owner:** Founder / acting ISO
**Approver:** Founder
**Version:** 0.1 (draft) — **Date:** 2026-09-03
**Review cadence:** Annual, or on material change.

---

## 1. Purpose
Ensure changes to SAWD production systems are authorized, reviewed, tested, and traceable, so that changes do not introduce security defects or availability risk to systems processing taxpayer and financial data.

## 2. Scope
All changes to production: application code (Vite/React frontend, Base44 backend logic, GCP Cloud Run services, Cloud SQL schema), infrastructure/IaC, GCIP config, Cloudflare config, mobile releases (Expo/EAS), and third-party integration config (Plaid, Stripe). Applies to the founder and all contributors.

## 3. Policy Statements
1. **Version control.** All code lives in version control (GitHub). No production change is made by editing live systems without a corresponding tracked change, except emergency fixes (Section 3.8).
2. **Branch protection.** The default branch is protected: no direct pushes, required pull request, and required status checks (build + tests + security scans) must pass before merge.
   > ⚠️ **GAP TO REMEDIATE:** Confirm branch protection and required checks are actually enabled on all SAWD repos. In a solo/small team, PRs may currently be self-merged without review — see 3.3.
3. **Code review.** Every change is reviewed via pull request before merge. In a single-maintainer situation, use a compensating control: a second reviewer where one exists, or documented self-review against a checklist plus mandatory automated checks (SAST, dependency scan, secret scan) as the gate.
   > ⚠️ **GAP TO REMEDIATE:** With a small team, independent peer review may not exist for every change. Define and document the compensating control (checklist + automated gates + periodic third-party review) so CC8.1 has evidence.
4. **CI/CD gates.** The pipeline enforces: successful build, automated tests, dependency vulnerability scan, secret scan, and (for infra) plan review before apply. Failing gates block deploy.
   > ⚠️ **GAP TO REMEDIATE:** Confirm a CI/CD pipeline with these gates exists for both the Firebase frontend and GCP backend; Base44-hosted logic may deploy outside a gated pipeline and needs a documented review path.
5. **Testing.** Changes are tested before production (unit/integration as applicable; ATS testing for IRS e-file components where relevant). No untested schema migration is applied to production Cloud SQL.
6. **Separation of environments.** Development/test and production are separated; production data is not used in non-production without de-identification.
7. **Approval & traceability.** Each production change is traceable to its PR, reviewer/approver, and deployment record. Sprinto ingests GitHub evidence.
8. **Emergency changes.** Emergency fixes may bypass normal review but must be documented, reviewed retroactively within 2 business days, and approved by the ISO.
9. **Secure SDLC.** Security requirements (authN/authZ, input validation, encryption, logging) are considered at design; dependencies are tracked and updated per the Vulnerability Management Policy.
10. **Mobile releases.** Expo/EAS builds follow the same review + versioning discipline; store submissions are gated on passing checks.

## 4. Roles / Responsibilities
- **ISO / Founder:** Approves emergency changes; owns the pipeline gate configuration.
- **Engineering:** Author PRs, obtain review, ensure checks pass, maintain IaC.
- **Sprinto:** Collects change-management evidence from GitHub/CI.

## 5. SOC 2 Mapping
CC8.1 (change authorization, design, testing, approval, and implementation), supporting CC7.1 (secure configuration baseline).

## 6. Enforcement
Unauthorized or unreviewed production changes are reverted where feasible and reviewed; repeated bypass is a disciplinary matter.

## 7. Review
Reviewed annually (next: 2027-09-03) and on pipeline/architecture change.
