# Vendor and Business Associate Agreement Register

**Control ID:** VEN-01
**Document ID:** PHR-VEN-001
**Effective Date:** 2026-09-16
**Review Date:** 2027-09-16
**Owner:** Rajiv Aggarwal, CEO/CISO, Tabula Medica LLC
**Classification:** Internal — Compliance Evidence

> **Approved by Rajiv Aggarwal, CEO — 2026-09-16**

---

## 1. Purpose

This register documents all Business Associate Agreements (BAAs) and vendor relationships for Tabula Medica PHR where PHI or GDPR-regulated personal data may be accessed, processed, stored, or transmitted. It ensures every Business Associate under 45 CFR 164.308(b)(1) has a current signed BAA, and that GDPR data processing agreements (DPAs) are in place where required.

## 2. Scope

All third-party vendors and cloud services used in the Tabula Medica PHR production environment (tabula-medica.us / tabula-medica.world) that may come into contact with PHI or EU/EEA personal data.

## 3. BAA / DPA Register

| Vendor | Service | PHI Contact | GDPR Personal Data | BAA Status | GDPR DPA Status | Notes |
|--------|---------|-------------|-------------------|------------|----------------|-------|
| **Google Cloud Platform (GCP)** | Cloud infrastructure — Cloud Run, Cloud SQL (PostgreSQL), Cloud Storage, GCP Secret Manager, Cloud Logging | YES | YES | **SIGNED** — Tabula Medica LLC org (`tabulamedica.com`), GCP Org ID 780509095720 | **IN PLACE** — GCP Data Processing Amendment (DPA) covers EU/EEA personal data; Standard Contractual Clauses (SCCs) included | Master BAA covers all GCP services within org |
| **Firebase / Google Cloud Identity Platform (GCIP)** | Authentication, identity management | Minimal (user identifiers) | YES (email, auth identifiers) | **COVERED** — under GCP BAA | **COVERED** — under GCP DPA | GCIP is a GCP service |
| **Vertex AI / Google Cloud AI** | AI inference — PHI-touching health record AI (gemini-2.5-flash) | YES | YES | **COVERED** — under GCP BAA | **COVERED** — under GCP DPA | Vertex AI is a GCP service; BAA and DPA extend to AI workloads. Approved PHI-AI and GDPR-AI provider. |
| **Google Cloud Armor / Cloud CDN** | WAF, DDoS protection, CDN | Transient (network traffic) | Transient | **COVERED** — under GCP BAA | **COVERED** — under GCP DPA | No data persisted; coverage applies |
| **GitHub / GitHub Actions** | Source code management, CI/CD | NO — PHI/personal data must not appear in code or CI logs | NO | N/A — PHI/personal data exclusion policy | N/A | CI pipelines use synthetic test data only |

## 4. Prohibited Vendors — PHI and Personal Data Exclusion

The following vendors are explicitly **NOT approved** for any PHI or GDPR personal data processing. These vendors do not have BAAs or adequate data transfer safeguards in place with Tabula Medica LLC, and **PHI and GDPR personal data must never be transmitted to them under any circumstances**:

| Vendor | Service | PHI Prohibition Basis | GDPR Prohibition Basis |
|--------|---------|----------------------|----------------------|
| **Anthropic** | Claude AI models | No BAA executed; PHI-AI must route to Vertex AI only | No DPA or SCCs; no adequate transfer mechanism for EU/EEA personal data |
| **OpenAI** | GPT models, Whisper, DALL-E | No BAA executed; PHI-AI must route to Vertex AI only | No DPA or SCCs; no adequate transfer mechanism for EU/EEA personal data |
| Any non-GCP AI/ML provider | Third-party LLM or ML inference | Must obtain BAA and CISO approval before any PHI contact | Must obtain DPA with SCCs and CISO approval before any EU personal data contact |

This prohibition is absolute and is enforced in the AI Governance Policy (AIG-01).

## 5. GDPR Data Processing Notes

- **Legal Basis for Processing (GDPR Art. 6/9):** Health data is processed under Art. 9(2)(h) (provision of health care) and/or explicit consent (Art. 6(1)(a) + Art. 9(2)(a))
- **Data Transfers:** EU/EEA personal data is processed within GCP regions covered by the GCP DPA and SCCs; no transfers to third countries without adequate safeguards
- **Sub-processors:** GCP sub-processor list is maintained by Google and reviewed annually; changes are notified per DPA terms

## 6. BAA / DPA Lifecycle Management

| Activity | Frequency | Owner |
|----------|-----------|-------|
| Review existing BAAs and DPAs for currency and adequacy | Annual | CISO |
| New vendor PHI/personal data risk assessment | Before onboarding | CISO + Engineering Lead |
| BAA/DPA execution for new Business Associates / processors | Before PHI/personal data access | CISO / Legal |
| Vendor termination — data destruction confirmation | Within 60 days of termination | Engineering Lead |

## 7. Regulatory Mapping

| Requirement | Control Reference |
|-------------|------------------|
| SOC 2 CC9.2 — Vendor and partner risk management | §3 BAA Register; §6 Lifecycle Management |
| HIPAA 164.308(b)(1) — Business associate contracts | §3 BAA Register; §4 Prohibited Vendors |
| HIPAA 164.314(a) — Business associate contract requirements | §3 BAA Register |
| GDPR Art. 28 — Processor obligations | §3 DPA column; §5 GDPR Data Processing Notes |
| GDPR Art. 46 — Transfers with appropriate safeguards | §5 GDPR Data Processing Notes; GCP SCCs |
| ISO 27001 A.5.19 — IS in supplier relationships | §3 BAA Register; §4 Prohibited Vendors |
| ISO 27001 A.5.20 — Addressing IS in supplier agreements | §3 BAA Register; §6 Lifecycle Management |
