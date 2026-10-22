# Oncology Course & Survivorship Considerations

**Protocol version:** 2026.10 · **Audience:** clinicians only · **Status:** guideline-derived considerations for clinician review, not orders and not shown to patients

Source of truth: `shared/oncology-survivorship.ts` (portable, no React/Express/Node imports). API: `/api/oncology-survivorship` (`server/routes/oncology-survivorship-routes.ts`). UI: the **Oncology** tab on the clinician chart (`client/src/components/oncology-survivorship-panel.tsx`, mounted in `client/src/pages/patient-health-record.tsx`). Update the module and this page together and bump `ONCOLOGY_SURVIVORSHIP_VERSION`.

## What it does

1. **Aggregates the course.** Pathology (histology, grade, margins, nodes, LVI, size, pathologic stage), biomarkers and germline results, imaging (with a closed response vocabulary: NED / response / stable / indeterminate / new finding / progression), tumor markers (trend, % change, above-ULN), cardiac and bone-density studies, and every treatment, merged into one dated timeline with a treatment summary, survivorship phase, alerts and data gaps. Tumor markers in chart labs (PSA, CEA, CA 15-3, CA-125, AFP, hCG, LDH, ...) join the trend view automatically.
2. **Compiles survivorship considerations for the provider.** Exposure-driven rules (drug class from agent names, doxorubicin-equivalent dose, radiation field and dose, transplant, axillary surgery, oophorectomy) plus disease-site surveillance. Each item carries rationale, triggering chart facts, cadence, named sources, data gaps, priority and due state. Clinicians accept, defer, dismiss or mark done; "done" feeds due/overdue.
3. **Optional AI refinement (Vertex AI, Google BAA).** The model may annotate and re-rank the deterministic candidates, write a factual course synthesis and ask clarifying questions. It cannot add recommendations: ids outside the candidate set are discarded, priority moves at most one step, a rule-assigned "high" never drops below "routine", and any failure returns the deterministic list unchanged.

## Guardrails

- **Provider-only.** Mounted behind `isAuthenticated` + `requireRole("admin","provider","clinician")`. No patient-facing surface reads this output.
- **PHI.** Prompts carry structured, relative-time facts only (ages, months-ago, drug classes, marker values). No names, DOB, identifiers, calendar dates or free-text report bodies leave the server. Audit entries are PHI-free. Responses are `no-store`.
- **No CDS claims.** Wording is "consider", every item is gated by a clinician decision, and the disclaimer ships in every response and in the copy-for-note export. Nothing orders, prescribes or notifies.
- **Active disease.** With active treatment, recurrent/metastatic status or a progression read, surveillance and care-plan items are suppressed and a banner defers to the treating oncologist.

## Rule coverage (v2026.10)

| Domain | Triggers | Leans on |
|---|---|---|
| Care plan | Treatment summary / survivorship care plan not documented after definitive treatment | ASCO, NCCN Survivorship, ACS |
| Disease-site surveillance | Breast, colon, prostate, lung, melanoma, lymphoma, thyroid, ovarian, cervical, uterine, head & neck, testicular; generic fallback elsewhere | NCCN site guidelines, ASCO |
| Cardiac | Anthracycline (COG doxorubicin-equivalents: daunorubicin 0.5, epirubicin 0.67, idarubicin 5, mitoxantrone 4), HER2 antibody, chest RT. High tier at ≥250 mg/m², ≥35 Gy, ≥100 mg/m² + ≥15 Gy, anthracycline + HER2, or ≥2 clinical risk factors | ASCO 2017, ESC 2022, COG LTFU |
| Second cancer | Breast MRI/mammogram after chest RT age 10–30 (≥10 Gy); colonoscopy after abdominal/pelvic RT ≥30 Gy; therapy-related MDS/AML awareness; skin in radiation fields | NCCN, COG LTFU, ACS |
| Endocrine / bone | Neck or mediastinal RT, checkpoint inhibitors (thyroid, late irAEs); aromatase inhibitor, ADT, oophorectomy (DEXA); ADT metabolic; cranial RT (pituitary axis) | COG LTFU, ASCO irAE, NCCN |
| Neuro / sensory | Platinum, taxane, vinca (neuropathy; ASCO CIPN notes duloxetine for painful CIPN); platinum or ear-field RT (audiology) | ASCO CIPN 2020, COG |
| Pulmonary / renal | Bleomycin, nitrosourea/busulfan, chest RT (PFTs); platinum, ifosfamide, methotrexate, VEGF-pathway agents, kidney primary (eGFR/UACR/BP) | COG, NCCN |
| Symptoms | Lymphedema (axillary surgery/RT); head & neck dental, swallowing, trismus; endocrine-therapy adherence; fatigue | NCCN, ASCO |
| Genetics | Breast ≤50 or triple-negative ≤60, ovarian, pancreatic, high-risk/metastatic prostate, colorectal <50 or MMR-deficient, with no germline result on file | NCCN Genetic/Familial |
| Psychosocial, sexual/reproductive, lifestyle, tobacco, immunization, HCT follow-up, general preventive care | See module | NCCN Distress, ACS, ACIP, ASTCT |

Thresholds are a summary of the named guidelines and can lag the current edition: every item tells the clinician to confirm against the source.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/protocol` | Version, sources, disclaimer (no PHI) |
| POST | `/analyze[?patientId=]` | `{case, context}` → course, suggestions, stored decisions, copy-ready clinician summary |
| POST | `/refine` | Same body → deterministic list plus Vertex annotations (`aiRefined`, `refinements`, `clarifyingQuestions`) or `aiUnavailable` |
| GET | `/patients/:patientId/decisions` | Clinician decisions for a chart |
| PUT | `/patients/:patientId/decisions/:suggestionId` | `{status: pending\|accepted\|deferred\|dismissed\|completed, note?, revisitOn?}` |

Decisions are held in a session-lifetime store behind a small `DecisionStore` interface. Move it to the encrypted PHI store before relying on it as the system of record.

## World outpatient EHR mirror

The World EHR (`omnihealth-ehr`) mirrors this the same way it mirrors Longevity & Preventive Health:

1. Copy `shared/oncology-survivorship.ts` verbatim (no dependencies). Keep the version string identical.
2. Build an `OncologyCase` from the World EHR's own records: `oncologyCaseFromCancerTrack` shows the mapping from structured diagnosis, treatment and document records; `tumorMarkerStudiesFromLabs` maps lab rows. Pass `region` through `SurvivorContext`; the rules are currently US-guideline-based, so international deployments should treat cadence text as a starting point and localise sources before go-live.
3. Either call `buildOncologyCourse` / `buildSurvivorshipSuggestions` directly or expose the same five endpoints. For `/refine`, route to the deployment's BAA-covered (or local-equivalent) model only; keep the same schema validation and id whitelist.
4. Keep the review list clinician-only and reuse `SuggestionDecision` so decisions travel between the two products.

## Tests

`tests/oncology-survivorship.spec.ts` (rules, exposures, tiers, course, adapter), `tests/oncology-survivorship-routes.spec.ts` (validation, AI guardrails, decisions), `tests/oncology-survivorship-panel.spec.tsx` (render, decision wiring, WCAG A/AA).
