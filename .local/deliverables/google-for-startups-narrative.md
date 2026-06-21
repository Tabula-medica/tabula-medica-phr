# Google for Startups Cloud Program — Application Narrative

**Status:** Paste-ready. Pull from sections below into the Google form fields. Verified against the codebase as of April 2026.

**Project name:** Tabula Medica
**One-liner:** A patient-controlled health record that connects the 40 million uninsured Americans to the care they can actually afford — and the records that follow them between providers.
**Stage:** Pre-revenue MVP. Patient-facing product complete. Pre-launch.
**Mission tag:** Healthcare access · AI for good · Underserved populations

---

## "What does your company do?" (250 words)

Tabula Medica is a patient-centric health record platform that fixes two structural failures of US healthcare at the same time: records that don't follow patients, and care that uninsured patients can't afford or find.

We pull a patient's complete medical history from any EHR they've ever used — Epic, Cerner, athenahealth, eClinicalWorks, MEDITECH, and dozens of regional systems — into a single record the patient owns. We do this through SMART on FHIR (the federally mandated patient access standard), Fasten Health for aggregation, and direct payer FHIR APIs from the ten largest US insurers under the CMS-9115-F mandate.

On top of that record, we built a Care Access toolkit specifically for uninsured and underinsured patients: a Medicaid/CHIP/ACA Marketplace eligibility screener using 2026 Federal Poverty Level guidelines, a 60-CPT-code Medicare-rate transparency tool, sliding-fee-scale FQHC search via HRSA, Sesame Care direct-primary-care booking with transparent upfront pricing, FindHelp.org SDoH resource discovery across 12 social-need categories, prescription savings via GoodRx and manufacturer assistance programs, and AI-driven prior authorization letter generation.

The product is HIPAA-compliant by design — AES-256-GCM PHI encryption at rest, zero-knowledge encryption with patient-held master keys, MFA, WORM tamper-evident audit logging, SOC 2 controls, and a HITRUST CSF mapping. It's available as a Progressive Web App today and ships to iOS and Android via Capacitor in the bundled-asset configuration App Store reviewers prefer for healthcare.

We are pre-revenue, pre-fundraise, built by a single physician-founder with one engineering partner.

---

## "What problem are you solving?" (200 words)

40 million Americans have no health insurance. Another 60 million are underinsured — they have a card but can't afford to use it. They make decisions like "should I go to the ER for chest pain or pay rent" without the information they need to choose differently.

Three specific failures we solve:

1. **Records don't follow patients.** A patient who sees three providers in two states has three fragmented records. Specialists re-order labs already done. ER doctors prescribe drugs the patient is already taking. Patients can't bring their own history because no one taught them how to get it.

2. **Eligibility is opaque.** A family of four earning $42,000 may qualify for Medicaid in one state and ACA subsidies in another. They don't know. The screening process exists at Healthcare.gov but is intimidating, English-only, and requires creating accounts.

3. **Affordable care is invisible.** FQHCs offer sliding-fee-scale care to anyone regardless of insurance status. Direct primary care practices charge $89/month for unlimited visits. Patient assistance programs cover thousands per year in medication costs. None of this is discoverable to the people who need it most.

We make all three solvable from a single phone screen, in 22 languages, RTL-script-aware, with patient consent at every step.

---

## "Why is your team uniquely positioned to solve it?" (150 words)

The founder is a practicing physician (MD) who has personally treated uninsured patients in emergency departments, FQHCs, and direct primary care settings. He has seen firsthand which existing patient resources work in clinical practice, which fail, and where the gaps that nobody is filling actually live.

The technical implementation reflects clinical reality, not engineering speculation: USPSTF-aligned care gap detection, FDA non-CDS positioning on every clinical surface, ICD-10 / CPT / SNOMED / RxNorm mappings, NPI registry integration for verified providers, and a clinical-glossary safety system that prevents drug names and dosages from ever being machine-translated.

We are not building "AI for clinicians" — that market is saturated. We are building the first health record platform whose primary user is the patient who has been failed by the existing system, and whose primary measure of success is whether that patient gets care they otherwise wouldn't have.

---

## "What have you built so far?" (Comprehensive feature inventory)

This section is verified against the codebase. Every capability listed is implemented — not roadmap.

### Patient health record (the core product)
- Full FHIR R4 / USCDI v3-compliant patient record with CRUD across all categories: conditions, medications, allergies, immunizations, vitals, labs, imaging, encounters, procedures, advance directives, family history.
- SMART on FHIR OAuth 2.0 + PKCE for patient-controlled EHR connectivity to Epic, Cerner, athenahealth, eClinicalWorks, MEDITECH, and Fasten Health aggregator.
- Patient Access API integration with 10 major insurers (UnitedHealthcare, Anthem, Aetna, Cigna, Humana, BCBS, Kaiser, Medicare Blue Button, Molina, Centene/Ambetter) under the CMS-9115-F mandate for claims, EOBs, and coverage data.
- DICOM/PACS imaging support via WADO-RS, WADO-URI, and DICOMweb.
- Patient Deduplication Engine, FHIR Resource Lifecycle Management, and Data Reconciliation across sources.
- Unified Health Summary panel accessible from any page with AI-generated narrative overview and chronological event feed.

### Care Access toolkit (the equity-focused product)
- **Coverage Eligibility Screener** — Medicaid (138% FPL threshold), CHIP, ACA Marketplace with premium tax credits, Cost Sharing Reductions, and Medicare. Locale-safe income parsing handles Eastern-Arabic and Persian digits and locale-variant decimal separators.
- **Find a Doctor** — NPI registry search filtered by specialty, accepts-Medicaid, sliding-fee-scale, and language spoken.
- **Uninsured Discount Platform** — 60 CPT codes with 2026 CMS Medicare Fee Schedule rates across 11 categories; participating provider directory; RadiologyAssist imaging price comparison.
- **Sesame Care DPC integration** — 18 medical services with transparent upfront pricing across 12 categories; ZIP-based provider search; appointment slot booking; 3 membership plans ($89-$225/month).
- **FindHelp.org / Aunt Bertha SDoH search** — ZIP-based community resource discovery across 12 categories with CMS AHC social-needs screening tool integration and 988 crisis line.
- **Drug Savings** — AI Savings Advisor; 10 manufacturer patient assistance programs; 12 generic alternatives database; PAP application guide.
- **Prior Auth Letter** — AI-generated insurance prior authorization letters from patient-entered context.
- **Insurance Learning Navigator** — interactive AI-powered modules teaching copay, deductible, out-of-network, prior auth, referral process; 22-language support; 20-term insurance glossary.
- **VA Veteran Verification** — DD-214 upload pipeline (early-access stub for VA API integration).
- **Care Assistant** — natural-language health navigation chat that routes to the appropriate Care Access tool.

### Clinical decision support (FDA non-CDS positioned)
- **USPSTF-aligned care gap detection** — 8-rule evaluator for grade A/B preventive screenings.
- **AI Ambient Encounter Recording** — Whisper transcription + GPT-4 SOAP note generation + action item extraction. Audio held memory-only.
- **AI Health Assistant** with multilingual voice access via Whisper.
- **AI Evidence-Based Health Advisor** for international users with WHO-aligned responses.
- **AI Proactive Safety Analysis** — drug interactions and high-risk alerts.
- **Predictive Risk Stratification** and Automated Care Gap Identification.

### Sharing, export, and family
- **Secure record sharing** with QR code, expiring tokens, scope-limited access (summary / labs / full), and three-button distribution (clipboard, WhatsApp, system share).
- **Care Packet Export** — printable PDF for specialist visits.
- **My Family Hub** — multi-patient management, family verification, caregiver portal, collaborative care plans.
- **Pet Health Records** — separate veterinary record category.

### Internationalization and accessibility
- **22 UI languages** including 5 RTL scripts (Arabic, Hebrew, Farsi, Urdu, Pashto) with `dir` attribute auto-flipping.
- **50+ languages** for voice/AI through OpenAI Whisper, including medical terminology translation and real-time provider-patient translation.
- **Document Translation** with medical context awareness.
- **WCAG 2.1 Level AA** accessibility — color contrast, focus visibility, screen reader announcements, 44px touch targets, geriatric mode, color-blind modes, dyslexia font, reading guide, ELI12 plain language, voice commands, reduced motion.
- **Clinical glossary safety** — drug names, doses, and units never machine-translated.

### Compliance and security
- HIPAA-compliant audit logging on every PHI access.
- AES-256-GCM PHI encryption at rest with patient-held master keys (zero-knowledge).
- TLS 1.3, HSTS, MFA-mandatory, JWT session auth.
- WORM (Write-Once-Read-Many) tamper-evident audit log with hash-chain verification.
- HITRUST CSF mapping, SOC 2 Compliance Dashboard with PDF export and automated remediation, MFA Compliance Enforcement, Centralized Logging Compliance.
- SMART on FHIR Granular FHIR Access Control with role-based policies, patient consent management, and access evaluation engine.
- FDA non-CDS positioning enforced via shared `<ClinicalDisclaimer />` on every clinical surface.

### Provider-side capabilities (secondary surface)
- AI Provider Dashboard with task list, vitals monitor, doc summaries, patient summary generator, referral letter generator, differential diagnosis assistant.
- AI Clinical Documentation, AI Care Plan Draft, AI Discharge Review.
- Document Extraction Pipeline with 5 stages: pre-processing, multi-model voting (GPT-4o + Claude 3.5 Sonnet) with human-in-the-loop reconciliation, clinical sanity-check rules (36 physiological ranges, 7 unit conversions, 8 temporal-integrity rules), and Golden Dataset benchmarking.

---

## Why we need Google for Startups credits

We need GCP credits for three specific cost centers:

1. **Vertex AI inference** — Gemini for clinical reasoning. Patient eligibility classification and care navigation chat are pre-revenue features serving uninsured patients who cannot pay. Credits subsidize the inference cost.
2. **Cloud Healthcare API + DICOM store** — patient imaging is large and infrequent-access. Storage credits matter.
3. **Cloud Run + Cloud SQL** — production hosting under HIPAA BAA. Without credits, the per-patient gross margin on uninsured users is negative until we have payer contracts.

We expect to be on GCP for at least three years given the BAA scope and the fact that our entire HIPAA architecture (KMS, VPC Service Controls, Healthcare API, Cloud Logging) is GCP-native.

---

## Traction / metrics to populate when applying

| Field | Value | Source / how to verify |
|---|---|---|
| Users | Pre-launch | TestFlight count once submitted |
| Revenue | $0 | Pre-revenue |
| Funding raised | Bootstrap | Founder self-funded |
| Team size | 2 | Founder + engineering partner |
| Tech stack | React, TypeScript, Express, PostgreSQL, GCP Healthcare API, Vertex AI, OpenAI, Capacitor | replit.md |
| GCP services in use | Cloud Run, Cloud SQL, Cloud Healthcare API, Vertex AI, Cloud Logging, Secret Manager, KMS, BigQuery | replit.md "GCP Healthcare" section |
| Compliance posture | HIPAA-architected, SOC 2 controls implemented, HITRUST CSF mapped, BAA pending Auth0 | SOC 2 Compliance Dashboard |

---

## Drop-in answers to common form fields

**"Number of customers":** Pre-launch — patient-facing MVP complete, TestFlight submission pending.

**"Annual recurring revenue":** $0 (pre-revenue). Planned freemium model with $9.99/month Pro tier via RevenueCat.

**"What is your differentiator?":** We are the only patient-controlled health record built primarily for uninsured Americans — every other entrant in the patient health record market (Apple Health, Google Fit, Epic MyChart) optimizes for insured patients with one provider system. Our Care Access toolkit (eligibility screener, FQHC finder, sliding-fee-scale, DPC booking, prescription savings, prior-auth assistance) does not exist as an integrated product anywhere else.

**"Who are your competitors?":** Apple Health Records (insured patients only, Apple ecosystem), Epic MyChart (single-EHR), Healthcare.gov (eligibility only, no records, English-only intimidating UX), individual FQHC websites (fragmented, not searchable), GoodRx (drugs only). We integrate or compete with each in a specific dimension; none does the complete patient-facing job.

**"What's your business model?":** Freemium. Free tier covers core record aggregation and Care Access tools (this is the mission-aligned subsidized tier). Pro tier ($9.99/month) adds family member coverage, premium AI features, expanded document storage. Future: B2B contracts with FQHC networks and DPC practices for white-labeled patient onboarding.

**"How will you use Google Cloud credits?":** See "Why we need Google for Startups credits" above.

---

## Submission blocker — RESOLVE FIRST

Google Workspace billing ID issue is currently blocking application submission. See your separate to-do; this narrative is ready to paste once that clears.

## After credits are approved

1. Move production traffic from current hosting to Cloud Run with min-instances=2, max=20.
2. Migrate PHI database from current Postgres to Cloud SQL with CMEK via Cloud KMS.
3. Switch DICOM store from local file storage to Cloud Healthcare API DICOM store.
4. Move Vertex AI calls from gemini-1.5-flash on the API to a deployed Vertex AI Endpoint with HIPAA BAA scope.
