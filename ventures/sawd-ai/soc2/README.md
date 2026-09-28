# SAWD — SOC 2 Readiness (Sprinto) — Master Plan

**Status:** Readiness in progress. Not audited. Nothing here attests compliance — it is the
package that gets SAWD *to* an audit. **Not legal advice**; counsel + the Sprinto-partnered
auditor own the sign-offs flagged below.

Last updated: 2026-09-03 · Owner: Rajiv (founder) · Prepared by: Claude Code + exec panel

---

## 1. Scope (the calls made — say the word to change any)

| Decision | Choice | Why |
|---|---|---|
| Framework | **SOC 2** via **Sprinto** | Sprinto automates evidence collection + continuous checks and books the auditor. |
| Trust Services Criteria | **Security (CC1–CC9)** + **Availability (A1)** + **Confidentiality (C1)** | Security is mandatory; Availability + Confidentiality fit a platform holding tax + linked-bank data. Processing Integrity / Privacy can layer on later (Privacy overlaps the §7216/GLBA track). |
| Report type sequence | **Readiness → Type I → Type II** | Type I proves controls are *designed* at a point in time; Type II proves they *operated* over a window (typically 3–12 mo). Book Type I once the P0 punch list clears. |
| Observation window (Type II) | Propose **3 months** initial | Shortest credible window; extend later for renewals. |

---

## 2. How Sprinto works (the end-to-end loop we're feeding)

1. **Connect integrations** → Sprinto pulls evidence automatically (GCP, GitHub, Google
   Workspace, Cloudflare, Firebase, endpoint/MDM). See `sprinto-integrations.md`.
2. **Adopt policies** → publish the pack in `policies/`, collect employee acceptance.
3. **Map controls** → Sprinto maps its checks to the TSC; our `control-matrix.md` is the
   crosswalk to SAWD's real implementation + gaps.
4. **Continuous checks** → MFA, encryption, access reviews, vuln scans, backups, logging run
   on a cadence; failures open remediation tasks.
5. **Evidence + audit** → once checks are green over the window, the Sprinto auditor issues
   the report.

Our job before the auditor: **make every check green and every policy true.**

---

## 3. What's prepared in this pack

| Artifact | Path | State |
|---|---|---|
| Policy pack (16 policies + index) | `policies/` | ✅ Drafted (attorney review required before publishing) |
| Control matrix (39 criteria, code-grounded) | `control-matrix.md` | ✅ Drafted — 8 Met / 14 Partial / 13 Gap / 4 Owner-action |
| Sprinto integration + evidence map | `sprinto-integrations.md` | ✅ Drafted |
| Remediation punch list | §4 below | ✅ Consolidated from both reviews |

The technical baseline is genuinely strong (fail-closed GCIP auth, AES-256-GCM Plaid-token
encryption, owner-scoped row isolation, 15-min V4 signed URLs, hardened Firebase CSP/HSTS,
keyless WIF deploys, CodeQL+gitleaks+npm-audit+Dependabot, memory-only sessions + 20-min idle
auto-logout). **The gaps are operational/governance, not the code.**

---

## 4. Remediation punch list (do these before booking Type I)

Legend: 🔧 = code/config I can implement · `owner` = console/org action only the owner can do · ⚖️ = counsel-gated

### P0 — audit blockers
1. **Secrets off local disk.** SA/Firebase/Stripe/OAuth/Plaid keys historically sat plaintext
   on the OneDrive-synced Desktop. → **Rotate every exposed key**, move to GCP Secret
   Manager/KMS, secure-delete originals. `owner` (rotation) + 🔧 (wire Secret Manager refs).
   *CC6.1 / CC6.7 / C1.2 / CC7.1.*
2. **MFA mandatory.** Enforcement code is built and fails closed (`sawd-backend/src/auth.ts`
   `ENFORCE_MFA`, client `MFAEnrollGate`) but it's OFF at the platform layer. → Set GCIP
   `mfa.state = MANDATORY` on sawd-app-2026; **turn GitHub org 2FA requirement ON** (currently
   false); enable Workspace 2SV, Apple/Play, EAS. `owner`. *CC6.1 / CC6.6.*
3. **Application audit log.** ✅ **DONE (code)** — branch `feat/audit-log-writer` in
   `sawd-backend`. `lib/audit.ts` `writeAudit()` now records every entity create/update/delete
   (generic CRUD router) + private-file upload + signed-URL access into the `audit_log` table
   (who/what/when/ip), and never breaks the request on failure. Also closed an integrity hole:
   `AuditLog`/`AIActionAuditLog`/`ClientAuditLog` were client-writable via the generic router —
   now client create/update/delete on those is rejected (403) and the attempt is logged.
   **Remaining:** deploy the branch; add centralized log retention + alerting (SIEM-lite, tied
   to P1 #9); consider DB-level append-only enforcement. 🔧 *CC7.2 / CC7.3.*
4. **Branch protection.** CI gates (CodeQL, `security.yml`, backend `ci.yml`) exist but nothing
   forces them pre-merge; commits land straight on feature branches. → Enable required-checks
   branch protection on all repos + require review. `owner` (GitHub settings) + 🔧 (CODEOWNERS).
   *CC8.1.*
5. **Backups / DR evidence.** Cloud SQL backups/PITR not evidenced (commented in
   `cloudbuild.yaml`); no independent backup of Base44-held data; no restore test. → Enable
   PITR, stand up a Base44 data export/backup, **perform + document a restore test**. 🔧 +
   `owner`. *A1.2 / A1.3 / CC9.1.*

### P1 — needed within the observation window
6. **Independent pen test.** None done. → Schedule one within the Type II window. `owner`.
   *CC7.1.*
7. **Governance records:** risk register (CC3.x), security-awareness training + background
   checks (CC1.4), documented offboarding checklist (CC6.2/6.3), ISMS approval record (CC1.x).
   Policies now exist in `policies/` — these are the *operating evidence* they require.
8. **Vendor risk:** subprocessor register + DPAs for Base44, Plaid, Stripe, GCP, Cloudflare,
   Anthropic/Google AI. `owner` + ⚖️. *CC9.2.*
9. **Logging/monitoring:** centralized log retention + alerting (SIEM-lite) beyond app audit
   log. 🔧 + `owner`. *CC7.1/7.2.*

### Counsel-gated ⚖️
10. §7216/§6713 consent language + versioning; **ZDR confirmation for Vertex + Gemini** in the
    AI data path; GLBA Safeguards / WISP formal adoption; breach-notification matrix in
    `incident-response-policy.md`. Route via `ventures/COUNSEL-ENGAGEMENT.md`.

> ⚠️ **Do not publish an unmet policy assertion in Sprinto, and do not submit "MFA everywhere"
> attestations to Plaid/Stripe, until the underlying control is actually enforced.** Publishing
> an assertion you don't meet manufactures an audit exception.

---

## 5. Suggested sequence

1. **This week (code):** wire the `AIActionAuditLog` writer (#3), add CODEOWNERS + required-check
   config (#4), add Secret Manager references (#1 code side), enable Cloud SQL PITR config (#5).
2. **Owner actions (parallel):** rotate secrets, flip GCIP MFA MANDATORY + GitHub org 2FA,
   connect Sprinto integrations, adopt/publish policies, book pen test.
3. **Counsel:** the ⚖️ items.
4. **Then:** let Sprinto checks run green for the window → book Type I → Type II.

See `control-matrix.md` for criterion-by-criterion current state and `sprinto-integrations.md`
for which integration proves what.
