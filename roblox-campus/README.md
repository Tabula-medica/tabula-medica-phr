# World Clinic: Campus Life — Roblox Experience

The teen / college-age / newly-married tier of the World Clinic series. See
`.local/deliverables/roblox-campus-life-concept.md` for the full rationale;
this file covers setup and the content boundary specific to this tier.

## Why this is a SEPARATE Roblox place, not a mode inside World Clinic

Roblox's content-maturity system (Minimal/Mild/Moderate/Restricted
descriptors, mapped to an age label shown to age-verified users) applies
per-experience, not per-scene. Bundling teen/young-adult content (alcohol
screening, sexual health, family planning) into the same place as the
all-ages kids' clinic would either force the whole thing to a higher
maturity rating — hiding it from the younger kids it's also meant for — or
misrepresent the content in the maturity questionnaire. Two places, one
Group, correctly age-gated, is the only clean way to do this:

- **World Clinic** (`roblox/`) — all ages / 9+, kids' preventive-care basics.
- **World Clinic: Campus Life** (this folder) — 13+, teen/college/newlywed
  preventive-care concepts.

Both share the same Tabula Medica Group and the same account-linking system
(`/api/roblox/link/*` — one link code works for either place), but are
built, rated, and published independently.

## Content boundary (read this before building scenes or touching copy)

Same PHI boundary as the kids' game (see `roblox/README.md`) — no real
health data ever crosses. On top of that, this tier's subject matter needs
its own guardrail because the topics are more sensitive:

- **Never depict** alcohol, drug use, or sexual activity — not even
  cartoon-stylized. Topics like substance-use screening or sexual health are
  handled entirely through NPC *dialogue about the visit* ("your doctor may
  ask, and it's confidential"), never through simulated behavior.
- **Never give real medical advice.** Every measure teaches a general
  concept ("screening is routine and confidential"), never a personalized
  recommendation.
- **Never name real medications, real providers, or real brands.**
- Keep this in Roblox's 13+ content-maturity tier when filling out the
  Game Settings questionnaire at publish time — don't under-declare it to
  reach a younger audience.

The full measure catalog and exact copy live in
`server/roblox-campus-routes.ts` → `CAMPUS_MEASURES`. Review any copy change
there against this boundary before publishing.

## What's here

```
roblox-campus/
├── default.project.json                     # Rojo project (place name: WorldClinicCampus)
└── src/
    ├── ReplicatedStorage/
    │   └── RemoteEvents.lua                  # Shared client<->server API
    ├── ServerScriptService/
    │   ├── BadgeSync.lua                     # Only script that calls the TM backend
    │   ├── MiniGameAPI.lua                   # Server-authoritative "award this badge" helper
    │   ├── GameManager.server.lua            # Boots the link-code flow
    │   └── MiniGames/
    │       └── CampusLife.server.lua         # Flagship: NPC visits + Nova scorecard
    └── StarterPlayer/StarterPlayerScripts/
        └── ClientUI.client.lua               # Link panel, reward toast, Nova panel
```

## Content backlog (not yet built)

`CampusLife.server.lua` is the flagship mode — it alone exercises the full
measure catalog and is enough to launch with. Following the kids' game's
pattern (`roblox/src/ServerScriptService/MiniGames/`), these are natural
next mini-games, each a straightforward port of an existing kids'-game
pattern with age-appropriate content:

- **Stress Less** — a breathing/mindfulness timer (same shape as
  Handwashing Hero's `ProximityPrompt` hold-timer) teaching a real coping
  technique, not just talking about stress.
- **Know Your Resources** — a campus-map touch-quest (same shape as Body
  Systems Quest) visiting stations for the health center, counseling
  center, pharmacy, and confidential testing — so the *concept* of "here's
  where you'd actually go" sticks.
- **Coverage Quiz** — a server-validated matching game (same shape as
  Medication Match) pairing insurance-literacy terms to plain-language
  definitions.

## Local setup

Same as the kids' game (see `roblox/README.md` for the full walkthrough):
`rojo serve` from this directory, connect Roblox Studio, build the scene
pieces `CampusLife.server.lua`'s header comment describes
(`workspace.MiniGames.CampusLife.Patients.<Name>`), set `BadgeSync.lua`'s
`API_BASE_URL`/`API_KEY` and the HTTP allowlist, generate a link code from
the Tabula Medica app's Achievements → Roblox tab, and test the link + a
visit round end to end.

## Publishing

Publish as its own Roblox place under the Tabula Medica Group, separate
from World Clinic. Set the content-maturity questionnaire to 13+ per the
content boundary above, and re-check the Allowed HTTP Request Domains
setting on the published place (Studio's local setting doesn't always
carry over).
