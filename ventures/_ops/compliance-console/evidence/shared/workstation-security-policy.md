# Workstation Security Policy

**Document ID:** PHY-01-WSP  
**Version:** 1.0  
**Date:** 2026-09-19  
**Author / Security Officer:** Rajiv Aggarwal (rajiv@tabulamedica.com)  
**Entity:** Tabula Medica LLC  
**Review Cycle:** Annual  
**Maps to:** SOC 2 CC6.4, CC6.8 · HIPAA 164.310(b), 164.310(c), 164.310(d)(1), 164.312(a)(2)(iii) · ISO 27001 A.8.1, A.6.3, A.8.7

---

## 1. Purpose and Scope

This policy establishes minimum security requirements for all endpoints (workstations,
laptops) used to access Tabula Medica LLC systems, source code, cloud infrastructure,
or administrative consoles.

**Applies to:**
- All devices owned or operated by Tabula Medica LLC personnel
- Currently: Rajiv Aggarwal's personal workstations (Windows 11 Pro)
- Future: any device added to the estate as the team grows

**Out of scope:** GCP cloud infrastructure (governed by the GCP Shared Responsibility
Attestation, PHY-01-GCP-SRA).

---

## 2. Requirements

### 2.1 Full-Disk Encryption

**Requirement:** All workstations must have full-disk encryption enabled at the OS level.

- **Windows:** BitLocker (TPM-backed, AES-256) must be enabled on the system drive and all
  secondary drives that store work files.
- Recovery keys must be stored securely — NOT on the same device. Acceptable locations:
  Microsoft Account recovery key escrow, GCP Secret Manager, or printed and stored in a
  physically secure location.
- Encryption must be verified before any sensitive repository or cloud credential is
  accessed on a new device.

**Current status:** BitLocker is enabled on all active Windows 11 Pro workstations
(confirmed 2026-09-19 by Security Officer self-attestation).

### 2.2 Screen Lock

**Requirement:** Automatic screen lock must engage after no more than **5 minutes** of
inactivity and require a password or PIN to unlock.

- **Windows:** Configured via Settings > Accounts > Sign-in options. Screen saver with
  password-on-resume or dynamic lock is acceptable.
- Manual lock (Win+L) is required when leaving a workstation unattended in any location.

**Current status:** Configured to lock after 5 minutes of inactivity (confirmed
2026-09-19 by Security Officer self-attestation).

### 2.3 Password Manager

**Requirement:** A password manager must be used for all work-related credentials. Passwords
must not be stored in plaintext files, browser autofill without a master password, or
shared documents.

- Unique, randomly generated passwords (minimum 20 characters) required for each service.
- The password manager itself must be protected by a strong master password and MFA.

### 2.4 Multi-Factor Authentication (MFA)

**Requirement:** MFA is mandatory on all accounts that access Tabula Medica LLC systems or
data.

| Account Type | MFA Method Required |
|---|---|
| GCP / Google Workspace | TOTP (Google Authenticator) or hardware key |
| GCIP application admin consoles | TOTP |
| GitHub (Tabula-medica org) | TOTP or hardware key |
| AWS / other cloud (if used) | TOTP |
| Password manager | TOTP or hardware key |
| Apple Developer / App Store Connect | TOTP |
| Cloudflare | TOTP |

- SMS-based MFA is discouraged and prohibited for any account with access to PHI or
  production infrastructure.
- Hardware security keys (FIDO2/WebAuthn, e.g., YubiKey) are the preferred second factor
  for accounts with privileged access.

**Current status:** GCIP MFA (TOTP) enforced for SAWD and all production GCIP tenants.
Google Account MFA enforced on rajiv@tabulamedica.com (confirmed 2026-09-19).

### 2.5 Automatic OS and Application Updates

**Requirement:** The operating system and all installed applications must be configured for
automatic updates. Security patches must be applied within 30 days of release; critical
patches (CVSS >= 9.0) within 7 days.

- **Windows Update:** Windows Update must be set to automatically download and install
  updates. Deferral of feature updates is acceptable; security updates are not deferrable.
- Third-party applications (browsers, Node.js runtimes, code editors, etc.) must be
  updated regularly. Tools such as `winget upgrade --all` or Chocolatey are acceptable
  automated mechanisms.

**Current status:** Windows 11 Pro automatic updates enabled. Active software update
schedule maintained (confirmed 2026-09-19 by Security Officer self-attestation).

### 2.6 No PHI Stored Locally

**Requirement:** No Protected Health Information (PHI) may be stored on local workstation
disks, external drives, or removable media.

- All PHI resides exclusively in GCP Cloud SQL databases and Cloud Storage buckets within
  GCP projects covered by the signed Google BAA.
- Downloads of PHI records for debugging, analysis, or testing are prohibited. Anonymized
  or synthetic data must be used for local development and testing.
- Database connection strings that point to production PHI databases must not be used from
  local workstations; access must go through Cloud SQL Auth Proxy with IAM authentication,
  and such access must be logged and justified.
- If a PHI record is inadvertently downloaded to a local disk, it must be securely deleted
  immediately (using a tool that overwrites the data, e.g., Windows `cipher /w` or
  equivalent) and the incident must be logged in the Incident Response log.

**Current status:** Confirmed — no PHI is stored on any local workstation disk.
All production PHI resides in Cloud SQL under GCP projects covered by the signed
Google BAA (confirmed 2026-09-19 by Security Officer self-attestation).

### 2.7 Separate User Account for Development Work

**Requirement:** Development and administrative work must be performed under a dedicated
user account separate from the primary personal/entertainment user account, where
operationally feasible.

- The development account must not be configured as a local administrator except where
  required for specific tooling. A separate administrator account should be used for
  system-level changes.
- Browser profiles for work (Google, GitHub, GCP) must be kept separate from personal
  browsing to reduce credential cross-contamination risk.

**Current status:** Dedicated Windows user profile and browser profile used for all
Tabula Medica LLC development and cloud console access (confirmed 2026-09-19).

### 2.8 Antivirus / Endpoint Protection

**Requirement:** Microsoft Defender (built into Windows 11) or equivalent endpoint
protection must be enabled and up to date on all workstations.

- Real-time protection must be active; periodic full-system scans must run at least weekly.
- Any detected malware must be treated as a potential security incident and handled per the
  Incident Response and Breach Notification Policy (02-incident-response-and-breach-notification.md).

**Current status:** Microsoft Defender enabled with real-time protection (confirmed
2026-09-19 by Security Officer self-attestation).

### 2.9 Physical Security of Workstations

**Requirement:** Workstations must be physically secured to prevent unauthorized access.

- Workstations must not be left unattended in publicly accessible areas.
- Portable devices (laptops) must be stored in a locked location when not in use.
- Monitors displaying sensitive data must not be visible to unauthorized persons
  (clean desk / screen positioning).

### 2.10 Removable Media

**Requirement:** Use of unencrypted USB drives or other removable media for work-related
data is prohibited. If removable media is required (e.g., for firmware updates), it must
be encrypted and the use must be logged.

---

## 3. Workstation Hardening Checklist

The following checklist must be completed for any new workstation added to the estate,
and verified annually:

| Control | Verification Method | Status (2026-09-19) |
|---|---|---|
| BitLocker full-disk encryption enabled | Settings > System > Encryption (or `manage-bde -status`) | Enabled |
| BitLocker recovery key stored off-device | Check Microsoft Account or GCP Secret Manager | Stored |
| Screen lock timeout <= 5 min | Settings > Accounts > Sign-in options | Configured |
| Password manager installed and in use | Visual inspection | In use |
| MFA on all GCP / GitHub / App Store accounts | Account security settings review | Enforced |
| Windows Update: automatic updates enabled | Settings > Windows Update | Enabled |
| No PHI on local disk | Search/audit for PHI file types (.sql dumps, .csv PHI exports) | Confirmed clear |
| Separate dev browser profile | Browser profile inspection | Configured |
| Microsoft Defender real-time protection ON | Windows Security > Virus & threat protection | Active |
| Workstation physically secured | Physical walkthrough | Verified |

---

## 4. Policy Violations

Violations of this policy must be reported to the Security Officer immediately. Violations
that may have resulted in unauthorized exposure of PHI or regulated data are treated as
potential security incidents and trigger the Incident Response process
(02-incident-response-and-breach-notification.md).

---

## 5. Review and Attestation

This policy is reviewed annually by the Security Officer. The review includes:
1. Re-running the hardening checklist (Section 3) on all active workstations.
2. Updating requirements to reflect changes in the threat landscape or compliance guidance.
3. Re-signing the attestation below.

**Attestation — 2026-09-19**

I, Rajiv Aggarwal, Security Officer of Tabula Medica LLC, attest that:

1. All active workstations in use for Tabula Medica LLC work are Windows 11 Pro with
   BitLocker full-disk encryption enabled.
2. Screen lock is configured to engage within 5 minutes of inactivity on all active workstations.
3. MFA (TOTP) is enforced on all GCIP tenants, the Google Workspace admin account
   (rajiv@tabulamedica.com), and the GitHub Tabula-medica organization.
4. No PHI is stored on any local workstation disk; all PHI resides in GCP Cloud SQL
   under the signed Google BAA.
5. Automatic OS security updates are enabled on all active workstations.
6. Microsoft Defender with real-time protection is active on all active workstations.

**Signature:** Rajiv Aggarwal  
**Title:** Security Officer, Tabula Medica LLC  
**Date:** 2026-09-19  
**Next Review Date:** 2027-09-19

---

*This document satisfies evidence requirements for SOC 2 CC6.4 (Physical Access),
CC6.8 (Malware and Endpoint Controls), HIPAA 164.310(b) Workstation Use,
164.310(c) Workstation Security, 164.310(d)(1) Device and Media Controls,
164.312(a)(2)(iii) Automatic Logoff, and ISO 27001 A.8.1 (User Endpoint Devices),
A.6.3 (Information Security Awareness), A.8.7 (Protection Against Malware).*
