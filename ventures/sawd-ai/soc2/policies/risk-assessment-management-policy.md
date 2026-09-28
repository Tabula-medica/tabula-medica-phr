# Risk Assessment & Management Policy

> **DRAFT — attorney review required.** Internal planning document, not legal advice.

**Owner:** Founder / acting ISO
**Approver:** Founder
**Version:** 0.1 (draft) — **Date:** 2026-09-03
**Review cadence:** Annual, with a documented risk assessment at least annually.

---

## 1. Purpose
Establish how SAWD identifies, analyzes, treats, and monitors risks to its systems and data — including fraud risk — so that security investment is prioritized against actual threats to taxpayer and financial data.

## 2. Scope
All risks to SAWD's information assets, operations, compliance, and availability, including technical, vendor/subprocessor, personnel, fraud, and regulatory (§7216, GLBA, state privacy) risks.

## 3. Policy Statements
1. **Risk register.** SAWD maintains a risk register recording each risk, its owner, likelihood, impact, inherent and residual rating, treatment decision, and status. It is reviewed at least quarterly.
   > ⚠️ **GAP TO REMEDIATE:** A formal, maintained risk register does not yet exist. Stand one up (Sprinto's risk module or a tracked doc) before the audit period — CC3.x has no evidence without it.
2. **Annual risk assessment.** A documented risk assessment is performed at least annually and on material change (new integration, new data type, architecture change such as the Base44 exit).
3. **Risk criteria.** Likelihood and impact are scored on a defined scale; treatment thresholds determine whether a risk is accepted, mitigated, transferred, or avoided. Residual risk above threshold requires ISO acceptance in writing.
4. **Fraud risk.** SAWD explicitly assesses fraud risk (account takeover, payment fraud via Stripe, data theft, insider misuse of taxpayer data) as required by CC3.2, and maps controls to each.
5. **Change-driven risk.** Significant changes are assessed for new risk before implementation (ties to Change Management and Vendor policies) per CC3.4.
6. **Treatment & tracking.** Each material risk has an owner and a treatment plan tracked to closure; overdue items are escalated to the Founder.
7. **Linkage.** Risk outcomes drive control selection in the ISMS; incident, vendor, and pen-test findings feed the register.
8. **Regulatory risk.** Compliance risks (§7216 consent, GLBA Safeguards/WISP adoption, e-file gates, state privacy) are tracked with counsel-owned items flagged and not self-cleared.

## 4. Roles / Responsibilities
- **ISO / Founder:** Owns the register, runs the annual assessment, accepts residual risk.
- **Risk owners:** Drive assigned treatments to closure.
- **Counsel:** Owns and validates regulatory-risk items.

## 5. SOC 2 Mapping
CC3.1 (objectives/risk identification), CC3.2 (risk analysis incl. fraud), CC3.3 (fraud consideration), CC3.4 (assessing change), supporting CC4.1 (monitoring) and CC5.x.

## 6. Enforcement
Unmanaged high risks and overdue treatments are escalated; ignoring an accepted-risk expiry is a governance failure reviewed by the ISO.

## 7. Review
Reviewed annually (next: 2027-09-03); register reviewed quarterly.
