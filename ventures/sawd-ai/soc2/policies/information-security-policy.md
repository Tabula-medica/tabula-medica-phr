# Information Security Policy (Master / ISMS)

> **DRAFT — attorney review required.** Internal planning document, not legal advice.

**Owner:** Founder / acting Information Security Officer (ISO)
**Approver:** Founder (SAWD Corporation)
**Version:** 0.1 (draft) — **Date:** 2026-09-03
**Review cadence:** Annual, or on material change to systems, team, or regulation.

---

## 1. Purpose
This policy establishes SAWD's Information Security Management System (ISMS): the governing framework of principles, roles, and subordinate policies that protects the confidentiality, integrity, and availability of SAWD systems and the taxpayer, personal, and financial-account data SAWD processes. It is the master document; all other SAWD security policies are subordinate to and interpreted under it.

## 2. Scope
Applies to all SAWD workforce members (founder, employees, contractors, and any person with access to SAWD systems or data), and to all information assets: the Firebase-hosted sawd.ai frontend, Cloudflare edge, Base44 backend, the GCP adjunct (Cloud Run / Cloud SQL in project `sawd-ai`), GCIP identity (`sawd-app-2026`), the Expo/EAS mobile app, integrated services (Plaid, Stripe), AI processing (Claude on Vertex AI, Gemini), and all endpoints, code repositories, and SaaS tools used to run the business.

## 3. Policy Statements
1. **Security program.** SAWD maintains a documented ISMS reviewed at least annually and after any material change. This policy and its subordinate policies constitute that ISMS.
2. **Governance & accountability.** The Founder holds ultimate accountability for information security and serves as acting ISO until a dedicated officer is appointed. Security responsibilities are assigned in writing (Section 5) so no control is ownerless (supports CC1.2, CC1.3).
3. **Risk-based approach.** Security controls are selected and prioritized from the risk register maintained under the Risk Assessment & Management Policy (CC3.x). Controls are commensurate with the sensitivity of taxpayer and financial data.
4. **Least privilege & need-to-know.** Access to systems and data is granted on least-privilege, need-to-know terms per the Access Control Policy.
5. **Defense in depth.** SAWD layers controls: Cloudflare edge protection, identity/MFA, encryption, logging/monitoring, vulnerability management, and vendor governance. No single control is relied upon alone.
6. **Data protection by classification.** All data is classified and handled per the Data Classification & Handling Policy; taxpayer return information is treated as the most sensitive tier and is subject to IRC §7216/§6713 and GLBA Safeguards controls.
7. **Regulatory alignment.** The ISMS is designed to support SOC 2 (Security, Availability, Confidentiality) and to align with GLBA Safeguards Rule (WISP), IRC §7216/§6713, and applicable state privacy law. Legal interpretation is reserved to counsel.
8. **Continuous improvement.** Findings from incidents, audits, pen tests, and vendor reviews feed corrective actions tracked to closure.
9. **Policy exceptions.** Any deviation requires a written, time-boxed exception approved by the ISO, recorded with a compensating control and an expiry date.

> ⚠️ **GAP TO REMEDIATE:** SAWD does not yet have a formally adopted, version-controlled ISMS with a management approval record. Adopting this pack in Sprinto with a dated approval closes this gap. Until then, CC1.x governance evidence does not exist.

## 4. Roles / Responsibilities
- **Founder / ISO:** Owns the ISMS, approves policies and exceptions, chairs the annual review, final risk-acceptance authority.
- **Security partner (fractional CISO / external, to be engaged):** Advises on control design, reviews the pack, supports pen-test and audit readiness.
- **Engineering (founder + contractors):** Implement and operate technical controls; comply with SDLC, access, and change policies.
- **All workforce members:** Read, accept, and comply with all published policies; report incidents.
- **Counsel:** Confirms legal/regulatory interpretations; no external communication of a breach or filing occurs without counsel.

## 5. SOC 2 Mapping
CC1.1, CC1.2, CC1.3, CC1.4, CC1.5, CC2.1, CC2.2, CC2.3, CC3.1, CC5.1, CC5.2, CC5.3 (this master policy anchors the control environment and references the control set spanning CC1–CC9, A1, C1).

## 6. Enforcement
Violations may result in access revocation, disciplinary action up to termination, and, for contractors, engagement termination. Willful violations involving taxpayer data may carry personal criminal/civil exposure under §7216/§6713 and are referred to counsel.

## 7. Review
Reviewed annually by the ISO (next review: 2027-09-03) and upon material change. Changes are version-stamped in Sprinto and trigger re-acceptance.
