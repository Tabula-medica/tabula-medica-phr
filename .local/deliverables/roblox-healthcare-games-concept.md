# Roblox Healthcare Games — "Tabula Medica Kids"

Status: MVP scaffolding shipped (this session). Product concept, compliance
boundary, backend integration, and a starter Roblox experience.

## Why

Tabula Medica already has a full in-app gamification system (points, badges,
streaks, levels — see `server/gamification-engine.ts`,
`server/gamification-routes.ts`, `client/src/pages/gamification-dashboard.tsx`)
and a pediatric surface (`server/pediatric-routes.ts`: growth charts, vaccine
records, school forms). What's missing is a fun, low-friction way for **kids**
in a Tabula Medica family to build health literacy — handwashing, what
medicine reminders are for, what a checkup involves — outside a clinical UI.
Roblox is where that audience already spends time, and it supports free
experiences with server-side scripting (Roblox Lua) and outbound HTTP calls
(`HttpService`), so a game there can safely report progress back to the app.

## Compliance boundary (the load-bearing decision)

Roblox is a public platform aimed at kids and governed by COPPA, with no BAA
relationship with Tabula Medica and no HIPAA safeguards of its own. So the
integration is designed as a **one-way, PHI-free reward relay**, not a data
integration:

| Crosses the boundary | Never crosses the boundary |
|---|---|
| A short-lived, 8-char link code (generated inside the authenticated TM app) | Patient name, DOB, MRN |
| The Roblox `UserId` | Diagnoses, medications, real dosing info |
| A catalog badge id (e.g. `roblox-handwash-hero`) | Growth/vaccine/visit records |
| A point count | Anything from `pediatric-routes.ts` or any FHIR resource |

Consequences of that decision:
- Linking is **opt-in and family-initiated**: the code is generated from
  inside the signed-in TM app (`POST /api/roblox/link/code`), not requested
  by Roblox. Roblox never sees who the family is.
- The Roblox **game server**, not individual players, authenticates to the
  TM backend with a shared secret (`X-Roblox-Api-Key` / `ROBLOX_SERVER_API_KEY`)
  — players never hold a credential that reaches Tabula Medica.
  the badge catalog (`GET /api/roblox/catalog`) only contains generic,
  fictional content ("Bottle A" / "Chart 3", not real drug names).
- Mini-game content teaches general health habits, not personalized care.

## What shipped this session

### Backend — `server/roblox-education-link-routes.ts`
Registered at `/api/roblox/*` in `server/routes.ts` (alongside
`registerGamificationRoutes`). In-memory store for now, matching the existing
pattern in `gamification-routes.ts` pending a shared persistence layer.

Authenticated (TM app session):
- `POST /link/code` — generate a 10-minute link code for the signed-in profile
- `GET /link/status` — is this profile linked to a Roblox account
- `POST /link/unlink` — remove the link
- `GET /rewards/me` — Roblox-earned badges + point total for this profile

Server-key protected (Roblox game server only, via `X-Roblox-Api-Key`):
- `GET /catalog` — kid-safe badge catalog
- `POST /link/redeem` — exchange a link code for `{robloxUserId -> patientId}`
- `POST /rewards/sync` — award a badge (idempotent — reports `already_awarded`
  on repeat); awards points through the existing `calculatePoints()` in
  `gamification-engine.ts` so point values stay consistent with the rest of
  the app's economy

### Frontend — `client/src/pages/gamification-dashboard.tsx`
New **Roblox** tab on the existing Achievements page (`/achievements`):
generate/display the link code, unlink, and show synced badges/points. No new
route or public-page exception needed — reuses the existing protected page.

### Roblox experience — `roblox/`
A Rojo-managed source tree with:
- `BadgeSync.lua` — the only script that calls the TM backend
- `MiniGameAPI.lua` — helper for server-authoritative mini-games to report a
  win directly (no round trip through a client-fired event)
- `GameManager.server.lua` — boots the link-code flow, relays client-driven
  completions
- Three working mini-games:
  - **Handwashing Hero** — hold a `ProximityPrompt` for 20 seconds (teaches
    CDC's "scrub for 20 seconds" guidance)
  - **Body Systems Quest** — touch three checkpoints (heart/lungs/digestive)
  - **Medication Match** — server-validated matching puzzle using fictional
    bottle/chart labels (teaches "double-check before taking medicine", no
    real drug content)
- `ClientUI.client.lua` — minimal link-account panel + reward toast (not
  final art — proves the wiring)

See `roblox/README.md` for local Rojo setup, HTTP allowlist configuration,
and the end-to-end test flow.

## Rollout plan

**Phase 1 (this session) — scaffolding.** Backend routes, dashboard tab,
Rojo project, 3 working mini-games. Not yet deployed to a public Roblox
place; `BadgeSync.lua`'s `API_BASE_URL`/`API_KEY` are placeholders.

**Phase 2 — content.** Germ Buster and Checkup Champion mini-games (already
reserved as catalog badge ids: `roblox-germ-buster`, `roblox-checkup-champion`
in `roblox-education-link-routes.ts`), real art/UI pass on `ClientUI`,
DataStore persistence for in-Roblox progress (currently session-only).

**Phase 3 — publish.** Set `ROBLOX_SERVER_API_KEY` in production secrets,
configure the published place's HTTP allowlist, publish to Roblox Creator
Hub, add a "Play on Roblox" entry point from the family/pediatric section of
the TM app.

**Explicitly out of scope / not recommended:** sending any FHIR resource,
growth/vaccine record, or clinician-authored content into Roblox; letting
Roblox initiate the link (must stay family-initiated from the authenticated
app); monetization aimed at the child audience (Robux purchases tied to
health content) — avoid pay-to-win or purchase prompts inside a health
education experience for kids.

## Files touched/added this session

- `server/roblox-education-link-routes.ts` (new)
- `server/routes.ts` (registered the new router)
- `client/src/pages/gamification-dashboard.tsx` (Roblox tab)
- `roblox/` (new Rojo project: `default.project.json`, `README.md`, 7 Lua
  scripts under `src/`)
- `.local/deliverables/roblox-healthcare-games-concept.md` (this doc)
