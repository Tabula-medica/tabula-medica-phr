# Data Classification & Handling Policy

> **DRAFT — attorney review required.** Internal planning document, not legal advice.

**Owner:** Founder / acting ISO
**Approver:** Founder
**Version:** 0.1 (draft) — **Date:** 2026-09-03
**Review cadence:** Annual, or on material change.

---

## 1. Purpose
Define SAWD's data classification tiers and the handling rules for each, so that the most sensitive data — taxpayer return information and financial-account data — receives the strongest protection required by §7216/§6713, GLBA, and SOC 2 Confidentiality criteria.

## 2. Scope
All data SAWD creates, receives, stores, or transmits, in any system or medium.

## 3. Classification Tiers

| Tier | Examples | Handling baseline |
|------|----------|-------------------|
| **Tier 1 — Restricted (highest)** | Taxpayer return information (§7216 TRI), SSN/TIN, financial-account data (Plaid-linked accounts, balances), full payment data | Encrypt at rest + in transit; strict need-to-know; access logged; no export to unapproved tools/AI; §7216 consent/permitted purpose required for use or disclosure; masking of SSN for non-US recipients |
| **Tier 2 — Confidential** | Names, addresses, emails, phone, non-tax PII, internal financials, credentials/secrets | Encrypt at rest + in transit; need-to-know; access controlled; not public |
| **Tier 3 — Internal** | Internal docs, non-sensitive config, runbooks | Access limited to workforce; not published |
| **Tier 4 — Public** | Marketing site content, public docs | No restriction; integrity controlled |

## 4. Policy Statements
1. **Classify by default to the highest applicable tier.** Taxpayer return information is always Tier 1. When in doubt, treat data as Tier 1/2.
2. **Handling by tier.** Each tier's baseline (table above) is mandatory. Tier 1 data is encrypted in transit (TLS) and at rest, restricted to need-to-know, logged on access, and never placed in unapproved tools, AI prompts, chat, or local desktop storage.
   > ⚠️ **GAP TO REMEDIATE:** Historic secrets on Desktop and un-confirmed AI ZDR mean Tier 1/2 handling rules are not yet fully enforced. Remediate (Secret Manager migration; ZDR confirmation) before attesting.
3. **§7216 controls on Tier 1.** Use or disclosure of taxpayer return information requires a permitted purpose or valid written taxpayer consent (separate USE vs DISCLOSURE consents, purpose/recipient/scope named), with SSN masked for non-US recipients. Mandatory consent language is inserted by counsel verbatim — never paraphrased.
4. **Data mapping.** SAWD maintains a data inventory/map showing where each data type lives (Base44, Cloud SQL, Plaid, Stripe, logs, backups, AI path) and its classification.
   > ⚠️ **GAP TO REMEDIATE:** A current data map does not exist. Build one — it is the backbone of C1.1, retention, and breach-scoping.
5. **Labeling.** Where feasible, storage locations and documents are labeled with their tier; database columns holding Tier 1 data are identified.
6. **Minimization.** Collect and retain only the data needed for the service; avoid duplicating Tier 1 data into logs, analytics, or test environments.
7. **Transfer.** Tier 1/2 data is transferred only over encrypted channels to authorized recipients under appropriate agreements (Vendor policy).
8. **No production data in test.** Tier 1/2 data is not used in non-production without de-identification.

## 4a. Roles / Responsibilities
- **ISO / Founder:** Owns the classification scheme and data map.
- **Counsel:** Confirms §7216 treatment and consent language for Tier 1.
- **Engineering:** Enforces tier controls in systems; keeps the data map current.
- **Workforce members:** Handle data per its tier; do not downgrade or misplace Tier 1 data.

## 5. SOC 2 Mapping
CC6.1 (access based on classification), CC6.5 (data handling), C1.1 (confidential information identified and protected), supporting C1.2 (disposal).

## 6. Enforcement
Mishandling Tier 1 taxpayer data is a serious violation subject to disciplinary action and referral to counsel for §7216/§6713 exposure.

## 7. Review
Reviewed annually (next: 2027-09-03) and when a new data type or system is introduced.
