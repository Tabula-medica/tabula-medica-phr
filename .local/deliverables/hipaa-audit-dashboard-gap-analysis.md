# HIPAA Audit Dashboard Spec — Gap Analysis

**Prepared:** April 21, 2026
**Spec source:** `attached_assets/Pasted--HIPAA-Audit-Dashboard-Full-Specification-Type-Producti_1776748646796.txt` (1100 lines)
**Spec status (per author):** "SPEC — not yet built", target 4-6 weeks + attorney review
**Reality on re-verification:** ~70 % already built, but in fragmented form with NO unified console.

---

## 0 · TL;DR

The spec presents the dashboard as a greenfield 4-6 week build. **It is not.** Tabula Medica already has:

- **9+ audit/compliance route modules** mounted at boot (`worm-audit`, `hipaa-compliance`, `compliance-dashboard`, `audit-visualization`, `centralized-logging`, `mfa-compliance`, `soc2-compliance`, `compliance-anomaly`, `audit-trail`, `audit-export`, `clinician-audit`, `fhir-audit`, `ai-audit`, `incident-response`, `compliance-reporting`, `compliance-training`, `audit-log-analyzer`)
- **18+ compliance/audit services** including `worm-audit-log-service` (already implements append-only + hash chain + signature + chain validation per spec §"Tamper resistance"), `audit-events`, `comprehensive-audit-trail-service`, `fhir-audit-service`, `clinician-audit-service`, `clinical-ai-audit-service`, `centralized-logging-compliance-service`, `ai-incident-response`, `ai-compliance-reporting`, `ai-compliance-monitoring`, `mfa-compliance-service`
- **50 admin/audit/compliance pages already in `client/src/pages/`** — including `audit-trail-dashboard`, `audit-visualization`, `audit-logs`, `audit-export`, `compliance-dashboard`, `compliance-reporting`, `compliance-export`, `compliance-alerts-dashboard`, `compliance-training`, `clinical-ai-audit`, `clinician-audit-view`, `communication-audit`, `fhir-audit-dashboard`, `incident-dashboard`, `baa-documentation`, `admin-data-dashboard`, `admin-role-management`, `admin-analytics`, `admin-journey-analytics`
- **Schema:** `audit_log_new`, `audit_export_requests` exist; WORM service writes its own hash-chained ledger

**The real gap is consolidation + governance polish, not new construction.**

---

## 1 · Spec Requirement → Current State Mapping

| Spec area | Spec requirement | Current state | Gap |
|---|---|---|---|
| **Append-only `audit_events`** | New table, hash chain, DB triggers preventing UPDATE/DELETE | `worm-audit-log-service` writes hash-chained entries with `previousHash` + `currentHash` + signature; `audit_log_new` table exists | **Partial.** Hash chain exists in service code but NOT enforced via DB trigger. No `audit_events` table per spec column shape. |
| **`phi_access_logs`** specialized table | Denormalized PHI access view for §164.528 queries | `comprehensive-audit-trail-service`, `fhir-audit-service`, `clinical-ai-audit-service` capture PHI access into existing tables | **Gap.** No single canonical `phi_access_logs` table. Patient-accounting-of-disclosures query would need to UNION across multiple tables. |
| **`secure_messages_audit`** | Separate audit shadow of messaging | `communication-audit` page exists; no dedicated audit shadow table found | **Gap.** Probably already audited via comprehensive audit trail; needs verification. |
| **`form_reviews_audit`** | Form workflow audit | Not surfaced in survey | **Gap (likely).** |
| **`report_generations` + `report_downloads`** | Report metadata + download tracking | `audit_export_requests` table exists; `compliance-reporting` + `audit-export` route + page exist | **Partial.** Has request tracking, no formal `report_downloads` table or KMS-signed PDF output. |
| **`audit_access_log` (audit-of-audit)** | Track every admin audit query | Not visible in survey | **Gap.** Critical for spec compliance. |
| **Append-only DB enforcement** (`prevent_audit_modification` trigger) | Postgres trigger blocking UPDATE/DELETE | Only enforced in service-layer code | **Gap.** A misbehaving migration could still wipe audit rows. |
| **Hash chain** | SHA-256 chain across events | Implemented in `worm-audit-log-service` | ✅ Done |
| **GCP KMS report signing** | Reports cryptographically signed | Not visible | **Gap.** Reports today rely on TLS-in-transit, not output signing. |
| **GCS object lock for 6-yr retention** | Immutable storage | Not visible | **Gap.** |
| **Audit middleware on every PHI API "fail-closed"** | If audit write fails, PHI access blocked | Most PHI routes call audit services in best-effort fashion | **Gap.** Need a single `auditedPhiHandler()` wrapper enforcing fail-closed semantics. |
| **External timestamping escrow** | Daily hash to external service | Not visible | **Gap (Phase 3 in spec, defer).** |

### Surface 1: `admin.tabulamedica.health` (separate subdomain)

| Spec requirement | Current state | Gap |
|---|---|---|
| Separate Cloud Run service | Single service serves everything | **Gap.** Subdomain routing via Cloudflare to same backend is the cheaper alternative. |
| MFA enforcement on admin role | `mfa-compliance-routes` + `mfa-compliance-service` exist | ✅ Likely done; needs config audit |
| IP allowlist (configurable) | Not visible | **Gap.** |
| Stricter session timeout (15 min idle / 8 hr absolute) | Likely default applies | **Gap.** Per-role session policy. |
| Admin role claim (`admin`) on Auth0 | `admin-role-management` page exists | ✅ Done |
| Audit-of-audit logging | Not visible | **Gap.** |

### Surface 2: TM web `/admin` (embedded)

| Spec requirement | Current state | Gap |
|---|---|---|
| Embedded `/admin` panel | 50 pages exist; no single `/admin` index curating them | **Major gap.** Pages exist but no unified IA. User has to know URLs. |
| Dashboard overview KPIs | `admin-data-dashboard`, `admin-analytics`, `compliance-dashboard` (3 separate pages) | **Gap.** Three competing overview pages — needs single canonical "admin home". |
| Recent activity feed | `audit-trail-dashboard` | ✅ Likely done |
| Quick report generation | `compliance-reporting` + `compliance-export` + `audit-export` (3 pages) | ✅ Done but **fragmented**. |
| Report history + re-download | `audit-export` page | ✅ Done |
| Basic log search | `audit-logs`, `audit-visualization` | ✅ Done |

### Surface 3: TM mobile admin tab

| Spec requirement | Current state | Gap |
|---|---|---|
| Read-only mobile admin tab | None in `tabula-medica-mobile/src/screens/` | **Full gap.** New screen pack needed. |
| Active alerts | None | **Gap.** |
| Today's metrics | None | **Gap.** |
| Incidents list (read-only) | None | **Gap.** |
| Biometric-gated entry | Mobile already has biometric | **Reusable.** |

### Reports (10 of 17 needed for Phase 1 MVP)

Spec calls out 17 report types across 5 categories. Existing `compliance-reporting` + `audit-export` + `compliance-export` cover an unknown subset — needs inventory.

| Report ID | Description | Likely current coverage |
|---|---|---|
| R1.1 Accounting of Disclosures | Patient-facing §164.528 | **Gap** — no patient-facing surface |
| R1.2 Patient PHI access log | Patient-facing | **Gap** — no patient-facing surface |
| R1.3 Patient own activity log | Patient-facing | **Gap** — no patient-facing surface |
| R2.1 Workforce PHI access summary | Per-staff member | Likely covered by `clinician-audit-view` |
| R2.2 Unusual access patterns | Anomaly detection | Likely covered by `compliance-anomaly` + `ai-audit-log-analyzer` |
| R2.3 Workforce termination access review | 30 days pre-termination | **Gap** — no termination workflow |
| R3.1 Break-the-glass events | Emergency access | **Gap** — break-glass concept not surfaced |
| R3.2 Failed authentication summary | Auth failures | Likely covered by `mfa-compliance` |
| R3.3 Data export audit | Bulk exports | Covered by `audit-export-requests` + `fhir-export` |
| R3.4 Configuration changes | Settings audit | Likely partial |
| R4.1 HIPAA Security Rule summary | Monthly recap | `hipaa-compliance` page |
| R4.2 Training and workforce compliance | Training records | `compliance-training` page |
| R4.3 BA access report | Per-BA access | `baa-documentation` page |
| R4.4 Security incident report | Period summary | `incident-dashboard` page |
| R4.5 Breach determination log | 4-factor analysis | **Gap** — no breach determination workflow |
| R5.1 Daily PHI access volume | Aggregate metrics | `admin-analytics` |
| R5.2 Message exchange summary | Volume + response time | `communication-audit` |
| R5.3 Form completion rates | Workflow metrics | Likely partial |

### RBAC (6 roles per spec)

| Role | Current state |
|---|---|
| `admin` | ✅ Exists (`admin-role-management`) |
| `privacy_officer` | **Gap** |
| `security_officer` | **Gap** |
| `compliance_viewer` | **Gap** |
| `auditor_external` (time-bounded) | **Gap** — needs auto-expiring role mechanism |
| `patient` (own audit only) | **Gap** — no patient-accessible audit view |

### Alerts & scheduled reports

| Spec | Current state |
|---|---|
| 9 alert types (break-glass, failed-auth spike, bulk access, BAA expiring, chain-break, etc.) | `compliance-alerts-dashboard` exists; coverage of specific triggers unknown |
| 7 scheduled report cadences (daily / weekly / monthly / quarterly / annually) | **Gap** — no scheduler surface visible |
| Alert acknowledgment + escalation | **Gap** |
| SMS via Twilio for HIGH+ | **Gap** — Twilio not in current integrations |

---

## 2 · Re-Scoped Sprint Pack

Rather than treat this as one 4-6 week monolith, the gap analysis decomposes into focused sprints. Hours assume one engineer + reuse of existing infrastructure.

| ID | Title | Tier | Hours | Prereq | Notes |
|---|---|---|---|---|---|
| **H1** | **Unified `/admin` index page** consolidating the 50 scattered admin pages into a navigable IA with search, role-aware menu, KPI strip | Internal-only | 6 | none | Pure frontend; biggest UX win for the time |
| **H2** | **Append-only DB enforcement** — Postgres trigger on `audit_log_new`, `worm_audit_*` tables blocking UPDATE/DELETE; chain-verification cron | Internal | 4 | none | Closes spec §"Tamper resistance" gap; defensive against own bugs |
| **H3** | **`phi_access_logs` consolidated view** — materialized view UNIONing FHIR access, document access, message access; powers patient §164.528 queries | Internal | 8 | H2 | Enables patient-facing reports without new write paths |
| **H4** | **Patient-facing audit surface** — new page at `/my-audit-trail` (Free tier, GDPR/CCPA aligned with `/gdpr`) with R1.1 + R1.2 + R1.3 reports as PDFs | Free | 10 | H3 | Builds on G1 GDPR plumbing already shipped today |
| **H5** | **`audit_access_log` (audit-of-audit)** — middleware on all admin audit endpoints writing who-viewed-what | Internal | 4 | none | Critical compliance gap |
| **H6** | **Auth0 role pack** — privacy_officer, security_officer, compliance_viewer, auditor_external (time-bounded), with permission matrix per spec §RBAC | Internal | 8 | none | Auto-expiring auditor role is the tricky bit |
| **H7** | **Scheduled reports scheduler** — Postgres-backed job table + worker; 7 default cadences from spec; email delivery via existing pipeline | Internal | 12 | H3 | Highest dependency item; needed for OCR readiness |
| **H8** | **Break-the-glass workflow** — UI + API for emergency PHI access with mandatory reason; alert pipeline; R3.1 report | Internal + clinician | 10 | H6 | Distinct from existing access; needs explicit break-glass intent |
| **H9** | **Breach determination workflow** — 4-factor analysis form + R4.5 report | Privacy Officer | 8 | H8 | Required for §164.404-410 compliance posture |
| **H10** | **KMS-signed report output** — wire GCP KMS for PDF/CSV signing; verification CLI | Internal | 6 | H7 | Pre-existing GCP infra makes this small |
| **H11** | **Mobile admin tab** (read-only) — alerts list, today summary, incidents list; biometric-gated; admin-role-only | Internal | 12 | H1 + H6 | Adds a new tab to `tabula-medica-mobile/` |
| **H12** | **`admin.tabulamedica.health` subdomain split** — Cloudflare routing to same backend with stricter WAF + IP allowlist + 15-min session policy | Internal | 6 | H1 + H6 | Infra change; user (Cloudflare) action required |
| **H13** | **External timestamp escrow** (Phase 3 in spec) — daily hash POST to RFC 3161 timestamp service | Internal | 4 | H2 | Lowest priority; defer until OCR audit imminent |

**Total: ~98 hours** (vs spec's 4-6 weeks ≈ 160-240 hours). The savings come from reusing the existing compliance infrastructure rather than rebuilding it.

**Recommended order:** H2 → H5 → H1 → H3 → H4 → H6 → H7 → H10 → H8 → H9 → H11 → H12 → H13.

The first five (H1, H2, H3, H4, H5) are *the* high-value sprint — ~32 h — that closes the spec's most defensible gaps and gives patients a §164.528 self-serve surface (a real compliance gap, not just polish).

---

## 3 · Out of Scope (per spec, deferred)

- Twilio SMS integration for HIGH+ alerts (spec assumes Twilio BAA — TM doesn't currently have one). Email-to-SMS gateway acceptable per spec footnote.
- Penetration test of admin subdomain (external vendor; not engineering work).
- Attorney review of data model + report templates + Risk Analysis update — **must precede any production ship of patient-facing audit surfaces** per spec's "Don't ship Phase 1 without" checklist.
- BAA renegotiation with Mailgun if scheduled reports might mention PHI in subject/body — current Mailgun BAA scope unknown.

---

## 4 · Recommendation

**Do not** start an H-sprint immediately. Three things first:

1. **User decision on attorney review prerequisite** — the spec is explicit that attorney review must precede shipping audit-data-model changes. We can do H1 (pure UX consolidation) and H5 (audit-of-audit middleware) without attorney review since neither changes data semantics. H2-H4 and H8-H9 should wait.
2. **Inventory pass on existing compliance reports** — before building H7's scheduler, we need to list which of the 17 spec report types are already implemented (somewhere in the 18 services). 2-3 hours of dedicated discovery saves a week of duplicate work.
3. **Slot into the comprehensive doc** — add H1, H2, H5 as immediate-actionable sprints alongside the remaining G2 (CCPA) and G4 (Health Coach Chat) gaps. H3-H13 stay in this doc as a roadmap.

If you want, the natural next move is **H1 (unified `/admin` index)** — 6 h, pure frontend, no attorney dependency, and it makes the existing 50-page sprawl actually usable.
