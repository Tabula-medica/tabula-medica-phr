# SAWD — Sprinto Integrations & Evidence Map

Which integration to connect in Sprinto, what it auto-verifies, and which TSC criteria that
evidence covers. Connecting these is an **owner action** (each needs an admin OAuth/token from
the respective console). Order = highest evidence yield first.

Legend: ✅ ready to connect · ⚠️ connect but a gap will show red until remediated (see
`README.md` §4) · `owner` action.

| # | Integration | Connect via | Auto-checks Sprinto runs | Covers (TSC) | State |
|---|---|---|---|---|---|
| 1 | **GCP** (project `sawd-ai` + `sawd-app-2026`) | Service-account / org viewer | Cloud SQL encryption-at-rest, IAM least-privilege, **IAM MFA**, bucket ACLs, Secret Manager usage, audit logging, backup config | CC6.1, CC6.2, CC6.3, CC7.1, C1.1, A1.2 | ⚠️ MFA + Secret Manager + backups show red until #1/#2/#5 done |
| 2 | **GitHub** (org) | GitHub App | **Org 2FA enforced**, branch protection, required status checks, CodeQL/Dependabot enabled, no long-lived PATs | CC6.1, CC8.1, CC7.1 | ⚠️ Org 2FA = false, no branch protection today |
| 3 | **Google Workspace** | Admin OAuth | 2SV enforcement, admin-role inventory, account suspension on offboarding, session controls | CC6.1, CC6.2, CC6.3 | ✅ (verify 2SV enforced) |
| 4 | **Cloudflare** | API token (scoped) | WAF on, TLS/HSTS, DNSSEC, PQC TLS posture, rate-limiting rules | CC6.6, CC6.7, A1.1 | ✅ |
| 5 | **Firebase Hosting** | GCP-linked | Security headers (CSP/HSTS present in `sawd-web/firebase.json`), HTTPS-only | CC6.6, CC6.7 | ✅ |
| 6 | **Endpoint / MDM agent** (Sprinto or partner MDM on team laptops) | Install agent | Disk encryption, screen-lock, OS patch level, antivirus, password manager present | CC6.1, CC6.2, CC6.7 | `owner` — install on all devices |
| 7 | **HR / identity source** (Workspace or a HRIS) | OAuth | Joiner-mover-leaver events → access-review + offboarding evidence | CC1.4, CC6.2, CC6.3 | ✅ via Workspace |
| 8 | **Vulnerability / dependency** | GitHub (Dependabot) + npm-audit + CodeQL already in CI | Open high/critical vulns, SLA to remediate | CC7.1 | ⚠️ some deps vuln (inside `@base44/sdk`) |
| 9 | **Cloud SQL backups** | GCP | Automated backups + PITR enabled, retention | A1.2, A1.3, CC9.1 | ⚠️ enable PITR (#5) |

## Evidence Sprinto CANNOT auto-collect (manual upload / task)

These become recurring evidence tasks the owner uploads into Sprinto:

- **Policies** (from `policies/`) + employee acceptance records — CC1.x, CC2.x.
- **Risk register** (annual risk assessment) — CC3.1–3.4.
- **Pen-test report** — CC7.1.
- **Restore-test record** (from the DR test) — A1.3.
- **Vendor DPAs + subprocessor list** (Base44, Plaid, Stripe, GCP, Cloudflare, Anthropic,
  Google) — CC9.2.
- **Security-awareness training completion** — CC1.4.
- **Background-check attestations** — CC1.4.
- **§7216 consent + WISP + breach-notification matrix** (counsel-gated) — Confidentiality/Privacy.
- **Application audit-log samples** — once the `AIActionAuditLog` writer ships (#3) — CC7.2/7.3.

## Recommended connect order

1. GitHub + GCP + Workspace (biggest evidence yield, but expose the MFA/branch-protection/backup
   gaps immediately — connect *after* or *while* remediating so you see red→green).
2. Cloudflare + Firebase (mostly green already — quick wins).
3. MDM agent on devices.
4. Then upload the manual-evidence artifacts as each is produced.

> Connecting an integration before remediating its control just shows red in Sprinto — that's
> fine and expected during readiness; it's the punch list, not a failure. The rule is only:
> don't *attest* or publish a policy claim you haven't met.
