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

### Auth
- Web login is Google Cloud Identity Platform / Firebase (Google/Apple popup) and requires
  `VITE_GCIP_*` + Firebase config; the login buttons are disabled without it, so authenticated
  UI flows can't be exercised without those secrets. Public tools (e.g. the Symptom Checker at
  `/symptom-checker`) work anonymously and are the easiest way to exercise core functionality.
- In dev, an ephemeral local admin is seeded into the in-memory store on startup (see
  `server/seed-admin.ts`); set `ADMIN_PASSWORD` for a stable password.

### Lint / test / build
- `npm run test` (vitest) passes. `npm run lint` currently reports many pre-existing errors
  (mostly `@typescript-eslint/no-explicit-any`) unrelated to environment setup. `npm run build`
  bundles the server to `dist/index.cjs` and the client to `dist/public`.

### Known issue at time of setup
- The SPA renders a blank page on every route: `client/src/components/app-sidebar.tsx` uses the
  `TestTubes` icon (line ~237) but never imports it from `lucide-react`, throwing
  `ReferenceError: TestTubes is not defined` and crashing React on mount. Until that import is
  added, verify core functionality via the backend API instead of the browser UI.
