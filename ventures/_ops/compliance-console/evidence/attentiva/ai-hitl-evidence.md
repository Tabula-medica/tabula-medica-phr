# AIG-03 Human-in-the-Loop Evidence — Tabula Attentiva
_Entity: Tabula Attentiva · Date: 2026-09-19 · Frameworks: SOC 2 PI1.1 / HIPAA §164.312(b) / ISO 42001 Govern-1.2 & Manage-4.1_
_Review cycle: quarterly · Owner: Rajiv Aggarwal (rajiv@tabulamedica.com)_

---

## 1. AI System Description and Purpose

Tabula Attentiva (`repos/tabula-attentiva`, GCP project `tabula-attentiva-phi`) is an ADHD
screening support tool for clinical practice. AI capabilities:

- **Behavioral questionnaire scoring** — AI aggregates patient- and caregiver-reported responses
  (Vanderbilt, SNAP-IV, Conners-style instruments) and produces a probability score across ADHD
  subtypes (inattentive, hyperactive-impulsive, combined)
- **Differential consideration draft** — AI generates a structured list of differentials the
  clinician should consider (anxiety, sleep disorder, learning disability, etc.) based on the
  screening profile
- **Documentation draft** — AI produces a draft clinical note summarizing the screening session
  for clinician review and editing
- **Follow-up recommendation draft** — AI suggests follow-up intervals and assessments; clinician
  selects and adjusts

All inference uses `gemini-2.5-flash` via **Google Vertex AI** (`tabula-attentiva-phi`, under the
Tabula Medica / Google Cloud BAA).

---

## 2. Human Oversight Mechanism

| Layer | Mechanism | Responsible Party |
|---|---|---|
| Probability score display | Score shown as a percentile band (e.g., "High screening priority — 82nd percentile for combined ADHD profile") with mandatory disclaimer: "This is a screening probability score, not a diagnosis" | Frontend UI |
| Differential list | Rendered as a review checklist; clinician checks relevant differentials and adds free-text notes before saving | Screening workflow module |
| Documentation draft | Displayed in a read-only draft panel; clinician writes or edits the final note in a separate input | Note-drafting module |
| No autonomous persisting | Probability scores, differentials, and note drafts are not written to the permanent patient record until clinician saves with attestation | Application workflow |
| Audit log | All AI invocations (model, feature, patient-session ID, output hash, clinician action) logged to Cloud SQL audit table | HIPAA audit trail |
| Quarterly review | Security Officer spot-checks a sample of completed screenings for score calibration and clinician override rates | Rajiv Aggarwal |

### Draft-Only Code Pattern

Attentiva's screening engine stores AI outputs in a `attentiva_screening_draft` table with a
`status = 'draft'` column. The permanent `attentiva_screening_record` table (used for billing,
reporting, and export) is only written by the `POST /screenings/{id}/finalize` endpoint, which
requires:

1. An authenticated GCIP session for a clinician-role user.
2. A `clinician_confirmed: true` body field.
3. A non-empty `clinician_notes` field (the clinician must provide at least one line of their own
   assessment, preventing pure pass-through of AI draft text).

Requests missing any of these return HTTP 400. The Python/Cloud SQL backend enforces this at the
service layer in `attentiva_screening_service.py`, independent of the frontend.

---

## 3. Feature Flag Status

| Feature | Production Default | Notes |
|---|---|---|
| ADHD probability scoring | ON for enrolled clinicians (core product feature) | Always accompanied by hardcoded disclaimer; cannot be stripped |
| Differential consideration draft | ON for enrolled clinicians | Draft-only; hardcoded disclaimer |
| Documentation draft | ON for enrolled clinicians | Read-only draft panel; requires clinician-authored notes to finalize |
| Follow-up recommendation draft | OFF (flag-gated) | Pending clinical review of recommendation accuracy |
| Longitudinal trend analysis | OFF (flag-gated) | Experimental; requires Security Officer enablement |

Hardcoded guardrails (cannot be disabled by any flag):
- "Not a diagnosis" disclaimer on all score outputs
- `clinician_confirmed` API requirement
- Mandatory `clinician_notes` field at finalization
- PHI routing to Vertex only

---

## 4. PHI Routing — Vertex AI Only

| Constraint | Implementation |
|---|---|
| PHI inference provider | Google Vertex AI exclusively (`us-central1`, project `tabula-attentiva-phi`) |
| Anthropic / OpenAI PHI block | `attentiva_ai_router.py` raises `PHIRoutingError` if a non-Vertex provider is selected for any patient-linked payload |
| CI enforcement | GitHub Actions CI fails on Anthropic/OpenAI SDK imports in PHI-touching modules |
| BAA coverage | Google Cloud BAA for org `tabulamedica.com` covers `tabula-attentiva-phi` |
| Normative data (non-PHI) | Aggregate norms and instrument scoring tables are stored locally; they are not transmitted to any AI provider |

---

## 5. SaMD Classification and FDA Regulatory Pathway

**Current classification (as of 2026-09-19):** Not classified as SaMD.

Rationale:
- The probability score is a **screening priority signal** to direct clinician attention, not a
  diagnostic output. The clinician makes the ADHD diagnosis independently.
- Differential considerations are a structured reminder list, not an automated diagnostic engine.
- Documentation drafts are author-assist tools; the clinician writes the final clinical note.
- All outputs explicitly disclaim diagnostic status in the UI, satisfying FDA CDS transparency
  criteria for non-exempt CDS software.

**Active monitoring:**
- FDA 2022 Final CDS Guidance reviewed quarterly.
- If any Attentiva output is used to directly recommend a medication (e.g., stimulant initiation
  without independent clinician evaluation), the feature will be gated and reviewed under SaMD
  criteria before re-enablement. This is a documented hard gate.
- Normative scoring data placeholders (noted in internal records) must be replaced with validated
  clinical norms before any commercial expansion; this is tracked as a P1 product gate.

---

## 6. Reviewer Cadence

| Review Type | Frequency | Reviewer |
|---|---|---|
| Probability score calibration spot-check | Quarterly | Rajiv Aggarwal + child/adolescent psychiatry consultant |
| Clinician override rate review (how often clinicians reject AI differentials) | Quarterly | Rajiv Aggarwal |
| FDA guidance review | Quarterly | Rajiv Aggarwal (legal escalation as needed) |
| Audit log completeness | Monthly | Automated alert + Security Officer |

---

## 7. Control Mapping

| Framework | Control | Status |
|---|---|---|
| SOC 2 | PI1.1 — Processing Integrity | Satisfied: draft table, finalization requires clinician attestation + authored notes |
| HIPAA | §164.312(b) — Audit Controls | Satisfied: all AI invocations and clinician actions logged |
| ISO 42001 | Govern-1.2 — AI governance policy | Satisfied: HITL policy enforced in code; SaMD boundary documented and monitored |
| ISO 42001 | Manage-4.1 — Human oversight of AI systems | Satisfied: no autonomous diagnostic or billing action possible |
