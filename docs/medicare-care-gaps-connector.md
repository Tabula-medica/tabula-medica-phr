# The Medicare care-gaps connector

**Status:** built, seed G-code table (unverified)
**Scope:** the US product; every code and rule named here is Medicare-specific

---

## 1. What this is

A connector that evaluates a Medicare beneficiary against four gaps at once —
the Annual Wellness Visit, the adult vaccine schedule, medication
reconciliation, and the comprehensive care plan that gates CCM/PCM/APCM — and
maps each one to the Medicare HCPCS G-code it corresponds to, where a distinct
G-code exists.

```
POST /api/medicare-care-gaps/evaluate
GET  /api/medicare-care-gaps/rules
```

It exists because those four gaps are exactly the ones a population-health
"gap closure" vendor sells against, and because closing them well is a
connector problem, not a single-rule problem: an AWV gap, a vaccine gap, a
medication-reconciliation deadline, and a care-plan gap are usually evaluated
by four different tools that don't talk to each other, so a practice re-enters
the same patient facts four times and gets four disclaimers instead of one
coherent picture. `server/services/medicare-care-gaps/index.ts` is the one
evaluation.

## 2. Why it should be trusted more than a generic gap-closure vendor, and why not blindly

The generic pitch in this space is "AI finds your care gaps and closes them."
Two things in that sentence are where it goes wrong, and this connector is
built against both:

- **"Finds" can mean "invents."** A vaccine-administration G-code exists for
  influenza (G0008), pneumococcal (G0009), and hepatitis B (G0010). It does
  not exist for Tdap, zoster, or COVID-19 — those are billed under CPT
  vaccine-administration codes. A tool that maps every vaccine gap to *some*
  G-code is asserting a code that is not real. This connector's vaccine rules
  (`vaccine-gap-rules.ts`) return `code: null` for those three and say so in
  the rationale, the same way the RCM and HCC documentation already refuse to
  invent a payer, a table, or a claim this codebase cannot verify.
- **"Closes" implies a claim.** Nothing here bills anything. Every response
  carries `unverifiedRules` and a disclaimer, on the same terms as
  `/api/care-management/evaluate` and `/api/hcc/*`: facts in, candidates out,
  a qualified coder decides what is submitted.

What it should not be trusted to do out of the box: **the G-code table
(`g-code-catalog.ts`) ships as an unverified seed**, exactly like
`CARE_MGMT_RULES_PATH` and `HCC_V28_TABLES_PATH`. The codes themselves (AWV,
vaccine administration, G0506, G8427) are long-standing and low-churn, but
that is a reason the verification burden is small, not a reason to skip it.
Set `MEDICARE_GAPS_CODE_TABLE_PATH` to a table that asserts `verified: true`
and names its source — the current HCPCS release reconciled against the PFS
final rule — before reading any candidate as billable.

## 3. What each category actually checks

| Category | Codes | What "overdue" means | What it does not do |
|---|---|---|---|
| **AWV** | G0438 (initial), G0439 (subsequent) | No AWV on file and ≥12 months since the Part B effective date (G0438); or the last AWV was >12 months ago (G0439) | Does not infer Part B enrollment from age. A missing effective date is a refusal (`missing-enrollment-date`), never a guess. |
| **Vaccine** | G0008 (flu), G0009 (pneumococcal), G0010 (Hep B); no G-code for Tdap/zoster/COVID | Annual for flu and COVID-19; every 10 years for Tdap; one-time adult series for pneumococcal (65+); a 2-dose series with a minimum interval for zoster | Does not treat a single old dose of an annual vaccine as permanently satisfied — see §4. Does not model ACIP's risk-based second pneumococcal dose. |
| **Medication reconciliation** | G8427 (quality-measure attestation); the TCM 14-day requirement (no G-code — a prerequisite for CPT 99495/99496) | No documented medication-list review (G8427); or a post-discharge reconciliation missing or later than 14 days after discharge (TCM) | Never lets a G8427 attestation stand in for the TCM deadline, or vice versa — they are reported as two separate facts. |
| **Care plan** | G0506 | No care plan on file, or one missing a required element | Delegates the element-by-element verdict to `care-management/care-plan.ts`'s `evaluateCarePlan()` rather than re-implementing it — see §5. |

## 4. The bug this connector deliberately does not repeat

`server/services/vaccine-schedule-engine.ts` already tracks immunizations, and
it was the obvious thing to build this on. It was not used, because its
status model is `dosesReceived >= dosesRequired` ⇒ permanently `up_to_date`,
and it hard-codes `dosesRequired: 1` for both influenza and COVID-19. Under
that model a patient's flu shot from five Octobers ago reads as current today.
For a Medicare-focused gap connector — where the annual flu shot and the
updated-formulation COVID-19 dose are two of the highest-volume, most
frequently re-checked gaps — that is not a minor inaccuracy, it is the
connector failing at the thing it exists to do.

`vaccine-gap-rules.ts` is a fresh, interval-based evaluator instead: annual
vaccines (flu, COVID-19) and the decennial Tdap booster are checked against
the time elapsed since the last documented dose, not against a lifetime dose
count. It still sources the adult-vaccine catalog and CVX metadata concept
from the existing engine's schedule data; only the status arithmetic is new.
`tests/medicare-care-gaps.spec.ts` pins this directly — a 13-month-old flu
shot must read `overdue`, not `up_to_date`.

## 5. What is deliberately reused, not rebuilt

- **Care-plan completeness** — `care-management/care-plan.ts`'s
  `evaluateCarePlan()`. This connector's `care-plan-gap-rules.ts` calls it and
  translates the verdict into a gap; it does not re-check the nine plan
  elements itself. Two places disagreeing about the same plan is a worse
  failure mode than one place being briefly out of date.
- **G-code operator-verification pattern** — the same `verified`/`source`
  shape and environment-variable loader as `code-catalog.ts` and
  `hcc-tables.ts`, so an operator who has already set up one verified table
  recognizes the shape of the next one.
- **Route discipline** — `requireClinicStaff`, `noStorePhi`, rate limiting,
  and the restated disclaimer, copied from `care-management-routes.ts`
  verbatim in structure.
- **US-only gating** — the same `TEFCA_ENABLED` switch `hcc-routes.ts` uses to
  keep RAF off non-US deployments. Medicare G-codes have no meaning outside
  the US Medicare program, so the entire `/api/medicare-care-gaps` surface is
  gated the same way, not just one endpoint on it.

What is deliberately **not** touched: `server/care-gaps-service.ts` (USPSTF
screening gaps) is a separate, already-disciplined concern and stays exactly
as it is. `server/services/careGapAnalysis.ts` is an older, LLM-prompt-driven
analyzer; this connector does not route through it and is not a replacement
for it — they can coexist, but new Medicare G-code logic belongs in the
deterministic engine, not the LLM-summary one.

## 6. Limitations, stated rather than buried

- **The G-code table is an unverified seed** until an operator loads one — see §2.
- **Pneumococcal re-vaccination is not modeled.** ACIP allows a second dose in
  specific age/risk scenarios after an initial series; this engine reports
  "a dose is on file," not "no further dose is ever indicated."
- **The zoster series only tracks dose count and the minimum inter-dose
  interval**, not contraindications or immunocompromise-specific ACIP
  variations.
- **The care-plan gap does not itself run CCM/PCM/APCM eligibility.** A
  complete, current care plan is necessary but not sufficient for those
  monthly codes; run `/api/care-management/evaluate` for the actual coding
  decision.
- **No client UI ships with this connector**, matching `/api/hcc/*` and
  `/api/care-management/evaluate` — both are API-only clinician tools in this
  codebase today, and this connector follows the same precedent rather than
  introducing a new UI pattern unasked.
