# App Store + Play Store Submission Asset Pack

**Status:** Paste-ready answers, content specs, and asset checklist. Build the actual binary screenshots from the running app once Capacitor is scaffolded.

---

## 1. App metadata (both stores)

| Field | Value |
|---|---|
| App name | Tabula Medica |
| Subtitle (App Store, 30 chars) | Your health record. Yours. |
| Short description (Play, 80 chars) | The patient-controlled health record for everyone — insured or not. |
| Full description | See section 2 below |
| Primary category | Medical |
| Secondary category | Health & Fitness |
| Age rating | 17+ (Medical/Treatment Information) |
| Bundle ID (iOS) | health.tabulamedica.app |
| Package name (Android) | health.tabulamedica.app |
| Support URL | https://tabulamedica.health/support |
| Marketing URL | https://tabulamedica.health |
| Privacy policy URL | https://tabulamedica.health/privacy |
| Pricing | Free with In-App Purchases |
| In-app purchase | Tabula Medica Pro — $9.99/month auto-renewing subscription (RevenueCat) |

---

## 2. Full app description (paste into both stores)

```
Tabula Medica is the health record built for you — not your doctor's billing department.

Pull every record from every doctor you've ever seen into one place you control. Find a doctor who takes Medicaid, accepts uninsured patients on a sliding scale, or speaks your language. Check whether you qualify for Medicaid, CHIP, or a marketplace subsidy in about a minute. Generate a QR code to share your record with a new clinic — by copy, WhatsApp, or any app — that expires when you say it does.

WHAT'S INSIDE
• Records from Epic, Cerner, athenahealth, eClinicalWorks, MEDITECH, and Fasten Health
• Claims and EOBs from UnitedHealthcare, Anthem, Aetna, Cigna, Humana, BCBS, Kaiser, Medicare, Molina, and Centene
• Medicaid / CHIP / ACA Marketplace eligibility screener using current Federal Poverty Level guidelines
• Find a Doctor — search by specialty, accepts-Medicaid, sliding-fee-scale, language spoken
• Sesame Care direct primary care booking with transparent upfront pricing
• FQHC and community resource search via FindHelp.org and HRSA
• Drug savings — manufacturer assistance, generic alternatives, GoodRx pricing
• Insurance learning — interactive lessons on copay, deductible, prior auth, referrals
• AI care assistant — ask a question, get routed to the right tool
• Secure record sharing with QR codes that expire on your schedule
• Printable PDF care packets for specialist visits
• 22 languages including Arabic, Hebrew, Farsi, Urdu, Pashto with right-to-left layout
• Voice transcription and translation in 50+ languages

PRIVACY AND SECURITY
• Zero-knowledge encryption — your records are encrypted with a key only you hold
• HIPAA-compliant audit logging on every access
• Multi-factor authentication required
• No advertising. No selling your data. Ever.

WHO THIS IS FOR
The 40 million Americans without insurance. The 60 million who have a card but can't afford to use it. The patients who get bounced between ER, urgent care, FQHC, and specialty referrals and have to start over each time. The families managing care for a parent or child across multiple providers.

PRO SUBSCRIPTION ($9.99/month)
• Family member coverage — manage records for up to 5 dependents
• Premium AI features — extended care plans, deeper document analysis
• Expanded document storage

Tabula Medica is for informational purposes only. Not for clinical decision-making. Always consult your healthcare provider for medical advice.
```

---

## 3. Keywords (App Store, 100 chars max, comma-separated)

```
health record,medicaid,uninsured,FQHC,sliding scale,EHR,medical history,patient,FHIR,care
```

(98 chars — fits.)

## Play Store tags (5 max)
- Medical records
- Health insurance
- Patient portal
- Telehealth
- Personal health

---

## 4. Apple App Privacy Questionnaire — paste-ready answers

Apple's "App Privacy" section in App Store Connect. Answer each section precisely. Reviewers WILL audit these against actual SDK behavior.

### Data collection summary

**Do you or your third-party partners collect data from this app?** YES

### Data types — what we collect and why

| Data type | Collected | Linked to identity | Used for tracking | Purpose | Source |
|---|---|---|---|---|---|
| **Health & Fitness — Health** | YES | YES | NO | App functionality | User input + EHR connections |
| **Contact info — Name** | YES | YES | NO | App functionality | User input |
| **Contact info — Email** | YES | YES | NO | App functionality, account creation | User input via Auth0 |
| **Contact info — Phone** | OPTIONAL | YES | NO | MFA via Twilio SMS | User input |
| **Identifiers — User ID** | YES | YES | NO | App functionality | Auth0 user ID |
| **Identifiers — Device ID** | NO | — | — | — | — |
| **Usage data — Product interaction** | YES | YES | NO | Analytics | Internal Analytics service |
| **Diagnostics — Crash data** | YES | NO | NO | App functionality | Cloud Logging |
| **Diagnostics — Performance data** | YES | NO | NO | App functionality | Cloud Logging |
| **Financial info** | NO* | — | — | — | — |
| **Location — Coarse** | OPTIONAL | NO | NO | Find a Doctor / FQHC search | User-granted |
| **Location — Precise** | NO | — | — | — | — |
| **User content — Photos or videos** | YES | YES | NO | Insurance card OCR, DD-214 upload | User upload |
| **User content — Audio** | YES | YES | NO | Voice access, ambient encounter — **memory-only, never persisted** | Microphone |
| **User content — Other** | YES | YES | NO | Health records uploaded by user | User upload |
| **Sensitive info** | YES | YES | NO | Health information explicitly | EHR + user |

*Financial info: RevenueCat handles subscription billing. We never see card numbers — Apple/Google take payment, RevenueCat receives entitlement webhooks.

### Tracking
**Does this app use data for tracking?** NO. We do not track users across apps or websites owned by other companies.

### App Tracking Transparency prompt
Not required (we do not track).

---

## 5. Apple Health permissions (NSHealthShareUsageDescription)

When Capacitor's HealthKit plugin is added, the Info.plist must include:

```xml
<key>NSHealthShareUsageDescription</key>
<string>Tabula Medica reads your Health data to bring it together with your other records in one place you control. Nothing is shared without your explicit consent.</string>

<key>NSHealthUpdateUsageDescription</key>
<string>Tabula Medica writes vitals you log here back to Apple Health so your other apps stay in sync.</string>

<key>NSMicrophoneUsageDescription</key>
<string>Tabula Medica records doctor visits when you tap the record button so you can refer back to your visit later. Recording starts only when you tap and stops when you tap stop. Recordings are encrypted on your device and uploaded only after you tap "Save".</string>

<key>NSCameraUsageDescription</key>
<string>Tabula Medica uses the camera to scan insurance cards and upload medical documents.</string>

<key>NSPhotoLibraryUsageDescription</key>
<string>Tabula Medica accesses your photo library so you can upload medical documents and insurance cards.</string>

<key>NSFaceIDUsageDescription</key>
<string>Tabula Medica uses Face ID to unlock your encrypted health record.</string>

<key>NSLocationWhenInUseUsageDescription</key>
<string>Tabula Medica uses your location to find nearby doctors, FQHCs, and community health resources.</string>
```

---

## 6. Android permissions (AndroidManifest.xml)

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
<uses-permission android:name="android.permission.USE_BIOMETRIC" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

<!-- Health Connect (Android equivalent of HealthKit) -->
<uses-permission android:name="android.permission.health.READ_HEART_RATE" />
<uses-permission android:name="android.permission.health.READ_BLOOD_PRESSURE" />
<uses-permission android:name="android.permission.health.READ_STEPS" />
<uses-permission android:name="android.permission.health.WRITE_HEART_RATE" />
<uses-permission android:name="android.permission.health.WRITE_BLOOD_PRESSURE" />
```

---

## 7. Play Store Data Safety form

Different from App Store. Same answers, different format.

| Category | Collected? | Shared? | Optional? | Purpose |
|---|---|---|---|---|
| Personal — Name | Yes | No | No | Account, App functionality |
| Personal — Email | Yes | No | No | Account, App functionality |
| Personal — Phone | Yes | No | Yes | Account, MFA |
| Health & fitness — Health info | Yes | No | No | App functionality |
| Health & fitness — Fitness info | Yes | No | Yes | App functionality |
| Photos & videos — Photos | Yes | No | Yes | App functionality |
| Audio — Voice / sound recordings | Yes | No | Yes | App functionality (memory-only) |
| Files & docs — Files & docs | Yes | No | Yes | App functionality |
| App activity — App interactions | Yes | No | No | Analytics, App functionality |
| App activity — Search history | No | — | — | — |
| Device or other IDs — Device or other IDs | No | — | — | — |
| App info & performance — Crash logs | Yes | No | No | App functionality |
| App info & performance — Diagnostics | Yes | No | No | App functionality |
| Location — Approximate location | Yes | No | Yes | App functionality |

**Data encryption in transit:** YES (TLS 1.3, HSTS)
**Data encryption at rest:** YES (AES-256-GCM, KMS)
**User can request data deletion:** YES (Account → Delete account, plus separate Privacy → Export & Delete)
**Independent security review:** Will be YES once HITRUST certification completes (currently CSF-mapped, not certified)
**Family policy:** App is not directed at children under 13.

---

## 8. Screenshot inventory

Apple requires the following sizes. Build all of these from the running app once Capacitor is on a Mac.

### iPhone 6.7" (required) — 1290 × 2796px
1. **Landing / value prop** — hero with "Your health record. Yours." headline, mission tagline, sign-in button
2. **Patient dashboard** — record summary, recent activity, AI health summary card
3. **Care Access section** — `/care` 6-tile grid
4. **Coverage Eligibility result** — programs you qualify for, FPL%, subsidy estimate
5. **Find a Doctor** — provider list with sliding-fee-scale and Medicaid badges
6. **Share Your Records** — QR code with expiration countdown
7. **Insurance Learning** — interactive lesson with progress
8. **Settings — Language card** — showing 22 languages with RTL badges

### iPad 12.9" (required if iPad supported) — 2048 × 2732px
Same 8 shots in landscape with sidebar visible.

### Android — phone, 7" tablet, 10" tablet
Same content as iPhone shots, exported at 1080 × 1920 minimum.

### Feature graphic (Play Store only) — 1024 × 500px
Spec: dark teal gradient background. Foreground: device mockup showing the Care Access tile grid. Headline overlay: "Healthcare that follows you." in white Inter Bold 64pt. Bottom-right corner: Tabula Medica wordmark in white.

### App icon — 1024 × 1024 PNG, no transparency, no rounded corners (Apple rounds for you)
Spec: solid sapphire background (#1a3a52). Centered: stylized "T" caduceus mark in warm off-white (#f5f0e8). No text. No drop shadow.

---

## 9. App Store reviewer notes (paste into App Store Connect "Notes for Reviewer")

```
Tabula Medica is a patient-controlled health record. The app fits Apple Guideline 5.1.1 (Privacy) and 1.4.1 (Medical) as follows:

1. Medical disclaimer: Every clinical surface displays "For informational purposes only. Not for clinical decision-making." This is FDA non-CDS positioning. The app does not provide diagnosis, treatment, or clinical decision support — it presents the patient's own data and helps them find care.

2. Data handling: All PHI is encrypted at rest (AES-256-GCM) with patient-held keys (zero-knowledge). EHR connections use SMART on FHIR OAuth 2.0 + PKCE — the patient authorizes each connection at the EHR's own login screen.

3. HIPAA: We hold a Business Associate Agreement with [pending — Auth0 BAA in progress]. PHI does not transit any third-party SDK that is not BAA-covered.

4. Test account credentials:
   Email: appreviewer@tabulamedica.health
   Password: [generate before submission]
   This account has sample (synthetic) patient data — no real PHI.

5. To exercise the Care Access tools:
   - Eligibility screener: Care → Coverage Eligibility → enter income $32000, household size 3, ZIP 60601
   - Find a Doctor: Care → Find a Doctor → ZIP 60601, specialty Family Medicine
   - Share Records: Care → Share Records → generate link
   - AI Care Assistant: Care → Ask the Care Assistant → "I lost my insurance, what do I do?"

6. The AI Ambient Encounter feature (Encounters → Record) uses the microphone. Audio is processed in memory and never written to disk. The transcript is stored only after the patient explicitly saves the SOAP note.

7. Subscription: Pro tier ($9.99/month auto-renewing) is offered via RevenueCat. Restore purchases is supported. Free tier is fully functional for the core record + Care Access tools.

If you need anything else, contact: support@tabulamedica.health
```

---

## 10. Pre-submission checklist

- [ ] App icon at 1024×1024 designed and exported
- [ ] Feature graphic (Play) at 1024×500 designed and exported
- [ ] All 8 screenshots captured for iPhone 6.7" (after Capacitor build)
- [ ] All 8 screenshots captured for iPad 12.9" (after Capacitor build)
- [ ] All 8 screenshots captured for Android phone
- [ ] App Privacy questionnaire filled in App Store Connect (use Section 4)
- [ ] Data Safety form filled in Play Console (use Section 7)
- [ ] Info.plist usage descriptions written into Capacitor iOS project (Section 5)
- [ ] AndroidManifest.xml permissions written into Capacitor Android project (Section 6)
- [ ] Reviewer notes pasted (Section 9) with real test account password generated
- [ ] Auth0 BAA executed (blocking — required before submission)
- [ ] RevenueCat product `tabula_medica_pro_monthly` created in App Store Connect AND Play Console with $9.99 price
- [ ] In-App Purchase metadata reviewed
- [ ] Marketing URL, support URL, privacy policy URL all return 200 (not 404)

---

## Notes

- We do **not** support sign-in with Apple as the primary auth method — we use Auth0. Apple requires "Sign in with Apple" as an alternative when other third-party SSO is offered. Add Apple as one of the Auth0 social providers before iOS submission to avoid a 4.8 rejection.
- The Capacitor app is shipped in **bundled-asset mode** (web assets ship inside the .ipa/.aab). This is the deliberate choice to avoid Guideline 4.2 ("just a website") rejection for healthcare apps.
- Camera, mic, location, photos, biometrics — every permission has a clear in-app reason shown before the system prompt fires. Apple reviewers fail apps that fire permission prompts cold.
