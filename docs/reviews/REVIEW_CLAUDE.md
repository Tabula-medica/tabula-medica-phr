# Independent review — Consolidation plan and pricing

**Reviewed:** `docs/CONSOLIDATION_PLAN.md` and `docs/PRICING.md` on branch `cursor/phr-consolidation-plan-2999` (PR #272), plus the scaffolding they cite.
**Date:** 24 October 2026
**Reviewer roles:** health-tech product strategist, HIPAA/security architect, accessibility lead.
**Scope:** documents only. No code was changed. Where a finding rests on repo code, the file is cited. Where it rests on outside law or a vendor price, it is marked **verify** when the reviewer could not confirm the current text on the day of writing. This review is not legal advice. Counsel should confirm every item in section 5 before launch.

## Verdict in one paragraph

The plan is unusually honest about what it could not read, and its core architecture holds up: one codebase, a FHIR store as the system of record, provenance-preserving reconciliation, Fasten plus direct SMART, and PHI processors limited to Google Cloud. Its biggest weakness is that it treats HIPAA as the law that governs the product. For a direct-to-consumer PHR, the FTC Health Breach Notification Rule, Section 5 of the FTC Act, and state consumer-health-data laws govern most of the time. HIPAA applies only when a covered entity sponsors the member. Two live code paths already conflict with the plan's own boundary: third-party analytics on authenticated health pages, and browser speech APIs that are not on-device. The pricing math is right for the rows it includes, but it leaves out the costs that actually decide whether a $1 tier works: payment processing, Fasten's per-connection fee, translation, and the medical speech models. Identity proofing and patient matching are missing entirely. Every one of these is fixable before MVP, but each one has to be planned for explicitly.

---

## 1. Top 10 gaps and risks, ranked by severity

Severity: **Critical** = could cause a reportable breach, regulatory action, or patient harm at launch. **High** = blocks a pillar or the business model. **Medium** = must be fixed before scale.

### 1. Critical — The regulatory regime is misidentified, and a live disclosure path already exists

The plan's section 9 is a "HIPAA checklist", and the plan says "PHI" throughout. When a member signs up and pays directly, Tabula Medica is neither a covered entity nor a business associate. It is a **vendor of personal health records**, so the FTC Health Breach Notification Rule (16 CFR Part 318, amended 2024) applies, together with FTC Act §5 and state consumer-health laws. Under the amended rule, a "breach of security" includes an **unauthorized disclosure**, not only a hack. The FTC enforced exactly that theory against GoodRx, Premom, and BetterHelp over analytics and pixels.

Evidence that this is live today: `client/index.html` loads Plausible from `plausible.io` on every route except an exclude list (`/admin/**`, `/patient/**`, `/settings/**`, `/auth/**`, and a few others). The member chart routes are top-level paths: `/conditions`, `/medications`, `/timeline`, `/care-gaps`, `/womens-health`, and `/advance-directives` (`client/src/App.tsx` lines 239–397). None of them is excluded. Every page view sends a health-condition-revealing URL to a third party, from the member's IP address. Plausible being cookieless lowers the risk, but it does not make this an authorized disclosure under HBNR.

A second trap: when a Medicaid plan, a Medicare Advantage plan, or a clinic **sponsors** the dollar and wants anything back (care-gap reports, engagement data), Tabula becomes that covered entity's business associate for those members. HIPAA's breach rule then replaces HBNR for those records, which means two regimes in one database. The plan has no per-member flag for this.

**Fix:** see recommendations R1–R4.

### 2. Critical — No identity proofing and no cross-source patient matching

Login is Google or Apple popup sign-in through Identity Platform. That is IAL1: it proves control of an account, not who the person is. The plan then merges everything into "the same patient compartment", but nothing checks that the Epic chart, the Blue Button claims, and the Fasten export belong to the same human. Real failure modes:

- A caregiver connects a parent's portal inside the caregiver's own account, and the parent's diagnoses enter the caregiver's record.
- A shared family tablet.
- A member links a second person's Medicaid portal to qualify for the $1 tier.

`reconcileDeterministic` trusts `patientId` completely (`shared/fhir/reconcile.ts`). On top of that, TEFCA Individual Access Services requires IAL2 identity proofing, and the CMS Interoperability Framework (the July 2025 "Health Tech Ecosystem" pledge) calls for IAL2/AAL2 credentials such as Login.gov, ID.me, or CLEAR (**verify** the current CMS requirements). Without proofing, the v2 TEFCA item and any CMS-aligned distribution are unreachable.

**Fix:** R5–R7.

### 3. Critical — "On-device speech" is not on-device in the shipped client

`shared/voice/policy.ts` correctly lists browser Web Speech as outside the boundary. But the client already uses `webkitSpeechRecognition` and `window.speechSynthesis` in 10 files, including `use-voice-navigation.ts`, `voice-input.tsx`, `ai-voice-assistant.tsx`, `use-auto-read.ts`, and `explain-page-button.tsx`.

- **Recognition:** in Chrome, and in Android WebView builds based on it, `webkitSpeechRecognition` streams audio to Google's consumer speech servers. That is not Cloud Speech-to-Text and is not covered by the Cloud BAA. On iOS, `SFSpeechRecognizer` uses Apple servers unless the app sets `requiresOnDeviceRecognition`.
- **Synthesis:** Chrome's "Google …" voices are network voices.

Read-aloud of a lab value through one of those voices sends PHI to a non-BAA service. The policy module has no client-side enforcement, so "on-device first" is an intention, not a control. This undercuts the voice-first pillar and the "PHI only in GCP under a BAA" rule at the same time.

**Fix:** R8–R9.

### 4. High — Reconciliation rules will silently merge distinct facts and flag false conflicts

Reading `shared/fhir/reconcile.ts` against real data:

- **False merges.** `factKey` is code + **calendar day** + value. Two genuine readings of heart rate 72 on the same day (a device writes hundreds per day), or two fasting glucose results of 100 a week apart that a source dated imprecisely, collapse into one group. For devices, the stable source id should win over the fact key, but the union-find merges on either key.
- **False conflicts.** Any two same-day singletons with the same code and different values become `same-code-different-value`. Morning and evening blood pressure are not a conflict. The screen would show disagreement where none exists.
- **No time zone.** "Calendar day" with no zone splits or merges readings around midnight, which matters especially for world-region members.
- **Cross-type duplicates are invisible.** A Blue Button `ExplanationOfBenefit` Part D fill and an Epic `MedicationRequest` describe the same drug. Matching requires the same `resourceType`, so these never meet.
- **Lifecycle is ignored.** `status` values such as `entered-in-error`, `amended`, `preliminary`→`final`, and a source's later retraction are not modeled. A corrected lab stays beside the wrong one indefinitely.
- **Scale.** The semantic-candidate loop is O(n²) over singletons. A member with a year of HealthKit data produces tens of thousands of Observations, which means billions of comparisons, and each candidate is a potential paid Vertex call.
- **Auto-merge on a model score.** `applySemanticDecision` merges whenever `same` is true, with no threshold, no class-specific policy, and no patient confirmation. Merging two insulin products, or two allergies, on an embedding score is a patient-safety risk.

**Fix:** R10–R12.

### 5. High — The unit economics omit the costs that decide the $1 tier

The Google Cloud rows are arithmetically right (section 4). The missing rows are larger than everything that was counted:

- Card processing at $1 a month is roughly a third of revenue.
- The Fasten per-connection fee is unmodeled.
- Eager translation of a full imported record can cost several dollars per member.
- The existing medical speech models (`medical_dictation` and `medical_conversation` in `server/services/gcp/medical-speech-to-text.ts`) are priced well above the standard model and are English-only.
- Cloud Armor requires a load balancer, which is a fixed monthly cost.
- Support costs are missing entirely. Older, low-literacy, and limited-English members drive the most support contacts.

**Fix:** R13–R17.

### 6. High — The "world" region is a TEFCA switch, not a data-residency or privacy regime

`deploy-world.sh` deploys to `REGION=us-central1` in the same project, with `DATABASE_URL=patient-db-secret-us-central1`. The FHIR store path is hardcoded to `us-central1` (`server/utils/healthcareUtils.ts:503`). So a member in Germany, India, or Brazil has their health data stored in Iowa.

- GDPR treats health data as Article 9 special-category data. The transfer needs a lawful mechanism such as the EU–US Data Privacy Framework, SCCs, or explicit consent, plus a DPIA.
- India's DPDP Act and its Rules carry cross-border conditions, and ABDM's health data policy expects storage in India (**verify** the current DPDP phase-in and ABDM localization text).
- The EU EHDS regulation adds wellness-app labelling and interoperability duties as it phases in.

The plan says the privacy regime "comes from `shared/jurisdictions.ts`", but nothing routes storage by jurisdiction.

`parseDeploymentRegion` also **fails open**: any unexpected value, such as a typo like `wrld`, becomes `us` with TEFCA on. For a compliance switch, an unknown value should fail closed.

**Fix:** R18–R19.

### 7. High — Too many PHI copies, with no defined deletion, amendment, or retention path

The plan describes up to five copies of PHI:

- the in-memory store (`server/storage.ts`, which holds bulk PHI today),
- the FHIR store, which keeps resource **version history** by default,
- the Cloud SQL projection,
- raw exports in GCS,
- on-device caches for the offline emergency card.

It also mentions backups. Only "export, then audited removal of the compartment" is described. Each copy needs its own answers:

- **Erasure and backups.** How do erasure, state-law deletion, and GDPR Art 17 reach backups and FHIR history? This needs `$purge` or a history policy.
- **Correction.** How does a source correction propagate to the projection?
- **Raw-export retention.** How long does a raw export live? "Lifecycle rule" has no number.

The in-memory store is also unsafe on Cloud Run with no minimum instances. Scale-to-zero and multiple instances lose or fork PHI-bearing state.

**Fix:** R20–R21.

### 8. High — The accessibility legal bar is understated, and language-access law is missing

The plan says "the legal web bar is WCAG 2.0 AA." That is true only for Section 508 federal procurement. Several other rules set a higher bar:

- The HHS Section 504 final rule (45 CFR 84.84, May 2024) requires **WCAG 2.1 AA** for web and mobile apps of HHS funding recipients. The deadline is May 2026 for recipients with 15 or more employees. Medicaid and MA plans are recipients and flow this down to vendors.
- The DOJ ADA Title II rule sets WCAG 2.1 AA for state Medicaid agencies (**verify** the current compliance dates).
- The ACA §1557 final rule (2024) requires that machine translation of **critical** content be reviewed by a qualified human translator (45 CFR 92.201(c)(3)).
- Medicaid managed-care rules (42 CFR 438.10) require prevalent-language translations, taglines, and large print of at least 18 point.
- MA rules (42 CFR 422.2267) require translation for languages spoken by 5% of the service area.

A sponsor will put all of these in the contract.

Specific gaps in the plan:

- **Accessible Authentication (WCAG 2.2 SC 3.3.8).** TOTP codes typed from another app fail unless paste is allowed or a passkey is offered.
- **Complete processes (WCAG 2.2 conformance requirement 5).** The Fasten widget and each vendor's SMART login page are steps in our journey. If they fail, our journey fails. We need their ACRs.
- **Label in Name (SC 2.5.3).** This SC needs a test per language, because voice-control users speak the visible label.
- **Target Size Minimum (SC 2.5.8) and Focus Not Obscured (SC 2.4.11).** These are absent from the checklist.
- **Scope.** The client has **557 page files**. An honest ACR over that surface is not achievable. The member product has to be a small, gated route set.

**Fix:** R22–R26.

### 9. Medium-High — The coverage assumptions behind "Fasten plus direct SMART plus Blue Button" are optimistic

- **Blue Button 2.0 covers fee-for-service Medicare** (Parts A, B, and D claims). Medical encounters for Medicare Advantage members, now about half of Medicare, come from the MA plan's own Patient Access API. CMS also filters substance-use-disorder claims out of Blue Button (**verify**). So the "Medicare stronger check" works as proof of enrollment, but the claims history will be thin for MA members.
- **Most Medicaid enrollees are in managed care.** That means a separate Patient Access API registration per MCO, often hundreds of payers with uneven implementations, not "the state's API".
- **Direct SMART coverage needs endpoint discovery,** not just a client id. You need Epic's endpoint list, the ONC Lantern directory, and the service-base-URL publication that HTI-1 requires of certified developers. Oracle Health registrations are per tenant.
- **Fasten is conflated with TEFCA in code.** `App.tsx` line 232 renders `/fasten-connect` only when `tefcaEnabled`. A US deploy with `TEFCA_ENABLED=false` loses the primary retrieval path. Fasten Connect does not need TEFCA.
- **There is no path for the long tail.** Small practices, labs without APIs, and records on paper have no retrieval path. Best-in-class products (Ciitizen's model, PicnicHealth) solve this with a HIPAA right-of-access request letter, fax, and OCR.

**Fix:** R27–R29.

### 10. Medium — Clinical-safety, FDA, and fraud-and-abuse exposure in features the plan keeps

- **FDA software rules.** The symptom checker, AI lab explanations, ASCVD risk, and the assistant are **patient-facing** clinical decision support. The 21st Century Cures carve-out in FD&C §520(o)(1)(E) covers software for health care professionals, not patients. Each function needs an FDA enforcement-discretion analysis (general wellness versus low-risk patient decision support), a clinical safety case, and guardrails against hallucinated values.
- **Machine-translated clinical text.** Dose instructions translated by machine carry liability, and §1557 applies when a sponsor brings it in. The bilingual original-beside-translation pattern is right but not sufficient for medication directions.
- **Manufacturer copay coupons.** `client/src/pages/drug-savings.tsx` shows manufacturer assistance programs and coupons. Manufacturer copay coupons cannot be used for drugs paid by Medicare or Medicaid (federal Anti-Kickback Statute), and the $1 tier is, by definition, government beneficiaries. Showing them without that caveat is a trap.
- **Who sponsors the dollar matters.** A clinic or a manufacturer paying the dollar for Medicare or Medicaid beneficiaries is remuneration to a beneficiary (Beneficiary Inducements CMP; AKS when a manufacturer pays). $12 a year sits under OIG's nominal-value guidance, but manufacturer sponsorship should be barred outright.

**Fix:** R30–R32.

---

## 2. Wrong or fragile assumptions

| # | Assumption in the plan | Why it is wrong or fragile |
| --- | --- | --- |
| A1 | "PHI" and the HIPAA checklist are the governing frame | For the direct-to-consumer product the data is "PHR identifiable health information" under FTC HBNR, plus "consumer health data" under state laws. HIPAA applies only to sponsored, business-associate flows. A HIPAA-safeguards baseline is still a good engineering bar. Marketing copy must not call the product "HIPAA compliant" as a legal status (FTC §5 deception risk). |
| A2 | The Fasten BAA makes Fasten's processing HIPAA-covered | If Tabula is not a CE or BA, the "BAA" is a contract, not a HIPAA instrument. That is still valuable. The contract should also carry the HBNR third-party-service-provider notice duty (16 CFR 318.4) and a breach timeline. |
| A3 | "The direct patient-access path is how we honor the right of access" | The HIPAA right of access is the provider's duty to the patient, not ours. Our duty is a product and state-law portability promise (CCPA, GDPR Art 20). The reframing matters for what we must deliver and on what timeline. |
| A4 | Browser and WebView speech counts as "on-device" | See risk 3. It usually is not. |
| A5 | Cloudflare is outside the PHI boundary because the API is DNS-only | Cloudflare serves the **JavaScript** that reads every chart. Whoever can change that bundle (a Cloudflare account compromise, Rocket Loader, Zaraz, a Pages build hook) can exfiltrate PHI from the browser. The shell is in the trust boundary even if no PHI transits it. Also, SPA URLs and referrers can carry PHI. |
| A6 | Matching on calendar day plus value is safe | It is not safe for vitals or device streams. See risk 4. |
| A7 | Blue Button gives a Medicare member their history | It gives fee-for-service history. MA members need their plan's API. See risk 9. |
| A8 | "Any language" | The UI ships in 22 languages (`SUPPORTED_LANGUAGES`). Common Medicaid limited-English languages are missing: Haitian Creole, Somali, Hmong, Amharic, Karen, Burmese, and Navajo. The medical speech models are en-US only. The honest claim is "text in N languages, voice in M, translation of records in K", published as a matrix. |
| A9 | Scale-to-zero Cloud Run is fine | Cold starts on a large Express bundle cost seconds on a slow phone, which is exactly the low-bandwidth persona. The in-memory store loses state on scale-in. |
| A10 | One price page check is enough | Speech-to-Text v1 standard pricing depends on the data-logging opt-in. The plan requires logging **off**, which is the higher v1 price (**verify**). The plan's $0.016/min matches either v2 or v1 with logging on, not v1 with logging off. |
| A11 | `TABULA_REGION` gives a world privacy posture | It changes TEFCA only. Storage, processors, and law stay US. See risk 6. |
| A12 | The comparison table is complete | It omits Google's own path: Health Connect gained FHIR medical-records support in Android 16 (**verify** rollout). It also omits Epic's MyChart Central and Happy Together, b.well, Flexpa, PicnicHealth, 1upHealth, and Fasten's own open-source self-hosted PHR. Apple Health Records is not US-only; it runs in the UK and Canada too (**verify**). |
| A13 | Healthcare Natural Language API is the semantic-dedup engine | Confirm it is still a supported product before designing around it. Google has been consolidating healthcare NLP into Vertex and Gemini, and MedLM was retired (**verify**). Embeddings plus a Gemini adjudication prompt is the safer default. |
| A14 | An operating-system permission plus a consent receipt is enough for device data | Washington's MHMDA, Nevada SB 370, and Connecticut require **separate** consent for collection and for sharing, and a written authorization for any sale. The receipt model is right. The consent text and the scopes need state-specific variants. |

---

## 3. Missing features versus best-in-class

| Capability | Who does it well | In the plan? | Recommendation |
| --- | --- | --- | --- |
| Share a record with a clinician by link or QR code, time-limited | MyChart Share Everywhere, SMART Health Links (IPS over SHL) | Signed passport only | Adopt **SMART Health Links** for IPS and care packets, and **SMART Health Cards** for immunizations. Both are open standards that clinics can read without an account. |
| Proxy and caregiver access backed by legal authority | MyChart proxy | "Permissioned" caregivers | Add role types (parent of a minor, guardian, POA, healthcare agent) with a document upload, expiry, and audit. Handle the **adolescent confidentiality** cut-over at state-law ages (often 12–13 and 18). |
| Retrieval for the long tail | Ciitizen-style access requests, PicnicHealth | Explicitly out of scope | Generate a HIPAA right-of-access request letter (30-day clock, fee limits), send it by fax or email through a BAA-covered fax vendor, and OCR the returned PDFs with Document AI under the BAA. |
| C-CDA, PDF, and photo upload with structuring | Fasten, 1upHealth | "Uploads join at the FHIR store" | Parse C-CDA to FHIR and OCR images. Tag the source as `upload` and the assurance as patient-provided. |
| New-result notifications | MyChart, Apple Health Records | Absent | Push "You have a new result" with **no PHI in the payload**, because APNs and FCM are not BAA services. Open the app to read. |
| Medicaid redetermination reminders | No consumer PHR does this well | Absent | High value for the target population. Remind members of renewal dates (member-entered) and link to the state portal. A low-cost differentiator. |
| Medications: reminders, refill prompts, interaction check | Apple Health medications, Medisafe | Medication guide only | Add schedules and reminders. Run interaction checks on RxNorm, with a pharmacist-reviewed source. |
| Insurance card wallet and an explanation of claims | b.well, Flexpa | Partial | Blue Button and payer API claims, explained in plain language: "What this visit cost you." |
| Visit prep and visit capture | MyChart questionnaires | Absent | Questions to ask, a member-recorded visit summary (consented, Cloud Speech), and an after-visit summary upload. |
| Open notes in plain language | OpenNotes ecosystem | Lab explainer only | Explain notes with the original beside the explanation and links to cited terms. |
| Lock-screen emergency information | Apple Medical ID, Android emergency info | Emergency card in app | Offer to write a minimal subset to the OS emergency profile, member-chosen, with clear consent that this data then leaves our boundary. |
| Interpreter request card | — | Absent | A one-tap card in the member's language plus English: "I need a [language] interpreter." Free, and strong for limited-English members. |
| Research data donation with granular consent | Apple Research, All of Us | Trial matching only | Defer it, but design the consent model now so later sharing is opt-in per study. |
| Legacy contact and death handling | Apple Legacy Contact | Absent | Designate who gets the record, define inactivity rules, and verify a death certificate. |
| Crisis path | 988 integration in many apps | "Crisis path in the patient's language" | Name it: 988 in the US, a jurisdiction table for world, shown on PHQ-9 item 9. Test the routing. |
| Export in every format | Fasten, Apple | IPS and existing routes | FHIR Bulk/NDJSON, C-CDA, tagged PDF, and IPS. Free and self-serve. |

---

## 4. Cost math check (`docs/PRICING.md`)

### 4.1 Rows that check out

| Row | Plan | Reviewer recomputation | Status |
| --- | ---: | ---: | --- |
| Cloud SQL vCPU | 730 × 0.0413 = 30.15 | 30.149 | Correct (matches the published Enterprise us-central1 rate) |
| Cloud SQL RAM | 730 × 3.75 × 0.007 = 19.16 | 19.163 | Correct |
| SSD 20 GiB | 3.40 | 20 × 0.17 = 3.40 | Correct |
| Backups 20 GiB | 1.60 | 20 × 0.08 = 1.60 | Correct |
| Floor total | about 66 | 66.31 | Correct for the items listed |
| Floor per member at 1,000 / 200 | 0.07 / 0.33 | 0.066 / 0.332 | Correct |
| Cloud Run per member | about 0.002 | CPU 240 × 0.3 × 0.000024 = 0.00173; memory 0.5 × 72 × 0.0000025 = 0.00009; requests 240 × $0.40/M = 0.0001; total ≈ 0.0019 | Correct |
| GCS 50 MB | 0.001 | 0.05 × 0.020 = 0.001 | Correct |
| Egress 50 MB | 0.006 | 0.05 × 0.12 = 0.006 | Correct |
| Vertex, 20 short calls | up to 0.10 | Gemini Flash-class at about 2k tokens in and 500 out per call ≈ $0.03–0.05 (**verify** the model price) | Conservative; fine |

### 4.2 Rows that are missing or likely wrong

| Item | Effect per member per month | Notes |
| --- | ---: | --- |
| **Card processing on $1 a month** | **≈ $0.33** (2.9% + $0.30) | The largest single cost. Annual $10 ≈ $0.59 a year ≈ **$0.05 a month**. Micropayment pricing (about 5% + $0.05, **verify**) ≈ $0.10. Members without cards cannot pay at all. |
| **App store** | $0.15 of $0.99 at 15% | Small Business Program or second-year subscription rate. The US anti-steering rulings of 2025 let US apps link out to web checkout (**verify** the current Apple and Google terms). |
| **Fasten per-connection fee** | Unknown; **each $1 per connection per year = $0.083 per month** | 3 connections at $3 a year each = $0.75 a month, which is most of the dollar. This is the variable the tier lives or dies on. Get the contract numbers into the doc. |
| **Translation of records** | One-time $2–$10 if eager; $0.05–$0.20 if lazy | Cloud Translation NMT ≈ $20 per million characters after a 500k free tier (**verify**). An imported multi-year record can carry 100k–500k characters of narrative. Translate on view, cache per language, and never translate the whole record on import. |
| **Speech-to-Text at 10 minutes** | $0.16 (plan) → **$0.24** with v1 logging off → **≈ $0.78** with medical models | Medical models are en-US only (**verify** current prices). Use v2/Chirp for non-English and cap the medical model. |
| **Text-to-Speech at 10 minutes (≈ 9k characters)** | $0.04 Standard / $0.14 WaveNet or Neural2 / $0.27 Chirp HD | TTS is priced per character, not per minute (**verify**). The plan treats the STT and TTS allowance as one pool; meter them separately. |
| **Device data as FHIR writes** | ≈ $0.03+ per month at one heart-rate sample every 5 minutes, and growing | About 8,640 creates a month at roughly $0.39 per 100k standard requests, plus storage and reconcile load (**verify** Healthcare API pricing). Aggregate to daily or hourly summaries before writing. |
| **Load balancer for Cloud Armor** | Floor +$20–25 a month | Cloud Armor attaches to an external Application Load Balancer (a forwarding rule ≈ $18 a month, plus policy and rule fees). |
| **Minimum instance of 1** | Floor +$10–15 a month | Recommended for cold starts. See A9. |
| **Healthcare API Data Access audit logs** | Small, nonzero | These must be **enabled** (they are off by default), and they count against Cloud Logging ingestion beyond the free tier. |
| **Support, compliance, insurance** | Not GCP, but real | External ACR audit, penetration test, cyber insurance, and BAA-grade fax and email vendors are five-figure annual fixed costs. One phone support contact costs more than a year of the tier. |

### 4.3 Reviewer's fully loaded estimate (at 1,000 active members)

| Scenario | GCP | Payments | Fasten (2 connections at $3 a year each, assumption) | Total per member per month |
| --- | ---: | ---: | ---: | ---: |
| Plan as written: monthly card, eager translation, medical STT | ~0.25 + 0.30 translation amortized + 0.78 | 0.33 | 0.50 | **≈ $2.15, negative margin** |
| Recommended: annual $10, lazy translation, v2 STT, on-device first | ~0.15–0.30 | 0.05 | 0.50 | **≈ $0.70–0.85** |
| Sponsor-paid by ACH invoice, direct SMART only | ~0.15–0.30 | ≈ 0 | 0 | **≈ $0.15–0.30** |

**Conclusion:** $1 is achievable, but only with annual or sponsor billing, lazy translation, metered speech by engine, and a Fasten contract that is flat-fee or capped per member. Monthly $1 by card should not be offered.

---

## 5. Regulatory traps

### 5.1 HIPAA versus FTC HBNR (decide the regime per account)

| Situation | Regime | Breach notice |
| --- | --- | --- |
| Member signs up and pays directly | FTC HBNR + FTC Act §5 + state laws | Individuals, FTC, and media (500+ residents of a state) within 60 days. Under the 2024 amendments, notify the FTC at the same time as individuals for 500+. Civil penalties above $50k per violation (inflation-adjusted, **verify**) |
| A plan or clinic sponsors the member **and receives data or directs the service** | HIPAA, with Tabula as business associate; a BAA is required | To the covered entity without unreasonable delay (60 days at most); the CE notifies HHS |
| A sponsor only pays the subscription, receives nothing, and directs nothing | Usually still HBNR (**counsel to confirm**) | As in the first row |
| Data the member received through a CE's patient-access API | Not PHI once it is in our hands (the CE disclosed it at the patient's direction) | HBNR |

Consequences:

- Store a `regulatoryRegime` per member and per data flow.
- Keep the HIPAA Security Rule controls for everyone. That is the engineering bar, not the legal label.
- Write an HBNR incident runbook next to the HIPAA one.
- Remove every third-party script from authenticated routes.
- Audit marketing for "HIPAA compliant" wording.

### 5.2 CMS terms

- **Blue Button 2.0 production access** requires approval, a privacy policy and terms that meet CMS criteria, no sale of beneficiary data, honoring data-deletion requests, and CMS's right to revoke. Member authorizations are time-limited (13-month or one-time access, **verify**), which aligns with the 12-month re-attestation.
- **Payer Patient Access APIs** (CMS-9115-F) let payers ask apps to attest to privacy practices. Sign the **CARIN Code of Conduct** and publish the ONC **Model Privacy Notice**. This removes most registration friction. CMS-0057-F adds prior-authorization data to Patient Access APIs from January 2027, which is the clean source for the plan's "prior-auth status the patient can see."
- **CMS Interoperability Framework and the Health Tech Ecosystem pledge.** Being a "CMS Aligned" patient app may unlock Medicare.gov app-directory distribution. It carries IAL2, privacy, and network obligations (**verify** the current criteria and dates). This is a strategic opportunity the plan does not mention.
- **Medicare Advantage sponsorship.** Plan-branded communications delivered in the app can be "marketing" or "communications" under 42 CFR 422.2260–2267, with translation and HPMS-filing duties. Never steer plan choice.
- **Medicaid MCO sponsorship.** This is usually a "value-added benefit" that needs state approval, and 42 CFR 438.10 materials rules flow down.
- **Fraud and abuse.** Bar manufacturer sponsorship. Cap clinic sponsorship at OIG nominal-value guidance. Hide or caveat manufacturer copay coupons for Medicare and Medicaid members.

### 5.3 State privacy laws

- **Washington My Health My Data Act.** Applies to non-HIPAA consumer health data: separate consent for collection and for sharing, a signed authorization to sell, a geofencing ban, deletion including from processors, and a **private right of action**. Applies to anyone whose data is processed in Washington.
- **Nevada SB 370 and the Connecticut consumer-health-data amendments.** Similar consent model.
- **California.** CMIA **Civil Code §56.06** treats a business that offers PHR software to consumers as a provider of health care subject to the CMIA, with statutory damages. CCPA/CPRA treats health data as sensitive personal information.
- **Texas.** HB 300 (Health & Safety Code ch. 181) defines a "covered entity" broadly enough to include a PHR that stores PHI. It brings training duties and its own penalties. TDPSA covers sensitive data.
- **Maryland Online Data Privacy Act** (effective October 2025). Requires that sensitive-data collection be "strictly necessary" and bans its sale.
- **New York Health Information Privacy Act.** Track its status (**verify**).
- **Reproductive and gender-affirming care.** The 2024 HIPAA reproductive-health privacy rule was vacated in 2025 (*Purl v. HHS*, **verify** whether an appeal is pending). State shield laws vary. `womens-health` and pregnancy data need a law-enforcement-request policy, minimal location data, and member-controlled hiding.
- **42 CFR Part 2.** Substance-use-disorder records that arrive through Fasten or SMART may carry Part 2 security labels. Keep the label, and exclude those records from caregiver and sponsor views by default.
- **Minors.** COPPA applies under 13. State minor-consent laws govern what a parent proxy may see.
- **Breach laws.** All 50 states have them, and many include medical and insurance information. They often run in parallel with HBNR.

### 5.4 ONC information blocking

- Tabula is **not an actor** under 45 CFR Part 171 (not a provider, not a developer of certified health IT, not an HIN/HIE), so information blocking does not bind it. That changes if the same legal entity ships certified health IT or runs the clinic product as a network. Keep `omnihealth-ehr` in a separate entity, or analyze it.
- Use the rule as **leverage**. A provider or developer that refuses a patient-directed app registration, or slow-walks it, risks information blocking. Only narrow security exceptions apply. Keep a template complaint for ONC's Information Blocking Portal.
- HTI-1 requires certified API developers to publish FHIR service base URLs. Build endpoint discovery on those directories instead of hand-collected lists.
- **TEFCA Individual Access Services.** Non-HIPAA IAS providers must meet the Common Agreement's privacy and security terms, including IAL2. This is another reason identity proofing belongs in v1, not v2.

### 5.5 FDA and AI

Patient-facing symptom triage, lab interpretation, and risk scores need a documented regulatory position:

- general wellness,
- enforcement discretion under the Device Software Functions policy,
- or SaMD.

Also budget for state AI-disclosure laws (Utah, Colorado's AI Act for consequential healthcare decisions; **verify** effective dates). Keep a model card and a human-reviewed prompt set for every patient-facing explanation.

---

## 6. Additional security findings

1. **VPC Service Controls are absent from the plan.** Put the Healthcare API, GCS, Cloud SQL Admin, Vertex, Speech, and Translation inside a VPC-SC perimeter. Set the org policies `gcp.resourceLocations` (which also enforces world residency) and restrict the service-usage allow-list to BAA-covered services.
2. **Remove `OPENAI_API_KEY` from production secrets** (`deploy-world.sh` line 30 injects it). The Vertex alias in `script/build.ts` is the only thing between ~280 `new OpenAI()` call sites and api.openai.com. With a live key in the environment, an alias regression is an immediate breach. Without a key, it fails closed. `npm run dev` runs through `tsx`, which does not apply the esbuild alias, so development with a real key reaches OpenAI. Keep a placeholder in development and never use real data there.
3. **Region parsing should fail closed.** Reject unknown `TABULA_REGION` values at boot instead of defaulting to `us`.
4. **The Cloudflare shell needs supply-chain controls.** Use a strict CSP (`connect-src` limited to the API and Firebase), SRI where possible, Rocket Loader, Zaraz, and Web Analytics off, Pages deploys only from CI, Cloudflare account MFA and audit, and no PHI in URLs or query strings (`Referrer-Policy: no-referrer`).
5. **Mobile.** Capacitor WebView caches, `localStorage`, app-switcher screenshots, and the offline emergency card. Encrypt anything cached (Keychain/Keystore), wipe on logout, and blur in the app switcher. Push payloads carry no PHI.
6. **Enable Healthcare API Data Access audit logs.** Route them to a locked bucket with retention. The audit requirement in the plan's section 9 is not met by application logs alone.
7. **Session timeout.** A 30-minute session that "keeps the half-finished form" must keep that draft encrypted server-side or in memory, not in plaintext `localStorage`.

---

## 7. Recommended changes (concrete)

### Regime and disclosures

- **R1.** Rename plan section 9 to "Privacy and security obligations" and split it into an FTC HBNR and state-law part and a HIPAA (sponsored, business-associate) part. Add the per-member `regulatoryRegime` field to the roadmap MVP.
- **R2.** **Before any beneficiary enrolls:** remove Plausible, and any other third-party script, from every authenticated and chart route. Better: make the exclude list an allow-list of public marketing paths only, or self-host analytics inside GCP. Add a CI test that fails if a third-party origin appears on an authenticated route.
- **R3.** Write the HBNR breach runbook. Add HBNR third-party-provider notice terms to the Fasten contract and to every future device vendor contract.
- **R4.** Adopt the CARIN Code of Conduct and the ONC Model Privacy Notice. Publish a consumer-health-data privacy policy that meets Washington, Nevada, and Connecticut requirements, with separate collection and sharing consents.

### Identity and matching

- **R5.** Add identity proofing to v1: IAL2 through Login.gov, ID.me, or CLEAR (all BAA- or contract-eligible, **verify**). Require it for TEFCA, sponsor-billed members, and caregiver roles. Keep IAL1 for public tools.
- **R6.** On every new source connection, compare the source `Patient` resource (name, birth date, sex, and address when present) to the member's profile. If they mismatch, quarantine the import and ask the member, "Is this you or someone you care for?" Route a "someone I care for" answer into a separate compartment under a caregiver role.
- **R7.** Offer passkeys in addition to Google and Apple, with an account-recovery path that works for people without either account. That also satisfies WCAG 2.2 SC 3.3.8.

### Voice

- **R8.** Inventory the 10 client files that use Web Speech. Gate them behind a capability check: native on-device engines through a Capacitor plugin with `requiresOnDeviceRecognition` on iOS and on-device `SpeechRecognizer` on Android, otherwise Cloud Speech or TTS through Cloud Run. Disable browser `webkitSpeechRecognition` for anything that can carry PHI. Allow `speechSynthesis` only with `localService === true` voices.
- **R9.** Publish a per-language capability matrix (UI text, record translation, speech-to-text, read-aloud, human-reviewed or machine) and drive the language picker from it. Add Haitian Creole, Somali, Hmong, Amharic, Burmese, and Navajo to the backlog based on Medicaid limited-English data.

### Reconciliation

- **R10.** Change the deterministic rules:
  - device and source identifiers win, and the fact key does not apply to device streams;
  - use instants with time zone instead of a calendar day;
  - a conflict requires matching identifiers or a same-encounter link, not just the same day;
  - map `ExplanationOfBenefit` fills and `MedicationDispense`/`MedicationRequest` through RxNorm ingredient across types;
  - honor `status` and source retractions.
- **R11.** Block candidates by (code family, day window) before pairing. Cap semantic adjudications per member per month.
- **R12.** Semantic merges for medications, allergies, and problems are **suggestions** the member confirms ("Are these the same?"). Use auto-merge only above a calibrated threshold, only for low-risk classes, and only with a measured false-merge rate on a labeled test set. Record the model version on the group (already in `SemanticDecision`).

### Pricing

- **R13.** Make **$10 a year** the default beneficiary price. Offer $1 monthly only when a sponsor is invoiced by ACH. Consider $0 for the member when sponsored, which the doc already allows.
- **R14.** Add rows for payments, Fasten (with the contract number), translation, speech by engine and model, the load balancer, the minimum instance, and audit logging. Add a sensitivity table on Fasten's fee.
- **R15.** Translate lazily, cache translations per resource and language, and never translate full imports eagerly.
- **R16.** Meter STT minutes and TTS characters separately. Use v2/Chirp for non-English. Restrict the medical models to English dictation with a hard cap.
- **R17.** Aggregate device streams (hourly or daily summaries, or `SampledData`) before writing FHIR.

### World region

- **R18.** Turn "region" into a residency control: a per-jurisdiction GCP region and FHIR dataset (`europe-west*`, `asia-south1`), routing by member jurisdiction at signup, and `gcp.resourceLocations` org policy per folder. Until then, do not market the world deployment in the EU or in India for chart storage. Run a DPIA and a transfer assessment.
- **R19.** Make `parseDeploymentRegion` reject unknown values. Gate Fasten on `region === "us"`, not on `tefcaEnabled` (`App.tsx:232`).

### Data lifecycle

- **R21.** Name one system of record, the FHIR store. Treat Cloud SQL as a rebuildable projection holding only the minimum fields. Write a retention table:
  - raw GCS exports: N days, then delete;
  - FHIR history: kept or purged on erasure;
  - backups: an expiry window, documented in the privacy policy;
  - device caches: wiped on logout.
- **R20.** Retire PHI from the in-memory store before beneficiary launch. Until then, set Cloud Run to one minimum instance with no autoscaling past one, so state is not forked.

### Accessibility and language

- **R22.** Restate the legal bar: WCAG 2.1 AA (HHS §504, ADA Title II, sponsor contracts) as the floor, 2.2 AA as the target, and 508 for federal procurement.
- **R23.** Define the **member product** as a route allow-list (about 25–40 screens). The ACR covers only that list. Hide everything else, including clinic, RCM, and demo pages, from beneficiary accounts. Without this cut, the 557-page surface cannot be audited.
- **R24.** Add WCAG 2.2 SC 2.4.11, 2.5.7, 2.5.8, 3.2.6, 3.3.7, and 3.3.8 to the manual checklist, plus Label in Name per language and the third-party steps (Fasten widget, SMART logins). Request Fasten's ACR.
- **R25.** Make the Playwright axe job blocking for the member route allow-list as soon as those routes are clean. Leave it non-blocking only for the rest.
- **R26.** Run human translation review for "critical" content: consent, privacy notice, medication instructions, crisis text, and billing. Machine translation stays for the record, shown beside the original and labeled.

### Coverage

- **R27.** Model Medicare as fee-for-service through Blue Button plus MA through plan APIs. Prioritize MA plan and Medicaid MCO registrations by enrollment in the launch states.
- **R28.** Build endpoint discovery from published FHIR endpoint directories (HTI-1, Epic's list, Lantern).
- **R29.** Add the long-tail path: right-of-access request letter, fax, and Document AI OCR, all under the Google BAA or a BAA-covered fax vendor.

### Clinical safety and fraud-and-abuse

- **R30.** Write a one-page FDA position for each AI or clinical feature, plus a clinical-safety review: hazard log, red-team prompts, and a crisis-routing test.
- **R31.** Hide manufacturer copay coupons from accounts that attested to Medicare or Medicaid, or label them as unusable with that coverage.
- **R32.** Sponsor policy: no pharmaceutical or device-manufacturer sponsors. Clinic sponsors are capped at the nominal-value guidance and reviewed by counsel.

### Edits to the plan's roadmap

- **MVP:** add R2, R5 (at least proof-of-portal matching from R6), R8, R10, R13, R19, R20, R22, and R23.
- **v1:** add R5 IAL2, R12, R18 (at least the EU dataset), R24, R26, R27, and R29.
- **v2:** keep TEFCA through Fasten, now unblocked by IAL2. Add SMART Health Links and the CMS Aligned application.

---

## 8. What the plan gets right, so it is not lost in revision

- Provenance-first reconciliation with no cascade delete. The patient sees the disagreement.
- Refusing Particle and Redox middlemen, and refusing to build a second QHIN stack.
- On-device device data as the default for the cheap tier.
- Honest ACR posture: "Partially Supports", an external audit, and no conformance claims while gaps remain.
- Tagged PDF called out explicitly. Most PHRs miss this.
- "Do not build a thinner product for the cheaper price." Keep this sentence.
- Not archiving unread repositories.
