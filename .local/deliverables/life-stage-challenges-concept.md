# Life Stage Health Challenges — 50s / 60s / 70+ (main app, not Roblox)

Status: MVP shipped. Sibling initiative to the World Clinic Roblox series —
same "turn preventive care into something completable" idea, but for
demographics that aren't on Roblox at all.

## Why this isn't a Roblox experience

Roblox's real usage skews heavily toward under-25; middle-aged and older
adults are not a market it reaches, regardless of how the content is framed.
Trying to serve 50+ users through a Roblox game would produce a game nobody
in that age range plays. Instead, this extends the **existing** in-app
gamification system (`server/gamification-engine.ts`,
`client/src/pages/gamification-dashboard.tsx`) that's already used by every
TabulaMedica user, so 50+ users get the same points/badges mechanic they
may already be earning from goals and medication adherence — just with
age-appropriate content layered on top.

## What it is

A decade-banded checklist of general preventive-care nudges — not a
diagnostic tool, not personalized medical advice, and explicitly not a
replacement for `preventive-care-service.ts`'s clinical recommendation
engine (which this deliberately does not touch or duplicate). Each item is
a "talk to your doctor about X" or "do this simple self-check" nudge that
awards points through the existing `calculatePoints()` engine and, on
completing every item in a tier, a tier badge.

Because this runs entirely inside the authenticated PHR (not across the
Roblox PHI boundary), it can read the signed-in profile's real date of
birth — the same `dateOfBirth` field `GET /api/profiles/active` already
returns — to pick the tier automatically. No new PHI exposure pattern: this
reuses the existing `Profile` shape other routes already return to the
client.

**Tiers and sample content** (`server/life-stage-challenges-routes.ts` →
`CHALLENGE_CATALOG`, 8 challenges each):

| Tier | Focus areas | Tier badge |
|---|---|---|
| 50–59 | Cardiometabolic screening, colon-cancer screening start, hormone health, bone density, midlife stress, sleep, hearing/vision | Heart-Smart Fifties |
| 60–69 | Screening continuation, shingles/seasonal vaccines, fall-risk, retirement-transition mental health, hearing loss, Medicare literacy, joint health | Screening Streak Sixties |
| 70+ | Fall prevention, cognitive health, medication reconciliation, social connection, advance directives, caregiver support, hydration/nutrition, driving safety | Safety-First Seventies+ |

## What shipped

- `server/life-stage-challenges-routes.ts` — `GET /api/life-stage/challenges`
  (auto-detects tier from profile DOB, or accepts `?ageBand=` override for
  viewing another profile in a family context), `POST
  /api/life-stage/challenges/:id/complete` (self-report, idempotent, awards
  points via the existing engine, tracks tier-badge eligibility).
- `client/src/pages/life-stage-challenges.tsx` — a checklist page at
  `/life-stage`: progress bar, per-challenge cards with a "Mark done"
  action, tier badge display. Registered in `client/src/App.tsx`.

## Explicitly not built here

- **No entry point/nav link yet.** The page exists at `/life-stage` but
  isn't linked from anywhere in the app's navigation — needs a decision on
  where it surfaces (settings? a dashboard card for 50+ profiles? both).
- **No connection to real care gaps.** `preventive-care-service.ts` and
  `care-gaps-service.ts` already compute real, data-driven preventive-care
  recommendations for a patient. This module's content is static and
  generic by design (safe, no clinical-logic risk) — a future iteration
  could surface a "this matches a real gap in your record" badge on top of
  the existing gap-detection logic, but that's a meaningfully bigger,
  higher-stakes integration and wasn't attempted here.
- **No family-hub surfacing.** A caregiver managing a parent's profile
  (common for the 70+ tier) can't yet see or nudge on their behalf from the
  caregiver dashboard — natural follow-up given `caregiver-dashboard-routes.ts`
  already exists.
