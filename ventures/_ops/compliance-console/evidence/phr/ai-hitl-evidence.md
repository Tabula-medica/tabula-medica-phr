# AIG-03 Human-in-the-Loop Evidence — Tabula Medica PHR
_Entity: Tabula Medica PHR · Date: 2026-09-19 · Frameworks: SOC 2 PI1.1 / HIPAA §164.312(b) / ISO 42001 Govern-1.2 & Manage-4.1_
_Review cycle: quarterly · Owner: Rajiv Aggarwal (rajiv@tabulamedica.com)_

---

## 1. AI System Description and Purpose

Tabula Medica PHR operates 33 AI-assisted Clinical Decision Support (CDS) services on the backend
(`Tabula-medica/tabula-medica-phr`). Categories include:

- Medication interaction and allergy flagging
- Preventive care gap identification (FDA-referenced guidelines)
- Chronic disease risk stratification
- Lab result interpretation aids
- Care plan drafting and patient messaging suggestions
- SDOH screening result summarization
- Advance Directive guidance summaries

All services use `gemini-2.5-flash` via **Google Vertex AI** (GCP project
`united-planet-485003-n7-9f345`, under the Tabula Medica / Google Cloud BAA).

---

## 2. Human Oversight Mechanism

| Layer | Mechanism | Responsible Party |
|---|---|---|
| Output type | All 33 CDS outputs are marked `draft: true` in the API response envelope | Backend service (enforced in code) |
| UI presentation | PHR frontend renders AI suggestions in a visually distinct "AI Draft" card with explicit "Needs your review" labeling | Frontend engineer / design |
| Clinician action required | No AI-generated content is persisted to the patient record without an explicit clinician "Accept" action | Application workflow |
| Audit log | Every AI invocation (model, prompt hash, output hash, clinician action taken) is written to the HIPAA audit trail | Cloud SQL audit table |
| Periodic accuracy review | Security Officer / clinical advisor spot-checks a random sample of accepted and rejected AI outputs quarterly | Rajiv Aggarwal |

### Draft-Only Code Pattern

The backend enforces the draft-only pattern through a response wrapper in the CDS service layer.
All AI inference results are returned inside an envelope of the form:

```json
{
  "cds_type": "<service_name>",
  "draft": true,
  "requires_clinician_review": true,
  "ai_output": { ... },
  "accepted_by": null,
  "accepted_at": null
}
```

The `accepted_by` / `accepted_at` fields remain `null` until a licensed clinician explicitly
confirms the suggestion through the PHR portal. The database schema enforces `draft = true` as
the default column value; a separate privileged write updates it on clinician acceptance, creating
an immutable audit row. No automated pathway exists to flip `draft` without a human action.

---

## 3. Feature Flag Status

All 33 CDS services are gated by a per-feature flag stored in the PHR configuration table.
**Default state in production: OFF (disabled).**

Feature flags are enabled on a per-clinician, per-feature basis only after:
1. Clinical lead review of the service description and sample outputs.
2. Explicit opt-in recorded in the clinician profile.
3. Security Officer sign-off for any service touching FDA-adjacent guidance.

No CDS service is enabled by default for new clinician accounts. Flag changes are logged with
actor, timestamp, and justification.

---

## 4. PHI Routing — Vertex AI Only

| Constraint | Implementation |
|---|---|
| PHI inference provider | Google Vertex AI exclusively (`us-central1` endpoint, GCP project `united-planet-485003-n7-9f345`) |
| Anthropic / OpenAI PHI block | Hard-coded deny in the PHR AI router; unit tests assert no PHI string reaches non-Vertex endpoints |
| CI enforcement | GitHub Actions workflow (`Tabula-medica/tabula-medica-phr`) includes a PHI-routing lint step that fails the build if any import of the Anthropic or OpenAI SDK is found in a code path that touches PHI fields |
| BAA coverage | Google Cloud BAA signed for org `tabulamedica.com` (org ID 780509095720), covering all GCP projects including `united-planet-485003-n7-9f345` |

---

## 5. SaMD Classification and FDA Regulatory Pathway

**Current classification (as of 2026-09-19):** Not classified as Software as a Medical Device (SaMD).

Rationale:
- All 33 CDS outputs are **advisory only** — they inform a licensed clinician's decision but do
  not drive or automate any clinical action.
- The system explicitly displays output as a "draft suggestion requiring clinician review."
- No output is used to drive diagnosis, treatment order, or drug dispensing autonomously.

**Active monitoring:** The Security Officer monitors FDA's evolving CDS guidance (21st Century
Cures Act § 3060, FDA 2022 Final CDS Guidance) quarterly. If a future service crosses into
"non-exempt CDS" territory (i.e., the software's basis for recommendation is not transparent to
the clinician), it will be scope-fenced, flagged OFF, and reviewed with legal counsel before
re-enabling.

The PHR CDS surface is flagged `build gated: NO-CDS` in the MEMORY index — no net-new CDS
service ships to production without this review.

---

## 6. Reviewer Cadence

| Review Type | Frequency | Reviewer |
|---|---|---|
| Spot-check of AI output accuracy | Quarterly | Rajiv Aggarwal (Security Officer) + clinical advisor |
| Feature flag audit | Quarterly (with access review) | Rajiv Aggarwal |
| Clinician-level opt-in review | Per onboarding + annually | Practice administrator |
| Audit log completeness check | Monthly | Automated CI alert + Security Officer |

---

## 7. Control Mapping

| Framework | Control | Status |
|---|---|---|
| SOC 2 | PI1.1 — Processing Integrity | Satisfied: draft-only output, clinician acceptance required |
| HIPAA | §164.312(b) — Audit Controls | Satisfied: all AI invocations logged |
| ISO 42001 | Govern-1.2 — AI governance policy | Satisfied: HITL policy documented and enforced in code |
| ISO 42001 | Manage-4.1 — Human oversight of AI systems | Satisfied: no autonomous AI action on PHI |
