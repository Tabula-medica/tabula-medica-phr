# mobile-expo (Replit export import, 2026-10-26)

Snapshot of the Replit "tabula-medica" Expo / React Native app, imported as a self-contained project.
It has its own `package.json`, `server/` (flat service-layer Express API), `shared/` (Drizzle schema),
`web/` (Vite web client) and `client/` (Expo screens). It is **not** part of the root build:
root `tsconfig.json`, `vitest` and the Docker image do not include it.

Imported from `tabula-medica (1).zip` (files last modified 2026-10-25).

Left out: `node_modules`, `.replit`/`.upm` Replit state, `screenshots/`, `assets/appstore/` (about 27 MB of store screenshots),
the tutorial `.mp4`, and any key/cert files (none were present).

Secrets scrubbed (gitleaks 8.30.1 scan of the zip):
- `app.config.js` `gcipApiKey` and `eas.json` `EXPO_PUBLIC_GCIP_API_KEY` (Google API keys) were blanked. Supply via EAS secret / `EXPO_PUBLIC_GCIP_API_KEY`.
- `eas.json` `ascApiKeyId` / `ascApiKeyIssuerId` were replaced with `SET_IN_EAS_SECRET`.
  Treat the original GCIP keys as exposed: restrict them (HTTP referrer / bundle ID) in Google Cloud Console.

Not merged into the root server: the root server (`server/`) and this snapshot's server are different architectures.
Wiring individual services across needs a per-feature review.
