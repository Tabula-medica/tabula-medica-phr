# GCP Shared Responsibility Attestation — Physical Security

**Document ID:** PHY-01-GCP-SRA  
**Version:** 1.0  
**Date:** 2026-09-19  
**Author / Security Officer:** Rajiv Aggarwal (rajiv@tabulamedica.com)  
**Entity:** Tabula Medica LLC  
**GCP Org:** tabulamedica.com (Org ID: 780509095720)  
**GCP BAA Status:** SIGNED  
**Maps to:** SOC 2 CC6.4, CC6.5 · HIPAA 164.310(a)(1), 164.310(a)(2)(ii), 164.312(a)(2)(iii) · ISO 27001 A.7.1, A.7.2, A.7.3, A.7.4, A.7.5, A.7.6, A.7.11, A.7.12

---

## 1. Purpose

This attestation documents the physical security shared responsibility model between
Google Cloud Platform (GCP) and Tabula Medica LLC. It confirms that all production
workloads — including those containing Protected Health Information (PHI) and financial
data — run exclusively on GCP infrastructure, and that physical facility security is
fully delegated to Google.

---

## 2. Scope

**Covered ventures / GCP projects:**

| Venture | GCP Project | PHI |
|---|---|---|
| Uninsurance | uninsurance-care-2026 | low |
| Tabula Medica PHR | united-planet-485003-n7-9f345 | HIGH |
| WorldEHR (omnihealth) | worldehr-app | HIGH |
| SAWD | sawd-app-2026 | none (financial PII) |
| Tabula Medica ACO | tabula-medica-bfd3d | HIGH |
| Underinsured | underinsured-app-2026 | low |
| Tabula Cognita | tabula-cognita-prod | HIGH |
| Tabula Attentiva | tabula-attentiva-phi | HIGH |
| LTFM Health | ltfm-health-2026 | low |

**Infrastructure services in use:** Cloud Run (compute), Cloud SQL Postgres (database),
Cloud Storage (object storage), GCIP (identity), Vertex AI (PHI inference), Secret Manager
(secrets), Cloud Armor / WAF (perimeter), Cloudflare (DNS/WAF for select apps).

---

## 3. Zero On-Premises Statement

**Tabula Medica LLC operates zero on-premises servers.**

All production data processing, storage, and transmission occurs within Google Cloud
data centers. No PHI or regulated data is processed on physical hardware owned or
co-located by Tabula Medica LLC. This eliminates the organization's direct physical
security obligations for server infrastructure.

---

## 4. GCP Physical Security Responsibilities (Google's Obligations)

Under the Google Cloud shared responsibility model and the signed Google BAA, Google is
solely responsible for the following physical and environmental controls:

### 4.1 Data Center Physical Access Controls (ISO 27001 A.7.1, A.7.2, A.7.3)
- Multi-layered perimeter security: security fencing, vehicle barriers, security guards
- Electronic access control with biometric authentication at data center entry points
- Visitor escort requirements and visitor access logging
- Badge-based access for all Google personnel; access limited to need-to-know
- Security camera surveillance throughout facilities
- Intrusion detection systems on all entry and internal sensitive zones

### 4.2 Physical Security Monitoring (ISO 27001 A.7.4)
- 24x7x365 on-site security personnel at all production data centers
- Continuous CCTV monitoring with retention of footage per Google policy
- Real-time alert systems for unauthorized access attempts
- Regular physical security audits conducted by Google and third-party auditors

### 4.3 Secure Areas and Equipment Protection (ISO 27001 A.7.5, A.7.6)
- Servers are housed in locked cages within secure computer rooms
- No physical access to server hardware by Tabula Medica LLC or any tenant
- Equipment is tracked through its lifecycle; decommissioned hardware is destroyed per NIST SP 800-88
- Cryptographic erasure performed on all storage media before reuse or disposal
- Hardware security modules (HSMs) protect cryptographic key material at rest

### 4.4 Environmental Controls — Power (ISO 27001 A.7.11)
- Uninterruptible power supplies (UPS) at all data centers
- Redundant utility feeds with automatic failover
- On-site diesel generators with tested failover capability
- Power distribution designed to N+1 or greater redundancy
- Regular load and failover testing of all power systems

### 4.5 Environmental Controls — Cooling and Climate (ISO 27001 A.7.12)
- Precision cooling systems designed for server-room temperature and humidity ranges
- Redundant cooling units with automatic failover
- Continuous environmental monitoring (temperature, humidity, water leak detection)
- Hot-aisle/cold-aisle containment architecture to maximize efficiency and reliability

### 4.6 Environmental Controls — Fire Suppression
- Pre-action dry-pipe fire suppression systems (FM-200 or equivalent) in server rooms
- Early-warning smoke and heat detection systems
- Integration with building fire alarm and local emergency services
- Fire suppression tested and certified per applicable local codes

### 4.7 Server Hardware Lifecycle
- Google manages all hardware procurement, rack installation, maintenance, and decommission
- Firmware and hardware-level security features enforced by Google (Titan chip, secure boot)
- Hardware faults handled by Google SRE without Tabula Medica LLC involvement
- End-of-life hardware destruction documented and auditable via Google's processes

---

## 5. Tabula Medica LLC Responsibilities (Our Obligations)

Although physical server security is fully delegated to Google, Tabula Medica LLC retains
responsibility for the following controls in the shared responsibility model:

### 5.1 Logical Access Control
- IAM roles and permissions for all GCP projects, managed via GCP IAM
- Principle of least privilege enforced; access reviews conducted quarterly
- Break-glass emergency access procedures documented in the Access Control Policy (01-access-control-and-access-review.md)
- GCIP used for application-level authentication with TOTP MFA

### 5.2 Encryption Key Management
- Customer-managed encryption keys (CMEK) evaluated per project; default Google-managed keys used where CMEK not required
- Application-level encryption for sensitive fields (AES-256-GCM)
- Key rotation schedules documented in Encryption and Key Management Policy (09-encryption-and-key-management.md)
- No PHI encryption keys stored on local workstations

### 5.3 Workstation Security
- All endpoints governed by the Workstation Security Policy (workstation-security-policy.md in this directory)
- Full-disk encryption (BitLocker) required on all development workstations
- No PHI stored locally on any endpoint device

### 5.4 Mobile Device Management
- No company-issued mobile devices at this time
- Personal mobile devices used for MFA only (Google Authenticator / GCIP TOTP)
- PHI access from mobile devices prohibited

### 5.5 Network Security (Application Layer)
- HTTPS enforced for all external endpoints (TLS 1.2+ minimum)
- Cloudflare WAF in front of applicable services (uninsurance.care, underinsured.app)
- Cloud Armor WAF rules applied to GCP load balancers
- VPC Service Controls evaluated for PHI projects

---

## 6. Reference Documentation

- **Google Cloud Security Whitepaper:** https://cloud.google.com/security/overview/whitepaper
- **Google Cloud Compliance Reports (SOC 2 Type II):** https://cloud.google.com/security/compliance/soc-2
- **Google Infrastructure Security Design Overview:** https://cloud.google.com/docs/security/infrastructure/design
- **Google Data Center Physical Security:** https://www.google.com/about/datacenters/security/
- **ISO 27001 Certificate (Google Cloud):** Available via Google Cloud Compliance Reports Manager
- **Google BAA:** Signed under GCP org tabulamedica.com (Org ID 780509095720); effective as of GCP org activation

---

## 7. Attestation

I, Rajiv Aggarwal, Security Officer of Tabula Medica LLC, attest that:

1. All production workloads for the ventures listed in Section 2 run exclusively on Google Cloud Platform infrastructure.
2. Tabula Medica LLC has zero on-premises servers, co-location facilities, or physical hardware that stores or processes PHI or regulated data.
3. The Google BAA is signed and in effect for GCP org tabulamedica.com (Org ID 780509095720), covering all PHI workloads.
4. Google Cloud's physical security controls as described in Section 4 satisfy Tabula Medica LLC's physical safeguard obligations under HIPAA 164.310 and ISO 27001 Annex A clause 7 for server infrastructure.
5. Tabula Medica LLC fulfills the logical and endpoint security obligations described in Section 5.

**Signature:** Rajiv Aggarwal  
**Title:** Security Officer, Tabula Medica LLC  
**Date:** 2026-09-19  
**Next Review Date:** 2027-09-19

---

*This document satisfies evidence requirements for SOC 2 CC6.4 (Physical Access Logical Controls), CC6.5 (Physical Access), HIPAA 164.310(a)(1) Facility Access Controls, 164.310(a)(2)(ii) Facility Security Plan, 164.312(a)(2)(iii) Automatic Logoff (via GCP session management), and ISO 27001 A.7.1–A.7.6, A.7.11, A.7.12.*
