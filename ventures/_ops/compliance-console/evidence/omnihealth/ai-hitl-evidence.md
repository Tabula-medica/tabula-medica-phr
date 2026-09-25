# AIG-03 Human-in-the-Loop Evidence — WorldEHR (omnihealth)
_Entity: WorldEHR / omnihealth-ehr · Date: 2026-09-19 · Frameworks: SOC 2 PI1.1 / HIPAA §164.312(b) / ISO 42001 Govern-1.2 & Manage-4.1_
_Review cycle: quarterly · Owner: Rajiv Aggarwal (rajiv@tabulamedica.com)_

---

## 1. AI System Description and Purpose

WorldEHR (`Tabula-medica/omnihealth-ehr`, GCP project `worldehr-app`) is an AI-assisted
ambulatory/inpatient EHR. Active AI-assisted features merged to `main` as of 2026-09-19:

- **Voice-to-SOAP** — ambient voice transcription converted to structured SOAP note draft
  (Vertex AI Speech-to-Text + Gemini for structuring)
- **Clinical Decision Support** — medication interactions, care gap alerts, HCC/RAF coding assists
- **Device and DICOM annotation aids** — AI-generated preliminary read for ordering clinician
  review (not a radiology report; radiologist confirmation required)
- **Offline-sync conflict resolution aids** — AI-suggested merge for conflicting field edits
  (clinician accepts/rejects each suggestion)
- **Utilization Management drafts** — prior auth letter drafts (PR #48 + #51 merged, feature flag OFF)

All features use `gemini-2.5-flash` via **Google Vertex AI** (`us-central1`, `worldehr-app`
project, under the Tabula Medica / Google Cloud BAA).

---

## 2. Human Oversight Mechanism

| Layer | Mechanism | Responsible Party |
|---|---|---|
| Voice-to-SOAP | Transcribed SOAP note is placed in `draft` state; clinician edits and co-signs before it enters the signed-note record | Application workflow (EHR note module) |
| CDS alerts | Alerts surface as advisory banners; clinician must acknowledge or dismiss with a documented reason | Frontend UI |
| DICOM annotation | AI annotation is watermarked "PRELIMINARY — Not for diagnostic use"; reading clinician must add attestation | DICOM viewer module |
| UM draft letters | Letters are generated into a draft queue; the ordering physician reviews and manually submits | Prior auth workflow |
| Audit trail | Every AI invocation is logged: model, user ID, feature, timestamp, action taken (accepted / modified / rejected) | HIPAA audit log in Cloud SQL |
| Quarterly review | Security Officer reviews audit log samples and feature flag status | Rajiv Aggarwal |

### Draft-Only Code Pattern

Voice-to-SOAP notes are created in the EHR note store with `note_status = 'ai_draft'`. The EHR
schema enforces a state machine:

```
ai_draft → clinician_edited → co_signed (final)
```

A note with `note_status = 'ai_draft'` cannot be included in a CCD export, billed against, or
forwarded to a referring provider. The transition to `co_signed` requires an authenticated
clinician action (GCIP-verified session + TOTP MFA where enabled). This pattern was implemented
as part of the voice workflow merged in PRs #42–#69 (`Tabula-medica/omnihealth-ehr`).

---

## 3. Feature Flag Status

| Feature | Production Default | Notes |
|---|---|---|
| Voice-to-SOAP | OFF (per-practice opt-in) | Enabled after practice administrator acceptance |
| CDS alerts | OFF (per-clinician opt-in) | Enabled at clinician onboarding |
| DICOM annotation aids | OFF | Pending clinical validation; not yet enabled for any customer |
| UM draft letters | OFF | Flag-gated, pending legal and clinical review |
| Offline conflict resolution | OFF | Enabled only in pilot deployments with explicit consent |

Feature flags are stored in the `practice_feature_flags` table (Cloud SQL, `worldehr-app`). Flag
changes require Security Officer approval and are logged. No AI feature is on by default for new
practice accounts.

---

## 4. PHI Routing — Vertex AI Only

| Constraint | Implementation |
|---|---|
| PHI inference provider | Google Vertex AI exclusively (`us-central1`, project `worldehr-app`) |
| Anthropic / OpenAI PHI block | PHI routing enforced in the `ai-router` module; Anthropic/OpenAI calls restricted to non-PHI paths (e.g., code generation, non-clinical summaries) |
| CI enforcement | GitHub Actions CI lint step fails on any Anthropic/OpenAI SDK import in PHI-adjacent modules |
| BAA coverage | Google Cloud BAA for org `tabulamedica.com` covers `worldehr-app` project |
| Voice audio | Audio is transcribed via Google Cloud Speech-to-Text (also under BAA); raw audio is not transmitted to any non-BAA endpoint |

---

## 5. SaMD Classification and FDA Regulatory Pathway

**Current classification (as of 2026-09-19):** Not classified as SaMD.

Rationale:
- Voice-to-SOAP produces a **draft note** that the clinician authors and co-signs. The AI is an
  input-assist tool, not a diagnostic device.
- CDS alerts are informational; the clinician makes all clinical decisions.
- DICOM annotation is watermarked preliminary and requires explicit radiologist/clinician
  attestation before any diagnostic or billing use.

**Active monitoring:** The DICOM annotation feature (not yet live for customers) will be reviewed
under FDA AI/ML-Based SaMD Action Plan criteria before any customer enablement. If the annotation
output is used directly as a diagnostic finding, it will be treated as a 510(k)-eligible device
and scoped accordingly before enablement. This review is a hard gate documented in the feature
flag approval process.

---

## 6. Reviewer Cadence

| Review Type | Frequency | Reviewer |
|---|---|---|
| Voice-to-SOAP note quality spot-check | Quarterly | Rajiv Aggarwal + clinical consultant |
| Feature flag audit | Quarterly (with SOC 2 access review) | Rajiv Aggarwal |
| Audit log completeness | Monthly | Automated alert + Security Officer |
| DICOM annotation clinical validation | Before any enablement | External radiologist reviewer |

---

## 7. Control Mapping

| Framework | Control | Status |
|---|---|---|
| SOC 2 | PI1.1 — Processing Integrity | Satisfied: ai_draft state machine, clinician co-sign required |
| HIPAA | §164.312(b) — Audit Controls | Satisfied: all AI invocations logged |
| ISO 42001 | Govern-1.2 — AI governance policy | Satisfied: HITL policy enforced in code and documented |
| ISO 42001 | Manage-4.1 — Human oversight of AI systems | Satisfied: no autonomous clinical action possible |
