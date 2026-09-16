# Risk Assessment Policy and Register

**Control ID:** GOV-02
**Document ID:** PHR-RA-001
**Effective Date:** 2026-09-16
**Review Date:** 2027-09-16
**Owner:** Rajiv Aggarwal, CEO/CISO, Tabula Medica LLC
**Classification:** Internal — Compliance Evidence

> **Approved by Rajiv Aggarwal, CEO — 2026-09-16**

---

## 1. Purpose

This document defines the risk assessment methodology for Tabula Medica PHR and maintains a living risk register. It ensures material threats to PHI and GDPR personal data confidentiality, integrity, and availability are identified, evaluated, and treated with formal annual review.

## 2. Scope

All information assets, systems, and processes supporting tabula-medica.us and tabula-medica.world, including GCP infrastructure, GCIP authentication, Vertex AI inference, and data subject rights workflows.

## 3. Methodology

**Framework:** NIST SP 800-30 Rev. 1 adapted for healthcare SaaS with GDPR overlay.

**Likelihood Scale:**
| Score | Label | Definition |
|-------|-------|-----------|
| 3 | High | Likely to occur within 12 months without controls |
| 2 | Medium | Possible within 12 months |
| 1 | Low | Unlikely within 12 months given current controls |

**Impact Scale:**
| Score | Label | Definition |
|-------|-------|-----------|
| 3 | High | PHI breach >500 patients or GDPR personal data breach affecting EU/EEA subjects; regulatory action; material business disruption |
| 2 | Medium | Limited PHI/personal data exposure; operational disruption <4 hours |
| 1 | Low | No PHI/personal data exposure; minimal operational impact |

**Risk Score = Likelihood × Impact**
- 6–9: HIGH — Immediate treatment required
- 3–5: MEDIUM — Treatment plan within 90 days
- 1–2: LOW — Accept or monitor annually

## 4. Risk Register

| # | Risk | Likelihood | Impact | Score | Treatment | Residual Risk | Owner |
|---|------|-----------|--------|-------|-----------|--------------|-------|
| R-01 | **PHI / Personal Data Breach** — Unauthorized disclosure of patient health records via application vulnerability, misconfiguration, or credential compromise; triggers HIPAA and GDPR notification obligations | 2 | 3 | **6 — HIGH** | Encrypt all PHI at rest/transit; MFA enforcement; WAF (Cloud Armor); annual penetration test; HIPAA breach notification + GDPR Art. 33 notification procedures in place | Medium (2) — post-controls | CISO |
| R-02 | **Unauthorized AI Access to PHI** — PHI inadvertently sent to non-BAA AI provider (Anthropic, OpenAI), violating HIPAA BAA requirement and potentially GDPR data transfer restrictions | 2 | 3 | **6 — HIGH** | Hard policy: PHI-AI and GDPR personal data AI via Vertex AI only; code-level enforcement; PR review gates; AI Governance Policy (AIG-01); no Anthropic/OpenAI API keys in PHI systems | Low (1) — controls and policy | CISO / Engineering Lead |
| R-03 | **Infrastructure Outage** — GCP multi-region failure causing availability loss exceeding RTO; potential patient inability to access health records | 1 | 3 | **3 — MEDIUM** | Multi-zone GCP deployment; Cloud SQL high-availability; automated backups; documented BCP with RTO ≤4h / RPO ≤1h | Low (2) | Engineering Lead |
| R-04 | **Supply-Chain Vulnerability** — Compromise via third-party dependency introducing malicious code or exploitable CVE into PHI-handling systems | 2 | 2 | **4 — MEDIUM** | Dependabot auto-PRs; container image scanning; lock-file pinning; vendor BAA register; critical CVE SLA 30 days | Low–Medium (2) | Engineering Lead |
| R-05 | **Insider Threat** — Privileged user intentionally or accidentally exfiltrates or destroys PHI or GDPR personal data | 1 | 3 | **3 — MEDIUM** | Least-privilege IAM; audit logging of all PHI access; GCP Cloud Audit Logs retained 6 years; off-boarding checklist revokes access within 1 business day | Low (2) | CISO |

## 5. GDPR-Specific Risk Considerations

In addition to the register above, the following GDPR-specific risks are monitored:

- **Cross-border data transfer:** EU/EEA patient data must remain within GCP regions with adequate transfer mechanisms (GCP DPA/SCC coverage)
- **Right to erasure conflicts:** PHI retention obligations (HIPAA 6-year minimum) may conflict with GDPR erasure requests; resolution per legal counsel guidance
- **Consent management:** Consent records for GDPR-regulated processing must be maintained and auditable

## 6. Annual Review Cadence

| Activity | Frequency | Owner |
|----------|-----------|-------|
| Full risk register review | Annual (next: 2027-09-16) | CEO/CISO |
| New risk identification | Continuous (post-incident, post-change) | Engineering Lead |
| Residual risk sign-off | Annual | CEO/CISO |
| GDPR DPIA review (if applicable) | Before new high-risk processing | CISO |

## 7. Regulatory Mapping

| Requirement | Control Reference |
|-------------|------------------|
| SOC 2 CC3.1 — Risk identification | §3 Methodology; §4 Risk Register |
| SOC 2 CC3.2 — Risk analysis | §3 Likelihood/Impact scales; §4 Risk Register |
| HIPAA 164.308(a)(1)(ii)(A) — Risk analysis | §4 Risk Register; R-01, R-02, R-05 |
| ISO 27001 Clause 6.1 — Actions to address risks | §4 Risk Register; §5 Treatment Actions |
| GDPR Art. 35 — Data Protection Impact Assessment | §5 GDPR-Specific Risk Considerations |
