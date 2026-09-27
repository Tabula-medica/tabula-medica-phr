# Data Retention and Deletion Schedule — Tabula Medica ACO

**Control:** PRI-03
**Policy ID:** ACO-RET-001
**Effective Date:** 2026-09-27
**Next Review Date:** 2027-09-27
**Owner:** Rajiv Aggarwal, MD, CEO/CISO/HIPAA Security Officer — Tabula Medica LLC
**Approved by:** Rajiv Aggarwal, MD, CEO — 2026-09-27

---

## 1. Purpose

This schedule defines retention periods for data processed by the Tabula Medica ACO platform (GCP project `tabula-medica-bfd3d`), the regulatory basis for each period, and secure deletion methods. The ACO platform processes CMS beneficiary data under HIPAA, CMS MSSP program rules (42 CFR Part 425), and Tabula Medica's BAA with participating practices.

## 2. Governing Legal Obligations

| Obligation | Regulation | Minimum Retention |
|-----------|-----------|-----------------|
| HIPAA Security Rule documentation | 45 CFR 164.316(b)(2)(i) | 6 years from creation or last effective date |
| CMS MSSP records | 42 CFR 425.310 | 10 years from close of each performance year |
| Medical records / PHI | HIPAA + state law (Virginia: 10yr adults) | 6 years minimum; follow state law where longer |
| Beneficiary notification records | HIPAA Breach Notification Rule | 6 years |
| HIPAA breach/incident documentation | HIPAA 164.316(b)(2)(i) | 6 years from incident date |

## 3. Retention Schedule

| Data Category | Classification | Retention Period | Legal Basis | Deletion Method |
|--------------|--------------|-----------------|-------------|-----------------|
| CMS beneficiary roster (MBI, demographics, attribution) | PHI | 10 years from performance year close | 42 CFR 425.310 (CMS MSSP) | Cloud SQL row deletion with audit log; GCS file deletion + versioning purge |
| MSSP quality measure results and submissions | PHI | 10 years from performance year close | 42 CFR 425.310 | Cloud SQL deletion; GCS submission file deletion |
| Claims data and MSSP performance benchmarks | Confidential | 10 years from performance year close | 42 CFR 425.310 | Cloud SQL deletion; GCS file deletion |
| Beneficiary PHI from participating practices | PHI | 6 years (or longer per state law) | HIPAA 164.316; VA 10yr for adults | Cloud SQL deletion; Vertex AI temporary data not persisted |
| ACO participant provider records (NPI, contact, credentialing) | Restricted | 5 years after provider exit | MSSP program requirements | Cloud SQL deletion |
| AI model invocation logs (query metadata, no raw PHI) | Internal | 1 year | HIPAA audit trail | GCP log bucket TTL; Cloud SQL audit table purge job |
| HIPAA Security Rule policy documentation | Internal | 6 years from creation/last effective date | HIPAA 164.316(b)(2)(i) | Secure file deletion from GCS |
| HIPAA breach/incident records | Internal | 6 years from incident | HIPAA 164.316(b)(2)(i) | Secure file deletion |
| Authentication/session logs (GCIP, Cloud Logging) | Internal | 90 days (rolling) | Security monitoring | GCP Log Router auto-expiry; log bucket TTL |
| CMS submission export files (pre-upload drafts) | PHI | Deleted after confirmed CMS HARP upload + 30 days | Data minimization | Secure file deletion from ephemeral storage |
| System and application logs (non-PHI) | Internal | 1 year | Security monitoring | GCP log bucket TTL |

## 4. Deletion Procedures

- **Cloud SQL PHI:** Hard-delete rows; no soft-delete for expired PHI. Confirmation query run post-deletion.
- **GCS objects:** Delete object + purge version history (versioning enabled). Lifecycle rule set for automated expiry where applicable.
- **Vertex AI:** ACO platform does not persist raw beneficiary data in Vertex AI; inference is stateless. Vertex AI training data exclusion confirmed in Google BAA.
- **Backup retention:** Cloud SQL PITR backups retained 7 days; automated backup retained 7 days. Backups containing expired PHI are deleted as part of the rolling backup cycle.

## 5. Annual Review

This schedule is reviewed annually (next: **2027-09-27**) or when CMS MSSP record-keeping requirements change.

---

*Approved by Rajiv Aggarwal, MD, CEO — 2026-09-27*
