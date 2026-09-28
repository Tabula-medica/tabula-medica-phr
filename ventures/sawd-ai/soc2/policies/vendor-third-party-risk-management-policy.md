# Vendor & Third-Party Risk Management Policy

> **DRAFT — attorney review required.** Internal planning document, not legal advice.

**Owner:** Founder / acting ISO
**Approver:** Founder
**Version:** 0.1 (draft) — **Date:** 2026-09-03
**Review cadence:** Annual, with per-vendor review at onboarding and annually.

---

## 1. Purpose
Ensure third parties and subprocessors that store, process, or transmit SAWD data meet SAWD's security and confidentiality requirements, and that data-protection obligations flow down — including taxpayer-data restrictions under §7216 and GLBA Safeguards' service-provider oversight requirement.

## 2. Scope
All vendors and subprocessors with access to SAWD systems or data. Critical/data-bearing vendors include:

| Vendor | Role | Data exposure |
|--------|------|---------------|
| **Base44** | Primary backend / app platform | App + potentially taxpayer/PII data |
| **Google Cloud (GCP)** | Cloud Run, Cloud SQL, GCIP, Vertex AI | Compute, DB, identity, AI processing |
| **Cloudflare** | Edge/CDN/WAF/DDoS | Traffic in transit, WAF logs |
| **Firebase** (Google) | Hosting | Static frontend |
| **Plaid** | Bank account linking | Financial-account data |
| **Stripe** | Payments | Payment/cardholder data (PCI SAQ-A posture) |
| **Anthropic (Claude)** via Vertex | AI in data path | Potentially taxpayer/PII in prompts — ZDR intended |
| **Google Gemini** | AI in data path | Potentially taxpayer/PII in prompts — ZDR intended |
| **Sprinto** | Compliance automation | Control metadata, evidence |
| **Expo/EAS** | Mobile build/delivery | Build artifacts |

## 3. Policy Statements
1. **Due diligence before onboarding.** Before a vendor handles SAWD data, SAWD reviews its security posture — SOC 2 / ISO 27001 report, DPA, sub-processor list, breach-notice terms, and data-use terms — and records the review.
   > ⚠️ **GAP TO REMEDIATE:** A vendor inventory with due-diligence records and DPAs on file does not yet exist for all vendors above. Collect SOC 2 reports/DPAs and record reviews before attesting CC9.2.
2. **Data Processing Agreements.** A DPA (or equivalent contractual data-protection terms) is in place with every vendor processing personal/taxpayer/financial data, including confidentiality, security, breach-notification, and sub-processor terms.
3. **§7216 flow-down.** Any vendor that receives taxpayer return information is contractually restricted to permitted use/disclosure and bound to §7216-consistent terms; use of such vendors is coordinated with counsel. No taxpayer data goes to a vendor without a permitted purpose and, where required, taxpayer consent.
4. **AI subprocessors / ZDR.** AI providers in the data path (Claude on Vertex, Gemini) must operate under zero-data-retention / no-training terms confirmed in contract and configuration before taxpayer or PII data is processed through them.
   > ⚠️ **GAP TO REMEDIATE:** ZDR is *intended*, not confirmed. Verify Vertex/Gemini contractual + configured no-retention/no-training and record it; until then AI must not receive taxpayer/PII data (enforce via Data Privacy + AUP).
5. **MFA & security attestations flow-down.** Where SAWD attests to partners (e.g., Plaid/Stripe security questionnaires), SAWD attests only to controls it actually operates. "MFA everywhere" is not attested until MFA is enforced.
   > ⚠️ **GAP TO REMEDIATE:** Do not submit Plaid/Stripe MFA attestations claiming universal MFA until enforcement is verified (ties to Access Control gap).
6. **Least-privilege vendor access.** Vendor access to SAWD systems is least-privilege, time-boxed, and removed at term end (Access Control Policy).
7. **Ongoing monitoring.** Critical vendors are reviewed at least annually (posture, SOC 2 renewal, breach history, sub-processor changes). Material vendor changes trigger a risk assessment.
8. **Sub-processor transparency.** SAWD maintains a current sub-processor list for its own customer-facing disclosures, consistent with the Data Privacy Policy.
9. **Vendor incidents.** Vendor breach notices activate the Incident Response Policy.

## 4. Roles / Responsibilities
- **ISO / Founder:** Owns the vendor inventory, approves onboarding, runs annual reviews.
- **Counsel:** Reviews DPAs and §7216 flow-down for data-bearing vendors.
- **Engineering:** Configures least-privilege vendor access and ZDR settings.

## 5. SOC 2 Mapping
CC9.2 (vendor and business-partner risk management), supporting CC3.4 (change), CC6.1 (access), C1.1 (confidentiality flow-down).

## 6. Enforcement
Onboarding a data-bearing vendor without due diligence/DPA is a control violation; the engagement is paused until remediated.

## 7. Review
Reviewed annually (next: 2027-09-03); each critical vendor reviewed at onboarding and annually.
