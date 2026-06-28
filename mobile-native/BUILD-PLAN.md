# Tabula Medica Native — Build Plan (scaffold → App Store + Play)

This is the sequenced plan to take `mobile-native/` from its current buildable
scaffold to a submitted, approved app on both stores. It is honest about what
is **done**, what is **stubbed/partial**, and every **external gate** the
founder personally must clear (account access, signing, legal/clinical review).

Live backend for all of this: `https://tabulamedica.us` (same Cloud Run
service as `…world`). Apple Team ID: **U56SKX5MXX**. A Google Play account
exists.

---

## 0. Status snapshot

### Done (real, wired to the live backend)

- **Project scaffold**: `package.json`, `app.json`, `eas.json`, `tsconfig`,
  `babel`, `metro` (with `../modules` watch-folder for the CAC reader), `.env.example`.
- **Typed API client** (`src/api/`): fetch-based, GCIP bearer-token injection,
  one-shot 401 refresh+retry, normalized `ApiError`. Resource modules for auth,
  records/timeline/dashboard, GDPR/data-rights, and share links — each mapped to
  the exact routes in `server/mobile-api-routes.ts` and `server/routes/gdpr-routes.ts`.
- **Auth**: GCIP/Firebase email+password, Google, and Apple sign-in; register +
  email-verification + password reset; backend session handoff
  (`POST /api/mobile/auth/gcip/session`); secure token handling via the Firebase
  SDK + `expo-secure-store` for cached identity.
- **Biometric gate**: `AuthContext` + `LockScreen`, Face ID / fingerprint /
  passcode via `expo-local-authentication`; re-locks on background; opt-out in Settings.
- **Screens (real, with loading / empty / error / refresh states):**
  - Login (+ biometric unlock)
  - Home / Dashboard (summary stats + recent timeline)
  - Records list (filterable by type) + Record detail
  - Emergency / break-glass (generate 4-hour QR share, list + revoke)
  - Settings (profile, biometric toggle, links)
  - Privacy & Data Rights (GDPR/CCPA toggles, data export, **account deletion**
    with 30-day grace + cancel)

### Stubbed / partial (configured, not yet feature-complete)

- **HealthKit / Health Connect**: entitlement + Info.plist strings + Android
  health permission are declared; `react-native-health` is a dependency. No read/
  write code or sync UI yet. (§3)
- **CAC/PIV NFC**: the `expo-cac-reader` module + `useCACReader()` hook exist and
  are referenced; no CAC login screen is wired into the router yet. (§3)
- **Push notifications**: `expo-notifications` plugin configured; no token
  registration, permission prompt, or handler yet, and there is no backend push
  endpoint. (§3)
- **App icons / splash**: every PNG in `assets/images/` is a placeholder copy of
  the repo logo (see that folder's README). (§5)
- **Onboarding flow**: backend supports it
  (`/api/mobile/onboarding/*`, `needsOnboarding`); no native onboarding screens yet. (§2)
- **EHR connect (SMART on FHIR)**: backend routes exist
  (`/api/mobile/ehr/*`, PKCE); no native connect UI yet. (§2)
- **Document upload / camera scan, AI summaries, messaging, appointments,
  immunizations, share-management UI**: backend-available, no native screens yet. (§2)

### Not started

- Unit/integration/E2E tests (§6)
- CI pipeline for typecheck/lint/EAS (§6)
- Store listing copy, screenshots, privacy nutrition labels (§5, §7)
- Production secrets in EAS (§4)

---

## 1. Finish the foundation (engineering, no external gate)

1. `npm install` in `mobile-native/`, then `npx expo-doctor` and resolve any
   version mismatches (Expo pins RN/React for you).
2. `npm run typecheck` and `expo lint`; fix anything the scaffold surfaced.
3. Create `.env` from `.env.example`; populate `EXPO_PUBLIC_GCIP_*` from the
   Firebase project `united-planet-485003-n7-9f345` (web app config). These are
   public client keys, not secrets.
4. Make a **development build** (the CAC module + Firebase RN persistence don't
   run in Expo Go):
   - iOS simulator: `eas build --profile development -p ios` (or `expo run:ios`)
   - Android: `eas build --profile development -p android` (or `expo run:android`)
5. Smoke test: sign in (email + Google), lock/unlock, dashboard, records list +
   detail, emergency QR, privacy toggles, request export, schedule + cancel
   deletion, sign out.

## 2. Remaining product screens (mirror the web client `client/src/pages/`)

Priority order for launch parity:

1. **Onboarding** — name/DOB/language/connect-doctor, persisting to
   `/api/mobile/onboarding/progress`; gate on `needsOnboarding` from the session
   handoff. (web ref: `guided-onboarding.tsx`, `new-user-onboarding.tsx`)
2. **Connect a provider (SMART on FHIR)** — provider list
   (`GET /api/mobile/ehr/providers`), PKCE connect via `expo-auth-session` +
   `/api/mobile/ehr/connect` → `/callback`, then `/sync`. (web ref:
   `fasten-connect.tsx`, `health-data-sources.tsx`)
3. **Document upload / scan** — `expo-camera` + `expo-image-picker` to capture
   insurance cards & documents. (web ref: `document-upload.tsx`,
   `insurance-card-upload.tsx`)
4. **Share management** — full create/list/revoke UI with granular include
   toggles + expiry. (web ref: `share-links.tsx`, `care-share-qr.tsx`)
5. **Medications / Conditions / Labs / Immunizations** detail lists once the
   backend exposes per-resource endpoints (today the timeline is the single
   source). (web ref: `medications.tsx`, `conditions.tsx`, `lab-results.tsx`)
6. **AI summary** (NO-CDS-gated — keep feature-flagged OFF until counsel clears;
   honor `aiProcessingOptOut`). (web ref: `ai-summary.tsx`)
7. **Messaging, appointments, profile/family** as backend endpoints land.

## 3. Native-module integration

### HealthKit (iOS) / Health Connect (Android)

- `react-native-health` is included; `app.json` declares the HealthKit
  entitlement, the `NSHealth*` strings, and the Android health permission.
- TODO: request authorization, read vitals/steps/heart-rate, map into the
  timeline, optional write-back. Health Connect needs the Android config plugin
  + the `androidx.health.connect` runtime.
- **Apple gate**: HealthKit entitlement must be enabled on the App ID in the
  Apple Developer portal, and the App Store review notes must explain the use.

### CAC / PIV NFC (`../modules/expo-cac-reader`)

- Module + `useCACReader()` hook are ready (cert read, PIN verify, sign challenge).
- TODO: a `(auth)/cac.tsx` screen using the hook's state machine, plus backend
  `/api/auth/cac/challenge` + signature-verify endpoints (confirm they exist /
  build them). Requires a dev/prod build — NFC entitlement is already implied by
  `NFCReaderUsageDescription`; add the `com.apple.developer.nfc.readersession.formats`
  entitlement when wiring real CAC reads.

### Push notifications (`expo-notifications`)

- TODO: request permission, register the Expo push token, send it to a (new)
  backend endpoint, handle foreground/My-record notifications.
- **Gates**: iOS Push Notifications capability + an APNs key (`.p8`) uploaded to
  EAS; Android FCM `google-services.json` (server key) in EAS.

## 4. EAS build & submit setup

1. `eas login` (Expo account `rajivka2`, owner of project `34fa03f5-…`).
2. Push public env to EAS or keep them in `app.json extra`; store any real
   secrets via `eas secret:create` (none are needed for the public GCIP config).
3. Builds:
   ```bash
   eas build --profile preview   -p ios       # internal TestFlight-style
   eas build --profile preview   -p android    # internal APK
   eas build --profile production -p ios
   eas build --profile production -p android    # app-bundle
   ```
4. Submit:
   ```bash
   eas submit -p ios     --profile production   # needs eas.json appleId + ascAppId
   eas submit -p android --profile production   # needs play-service-account.json
   ```
5. EAS-managed credentials: let EAS generate the iOS distribution cert +
   provisioning profile (Team **U56SKX5MXX**) and the Android keystore, OR upload
   your own. Back up the Android keystore — losing it blocks future updates.

## 5. Store assets & metadata

- Replace all placeholder icons/splash (`assets/images/README.md`).
- Screenshots for required device sizes (6.7"/6.5" iPhone, 12.9" iPad, Android
  phone/tablet) — capture from the preview build.
- App name, subtitle, description, keywords, support URL, marketing URL,
  promotional text. Reuse the PHI-free marketing copy from `tabulamedica.com`.
- iOS **App Privacy** nutrition labels + Android **Data Safety** form — the repo
  already has `ANDROID_DATA_SAFETY.md`; mirror it for Apple. Declare health data,
  identifiers, and that data is NOT sold or used for tracking.

## 6. Quality gates (before submit)

- Unit tests for the API client (token injection, 401 retry, error mapping) and
  `AuthContext` gate logic.
- Detox/Maestro E2E for the sign-in → lock → dashboard happy path.
- GitHub Actions: typecheck + lint + test on PR; `eas build` on tag.
- Accessibility pass (labels, dynamic type, contrast) — health app, expect scrutiny.

## 7. EXTERNAL GATES — founder-only (cannot be done in code)

These block submission and require account access, payment, signing, or
legal/clinical sign-off:

1. **Apple ID for submission** — set `submit.production.ios.appleId` in
   `eas.json` (currently `TODO_…`). Must be a Team Admin/Account Holder on Team
   **U56SKX5MXX**.
2. **App Store Connect app record** — create the app for bundle
   `com.tabulamedica.app`, then put its numeric Apple ID into
   `submit.production.ios.ascAppId` (currently `TODO_…`).
3. **Apple capabilities on the App ID** — enable Sign in with Apple, HealthKit,
   Push Notifications, and (for CAC) NFC Tag Reading on the identifier.
4. **APNs auth key (`.p8`)** for push — generate in the Apple portal, upload to EAS.
5. **Google Play Console app** for `com.tabulamedica.app` + a **Play service
   account JSON** with release permissions, saved to
   `credentials/play-service-account.json` (git-ignored; referenced by `eas.json`).
6. **Android FCM `google-services.json`** if push is enabled.
7. **Firebase/GCIP**: add the iOS + Android OAuth client IDs and the app's
   SHA-1/SHA-256 (Android) so Google/Apple sign-in works in production; authorize
   the bundle/redirect; provide a reviewer GCIP test account (the hard-coded demo
   login was removed — reviewers need a real account).
8. **HIPAA / privacy / clinical review** — confirm the GCP BAA covers this data
   path (per memory the Google Cloud BAA is signed); legal sign-off on Terms/
   Privacy and store claims (Trevor Anderson); NO-CDS review keeps AI features
   OFF until cleared. PHI-transmit paths stay gated for any demo build.
9. **Final icon/splash/screenshot assets** from the design owner.
10. **Domain association files** for universal/app links
    (`apple-app-site-association` on `tabulamedica.health`, Android
    `assetlinks.json`) — server-side, to match the `app.json` intent filters.

---

## Quick reference — backend endpoints this app uses

| Screen / feature      | Method & path                                            |
| --------------------- | -------------------------------------------------------- |
| Session handoff       | `POST /api/mobile/auth/gcip/session`                     |
| Logout (audit)        | `POST /api/mobile/auth/logout`                           |
| Profile               | `GET /api/me`                                            |
| Dashboard             | `GET /api/dashboard`                                     |
| Summary               | `GET /api/records/summary`                               |
| Timeline / records    | `GET /api/records/timeline`                              |
| Share links           | `GET/POST/DELETE /api/share-links`                       |
| Privacy prefs         | `GET /api/gdpr/preferences`, `PATCH /api/gdpr/processing-prefs` |
| Data export           | `POST /api/gdpr/access-request`                          |
| Account deletion      | `POST /api/gdpr/erasure-request`, `POST /api/gdpr/erasure-cancel/:id` |
| Data-rights history   | `GET /api/gdpr/requests`                                 |
| EHR connect (later)   | `GET /api/mobile/ehr/providers`, `POST …/connect`, `…/callback`, `…/sync/:id` |
| Onboarding (later)    | `GET/PATCH /api/mobile/onboarding/progress`              |
