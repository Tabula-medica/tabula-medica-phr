# Sprinto Onboarding Checklist (paste-ready)

Work top to bottom. Connect integrations AFTER the P0 remediations (steps 1–4 in README §4) so the
continuous checks flip green instead of red. Each line notes what it proves. Full detail in
`sprinto-integrations.md` and `control-matrix.md`.

## A. Company setup (in Sprinto)
- [ ] Create the SAWD entity; set framework = **SOC 2**, criteria = **Security + Availability + Confidentiality**.
- [ ] Add team members + roles; designate the **Qualified Individual / security owner** (GLBA + CC1).
- [ ] Set the audit window target: **Type I** first, then **Type II** (~3-month observation).

## B. Connect integrations (owner OAuth/token each)
- [ ] **GCP** (projects `sawd-ai` + `sawd-app-2026`) → encryption-at-rest, IAM least-privilege + MFA, backups, audit logging. *(⚠️ shows red until secrets #1, MFA #4, backups #5 done.)*
- [ ] **GitHub** (org `Tabula-medica`) → org 2FA, branch protection, required checks, CodeQL/Dependabot. *(⚠️ red until branch-protection #3 + org 2FA.)*
- [ ] **Google Workspace** → 2SV enforcement, admin inventory, offboarding.
- [ ] **Cloudflare** → WAF, TLS/HSTS, DNSSEC, rate-limiting. *(mostly green already.)*
- [ ] **Firebase Hosting** → security headers, HTTPS-only. *(green already.)*
- [ ] **Endpoint/MDM agent** on every team laptop → disk encryption, screen-lock, patch level.

## C. Adopt policies (upload from `soc2/policies/`)
- [ ] Upload all 16 policies + README. Have **counsel review first** (they're marked DRAFT).
- [ ] Publish each; assign to the team for **acceptance** (Sprinto tracks sign-off = CC1/CC2 evidence).

## D. Manual evidence to upload (Sprinto can't auto-collect these)
- [ ] Risk register (annual risk assessment) — CC3.
- [ ] Pen-test report — CC7.1.
- [ ] Restore-test record (from `setup-cloudsql-backups.sh`) — A1.3.
- [ ] Vendor DPAs + subprocessor list (Base44, Plaid, Stripe, GCP, Cloudflare, Anthropic, Google) — CC9.2.
- [ ] Security-awareness training completion + background-check attestations — CC1.4.
- [ ] §7216 consent, WISP, breach-notification matrix (counsel-signed) — Confidentiality/Privacy.
- [ ] `audit_log` samples once `feat/audit-log-writer` is deployed — CC7.2/7.3.

## E. Before you tell Sprinto "ready for audit"
- [ ] Every P0 in README §4 is Met (not just planned).
- [ ] No published policy asserts a control you don't actually meet.
- [ ] No "MFA everywhere" attestation submitted to Plaid/Stripe until MFA is truly enforced.
- [ ] All continuous checks green over the observation window → book the Sprinto-partnered auditor.
