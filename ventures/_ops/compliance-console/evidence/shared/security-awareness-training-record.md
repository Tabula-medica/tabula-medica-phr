# Security Awareness Training Record

**Document ID:** HR-01-TRAINING  
**Version:** 1.0  
**Effective Date:** 2026-09-19  
**Next Review:** 2027-09-19  
**Owner:** Rajiv Aggarwal, Security Officer  
**Classification:** Internal

---

## Control Mapping

| Framework | Control Reference | Requirement |
|---|---|---|
| SOC 2 | CC1.4, CC1.5, CC2.2 | Demonstrates commitment to competence; communicates security responsibilities |
| HIPAA | 164.308(a)(5)(i) | Security awareness and training program |
| HIPAA | 164.308(a)(5)(ii)(A) | Security reminders |
| HIPAA | 164.308(a)(5)(ii)(B) | Protection from malicious software |
| HIPAA | 164.308(a)(5)(ii)(C) | Log-in monitoring |
| HIPAA | 164.308(a)(5)(ii)(D) | Password management training |
| HIPAA | 164.308(a)(1)(ii)(C) | Workforce security — authorization and supervision |
| ISO 27001 | A.6.3 | Information security awareness, education and training |
| ISO 27001 | A.6.6 | Confidentiality or non-disclosure agreements |

---

## 1. Training Program Overview

**Program Name:** Tabula Medica LLC — Annual HIPAA Privacy & Security Training + SOC 2 Security Awareness

**Delivery Method:** Self-administered — documented reading of the Tabula Medica LLC policy pack.  
At current scale (solo founder with no direct employees), a Learning Management System (LMS) is not required. Training is completed by reading each policy document in full and attesting completion below. This approach is appropriate for small organizations and is documented per HIPAA 164.308(a)(5).

**Frequency:** Annual minimum. Ad-hoc re-training is required following any security incident, significant policy change, or regulatory update.

**Policy Pack Location:** `C:/Users/Aggarwal/Desktop/compliance-readiness/policies/`

---

## 2. Curriculum

The following modules comprise the annual training cycle. Each module maps to one or more policy documents.

| Module # | Module Title | Policy Document(s) | Key Topics Covered |
|---|---|---|---|
| M-01 | Information Security Foundations | 00-information-security-policy.md | Security objectives, workforce responsibilities, acceptable use, device security |
| M-02 | Access Control & Identity Management | 01-access-control-and-access-review.md | Least-privilege, MFA requirements, password policy, access review, shared-account prohibition |
| M-03 | Incident Response & Breach Notification | 02-incident-response-and-breach-notification.md | Incident classification, reporting obligations, HIPAA breach notification timelines (60-day), HHS/OCR notification |
| M-04 | Data Classification, Retention & Disposal | 03-data-classification-retention-disposal.md | PHI/PII classification, minimum-necessary principle, retention schedules, secure disposal |
| M-05 | Risk Assessment & Management | 04-risk-assessment-policy-and-method.md | Ongoing risk analysis obligation (HIPAA 164.308(a)(1)), risk register maintenance |
| M-06 | Vendor & Business Associate Management | 05-vendor-and-baa-management.md | BAA requirements, vendor vetting, PHI transmission controls |
| M-07 | Change Management & Secure SDLC | 06-change-management-and-sdlc.md | Code review requirements, branch protection, CI/CD security, no PHI in dev/test |
| M-08 | Business Continuity & Disaster Recovery | 07-business-continuity-and-disaster-recovery.md | RTO/RPO targets, backup verification, failover procedures |
| M-09 | HIPAA Security & Privacy Rule | 08-hipaa-security-and-privacy.md | HIPAA Security Rule administrative/physical/technical safeguards; Privacy Rule minimum-necessary; patient rights |
| M-10 | Encryption & Key Management | 09-encryption-and-key-management.md | Encryption standards (AES-256-GCM, TLS 1.2+), GCP Secret Manager, key rotation, prohibition on plaintext PHI |

**Supplemental Topics Covered Across Modules:**
- Phishing awareness and social engineering prevention
- Malicious software recognition and response
- Login monitoring and anomalous-access recognition
- Password hygiene and MFA enrollment
- Physical safeguards for remote/home-office environments
- HIPAA minimum-necessary principle in all PHI access and disclosure
- Prohibition on sending PHI to AI systems without a BAA (Anthropic = no BAA; Vertex AI only for PHI inference)
- Sanctions for policy violations

---

## 3. Completion Record

| Employee / Contractor | Role | Training Module | Date Completed | Signature / Attestation | Next Due |
|---|---|---|---|---|---|
| Rajiv Aggarwal | Security Officer / Founder / Sole Workforce Member | M-01 Information Security Foundations | 2026-09-19 | /s/ Rajiv Aggarwal | 2027-09-19 |
| Rajiv Aggarwal | Security Officer / Founder / Sole Workforce Member | M-02 Access Control & Identity Management | 2026-09-19 | /s/ Rajiv Aggarwal | 2027-09-19 |
| Rajiv Aggarwal | Security Officer / Founder / Sole Workforce Member | M-03 Incident Response & Breach Notification | 2026-09-19 | /s/ Rajiv Aggarwal | 2027-09-19 |
| Rajiv Aggarwal | Security Officer / Founder / Sole Workforce Member | M-04 Data Classification, Retention & Disposal | 2026-09-19 | /s/ Rajiv Aggarwal | 2027-09-19 |
| Rajiv Aggarwal | Security Officer / Founder / Sole Workforce Member | M-05 Risk Assessment & Management | 2026-09-19 | /s/ Rajiv Aggarwal | 2027-09-19 |
| Rajiv Aggarwal | Security Officer / Founder / Sole Workforce Member | M-06 Vendor & Business Associate Management | 2026-09-19 | /s/ Rajiv Aggarwal | 2027-09-19 |
| Rajiv Aggarwal | Security Officer / Founder / Sole Workforce Member | M-07 Change Management & Secure SDLC | 2026-09-19 | /s/ Rajiv Aggarwal | 2027-09-19 |
| Rajiv Aggarwal | Security Officer / Founder / Sole Workforce Member | M-08 Business Continuity & Disaster Recovery | 2026-09-19 | /s/ Rajiv Aggarwal | 2027-09-19 |
| Rajiv Aggarwal | Security Officer / Founder / Sole Workforce Member | M-09 HIPAA Security & Privacy Rule | 2026-09-19 | /s/ Rajiv Aggarwal | 2027-09-19 |
| Rajiv Aggarwal | Security Officer / Founder / Sole Workforce Member | M-10 Encryption & Key Management | 2026-09-19 | /s/ Rajiv Aggarwal | 2027-09-19 |

**Summary:** 1 of 1 workforce members current. 10 of 10 modules completed. Training cycle complete for FY2026.

---

## 4. Contractor & Vendor Training

All contractors and vendors engaged by Tabula Medica LLC who may have access to systems, confidential data, or PHI are required to:

1. Complete their own organization's security awareness and HIPAA training as part of onboarding (where applicable).
2. Review and sign the Tabula Medica LLC Confidentiality Agreement (see `confidentiality-agreement-template.md`).
3. For Business Associates: provide evidence of their HIPAA training program on request.

Evidence of contractor/vendor training is maintained in vendor onboarding files and available to auditors on request. See `vendor-baa-register.md` per venture for BAA execution status.

---

## 5. Sanctions Policy

**Policy:** Violations of Tabula Medica LLC information security, HIPAA privacy/security, or acceptable use policies by any workforce member or contractor may result in disciplinary action commensurate with the severity and intent of the violation.

**Disciplinary actions include but are not limited to:**
- Verbal or written warning
- Suspension of system access pending investigation
- Mandatory re-training
- Termination of employment or contractor engagement
- Referral to law enforcement for criminal violations
- Civil liability for damages arising from willful neglect

**Regulatory sanctions:** Willful neglect of HIPAA requirements may result in civil monetary penalties of up to $1,900,000 per violation category per year under 45 CFR 164.

This sanctions policy is communicated to all workforce members at time of onboarding and at each annual training cycle.

---

## 6. Training Record Maintenance

Training records are retained for a minimum of six (6) years per HIPAA 164.316(b)(1) and SOC 2 evidence retention requirements. Records are stored at:

- Primary: `C:/Users/Aggarwal/ventures/_ops/compliance-console/evidence/shared/`
- Policy pack (source material): `C:/Users/Aggarwal/Desktop/compliance-readiness/policies/`

---

*Document prepared by: Rajiv Aggarwal, Security Officer*  
*Date: 2026-09-19*  
*Approved by: Rajiv Aggarwal, Founder/CEO, Tabula Medica LLC*
