# Consolidation plan — one patient-owned PHR

**Date:** 24 October 2026, revised the same day after `docs/reviews/REVIEW_GPT.md` and `docs/reviews/REVIEW_CLAUDE.md`.
**Status:** Phase 1 plan. Not production-ready until the gates in this document are met. Not legal advice. Counsel confirms the regulatory items before launch.
**Canonical repo:** `tabula-medica-phr`. One codebase. US and World are not forks.

Nothing in this change archives or deletes another repository.

A separate pull request is fixing two live leaks this plan does not patch: third-party analytics on chart routes, and browser speech APIs that send audio or synthesis off the device. Beneficiary enrollment waits on that pull request.

## What was actually read

This repo was read in tree. The token for the original pass could not see `tabula-medica-phr-world`, `tabula-phr-unified`, `tabula-phr-app`, `tabula-medica-web`, or a separate World EHR repo. `deploy-world.sh` in this repo deploys this image with TEFCA off, still to `us-central1`. That is a feature flag, not data residency. World patient features that do exist here are the International Patient Summary, the signed health passport, `shared/jurisdictions.ts`, and the ABDM notes (sandbox, off until registered). The clinic revenue-cycle engine is `server/rcm/` and stays a clinic tool.

## Review responses

Accepted means the plan and, where it was cheap, the scaffolding now follow the finding. Rejected means we kept the earlier design on purpose. Nothing in the critical or high set is rejected.

| Id | Finding | Severity | Decision | What changed |
| --- | --- | --- | --- | --- |
| G1 | Direct-to-consumer PHR is not automatically HIPAA. FTC HBNR is the US consumer baseline. A sponsor can make us a business associate. | Critical | Accepted | Section "Legal role". `shared/privacy/regulatory-role.ts`. Breach runbook below. |
| G2 | "PHI only in GCP" is false. Devices, Fasten, source systems, browser storage, and the JS shell are in the picture. | Critical | Accepted | Data-flow section rewritten. Chart data in Cache Storage and plaintext `localStorage` is a launch blocker. |
| G3 | Dedup on code + calendar day + value can erase a real clinical event. A model must not merge on its own. | Critical | Accepted | `shared/fhir/reconcile.ts` rewritten. Rules in "Reconciliation". |
| G4 | $1 is cloud arithmetic, not a price. Card fees alone break a $1 monthly charge. | Critical | Accepted | `docs/PRICING.md`. Primary price is $10/year. |
| G5 | "Patient-owned" needs export, correction, deletion, and a wind-down, or it is a slogan. | High | Accepted | Ownership charter below. No silent conversion to a paid plan. |
| G6 | An accessibility "release gate" that is non-blocking, and a VPAT deferred to v2, can ship known failures. | High | Accepted | Legal floor is WCAG 2.1 AA. Target is 2.2. Scoped VPAT on a member route list. Essential speech is not hard-stopped. |
| G7 | One SMART registration, Blue Button, and TEFCA were treated as the same kind of coverage. | High | Accepted | Retrieval section splits the programs. Blue Button is fee-for-service claims. |
| G8 | Caregiver access ignores minors, authority, and 42 CFR Part 2. | High | Accepted | Proxy model below. Part 2 labels survive import and dedup. |
| G9 | A region flag does not make a lawful international service. The store is in Iowa. | High | Accepted | Residency section. Unknown `TABULA_REGION` fails closed. Countries launch one at a time. |
| G10 | No production security, availability, or breach gate before real charts. | High | Accepted | Launch gates and the breach runbook. "HIPAA does not require a second zone" is withdrawn. |
| C1 | Same regime error, plus live analytics on chart URLs (Plausible). | Critical | Accepted | Regime section. Analytics removal is the separate pull request. Enrollment waits on it. |
| C2 | No identity proofing and no check that a chart belongs to this person. | Critical | Accepted | `shared/identity/match.ts`. Quarantine before import. IAL2 for TEFCA, sponsors, and proxies. |
| C3 | Shipped client speech is browser Web Speech, not on-device and not Cloud Speech. | Critical | Accepted | Policy module already forbids it. Enforcement is the separate pull request. Plan states the control. |
| C4 | Reconcile false-merges device streams, ignores time zones, misses cross-resource meds, and auto-merges on a score. | High | Accepted | Scaffold and "Reconciliation". Patient confirms meds, allergies, and problems. |
| C5 | Price omits card fees, Fasten, translation, and medical speech. | High | Accepted | Pricing doc. Lazy translation. Speech metered by engine. |
| C6 | World deploy stores data in `us-central1`. Unknown region values fail open. | High | Accepted | Regional stores. `parseDeploymentRegion` returns null for unknown values and the server refuses to start. |
| C7 | Too many copies, no retention or erasure path. In-memory store plus scale-to-zero forks state. | High | Accepted | Retention table. FHIR store is the system of record. In-memory PHI retires before launch. |
| C8 | HHS Section 504 requires WCAG 2.1 AA for Medicaid and Medicare Advantage vendors. Section 1557 requires human review of critical translations. The 557-page client cannot all be in one VPAT. | High | Accepted | Accessibility section. Scoped member product. |
| C9 | Medicare Advantage and Medicaid managed care need each plan's API. Fasten was tied to the TEFCA flag. No paper-record path. | High (review: medium-high) | Accepted | Retrieval section. Fasten gated on `fastenEnabled`, not TEFCA. Records-request path. SMART Health Links. |
| C10 | Patient-facing AI needs an FDA position. Manufacturer coupons and pharma sponsors are an Anti-Kickback problem for this tier. | High (review: medium) | Accepted | Clinical-safety and sponsor sections. Coupons hidden for Medicare and Medicaid accounts. No pharma sponsors. |

## Product

The person this is for, first, is a multilingual patient or caregiver trying to hold one chronic-care record together. Success is a first connection that sticks, a medication list the member has confirmed, an accessible task they can finish, a share a clinician can open, and the member still here at 90 days.

Three pillars stay:

**Language, stated as a matrix, not as "any language."** The interface list today is the 22 codes in `shared/i18n.ts`. Record translation is lazy, cached per resource and language, labeled machine or human, and the original stays beside it. Voice exists only where an allowed engine exists for that language. Critical strings — consent, the privacy notice, medication directions, crisis text, and anything about the $10 charge — get a qualified human review before they ship. That is the Section 1557 rule for critical machine translation when a sponsor is in the picture (45 CFR 92.201), and we apply it to every member, not only sponsored ones. Languages still missing for Medicaid access, and on the backlog: Haitian Creole, Somali, Hmong, Amharic, Burmese, Navajo. Right-to-left (Arabic, Farsi, Urdu, Hebrew, Pashto) sets `lang` and `dir`.

**Voice, as a second path.** A member can move through the member routes by voice, dictate a symptom, a medication, or a vital, and hear the record. Speech that can carry health information uses on-device recognition and on-device synthesis, or Google Cloud Speech-to-Text and Text-to-Speech under the Google Cloud BAA with data logging off. Browser `webkitSpeechRecognition` and network `speechSynthesis` voices are not those engines. The separate pull request removes them from chart flows. People who do not speak, or who are Deaf, use the keyboard, the screen reader, and the on-screen transcript. Voice is never the only path.

**Accessibility.** The legal floor for a vendor to a Medicaid agency or a Medicare Advantage plan is **WCAG 2.1 AA** (HHS Section 504, 45 CFR 84.84, and the ADA Title II rule for state agencies). **WCAG 2.2 AA** is the product target. Section 508 (WCAG 2.0 AA by reference, plus software and documents) is the bar for federal procurement. Details below.

### Ownership charter

The member can, without paying extra:

- Export FHIR (Bulk/NDJSON), a C-CDA, the International Patient Summary, originals they uploaded, and a tagged HTML or PDF.
- See which source each fact came from, and open the original.
- Correct or annotate a fact. The source record stays. The correction is another entry.
- Close the account. A read-and-export window remains for 90 days. Erasure then follows the retention table.
- Name a proxy only when the legal basis below is on file.
- Name a legacy contact. Death and inactivity rules are specified before launch, not improvised later.

If the company winds down, the export stays available for at least 90 days and the notice says where the files go. A failed eligibility check does not hold the file hostage and does not start a paid plan.

### How this compares

Apple Health is the phone's store, including Health Records in more than one country, and it is not a record you reconcile across a payer and a hospital you left. MyChart is one health system's portal, with proxy and messaging inside that system. CommonHealth is the Android SMART pull. Fasten is the connect widget we use under a signed contract. It is not the system of record. PicnicHealth and Guava are the closer consumer PHRs: originals, imaging, PDF and photo intake, search that cites the chart. We do not claim to lead them on day one. The wedge is the language, the voice path, the $10 price, and a reconciled store the member can take.

Google Health Connect's medical-records support, Epic's MyChart Central, b.well, Flexpa, and 1upHealth belong in the competitive set. Confirm current product pages before anyone publishes the comparison outside this repo.

## Legal role

Store `regulatoryRole` on the member. `shared/privacy/regulatory-role.ts` is the rule.

| Situation | Role | Breach path |
| --- | --- | --- |
| The member signs up and pays, or pays nothing, and no covered entity directs the service | PHR vendor. FTC Health Breach Notification Rule, FTC Act §5, and state consumer-health laws. | HBNR runbook |
| A plan or clinic sponsors the member and receives data or directs the service | HIPAA business associate. A BAA with that sponsor is required. | Notify the covered entity. HIPAA clock. |
| A sponsor only pays the invoice and receives nothing | Still a PHR vendor unless counsel says the contract creates a business-associate relationship. | HBNR, until counsel says otherwise |
| Data that arrived because the member used a patient-access API | Not HIPAA PHI in our hands. The covered entity disclosed it at the member's direction. | HBNR |

A Fasten contract is still required. If we are not a covered entity or a business associate, that contract is not a HIPAA BAA. It still has to carry breach notice and the HBNR third-party service-provider terms. The engineering bar for everyone is the HIPAA Security Rule. Marketing does not call the product "HIPAA compliant."

State laws that apply to the consumer product, and that a single "US" label does not absorb:

- Washington My Health My Data Act: consumer health data, separate consent to collect and to share, authorization to sell, no sale, deletion that reaches processors, private right of action.
- California CMIA Civil Code §56.06: a business that offers a PHR to consumers can be treated as a provider of health care under the CMIA. CCPA treats health data as sensitive.
- Texas HB 300: a broad "covered entity" definition that can include a PHR, with its own training and penalties.
- Nevada and Connecticut consumer-health rules, Maryland's sensitive-data limits, and the other state breach statutes. Track New York's health privacy bill. Reproductive and gender-affirming data gets a law-enforcement request policy and a member control to hide a section. Counsel maintains the matrix.

42 CFR Part 2 labels that arrive on a substance-use record stay on that record through import, the SQL projection, export, and dedup. They are off caregiver and sponsor views unless a Part 2 consent says otherwise.

### Breach runbook

Write this as an on-call document before the first real chart. Drill it once before launch and once a year.

1. Contain. Revoke the token, key, or vendor. Stop the job. Do not destroy evidence.
2. Preserve logs from Cloud Run, the Healthcare API data-access audit logs, and the identity provider. Those audit logs are enabled. Application logs alone are not the record.
3. Decide, per affected member, which row of the table above applies. A database can hold both roles. Notice follows the member's role, not a single company-wide label.
4. HBNR: unauthorized disclosure counts, not only a hack. Notify individuals. Notify the FTC. If 500 or more residents of a state are affected, notify the media. The 2024 amendments require notice to the FTC at the same time as individuals for breaches of 500 or more. Clock: 60 days. Confirm the current penalty and the current form with counsel.
5. HIPAA business-associate members: notify the covered entity without unreasonable delay and no later than 60 days. The covered entity notifies HHS.
6. If a Part 2 record was in the set, use the Part 2 breach path as well.
7. If Blue Button data was in the set, follow the CMS agreement, which can include notice to CMS and revocation risk.
8. Notify Fasten, a fax vendor, or a device vendor when the contract's notice clause says to.
9. State breach laws can run in parallel. The matrix says which states.
10. Member notice is plain language, in the member's language, and does not require them to call a premium number.
11. Roles: who declares the incident, who talks to counsel, who files, who talks to members. Names sit in the on-call doc, not in git.

## Feature decisions

**Keep** what this repo already does for the member: conditions, medications, allergies, immunizations, labs, vitals, documents, timeline, caregivers, advance directives, emergency card, care gaps, care packets, the symptom checker, women's health, PHQ-9 and GAD-7 with a crisis path, ASCVD with the model named on screen.

**Keep, with the limits in this revision:**

- Fasten, US only, not tied to TEFCA.
- Direct SMART and payer APIs, including fee-for-service Blue Button, Medicare Advantage plan APIs, and Medicaid managed-care plan APIs.
- Devices, tested models only, on-device by default.
- Drug prices that are cash prices. Manufacturer copay coupons are hidden on any account attested as Medicare or Medicaid. The Anti-Kickback Statute does not allow those coupons for drugs paid by those programs.
- The household subscription for everyone else.

**Port:**

- One assistant, not five bots. It cites the source record and can show the original. Lab explanations, insurance questions, a prior-auth status the member can read, and a medication guide live there. Trial matching contacts a sponsor only after a separate consent.
- Patient-facing slices of cost estimate, a Good Faith Estimate the member received, sliding-fee explanation, and a statement that was given to them. Not the clinic's billing engine.
- Jurisdiction-named risk next to ASCVD. Never swap models silently.
- C-CDA and photo upload, OCR'd with Document AI under the Google BAA, tagged `upload`, assurance "patient-provided", and confirmed by the member before it is a fact.
- Records-request path for clinics with no API: a right-of-access letter, a BAA-covered fax or email, OCR, then the same confirmation step.
- SMART Health Links for the IPS and care packets. SMART Health Cards for immunizations. A clinic can open the link without an account.
- Endpoint directory from HTI-1 service-base URLs, Epic's published list, and Lantern. Oracle Health is registered per tenant.
- Proxy roles with legal authority. Medicaid renewal reminders the member typed in, linking to the state portal. Push notifications that say "you have a new result" and contain no health information, because APNs and FCM are not BAA services.

**Drop from the member app:** clinic RCM, Redox, Particle, a second QHIN stack, RVU and HCC billing tools, the Base44 SDK, Replit, a second web frontend, a second mobile app. `tabula-medica-web` stays archived. The clinic EHR, if it is still seeing patients, stays its own product and, if it is certified health IT or a network, stays a separate legal entity so this app is not pulled into information-blocking duties by accident. We are not an information-blocking actor today. A provider who refuses a patient-directed app can be. Keep a complaint template. Do not call every missing clinic "information blocking."

## Retrieval

Two electronic paths and one paper path. One FHIR store. Nothing is imported until the demographic match says `same-person`.

### Fasten

Primary path when the member has many US portals and the contract price fits. The widget runs in the browser. Fasten posts the export webhook to Cloud Run. The download URL has to be Fasten's. The bundle is written to the FHIR store tagged `source=fasten`, and the raw object goes to a private GCS bucket. Fasten is **not** TEFCA. `FASTEN_ENABLED` and `TEFCA_ENABLED` are separate. A US deploy can run Fasten with TEFCA off. World runs neither. The client route, the sidebar, and the connect card follow `fastenEnabled`.

TEFCA Individual Access, later, needs IAL2 and the Common Agreement's terms. It is not this flag. Use Fasten's TEFCA connection only after the contract states Fasten's role. Do not build a second QHIN client.

### Direct patient access

The member can connect with no middleman because certified EHRs expose a patient-access API (SMART on FHIR) and CMS requires payer Patient Access APIs. That is the provider's or payer's duty to the member. Our duty is the product promise in the ownership charter, plus state portability rules. We do not describe the direct path as "us honoring the HIPAA right of access."

Register the app per vendor and, where they require it, per tenant. Maintain redirect URIs, PKCE, refresh, US Core versions, and a token-health job. One Epic client id is not every Epic tenant. Production access is an ongoing operation.

| Program | What the member actually gets |
| --- | --- |
| SMART on FHIR to an EHR | That organization's clinical API, as complete as that endpoint is. Not a promise of the full designated record set. |
| CMS Blue Button 2.0 | Fee-for-service Medicare claims, Parts A, B, and D. Not Medicare Advantage encounters. Not a clinical chart. Label every fact `claims-derived`. Production access has its own CMS terms: privacy policy, opt-in, no sale, deletion, and CMS review of policy changes. Do not collect Medicare.gov passwords. Authorizations expire. |
| Medicare Advantage | That plan's Patient Access API. Prioritize plans by enrollment in the launch states. |
| Medicaid | Usually a managed-care plan's API, one registration per plan. Not "the state's API." |
| Payer prior auth | CMS-0057-F adds prior-authorization data to Patient Access APIs on the CMS date (January 2027 unless CMS moves it). That is the source for "where is my prior auth," not a clinic 278 workstation. |

Sign the CARIN Code of Conduct and publish the ONC Model Privacy Notice. That is how payer registration stays boring.

Blue Button success may be offered as optional proof of fee-for-service Medicare for the $10 price. It is a second purpose. Ask separately. Do not require it.

### Paper and fax

Small practices and labs with no API get a letter the member can send, a BAA-covered fax path, and Document AI OCR. The member confirms the extracted facts before they enter the compartment. Unconfirmed OCR is not a clinical fact.

### Gaps we will say out loud

A clinic in neither Fasten's catalog nor our directory. A plan we have not registered. Imaging we have not retrieved. Write-back into a hospital schedule. International networks, which are per country (ABDM only after registration). Device clouds without their own agreement.

## Identity, matching, and proxies

Google or Apple sign-in is IAL1. It proves control of an account. It does not prove who the person is.

- Public tools stay at IAL1.
- TEFCA, a sponsored account, and every proxy role require IAL2 (Login.gov, ID.me, or CLEAR — confirm the current contract and BAA status before naming a vendor in the app).
- Passkeys are offered. Account recovery works for someone without a Google or Apple account. That is also WCAG 2.2 accessible authentication (paste of a one-time code, or a passkey, not a code that cannot be pasted).

Before import, `compareDemographics` checks family name and birth date against the member profile.

- `same-person`: import into this compartment.
- `mismatch` or `insufficient`: quarantine. Ask "Is this you, or someone you care for?" "Someone I care for" opens a different compartment. It does not copy their diagnoses into the caregiver's chart.

Proxy access is a legal role, not a shared password: parent of a minor, guardian, health-care agent, power of attorney. Each has a document, a scope, an effective date, and an expiry. The member or a court can revoke it. Adolescent confidentiality follows the state: a parent does not see sexual-health, mental-health, substance-use, or reproductive records the state withholds, including when the parent can see the rest. At the age of majority the proxy ends unless a new authority is on file. Sharing with a clinician is time-limited, resource-scoped, and written to an accounting of disclosures. Break-glass is a separate, audited, short-lived grant.

## Reconciliation

The FHIR store is written first. Cloud SQL is a projection that can be rebuilt. `shared/fhir/reconcile.ts` is the rule. It does not delete.

Automatic grouping happens only for the **same instance**: the same source resource delivered twice, or two copies that carry the same instance identifier (an accession or a source id). A terminology code is not an instance identifier.

These do not merge records:

- Same LOINC, same value, same calendar day. Two heart rates of 72 are two readings. Device streams never match on a value.
- A clock time without an explicit offset. `hasExplicitOffset` rejects a bare date. Time zones are part of the instant. A date-only value is stored and is not a key.
- A model score. Medications, allergies, problems, labs, vitals, and device streams are in `NEVER_AUTO_MERGE`. A score at or above 0.9 can create a suggestion. The member confirms medications, allergies, and problems ("Are these the same?"). Labs and vitals are not collapsed by a model.
- Cross-resource lookalikes. An ExplanationOfBenefit drug line and a MedicationRequest that share an RxNorm code become a confirmation candidate. They are not one fact until the member says so. Claims stay labeled claims-derived.

`entered-in-error` stays in the store and stays out of the current view. Amended results with the same accession stay together and are marked a conflict when the values differ. Both values remain. The screen shows the disagreement.

Suggestions are blocked by code family and a time window before any model is called, and the number of model calls per member per month is capped. The model name and version are stored on the suggestion. Healthcare Natural Language is not assumed. Confirm the product. The default is Vertex embeddings plus a Gemini adjudication prompt, under the Google Cloud BAA, data logging off, and no training on member content.

A patient-level deletion is a different workflow. The matcher never calls FHIR delete.

## Devices

On-device HealthKit, Health Connect, and Bluetooth GATT are the $10 path. They do not add a business associate for the read. The copy in Google Cloud is ours. Terra and any vendor cloud need that vendor's own agreement. The Fasten contract does not cover them. Claim only device and OS pairs that have been tested. A GATT UUID is not a compatibility list.

Consent is separate for collection and for any later sharing, because Washington, Nevada, and Connecticut require that split. The operating-system dialog is not that consent. Revocation stops future pulls. Stored observations remain until the member asks for those to go. Device data is device-generated, not provider-attested.

Aggregate high-frequency streams before writing FHIR. Push payloads carry no health information.

## Where data lives

Tabula-controlled **server-side** health information is stored and processed in named Google Cloud services under Google's BAA: Cloud Run, Cloud SQL, the Healthcare API FHIR store, GCS, Vertex, Speech, Text-to-Speech, Translation, Document AI, Secret Manager, Cloud KMS, and Cloud Logging. Identity Platform stores the login, not the chart, and not health information in a display name or custom attribute.

Other places health information exists, on purpose:

| Place | What | Retention |
| --- | --- | --- |
| FHIR store, per residency region | System of record, including history | Kept until an erasure request, then `$purge` of that compartment, history included |
| Cloud SQL | Rebuildable projection of the minimum fields the screens need | Rebuilt from the store. Not a second system of record |
| GCS raw exports | The file Fasten or a fax returned | **30 days**, then delete |
| Backups | Cloud SQL and the store's backups | Expire on the configured window. Erasure is finished when that window has passed. Say so in the privacy policy |
| Phone | Encrypted offline emergency card, Keychain or Keystore, excluded from backups | Wiped on logout. Blurred in the app switcher |
| Browser | No chart in Cache Storage. No advance directive in plaintext `localStorage`. A half-finished form lives in memory or in an encrypted server draft | Launch blocker. The service worker and `advance-directives.tsx` are the current copies |
| Fasten | The export, under the Fasten contract | Their retention, in the contract |
| Source EHR or payer | The original | Theirs |
| Cloudflare | The static JavaScript shell, DNS, and the site WAF | No chart, no API body. API hostname is DNS-only. The shell is still in the trust boundary: a changed bundle can read the chart in the browser. CSP `connect-src` limited to the API and the identity provider. `Referrer-Policy: no-referrer`. No health information in URLs. Rocket Loader, Zaraz, and Cloudflare Web Analytics off. Pages deploys only from CI. Account MFA. |
| Payments | A processor token and the last four digits. Not a diagnosis | The processor's schedule |
| Support | Ticket ids. No chart paste | The support tool's schedule, and the tool has to be an approved processor |

The in-memory store in `server/storage.ts` holds health information today and will fork or drop it on scale-to-zero. Retire that copy before any beneficiary chart is real. Until then, Cloud Run minimum instances is 1 and maximum instances is 1.

VPC Service Controls around the Healthcare API, GCS, Cloud SQL admin, Vertex, Speech, and Translation. Org policy `gcp.resourceLocations` is what makes residency real.

## Residency

`TABULA_REGION=world` turns TEFCA and Fasten off. It does not move bytes. Today the FHIR store and `deploy-world.sh` are `us-central1`. Do not offer chart storage to members in the EU or India until a dataset in the right region exists and the transfer paperwork is done.

Each country we turn on has a written gate: the Google Cloud region and FHIR dataset, the lawful basis, the transfer tool (for the EU, Data Privacy Framework, SCCs, or explicit consent, plus a DPIA), the regulator or representative, retention and rights, identity and exchange approval, terminology licenses, the language and speech row, accessibility evidence, support hours, and how the $10 is collected. An unknown country, or an unknown `TABULA_REGION`, fails closed. The server throws and does not boot. Members in an unapproved country can use offline education screens. They cannot create a chart.

ABDM stays sandbox until registration and a data-protection agreement. GDPR, UK GDPR, and India's DPDP Act are not satisfied by a string in `shared/jurisdictions.ts`.

## Accessibility and the VPAT

The member product is an allow-list of about 25 to 40 routes (sign-in, home, connect, timeline, one lab, medications, documents, caregivers, symptom checker, emergency card, sharing, settings, the $10 explanation, consent). Clinic, RCM, and demo pages are not in a beneficiary account. The ACR covers that list, the Capacitor shells, the care-packet PDF, and one voice journey. It does not cover all 557 page files. Rendering the site in a WebView is not iOS or Android conformance. Test the store build with VoiceOver and TalkBack.

Manual checklist, on that allow-list, web then iOS then Android:

- [ ] VoiceOver, TalkBack, NVDA, JAWS, Switch Control, and voice control.
- [ ] Keyboard only. Visible focus. No trap. Skip link. Focus not obscured (2.4.11).
- [ ] Target size (2.5.8), dragging alternatives (2.5.7), text spacing, reflow at 200–400% zoom, orientation, reduced motion.
- [ ] Contrast 4.5:1 body and 3:1 UI, both themes, large text on.
- [ ] Label in Name (2.5.3) in English, Spanish, and Arabic, because voice-control users speak the visible label.
- [ ] Consistent help (3.2.6) and redundant entry (3.3.7). Accessible authentication (3.3.8): passkey or paste.
- [ ] `lang` and `dir`. A translated lab shows the original. Critical strings show the human-review marker.
- [ ] Errors are on the field and announced.
- [ ] Session timeout warns, extends, and keeps the draft in memory or an encrypted server copy, not in `localStorage`.
- [ ] Captions on prerecorded media. Assistant speech has the same words on screen. Telehealth without live captions is Does Not Support for 1.2.4 and is off for beneficiary accounts until captions exist.
- [ ] Care-packet PDF is tagged, titled, and has a language. pdfkit output today is not that. Fix the generator before the packet is a member feature.
- [ ] Low-bandwidth mode: no autoplay, no prefetch, core chart still opens.
- [ ] The same tasks work with voice off.
- [ ] Fasten widget and each SMART login are steps in our journey. Collect their ACRs. If a step fails, the journey fails.
- [ ] Test with disabled members, older members, low literacy, and limited English.

`eslint-plugin-jsx-a11y` and the jsdom axe suite stay required on every pull request. The Playwright axe job stays non-blocking for the whole app and becomes blocking on the member allow-list once those routes are clean. Color contrast stays a measured item. The August 2026 self-evaluation remains Partially Supports and is not the procurement VPAT.

The VPAT is an ITI ACR, Revised Section 508 edition, plus the WCAG table. Rows are Supports, Partially Supports, Does Not Support, or Not Applicable, and each remark names a route on the allow-list. An external auditor reviews it before a Medicare Advantage or Medicaid plan gets the PDF. Publish it at `/legal/accessibility`. Do not claim conformance while a named journey is Does Not Support. Contact remains accessibility@tabulamedica.health.

## Clinical safety

Patient-facing symptom triage, lab explanations, ASCVD, and the assistant are not the professional CDS carve-out in FD&C §520(o)(1)(E). That carve-out is for health-care professionals. Each function gets a one-page position before it is on for members: general wellness, FDA enforcement discretion, or SaMD. Plus a hazard log, a red-team set, and a rule that the model does not invent a number that is not in the chart. Every answer cites the source.

Crisis routing is 988 in the US, and a jurisdiction table elsewhere, shown when PHQ-9 item 9 is positive. Test the routing.

State AI disclosure laws (Utah, Colorado, and others) are on the counsel matrix. Confirm effective dates.

## Sponsors, coupons, and fraud and abuse

No drug or device manufacturer pays for a member or places a coupon in this product. Clinic or plan sponsors are reviewed by counsel, capped at OIG nominal-value guidance, and do not steer plan choice. Plan-branded messages inside the app can be marketing under 42 CFR 422.2267 and need the plan's process. Medicaid value-added benefits need the state's process. Manufacturer copay coupons are not shown on Medicare or Medicaid accounts.

## Launch gates

Before a real beneficiary chart:

1. The analytics and browser-speech pull request is merged. A CI check fails if a third-party origin appears on an authenticated route.
2. Unknown region fails closed (done in this change). Fasten is not tied to TEFCA (done in this change).
3. Demographic match quarantines mismatches (the function is in this change; the import path has to call it).
4. Dedup rules in this document are what the import job calls.
5. In-memory PHI is not the store. Minimum instances do not fork it.
6. Browser chart caches and plaintext `localStorage` health data are gone.
7. Deny-by-default authorization, the open items in `threat_model.md` closed or explicitly accepted, upload ACLs, secret fail-closed, dependency and penetration tests.
8. Written RPO and RTO, immutable backups, a restore test. Starting target, to replace with a measured one: RPO 24 hours, RTO 4 hours for the reconciled chart. The emergency card still opens from the last on-device sync.
9. Breach tabletop using the runbook.
10. Member-route accessibility checklist, with known failures either fixed or turned off.
11. Human review of the critical translations.
12. Fasten price written into `docs/PRICING.md`, or Fasten left off the $10 tier.
13. FDA one-pager for each AI feature that is turned on.
14. Counsel sign-off on the role matrix, Washington, California, Texas, Part 2, and the sponsor contract.

## Roadmap

**MVP.** The gates above. Direct Blue Button for fee-for-service Medicare and one SMART vendor whose tenant is actually live. Fasten only if the contract fits $10. Deterministic same-instance grouping and confirmation prompts. One tested on-device connector. The member route list in the shipped languages, RTL working, originals kept, on-device read-aloud on the timeline, a lab, and medications. $10/year with attestation. Coupons hidden for attested Medicare and Medicaid accounts.

**v1.** IAL2. Medicare Advantage and the largest Medicaid plans in the launch states. Endpoint directory. Records-request, fax, and OCR with confirmation. Human-reviewed critical translations. EU or India dataset only if that country's gate is signed, otherwise those members stay off the chart. Scoped ACR in progress. Voice entry for symptoms, medications, and vitals through an allowed engine. Medication confirmation is a product metric, not only a dedup rule.

**v2.** TEFCA through Fasten, which IAL2 unblocks, still US-only. SMART Health Links. ABDM if registered. A signed ACR a plan can file. CMS-aligned app directory only if the then-current criteria are met.

## Migration order

1. This revision: reviews merged, plan and price corrected, region fail-closed, Fasten uncoupled from TEFCA, safer reconcile, role and match helpers.
2. The separate analytics and speech pull request.
3. Call the match helper and the new reconcile from ingest. Tag claims as claims-derived.
4. FHIR store first, SQL as a projection, GCS lifecycle at 30 days.
5. Regional datasets before any non-US chart.
6. Member route allow-list and the accessibility checklist.
7. Owner archives other repos later, after reading them. Not in this change.

## Scaffolding

| Piece | Where |
| --- | --- |
| Region, fail closed, Fasten independent of TEFCA | `shared/deployment-region.ts`, `GET /api/public-config`, route and nav gates |
| Regulatory role | `shared/privacy/regulatory-role.ts` |
| Demographic match | `shared/identity/match.ts` |
| Reconcile without auto-merge of clinical facts | `shared/fhir/reconcile.ts` |
| Bilingual text, RTL, speech allow-list, device catalog | `shared/i18n/`, `shared/voice/policy.ts`, `shared/devices/` |
| Reviews, unchanged | `docs/reviews/REVIEW_GPT.md`, `docs/reviews/REVIEW_CLAUDE.md` |
| Price | `docs/PRICING.md` |
