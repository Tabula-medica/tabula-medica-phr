# Data Retention & Disposal Policy

> **DRAFT — attorney review required.** Retention periods below are DRAFT placeholders. Tax-record retention and §7216 constraints MUST be set by counsel before adoption.

**Owner:** Founder / acting ISO
**Approver:** Founder
**Version:** 0.1 (draft) — **Date:** 2026-09-03
**Review cadence:** Annual, or on material change.

---

## 1. Purpose
Define how long SAWD retains each category of data and how it is securely disposed of, balancing legal retention obligations (tax records) against data-minimization and confidentiality duties.

## 2. Scope
All SAWD data across production systems, backups, logs, AI processing artifacts, and third-party stores.

## 3. Policy Statements
1. **Retention schedule (DRAFT — counsel to confirm).**

   | Data category | Draft retention | Basis (confirm) |
   |---------------|-----------------|-----------------|
   | Taxpayer return records / e-file data | Retain per IRS preparer requirements (commonly ~3 years, some records longer) | IRS/preparer rules |
   | §7216 consents | Retain to evidence valid consent (note ≤1yr consent validity vs. record retention) | §7216 / counsel |
   | Financial-account (Plaid) data | Retain only while needed for service; delete on account closure + grace | Minimization / GLBA |
   | Payment records (Stripe) | Per Stripe/PCI + tax/accounting rules | PCI / accounting |
   | Auth/identity records | Life of account + defined post-closure window | Security |
   | Security & audit logs | ≥1 year (support SOC 2 audit period + forensics) | CC7.x / audit |
   | Backups | Rolling window aligned to RPO/RTO and retention | A1.2 |
   | AI prompt/response data | None retained by provider (ZDR); SAWD retains only what's required | ZDR intent |
   | Marketing/CRM | Until consent withdrawn or purpose ends | Privacy |

   > ⚠️ **GAP TO REMEDIATE:** These periods are placeholders. Counsel must set the authoritative tax-record retention and reconcile §7216 consent validity (≤1 year) with record-retention duties before this policy is adopted.
2. **Retain no longer than necessary.** Beyond required retention, Tier 1/2 data is deleted or de-identified. Data is not hoarded "just in case."
3. **Secure disposal.** Electronic media/data are disposed of using methods that render data unrecoverable (cryptographic erasure, secure delete, or provider deletion APIs); paper with PII is shredded. Vendor-held data deletion is requested via the vendor and confirmed.
   > ⚠️ **GAP TO REMEDIATE:** No documented disposal procedure or evidence of executed deletions exists. Define the procedure and log deletions (C1.2/CC6.5 evidence).
4. **Backups & logs.** Disposal accounts for copies in backups and logs; retention windows on backups/logs are enforced automatically where possible.
5. **Deletion on request.** Data-subject deletion requests are handled per the Data Privacy Policy and legal-hold exceptions.
6. **Legal hold.** On litigation/investigation notice, relevant data is preserved and normal disposal is suspended until counsel releases the hold.
7. **Disposal of hardware.** Devices are wiped/destroyed before disposal or reuse.

## 4. Roles / Responsibilities
- **ISO / Founder:** Owns the schedule and disposal procedures.
- **Counsel:** Sets legally required retention and legal holds.
- **Engineering:** Implements automated retention/deletion and executes disposal.

## 5. SOC 2 Mapping
C1.2 (confidential information disposed of to meet objectives), CC6.5 (logical/physical protections removed on disposal), supporting C1.1.

## 6. Enforcement
Retaining Tier 1 data beyond its schedule or improper disposal is a violation tracked to closure by the ISO.

## 7. Review
Reviewed annually (next: 2027-09-03) and when retention obligations change.
