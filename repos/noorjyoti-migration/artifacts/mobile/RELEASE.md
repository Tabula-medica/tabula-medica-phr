# Mobile Release Pipeline (EAS + GitHub Actions)

This artifact ships to the App Store and Google Play through **EAS Build / EAS Submit**, triggered from **GitHub Actions**.

## One-time setup

### 1. Expo / EAS account
1. Create an Expo account at https://expo.dev (free).
2. Run `npx eas-cli@latest login` locally **or** in the Replit shell.
3. From `artifacts/mobile/`, run `npx eas-cli@latest init` — this creates the EAS project and writes the `projectId`.
4. Replace the two `REPLACE_WITH_EAS_PROJECT_ID` placeholders and the `REPLACE_WITH_YOUR_EXPO_USERNAME` placeholder in `app.json`.

### 2. Bundle identifiers
Defaults are `com.noorjyoti.mobile` (iOS bundle ID + Android package). If you own a different reverse-DNS domain, swap both values in `app.json` **before** the first store submission — they cannot be changed after a listing exists.

### 3. Apple App Store
You need an **Apple Developer Program** membership (USD 99 / yr).
1. In App Store Connect, create the app record with bundle ID `com.noorjyoti.mobile`.
2. Note the **App Store Connect App ID** (a numeric value) and your **Apple Team ID**.
3. Generate an **app-specific password** for your Apple ID at https://appleid.apple.com/account/manage.

### 4. Google Play
You need a **Google Play Developer** account (one-time USD 25).
1. Create the app in Play Console with package `com.noorjyoti.mobile`.
2. Upload **one** signed bundle manually for the very first release (Play requires this; EAS submit can take over after).
3. Create a service account in Google Cloud, grant it **Release Manager** in Play Console, and download the JSON key.

### 5. GitHub repository secrets
Push this monorepo to GitHub, then add these repository secrets (Settings → Secrets and variables → Actions):

| Secret | Where it comes from |
| --- | --- |
| `EXPO_TOKEN` | https://expo.dev/accounts/<you>/settings/access-tokens |
| `EXPO_APPLE_ID` | Your Apple ID email |
| `EXPO_ASC_APP_ID` | App Store Connect → App → App Information → Apple ID (numeric) |
| `EXPO_APPLE_TEAM_ID` | https://developer.apple.com/account → Membership |
| `EXPO_APPLE_APP_SPECIFIC_PASSWORD` | https://appleid.apple.com/account/manage |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Paste the **entire** JSON file contents from Google Cloud |

### 6. Native credentials (managed by EAS)
The first build will prompt EAS to generate iOS signing certs and an Android keystore on its servers. Run once locally to seed them:

```bash
cd artifacts/mobile
npx eas-cli credentials   # walk through iOS, then Android
```

After that, GitHub Actions builds reuse those credentials automatically.

## Day-to-day

- **Push to `main`** with changes under `artifacts/mobile/**` → automatic `production` build for **both** platforms (no submit).
- **Manual submit to stores**: go to GitHub → Actions → "EAS Build & Submit (Mobile)" → **Run workflow** → set `submit: true`.
- **Quick test build** for TestFlight / internal Play track: Run workflow with `profile: preview`.

## Local commands

```bash
# Build locally via EAS cloud
cd artifacts/mobile
npx eas-cli build --profile production --platform all

# Submit the latest build
npx eas-cli submit --profile production --platform ios --latest
npx eas-cli submit --profile production --platform android --latest
```

## iOS SDK & Xcode requirements

- Apple requires App Store / TestFlight uploads to be built with a recent iOS
  SDK and Xcode (since 2025, builds must use the **iOS 18 SDK (Xcode 16+)**).
- `eas.json` pins `ios.image: "latest"` on the `development`, `preview`, and
  `production` profiles so EAS always builds on its newest stable macOS image
  (latest Xcode / iOS SDK). No action is needed when Apple bumps the minimum —
  EAS rolls the `latest` image forward automatically.
- To freeze a specific toolchain instead (e.g. for reproducible builds), replace
  `"latest"` with a concrete image such as `"macos-sequoia-15.4-xcode-16.3"`.
  See the EAS Build image list for currently available images.
- This project runs Expo SDK 54 / React Native 0.81 with the New Architecture
  (`newArchEnabled: true`); these require iOS 15.1+ at runtime, which is well
  below Apple's current minimum-deployment-target floor, so no override is
  needed.

## Notes

- `appVersionSource: "remote"` means EAS owns the build number / versionCode — you bump only `version` in `app.json` for marketing version changes.
- Background audio entitlement (`UIBackgroundModes: ["audio"]`) and Android foreground-service permissions are already configured for the player.
- `ITSAppUsesNonExemptEncryption: false` skips the App Store export-compliance prompt; flip to `true` (and add the relevant key) if you ever ship custom crypto.
