# Data Retention & Disposal Schedule — Tabula Medica EHR (Canvas)
_Entity: Tabula Medica EHR (Canvas) · Generated 2026-09-07 · Owner: Security/Privacy · Review: annual_

Satisfies SOC 2 Confidentiality / Privacy (PRI) and HIPAA §164.310(d)(2) (media disposal) + §164.316 (documentation retention).

| Data class | Retention period | Disposal method | Legal / business basis |
|---|---|---|---|
| Patient health records (PHI) | 6 years from last use (or state law if longer) | Crypto-shred + DB purge | HIPAA §164.316 / state medical-record law |
| Consent + authorization records | 6 years | Secure deletion | HIPAA §164.508 / §164.530(j) |
| Accounting-of-disclosures log | 6 years | Automated purge | HIPAA §164.528 |
| Application + access logs | 1 year hot, then delete | Cloud Logging retention policy | SOC 2 CC7.2 / security ops |
| Audit / security event logs | 6 years | Automated purge after period | HIPAA §164.316(b)(2) / SOC 2 |
| CI/CD + source history | Life of project | Repo deletion on sunset | Change-management evidence |
| Backups / snapshots | 35 days PITR + 1 yr archival | Lifecycle auto-expiry | SOC 2 CC9 / availability |
| Membership / contact PII | Duration of relationship + 2 years | DB purge + bucket lifecycle | GDPR/CCPA minimization |
| Marketing / inbound leads | 24 months from last contact | Automated purge | CCPA / CAN-SPAM |

## Disposal controls
- **Crypto-shred**: destroy the data-encryption key so ciphertext is unrecoverable (default for PHI/fPII at rest).
- **DB purge**: scheduled hard-delete jobs past the retention window (no soft-delete tombstones beyond policy).
- **Bucket lifecycle**: GCS object-lifecycle rules enforce expiry automatically.
- Disposal is logged to the audit trail (SOC 2 CC7 / HIPAA §164.312(b)).

## Minimization
Collect only data necessary for the stated purpose; de-identify before any analytics or AI use (PHI-AI is Vertex-only, fail-closed).
