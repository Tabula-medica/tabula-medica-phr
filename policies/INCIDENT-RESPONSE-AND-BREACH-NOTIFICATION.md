# Incident Response and Breach Notification Policy

**Control ID:** IR-01
**Document ID:** PHR-IR-001
**Effective Date:** 2026-09-16
**Review Date:** 2027-09-16
**Owner:** Rajiv Aggarwal, CEO/CISO, Tabula Medica LLC
**Classification:** Internal — Compliance Evidence

> **Approved by Rajiv Aggarwal, CEO — 2026-09-16**

---

## 1. Purpose

This policy defines the process for detecting, classifying, containing, and recovering from security incidents involving Tabula Medica PHR systems, with specific procedures for both HIPAA breach notification and GDPR personal data breach notification obligations.

## 2. Scope

All security events and incidents affecting tabula-medica.us and tabula-medica.world infrastructure, PHI, GDPR personal data, or business operations, regardless of origin (internal, external, vendor).

## 3. Incident Classification

| Severity | Definition | Examples | Initial Response SLA |
|----------|-----------|----------|---------------------|
| **Sev 1 — Critical** | Active PHI or personal data breach; ransomware; complete system unavailability | Confirmed unauthorized PHI/personal data disclosure; database compromise; ransomware encryption | Immediate (< 1 hour); CISO notified within 15 minutes |
| **Sev 2 — High** | Suspected PHI or personal data exposure; significant service degradation; credential compromise | Anomalous data access; admin account compromise; API key exposure; potential GDPR Art. 33 trigger | < 4 hours; CISO notified within 1 hour |
| **Sev 3 — Medium/Low** | No PHI or personal data exposure; limited operational impact | Failed intrusion attempt; dependency vulnerability; configuration drift | < 24 hours; logged and tracked |

## 4. Escalation Chain

| Step | Contact | Method |
|------|---------|--------|
| Primary responder detects incident | Engineering On-call | Automated alert / GCP Security Command Center |
| Sev 1–2 notification | **Rajiv Aggarwal, CEO/CISO** | Direct call + email rajivka4@gmail.com |
| Legal/Regulatory counsel | External counsel (Trevor Anderson) | Email — Sev 1 PHI/personal data breach only |
| GDPR supervisory authority | Relevant EU/EEA Data Protection Authority | Formal notification within 72 hours — Sev 1 personal data breach |
| Affected patients/data subjects | All affected individuals | Written notice within HIPAA (60-day) and GDPR (without undue delay) deadlines |

## 5. Incident Response Phases

### 5.1 Detection and Analysis
- Ingest alerts from GCP Security Command Center, Cloud Audit Logs, WAF, and application monitoring
- Assign severity classification within 30 minutes of detection
- Open incident ticket; assign Incident Commander (default: CISO)
- Assess whether PHI is involved (HIPAA trigger) and/or EU/EEA personal data (GDPR Art. 33 trigger)

### 5.2 Containment
- **Short-term:** Isolate affected system(s); revoke compromised credentials; block malicious IPs via Cloud Armor
- **Long-term:** Apply patches; restore from verified backup; enforce MFA on all affected accounts

### 5.3 Eradication
- Remove malware or malicious access paths
- Rotate all potentially exposed secrets and API keys (GCP Secret Manager)
- Verify audit logs confirm no persistence mechanism remains

### 5.4 Recovery
- Restore service from last clean backup (RPO ≤ 1 hour for PHI systems)
- Validate PHI and personal data integrity before returning to production
- Monitor for 72 hours post-recovery for signs of re-compromise

### 5.5 Post-Incident Review
- Conducted within **5 business days** of incident closure
- Produces written root-cause analysis and remediation action items
- Action items tracked to completion with 30/90-day SLAs (Sev 1–2 / Sev 3)
- Summary retained for 6 years per HIPAA; also retained for GDPR accountability obligations

## 6. HIPAA Breach Notification

A "breach" is defined per 45 CFR 164.402 as impermissible use or disclosure of PHI not excluded under the Safe Harbor provision or the low-probability-of-compromise assessment.

| Notification Requirement | Deadline | Recipient | Method |
|--------------------------|----------|-----------|--------|
| Affected individuals | 60 calendar days from discovery | Each affected patient | Written notice (email where authorized; first-class mail otherwise) |
| HHS Office for Civil Rights | 60 calendar days (≥ 500 individuals); annual report (< 500 individuals) | HHS OCR breach portal | Electronic submission |
| Media notice (if > 500 individuals in a state) | 60 calendar days | Prominent local media | Press release |

Notification content must include: description of breach, types of PHI involved, steps individuals should take to protect themselves, steps PHR is taking, and contact information.

## 7. GDPR Personal Data Breach Notification

A "personal data breach" under GDPR Article 4(12) is a breach of security leading to accidental or unlawful destruction, loss, alteration, unauthorized disclosure of, or access to, personal data transmitted, stored, or otherwise processed.

| Notification Requirement | Deadline | Recipient | Method |
|--------------------------|----------|-----------|--------|
| Supervisory Authority | **72 hours** from awareness of the breach | Lead supervisory authority in the EU/EEA member state of the controller's main establishment, or the authority of the affected data subjects | Formal written notification via supervisory authority's online portal |
| Affected data subjects | **Without undue delay** — when breach is likely to result in high risk to rights and freedoms | All EU/EEA data subjects whose personal data was affected | Clear, plain-language notice describing the breach, contact details of DPO-equivalent, likely consequences, and measures taken |

**Supervisory Authority Notification must include:**
1. Nature of the breach (categories and approximate number of data subjects and records)
2. Contact details of the data protection officer or equivalent
3. Likely consequences of the breach
4. Measures taken or proposed to address the breach

If the full information is not available within 72 hours, an initial notification is submitted with available information, followed by supplemental notifications as information becomes available.

## 8. Evidence Retention

All incident records, communications, and post-mortems are retained for a minimum of **6 years** per HIPAA 164.316(b)(2). GDPR breach records are also retained to demonstrate accountability under GDPR Article 5(2).

## 9. Regulatory Mapping

| Requirement | Control Reference |
|-------------|------------------|
| SOC 2 CC7.3 — Incident evaluation | §3 Incident Classification; §5.1 Detection |
| SOC 2 CC7.4 — Incident response | §5 Response Phases |
| SOC 2 CC7.5 — Incident recovery | §5.4 Recovery; §5.5 Post-Incident Review |
| HIPAA 164.308(a)(6) — Security incident procedures | §5 Response Phases; §8 Evidence Retention |
| HIPAA 164.410 — Breach notification to individuals | §6 HIPAA Breach Notification |
| GDPR Art. 33 — Notification to supervisory authority | §7 GDPR Personal Data Breach Notification |
| GDPR Art. 34 — Communication to data subjects | §7 GDPR Personal Data Breach Notification |
| ISO 27001 A.5.24 — IS incident management | §5 Response Phases |
| ISO 27001 A.5.26 — Response to IS incidents | §5.2–5.5 Containment through Post-Incident Review |
