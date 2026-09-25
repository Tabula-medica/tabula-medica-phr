# AIG-03 Human-in-the-Loop Evidence — Tabula Medica ACO
_Entity: Tabula Medica ACO · Date: 2026-09-19 · Frameworks: SOC 2 PI1.1 / HIPAA §164.312(b) / ISO 42001 Govern-1.2 & Manage-4.1_
_Review cycle: quarterly · Owner: Rajiv Aggarwal (rajiv@tabulamedica.com)_

---

## 1. AI System Description and Purpose

Tabula Medica ACO (`Tabula-medica/aco-platform`, GCP project `tabula-medica-bfd3d`,
`app.tabulamedicaaco.com`) is an AI-assisted ACO management platform supporting the
Medicare Shared Savings Program (MSSP), ACO ID A6092, 65% shared-savings track. AI capabilities:

- **Quality measure calculation assistance** — AI pre-computes candidate numerator/denominator
  populations for MSSP quality measures (e.g., HbA1c control, blood pressure control, colorectal
  cancer screening) from claims and clinical data
- **Beneficiary attribution modeling** — AI generates preliminary attribution assignments based on
  plurality-of-care rules; ACO administrator reviews before submitting to CMS
- **Risk adjustment / RAF scoring drafts** — AI flags beneficiaries with potentially under-coded
  HCC conditions for clinician review and coding audit
- **Care gap prioritization** — AI ranks beneficiaries by estimated care gap impact for outreach
  prioritization
- **Performance narrative drafts** — AI drafts quality improvement narrative sections for ACO
  annual reporting; administrator reviews and edits before submission

All inference uses `gemini-2.5-flash` via **Google Vertex AI** (`tabula-medica-bfd3d`, under the
Tabula Medica / Google Cloud BAA). Currently operating on synthetic data pending full PHI
enablement and BAA exchange with participating practices.

---

## 2. Human Oversight Mechanism

| Layer | Mechanism | Responsible Party |
|---|---|---|
| Quality measure populations | AI-computed populations shown in a review table; ACO quality officer must validate a random sample before finalizing | ACO Quality Officer / Rajiv Aggarwal |
| Beneficiary attribution | AI draft attribution displayed alongside CMS attribution rules; administrator reviews exceptions and overrides individually | ACO Administrator |
| RAF/HCC flags | Flagged beneficiaries presented in a coding audit queue; each requires clinician chart review and explicit accept/reject | Participating practice clinician |
| Submissions to CMS | No AI-generated data is submitted to CMS directly; all submissions are exported via the ACO platform, reviewed, and manually uploaded via the HARP/ACO portal by an authorized ACO executive | ACO Executive (Rajiv Aggarwal) |
| Audit log | All AI invocations, measure computations, and human override actions logged to Cloud SQL audit table | HIPAA audit trail |
| Quarterly review | Security Officer reviews AI computation accuracy on a sample and compares against CMS benchmark data | Rajiv Aggarwal |

### Draft-Only Code Pattern

ACO quality measure results are stored in a `measure_calculation_draft` table with a
`submission_ready = false` column. A separate ACO administrator workflow sets
`submission_ready = true` only after completing the human review checklist in the platform UI:

1. Random-sample validation: administrator confirms at least 5% of beneficiary records in each
   measure numerator/denominator.
2. Attribution exceptions cleared: all AI-flagged attribution anomalies have a human disposition
   (accepted, overridden, or escalated).
3. Executive sign-off: ACO executive attests in the platform that the data is ready for export.

The CMS export function (`POST /reports/cms-export`) enforces a hard check on
`submission_ready = true` for all measures included in the export; otherwise it returns HTTP 409
with a list of unresolved checklist items.

No automated pipeline writes data from `measure_calculation_draft` to the CMS HARP portal. The
export file is produced locally, reviewed, and manually uploaded by the ACO executive. This is a
deliberate architectural decision documented in the ACO platform design spec.

---

## 3. Feature Flag Status

| Feature | Production Default | Notes |
|---|---|---|
| Quality measure calculation | OFF — live with synthetic data only | Requires PHI data agreement with participating practices before enabling on real beneficiary data |
| Beneficiary attribution modeling | OFF — synthetic data only | Same gate as above |
| RAF/HCC audit flagging | OFF | Requires CMS contractor review before live enablement |
| Care gap prioritization | OFF | Flag-gated; requires Security Officer enablement per practice |
| Performance narrative drafts | ON (for draft generation only) | Draft-only; no auto-submission pathway |

All production enablements require:
1. Confirmation that participating practice BAAs are in place.
2. Security Officer sign-off.
3. ACO executive approval recorded in the platform audit log.

---

## 4. PHI Routing — Vertex AI Only

| Constraint | Implementation |
|---|---|
| PHI inference provider | Google Vertex AI exclusively (`us-central1`, project `tabula-medica-bfd3d`) |
| Anthropic / OpenAI PHI block | ACO AI router enforces Vertex-only for all beneficiary-linked data; non-Vertex endpoints are not reachable from the PHI data path |
| CI enforcement | GitHub Actions CI (`Tabula-medica/aco-platform`) fails on Anthropic/OpenAI imports in PHI modules |
| BAA coverage | Google Cloud BAA for org `tabulamedica.com` covers `tabula-medica-bfd3d` |
| CMS data handling | CMS claims data and MSSP benchmark files are not sent to any AI provider directly; AI operates on derived aggregate features, not raw CMS data files |

---

## 5. SaMD Classification and FDA Regulatory Pathway

**Current classification (as of 2026-09-19):** Not classified as SaMD.

Rationale:
- Quality measure calculations are administrative computations against defined CMS numerator/
  denominator specifications, not clinical diagnostic tools.
- Beneficiary attribution follows CMS MSSP plurality-of-care rules; AI assists in applying those
  rules but does not modify the rules or make independent attribution judgments.
- RAF/HCC flagging is a coding audit support tool, not a diagnostic device; the clinician reviews
  the chart and makes the coding decision independently.
- No ACO AI output drives individual patient clinical decisions; all outputs are population-level
  administrative tools.

**Active monitoring:**
- CMS MSSP program integrity requirements reviewed annually for AI-related submission rules.
- If the ACO platform introduces a clinical pathway recommendation engine (e.g., recommending
  specific care interventions for individual beneficiaries), that feature will be reviewed under
  FDA CDS guidance before deployment.

---

## 6. CMS / MSSP Submission Gates

CMS and the MSSP program independently gate all final ACO submissions:

| CMS Gate | Description |
|---|---|
| HARP portal submission | All quality measure data is submitted via CMS HARP; no direct API submission pathway exists |
| ACO attestation | ACO executive must attest to data accuracy in HARP before CMS accepts the submission |
| CMS validation | CMS performs its own validation and reconciliation against claims data; discrepancies are returned to the ACO for resolution |
| Annual program review | CMS conducts annual program integrity review of all MSSP ACO submissions |

These external gates mean that even if an internal review step were bypassed, CMS validation
would catch and reject inaccurate AI-generated data before it affects shared-savings calculations.

---

## 7. Reviewer Cadence

| Review Type | Frequency | Reviewer |
|---|---|---|
| Quality measure computation accuracy spot-check | Quarterly (and before each CMS submission cycle) | Rajiv Aggarwal |
| Attribution exception review | Per submission cycle (quarterly) | ACO Administrator |
| RAF/HCC coding audit queue clearance | Monthly (when live PHI enabled) | Participating practice clinicians |
| Audit log completeness | Monthly | Automated alert + Security Officer |
| CMS submission pre-flight checklist | Per submission | ACO Executive |

---

## 8. Control Mapping

| Framework | Control | Status |
|---|---|---|
| SOC 2 | PI1.1 — Processing Integrity | Satisfied: draft table, submission_ready gate, manual CMS upload required |
| HIPAA | §164.312(b) — Audit Controls | Satisfied: all AI invocations and submission actions logged |
| ISO 42001 | Govern-1.2 — AI governance policy | Satisfied: HITL policy enforced in code; CMS gates provide independent human review |
| ISO 42001 | Manage-4.1 — Human oversight of AI systems | Satisfied: no autonomous CMS submission; executive attestation required |
