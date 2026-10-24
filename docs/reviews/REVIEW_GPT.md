# Independent review: PHR consolidation and pricing

**Reviewed:** 24 October 2026  
**Scope:** `docs/CONSOLIDATION_PLAN.md` and `docs/PRICING.md` from PR #272  
**Lenses:** health-tech product strategy, HIPAA/security architecture, and accessibility  
**Overall judgment:** **Do not treat the current plan as production-ready.** The product direction is compelling, but the documents turn aspirations into claims before the legal role, security boundary, clinical-safety controls, accessibility gate, interoperability operations, and unit economics are established.

This is a product and technical review, not legal advice.

## Top 10 gaps and risks

### 1. Critical — The governing privacy regime is not established

**Where:** `CONSOLIDATION_PLAN.md:324-341`; `PRICING.md:56`

The plan is framed as a HIPAA checklist, but a patient-selected, direct-to-consumer PHR is not automatically a HIPAA covered entity or business associate. HHS says data sent at the individual's direction to an independent app is no longer protected by HIPAA once the app receives it. Because this PHR combines provider, payer, device, and patient-entered data, it is likely a vendor of personal health records under the FTC Health Breach Notification Rule (HBNR). A plan- or clinic-sponsored version may separately make Tabula Medica a business associate.

A Google or Fasten BAA does not determine Tabula Medica's legal role. The current plan therefore misses the baseline law most likely to govern the direct-to-consumer product. Under the HBNR, an unauthorized disclosure—not only a cyberattack—can be a reportable breach.

**Change required:** Add a data-role matrix for direct-to-consumer, payer-sponsored, provider-sponsored, research, and international offerings. For each, name controller/covered-entity/business-associate/PHR-vendor roles, applicable breach rules, permitted purposes, consent, deletion, secondary use, sponsor access, and subcontractors. Make FTC Act/HBNR controls the US consumer baseline and HIPAA controls additive where a covered relationship exists.

### 2. Critical — “PHI only in GCP” is false as an architecture statement

**Where:** `CONSOLIDATION_PLAN.md:195-232`, especially `:228-232`

The diagram omits PHI on patient devices, browser caches, native storage, OAuth endpoints, Fasten, EHR/payer systems, support tools, and potentially payment or notification metadata. The repository already supports caching patient data in browser Cache Storage (`client/public/sw.js:108-116`) and stores advance-directive data in plaintext `localStorage` (`client/src/pages/advance-directives.tsx:206-223`). Fasten is explicitly outside GCP. A DNS-only Cloudflare API record prevents proxying of API bodies; it does not prove that URLs, referrers, Pages logs, scripts, OAuth navigation, or future Pages Functions contain no health metadata.

**Change required:** Replace the claim with a precise one, such as “Tabula-controlled server-side PHI is stored and processed only in approved GCP services under the BAA, except named contracted processors.” Add a complete data-flow and retention inventory for browser/mobile storage, logs, crash reporting, notifications, support, backups, Fasten, identity, payments, and every SDK. Remove PHI from generic Cache Storage and `localStorage`, or use an account-scoped encrypted offline vault backed by Keychain/Keystore with wipe, expiry, backup exclusion, and step-up access. Restrict Cloud Run ingress so its default origin cannot bypass the intended edge controls.

### 3. Critical — Deduplication can create a clinically false record

**Where:** `CONSOLIDATION_PLAN.md:148-159`, `:360`, `:382-383`

“Same code + calendar day + value” is not a safe general duplicate rule. Legitimate repeat labs, multiple specimens, bilateral procedures, medication administrations, corrected results, and device readings can match those fields. Terminology mapping can also collapse clinically distinct local concepts. The Vertex stage has no validated dataset, resource-specific thresholds, model/version pinning, reviewer role, explanation, rollback, or patient correction path. Keeping source records does not undo harm if the reconciled view suppresses a real event or causes one source to inherit another source's sharing policy.

**Change required:** Treat AI as candidate ranking, not an autonomous merge authority. Use resource-specific rules incorporating source identifier, accession/specimen, encounter, performer, effective and issued timestamps, status, body site, method, and corrected-result lineage. Never auto-merge ambiguous clinically material events. Store model/version, input-field manifest, score, rationale, reviewer, and reversible decision history. Give patients “not the same,” unmerge, and source-correction workflows. Validate sensitivity labels and consent boundaries after every merge.

### 4. Critical — The $1 model is cloud-resource math, not viable unit economics

**Where:** `PRICING.md:6-14`, `:20`, `:29-63`, `:78`

The listed fixed-cost arithmetic is internally correct: $30.15 compute + $19.16 memory + $3.40 disk + $1.60 backup + $2 secrets/KMS + $10 estimate = **$66.31/month**. The conclusion is not. “Fully loaded” excludes Fasten, payment fees, app-store commissions, identity proofing, support, accessibility and security audits, observability/SIEM, legal/privacy operations, incident response, taxes, refunds, fraud, translation QA, records-retrieval labor, and regional infrastructure.

The marginal table also mixes unlike units: Speech-to-Text is billed by audio minute, while Text-to-Speech is billed by characters or tokens. The FHIR store, logging, and GCS line is an unmeasured $10 pool even though Healthcare API separately bills indexed storage, requests, notifications, and some advanced operations.

At the document's assumptions:

| Active members | Fixed floor/member | + Run, GCS, egress | + full stated STT and Vertex allowance |
| ---: | ---: | ---: | ---: |
| 100 | $0.663 | $0.672 | $0.932 |
| 200 | $0.332 | $0.341 | $0.601 |
| 1,000 | $0.066 | $0.075 | $0.335 |

Those are GCP-only figures and still exclude TTS. At Stripe's standard US online-card rate of 2.9% + $0.30, a $1 monthly charge nets about **$0.671** before any service cost. A $10 annual charge is $0.833 gross per month and about **$0.784 net per month** after one standard card charge. Thus “$1/month or $10/year” is not economically equivalent, and monthly card billing can lose money around the stated 100-member case even before Fasten or support.

**Change required:** Build contribution-margin scenarios per enrolled and active member at p50/p90 usage, with contracted Fasten and identity-proofing prices, payment channel, support contacts, all compliance operations, and a contingency reserve. Use sponsor PMPM or annual billing as the primary financing path; preserve a no-surprise-billing hardship path. Define utilization and enrollment stop-loss thresholds before launch. Relabel $0.15-$0.40 as an unvalidated GCP marginal-cost range, not fully loaded operating cost.

### 5. High — “Patient-owned” is a slogan, not yet a product contract

**Where:** `CONSOLIDATION_PLAN.md:26-34`, `:65`, `:159`, `:334`; `PRICING.md:12`, `:69`

The plan does not define what the patient can take away, correct, delegate, retain after cancellation, or recover if the company closes. IPS is useful but not a complete longitudinal record. There is no commitment for original PDFs, notes, imaging/DICOM, C-CDA, FHIR bulk export, provenance, audit history, correction status, or an accessible human-readable export. Automatic movement to an undefined household plan after failed eligibility also conflicts with patient control and creates surprise-billing risk.

**Change required:** Publish a patient-ownership charter: free export formats and SLA; original-file preservation; source/provenance visibility; correction and annotation rights; account closure and deletion behavior; permanent read/export grace period; no data hostage on payment failure; authorized-representative succession; and a service-wind-down/insolvency export plan. Require explicit consent before any paid conversion after eligibility failure, with notice, grace period, appeal, and hardship continuation.

### 6. High — The accessibility “release gate” can currently ship known failures

**Where:** `CONSOLIDATION_PLAN.md:34`, `:44`, `:254-321`, `:354`, `:364`, `:374`; `PRICING.md:22-23`

The plan calls WCAG 2.2 AA a release gate while the new end-to-end axe job is non-blocking, the current ACR documents untested platforms and known failures, and the signed ACR is deferred to v2. Rendering the same web client in Capacitor does not establish iOS or Android conformance. One checklist pass cannot cover web, both native shells, every PDF template, third-party GCIP/Fasten/SMART/payment flows, 19 locales, RTL, voice failures, or cognitive accessibility.

Capping cloud speech can also remove an accommodation from users whose device or language lacks adequate on-device speech. That is not equivalent access.

**Change required:** Make critical patient journeys blocking on all shipped platforms. Test VoiceOver, TalkBack, NVDA, JAWS, Switch Control/Access, Voice Control/Access, 200-400% zoom/reflow, text spacing, orientation, reduced motion, focus not obscured, target size, accessible authentication, and every generated-document template. Test with disabled, older, low-literacy, and limited-English-proficiency users. Do not count essential STT/TTS or comprehension support against a hard monthly cutoff. Publish a complete, versioned criterion-by-criterion ACR; disable or provide an equivalent route for known failures such as uncaptained telehealth.

### 7. High — Retrieval coverage and regulatory guarantees are overstated

**Where:** `CONSOLIDATION_PLAN.md:57-60`, `:89-143`, `:350`, `:359`, `:369`; `PRICING.md:19`, `:63`, `:70-71`

ONC certified-API rules materially improve third-party app registration, but they do not make one Epic, Oracle, or athena registration equivalent to every customer tenant, guarantee complete EHI from every provider, or eliminate recurring endpoint operations. Blue Button 2.0 supplies Medicare Parts A, B, and D claims—not a clinical chart—and has its own production approval, privacy-policy, opt-in, consent, PKCE, and change-management terms. Payer Patient Access APIs are a separate CMS program. Information-blocking duties apply to defined actors; the patient app should not imply that every coverage gap is automatically unlawful blocking.

TEFCA Individual Access Services also require identity, authentication, matching, consent, and network-role controls that are absent from the roadmap and price.

**Change required:** Separate HIPAA access, ONC certified APIs, information blocking, payer Patient Access APIs, Blue Button, and TEFCA in the plan. Build an endpoint/tenant directory, registration status, token-health service, recurring delta synchronization, backfill, completeness/freshness telemetry, outage handling, and support runbooks. Confirm Fasten's precise TEFCA role and obligations contractually. Label claims-derived facts as such and never present them as provider-attested clinical data.

### 8. High — Caregiver access ignores minors and specially protected records

**Where:** `CONSOLIDATION_PLAN.md:63`, `:71`, `:153-159`, `:183`, `:333-334`

“One caregiver model, permissioned” is not enough. The plan omits guardianship evidence, incapacity, contested authority, adolescent confidentiality, emancipation, abuse/endangerment exceptions, age-of-majority transition, time-limited sharing, and resource-level restrictions. It also does not preserve 42 CFR Part 2 provenance and consent rules through reconciliation. State law may require withholding sexual-health, mental-health, SUD, or reproductive-health records from a parent even when the parent can access the rest of the chart.

**Change required:** Model authority by subject, jurisdiction, relationship, legal basis, scope, proof, effective/expiry dates, and revocation. Preserve security labels and Part 2 provenance through import, projection, export, and deduplication. Add confidential-minor segmentation, transition at majority, emergency and break-glass controls, abuse/endangerment suppression, time-limited provider sharing, disclosure accounting, and recipient audit.

### 9. High — “World” cannot be implemented as a region flag

**Where:** `CONSOLIDATION_PLAN.md:5`, `:30`, `:46`, `:142`, `:195-246`, `:338`, `:370`

Turning off TEFCA changes a feature; it does not establish a lawful international service. The named FHIR store is in `us-central1`. The plan does not address country launch approval, data residency, controller/processor roles, lawful basis, data-subject requests, breach deadlines, cross-border transfer mechanisms, local representatives, national-network certification, terminology licenses, identity, clinical safety, or language quality. A `privacyRegime` string in `shared/jurisdictions.ts` is not a compliance control.

“Any language” is also not supported by a 19-language UI list. Clinical translation requires supported-language disclosure, passage-level `lang`, bidirectional isolation for identifiers and dosages, human review for safety-critical content, translation-quality measurement, and fallback behavior.

**Change required:** Replace “world” with named-country launch gates. Each gate must specify residency and processing regions, legal basis, transfers, regulator/representative, retention and rights, identity and exchange approval, terminology, supported languages and speech engines, clinical-translation QA, accessibility evidence, support, and payments. Keep unapproved countries import/offline-only. Change public claims from “any language” to the exact tested language/platform matrix.

### 10. High — The plan omits production security, reliability, and incident gates

**Where:** `CONSOLIDATION_PLAN.md:324-389`; `PRICING.md:29`, `:54`

The checklist says access is authenticated, authorized, and audited, while the repository threat model still identifies production-mounted IDOR, fallback-identity, public-helper, privileged-route, upload, AI, and role-isolation surfaces (`threat_model.md:30-43`, `:50-123`). The migration order has no gate requiring closure or explicit risk acceptance before real PHI ingestion. “HIPAA does not require a second zone” is too narrow: availability decisions need clinical impact, RTO/RPO, backup immutability, disaster recovery, and emergency-card behavior—not only whether an hour of downtime costs more than HA.

There is also no breach-decision workflow spanning HIPAA, Part 2, FTC HBNR, CMS terms, state laws, vendor contracts, and international laws.

**Change required:** Before production ingestion, require deny-by-default authorization, route/tenant ownership tests, removal of fallback identities and production demos, upload ACL tests, AI-route enforcement, secret fail-closed behavior, SAST/DAST/dependency scans, penetration testing, and documented risk acceptance. Define RTO/RPO, immutable backups, cross-project recovery, restore evidence, degraded/offline behavior, and HA thresholds. Add an incident-response annex with containment, evidence preservation, unauthorized-disclosure analysis, regulator/vendor decision trees, notification templates, accountable roles, and tabletop exercises.

## Wrong or unsafe assumptions

| Assumption in the documents | Correction |
| --- | --- |
| A BAA-centered architecture makes the consumer PHR “HIPAA.” | Legal role and relationship determine HIPAA coverage. An independent consumer PHR is commonly outside HIPAA and inside FTC HBNR/state-law scope. |
| PHI lives only in GCP. | PHI necessarily exists on patient devices and source systems and may pass through Fasten; repository browser storage currently adds another location. State the controlled server-side boundary precisely. |
| Direct SMART is a low-cost fallback after registering with major EHR vendors. | Production activation, endpoint discovery, tenant configuration, token lifecycle, version drift, recurring sync, completeness, and support remain ongoing per-tenant operations. |
| CMS Blue Button is interchangeable with a clinical SMART connection. | Blue Button is Medicare claims data. It is valuable but incomplete and must be labeled as claims-derived. |
| “Patient-owned” follows from storing data in a patient FHIR compartment. | Ownership requires enforceable export, correction, delegation, deletion, continuity, and non-hostage commitments. |
| The same React client means web accessibility findings apply to native apps. | WebView, bridge, permission, focus, text scaling, orientation, and assistive-technology behavior must be tested separately on released iOS and Android builds. |
| BLE service support means broad cuff, meter, scale, and oximeter compatibility. | Many devices use proprietary pairing/protocols and platform background restrictions. Claim only tested model/OS combinations. |
| A single US-hosted codebase plus a flag is a world product. | Shared code is reasonable; legal deployment, residency, exchange, language, and clinical requirements remain country-specific. |
| Ten “minutes of STT or TTS” is one measurable allowance. | STT is billed by audio duration; TTS by characters/tokens. Accessibility use should not hard-stop in either case. |
| A non-blocking accessibility scan plus a future VPAT is a release gate. | A gate must block release and include manual, native, document, multilingual, voice, cognitive, and third-party-flow evidence. |

## Missing features versus best-in-class products

The original comparison is too favorable and excludes the closest consumer PHR competitors. Public product materials for Guava and PicnicHealth show capabilities that should be treated as baseline competition, not future polish.

| Missing capability | Competitive reference | Recommended product requirement |
| --- | --- | --- |
| Acquisition beyond FHIR | Guava advertises PDF/photo, C-CDA, imaging, portal, lab, and device imports; PicnicHealth exposes original imaging and longitudinal records. | Add C-CDA, bulk PDF/photo upload with OCR and patient confirmation, DICOM retrieval/viewer, SMART Health Card import, and patient-authorized records-request fallback. |
| Search and source-linked understanding | PicnicHealth advertises AI search, contextual explanations, highlights, and record links. | Universal search across originals and normalized facts; every AI answer cites the source record and supports “show original.” |
| Medication management | Apple Health and Guava offer medication schedules/reminders; Guava advertises pill supply, refill alerts, and effect tracking. | Schedules, reminders, adherence, refill workflow, PRN handling, reconciliation, and patient/provider disagreement state. |
| Daily condition management | Guava advertises symptom, pain, mood, habit, cycle, and device tracking with correlations. | Configurable symptoms/PROs, goals, triggers, trends, correlations with clear non-causal language, and export into visit preparation. |
| Visit preparation and collaboration | Guava and PicnicHealth advertise concise visit summaries and sharing; MyChart provides messaging, appointments, and proxy workflows within participating systems. | Visit agenda, questions, recent changes, provider-ready summary, receipt of share, and a separate roadmap for bidirectional provider communication. |
| Imaging and original artifacts | PicnicHealth advertises viewing MRIs, X-rays, and CTs rather than reports alone. | Preserve and display original documents and DICOM where legally and technically available; never reduce the record to normalized FHIR facts only. |
| Completeness and correction | Competitors emphasize organization/search, but this is an opportunity to lead. | Show source coverage, last sync, missing periods, failed imports, confidence, duplicates, conflicts, patient annotations, and correction status. |
| Granular delegation | Apple and MyChart support health/proxy sharing; consumer PHRs support caregiver access. | Topic/resource-level, time-limited, revocable sharing; minors and capacity transitions; recipient audit; no-account emergency/provider share. |
| Durable portability | Most products export summaries; a patient-owned leader should go further. | FHIR R4, C-CDA, originals, DICOM, provenance/audit, and accessible HTML/PDF export, available without a paid subscription. |

The product also needs a narrower initial wedge. “Everyone, every language, every record source, devices, voice, AI, and world markets” is not an MVP. A stronger thesis is **multilingual patients and caregivers managing fragmented chronic care**, measured by successful first connection, record completeness/freshness, medication-list confirmation, accessible task completion, provider-share completion, and 90-day retention.

## Regulatory traps to address explicitly

1. **HIPAA versus FTC HBNR:** Determine the legal role per offering. Build HBNR unauthorized-disclosure analysis and notices into incident response; do not imply that vendor BAAs extend HIPAA to the consumer product.
2. **State consumer-health and privacy laws:** Washington My Health My Data requires a consumer-health privacy policy and purpose-specific controls, including separate consent for some sharing, and carries private-enforcement risk. Nevada has a dedicated consumer-health regime. California, Connecticut, Texas, and other state privacy, medical-information, biometric, breach, and minor-consent laws require a maintained applicability matrix, not a single “US/HIPAA” label.
3. **CMS terms:** Blue Button production access requires public privacy/terms, active opt-in, explicit controls on disclosure, security safeguards, and CMS review of relevant policy changes. Using authorization success for discount eligibility is a secondary purpose that needs separate, minimal, optional consent. Never collect Medicare.gov credentials.
4. **ONC information blocking:** Certified API developers have registration and production-enablement duties, and unjustified delays may be nonconformant. That does not guarantee all providers, all EHI, or frictionless tenant activation. Describe suspected obstruction as potential information blocking and preserve evidence.
5. **42 CFR Part 2:** Preserve origin and consent metadata for records from Part 2 programs. Reconciliation must not erase sensitivity labels or disclosure restrictions. Add disclosure accounting, revocation, legal-proceeding protections, and the applicable breach path.
6. **Minors and personal representatives:** Authority and confidentiality vary by state, service, age, emancipation, and safety context. Parent access cannot default to the entire child's record.
7. **Section 508, ADA, Section 504, and Section 1557:** Section 508 directly governs federal ICT and procurement, not every private consumer app. Federal contracts, federally funded partners, healthcare entities, and public accommodations can introduce other accessibility obligations. Keep WCAG 2.2 AA as the product standard, but state the legal basis accurately and evaluate native software, documents, support, and third-party journeys.
8. **Clinical and device regulation:** Symptom checking, risk scores, medication guidance, and AI explanations need a documented intended-use boundary and FDA clinical-decision-support/SaMD analysis. HealthKit and Health Connect impose platform consent, minimization, disclosure, and prohibited-use rules independently of HIPAA.
9. **Sponsor and benefit design:** Payer or clinic sponsorship can change HIPAA roles and member-communication obligations. Medicare/Medicaid sponsors need review of marketing, inducement, nondiscrimination, accessibility, grievance, and benefit-approval implications before the product promises a subsidized tier.
10. **International launch:** GDPR/UK GDPR, DPDP, and national health-data laws require country-specific lawful basis, contracts, transfers, rights, security, and breach processes. A registry enum is not evidence of compliance.

## Recommended changes to the two documents

### P0 — Before approving the architecture or public claims

1. Add the offering-by-offering legal-role and regulatory-control matrix.
2. Redraw the data-flow diagram to include devices, browser/native storage, source systems, Fasten, identity, support, logs, notifications, payments, and all subprocessors; state retention and deletion for each.
3. Replace autonomous semantic dedup with a validated, reversible, human-reviewed clinical-safety workflow.
4. Replace the pricing section with measured contribution-margin scenarios and contracted vendor costs. Separate affordability policy from cost claims.
5. Make security and accessibility explicit production gates with named evidence and no waiver for safety-critical journeys.
6. Correct “PHI only in GCP,” “any language,” “world,” “fully loaded,” Blue Button, HIPAA, and information-blocking wording.

### P1 — Required for the Medicaid/Medicare MVP

1. Establish reliable recurring sync, source completeness/freshness, failed-import recovery, and endpoint support.
2. Ship one proven on-device connector and publish a tested device/OS compatibility matrix.
3. Add patient ownership/export/correction commitments and no-surprise eligibility transitions.
4. Implement granular caregiver, minor, Part 2, and sensitive-record authorization.
5. Complete blocking web/iOS/Android/PDF/voice/multilingual accessibility testing and publish a versioned ACR.
6. Add HBNR/state/CMS/Part 2 incident decision trees and run a tabletop.

### P2 — Best-in-class differentiation

1. Add PDF/photo/C-CDA/DICOM acquisition and original-artifact preservation.
2. Add universal source-linked search, medication management, symptom/PRO tracking, trends, visit preparation, and provider-ready sharing.
3. Launch countries individually against legal, residency, language, accessibility, exchange, support, and payment gates.
4. Measure outcomes that matter: connection success, record completeness, duplicate/conflict correction, medication confirmation, accessible task completion, sharing success, support burden, retention, and cost per active member.

## Primary sources checked

- HHS, [The access right, health apps, and APIs](https://www.hhs.gov/hipaa/for-professionals/privacy/guidance/access-right-health-apps-apis/index.html)
- FTC, [Health Breach Notification Rule guidance](https://www.ftc.gov/business-guidance/resources/complying-ftcs-health-breach-notification-rule-0)
- Washington Legislature, [My Health My Data Act, RCW 19.373](https://app.leg.wa.gov/RCW/default.aspx?cite=19.373&full=true)
- Nevada Legislature, [consumer health data provisions in NRS 603A](https://www.leg.state.nv.us/NRS/NRS-603A.html)
- ASTP/ONC, [API Conditions and Maintenance of Certification](https://healthit.gov/certification-health-it/conditions-ccg/application-programming-interfaces/)
- CMS, [Blue Button production access](https://bluebutton.cms.gov/production-access/) and [Terms of Service](https://bluebutton.cms.gov/terms/)
- W3C, [WCAG 2.2](https://www.w3.org/TR/WCAG22/) and [WCAG2ICT](https://www.w3.org/WAI/standards-guidelines/wcag/non-web-ict/)
- Google Cloud, [Cloud Healthcare API pricing](https://cloud.google.com/healthcare-api/pricing), [Speech-to-Text pricing](https://cloud.google.com/speech-to-text/pricing), and [Text-to-Speech pricing](https://cloud.google.com/text-to-speech/pricing)
- Stripe, [US payment pricing](https://stripe.com/pricing)
- Google Play, [Health Connect permissions policy](https://support.google.com/googleplay/android-developer/answer/16558241)
- Apple, [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- Public competitor materials: [Guava](https://guavahealth.com/), [PicnicHealth](https://picnichealth.com/explore-the-app), [MyChart](https://www.mychart.org/), and [Apple Health](https://www.apple.com/ios/health/)
