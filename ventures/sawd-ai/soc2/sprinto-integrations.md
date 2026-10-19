# SAWD — Sprinto Integrations & Evidence Map

Updated 2026-10-16 for Base44-native architecture.

Which integration to connect in Sprinto, what it auto-verifies, and which TSC criteria that
evidence covers. **Base44 is now the primary subprocessor** — their SOC 2 report is the
single highest-value evidence item. Connecting these is an **owner action** (each needs an
admin OAuth/token from the respective console). Order = highest evidence yield first.

Legend: ✅ ready to connect · ⚠️ connect but a gap will show red until remediated · `owner` action

| # | Integration | Connect via | Auto-checks Sprinto runs | Covers (TSC) | State |
|---|---|---|---|---|---|
| 1 | **GitHub** (org `Tabula-medica`) | GitHub App | Org 2FA enforced, branch protection on main, required status checks, CodeQL/Dependabot enabled, no long-lived PATs | CC6.1, CC8.1, CC7.1 | ✅ Branch protection on sawd-web confirmed. ⚠️ Org 2FA — verify it's on |
| 2 | **GCP** (project `sawd-ai`) | Service-account / org viewer | IAM least-privilege, Secret Manager usage, GCS bucket ACLs, audit logging, GCS lifecycle rules | CC6.3, CC6.7, C1.2 | ⚠️ Secret Manager migration pending (P0 #2) |
| 3 | **Google Workspace** | Admin OAuth | 2SV enforcement, admin-role inventory, account suspension on offboarding | CC6.1, CC6.2, CC6.3 | ✅ (verify 2SV policy is enforced, not just offered) |
| 4 | **Cloudflare** | API token (scoped) | WAF on, TLS/HSTS, DNSSEC, rate-limiting rules, certificate status | CC6.6, CC6.7, A1.1 | ✅ sawd.ai + sawd-web both behind Cloudflare |
| 5 | **Sentry** | API token | Error rate, unhandled exceptions, performance | CC2.1, CC7.2 | ✅ DSN configured in Base44 Secrets (2026-10-16) — connect once events are flowing |
| 6 | **Endpoint / MDM agent** (Sprinto agent on founder laptop) | Install agent | Disk encryption, screen-lock, OS patch level, antivirus | CC6.1, CC6.7, CC6.8 | `owner` — install on all devices |

## Integrations NOT applicable (Base44-native)

| Old integration | Why removed |
|---|---|
| Firebase Hosting | Replaced by Base44 hosting for the app; sawd-web on Cloudflare Pages |
| Cloud SQL backups | Replaced by Base44-managed DB; evidence = Base44 DPA/SLA (manual upload) |
| GCP `sawd-app-2026` (GCIP project) | Parked — Base44 platform auth replaced GCIP |
| Cloud Run metrics | Parked sawd-backend; Base44 functions replaced it |

## Evidence Sprinto CANNOT auto-collect (manual upload / task)

These become recurring evidence tasks uploaded directly into Sprinto:

| Evidence item | Covers | P-level | Source |
|---|---|---|---|
| **Base44 SOC 2 Type II report** | CC6.4, CC9.1, CC9.2, A1.2 | **P0** | Email Base44 support |
| **Base44 DPA** | CC9.2, C1.1 | **P0** | Email Base44 support |
| **Base44 backup/HA SLA** | A1.2, CC9.1 | **P0** | Email Base44 support |
| Policies (from `soc2/policies/`) + employee acceptance | CC1.x, CC2.x | P1 | Upload after attorney review |
| Risk register (annual assessment) | CC3.1–3.4 | P1 | Build in Sprinto |
| Pen-test report | CC7.1 | P1 | Schedule via Sprinto auditor network |
| Restore-test record (Base44 checkpoint + GCS) | A1.3 | P1 | Perform + document |
| Vendor DPAs + subprocessor list (Base44, Plaid, Stripe, GCP, Cloudflare, Anthropic, Google AI, HuggingFace, Smarty, Twilio) | CC9.2 | P0 | Owner collects |
| Security-awareness training completion | CC1.4 | P1 | Sprinto training module |
| `AuditLog` entity samples (live data) | CC7.2/7.3 | P1 | Export from Base44 |
| IRS e-file config status (`efileTransmit` status endpoint) | C1.1 | P1 | Run `action=status` call as admin |
| §7216 consent + WISP + breach-notification matrix (counsel) | C1.1, Confidentiality | Counsel | `ventures/COUNSEL-ENGAGEMENT.md` |

## Recommended connect order

1. **GitHub** first — branch protection + CodeQL/Dependabot are already green → quick win that shows Sprinto controls are operating.
2. **Google Workspace** — 2SV verification.
3. **Cloudflare** — TLS/WAF/HSTS mostly green.
4. **GCP** — connect now, it will show red on Secret Manager until P0 #2 (secrets rotation) done. That's expected.
5. **Sentry** — once you've confirmed events are flowing from the production app.
6. **MDM agent** — install on founder laptop.

**Do not connect integrations expecting green badges everywhere.** Red findings during readiness are the punch list — that's the point. The only rule: don't attest or publish a policy you haven't met.

## Fastest path to Type I

1. Email Base44 for SOC 2 report + DPA + backup SLA (P0 — unblocks 4 criteria instantly).
2. Execute secret-rotation runbook (P0 — closes C1.2 + CC6.7).
3. Enable Base44 platform mandatory MFA (P0 — closes CC6.1).
4. Connect GitHub + Cloudflare + Workspace integrations in Sprinto.
5. Adopt 16-policy pack after attorney review.
6. Let Sprinto continuous checks run green for the window → book Type I auditor.
