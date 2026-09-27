# AI Model Inventory & Data-Flow Map — Tabula Medica ACO

**Control:** AIG-01
**Policy ID:** ACO-AI-INV-001
**Effective Date:** 2026-09-27
**Next Review Date:** 2027-09-27
**Owner:** Rajiv Aggarwal, MD, CEO/CISO — Tabula Medica LLC

---

## 1. Inventory

| Model ID | Provider | Model | Use Case | PHI Input | Output | HITL Required |
|---------|---------|-------|---------|----------|--------|--------------|
| ACO-AI-01 | Google Vertex AI | `gemini-2.5-flash` (`us-central1`) | Quality measure population computation (MSSP) | Beneficiary-level aggregate features (de-identified for AI) | Candidate numerator/denominator lists | Yes — quality officer validates sample |
| ACO-AI-02 | Google Vertex AI | `gemini-2.5-flash` | Beneficiary attribution modeling | Plurality-of-care claim features (no raw PHI) | Draft attribution assignments | Yes — administrator reviews all exceptions |
| ACO-AI-03 | Google Vertex AI | `gemini-2.5-flash` | RAF/HCC gap flagging | Aggregate HCC features from claims | Coding audit queue items | Yes — clinician chart review required |
| ACO-AI-04 | Google Vertex AI | `gemini-2.5-flash` | Care gap prioritization | Aggregate care gap features | Beneficiary outreach priority list | Yes — coordinator reviews list before outreach |
| ACO-AI-05 | Google Vertex AI | `gemini-2.5-flash` | Performance narrative drafting | Non-PHI quality metrics | Draft narrative text | Yes — executive reviews/edits before submission |

**All models:** Vertex AI, GCP project `tabula-medica-bfd3d`, under Google Cloud BAA for org `tabulamedica.com`.

**PHI prohibition:** No raw CMS claims files or beneficiary MBI are passed to any AI model directly. Models operate on derived aggregate features. Raw PHI stays in Cloud SQL.

**Anthropic / OpenAI:** Not used in the ACO platform. All AI calls routed through Vertex AI.

---

## 2. Data-Flow Map

```
CMS Beneficiary Data (Cloud SQL `tabula-medica-bfd3d`)
    │
    ▼
Feature extraction service (Cloud Run, internal VPC)
    │  ← No raw PHI leaves this layer
    ▼
Vertex AI gemini-2.5-flash (us-central1, BAA-covered)
    │
    ▼
Draft result (measure population / attribution / HCC flags)
    │
    ▼
Human review workflow (ACO ops dashboard)
    │  ← HITL gate — submission_ready = false until human approves
    ▼
Approved result (submission_ready = true)
    │
    ▼
CMS HARP export file → Manual upload by ACO executive
```

---

## 3. Feature Flag Status (Production)

All AI features are **OFF** in production pending PHI data agreement with participating practices. Synthetic data only until:
1. Participating practice BAAs in place
2. Security Officer sign-off
3. ACO executive approval in audit log

---

## 4. Compliance Mapping

| Framework | Control | Coverage |
|----------|---------|---------|
| SOC 2 CC6.3 | Logical access — model API keys | Vertex AI SA key in GCP Secret Manager |
| ISO 42001 Govern-1.1 | AI governance policy | This inventory + ai-hitl-evidence.md |
| HIPAA 164.312(b) | Audit controls | All invocations logged to Cloud SQL audit table |
| HITRUST 09.aa | Monitoring system use | AI invocation audit trail |
