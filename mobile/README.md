# Tabula Medica — Mobile (Path 1: Expo WebView shell)

A thin, **submittable** Expo app that wraps the live PHR web app
(`https://tabulamedica.world`) and adds genuine native value so it clears
App Store guideline **4.2 (minimum functionality)**:

- **Biometric app-lock** (Face ID / fingerprint) on launch and on every
  return-from-background — a PHR holds PHI, so the records stay locked behind
  the device's secure enclave. (`expo-local-authentication`)
- Native splash, status bar, Android hardware-back history, pull-to-refresh.
- External links / OAuth open in the system browser (never trapped in-WebView).
- Camera/photo/mic/contacts/location permission strings pre-declared for the
  upload + emergency-contact flows the web app already implements.

> This is the **fast** track. The **full native rebuild** lives in
> `../mobile-native/` (separate Expo/React-Native app, real screens) and is the
> long-term replacement. This shell exists to get into both stores first.

Reuses the **existing EAS project** `34fa03f5-06e7-4164-9d44-26a3fd50377e`
(owner `rajivka2`) — only the source/deps/assets were lost in the Replit export,
not the project itself.

---

## What's DONE (in this repo)
- ✅ `App.tsx` — biometric-gated WebView shell (production-quality)
- ✅ `package.json`, `index.js`, `babel.config.js`, `tsconfig.json`
- ✅ `app.json` — bundle id `com.tabulamedica.app`, iOS infoPlist strings,
  Android permissions + adaptive icon, deep links, real EAS projectId
- ✅ `eas.json` — build profiles + submit config; **Apple Team ID `U56SKX5MXX`
  pre-filled**

## What's BLOCKED on you (external gates — cannot be done from code)
1. **App icons + splash** (`assets/images/icon.png` 1024×1024,
   `splash-icon.png`, `android-icon-foreground.png`). Drop the brand logo in
   `mobile/assets/images/`. Without these `eas build` fails. *(No brand PNG was
   in the export — this is the one true blocker before a first build.)*
2. **Apple**: Apple ID email → put in `eas.json` `submit.production.ios.appleId`.
   Create the app record in **App Store Connect** (bundle `com.tabulamedica.app`)
   → copy its **ascAppId** into `eas.json`. Team `U56SKX5MXX` already set.
3. **Google Play**: create the app in Play Console (package
   `com.tabulamedica.app`), create a **service-account JSON** with the Play
   Developer API, save it as `mobile/play-service-account.json` (git-ignored).
4. **Expo account**: `npx eas login` as `rajivka2` (interactive).
5. **Health-app review prep**: App Privacy "nutrition label" (data collected:
   health, contacts, identifiers), HIPAA attestation, a public **Privacy Policy
   URL** (the web app should expose one), and a demo account for Apple review.

## Build + submit (once gates above are cleared)
```bash
cd mobile
npm install
npx eas login                       # as rajivka2

# First-time credential setup (EAS manages signing certs in the cloud):
npx eas build --profile production --platform android   # -> .aab
npx eas build --profile production --platform ios       # -> .ipa  (cloud macOS — NO local Mac needed)

# Submit:
npx eas submit --profile production --platform android  # -> Play internal track (draft)
npx eas submit --profile production --platform ios      # -> App Store Connect
```

EAS Build runs the iOS compile on Apple's cloud machines, so **you do not need a
Mac**. Android `.aab` also builds in the cloud.

## Notes / decisions
- **Which edition does the binary point at?** Default `expo.extra.appUrl` =
  `https://tabulamedica.world` (global, GDPR-standard, works in every region).
  For a US-only TEFCA listing, change it to `https://tabulamedica.us`. One
  product decision; flip the one value in `app.json`.
- `expo-cac-reader` (DoD CAC NFC) from the original app is **not** wired into
  this shell — it belongs in the full native app (`../mobile-native/`).
- Root `../app.json` / `../eas.json` are the original (source-less) config; this
  `mobile/` project supersedes them for the shell. Don't run EAS from the repo
  root.
