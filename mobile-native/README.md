# Tabula Medica — Native App (`mobile-native/`)

Full native React Native (Expo, expo-router) rebuild of the Tabula Medica PHR
— the long-term "Path 3" track. Runs in parallel with the quick WebView shell;
the two are independent and do not share a `package.json`.

> Status: **buildable scaffold.** Core auth + 5 screen groups are real and wired
> to the live backend. Native-module integrations (HealthKit, CAC NFC, push)
> are configured but not yet feature-complete. See [`BUILD-PLAN.md`](./BUILD-PLAN.md).

## Stack

- **Expo SDK 52** / React Native 0.76 / React 18 / Hermes
- **expo-router** (file-based navigation, typed routes)
- **@tanstack/react-query** for server state
- **Firebase/GCIP** auth (the backend's only mobile IdP — no Auth0, HIPAA)
- **expo-secure-store** + **expo-local-authentication** for the biometric gate
- Live backend: `https://tabulamedica.us` (== `…world`, same Cloud Run service)

## Layout

```
app/                      # expo-router routes
  _layout.tsx             # providers + biometric lock overlay
  index.tsx               # auth-state redirect
  (auth)/login.tsx        # email/Google/Apple sign-in + register + reset
  (app)/_layout.tsx       # bottom tabs
  (app)/index.tsx         # Home / dashboard + recent timeline
  (app)/records/          # list + [id] detail (filterable)
  (app)/emergency.tsx     # break-glass QR share
  (app)/settings/         # settings + privacy (GDPR/CCPA + deletion)
src/
  api/                    # typed client, gcip, auth, records, gdpr, share
  auth/AuthContext.tsx    # session + biometric gate state
  components/             # ui kit + LockScreen
  hooks/                  # react-query hooks + social-auth hooks
  lib/, theme/            # helpers + design tokens
```

## Run (dev)

```bash
cd mobile-native
cp .env.example .env        # fill EXPO_PUBLIC_GCIP_* (see server/auth/gcip.ts)
npm install
npx expo start --dev-client # CAC reader + Firebase need a dev build, not Expo Go
```

The custom `expo-cac-reader` native module is referenced from `../modules`
(see `metro.config.js` + the config plugin in `app.json`), so a **development
build** (`eas build --profile development` or `expo run:ios`) is required — it
will not work in Expo Go.

## Do NOT touch

The root web app (`package.json`, `client/`, `server/`), the legacy
`tabula-medica-mobile/` React-Navigation app, and any `mobile/` WebView shell
are out of scope for this directory.
