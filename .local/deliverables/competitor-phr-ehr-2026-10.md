# Patient-facing EHR / PHR competitor teardown (October 2026)

**Date checked:** 2026-10-13 (all URLs below were fetched or searched on this date).
**Scope:** patient-facing side only. Public, logged-out pages and search excerpts via Firecrawl. No logins, no accounts, no PHI.
**Method notes:**
- Many vendor sites returned 403 to one Firecrawl server. The second server worked, but its search returns excerpts, not full pages. Where a claim comes only from an excerpt, it is marked **(excerpt)**.
- **(est.)** means inferred, not seen on a public page. **"?"** in the matrix means not seen on any public page checked. It does not mean "no".
- Health Mint is covered in `health-mint-comprehensive.md` and `health-mint-gap-analysis.md` and is deliberately excluded here.
- Compliance wording: we do not claim SOC 2 or HITRUST. Where a competitor makes such a claim, we did not repeat it.
- Our column was built by skimming `client/src` (pages, `language-provider.tsx`, `us-paywall.tsx`, `sw.js`), `server/services/feature-gates.ts`, and `.local/deliverables/tm-comprehensive-roadmap.md`. Nothing was run.

---

## 1. Summary

Between August and October 2026 the patient-facing market moved from "portal with a message inbox" to "AI layer on top of your record." Oracle Health made its AI patient portal generally available (2026-08-12). Epic's Emmie now explains results, answers billing questions and schedules by text inside MyChart. Google rebranded the Fitbit app as Google Health and sells a Gemini coach for $9.99/mo that can ingest medical records. Microsoft (Copilot Health, preview) and Amazon (Health AI) also pull records into a consumer AI assistant. The EHR vendors are broadly **free to patients but locked to the health system the patient happens to use**. EHR vendors that offer multilingual support are uneven: Epic has multilingual MyChart and Meditech texts in 100+ languages, while athenaOne's portal is English and Spanish. The big-tech entrants are US-only, aged 18+, and none shows proxy or family access. Microsoft explicitly says HIPAA does not apply to Copilot Health. Fasten (open-source, self-hosted) and PicnicHealth (free account, records retrieval) own "aggregate everything," and Medisafe and CareClinic own adherence with a freemium paywall. Tabula Medica's defensible position is the combination competitors do not show together: cross-provider FHIR import, family/proxy access, 19 human-curated UI languages, uninsured and free-care tooling, public cash prices, and a very low price ($4.99/yr after a 7-day trial). The biggest near-term gaps are in-record AI explanations with citations, lab trend charts, a no-login cost estimator, and SMART Health Link check-in.

---

## 2. Feature matrix

Legend: **Y** = seen on a public page. **~** = partial, or Y only for some customers. **?** = not seen. **N** = seen to be absent or explicitly not offered. **(est.)** = inferred.

### 2a. EHR-vendor portals (patient-facing)

| Feature | Tabula Medica | Epic MyChart | eCW healow | athenaOne portal | Oracle Health portal | Meditech MyHealth / Patient Connect | NextGen PxP | Veradigm FollowMyHealth |
|---|---|---|---|---|---|---|---|---|
| FHIR / Cures Act import across providers | Y, via Fasten and a SMART launcher (`fasten-connect.tsx`, `smart-app-launcher.tsx`, roadmap B.1) | Y: MyChart Central links accounts across orgs and lets other apps connect | ? (healow is EHR-agnostic on the provider side) | ? | ? | ? ("preferred consumer app" access mentioned) | ? | ? |
| Proxy / family access | Y (`family-accounts`, `caregivers`, `parent-mode`, `family-verification`; gated as `family_hub`) | Y: "Manage care for you and your family" feature page | ? | Y: FAQ has caregiver and access-management sections | Y: docs say patients "and their caregivers" | ~ ("manage your and your family's care", MHealth App Store text) | ? | Y: "Designate caregiver access" |
| Multilingual | **19 human-curated UI languages** (22 registered, 3 pending review) | Y: "Multilingual MyChart", language count not stated | ? | English and Spanish, more "planned" | ? | Y for SMS: "over 100 languages" | ? | ~ via Voyce interpretation: 240+ spoken languages and ASL (for providers) |
| AI summaries / plain-language explanations | Y, Pro-gated chart summary plus lab and document explainers | Y: Emmie result summaries, procedure-report plain language, Q&A | ? | ~ agentic text and voice assistant (alpha, 2026) | Y: GA 2026-08-12, answers grounded in the chart, cites sources | ~ "AI-driven responses" in texting | ~ staff-side "Intelligent Agent" | ? |
| Medication reconciliation (patient-visible) | Y (`medication-reconciliation.tsx`) | ? | ? | ? | ? | ~ "manage home medications", renewals | ? | ? |
| Lab trends | ~ trend arrows only in `lab-results.tsx`; charts exist for vitals | ? | ? | ? | Y: "trends in labs and vitals over time" | ? | ? | ? |
| Offline PWA | ~ service worker and offline page present, depth not verified | ? | N: native app (est.) | ? | ? | N: native app (est.) | ? | ? |
| Price transparency / cost estimates | Y: public cash prices (`cash-prices.tsx`), drug savings | Y: Estimates, works without a MyChart login | ? | ? | ? | ? | ~ payments and e-statements | ~ bill pay |
| Uninsured / free-care finder | Y (`fqhc-finder`, `uninsured-resources`, public `/find-free-care`) | ? (financial assistance exists on the provider side) | ? | ? | ? | ? | ? | ? |
| Wearables | Y (6 native connectors plus aggregators) | Y: wearables for RPM | Y: link trackers and RPM devices | ? | ? | ~ RPM | ~ RPM | ? |
| Price to the patient | $4.99/yr after 7-day trial (`us-paywall.tsx`) | Free to patient (est., health system pays) | Free (healow page) | Free to patient (est.) | Free to patient (est.) | MHealth app Free (App Store) | Free to patient (est.) | Free to patient (est.) |

### 2b. Consumer, aggregator and adherence apps

| Feature | Tabula Medica | Apple Health | Google Health (ex-Fitbit) | Microsoft Copilot Health | Amazon Health AI | Fasten | PicnicHealth | Medisafe | CareClinic | Hims & Hers | Teladoc |
|---|---|---|---|---|---|---|---|---|---|---|---|
| FHIR / Cures import | Y | Y: FHIR-based Health Records | Y: lab results, vaccinations, medications, allergies | Y: via HealthEx, 50,000+ orgs | Y: via HIE through One Medical | Y: SMART on FHIR, self-hosted | Y: record retrieval, "99%+" claim for any US patient | N | ? | N | N |
| Proxy / family | Y | ? | ? | ? | N: "cannot personalize for anyone other than you" | Y: "personal/family" record manager | ? | Y: Medfriend notifies a loved one of missed doses | ? | ? | ? |
| Multilingual | 19 | ? | ? ("not available in all regions or languages") | N yet: "expand to additional ... languages" | ? | ? | ? | ~ language settings exist (YouTube AMA title) | ? | ? | ? |
| AI summaries | Y | N | Y: Gemini coach (Premium) | Y | Y | N | Y: PicnicAI | N | ~ (est.) | ~ MedMatch for providers | ? |
| Med reconciliation | Y | ? | ? | ? | ~ checks interactions | ? | ? | ~ interaction alerts | ? | N | N |
| Lab trends | ~ | ? | Y: records plus trends (est.) | Y: trends and patterns | ? | ? | ? | ~ 20+ health measurements (Premium) | ? | ~ at-home labs with Action Plan | ? |
| Offline | ~ | Y: on-device (est.) | ? | N | N | Y if self-hosted | ? | ? | ? | ? | ? |
| Price transparency | Y | N | N | ~ provider search only | ~ compares Rx prices | N | N | N | N | Y: prices on pages | Y: $89/visit uninsured |
| Free-care finder | Y | N | N | N | N | N | N | N | N | N | N |
| HIPAA posture (as stated) | PHI on Vertex AI under BAA (CLAUDE.md) | Encrypted direct from the org; Share with Provider end-to-end encrypted | ? | **Says HIPAA does not apply** to most direct-to-consumer wellness products | PHI under HIPAA once a health profile exists | Self-hosted: you hold it | ? | ? | ? | ? | ? |
| Price | $4.99/yr | Free (built in, est.) | Premium from $9.99/mo | Included with Microsoft 365 Personal, Family or Premium (US, 18+, preview) | Free; Prime perk of 5 One Medical message visits (usually $29 each) | Free self-hosted; desktop and cloud for a fee | Free account | Premium; **user-reported** $4.99/mo or $39.99/yr (unverified, Reddit) | Free tier; $5.99/mo or $39.99/yr | Memberships; weight-loss $39 first month then $149/mo | $89/visit uninsured, mental health $119 |

### 2c. Not patient-app competitors (context only)

- **Ensemble Health Partners:** revenue-cycle vendor, B2B. Its blog reports that 90% of patients consider pre-care price estimates moderately to extremely important (vendor statistic, not independently verified). It validates the demand for cost estimates but ships no consumer app that we saw.
- **Glass Health:** clinician-facing AI. Plans shown: Starter $20, Pro $90, Max $200, plus a free Lite plan. We saw no patient-facing product. Treat as adjacent, not competing.
- **Hims & Hers:** asynchronous messaging care plus pharmacy fulfilment. It is a care-delivery funnel, not a record aggregator. Useful only as a price-forward consumer-UX reference.

---

## 3. Top 10 gaps and opportunities (ranked by impact over effort)

Verdict key: **adopt** = take the pattern largely as-is; **adapt** = reshape to our region, price and compliance rules; **skip** = do not build.

| # | Gap / opportunity | Seen at | Impact | Effort (est.) | Verdict | Why |
|---|---|---|---|---|---|---|
| 1 | **Lab and vitals trend charts on `lab-results`** (we show trend arrows only) | Oracle (trends in labs and vitals), Microsoft (patterns and trends) | High | Low (recharts already used in vitals) | **Adopt** | Cheapest visible parity gap. Reuses existing chart code and data. |
| 2 | **Sourced, plain-language AI explanations** that cite the specific record entry and mark AI text visually | Oracle (visual bar and source citations), Epic Emmie, Amazon | High | Low-Medium | **Adapt** | We already have lab and document explainers. Add per-claim citations back to the record and a consistent "AI-written" marker. Keep inference on Vertex AI only (`phr-ai-guard`). |
| 3 | **No-login cost estimator** for common procedures, built on our public cash-price data | Epic MyChart Estimates, Ensemble stat | High | Medium | **Adapt** | Our edge is the uninsured: show cash price, FQHC sliding-scale option and Medicare G-code context together. Do not imply an insurer-specific price we cannot compute. |
| 4 | **Passkey / password-free sign-in** | MyChart Central (passkeys and Face ID) | Medium-High | Medium | **Adopt**, after checking what Auth0/GCIP already supports | We found passkey references only in `faq.tsx` and an Auth0 page, so current support is unverified (est.). |
| 5 | **SMART Health Link / QR check-in export** ("kill the clipboard") | CMS Health Tech Ecosystem, Flexpa, Epic Share Everywhere | Medium-High | Medium | **Adapt** | We already have share links and QR. Add a SMART Health Link payload so clinics can accept it without a login. Keep the expiry and revocation we already have. |
| 6 | **Dismissible, personalized insight cards** on the home dashboard | Microsoft insights, Google Health Coach | Medium | Low-Medium | **Adapt** | Fits the existing summary widget. Avoid streaks and points: the roadmap rules out gamification. |
| 7 | **Missed-dose alert to a caregiver** | Medisafe Medfriend | Medium | Low (we have caregivers and adherence) | **Adapt**, after confirming it is not already shipped | Needs an explicit consent flow for the person being notified. |
| 8 | **Visible records-coverage claim** ("connect X provider organizations") and a retrieval-status screen | Microsoft/HealthEx 50,000+, PicnicAI "99%+" | Medium | Medium | **Adapt** | State our real Fasten coverage truthfully. Do not copy competitor numbers. |
| 9 | **Low-cost virtual-care directory with posted cash prices**, linking out | Teladoc $89, Amazon One Medical $29 pay-per-visit, Hims | Medium | Low-Medium | **Adapt** | Link-out only, with prices labeled "as posted on date X." We do not deliver care. |
| 10 | **Universal record retrieval via TEFCA / HIE** | Amazon (HIE), PicnicHealth | High | High | **Skip for now** | Already v2.0+ in the roadmap (Section A.4 and D). Revisit once Care Access Phase 1 ships. |

Also seen and **skipped**:
- Natural-language appointment booking (Oracle, athenaOne, Epic): we are not a scheduling system of record.
- Wellness coaching tied to hardware (Google, Hims smart scale): off-mission.
- Hospital bedside and RPM programs: provider-side.

---

## 4. Our differentiators

1. **Cross-provider record in one place, for the person, not the health system.** The EHR portals show one organization's chart (MyChart Central is the exception, inside Epic's network).
2. **Family and proxy access is a first-class feature.** Amazon Health AI says it cannot personalize for anyone but the account holder. Microsoft and Google show nothing equivalent.
3. **19 human-curated UI languages.** The nearest EHR-portal claims are athenaOne at English and Spanish and Meditech at 100+ for SMS only. Epic does not state a count publicly. Caveat: three more languages (Urdu, Hebrew, Pashto) are registered but marked machine-translated pending review, and the `ClinicalDisclaimer` falls back to English for them.
4. **Uninsured and underinsured tooling.** Free and sliding-scale care finder, public cash prices, and a public reference MCP. We saw nothing comparable at any competitor.
5. **Price.** $4.99/yr after a 7-day trial, versus Google Health Premium at $9.99/mo (about 24x the annual cost, calculated), CareClinic $39.99/yr, and Medisafe at a user-reported $39.99/yr.
6. **Stated privacy posture is stronger than the big-tech entrants.** PHI-bearing AI calls run on Vertex AI under the Google BAA, with a CI guard. Microsoft states HIPAA does not apply to Copilot Health. Use "aligned with" language only and never claim SOC 2 or HITRUST in copy.
7. **Data-rights self-service.** GDPR dashboard and CCPA work already shipped or queued (see Health Mint docs). Microsoft's equivalent is a "Delete my health data" setting.

---

## 5. Sources (all checked 2026-10-13)

**Epic / MyChart**
- https://www.mychart.org/l/en-us/ ("over 190 million patients")
- https://www.mychart.org/l/en-us/explore/ (Estimates without login, multilingual, passkeys, MyChart Central)
- https://www.epic.com/software/patient-experience/ (195M active users, product list)
- https://www.epic.com/software/emmie/ (Emmie for Patients)
- https://www.epicshare.org/tips-and-tricks/spanish-mychart (multilingual MyChart, excerpt)

**eClinicalWorks / healow**
- https://healow.com/apps/jsp/webview/signIn.jsp (free app, trackers, labs and meds)
- https://www.eclinicalworks.com/eclinicalworks-and-healow-telehealth-solutions-help-41-provider-fqhc-improves-patient-access-to-care/ (excerpt)

**athenahealth**
- https://www.athenahealth.com/resources/blog/multi-language-patient-support-tools (English and Spanish, excerpt)
- https://www.athenahealth.com/patient-login/faq (caregiver and access sections, excerpt)
- https://www.athenahealth.com/about/press-releases/athenahealth-launches-agentic-patient-communication-tools (excerpt; release date not captured, "this year" is 2026 per page context, est.)

**Oracle Health**
- https://www.oracle.com/news/announcement/oracle-health-ai-powered-patient-portal-generally-available-2026-08-12/
- https://www.oracle.com/health/consumer-experience/ (excerpt)
- https://docs.oracle.com/en/industries/health/health-patient-portal/ (excerpt)

**Meditech**
- https://ehr.meditech.com/ehr-solutions/expanse-patient-connect (100+ languages)
- https://ehr.meditech.com/ehr-solutions/patient-empowerment (excerpt)
- https://apps.apple.com/us/app/meditech-mhealth/id1143209032 (Free)

**NextGen**
- https://www.nextgen.com/solutions/patient-experience/patient-portal (excerpt)
- https://www.nextgen.com/ (excerpt)

**Veradigm**
- https://veradigm.com/followmyhealth-patient-engagement-platform/ (caregiver access, Voyce interpretation, excerpt)

**Consumer and big tech**
- https://support.apple.com/en-us/111755 and https://support.apple.com/guide/healthregister/health-records-directory-listing-faq-apd261e67474/web and https://support.apple.com/fr-tn/guide/healthregister/apd531bc6215/web (excerpts)
- https://www.apple.com/newsroom/2018/01/apple-announces-effortless-solution-bringing-health-records-to-iPhone/ (FHIR basis)
- https://store.google.com/us/product/google_health_premium?hl=en-US (from $9.99, renews at $9.99/mo; medical records; trial offer ends 05/26/27)
- https://support.google.com/googlehealth/answer/14237011?hl=en and https://healthapp.google/ (excerpts)
- https://support.microsoft.com/en-us/microsoft-copilot/copilot-health (page dated 06/05/2026, preview; availability note says temporarily unavailable for some users)
- https://www.fiercehealthcare.com/ai-and-machine-learning/microsoft-unveils-copilot-health-ai-health-companion-consumers (excerpt)
- https://health.amazon.com/health-ai/learn-more (Amazon Health AI)

**Aggregators, adherence, telehealth, adjacent**
- https://github.com/fastenhealth/fasten-onprem and https://apps.smarthealthit.org/app/fasten-health (free self-hosted, fee for desktop/cloud, excerpts) and https://www.fastenhealth.com/ (Fasten Connect API)
- https://picnichealth.com/make-an-impact/az-opus-w and https://www.prnewswire.com/news-releases/picnichealth-announces-picnicai-a-platform-that-unlocks-the-universal-patient-record-with-generative-ai-302182861.html (excerpts)
- https://www.medisafe.com/ (pharma-engagement positioning), https://medisafeapp.com/en/features/ and https://medisafe.com/download-the-app (Medfriend, interaction alerts, excerpts)
- https://www.reddit.com/r/androidapps/comments/1pfx7su/medisafe_no_longer_free_from_2026_best/ (user-reported price, unverified)
- https://careclinic.io/ and Google Play listing for CareClinic (free, $5.99/mo or $39.99/yr, excerpt) and https://apps.apple.com/us/app/symptom-tracker-careclinic/id1455648231 (excerpt)
- https://www.hims.com/ and https://www.hims.com/about/the-company
- https://www.teladochealth.com/start/no-insurance and https://www.teladochealth.com/start/faq
- https://glass.health/for-clinicians and https://glass.health/compare/freed (excerpts)
- https://www.ensemblehp.com/blog/navigating-the-patient-financial-journey/ (excerpt)
- https://www.cms.gov/newsroom/press-releases/white-house-tech-leaders-commit-create-patient-centric-healthcare-ecosystem and https://www.aha.org/aha-center-health-innovation-market-scan/2026-04-28-cms-announces-first-healthtech-ecosystem-tools (excerpts)

**Internal (read, not modified)**
- `CLAUDE.md`, `.claude/skills/ui-competitors/SKILL.md`
- `.local/deliverables/tm-comprehensive-roadmap.md`, `health-mint-comprehensive.md`, `health-mint-gap-analysis.md`
- `client/src/components/language-provider.tsx`, `client/src/pages/{us-paywall,cash-prices,lab-results,vitals,medication-reconciliation,offline-mode}.tsx`, `client/public/sw.js`, `server/services/feature-gates.ts`

**Limits of this pass**
- Not scraped as full pages: Apple Health Records feature page (returned a generic healthcare overview), Fasten pricing page, Medisafe Premium pricing page, NextGen and Veradigm language support.
- Teladoc, Hims, and Medisafe pricing can vary by plan and state. Re-verify before quoting any competitor price in marketing copy.
- No screenshots were taken. This pass compared features and pricing, not visual design.
