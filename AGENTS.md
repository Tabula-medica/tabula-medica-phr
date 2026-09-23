# AGENTS.md

## Cursor Cloud specific instructions

Tabula Medica is a mobile-first personal-health-record PWA. The web product is a single
Node/Express process (`server/`) that also serves the React/Vite client (`client/`). Shared
schema/types live in `shared/`. A separate Expo app lives in `tabula-medica-mobile/` (not
required for the web product).

Standard scripts are defined in `package.json` (`dev`, `build`, `start`, `check`, `db:push`,
`test`, `lint`). Notes below are the non-obvious things.

### Running the app (dev)
- Start with `npm run dev` (runs `tsx server/index.ts`; serves the API **and** the Vite client
  from one port). Default port is `8080`; set `PORT=5000` to match the Replit/legacy config.
- **`GET /` always returns the plain text `HEALTHY`** — it is a health-check endpoint, not the
  SPA. The app renders on real routes (e.g. `/auth/login`, `/symptom-checker`). Don't judge the
  app by the root URL.
- **The server crashes on boot unless an OpenAI key env var is set to a non-empty value.**
  `server/advanced-visualization-routes.ts` constructs an OpenAI client at import time reading
  `AI_INTEGRATIONS_OPENAI_API_KEY` (and `server/index.ts` copies `OPENAI_API_KEY` into it). With
  no real key, export a placeholder just to boot, e.g.
  `AI_INTEGRATIONS_OPENAI_API_KEY=sk-placeholder-dev-only`. AI-backed features then fail at call
  time (401) but the app runs; deterministic/fallback code paths still work.

### Database (optional for boot, recommended for full features)
- The bulk operational/PHI data uses an in-memory store (`server/storage.ts`), so the app boots
  **without** a database. Without `DATABASE_URL` you'll see `[DB] WARNING` + periodic
  `ECONNREFUSED` from DB-backed schedulers, `/api/health` reports `degraded`, and the session
  store falls back to memory.
- For full features (Postgres session store, `accounts`/`facilities`/`profiles` tables, healthy
  status), run a local Postgres and set `DATABASE_URL`, then `npm run db:push` (drizzle-kit) to
  create the schema. Example used during setup:
  `DATABASE_URL=postgresql://tabula:tabula@localhost:5432/tabula`. Postgres is a system
  dependency (install/start it yourself; it is not part of the npm update script).

### Auth (Firebase / GCIP)
- Web login is Google Cloud Identity Platform / Firebase, using **Google/Apple popup sign-in**
  (no email/password form in the UI). It requires these **client build-time** env vars, read by
  `client/src/lib/gcip.ts` via `import.meta.env` (must be present in the process env when
  `npm run dev`/`npm run build` starts):
  - `VITE_GCIP_API_KEY` — the Firebase Web API key (a secret; provide via Secrets).
  - `VITE_GCIP_AUTH_DOMAIN` — e.g. `united-planet-485003-n7-9f345.firebaseapp.com`.
  - `VITE_GCIP_PROJECT_ID` — e.g. `united-planet-485003-n7-9f345`.
  When any are missing, `isGcipConfigured()` is false, the sign-in buttons are disabled, and the
  page shows "Sign-in is temporarily unavailable".
- Server-side token verification (`server/auth/gcip.ts`) validates GCIP ID tokens against
  Google's public JWKS using `GCIP_PROJECT_ID` (falls back to `FIREBASE_PROJECT_ID`, then the
  hardcoded default `united-planet-485003-n7-9f345`). It must match the client project. No
  service-account key is needed just to verify tokens.
- The chosen providers (Google, Apple, and any TOTP MFA) must be enabled in the Firebase console
  for that project; `localhost` is an authorized domain by default. Completing a real sign-in
  needs an actual Google/Apple account (interactive popup).
- Public tools (e.g. the Symptom Checker at `/symptom-checker`) work anonymously and are the
  easiest way to exercise core functionality without auth.
- In dev, an ephemeral local admin is seeded into the in-memory store on startup (see
  `server/seed-admin.ts`); set `ADMIN_PASSWORD` for a stable password.

### Lint / test / build
- `npm run test` (vitest) passes. `npm run lint` currently reports many pre-existing errors
  (mostly `@typescript-eslint/no-explicit-any`) unrelated to environment setup. `npm run build`
  bundles the server to `dist/index.cjs` and the client to `dist/public`.

### Sidebar icon imports (fixed)
- `client/src/components/app-sidebar.tsx` is imported on every route, so a single undefined
  reference there crashes the whole SPA (blank page). It previously used the `TestTubes`,
  `ArrowLeftRight`, and `Crown` lucide icons without importing them; those imports were added.
  If you add a new sidebar entry, remember to import its `lucide-react` icon or the app will
  render blank on all routes.
