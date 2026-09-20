# World Clinic: Future Health — Roblox Experience

A Roblox source tree (managed with [Rojo](https://rojo.space/)) for a
health-education mini-game hub that syncs badges/points back into the main
Tabula Medica app. See
`.local/deliverables/roblox-healthcare-games-concept.md` for the product
rationale, compliance boundary, and rollout plan.

## What's here

```
roblox/
├── default.project.json                          # Rojo project definition
└── src/
    ├── ReplicatedStorage/
    │   └── RemoteEvents.lua                       # Shared client<->server API
    ├── ServerScriptService/
    │   ├── BadgeSync.lua                          # Only script that calls the TM backend
    │   ├── MiniGameAPI.lua                        # Server-authoritative "award this badge" helper
    │   ├── GameManager.server.lua                 # Boots linking + relays client-driven events
    │   └── MiniGames/
    │       ├── HandwashingHero.server.lua         # ProximityPrompt, 20s hold
    │       ├── BodySystemsQuest.server.lua        # Touch 3 checkpoints
    │       ├── MedicationMatch.server.lua         # Server-validated matching puzzle
    │       ├── GermBuster.server.lua              # Timed round, clear every germ zone
    │       └── FutureHealth.server.lua            # HEDIS-concept NPC visits + Dr. Nova scorecard
    └── StarterPlayer/StarterPlayerScripts/
        └── ClientUI.client.lua                    # Link panel, reward toast, Dr. Nova panel
```

All five catalog badges now have a scene/script. `roblox-checkup-champion` is
the one exception to "one badge, one mini-game": it's awarded automatically
by the backend when Future Health reaches 4+ stars over 10+ visits, not by a
standalone scene — see `.local/deliverables/roblox-hedis-future-health.md`.

## Compliance boundary (read this before building scenes)

Roblox is a public, COPPA-governed platform with no direct relationship to a
patient's medical record. **Never** put real names, diagnoses, medications,
dates of birth, or any other PHI into a Roblox script, GUI, or asset. Every
mini-game here uses fictional labels ("Bottle A", "Chart 3") on purpose.

The only data that crosses the Tabula Medica <-> Roblox boundary is:
- A short-lived, 8-character link code (generated inside the authenticated
  Tabula Medica app, entered by the family in Roblox).
- The player's Roblox `UserId`.
- A catalog badge id (e.g. `roblox-handwash-hero`) and a point count.

## Local setup

1. Install [Rojo](https://rojo.space/) (VS Code extension or CLI) and
   [Roblox Studio](https://create.roblox.com/).
2. From this directory: `rojo serve` (or use the Rojo Studio plugin's
   "Connect" button pointed at this folder).
3. In Studio, connect to the running Rojo server. The `ReplicatedStorage`,
   `ServerScriptService`, and `StarterPlayer` trees will sync in.
4. Build the physical scene pieces each mini-game expects (see the comment
   block at the top of each script under `ServerScriptService/MiniGames/`):
   - `workspace.MiniGames.HandwashingHero.SinkPrompt` — a `ProximityPrompt`
   - `workspace.MiniGames.BodySystemsQuest.Stations.{Heart,Lungs,Digestive}` —
     three `BasePart`s
   - A drag-and-drop `ScreenGui` for Medication Match that fires
     `MedicationMatchAttempt:FireServer(bottleId, chartId)` using ids from
     `MedicationMatch.server.lua`'s `ANSWER_KEY`
   - `workspace.MiniGames.FutureHealth.Patients.<Name>` — one `Model`
     per NPC, each with an `Anchor` part, a `ProximityPrompt` named
     `VisitPrompt`, and a `BillboardGui` named `Bubble` containing a
     `TextLabel` named `Text`
   - `workspace.MiniGames.GermBuster.Zones.<Name>` — one `BasePart` per germ
     spot (each with a `BoolValue` child named `Cleared`), plus
     `workspace.MiniGames.GermBuster.StartPrompt` — a `BasePart` that starts
     a 30-second round when touched

## Wiring up the backend connection

`ServerScriptService/BadgeSync.lua` is the only script that talks to Tabula
Medica. Before publishing:

1. Set `API_BASE_URL` to your deployed Tabula Medica origin
   (`https://<your-domain>/api/roblox`).
2. Add that origin to Roblox Studio's **Game Settings → Security → Allowed
   HTTP Request Domains** (also required in the published experience's
   settings on the Creator Hub) and confirm **Allow HTTP Requests** is on.
3. Set `ROBLOX_SERVER_API_KEY` in the Tabula Medica server's environment
   (Replit Secrets / GCP Secret Manager) to a long random value, then set
   `API_KEY` in `BadgeSync.lua` to the same value. **Do not commit the real
   key to source control** — in a Team Create project, inject it via a
   ServerStorage config script or Roblox's `HttpService` + a private
   `ModuleScript` added at publish time, not this public-facing repo copy.

## Testing the link flow end-to-end

1. Run the Tabula Medica app, sign in, open **Achievements → Roblox** tab,
   and click **Generate link code**.
2. In Roblox Studio, press Play, type the code into the "Link your Tabula
   Medica family account" panel, and click **Link account**.
3. Trigger any mini-game (e.g. hold the sink `ProximityPrompt` for 20
   seconds). A reward toast should appear in Roblox, and the badge should
   show up under the Roblox tab in the Tabula Medica app within a few
   seconds (no refresh needed on next query refetch).

## Publishing

Once the experience is ready for the Roblox Creator Hub, follow Roblox's
standard publish flow (`File → Publish to Roblox As...`), then re-check the
**Allowed HTTP Request Domains** setting on the published place (it does not
inherit from Studio's local test settings automatically for every case).
