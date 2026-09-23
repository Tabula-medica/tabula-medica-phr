# World Clinic: Campus Life — teen/college/newlywed tier

Status: MVP shipped. Companion to `roblox-healthcare-games-concept.md` and
`roblox-hedis-future-health.md`.

## Why a second experience, not a bigger age range on the first one

The kids' World Clinic targets pediatric preventive-care literacy (well-child
visits, immunizations, handwashing). Teens, college-age young adults, and
newlyweds have a genuinely different set of preventive-care concerns —
mental health, sexual/reproductive health, substance-use screening, sports
physicals, insurance literacy as they age off a parent's plan — and Roblox's
content-maturity system only works correctly when that content lives in its
own place. See `roblox-campus/README.md` for the full mechanical rationale;
the short version: one Group, two places, each independently rated.

## The game

Same architecture as Future Health (`server/roblox-clinic-routes.ts`): a
player runs a pretend clinic, NPC patients present a care-gap, closing it
in time builds a rules-based star scorecard, and Nova (the same AI guide,
an older register — "smart, direct, non-preachy friend" instead of
"hype-coach") offers a short tip between visits.

**Measure catalog** (`server/roblox-campus-routes.ts` → `CAMPUS_MEASURES`):

| In-game name | Teaches | Real concept it's modeled on |
|---|---|---|
| Mind Check | Regular mental-health check-ins catch burnout early | Depression/anxiety screening (USPSTF) |
| Shot Catch-Up | HPV/meningitis catch-up vaccines still matter | HPV / meningococcal catch-up (ACIP) |
| Confidential Check-In | Sexual health visits are routine and confidential | Sexual health / STI screening access (USPSTF, ACOG) |
| Honest Answers | Substance-use screening questions are judgment-free | Alcohol/tobacco screening (USPSTF, SBIRT) |
| Cleared to Play | Sports physicals + concussion awareness keep you safer | Pre-participation physical / concussion protocol |
| Recharge Check | Chronic sleep debt has real costs | Sleep health counseling |
| Planning Ahead | Family-planning conversations are normal, whenever relevant | Contraception/family-planning counseling (ACOG) |
| Coverage Check | Understanding your own insurance before you need it | Health insurance / preventive-benefit literacy |

Every entry is handled as *dialogue about the visit*, never a depiction of
the underlying behavior (no simulated drinking, no explicit content) — see
the content boundary in `roblox-campus/README.md`.

**Scoring.** Identical mechanism to Future Health: rate = closed ÷
(closed + missed) per measure, rules-based 1–5 stars, Nova's tip generated
through the BAA-covered AI path from aggregate counts only (never PHI, never
free text from the player), with a curated fallback bank. 10+ visits at 4+
stars auto-awards `roblox-campus-champion` (added to the shared
`ROBLOX_BADGES` catalog in `roblox-education-link-routes.ts`, same pipeline
as `roblox-checkup-champion`).

**Shared infra, separate place.** Account linking uses the same
`/api/roblox/link/*` endpoints as the kids' game — one link code from the
Tabula Medica app works for either Roblox place, since it's the same
family-linking system underneath. Only the content (`/api/roblox/campus/*`)
and the Roblox place itself are separate.

## What shipped

- `server/roblox-campus-routes.ts` — measures/event/scorecard endpoints,
  mounted at `/api/roblox/campus/*`, reusing `awardRobloxBadge`,
  `getLinkedPatientId`, `requireRobloxApiKey`, `getPatientId` from
  `roblox-education-link-routes.ts` (no duplicated linking/reward logic).
- `roblox-education-link-routes.ts` — added `roblox-campus-champion` to the
  shared badge catalog.
- `roblox-campus/` — a full second Rojo project (own `BadgeSync.lua`,
  `MiniGameAPI.lua`, `GameManager.server.lua`, `RemoteEvents.lua`,
  `ClientUI.client.lua`) plus the flagship `CampusLife.server.lua` mini-game.
  Three more mini-games are scoped as a content backlog in
  `roblox-campus/README.md` (Stress Less, Know Your Resources, Coverage
  Quiz), each a direct port of an existing kids'-game mechanic.

## Explicitly not built here

- No client (TabulaMedica app) surface for this tier yet — the kids'
  Roblox tab on `/achievements` is pediatric-framed. A teen/young-adult
  equivalent (or a shared, tier-aware Roblox tab) is follow-up work, same
  as the older-adult work in `life-stage-challenges-concept.md`.
- No Roblox Group / publishing has happened — both `API_BASE_URL`/`API_KEY`
  placeholders and the Creator Hub trademark/name checks from the kids'
  game's PR checklist apply here too.
- No clinician or child-safety review of the measure/Nova copy yet — same
  requirement as Future Health, arguably more important here given the
  sensitivity of the topics.
