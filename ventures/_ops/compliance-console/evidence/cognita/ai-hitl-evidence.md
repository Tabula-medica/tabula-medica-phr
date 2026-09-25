# AIG-03 Human-in-the-Loop Evidence — Tabula Cognita
_Entity: Tabula Cognita · Date: 2026-09-19 · Frameworks: SOC 2 PI1.1 / HIPAA §164.312(b) / ISO 42001 Govern-1.2 & Manage-4.1_
_Review cycle: quarterly · Owner: Rajiv Aggarwal (rajiv@tabulamedica.com)_

---

## 1. AI System Description and Purpose

Tabula Cognita (`repos/tabula-attentiva` sibling; GCP project `tabula-cognita-prod`,
`app.tabulacognita.com`) is a dementia screening tool designed to support CPT 99483 (Cognitive
Assessment and Care Plan Services) workflows. AI capabilities:

- **Cognitive screening interview analysis** — structured interview responses are analyzed by
  Gemini to score domain-specific cognitive patterns (memory, executive function, language,
  visuospatial)
- **Assessment narrative drafting** — AI drafts a structured narrative for the clinician's review
  and completion
- **Care plan suggestion generation** — draft care plan items based on interview findings and
  patient history, surfaced as checklist suggestions for the clinician
- **Risk stratification** — a probability score (0–100) indicating screening priority, not a
  diagnostic confidence score

All inference uses `gemini-2.5-flash` via **Google Vertex AI** (`tabula-cognita-prod`, under the
Tabula Medica / Google Cloud BAA).

---

## 2. Human Oversight Mechanism

| Layer | Mechanism | Responsible Party |
|---|---|---|
| Screening score | Displayed as a numeric priority flag (e.g., "Screening priority: 74/100") with explicit label "Screening suggestion — not a diagnosis" | Frontend UI |
| Assessment narrative | Placed in a read-only draft panel; clinician types the final assessment in a separate input field | Assessment workflow module |
| Care plan items | Presented as a pre-populated checklist; clinician checks, unchecks, and edits each item before saving | Care plan module |
| No autonomous output | No AI output is written to the clinical record, billed, or shared with patient until clinician action | Application workflow |
| Audit log | Model invocations, score outputs, and clinician actions (accepted items, edited text) logged to Cloud SQL audit table | HIPAA audit trail |
| Quarterly spot-check | Security Officer reviews a sample of assessments for scoring accuracy and clinician engagement patterns | Rajiv Aggarwal |

### Draft-Only Code Pattern

Cognita's assessment engine writes AI outputs to a `cognita_draft_session` table, not directly to
the `cognita_assessment` (billable record) table. A separate "Finalize Assessment" action — which
requires an authenticated clinician session — copies reviewed and edited content into the
`cognita_assessment` table and deletes the draft. This is enforced at the API layer: the
`POST /assessments` endpoint requires a `clinician_attestation: true` field; requests without
this field return HTTP 422. The draft table has no billing or export hooks.

CPT 99483 billing metadata is only attached at finalization, making it structurally impossible to
bill on an AI draft without clinician attestation.

---

## 3. Feature Flag Status

All AI-assisted features in Cognita are enabled by default for clinicians (the product is an
AI-first screening tool), but with the following mandatory guardrails that cannot be disabled:

| Guardrail | Status | Can be disabled? |
|---|---|---|
| "Not a diagnosis" label on all outputs | Always ON | No — hardcoded in UI |
| Draft-only output (no auto-persist) | Always ON | No — enforced at API layer |
| Clinician attestation required for finalization | Always ON | No — enforced at API layer |
| PHI routing to Vertex only | Always ON | No — enforced in router + CI |

Advanced experimental features (e.g., longitudinal trend analysis across multiple visit sessions)
are flag-gated OFF by default and require Security Officer enablement.

---

## 4. PHI Routing — Vertex AI Only

| Constraint | Implementation |
|---|---|
| PHI inference provider | Google Vertex AI exclusively (`us-central1`, project `tabula-cognita-prod`) |
| Anthropic / OpenAI PHI block | AI router in Cognita backend denies routing of any patient-linked data to non-Vertex endpoints |
| CI enforcement | GitHub Actions CI (`Tabula-medica/tabula-cognita` or relevant repo) fails on Anthropic/OpenAI imports in PHI-handling modules |
| BAA coverage | Google Cloud BAA for org `tabulamedica.com` covers `tabula-cognita-prod` |

---

## 5. SaMD Classification and FDA Regulatory Pathway

**Current classification (as of 2026-09-19):** Not classified as SaMD — under active monitoring.

Rationale (current):
- AI outputs are presented as **screening suggestions**, not diagnoses. The output explicitly
  states it does not constitute a diagnostic finding.
- The clinician authors the final assessment narrative independently; the AI provides a draft
  scaffold only.
- CPT 99483 billing is gated on clinician attestation; the AI does not trigger billing.
- The cognitive scoring algorithm is transparent to the clinician: the structured interview
  questions and scoring dimensions are visible in the UI, satisfying the FDA's CDS "transparency"
  criterion for non-device CDS.

**Active monitoring:**
The Security Officer monitors FDA's evolving guidance on AI-based cognitive assessment tools,
particularly:
- FDA 2022 Final CDS Guidance (non-exempt vs. exempt CDS threshold)
- FDA AI/ML-Based SaMD Action Plan (predetermined change control)

If Tabula Cognita introduces a fully automated cognitive score that does not show its basis to the
clinician, or if the output is used to directly drive treatment without independent clinician
review, it will be re-evaluated under SaMD criteria and legal counsel will be engaged before
deployment. This is a documented hard gate in the feature approval process.

---

## 6. Reviewer Cadence

| Review Type | Frequency | Reviewer |
|---|---|---|
| AI scoring accuracy spot-check (sample of finalized assessments) | Quarterly | Rajiv Aggarwal + external clinical advisor |
| Guardrail integrity check (confirm "not a diagnosis" labeling, draft-only enforcement) | Quarterly | Rajiv Aggarwal |
| FDA guidance review | Quarterly | Rajiv Aggarwal (with legal counsel escalation if needed) |
| Audit log completeness | Monthly | Automated alert + Security Officer |

---

## 7. Control Mapping

| Framework | Control | Status |
|---|---|---|
| SOC 2 | PI1.1 — Processing Integrity | Satisfied: draft session table, attestation-gated finalization |
| HIPAA | §164.312(b) — Audit Controls | Satisfied: all AI invocations and clinician actions logged |
| ISO 42001 | Govern-1.2 — AI governance policy | Satisfied: HITL policy enforced in code; SaMD boundary monitored |
| ISO 42001 | Manage-4.1 — Human oversight of AI systems | Satisfied: clinician attestation is a hard API requirement |
