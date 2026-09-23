# Information Security Policy

**Control ID:** GOV-01
**Document ID:** PHR-ISP-001
**Effective Date:** 2026-09-16
**Review Date:** 2027-09-16
**Owner:** Rajiv Aggarwal, CEO/CISO, Tabula Medica LLC
**Classification:** Internal — Compliance Evidence

> **Approved by Rajiv Aggarwal, CEO — 2026-09-16**

---

## 1. Purpose

This policy establishes the information security program for Tabula Medica PHR (tabula-medica.us and tabula-medica.world), a patient health records platform operated by Tabula Medica LLC. It defines governance accountability, data classification standards, and mandates annual policy review to support SOC 2 Type II, HIPAA, ISO 27001, and GDPR compliance.

## 2. Scope

This policy applies to:
- All systems, services, and data assets comprising tabula-medica.us, tabula-medica.world, and associated APIs
- All employees, contractors, and vendors with access to PHR infrastructure or data
- All Protected Health Information (PHI) and GDPR-regulated personal data processed, stored, or transmitted by the platform
- All data subjects, including US patients (HIPAA) and EU/EEA patients (GDPR)

## 3. Leadership Accountability

| Role | Individual | Responsibility |
|------|-----------|----------------|
| Chief Executive Officer | Rajiv Aggarwal | Program sponsorship, final authority |
| Chief Information Security Officer | Rajiv Aggarwal | Policy ownership, risk governance, DPO-equivalent |
| Engineering Lead | As designated | Technical controls implementation |

The CEO/CISO serves as the accountable executive for both HIPAA Privacy/Security Officer and GDPR Data Protection responsibilities. Material incidents and audit findings are escalated to this office.

## 4. Data Classification

| Classification | Definition | Examples | Controls |
|---------------|------------|----------|----------|
| **PHI — HIGH** | HIPAA-regulated patient health data | Medical history, diagnoses, lab results, patient identifiers, insurance information | Encryption at rest (AES-256) and in transit (TLS 1.2+); access limited to need-to-know; PHI-AI: Vertex AI only |
| **Personal Data (GDPR)** | EU/EEA resident personal data | Name, email, health data, IP address of EU patients | All PHI controls plus GDPR Article 5 principles; data subject rights procedures |
| Confidential | Business-sensitive non-PHI | API keys, contracts, financial records | Encrypted storage; restricted access |
| Internal | Non-public operational data | System logs, configuration | Role-based access |
| Public | Approved for external release | Marketing materials, open-source code | Standard integrity controls |

Tabula Medica PHR processes **PHI at HIGH sensitivity** and **GDPR personal data** for EU/EEA data subjects. Both classification tracks carry the strictest applicable controls.

## 5. Core Control Requirements

- **Access Control:** Principle of least privilege; GCIP-enforced authentication with MFA required for all provider and admin accounts
- **Encryption:** AES-256 at rest; TLS 1.2+ in transit; no PHI or GDPR personal data in plaintext
- **AI/ML:** PHI must never be sent to any AI provider without a BAA. GDPR personal data must not be sent to providers without adequate data transfer safeguards. Approved: Vertex AI (Google Cloud AI — covered under GCP BAA). Prohibited: Anthropic Claude, OpenAI, or any provider lacking a signed BAA.
- **Data Minimization (GDPR Art. 5):** Collect only data necessary for the stated purpose; retain only as long as required
- **Audit Logging:** All PHI and personal data access events logged; retained per HIPAA minimum 6-year requirement
- **Data Subject Rights (GDPR):** Access, rectification, erasure, portability, and objection requests fulfilled within 30 days
- **Vulnerability Management:** Critical/high CVEs remediated within 30/90 days respectively
- **Business Continuity:** RTO ≤ 4 hours, RPO ≤ 1 hour for PHI systems

## 6. Annual Review

This policy and all subsidiary policies are reviewed annually by the CEO/CISO and updated to reflect changes in threat landscape, regulatory requirements, or system architecture. The next scheduled review is **2027-09-16**.

## 7. Policy Violations

Violations of this policy may result in disciplinary action up to and including termination. Material violations involving PHI are treated as potential HIPAA breaches per IR-01. Personal data breaches may also trigger GDPR Article 33 supervisory authority notification.

## 8. Related Documents

- `RISK-ASSESSMENT.md` (GOV-02)
- `INCIDENT-RESPONSE-AND-BREACH-NOTIFICATION.md` (IR-01)
- `VENDOR-BAA-REGISTER.md` (VEN-01)
- `AI-GOVERNANCE-POLICY.md` (AIG-01/02/03)

## 9. Regulatory Mapping

| Requirement | Control Reference |
|-------------|------------------|
| SOC 2 CC1.1 — Control environment | §3 Leadership Accountability |
| SOC 2 CC5.3 — Policy communication | §5 Core Control Requirements; this document |
| HIPAA 164.316(a) — Security policies | This document in full |
| ISO 27001 A.5.1 — Information security policies | This document in full |
| GDPR Art. 5 — Principles for processing | §4 Data Classification; §5 Data Minimization |
| GDPR Art. 24 — Responsibility of the controller | §3 Leadership Accountability |
