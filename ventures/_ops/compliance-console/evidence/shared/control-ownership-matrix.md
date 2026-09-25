# Control Ownership Matrix

**Organization:** Tabula Medica LLC / Universal Health Foundation  
**Document ID:** GOV-03-CTRL-OWN-v1.0  
**Date:** 2026-09-19  
**Version:** 1.0  
**Author:** Rajiv Aggarwal  
**Classification:** Internal — Compliance Evidence  
**Frameworks:** SOC 2 (CC1.2, CC1.3, CC2.2) | HIPAA 164.308(a)(2) | ISO 27001 A.5.2, A.5.3  

---

## 1. Purpose

This document establishes the ownership, accountability, and review cadence for every compliance control in the Tabula Medica compliance program. It satisfies the requirement under HIPAA 164.308(a)(2) to identify the Security Official responsible for developing and implementing required policies and procedures, and under SOC 2 CC1.2/CC1.3 to demonstrate that authority and responsibility are assigned.

---

## 2. Security & Privacy Role Assignments

| Role | Name | Email | Effective Date |
|---|---|---|---|
| Security Officer (CISO) | Rajiv Aggarwal | rajiv@tabulamedica.com | 2024-01-01 |
| HIPAA Privacy Officer | Rajiv Aggarwal | rajiv@tabulamedica.com | 2024-01-01 |
| HIPAA Security Officer | Rajiv Aggarwal | rajiv@tabulamedica.com | 2024-01-01 |
| Data Protection Officer (DPO) | Rajiv Aggarwal | rajiv@tabulamedica.com | 2024-01-01 |
| Risk Manager | Rajiv Aggarwal | rajiv@tabulamedica.com | 2024-01-01 |
| Incident Response Lead | Rajiv Aggarwal | rajiv@tabulamedica.com | 2024-01-01 |

**Solo-founder note:** Tabula Medica LLC is a pre-Series-A company with a single technical employee. All control ownership vests in the Security Officer. Vendor- or contractor-managed controls are delegated to the respective vendor with annual review; the Security Officer retains accountability in all cases.

---

## 3. Control Ownership Table

### 3.1 Access Control (AC)

| Control ID | Control Name | Owner | Delegate / Vendor | Review Frequency | SOC 2 Ref | HIPAA Ref | ISO 27001 Ref |
|---|---|---|---|---|---|---|---|
| AC-01 | Identity & Authentication Policy | Rajiv Aggarwal | GCP GCIP (vendor) | Quarterly | CC6.1 | 164.308(a)(5) | A.8.2 |
| AC-02 | Multi-Factor Authentication Enforcement | Rajiv Aggarwal | GCP GCIP (vendor) | Quarterly | CC6.1 | 164.312(d) | A.8.5 |
| AC-03 | Role-Based Access Control | Rajiv Aggarwal | — | Quarterly | CC6.3 | 164.312(a)(1) | A.8.3 |
| AC-04 | Access Review & Recertification | Rajiv Aggarwal | — | Semi-annual | CC6.2 | 164.308(a)(3) | A.8.2 |
| AC-05 | Privileged Access Management | Rajiv Aggarwal | GCP IAM (vendor) | Quarterly | CC6.3 | 164.312(a)(1) | A.8.18 |

### 3.2 AI Governance (AIG)

| Control ID | Control Name | Owner | Delegate / Vendor | Review Frequency | SOC 2 Ref | HIPAA Ref | ISO 27001 Ref |
|---|---|---|---|---|---|---|---|
| AIG-01 | AI Model Inventory | Rajiv Aggarwal | — | Quarterly | CC2.2 | 164.308(a)(1) | A.8.8 |
| AIG-02 | PHI Routing — AI Model Prohibition | Rajiv Aggarwal | Google Vertex AI (vendor) | Quarterly | CC6.1 | 164.308(a)(1) | A.8.24 |
| AIG-03 | AI Model Risk Assessment | Rajiv Aggarwal | — | Annual | CC3.2 | 164.308(a)(1) | A.8.8 |
| AIG-04 | AI Output Monitoring & Audit | Rajiv Aggarwal | — | Semi-annual | CC7.2 | 164.312(b) | A.8.16 |

### 3.3 Availability (AV)

| Control ID | Control Name | Owner | Delegate / Vendor | Review Frequency | SOC 2 Ref | HIPAA Ref | ISO 27001 Ref |
|---|---|---|---|---|---|---|---|
| AV-01 | Business Continuity Plan | Rajiv Aggarwal | — | Annual | A1.1 | 164.308(a)(7) | A.5.29 |
| AV-02 | Backup & Recovery Testing | Rajiv Aggarwal | GCP Cloud SQL (vendor) | Semi-annual | A1.2 | 164.308(a)(7) | A.8.13 |
| AV-03 | Uptime Monitoring & Alerting | Rajiv Aggarwal | GCP Cloud Run (vendor) | Monthly | A1.1 | 164.308(a)(7) | A.8.16 |

### 3.4 Change Management (CM)

| Control ID | Control Name | Owner | Delegate / Vendor | Review Frequency | SOC 2 Ref | HIPAA Ref | ISO 27001 Ref |
|---|---|---|---|---|---|---|---|
| CM-01 | Change Management Policy | Rajiv Aggarwal | — | Annual | CC8.1 | 164.308(a)(1) | A.8.32 |
| CM-02 | CI/CD Pipeline Security Gates | Rajiv Aggarwal | GitHub Actions (vendor) | Quarterly | CC8.1 | 164.312(b) | A.8.25 |
| CM-03 | Dependency & Patch Management | Rajiv Aggarwal | GitHub Dependabot (vendor) | Monthly | CC7.1 | 164.308(a)(5) | A.8.8 |

### 3.5 Data Protection (DP)

| Control ID | Control Name | Owner | Delegate / Vendor | Review Frequency | SOC 2 Ref | HIPAA Ref | ISO 27001 Ref |
|---|---|---|---|---|---|---|---|
| DP-01 | Encryption at Rest | Rajiv Aggarwal | GCP CMEK (vendor) | Annual | CC6.7 | 164.312(a)(2)(iv) | A.8.24 |
| DP-02 | Encryption in Transit (TLS 1.2+) | Rajiv Aggarwal | Cloudflare / GCP (vendor) | Annual | CC6.7 | 164.312(e)(2)(ii) | A.8.24 |
| DP-03 | Data Classification & Retention | Rajiv Aggarwal | — | Annual | CC6.5 | 164.308(a)(4) | A.5.12 |
| DP-04 | Data Disposal & Destruction | Rajiv Aggarwal | GCP (vendor) | Annual | CC6.5 | 164.310(d)(2)(i) | A.8.10 |

### 3.6 Governance (GOV)

| Control ID | Control Name | Owner | Delegate / Vendor | Review Frequency | SOC 2 Ref | HIPAA Ref | ISO 27001 Ref |
|---|---|---|---|---|---|---|---|
| GOV-01 | Information Security Policy | Rajiv Aggarwal | — | Annual | CC1.2 | 164.308(a)(1) | A.5.1 |
| GOV-02 | Risk Assessment & Register | Rajiv Aggarwal | — | Annual | CC3.1 | 164.308(a)(1)(ii)(A) | A.6.1 |
| GOV-03 | Control Ownership Matrix (this document) | Rajiv Aggarwal | — | Annual | CC1.3 | 164.308(a)(2) | A.5.2, A.5.3 |
| GOV-04 | Compliance Monitoring Program | Rajiv Aggarwal | Sprinto (vendor) | Quarterly | CC2.1 | 164.308(a)(1) | A.5.35 |

### 3.7 Human Resources (HR)

| Control ID | Control Name | Owner | Delegate / Vendor | Review Frequency | SOC 2 Ref | HIPAA Ref | ISO 27001 Ref |
|---|---|---|---|---|---|---|---|
| HR-01 | Workforce Security Screening | Rajiv Aggarwal | — | Per hire / Annual | CC1.4 | 164.308(a)(3)(ii)(B) | A.6.1 |
| HR-02 | Security Awareness Training | Rajiv Aggarwal | — | Annual | CC1.4 | 164.308(a)(5) | A.6.3 |
| HR-03 | Termination & Offboarding Procedures | Rajiv Aggarwal | — | Per event | CC6.2 | 164.308(a)(3)(ii)(C) | A.6.5 |

### 3.8 Physical Security (PHY)

| Control ID | Control Name | Owner | Delegate / Vendor | Review Frequency | SOC 2 Ref | HIPAA Ref | ISO 27001 Ref |
|---|---|---|---|---|---|---|---|
| PHY-01 | Physical Access Controls (infrastructure) | Rajiv Aggarwal | GCP Data Centers (vendor) | Annual | CC6.4 | 164.310(a) | A.7.1 |
| PHY-02 | Workstation Security Policy | Rajiv Aggarwal | — | Annual | CC6.4 | 164.310(c) | A.7.8 |

### 3.9 Processing Integrity (PI)

| Control ID | Control Name | Owner | Delegate / Vendor | Review Frequency | SOC 2 Ref | HIPAA Ref | ISO 27001 Ref |
|---|---|---|---|---|---|---|---|
| PI-01 | Input / Output Validation Controls | Rajiv Aggarwal | — | Semi-annual | PI1.1 | 164.312(b) | A.8.28 |
| PI-02 | Audit Logging & Log Integrity | Rajiv Aggarwal | GCP Cloud Logging (vendor) | Quarterly | PI1.2, CC7.2 | 164.312(b) | A.8.15 |

### 3.10 Privacy (PRI)

| Control ID | Control Name | Owner | Delegate / Vendor | Review Frequency | SOC 2 Ref | HIPAA Ref | ISO 27001 Ref |
|---|---|---|---|---|---|---|---|
| PRI-01 | Privacy Notice & Consent Management | Rajiv Aggarwal | — | Annual | P1.1 | 164.520 | A.5.34 |
| PRI-02 | Individual Rights (access/deletion/portability) | Rajiv Aggarwal | — | Per request / Annual | P5.1 | 164.524, 164.528 | A.5.34 |

### 3.11 Security Operations (SEC)

| Control ID | Control Name | Owner | Delegate / Vendor | Review Frequency | SOC 2 Ref | HIPAA Ref | ISO 27001 Ref |
|---|---|---|---|---|---|---|---|
| SEC-01 | Vulnerability Management | Rajiv Aggarwal | GitHub Dependabot (vendor) | Monthly | CC7.1 | 164.308(a)(5) | A.8.8 |
| SEC-02 | Incident Response Plan | Rajiv Aggarwal | — | Annual + per event | CC7.3 | 164.308(a)(6) | A.5.26 |
| SEC-03 | WAF & Network Security Controls | Rajiv Aggarwal | Cloudflare (vendor) | Quarterly | CC6.6 | 164.312(e) | A.8.20 |

### 3.12 Vendor Management (VEN)

| Control ID | Control Name | Owner | Delegate / Vendor | Review Frequency | SOC 2 Ref | HIPAA Ref | ISO 27001 Ref |
|---|---|---|---|---|---|---|---|
| VEN-01 | BAA / DPA Register | Rajiv Aggarwal | — | Annual | CC9.2 | 164.308(b) | A.5.19 |
| VEN-02 | Vendor Risk Assessment | Rajiv Aggarwal | — | Annual | CC9.1 | 164.308(b) | A.5.21 |
| VEN-03 | Third-Party Access Controls | Rajiv Aggarwal | — | Annual | CC6.7 | 164.308(b) | A.5.20 |

---

## 4. Control Coverage by Venture

All controls above apply portfolio-wide. Venture-specific applicability is as follows:

| Venture | AC | AIG | AV | CM | DP | GOV | HR | PHY | PI | PRI | SEC | VEN |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Uninsurance (uninsurance.care) | Full | Full | Full | Full | Full | Full | Full | Vendor | Full | Full | Full | Full |
| PHR (tabula-medica.health) | Full | Full | Full | Full | Full | Full | Full | Vendor | Full | Full | Full | Full |
| WorldEHR (worldehr.com) | Full | Full | Full | Full | Full | Full | Full | Vendor | Full | Full | Full | Full |
| SAWD (sawd.ai) | Full | N/A | Full | Full | Full | Full | Full | Vendor | Full | Full | Full | Full |
| ACO (app.tabulamedicaaco.com) | Full | Full | Full | Full | Full | Full | Full | Vendor | Full | Full | Full | Full |
| Underinsured | Full | N/A | Full | Full | Full | Full | Full | Vendor | Full | Full | Full | Full |
| Cognita | Full | Full | Full | Full | Full | Full | Full | Vendor | Full | Full | Full | Full |
| Attentiva | Full | Full | Full | Full | Full | Full | Full | Vendor | Full | Full | Full | Full |
| LTFM Health | Full | N/A | Full | Full | Full | Full | Full | Vendor | Full | Full | Full | Full |

**PHY = Vendor** for all ventures: all compute infrastructure runs on GCP Cloud Run data centers; Google's SOC 2 / ISO 27001 certifications cover physical controls. Google BAA is signed (GCP org tabulamedica.com, org ID 780509095720).

---

## 5. Delegation & Escalation Policy

1. **Primary owner:** Rajiv Aggarwal holds accountability for all controls. No control is unowned.
2. **Vendor delegation:** Where a vendor (GCP, GitHub, Cloudflare, Sprinto) operates a control on our behalf, the vendor is listed as delegate. The Security Officer reviews vendor compliance evidence (SOC 2 reports, penetration test summaries) at the frequency indicated.
3. **Contractor access:** Any contractor granted system access must complete a background check equivalent (HR-01) and sign a confidentiality agreement before access is provisioned. Access is scoped to the minimum necessary.
4. **Escalation path:** Because there is no second employee, escalation for any control failure goes directly to external counsel (Trevor Anderson, Esq.) for legal matters and to GCP/GitHub support for platform incidents.

---

## 6. Annual Review Record

| Review Date | Reviewer | Changes | Next Review Due |
|---|---|---|---|
| 2026-09-19 | Rajiv Aggarwal | Initial version created | 2027-09-19 |

---

## 7. Sign-off

I, Rajiv Aggarwal, Security Officer of Tabula Medica LLC, attest that:

- All compliance controls listed in this matrix have been reviewed as of 2026-09-19.
- Ownership assignments are accurate and reflect current organizational structure.
- This document will be reviewed no less than annually and upon any material change to roles, systems, or regulatory requirements.

**Signed:** Rajiv Aggarwal  
**Title:** Founder & Security Officer, Tabula Medica LLC  
**Date:** 2026-09-19  
**Email:** rajiv@tabulamedica.com  

---

*Document location: `ventures/_ops/compliance-console/evidence/shared/control-ownership-matrix.md`*  
*This document is exhibit GOV-03 in the Tabula Medica compliance evidence package.*
