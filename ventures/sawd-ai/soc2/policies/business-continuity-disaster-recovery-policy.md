# Business Continuity & Disaster Recovery Policy

> **DRAFT — attorney review required.** Internal planning document, not legal advice.

**Owner:** Founder / acting ISO
**Approver:** Founder
**Version:** 0.1 (draft) — **Date:** 2026-09-03
**Review cadence:** Annual, plus at least one restore/DR test per year.

---

## 1. Purpose
Ensure SAWD can maintain or promptly restore critical services and data after a disruption, meeting availability commitments and protecting the integrity of taxpayer and financial data.

## 2. Scope
Critical services and data: sawd.ai (Firebase Hosting + Cloudflare), Base44 backend, GCP adjunct (Cloud Run, Cloud SQL in `sawd-ai`), GCIP identity, and integrations (Plaid, Stripe). Covers backups, recovery objectives, and continuity of operations for a small team.

## 3. Policy Statements
1. **Recovery objectives (DRAFT targets — confirm feasibility).**
   - **RTO (Recovery Time Objective):** critical services restored within **24 hours** of a declared disaster.
   - **RPO (Recovery Point Objective):** no more than **1 hour** of data loss for transactional data (Cloud SQL).
   > ⚠️ **GAP TO REMEDIATE:** These targets must be validated against actual backup frequency and restore speed. If current backups are daily-only, RPO=1h is not met — either increase backup/PITR frequency or restate the target.
2. **Backups.** Cloud SQL is backed up with automated daily backups **and point-in-time recovery (PITR)** enabled. Application config and IaC are in version control. Firebase/hosting artifacts are reproducible from source.
   > ⚠️ **GAP TO REMEDIATE:** Confirm automated backups + PITR are enabled on Cloud SQL and that Base44-held data is exportable/recoverable. Data residing solely in Base44 with no independent SAWD-controlled backup is an availability and lock-in risk — resolve as part of the Base44 exit.
3. **Backup security & integrity.** Backups are encrypted at rest, access-restricted, and located in a separate failure domain (different region/zone) from production where feasible.
4. **Restore testing.** Restores are tested at least **annually** (target: semi-annually) to prove backups are usable; results are documented.
   > ⚠️ **GAP TO REMEDIATE:** No documented restore test yet. Perform and record one before the audit period closes (A1.2/A1.3 evidence).
5. **Redundancy & availability.** Cloudflare provides edge resilience/DDoS protection; managed GCP services provide underlying redundancy. Single points of failure are identified in the risk register and mitigated where cost-justified.
6. **Business continuity for a small team.** Key-person risk is mitigated by documented runbooks (key rotation, Base44 exit, migration), access recovery procedures, and ensuring at least one trusted party can reach critical accounts in an emergency (break-glass), with break-glass use logged.
   > ⚠️ **GAP TO REMEDIATE:** Define and secure a documented break-glass procedure for critical accounts (GCP, domain, Stripe) to survive founder unavailability.
7. **Dependency on vendors.** Continuity depends on Base44, GCP, Cloudflare, Firebase, Plaid, Stripe uptime; their status and SLAs are tracked (Vendor policy). SAWD's commitments to customers do not exceed what its critical vendors support.
8. **Invocation.** The Founder/ISO declares a disaster and activates recovery; communication to affected users follows the Incident Response Policy and counsel guidance.

## 4. Roles / Responsibilities
- **ISO / Founder:** Declares disasters, owns RTO/RPO and the DR plan, approves customer communications.
- **Engineering:** Maintains backups, executes restores, runs DR tests.
- **Vendors:** Provide underlying platform resilience per SLA.

## 5. SOC 2 Mapping
A1.1 (capacity), A1.2 (backup, recovery, environmental/infrastructure protection), A1.3 (recovery testing), supporting CC7.5 (recovery from incidents).

## 6. Enforcement
Failure to maintain or test backups is a control deficiency tracked to closure by the ISO.

## 7. Review
Reviewed annually (next: 2027-09-03) and after any DR test or major architecture change.
