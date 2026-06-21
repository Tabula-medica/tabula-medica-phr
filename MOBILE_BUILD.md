# Tabula Medica — Mobile Build Guide (iOS + Android)

This guide takes the existing web codebase and ships it as native iOS and
Android apps via Capacitor 6 + EAS Build. It must be run from a **Mac**
(iOS builds require Xcode + CocoaPods which are macOS-only).

---

## Prerequisites (one-time)

1. **Apple Developer account** — `$99/yr`, https://developer.apple.com
2. **Google Play Console account** — `$25` one-time, https://play.google.com/console
3. **Expo account** — free, https://expo.dev/signup
4. **Local tools** on your Mac:
   ```bash
   # Node 20.x (already in package.json)
   # Xcode 15+ from App Store + Command Line Tools: xcode-select --install
   # CocoaPods:               sudo gem install cocoapods
   # Android Studio + SDK:    https://developer.android.com/studio
   # JDK 17:                  brew install --cask zulu@17
   # Expo CLI:                npm install -g eas-cli
   ```

---

## One-time bootstrap on your Mac

```bash
git clone https://github.com/Tabula-medica/Tabula-Medica-web-version.git
cd Tabula-Medica-web-version
npm ci

# Build the web bundle (Capacitor wraps the contents of dist/public/)
npm run build

# Generate the native iOS + Android projects (these get committed to git)
npx cap add ios
npx cap add android

# Push the web bundle into the native projects
npx cap sync

# Open native IDEs to set bundle id, signing, icons, splash, permissions
npx cap open ios       # Xcode opens — set Team, capabilities, App Store Connect
npx cap open android   # Android Studio opens — set keystore, signing config
```

After `cap add` succeeds, commit the generated `ios/` and `android/` folders.

---

## EAS setup (run once)

```bash
eas login                    # log in to your Expo account
eas build:configure          # picks up the eas.json already in the repo
eas device:create            # register your iPhone(s) for development builds
```

---

## Build commands

| Goal | Command |
|---|---|
| iOS dev build (simulator) | `npm run build && npx cap sync && eas build --platform ios --profile development` |
| iOS preview (TestFlight) | `npm run build && npx cap sync && eas build --platform ios --profile preview` |
| iOS production | `npm run build && npx cap sync && eas build --platform ios --profile production` |
| Android dev (APK) | `npm run build && npx cap sync && eas build --platform android --profile development` |
| Android production (AAB) | `npm run build && npx cap sync && eas build --platform android --profile production` |
| Submit iOS to App Store | `eas submit --platform ios --latest` |
| Submit Android to Play | `eas submit --platform android --latest` |

---

## Required EAS secrets (set once on EAS dashboard)

```bash
eas secret:create --scope project --name VITE_REVENUECAT_IOS_KEY --value "appl_..."
eas secret:create --scope project --name VITE_REVENUECAT_ANDROID_KEY --value "goog_..."
eas secret:create --scope project --name VITE_REVENUECAT_WEB_KEY --value "rcb_..."
eas secret:create --scope project --name VITE_AUTH0_DOMAIN --value "your-tenant.auth0.com"
eas secret:create --scope project --name VITE_AUTH0_CLIENT_ID --value "..."
```

(EAS will inject these into the build environment; the Vite build picks them up.)

---

## Update `eas.json` placeholders

Edit `eas.json` and replace the three `REPLACE_WITH_…` placeholders under
`submit.production.ios` with your actual Apple ID, App Store Connect App ID
(numeric), and Apple Team ID.

For Android submission, place your Play Console service account JSON at
`android/play-service-account.json` (gitignored — never commit it).

---

## What is already done in the repo

- ✅ `capacitor.config.ts` — appId `health.tabulamedica.app`, splash, status bar, push, keyboard, scheme
- ✅ All Capacitor 6 plugins installed (camera, push, browser, share, biometric, etc.)
- ✅ `@revenuecat/purchases-capacitor` SDK installed
- ✅ `client/src/lib/revenuecat-native.ts` branches on `Capacitor.getPlatform()` for web vs ios vs android
- ✅ `eas.json` with development / preview / production profiles
- ✅ `.gitignore` excludes EAS / Pods / Gradle / keystores / service accounts

## What still needs to be done (on your Mac)

- [ ] Run `npx cap add ios` and `npx cap add android` (generates native projects)
- [ ] Set Apple Team / signing in Xcode
- [ ] Generate Android keystore: `keytool -genkey -v -keystore tabula.keystore -alias tabula -keyalg RSA -keysize 2048 -validity 10000`
- [ ] Create EAS project: `eas init`
- [ ] Set EAS secrets (commands above)
- [ ] First build: `eas build --platform all --profile preview`
- [ ] Test on TestFlight (iOS) + Internal Track (Android)
- [ ] Submit: `eas submit --platform all --latest`

---

## Why I cannot run EAS from this Replit environment

EAS Build is an interactive, account-bound, credential-bound service:

1. `eas login` opens an OAuth browser flow tied to **your** Expo account
2. `eas build` requires Apple Developer + Google Play credentials to sign
3. iOS builds need macOS + Xcode; Linux containers (like Replit) cannot
   produce iOS binaries even with Capacitor
4. EAS bills builds against your Expo account quota

So the iOS/Android build pipeline must run on your Mac with you logged in.
The web app, however, **can and does** deploy from Replit directly via
Replit Deployments (Cloud Run).
