# TestFlight Reviewer Walkthrough — Tabula Medica

**Audience:** Apple App Review team (and Google Play reviewer, by analogy)
**Submission contact:** [your name + email]
**App version:** [fill in at submission time]
**Build number:** [fill in at submission time]

---

## Paste-ready text for App Store Connect → "App Review Information → Notes"

> Tabula Medica is a Personal Health Record (PHR) for U.S. patients, designed especially for the 40 million uninsured and underinsured Americans. It is **not** a medical device, **not** a Clinical Decision Support tool under FDA 21 CFR 880.6900, and does **not** make diagnostic or treatment decisions. Every clinical surface displays a `ClinicalDisclaimer` ("Educational information only — not medical advice. Always consult a qualified healthcare professional.").
>
> **Test account:**
> - Email: `reviewer@tabulamedica.health`
> - Password: `[INSERT REVIEWER TEST PASSWORD HERE]`
> - This account is pre-populated with **synthetic** patient data (no real PHI): 1 patient, 3 medications, 3 conditions, 6 lab results, 1 upcoming appointment, and 1 active care gap. Section E walks through recording a fresh ambient encounter live during review.
>
> **Sign-in options** include Email, Google, GitHub, Apple, and X. Sign in with Apple is offered per Guideline 4.8.
>
> **PHI handling:** All Protected Health Information is encrypted at rest (AES-256-GCM with a per-record envelope key) and in transit (TLS 1.3). No PHI is sent to any third-party analytics or tracking SDK. We use Auth0 Enterprise (Business Associate Agreement on file) for identity, Medplum (BAA) for FHIR storage, and Vertex AI (BAA) for clinical AI inference. We do not display ads, do not use IDFA, and do not include `NSUserTrackingUsageDescription` because we do not track users across apps or websites.
>
> **HealthKit:** With explicit user consent we read selected categories (Vitals, Activity, Sleep, Labs, Medications, Conditions) and write back medications and conditions the user manually adds. The HealthKit consent sheet is shown the first time a user opens "Connect Apple Health" from the dashboard.
>
> **Microphone:** The "Ambient Encounter" feature records a doctor visit on-device for the patient's own reference. The recording is encrypted on-device and uploaded for transcription only after the patient taps "Save". Patients are shown a clear in-screen notice ("Recording — only you can hear this") with a stop button. No background recording. No recording without an explicit tap.
>
> **Subscriptions:** The app uses RevenueCat with Apple StoreKit. There is one paid product: "Tabula Medica Pro — $9.99/month" with a 7-day free trial. Free tier provides core PHR access; Pro unlocks unlimited AI questions, ambient encounters, and family sharing. Restore Purchases is available on Settings → Subscription.
>
> **Detailed walkthrough below covers every major flow.**

---

## Walkthrough — copy this section into the Notes field too if space allows

Times below are estimates for an attentive reviewer.

### Section A — First launch & sign-in (≈2 minutes)

1. Open the app. The splash screen fades into the **Welcome** screen.
2. Tap **Get Started** → routed to **/login**.
3. Try **Sign in with Apple**:
   - Tap the **Apple** button (lower-left of the social grid).
   - Apple's native sheet appears.
   - Either complete it with a real Apple ID, **OR** back out and use the test account below — both paths land at the dashboard.
4. To use the pre-populated test account: tap **Continue with Email**, enter the credentials in the Notes section above.
5. After auth completes, you land on the **Dashboard** at **/**.

### Section B — Dashboard tour (≈1 minute)

1. Top section: greeting + active **Care Gap** card (e.g. "Annual A1C overdue").
2. Middle: quick-action grid — Records, Medications, Care, Family.
3. The persistent bottom nav (mobile) has Home / Records / Care / Settings.
4. Top-right avatar opens the profile menu.

### Section C — Personal Health Record (≈3 minutes)

1. Tap **Records** in the bottom nav → **/records**.
2. You'll see synthetic Lab Results, Medications, Conditions, Allergies, Immunizations.
3. Tap any **Lab** to see the trend chart (lipid panel has 3 data points).
4. Back, then tap **Medications** → tap **Lisinopril** → drug detail with savings options ("Find lower price"). The savings page links to GoodRx-style coupons (mock data clearly labeled).
5. Back to Records. Tap **+ Add** (top-right) → **Add Allergy** → fill in "Peanuts" → Save. The new allergy appears immediately.

### Section D — Connect a hospital (EHR) (≈2 minutes — mock flow)

1. From the dashboard tap **Connect Hospital** → **/ehr/connect**.
2. Search "Epic MyChart" → tap the result.
3. The **SMART on FHIR** sandbox window opens. **Note to reviewer:** in TestFlight we connect to Epic's public sandbox, not a real hospital. Use credentials `fhirjason` / `epicepic1` (Epic's published sandbox creds — public knowledge).
4. Approve the scopes → return to the app → see imported synthetic data.

### Section E — Ambient encounter (microphone permission) (≈3 minutes)

1. From the dashboard tap **New Visit** → **/encounter/new**.
2. The mic permission sheet appears the first time. Tap **Allow**.
3. The recording UI shows a waveform and a red stop button.
4. Speak: "Patient reports headache for two days, no fever."
5. Tap **Stop**. A consent screen appears: "Send to AI for transcription?" with **Save Locally** and **Save & Transcribe** options.
6. Tap **Save & Transcribe**. The transcript and structured note appear within ~10 seconds.
7. **Important:** if you tap **Save Locally**, nothing leaves the device. Demonstrating both paths shows the data-minimization design.

### Section F — Care Access subsystem (uninsured-focused) (≈4 minutes)

The **/care** index has 6 tools designed for uninsured patients:

1. **Find a Doctor** — searches free/low-cost clinics by ZIP. Try ZIP `97201` (Portland, OR) for sample results.
2. **Eligibility Screener** (`/care/eligibility`) — screens for Medicaid, ACA, charity care. Enter household size 2, income $24,000/year. Note the locale-safe number parser handles Eastern-Arabic digits as well.
3. **Share Records** (`/care/share-records`) — generates a time-limited QR code. Tap **Generate** → a 1-hour QR appears with a live countdown. Try **Copy Link** and **Send via WhatsApp**.
4. **Export** — generates a PDF packet for an ER visit.
5. **VA Verification** (`/care/va`) — DD-214 upload stub for veterans (no upload occurs in test mode; reviewer will see the upload UI but submission is disabled in TestFlight).
6. **AI Help** — ask "I have chest pain" → the AI responds with safety triage, NOT a diagnosis, and includes the educational-only disclaimer.

### Section G — Family sharing (≈2 minutes)

1. Settings → **Family** → **Invite Family Member**.
2. Enter `family@example.com` → choose role **Caregiver** → Send.
3. The invite appears in the Pending list. (No email is actually sent in TestFlight — clearly indicated.)

### Section H — Internationalization & accessibility (≈1 minute)

1. Settings → **Language** → switch to **العربية (Arabic)**.
2. Layout flips to RTL. Note **drug names and units stay in English** by design (clinical safety rule).
3. Switch back to English.
4. Settings → **Display** → toggle **Dark Mode**. Verify contrast remains WCAG AA.
5. Settings → **Display** → enable **Large Text** to verify Dynamic Type support.

### Section I — Subscription (≈2 minutes)

1. Settings → **Subscription** → tap **Upgrade to Pro**.
2. Apple's StoreKit sheet appears with the 7-day trial → $9.99/month copy.
3. **You do not need to actually subscribe** for review. Tap **Cancel**.
4. Tap **Restore Purchases** to verify the restore flow surfaces a "No purchases to restore" message cleanly.

### Section J — Privacy controls (≈2 minutes)

1. Settings → **Privacy** → review the data-collection disclosures (matches the App Privacy questionnaire submitted with this build).
2. Tap **Export My Data** → a JSON download is prepared (within ~5 seconds for the test account).
3. Tap **Delete My Account** → confirmation modal explains the 30-day grace period. **Do not confirm** during review — this would delete the test account.

### Section K — Comprehensive smoke test (optional, ≈15 minutes)

Open **/admin/smoke-test** in Safari (after logging into the test account). This is a 12-section internal release-readiness checklist normally used by our QA team. Reviewers may use it to systematically explore every flow. The page generates a downloadable Markdown report.

---

## Likely reviewer questions & pre-prepared answers

### Q1: "Is this a medical device?"
**A:** No. Tabula Medica is a Personal Health Record. It does not make diagnostic decisions, does not recommend treatment, and does not interpret images. The AI assistant provides educational information with explicit disclaimers and triage prompts that direct users to qualified professionals or 911. We do not meet the FDA criteria for a medical device under 21 CFR 880.

### Q2: "How is patient data protected?"
**A:** All PHI is encrypted at rest with AES-256-GCM using a per-record envelope key. In transit we require TLS 1.3. We use Auth0 (BAA), Medplum (BAA), and Google Vertex AI (BAA) for backend services. No PHI flows to analytics, ad networks, or third-party SDKs. The test account contains only synthetic data.

### Q3: "Why does the app need microphone access?"
**A:** Solely for the user-initiated Ambient Encounter feature, which records a single doctor's visit on-device, encrypts it, and only uploads it after the user taps Save & Transcribe. There is no background recording. The Info.plist `NSMicrophoneUsageDescription` reads: "Record a doctor's visit so you can refer back to it later. Recording only starts when you tap the record button."

### Q4: "Why does the app need HealthKit access?"
**A:** To consolidate the patient's full health picture in one place. We read Vitals, Activity, Sleep, Labs, Medications, Conditions, and Immunizations only with explicit per-category user consent. We write back only medications and conditions that the user manually adds in our app. Reading/writing is gated behind a per-category consent sheet.

### Q5: "Does the app track users?"
**A:** No. We do not include `NSUserTrackingUsageDescription` because we do not track users across apps or websites. We do not use IDFA. Our App Privacy questionnaire reflects this.

### Q6: "What if a user enters an emergency symptom?"
**A:** The AI assistant pattern-matches red-flag symptoms (chest pain, shortness of breath, stroke signs, suicidal ideation) and surfaces a 911 banner before any other content. Try it with the chest-pain prompt in Section F-6.

### Q7: "Is the subscription required to use the app?"
**A:** No. The free tier provides core PHR access (records storage, EHR connections, sharing, care access tools). Pro is required only for unlimited AI questions, ambient encounters beyond the monthly free quota, and family sharing for more than 2 members.

### Q8: "Why are some buttons (e.g., DD-214 upload, family invite email) non-functional?"
**A:** TestFlight builds disable real outbound communications and document uploads to keep test data clean. The UI is fully functional; the network call is stubbed and clearly indicated by an in-app "TestFlight mode" hint.

### Q9: "What happens to my data if I delete my account?"
**A:** Settings → Privacy → Delete My Account → 30-day grace period (during which the user can restore by signing in again) → permanent deletion of all PHI and identity records. Audit logs retain only the hash of the user ID for compliance, never the data.

### Q10: "Does the app use AI? What model? What for?"
**A:** Yes. We use OpenAI GPT-4-class models for the patient-facing assistant (educational content only) and Google Vertex AI (Gemini) for ambient encounter transcription and structured note generation. Both vendors have BAAs in place. No model is trained on user PHI; all inference is single-turn with no opt-in to vendor training.

---

## Things to double-check before clicking "Submit for Review"

- [ ] Test account created in production Auth0, password set, recorded above
- [ ] Test account populated with synthetic data (run the seed script: `npm run seed:reviewer-account`)
- [ ] Build number incremented in Xcode
- [ ] Marketing screenshots match the actual current UI (re-shoot after any visual change)
- [ ] Privacy URL `https://tabulamedica.health/privacy` returns 200
- [ ] Terms URL `https://tabulamedica.health/terms` returns 200
- [ ] All six `/legal/*` URLs resolve (200) and render their title:

  | URL | Content source | Status |
  |---|---|---|
  | `/legal/privacy` | Termly-generated (Privacy Policy) | Placeholder until Termly export reviewed |
  | `/legal/terms` | Termly-generated (Terms of Service) | Placeholder until Termly export reviewed |
  | `/legal/cookie` | Termly-generated (Cookie Policy) | Placeholder until Termly export reviewed |
  | `/legal/disclaimer` | Termly-generated (Disclaimer) | Placeholder until Termly export reviewed |
  | `/legal/accessibility` | Hand-written (WCAG 2.1 AA + Section 508 statement) | Placeholder; content authored in-house |
  | `/legal/hipaa-notice` | Hand-written (HIPAA Notice of Privacy Practices, 2026 update — derived from `client/src/pages/privacy-policy.tsx`) | Placeholder; canonical text already exists at `/privacy-policy`, needs paste-in |
  | `/legal/care-access-privacy` | Hand-written (Care Access Privacy Notice — describes how care-coordination data is shared with linked providers/family caregivers on `/care/*` routes) | Placeholder; surfaced conditionally by `LegalFooter` on `/care/*` and reachable directly via URL when signed out (publicLegalRoutes allowlist) |

  Note for reviewers: page bodies show a "content pending legal review"
  notice during the Termly content-finalization window. Routes are live
  to satisfy the App Store requirement that legal links resolve; the
  body text is inserted in a follow-up release once the Termly export
  is reviewed (4 pages) and the hand-written HIPAA + Accessibility
  copy is finalized (2 pages).

- [x] **Resolved (Session 5 close, 2026-04-18):** `/legal/care-access-privacy`
  scaffolded as the 7th legal page using the same `LegalDocument` wrapper +
  `LEGAL_PLACEHOLDERS` slug-dispatch pattern; added to publicLegalRoutes
  allowlist; smoke-test panel expanded from 7 → 8 steps. Original note
  (preserved for context): `/legal/care-access-privacy`
  is referenced by `LegalFooter` (conditional on `/care/*` routes) but
  is not yet scaffolded. The link will 404 only when a user is signed
  in *and* navigated to a `/care/*` page; the App Store reviewer flow
  does not require this. Scaffolding is a 5-minute follow-up that
  reuses the same `LegalDocument` wrapper.
- [ ] `/admin/smoke-test` walked end-to-end in TestFlight build, report attached
- [ ] HealthKit entitlement enabled in Xcode
- [ ] Sign in with Apple capability enabled in Xcode
- [ ] Push Notifications capability enabled in Xcode
- [ ] Background Modes → Audio enabled in Xcode (for ambient encounter)
- [ ] No `NSUserTrackingUsageDescription` key in Info.plist
- [ ] All `NSXxxUsageDescription` strings reviewed for clarity (microphone, camera, photo library, HealthKit read, HealthKit write, Face ID)
- [ ] App Privacy questionnaire matches the actual data flows (the one in `app-store-submission.md`)
- [ ] Subscription product created in App Store Connect, status "Ready to Submit", attached to this build
- [ ] RevenueCat product wired to the Apple product ID
- [ ] In-app review prompt triggers ONLY after a positive user action (e.g. successful EHR import), never on launch

---

## On the off chance the reviewer rejects:

The two most common rejection vectors for healthcare apps are:

1. **Guideline 4.2 (Minimum Functionality / "just a website")** — mitigated by bundled-asset Capacitor build, native HealthKit integration, native microphone use for ambient encounter, native Sign in with Apple, native push notifications, and native StoreKit subscription. Reply with this list.

2. **Guideline 5.1.1 (Data Collection and Storage) — health data sensitivity** — mitigated by zero third-party analytics, BAA-covered processors, AES-256-GCM at rest, no IDFA, explicit consent gates, and the synthetic-only test account. Reply with the privacy section above.

For any rejection, respond within 24 hours with the specific section of this document and a screen recording showing the reviewer-cited behavior with the test account.
