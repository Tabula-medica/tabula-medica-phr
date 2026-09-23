# AI Governance Policy

**Control IDs:** AIG-01, AIG-02, AIG-03
**Document ID:** PHR-AIG-001
**Effective Date:** 2026-09-16
**Review Date:** 2027-09-16
**Owner:** Rajiv Aggarwal, CEO/CISO, Tabula Medica LLC
**Classification:** Internal — Compliance Evidence

> **Approved by Rajiv Aggarwal, CEO — 2026-09-16**

---

## 1. Purpose

This policy governs the responsible development, deployment, and operation of AI/ML capabilities within Tabula Medica PHR (tabula-medica.us / tabula-medica.world). It establishes binding rules for PHI routing, GDPR personal data AI processing, clinical output handling, human oversight, and SaMD/CDS classification to protect patients and ensure regulatory compliance.

## 2. Scope

All AI and machine learning models, APIs, and automated inference systems used within Tabula Medica PHR, including clinical decision support, health history analysis, natural language processing, transcription, medication review, and summarization features.

---

## 3. AI Model Inventory (AIG-01)

| Model / Service | Provider | PHI Contact | GDPR Personal Data | Approval Status | Use Case |
|----------------|----------|-------------|-------------------|----------------|----------|
| **gemini-2.5-flash** via Vertex AI | Google Cloud (GCP) | **YES** | **YES** | **APPROVED** — covered under GCP BAA (HIPAA) and GCP DPA (GDPR) | Primary PHI-touching AI: health history summarization, medication review, CDS suggestions |
| Audio transcription (migration in progress) | OpenAI Whisper → Vertex AI Speech-to-Text | **Migrating** | **Migrating** | OpenAI: **PROHIBITED for PHI and EU personal data**; Vertex: **APPROVED** | Voice note transcription in patient records |
| Image analysis (migration in progress) | OpenAI Vision → Vertex AI Vision | **Migrating** | **Migrating** | OpenAI: **PROHIBITED for PHI and EU personal data**; Vertex: **APPROVED** | Medical image annotation support |
| Non-PHI feature processing (if applicable) | Any non-PHI provider | **NO** | **NO** | Approved with strict PHI/personal data exclusion controls | De-identified analytics, code suggestions |

**Model approval changes** require written sign-off from the CEO/CISO and an updated entry in this inventory before production deployment.

---

## 4. PHI and Personal Data Routing Rule — Absolute Prohibition (AIG-01)

> **HARD RULE: PHI must NEVER be transmitted to Anthropic, OpenAI, or any AI/ML provider that does not have a signed BAA with Tabula Medica LLC.**

> **HARD RULE: GDPR personal data (including EU/EEA patient health data) must NEVER be transmitted to any AI provider without an adequate Data Processing Agreement and Standard Contractual Clauses (or equivalent safeguard).**

These rules are non-negotiable and apply to:
- All API calls from Tabula Medica PHR application code
- All CI/CD pipelines and developer tooling
- All third-party integrations and plugins
- All prompt construction and prompt chaining workflows

**Approved PHI/Personal Data AI path:** Vertex AI (Google Cloud) — covered under GCP BAA (Org ID 780509095720) and GCP DPA with SCCs

**Enforcement mechanisms:**
1. Code review gate: PRs introducing new AI API calls require CISO review
2. No Anthropic or OpenAI API keys are permitted in PHI-system or GDPR-system environment variables
3. Network egress policy restricts PHI-system outbound to GCP endpoints only (where technically feasible)
4. Annual audit of AI dependencies and API call patterns
5. GDPR personal data: additional review confirms GCP region selection keeps EU/EEA data within adequate transfer jurisdictions

Violation of this rule constitutes a potential HIPAA breach and/or GDPR personal data breach, triggering the Incident Response procedure (IR-01) including both 60-day HIPAA and 72-hour GDPR supervisory authority notifications.

---

## 5. Clinical Output Handling — Draft-Only Rule (AIG-02)

All AI-generated health and clinical outputs (health summaries, medication interaction flags, preventive care suggestions, record consolidation results) are:

- **DRAFT status by default** — presented with explicit "AI Draft — Review Required" labeling
- **Never transmitted to treating providers or third parties** without patient or authorized clinician review and explicit approval
- **Feature-flagged** — all AI clinical features default to `OFF`; activation requires explicit per-user opt-in
- **Logged** — AI output generation events are logged with model version, timestamp, and reviewing user ID
- **Transparent** — users are informed when AI is generating content and can opt out

For any health-related AI outputs, users are always provided the ability to contact a licensed healthcare provider for professional interpretation.

---

## 6. SaMD / CDS Classification and Boundary (AIG-02)

Tabula Medica PHR AI features are designed as **patient-facing health information tools and Clinical Decision Support (CDS) aids**, not autonomous medical devices:

| Classification | Description | PHR Posture |
|---------------|-------------|------------|
| Software as a Medical Device (SaMD) | Software intended to treat, diagnose, or prevent a disease autonomously | PHR AI does **NOT** claim SaMD classification; no autonomous diagnostic or treatment decisions |
| Clinical Decision Support (CDS) | Tools that surface relevant health information to support clinician or patient judgment | PHR AI features are CDS: outputs are informational, not prescriptive |
| Personal Health Informatics | Tools that help patients understand and organize their own health data | Primary classification for most PHR AI features |

AI features must not be marketed or described in ways implying autonomous clinical decision-making. Any feature approaching SaMD classification requires legal and regulatory counsel review (including FDA 510(k)/De Novo pathway assessment) before deployment.

---

## 7. Human-in-the-Loop Requirement (AIG-03)

Every AI-assisted health record workflow must incorporate a human decision point before any output influences health decisions:

1. **Generation:** AI produces draft health summary or suggestion
2. **Presentation:** System displays output with "AI Draft" indicator and plain-language context
3. **Review:** Patient or authorized clinician reviews AI output
4. **Decision:** Patient/clinician accepts, modifies, or rejects AI output
5. **Action:** Only user-confirmed content is committed to the record or shared

Automated pipelines that skip steps 3 and 4 are prohibited for any PHI-touching or clinical workflow.

**GDPR Note:** Patients have the right under GDPR Article 22 not to be subject to solely automated decision-making that produces legal or similarly significant effects. PHR AI is designed to ensure a human remains in the loop for all significant health decisions, consistent with this right.

---

## 8. AI Risk and Monitoring (AIG-03)

| Risk | Mitigation |
|------|-----------|
| Model hallucination producing incorrect health content | Draft-only output; mandatory user review; feature flags; user feedback mechanism |
| PHI / personal data leak to non-BAA / non-DPA AI provider | Hard routing rule; code review gate; network egress control |
| GDPR Art. 22 automated decision-making violation | Human-in-the-loop requirement enforced in all clinical and significant health workflows |
| Model drift / performance degradation | Periodic output quality review; model version pinning; changelog tracking |
| Bias in health recommendations affecting protected groups | Documented limitation disclosures; user override always available |

Model versions in use are pinned in deployment configuration. Changes to production model versions require engineering review and are logged.

---

## 9. Regulatory Mapping

| Requirement | Control Reference |
|-------------|------------------|
| NIST AI RMF — Govern | §4 PHI/Personal Data Routing Rule; §7 Human-in-the-Loop |
| NIST AI RMF — Map | §3 AI Model Inventory; §6 SaMD/CDS Classification |
| NIST AI RMF — Measure | §8 AI Risk and Monitoring |
| HIPAA 164.308(a)(1) — Administrative safeguards | §4 PHI Routing Rule; §7 Human-in-the-Loop |
| GDPR Art. 22 — Automated individual decision-making | §7 Human-in-the-Loop; GDPR Note |
| GDPR Art. 25 — Data protection by design | §5 Draft-Only Rule; §4 Routing Rule |
| SOC 2 PI1.1 — Processing integrity | §5 Clinical Output Handling; §7 Human-in-the-Loop |
| SOC 2 CC6.7 — Restriction of unauthorized software | §4 PHI/Personal Data Routing Rule; enforcement mechanisms |
| SOC 2 CC9.2 — Vendor risk | §3 AI Model Inventory; §4 PHI Routing Rule |
| ISO 27001 A.5.1 — Policies | This document |
