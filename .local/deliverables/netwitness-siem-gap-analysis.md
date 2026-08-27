# NetWitness Healthcare SIEM Checklist — Detection & Response Gap Analysis

**Prepared:** 2026-08-27
**Scope:** TM (`tabulamedica.health`), UI (`uninsurance.care`), SAWD (`sawd.ai`) — per the site
convention in `three-site-compliance-matrix.md`
**Source:** NetWitness "Protect Patient Care From Cyberattacks" landing page
(Demand Gen — 2026-08-11 SIEM Checklist campaign)

> **Source caveat — read before treating §1 as authoritative.**
> `www.netwitness.com` is blocked by this environment's network egress proxy, so the
> gated LP/PDF could not be retrieved directly. The checklist in §1 was reconstructed
> from NetWitness's public healthcare and SIEM material (NDR module page, healthcare
> data-breach glossary, SIEM-integrations guide) and cross-checked against
> HIPAA §164.308(a)(1)(ii)(D) (information system activity review), §164.312(b)
> (audit controls), and §164.316(b)(2)(i) (6-year documentation retention).
> **Follow-up:** whoever has browser access should pull the actual gated PDF and diff
> it against §1. The findings in §2 are derived from our own code and infrastructure,
> not from the vendor asset, so they stand regardless of how that diff lands.

---

## 0 · TL;DR

Tabula Medica has the **collection** half of a SIEM story built and mounted. It has
almost none of the **detection** half, and one collection-side wiring defect quietly
voids the HIPAA retention control we believe we have.

The pattern mirrors `hipaa-audit-dashboard-gap-analysis.md`: the surface area looks
far more complete than the operational reality. There, the gap was consolidation.
Here, the gap is that **nothing is watching the logs, and the longest-retention
bucket never receives them.**

| # | Finding | Severity |
|---|---|---|
| **NW-1** | PHI-access audit entries are written with `resource.type = "global"`, which the 6-year HIPAA log sink filter cannot match. Our longest-retention audit evidence is landing in `_Default` (30 days). | 🔴 |
| **NW-2** | Zero GCP alert policies, log-based metrics, or notification channels exist anywhere in `terraform/`. No log event, including `break-glass`, produces a page, an email, or a ticket. | 🔴 |
| **NW-3** | The "security posture" / "automated alerting" / "audit trail" services are per-instance in-memory Maps seeded with **fabricated** detection telemetry (`truePositives: 89`, `effectivenessScore: 0.94`). Rendered on a compliance dashboard, this is a due-diligence hazard. | 🔴 |
| **NW-4** | Rate limiting uses `express-rate-limit`'s default MemoryStore across up to 10 Cloud Run instances, and `trust proxy` is set only inside `setupAuth()`. Effective limits are unenforceable and unmeasured. | 🟡 |
| **NW-5** | `auditAccessLogger` (audit-of-audit, HITRUST 06.k) is implemented and mounted on exactly one router out of ~17 audit-exposing route modules. | 🟡 |
| **NW-6** | `terraform/` is referenced by no deploy path (`cloudbuild.yaml`, `deploy.sh`, `deploy-world.sh` all call `gcloud run deploy` directly). We cannot assert from this repo that the audit sink, the VPC-SC perimeter, or the KMS keyring are actually applied in production. | 🔴 (verify) |
| **NW-7** | `osv-scanner.toml` is configured but no workflow runs it. `.github/workflows/` contains exactly one job (`phi-ai-guard.yml`). | 🟡 |

**Purchasing recommendation up front:** do **not** buy NetWitness, or any SIEM
product, off the back of this checklist. At TM's current scale every unmet item
below is closed by GCP-native log-based metrics plus alert policies — configuration
we already have the Terraform for, at roughly zero incremental license cost. The LP
is a demand-gen asset aimed at hospital-system SOC budgets. Revisit a commercial
SIEM/NDR only if TM takes on a hospital customer whose BAA or security questionnaire
names one. See §4.

---

## 1 · Checklist → current state

Checklist items are grouped as NetWitness frames them for healthcare buyers:
central collection, continuous monitoring, PHI-access alerting, ransomware and
behavioral detection, insider threat, third-party risk, and compliance reporting.

| # | Checklist item | Current state | Verdict |
|---|---|---|---|
| 1 | **Central log collection across the estate** | `gcpAuditMiddleware` is mounted globally (`server/index.ts:173`) and writes every request to three Cloud Logging streams — `tabula-medica-audit`, `tabula-medica-phi-access`, `tabula-medica-security` — with actor extraction, risk classification, and PHI-field redaction (`server/security/gcp-audit-logger.ts`). A second path, `secureLog`, writes to `tabula-medica-app-log` (`server/config/logging.ts`). Pino structured logging redacts PHI by field name derived from `phi-column-map.ts` (`server/lib/logger.ts`). | ✅ **Built, and genuinely good.** Better than most products at this stage. |
| 2 | **Logs retained for the regulatory window (6 yr)** | `google_logging_project_bucket_config.hipaa_audit_bucket` with `retention_days = 2190` and `google_logging_project_sink.audit_sink` exist (`terraform/main.tf:389–402`). | 🔴 **Defective — see NW-1.** The sink filter cannot match the entries the app writes. |
| 3 | **24/7 monitoring / SOC** | No alert policies, no log-based metrics, no notification channels, no on-call rotation, no third-party SOC. | 🔴 **Unmet — NW-2.** |
| 4 | **Alerts on patient-data (ePHI) access anomalies** | `classifyRiskLevel()` already labels `break-glass`, `emergency-access`, bulk export, and PHI mutations as `high`/`critical`, and stamps `phi_access` / `risk_level` as log labels — the exact fields an alert policy would filter on. Nothing consumes them. | 🔴 **Unmet — NW-2.** The hard part is done; the last mile is missing. |
| 5 | **Ransomware / malware detection** | None in-app. Delegated to GCP platform controls. DB backup retention is a Terraform *variable* (`backup_retention_days`) with no resource consuming it; no documented restore drill. | 🟡 **Out of app scope, but the recovery half is unevidenced.** |
| 6 | **Behavioral / anomaly detection** | Rules exist as data: `ai-security-posture.ts` defines `failed_auth_attempts > 5 / 10min` and `geo_anomaly` triggers; `ai-compliance-monitoring.ts` defines a failed-login rule. All live in in-memory `Map`s alongside seeded metrics. | 🔴 **Demo, not detection — NW-3.** |
| 7 | **Insider-threat / audit-of-audit** | `auditAccessLogger` writes one `audit_access_log` row per audit-surface read, correctly implemented per HITRUST 06.k / SOC2 CC7.2. Mounted on `my-audit-trail-routes.ts` only. | 🟡 **Partial — NW-5.** |
| 8 | **Credential-attack containment (phishing → account takeover)** | Real limiters exist and are mounted: global API 200/min (`server/index.ts:188`), password reset/forgot 3/hr (`applyAuthRateLimiting`, `server/index.ts:189`). Interactive sign-in and MFA are delegated to GCIP, which `compliance-validator.ts:319` documents honestly. | 🟡 **Real, but unenforceable at scale — NW-4.** |
| 9 | **Third-party / supply-chain risk** | Dependabot configured (`.github/dependabot.yml`); 40 alerts cleared in `8393fae`; npm overrides in place; `osv-scanner.toml` configured. No CI job runs osv-scanner. `phi-ai-guard.yml` blocks non-BAA AI endpoints — a genuinely good supply-chain control, and the only automated one. | 🟡 **Partial — NW-7.** |
| 10 | **Compliance reporting / evidence export** | Extensive: ~17 audit/compliance route modules, 50 admin pages, WORM hash-chain service, `audit_export_requests`. Per `hipaa-audit-dashboard-gap-analysis.md`, ~70% built but fragmented. | ✅/🟡 **Covered by the existing audit-dashboard workstream.** Not re-scoped here. |

---

## 2 · Findings

### NW-1 — The 6-year audit sink cannot match our audit logs 🔴

`server/security/gcp-audit-logger.ts:118` sets an explicit monitored resource on
every entry it writes:

```ts
const metadata = {
  resource: { type: "global" },   // ← line 118
  severity,
  labels: { app: "tabula-medica", environment: ..., risk_level: ..., phi_access: ... },
};
```

`terraform/main.tf:400` routes to the 6-year bucket with:

```
resource.type="cloud_run_revision" OR resource.type="healthcare_dataset"
  OR resource.type="gce_instance"
  OR protoPayload.@type="type.googleapis.com/google.cloud.audit.AuditLog"
```

`global` matches no clause. These are `jsonPayload` entries, so the `protoPayload`
clause does not match either. **Every entry on the `tabula-medica-phi-access`
stream — our §164.312(b) audit trail — is excluded from the HIPAA bucket** and
falls to `_Default`, whose retention is 30 days.

The failure is silent and inverted from the usual case: writing the resource
explicitly is what *breaks* it. `@google-cloud/logging` auto-detects the monitored
resource when `metadata.resource` is omitted, which on Cloud Run yields
`cloud_run_revision` — matching the sink's first clause. `secureLog` in
`server/config/logging.ts` omits it and is therefore captured correctly. The
hand-written override in the security logger defeats the detection that would have
made it work.

Two candidate fixes, in preference order:

1. **Drop the override** — delete `resource: { type: "global" }` from the metadata
   object and let auto-detection supply `cloud_run_revision`. One-line change,
   restores sink matching for all three streams.
2. **Widen the sink filter** — add `OR logName=~"tabula-medica-(audit|phi-access|security)"`
   to `terraform/main.tf:400`. Belt-and-braces; worth doing regardless, because it
   pins retention to log name rather than to a resource type that can shift under us
   on a platform migration.

Do **both**. Fix 1 alone re-breaks if anything moves off Cloud Run; fix 2 alone
leaves a landmine for the next person who reads line 118 and assumes it is load-bearing.

**Not applied in this change.** The correct fix depends on facts this repo cannot
settle — whether the Terraform is applied at all (NW-6), and what is currently
landing in each bucket. Changing production log routing blind is exactly the kind
of edit that should be made with a `gcloud logging read` in the other window.
Filed as **AH-1**.

### NW-2 — Nothing alerts on anything 🔴

`grep -nE "google_monitoring|logging_metric|notification_channel|alert_policy" terraform/*.tf`
returns nothing. There are no log-based metrics, no alert policies, and no
notification channels in the repo. Combined with NW-3, the operational reality is:

**No condition in this system — not a break-glass PHI access, not a bulk export,
not 500 failed logins — currently causes a human being to be notified.**

This is the single largest delta against every framing of the vendor checklist, and
against §164.308(a)(1)(ii)(D), which requires *regular review* of activity records,
not merely their creation.

The mitigating detail is that the expensive groundwork is already done.
`classifyRiskLevel()` (`gcp-audit-logger.ts`) already emits `risk_level` and
`phi_access` as indexed log labels, and already escalates break-glass and
emergency-access paths to `critical`. Standing up log-based metrics over those two
labels plus a handful of alert policies is a half-session of Terraform, not a
detection-engineering program. Filed as **AH-2**.

### NW-3 — Seeded demo telemetry inside compliance-facing services 🔴

`server/services/ai-security-posture.ts:208–214` holds all state in `Map`s. Its
seeded control objects carry invented operating statistics — from the
`control-002` block at ~line 437:

```ts
learningData: { totalEvents: 8540, truePositives: 89, falsePositives: 23,
                trueNegatives: 8400, falseNegatives: 28, adaptationCount: 5, ... },
effectivenessScore: 0.79,
```

The same shape recurs in `automated-alerting.ts:32–36`,
`comprehensive-audit-trail-service.ts:153–154`, `security-posture-engine.ts:225–228`,
`worm-audit-log-service.ts:55`, and `audit-events.ts:25`.

Two distinct problems, and the second is the serious one:

1. **Operational.** Per-instance `Map`s on Cloud Run (`min 1, max 10`,
   `concurrency 160` per `deploy.sh:63–66`) mean threshold counters are sharded
   across instances and erased on scale-down. A "5 failed auths in 10 minutes" rule
   cannot reliably fire even if something were consuming it.

2. **Governance.** These numbers are fabricated, and per
   `hipaa-audit-dashboard-gap-analysis.md` the pages that render them
   (`compliance-dashboard`, `compliance-alerts-dashboard`, `incident-dashboard`)
   are mounted. A prospective hospital customer, an auditor, or a BAA
   counterparty walking a demo would reasonably read "effectiveness score 0.94"
   as a measurement. It is a literal. Nothing in the UI distinguishes it.

The remediation is not "make these services real" — that is the SIEM build we are
explicitly declining. It is: **label them, or unmount them.** Either gate every
seeded surface behind an unmistakable non-production banner, or take them off the
production router and keep them as fixtures. `threat_model.md` already flags this
class of surface under its "Seeded/sample data warning". Filed as **AH-3**, and it
is the item to do first — it is cheap, and it is the one with legal exposure.

### NW-4 — Rate limits are per-instance and IP-resolution is conditional 🟡

`server/security/api-protection.ts` constructs four limiters with no `store`
option, so each uses `express-rate-limit`'s default MemoryStore. Across up to 10
Cloud Run instances the effective global ceiling is ~10× the configured value, and
an attacker spreading connections gets that multiplier for free. There is no
Redis or Memcached dependency in `package.json`.

Separately, `app.set("trust proxy", 1)` appears exactly once
(`server/replit_integrations/auth/replitAuth.ts:204`), inside `setupAuth()`, which
is invoked from `server/routes.ts:813` under a `Promise.race` timeout. If that path
is skipped, times out, or is retired in favour of the GCIP flow, Express falls back
to the socket peer address — the Google front-end — and **every user shares one
rate-limit bucket**. That fails toward self-inflicted denial of service, not toward
permissiveness, which is the safer direction but is still an outage waiting for a
traffic spike. `validate: { xForwardedForHeader: false }` disables the library's own
warning about precisely this misconfiguration.

Note that `compliance-validator.ts:319` reports Rate Limiting as `status: "pass"`.
That claim is accurate about what is configured and silent about whether it is
enforceable in a multi-instance deployment. Worth a footnote in the validator.

Also dead: `authRateLimiter` and `mfaRateLimiter` are exported and never mounted.
That is defensible — sign-in and MFA are delegated to GCIP, as the validator says —
but they read as active protection to anyone grepping. Delete or comment. Filed as
**AH-4**.

### NW-5 — Audit-of-audit mounted on one router of ~17 🟡

`auditAccessLogger` is well-built and correctly documented against HITRUST 06.k /
SOC2 CC7.2. `grep -rn "auditAccessLogger"` finds exactly one mount:
`server/routes/my-audit-trail-routes.ts:27` — the patient-facing view. The admin
surfaces where insider misuse would actually occur (`audit-logs`,
`audit-visualization`, `audit-export`, `compliance-export`, `clinician-audit-view`,
`admin-analytics`) are unwrapped.

This is the same gap `hipaa-audit-dashboard-gap-analysis.md` recorded as
"`audit_access_log` (audit-of-audit) — **Gap.** Critical for spec compliance." It
has since been half-closed: the middleware now exists. Closing the rest is
`router.use(auditAccessLogger("<surface>"))` per module. Filed as **AH-5**.

### NW-6 — Terraform is unreferenced by any deploy path 🔴 (verify)

`grep -rn "terraform" cloudbuild.yaml deploy.sh deploy-world.sh` returns nothing.
All three deploy paths call `gcloud run deploy` directly. No state backend is
configured in `terraform/`, and no state file is committed.

Everything in §1 that cites `terraform/main.tf` as evidence — the 6-year bucket,
the audit sink, the VPC-SC perimeter, the KMS keyring, the healthcare dataset — is
therefore **an assertion this repository cannot support**. The code may describe
infrastructure that was applied once by hand, applied and since drifted, or never
applied at all.

This one is not a coding task, it is a verification task, and it gates NW-1: there
is no point fixing a sink filter for a sink that does not exist. Filed as **AH-6**,
and it should run before AH-1.

### NW-7 — Configured scanner that never runs 🟡

`osv-scanner.toml` exists, with a thoughtful comment explaining that all previously
ignored vulnerabilities were resolved via overrides. No workflow invokes it;
`grep -rn "osv-scanner" package.json scripts/ .github/` returns nothing.
`.github/workflows/` contains only `phi-ai-guard.yml`.

Dependabot covers known-CVE dependency bumps, so this is a smaller gap than it
first appears — but osv-scanner catches transitive advisories across ecosystems
Dependabot's per-manifest updates can miss, and the config is already written.
Adding the job is minutes. Note that Action Item S ("CI pipeline scaffold") is
already RESOLVED, so there is a pipeline to hang it on. Filed as **AH-7**.

---

## 3 · Cross-project applicability

Per the standing convention in `three-site-compliance-matrix.md`
(**A** = applies today, **C** = conditional, **N/A** = not applicable):

| Finding | TM | UI (Uninsurance) | SAWD | Note |
|---|---|---|---|---|
| NW-1 retention sink | **A** | **C** — applies the moment UI becomes a BA via SMART linking; UI's own logging stack should be checked against the same defect before that switch flips | **TBD** | UI is a separate codebase/deployment. This analysis did **not** inspect it. |
| NW-2 no alerting | **A** | **A** — DMPO member data is PI under WA MHMDA / state breach law regardless of BA status | **C** | Cheapest to solve once, as a shared GCP monitoring workspace. |
| NW-3 seeded demo telemetry | **A** | **C** — only if UI ported any of these services | **C** | Check UI for copies of `ai-security-posture` / `automated-alerting` before it faces a customer. |
| NW-4 per-instance limits | **A** | **A** | **A** | Applies to any Cloud Run service with >1 instance. |
| NW-5 audit-of-audit | **A** | **C** | **N/A** | TM-specific middleware. |
| NW-6 unapplied Terraform | **A** | **TBD** | **TBD** | Ask the same question of every deployment we own. |
| NW-7 osv-scanner in CI | **A** | **A** | **A** | Trivially portable; same config file works. |

**The "for all our projects" read:** NW-2, NW-4, and NW-7 are *policy* items that
should be standardised across TM / UI / SAWD rather than fixed per-repo. NW-1, NW-3,
NW-5, and NW-6 are TM-specific findings that each need the equivalent question asked
independently of UI. This document does not answer them for UI — that repo was not
in scope for this session and is not attached here.

---

## 4 · Recommended posture (and what not to buy)

The checklist is real, the underlying HIPAA obligations are real, and the vendor
conclusion does not follow from either.

**Buy nothing yet.** Every 🔴 above is closed with configuration we already have the
Terraform vocabulary for:

- NW-1 → one deleted line plus one widened filter
- NW-2 → ~6 `google_logging_metric` + `google_monitoring_alert_policy` resources over
  labels the app *already emits*, plus one email/PagerDuty notification channel
- NW-3 → a banner component, or `app.use` deletions
- NW-6 → one `terraform plan` against the live project

Estimated total: **~1.5 sessions**, ~$0/month incremental at TM's log volume (GCP's
free logging allotment is 50 GiB/project/month; the 6-year bucket bills only on
retained volume beyond the free tier).

**When to revisit a commercial SIEM/NDR:** when a hospital or health-system
counterparty's BAA, or a HITRUST r2 certification path, explicitly requires a named
SOC or 24/7 monitored SIEM. At that point the buying question is real, and this
analysis becomes the requirements doc for it — the log streams are already
structured, labelled, and centrally collected, which is the expensive part of any
SIEM onboarding. We would be integrating, not rebuilding.

**What is genuinely good, and should be said out loud** so it does not get
refactored away by someone tidying: the global `gcpAuditMiddleware` with
risk classification and PHI redaction; the `phi-column-map`-derived pino redaction
that cannot drift from the encryption list; and `phi-ai-guard.yml`, which is a
better supply-chain control than most of what the vendor checklist asks for.

---

## 5 · Action items

Filed as **Action Item AH** in `f1-action-items.md` (sub-items AH-1 … AH-7), with
this document as the detailed spec.

**Sequencing rule:**

```
AH-3 (label/unmount seeded telemetry)   ← do first: cheapest, highest exposure
        ↓
AH-6 (verify Terraform actually applied) ← gates AH-1; verification, not code
        ↓
AH-1 (fix audit sink resource mismatch)
        ↓
AH-2 (log-based metrics + alert policies) ← the item that closes the real gap
        ↓
AH-4 / AH-5 / AH-7 (independent, any order)
```

AH-3 leads because it is the only finding with third-party-facing consequences that
does not depend on infrastructure facts we have not yet established. AH-2 is the
item that actually satisfies §164.308(a)(1)(ii)(D); everything before it is
prerequisite, and everything after it is hardening.
