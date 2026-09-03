# Password & Authentication Policy

> **DRAFT — attorney review required.** Internal planning document, not legal advice.

**Owner:** Founder / acting ISO
**Approver:** Founder
**Version:** 0.1 (draft) — **Date:** 2026-09-03
**Review cadence:** Annual, or on material change.

---

## 1. Purpose
Set minimum strength, storage, and multi-factor requirements for authenticating to SAWD systems and for the end-user (taxpayer) authentication SAWD operates via GCIP.

## 2. Scope
All workforce and service credentials for SAWD systems, and the end-user authentication configuration in GCIP (`sawd-app-2026`). Covers passwords, MFA, SSO, API keys/tokens, and session handling.

## 3. Policy Statements
1. **Length & strength (workforce).** Minimum 12 characters (14+ for admin accounts), screened against known-breached password lists (NIST SP 800-63B style). No forced periodic rotation absent evidence of compromise; rotate immediately on suspected compromise.
2. **MFA required.** MFA is required on all workforce accounts that support it; phishing-resistant factors preferred for admins (see Access Control Policy).
   > ⚠️ **GAP TO REMEDIATE:** MFA not yet universally enforced (see Access Control Policy). Not truthfully attestable until enforced and verified.
3. **Password manager.** Workforce members use an approved password manager for all SAWD credentials; passwords are never reused across systems or stored in plaintext/browser-unmanaged locations.
4. **SSO where possible.** Prefer SSO (Google Workspace) to centralize authentication and offboarding for connected SaaS.
5. **No hardcoded credentials.** API keys, tokens, and service-account keys are stored in GCP Secret Manager, scoped narrowly, and rotated on schedule (per Encryption/Key Management and Key Rotation runbook) and on suspected exposure.
   > ⚠️ **GAP TO REMEDIATE:** Confirm no keys/tokens remain in source, config files, or on Desktop (ties to AUP gap).
6. **Service-account & API auth.** Machine identities use least-privilege service accounts or workload identity federation; long-lived downloaded keys are avoided where WIF is available (note existing `sawd-backend-wif`).
7. **End-user (taxpayer) authentication — GCIP.** End-user auth enforces: minimum password strength, email verification, rate limiting / brute-force protection, and support for MFA. Session tokens are short-lived with refresh; the runtime and token GCIP projects must match (see auth-config memory) to prevent auth failures.
8. **Account lockout / throttling.** Repeated failed logins trigger throttling or lockout to resist brute force, on both workforce and end-user auth.
9. **Credential storage.** SAWD never stores end-user passwords itself; authentication is delegated to GCIP, which stores credentials salted/hashed by the identity platform.

## 4. Roles / Responsibilities
- **ISO:** Sets and reviews authentication standards; approves the password manager.
- **Engineering:** Configures GCIP policy, rate limiting, secret storage, and rotation.
- **Workforce members:** Use the password manager and enable MFA.

## 5. SOC 2 Mapping
CC6.1 (logical access — authentication), CC6.6 (authentication for external/boundary access), CC6.7 (credential protection).

## 6. Enforcement
Weak, shared, or hardcoded credentials must be remediated on discovery; repeated violations lead to disciplinary action.

## 7. Review
Reviewed annually (next: 2027-09-03) and on material identity/config change.
