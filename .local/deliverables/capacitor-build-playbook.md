# Capacitor Build Playbook (iOS + Android)

**Status:** `capacitor.config.ts` is committed at the repo root and configured for **bundled-asset mode**. The iOS / Android native shells must be added on a Mac with Xcode (iOS) and a machine with Android Studio (Android). Follow this playbook on that machine.

---

## Why bundled-asset mode (vs Remote URL)

This is intentional and matches `replit.md` mobile strategy:
- Avoids Apple Guideline 4.2 "just a website" rejection risk for healthcare apps.
- Every PHI-touching code path passes Apple review (HIPAA-favorable).
- Patients with no signal still get the shell to load.
- The 24-48h App Store review buffer is a deliberate safety gate for clinical software.

Web users get instant updates. iOS/Android users get App Store release-cycle updates. Test on web first, ship to mobile once stable.

---

## One-time setup on the Mac

Prereqs:
- macOS with Xcode 15+ (for iOS)
- Android Studio Hedgehog or newer + Android SDK 34 (for Android)
- Node 20+, npm 10+
- CocoaPods (`sudo gem install cocoapods` or `brew install cocoapods`)

### Step 1 — Install Capacitor packages

These cannot be installed in the Replit container (sandboxed). Run on your Mac after `git pull`:

```bash
npm install --save \
  @capacitor/core@^6 \
  @capacitor/cli@^6 \
  @capacitor/ios@^6 \
  @capacitor/android@^6 \
  @capacitor/app@^6 \
  @capacitor/preferences@^6 \
  @capacitor/haptics@^6 \
  @capacitor/keyboard@^6 \
  @capacitor/status-bar@^6 \
  @capacitor/splash-screen@^6 \
  @capacitor/camera@^6 \
  @capacitor/filesystem@^6 \
  @capacitor/share@^6 \
  @capacitor/browser@^6
```

Optional plugins to add when needed:
- `@capacitor-community/apple-sign-in` — REQUIRED before App Store submission (Apple Guideline 4.8: when offering Auth0/Google/Facebook SSO, "Sign in with Apple" must also be offered).
- `@capacitor-community/health-kit` (iOS) / `@capacitor-community/health-connect` (Android) — when wiring native health data.
- `@capacitor-community/biometric-auth` — for Face ID / Touch ID unlock.
- `@capacitor-community/in-app-review` — prompt for App Store rating after a positive flow.

### Step 2 — Build the web bundle

```bash
npm run build
# This runs `tsx script/build.ts` and outputs the web app to dist/public/
ls dist/public/index.html  # confirm it exists
```

`capacitor.config.ts` is already pointed at `webDir: "dist/public"`.

### Step 3 — Add the iOS native shell

```bash
npx cap add ios
npx cap sync ios
npx cap open ios   # opens Xcode
```

In Xcode:
1. Select project root → Signing & Capabilities → choose your Apple Developer team.
2. Add the following capabilities:
   - HealthKit (will require entitlement)
   - Push Notifications (for clinical reminders)
   - Sign in with Apple
   - Background Modes → Audio (for ambient encounter recording)
3. Open `App/App/Info.plist` and paste the usage descriptions from `app-store-submission.md` Section 5.

### Step 4 — Add the Android native shell

```bash
npx cap add android
npx cap sync android
npx cap open android   # opens Android Studio
```

In Android Studio:
1. Open `android/app/src/main/AndroidManifest.xml`.
2. Paste the permissions block from `app-store-submission.md` Section 6.
3. Sync Gradle.

---

## Recurring build cycle (after every web change)

```bash
npm run build               # rebuild web bundle into dist/public
npx cap sync                # copy bundle into both ios/ and android/ projects
npx cap copy                # copy without npm install (faster, when only assets changed)

# To run on simulator / device:
npx cap run ios             # iOS simulator
npx cap run android         # Android emulator
npx cap open ios            # for archive / TestFlight upload
npx cap open android        # for AAB / Play Console upload
```

---

## Suggested package.json scripts

After installing, add these to `package.json` `"scripts"` for muscle memory (you'll need to do this manually in your editor since the Replit agent can't edit `package.json`):

```json
"cap:build": "npm run build && npx cap sync",
"cap:ios": "npm run build && npx cap sync ios && npx cap open ios",
"cap:android": "npm run build && npx cap sync android && npx cap open android",
"cap:run:ios": "npm run build && npx cap sync ios && npx cap run ios",
"cap:run:android": "npm run build && npx cap sync android && npx cap run android"
```

---

## Build for TestFlight (iOS)

1. `npm run cap:ios` (or the manual steps above).
2. In Xcode: Product → Archive.
3. When the archive completes: Window → Organizer → Distribute App → App Store Connect → Upload.
4. Wait ~10 minutes for processing in App Store Connect.
5. Add to a TestFlight Internal Testing group → invite your testers.

## Build for internal Play Console (Android)

1. `npm run cap:android` (or the manual steps above).
2. In Android Studio: Build → Generate Signed Bundle/APK → Android App Bundle.
3. Configure or select your upload key, build a release AAB.
4. Upload to Play Console → Internal testing → create release.

---

## Health record auto-import on launch

Once `@capacitor-community/health-kit` (iOS) and Health Connect (Android) are wired, on first launch the app should:
1. Prompt the user with the "We'd like to read your Apple Health data" sheet.
2. Map HealthKit / Health Connect categories to FHIR Observations and Conditions in the existing patient record.
3. Show a one-time "Imported X items from Apple Health" toast.

The web app already has the FHIR ingestion endpoints — the native side just needs to call them. Plan a separate code task once the native shell is live.

---

## Hard-blocking issues to resolve BEFORE first TestFlight submission

These will get the app rejected if not addressed in this order:

1. **Sign in with Apple** — Apple Guideline 4.8. We use Auth0 (third-party SSO), so Apple SSO must also be offered. Add Apple as an Auth0 social connection in the Auth0 dashboard, then surface a "Continue with Apple" button on the sign-in screen.
2. **Auth0 Business Associate Agreement** — Auth0 will not BAA-cover the free tier. Upgrade to Enterprise and execute the BAA before any real PHI flows through Auth0 in production.
3. **Privacy Policy + Terms URLs returning 200** — Apple reviewers click these. `https://tabulamedica.health/privacy` and `https://tabulamedica.health/terms` must return real pages, not 404.
4. **App Tracking Transparency** — we do NOT track, so do NOT include the `NSUserTrackingUsageDescription` key in Info.plist. Including it without using it is a rejection vector.
5. **Healthcare-specific disclaimers** — every clinical surface already shows `<ClinicalDisclaimer />`. Spot-check during reviewer-test instructions.
6. **Test account credentials** in App Store Connect "App Review Information" — must work and have realistic synthetic data populated.

---

## What the Replit agent can NOT do for you

- Run `npx cap add ios` (requires Mac).
- Build the .ipa or .aab.
- Sign with your Apple Developer cert.
- Upload to App Store Connect / Play Console.
- Edit `package.json` to add the `cap:*` scripts above (skill-restricted; copy-paste manually).

Everything else — capacitor.config.ts, Info.plist contents, AndroidManifest entries, plugin configuration, build cycle documentation — is in this repo.

---

## Verification

After your Mac build completes:
1. Open `/admin/smoke-test` in the running app (iOS simulator or device).
2. Walk all 12 sections.
3. Export the report as Markdown.
4. Attach it to your TestFlight submission notes.
