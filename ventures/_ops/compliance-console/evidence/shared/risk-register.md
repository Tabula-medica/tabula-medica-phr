# Risk Register

**Owner:** Rajiv Aggarwal (Security Officer)  
**Last Updated:** 2026-09-20  
**Review Cycle:** Annual + after significant incidents  
**Control Reference:** HIPAA §164.308(a)(1) | SOC 2 CC3.2 | ISO 27001 A.6.1.2 / Clause 6.1

---

## Risk Scoring

**Likelihood:** 1 (Rare) · 2 (Unlikely) · 3 (Possible) · 4 (Likely) · 5 (Almost Certain)  
**Impact:** 1 (Negligible) · 2 (Minor) · 3 (Moderate) · 4 (Major) · 5 (Catastrophic)  
**Inherent Risk Score = Likelihood × Impact**  
**Residual Risk = Score after controls applied**

| ID | Risk | Category | L | I | Inherent | Controls | Residual | Status |
|----|------|----------|---|---|---------|----------|----------|--------|
| R-01 | Unauthorized PHI disclosure via API (broken auth, IDOR) | Security/HIPAA | 3 | 5 | 15 | GCIP TOTP MFA; RBAC; row-level security; branch protection; code review | 6 | Active — monitor |
| R-02 | Committed secret / API key in git repo | Security | 3 | 5 | 15 | Secret Manager; repo scanner; Dependabot; Acceptable Use Policy; branch protection | 4 | Active — 1 prior incident (SA key, resolved 2026-08) |
| R-03 | Business Associate breach (third-party PHI exposure) | Third-Party | 2 | 5 | 10 | BAA requirement; vendor due diligence; vendor monitoring; incident reporting clauses | 6 | Active — Canvas/Metriport BAAs pending |
| R-04 | PHI sent to non-BAA AI provider | HIPAA/AI | 2 | 5 | 10 | Portfolio code rule; PHI-AI-Vertex enforcement in code review; audit signal in compliance console; OpenAI migration P0 | 4 | Active — PHR audio/image on OpenAI (P0 tracked) |
| R-05 | Cloud SQL data corruption or accidental deletion | Availability | 2 | 4 | 8 | Automated daily backups; PITR (7 days); Change Management Policy (schema change approval); test restores | 4 | Active |
| R-06 | GCP project compromise via stolen admin credentials | Security | 2 | 5 | 10 | TOTP MFA on all admin accounts; Workspace 2SV enforcement (pending); Secret rotation schedule; Cloud Audit Logs | 5 | Active — Workspace 2SV not yet enforced (owner gate) |
| R-07 | Ransomware / malware on development workstation | Security | 2 | 4 | 8 | BitLocker; screen lock; workstation policy; no PHI stored locally; credential revocation runbook | 4 | Active |
| R-08 | DDoS / availability attack on public-facing services | Availability | 3 | 3 | 9 | Cloud Armor WAF (uninsurance/underinsured); Cloud Run auto-scaling; GCP DDoS mitigation; WAF expansion in progress | 5 | Active — PHR/EHR WAF scripts ready, DNS cutover pending |
| R-09 | Regulatory non-compliance penalty (HHS OCR audit) | Compliance | 2 | 5 | 10 | HIPAA compliance program; BAA register; training records; incident response; audit logging | 5 | Active — observation window not yet started |
| R-10 | PHI exposed in mobile app logs or crash reports | HIPAA | 2 | 4 | 8 | PHI exclusion from client-side logs (policy + code review); certificate pinning; mobile security hardening (2026-09-18) | 3 | Mitigated |
| R-11 | Insider threat — disgruntled contractor with PHI access | Security | 1 | 5 | 5 | JML process; quarterly access review; minimum-necessary access; GCIP session revocation | 3 | Low — monitored |
| R-12 | AI model incorrect clinical recommendation (SaMD risk) | Safety/Regulatory | 3 | 5 | 15 | HITL mandatory (no autonomous clinical decisions); all AI outputs labeled advisory; Cognita/Attentiva flag-OFF in prod; SaMD counsel pending | 6 | Active — Cognita/Attentiva SaMD counsel gated |
| R-13 | GCP cost overrun / billing spike from misconfigured service | Financial | 3 | 3 | 9 | GCP budget alerts; $1,000 tripwire on openclaw (disabled 2026-09-05); monthly CFO cost review; united-planet billing investigation | 4 | Active — united-planet ~$300-400/mo bleed under investigation |
| R-14 | Open-source dependency with known CVE deployed to prod | Security | 3 | 3 | 9 | Dependabot + auto-fix PRs (31 repos); CodeQL on 4 public repos; Vulnerability Management Policy; SLA enforcement | 4 | Active |
| R-15 | Patient data retained beyond retention period | HIPAA | 2 | 3 | 6 | Retention schedule defined; automated purge not yet implemented; manual review quarterly | 4 | Active — automated purge roadmap item |
| R-16 | MFA bypass via SIM-swap (TOTP SMS fallback) | Security | 1 | 4 | 4 | TOTP authenticator app (not SMS) used for all admin accounts; FIDO2 key upgrade on roadmap | 2 | Low |
| R-17 | GCP service account key exposure (long-lived keys) | Security | 2 | 4 | 8 | Workload Identity Federation preferred; key rotation every 90 days; Secret Manager storage; no keys in git | 3 | Mitigated |
| R-18 | HIPAA breach requiring HHS OCR notification (500+ individuals) | HIPAA | 1 | 5 | 5 | BAA protections; encryption at rest + transit; access controls; incident response plan; breach notification procedure | 3 | Low — no current exposure |
| R-19 | App Store rejection delaying product launch | Business | 3 | 2 | 6 | App Store review checklist; compliance-first design; legal review for health claims; store-specific guidelines consulted | 3 | Active — Katha rejection in progress |
| R-20 | Key person dependency (solo founder) | Business | 3 | 4 | 12 | Emergency access instructions; documented runbooks; cloud-native (no on-prem); automated deployments; Trevor Anderson (legal) relationship | 7 | Active — continuity planning in progress |

---

## Risk Treatment Summary

| Treatment | Count | IDs |
|-----------|-------|-----|
| Mitigate (controls applied) | 18 | R-01 through R-18 |
| Accept (residual risk tolerable, monitored) | 2 | R-19, R-20 |
| Transfer (insure or BAA) | 3 | R-03, R-09, R-18 |
| Avoid (eliminate the activity) | 0 | — |

---

## Top 5 Residual Risks (by score)

| Rank | ID | Risk | Residual | Next Action |
|------|----|------|----------|-------------|
| 1 | R-20 | Solo-founder key person | 7 | Designate emergency contact; document GCP/GitHub recovery by Q4 2026 |
| 2 | R-08 | DDoS on PHR/EHR | 5 | DNS cutover to Cloud Armor WAF scripts (owner gate) |
| 3 | R-06 | Admin credential compromise | 5 | Enforce Workspace 2SV (admin.google.com — owner gate) |
| 4 | R-09 | OCR audit | 5 | Open Sprinto observation window; complete BAA suite |
| 5 | R-12 | AI clinical recommendation | 6 | SaMD regulatory counsel (Trevor + FDA specialist); maintain flag-OFF |

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-09-20 | Initial risk register created; 20 risks identified and scored | Rajiv Aggarwal |

---

*Maintained by: Rajiv Aggarwal — rajiv@tabulamedica.com*
