# Tabula Medica — Store Listing Drafts (for approval)

> ⚠️ **Copy is deliberately NON-DIAGNOSTIC / NON-CDS.** The app's clinical-decision-support
> surface is gated OFF (see `../NO-CDS-TRIAGE.md`). The listing must describe a **records
> management + patient-access** tool, NOT diagnosis, advice, or clinical recommendations —
> both for App Review and to stay consistent with the regulatory posture. Counsel should
> review this copy before submission.

## Identity (both stores)
- **App name:** Tabula Medica
- **Bundle / package:** `com.tabulamedica.app`
- **Primary category:** Medical *(alt: Health & Fitness — lighter review; Medical is more accurate for a PHR)*
- **Age rating:** 17+ (infrequent/mild medical information)
- **Price:** Free

## App Store (Apple)
- **Subtitle (≤30 chars):** `Your records, in one place`
- **Promotional text (≤170):** Bring your medical records together, see a clear timeline, and share a secure summary with whoever you choose — locked behind Face ID.
- **Keywords (≤100):** `health records,medical records,PHR,health history,FHIR,patient,share records,health timeline,Face ID`
- **Description:**
```
Tabula Medica is your personal health record — a single, private place to bring
together medical records from across your providers, see them on a clear timeline,
and share a summary with family, a new doctor, or emergency personnel when YOU choose.

• Unify records from multiple providers and networks
• A plain-language timeline of your visits, medications, and documents
• Scan insurance cards and upload documents with your camera
• Emergency info + a single-use, time-limited, revocable share link
• Locked behind Face ID / fingerprint — your records stay on your terms
• Export your data and manage your privacy choices anytime

Tabula Medica is a records-management tool to help you organize and share your own
health information. It does not provide medical advice, diagnosis, or treatment
recommendations. Always consult a qualified clinician for medical decisions.
```
- **Privacy Policy URL:** `https://tabulamedica.world/privacy`  *(verify this page is live + public before submit)*
- **Support URL:** `https://tabulamedica.world/support`
- **App Privacy (nutrition label) — data types:** Health & Fitness; Contact Info (name, email, phone); Identifiers; Photos (uploaded docs). Linked to user, used for App Functionality, **no tracking**.
- **Demo account for review:** REQUIRED — create a reviewer login with seeded synthetic data (the server demo-login backdoor was removed, so provision a real test account).

## Google Play
- **Short description (≤80):** `Your medical records in one private place — unify, view, and share securely.`
- **Full description:** (reuse the App Store description above; Play allows 4000 chars)
- **Data safety form:** Health info, Personal info (name/email/phone), Photos — collected, encrypted in transit, user can request deletion (account deletion + DSAR are implemented under `/api/account/*`). No data sold; no ad tracking.
- **Content rating questionnaire:** medical/health reference; no objectionable content.
- **Privacy Policy URL:** `https://tabulamedica.world/privacy`

## Screenshots (REQUIRED — not yet produced)
Need 6.7"/6.5" iPhone + 12.9" iPad + Android phone/tablet sets. Capture from the live
web app or a simulator running the shell: Landing/unlock, Timeline, Record detail,
Emergency share, Settings/Privacy. No real PHI in screenshots — use synthetic data.
