# Encryption & Cryptography Policy

> **DRAFT — attorney review required.** Internal planning document, not legal advice.

**Owner:** Founder / acting ISO
**Approver:** Founder
**Version:** 0.1 (draft) — **Date:** 2026-09-03
**Review cadence:** Annual, or on material change.

---

## 1. Purpose
Define encryption and key-management requirements protecting SAWD data in transit and at rest, and set SAWD's post-quantum cryptography (PQC) forward posture.

## 2. Scope
All SAWD data in transit and at rest, and all cryptographic keys/secrets across Firebase, Cloudflare, Base44, GCP (Cloud Run, Cloud SQL, KMS, Secret Manager), GCIP, mobile, and integrations.

## 3. Policy Statements
1. **Encryption in transit.** All data in transit is encrypted with TLS 1.2+ (prefer TLS 1.3). HTTPS is enforced everywhere (Cloudflare edge, Firebase, APIs); HTTP is redirected. No plaintext transport of Tier 1/2 data.
2. **Encryption at rest.** All Tier 1/2 data is encrypted at rest. GCP-managed encryption (Cloud SQL, Cloud Storage) provides AES-256 at rest; backups are encrypted. Application-layer encryption is applied to the most sensitive fields (e.g., SSN/TIN) where warranted.
   > ⚠️ **GAP TO REMEDIATE:** Confirm at-rest encryption is on for every Tier 1 store — including any Base44-held data and log destinations — and decide whether field-level encryption is required for SSN/TIN. Document the answer.
3. **Approved algorithms.** Use current, non-deprecated algorithms (AES-256, RSA-2048+/ECDSA P-256+, SHA-256+). Deprecated/broken algorithms (MD5, SHA-1, DES, RC4, TLS <1.2) are prohibited.
4. **Key management.** Cryptographic keys and secrets are stored in GCP KMS / Secret Manager — never in source code or on local disk. Keys are access-controlled (least privilege), rotated on schedule per the Key Rotation runbook, and rotated on suspected compromise.
   > ⚠️ **GAP TO REMEDIATE:** Secrets historically on Desktop. Complete migration to Secret Manager/KMS, rotate exposed keys, and confirm no keys remain outside the manager before attesting CC6.1/CC6.7.
5. **Certificate management.** TLS certificates are managed (Cloudflare/Firebase-managed where possible) and monitored for expiry to prevent outages.
6. **Secrets in CI/CD.** Pipeline secrets are injected from a secrets store, masked in logs, and not committed. Secret scanning runs on commits/PRs (Change Management + Vulnerability policies).
7. **Mobile.** The Expo/EAS app uses secure storage for tokens and TLS for all API calls; no secrets are embedded in the client bundle.
8. **Post-quantum roadmap.** SAWD tracks NIST PQC standards (ML-KEM / ML-DSA) and plans a migration path: (a) maintain crypto-agility (avoid hardcoding algorithms), (b) prefer providers/edge (Cloudflare, GCP) that adopt hybrid PQC key exchange for TLS as it becomes available, (c) re-evaluate long-lived encrypted data ("harvest-now, decrypt-later" risk) for Tier 1 data. PQC is a roadmap item, not a current control.
   > ⚠️ **GAP TO REMEDIATE (roadmap, not audit-blocking):** PQC is forward-looking; do not represent PQC protections as currently implemented.

## 4. Roles / Responsibilities
- **ISO / Founder:** Owns crypto standards and the PQC roadmap; approves algorithm exceptions.
- **Engineering:** Implements TLS, at-rest encryption, KMS/Secret Manager, rotation.

## 5. SOC 2 Mapping
CC6.1 (access via encryption), CC6.7 (protection of data in transit/at rest and credentials), supporting C1.1.

## 6. Enforcement
Plaintext transport/storage of Tier 1/2 data or hardcoded keys must be remediated immediately on discovery; repeated violations are disciplinary.

## 7. Review
Reviewed annually (next: 2027-09-03), and when standards (e.g., PQC) or providers change.
