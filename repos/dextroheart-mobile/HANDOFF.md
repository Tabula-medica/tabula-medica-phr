# DextroHeart Mobile — Handoff

## What this is
Expo WebView wrapper for https://dextroheart.com
Target: iOS (iPad-first) + Android tablet/phone

## Gates before first build

### 1. EAS project ID
```
cd C:\Users\Aggarwal\repos\dextroheart-mobile
npm install
npx eas init --id NEW   # creates a new EAS project; paste the projectId into app.json extra.eas.projectId
```

### 2. App Store Connect — create the app
Go to https://appstoreconnect.apple.com → My Apps → +
- Name: DextroHeart
- Bundle ID: com.dextroheart.app  (register this in Developer portal first)
- SKU: dextroheart-app
- Primary language: English (US)
- Category: Medical

Copy the numeric ASC App ID (e.g. 6XXXXXXXXX) → paste into eas.json submit.production.ios.ascAppId

### 3. Google Play — create the app
Go to https://play.google.com/console → Create app
- App name: DextroHeart
- Default language: English
- App or game: App
- Free or paid: Free (research program)
- Package name: com.dextroheart.app

### 4. Icons (required before build)
Place these files in assets/:
- icon.png            1024×1024 PNG (app icon, no rounded corners — EAS adds them)
- splash-icon.png     1024×1024 PNG (shows on the splash screen, navy #1a2332 background)
- favicon.png          48×48  PNG
- android-icon-foreground.png   1024×1024 PNG (DH mark, transparent bg)
- android-icon-background.png   1024×1024 PNG (solid #1a2332)

Use the DextroHeart heart/ECG mark. Navy background #1a2332, red accent #c0392b.

### 5. Build + submit
```
cd C:\Users\Aggarwal\repos\dextroheart-mobile
npm install
npx eas build --platform all --profile production --auto-submit
```

## Permissions declared
- Bluetooth (BLE ECG/SCG patch)
- Camera (ultrasound transducer)
- Microphone (PCG capture)
- HealthKit read/write (optional trending)

## App Store metadata draft

**Name:** DextroHeart
**Subtitle:** ECG · Ultrasound · Heart Sounds
**Category:** Medical
**Age rating:** 4+ (no user-generated content; medical professional use)

**Description (short):**
DextroHeart turns an iPad or Android tablet into a portable 14-lead ECG, sternal seismocardiogram, and cardiac ultrasound workstation — all in one wireless session.

**Description (full):**
DextroHeart is the companion app for the DextroHeart cardiac platform — a wireless sensor patch + USB-C transducer that captures 14-lead ECG (five profiles: Standard 12, Right 14, Posterior 15, Legacy 14, Combined 17), sternal seismocardiogram (SCG) and phonocardiogram (PCG), and real-time cardiac ultrasound, all in a single acquisition session.

WHAT IT DOES
• Stream and visualize 14-lead ECG in real time via Bluetooth LE
• Capture sternal SCG/PCG — PEP, LVET, heart sounds S1–S4 auto-detected
• Acquire apical-4C/2C cine loops for EF, M-mode, and Doppler analysis
• Export FHIR R4 bundles for seamless EHR integration
• Review AI-assisted interpretations powered by Vertex AI

FOR RESEARCH AND INVESTIGATIONAL USE
DextroHeart is an investigational device. This app is intended for use by qualified research investigators and healthcare professionals in approved research protocols only.

**Keywords:** ECG, electrocardiogram, 14-lead, ultrasound, echocardiogram, cardiac, cardiology, heart sounds, seismocardiogram, FHIR, research

**Privacy URL:** https://dextroheart.com/privacy
**Support URL:** https://dextroheart.com
**Marketing URL:** https://dextroheart.com
