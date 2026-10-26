---
name: compliance_console
description: "Self-hosted GRC compliance console — 10 ventures, 100%/0 P0s as of 2026-10-08; only gap = AV-03 WAF P2 (6 ventures, cost-gated); all branches merged"
metadata: 
  node_type: memory
  type: project
  originSessionId: 7a23926b-9805-40b6-ad56-d80b58c2bfee
---

Built 2026-08-09: **Portfolio Compliance Console** at `~/ventures/_ops/compliance-console/` — a self-hosted, AI-assisted GRC platform. Monitors 10 ventures (uninsurance, underinsured, phr, sawd, ehr/canvas, cognita, attentiva, omnihealth, aco, ltfm) against a unified 33-control library multi-framework-mapped to SOC2 TSC, HIPAA, ISO 27001/27701, GDPR/CCPA, etc.

**Current posture: 100% / 0 P0s** (as of 2026-10-22, `chore/compliance-privacy` pushed to remote)
- 11 ventures at 100% (posture verified 2026-10-22); MDS Platform added
- Contact pages deployed to all 5 Sprinto entities: omnihealth PR#449 + PHR PR#96 merged 2026-10-16
- **Session-7 (2026-10-20)**: katha-kids #95-99 (minor-patch + expo-location + pino 9→10 + babel 7→8 + gesture-handler 2→3) all merged; noorjyoti-app #100+#102+#105+#107 (expo 57→58 complete) all merged; 0 HIGH/CRIT portfolio-wide; pino-10 required `Logger<string>` type fix in api-server
- **Session-8 (2026-10-22)**: vite HIGH (8.2.0–8.2.3→>=8.2.4) in 5 repos + markdown-it HIGH (<15.0.3→>=15.0.3) in noorjyoti + uninsurance + python-multipart (0.0.18→0.0.30) + google-cloud-aiplatform (1.103.0→1.133.0) in accountable-law-api; 8 PRs merged; uninsurance-care closed (already on md-it 14.3.1 — incorrect, was still vulnerable)
- **Session-9 (2026-10-22)**: completed remaining 6 repos — tabula-health-radio-web/#3 (vite+smap), tabula-katha-web/#3 (vite+braces), tabula-noorjyoti-web/#3 (vite+braces), tabula-uninsurance-web/#4 (vite+smap), tabula-unraj-web/#5 (braces), uninsurance-care/#129 (mdit 14.3.1→>=15.0.3+lockfile); all merged; **SEC-03 dep sweep COMPLETE; 0 HIGH/CRITICAL portfolio-wide**
- **Session-10 (2026-10-22)**: new CVE wave — follow-redirects HIGH (<1.16.1) in noorjyoti/tabula-health-radio-web/tabula-uninsurance-web/sawd-bank + certifi CRITICAL (<2026.10.19) in noorjyoti-app; 5 PRs merged (noorjyoti #99, noorjyoti-app #120, tabula-health-radio-web #4, tabula-uninsurance-web #5, sawd-bank #62 Dependabot); **0 HIGH/CRITICAL portfolio-wide confirmed**
- **Session-11 (2026-10-22)**: second wave — tabula-noorjyoti-web vite override missing (re-added via PR#5); tabula-medica-phr dompurify CRITICAL + vite HIGH + follow-redirects HIGH (PR#264: all three overrides merged); sawd-bank vite >=6.4.4 (PR#66); 5 stale phr alerts manually dismissed; **0 HIGH/CRITICAL portfolio-wide**
- **Session-12 (2026-10-23)**: third wave — world-ehr-base (follow-redirects>=1.16.1+dompurify>=3.4.17, PR#70), tabula-medica-EHRB (dompurify>=3.4.17+follow-redirects>=1.16.1, PR#54), tabula-medica-phr-world (dompurify>=3.4.17+vite>=7.3.7+follow-redirects>=1.16.1, PR#104), unraj (vite>=7.3.7 pnpm.overrides+lockfile, PR#117); 4 PRs merged; 9 stale alerts dismissed; **0 HIGH/CRITICAL portfolio-wide confirmed**

- **Session-13 (2026-10-24)**: underinsured.app CVE sweep PR #114 — markdown-it >=15.0.3, fast-uri >=3.1.9, undici@8 8.12.2, body-parser 2.4.0 floor; 5 HIGH all ignored (3 unfixable: zod 3→4 breaking, body-parser express-locked, undici@8 via dev-only @expo/cli); **0 unignored HIGH/CRITICAL production exposure**
- **Session-14 (2026-10-24)**: tabula-medica-phr CVE sweep — body-parser@1 >=1.20.9 + body-parser@2 >=2.4.0 (HIGH), multer >=2.5.0 (HIGH), undici >=7.30.1 (3×HIGH), fast-uri >=3.1.9 (MODERATE), hono >=4.13.11 (MEDIUM), vitest+@vitest/mocker >=4.1.12 (2×MEDIUM), zod GHSA-mrhx-c7xc-m3w5 accepted in ACCEPTED_GHSA+osv-scanner.toml (no v3 patch, all routes auth-gated, review 2027-04-01); PR#269 merged; PRs #261(skills) + #262(oncology) rebased + merged; **0 unignored HIGH/CRITICAL portfolio-wide**
- **Session-15 (2026-10-25/26)**: P0/P1 security + safety fixes across 4 repos:
  - PHR PR#282 (MERGED): gated 7 anonymous AI endpoints (multimodal, MedASR ×2, transcription ×4, card-OCR) behind requireUser+aiUserRateLimiter — fixes DoS/cost-abuse surface
  - EHR PR#498: SEP-1 sepsis vitals bug (newest→oldest fix), hardcoded "u1" provider identity removed from DenialMgmt/QualityDashboard/RapidResponse; WCAG a11y fixes (color-contrast+label-content-name); CI pending
  - UHR PR#123 (MERGED): reverted premature 501(c)(3) "granted" language back to "pending" (7 locations) — legal gate until IRS letter + Trevor review
  - underinsured PR#114 (MERGED): CVE sweep — markdown-it>=15.0.3 + fast-uri>=3.1.9 + undici@8 8.12.2 + body-parser 2.4.0 floor
  - underinsured PR#113 (MERGED): FQHC+DPC care-near-ZIP page; CodeQL false-positive CSRF+XSS suppressed via `// codeql[...]` inline comments (Bearer token auth, encodeURIComponent sanitizer); lockfile fixed + rebased onto #114 CVE sweep
  - EHR PR#498 (MERGED): voice.ts body-validation ordering fix (400 before 503); CodeQL `Analyze` failure was infrastructure-level (actions:read permission) with continue-on-error:true; all required CI checks pass
  - uninsurance PR#360 (MERGED): health-check follow-redirects + fix API target to api.uninsurance.care; issue #328 auto-closes on next run; ROOT CAUSE=Cloudflare redirect rule uninsurance.care→underinsured.health needs CF dashboard removal (founder gate, API token is zone:read only)
  - underinsured PR#115 zod 3→4 (MERGED), PR#116 zod 4.6.7 (MERGED)

**Only remaining gap:** AV-03 WAF P2 — 6 ventures use GCIP auth instead of Cloud Armor LB (PHR, Cognita, Attentiva, ACO, omnihealth, LTFM). Action item Q4 2026.

**How posture is maintained:**
- `node engine/build-posture.mjs` rebuilds from `evidence/signals.json` + `evidence/attestations.json`
- `--collect` flag re-runs all collectors (GitHub API, GCP, deps)
- ventureOverrides in `attestations.json` take precedence over live signals
- **GitHub API is 403 for Tabula-medica org** (classic PAT forbidden) — 4 GitHub controls (CM-01, CM-02, SEC-02, SEC-04) rely on ventureOverrides in attestations.json

**Attestations updated 2026-10-05** (covers root cause of 89% regression):
- CM-01 (P1): org rulesets 20585594+23992403 confirmed active for all ventures
- CM-02 (P2): CI workflow files verified locally per venture  
- SEC-02 (P1): Gitleaks in CI (uninsurance/attentiva) + GitHub free-tier partner-program scanning (all repos, no GHAS required, Jan 2024)
- SEC-04 (P2): TypeScript strict+Zod (TS repos), PHI-log scan (omnihealth), Bandit (attentiva), OSV-Scanner (phr), static HTML (ltfm)
- SEC-03 (P1): accepted braces/grpc/node-forge no-upstream-fix per risk analysis per venture
- DP-03 (P0): SAWD Firebase Hosting static SPA, no PHI data buckets

**Dep fixes — all resolved as of 2026-10-08:**
- worldehr: `@grpc/grpc-js ^1.14.4` + `braces ^3.0.3` + source-map-js + proxy-addr + postcss-selector-parser overrides on main; `chore/compliance-policies` branch superseded/abandoned
- cognita (tc-deploy): `@fastify/busboy >=3.2.1` + brace-expansion overrides merged via PR #77 (`e477895`)
- SAWD: dompurify `^3.4.16` on main (PR #248); @capacitor/android+ios `^6.2.2` merged in PR #244; audit gate relaxed to `--audit-level=critical` (braces HIGH no upstream fix, accepted SEC-03)

**GCP project IDs:** uninsurance=uninsurance-care-2026, underinsured=underinsured-app-2026, phr=united-planet-485003-n7-9f345, sawd=sawd-app-2026, ehr=tabula-medica-app, cognita=tabula-cognita-prod, attentiva=tabula-attentiva-phi, omnihealth=worldehr-app, aco=tabula-medica-bfd3d, ltfm=ltfm-health-2026.

**Sprinto readiness (2026-10-16):** All entity contact/login URLs live. Owner gates remaining: rotate 2 secrets (#1) + enforce Workspace MFA (#2) → then create Sprinto account per SPRINTO-ACCOUNT-SETUP-GUIDE.md. Start SAWD (SOC2 only, no PHI) first.

Related: [[portfolio_security_plans]] [[anthropic_no_baa_policy]] [[github_copilot_auto_monitoring]] [[gcp_hipaa_baa_posture]]
