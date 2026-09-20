# Higgsfield MCP runbook — generate the unraj.org clips from inside Claude

**Goal:** connect the hosted Higgsfield MCP once; Claude (this session or any Cowork / Claude Code session) then generates all six Seedance 2.0 clips, polls them, and hands back download URLs. No API keys, no scripts.

**Status on 2026-09-20:** the Higgsfield connector is **not connected** to this session. It is a custom-URL connector (not in the public claude.ai directory), so the account owner has to add it once (§1). Everything below is ready for the moment it is.

---

## 1. Connect it (one time, ≈ 2 minutes)

| Surface | Steps |
|---|---|
| **claude.ai / Cowork / this remote session** | Settings → Connectors → **Add custom connector** → Name `Higgsfield`, URL `https://mcp.higgsfield.ai/mcp` → Add → **Connect** (OAuth with your Higgsfield login). Then enable **Higgsfield** in this chat's connector toggles. |
| **Claude Code (terminal)** | `claude mcp add --transport http --scope user higgsfield https://mcp.higgsfield.ai/mcp` then `/mcp` to finish OAuth. Restart if tools do not appear. |
| **Any project repo** | Copy `higgsfield/mcp.json` to the repo root as `.mcp.json`. |

Requirements: a Higgsfield account with credits or an active Unlimited window. Output is watermark-free on paid plans and licensed for commercial use under Higgsfield's Terms of Use.

---

## 2. Official Seedance 2.0 parameters on Higgsfield

From Higgsfield's own CLI `MODELS.md` (job type `seedance_2_0`); the MCP tool exposes the same fields.

| Field | Values | Default |
|---|---|---|
| `aspect_ratio` | `auto`, `16:9`, `9:16`, `4:3`, `3:4`, `1:1`, `21:9` | `16:9` |
| `duration` | integer seconds (4–15) | `5` |
| `resolution` | `480p`, `720p`, `1080p`, `4k` | `720p` |
| `generate_audio` | boolean | `true` |
| `image-references` | up to 9 (counting start/end image) | — |
| `video-references` | up to 3 | — |
| `audio-references` | up to 3; needs at least one image or video ref | — |
| `start-image` / `end-image` | single each | — |
| mode | `fast` (480p/720p only) or `std` (1080p/4k) | — |

Total references ≤ 12. Sibling job types: `seedance_2_0_mini` (cheapest) and `seedance_2_5` (30 s, 50 refs). Known quirk (CLI issue #30, June 2026): multiple image references may be rejected as duplicate `start_image`; if that happens, pass one image and describe the rest in the prompt.

---

## 3. Credit budget

Higgsfield's published example: Seedance 2.0, 10 s, 1080p, High ≈ 90 credits (≈ $4.50), i.e. ≈ 9 credits/s at 1080p and roughly half that at 720p.

| Clip | Spec | Approx. credits |
|---|---|---|
| 01 hero loop | 8 s · 720p · no audio | ≈ 35 |
| 02 story of the stone | 15 s · 1080p · audio | ≈ 135 |
| 03 empire ledger | 10 s · 720p · no audio | ≈ 45 |
| 04 one billion voices | 12 s · 1080p · audio | ≈ 110 |
| 05 return home | 8 s · 720p · audio | ≈ 35 |
| 06 social 9:16 | 8 s · 1080p · audio · refs | ≈ 75 |
| **Drafts (01, 03, 05), one seed, fast mode** | | **≈ 115 (≈ $6)** |
| **Finals, one seed each** | | **≈ 435 (≈ $22)** |
| **Finals, three seeds each (the `seeds` values in jobs.json)** | | **≈ 1,300 (≈ $65)** |

Treat as ± 30 % until the first job returns its real charge. Under a Seedance Unlimited window (Seedance 2.0 at 1080p/8 s is included) the cost is zero but jobs run one at a time.

---

## 4. Paste-ready message for the session (after connecting)

> Higgsfield is connected. Run the unraj.org batch from `.local/deliverables/unraj-seedance/higgsfield/jobs.json`: first list the available video models and confirm the Seedance 2.0 job type and parameters, then generate the draft clips 01, 03 and 05 with one seed each in fast mode, show me the URLs, and wait for my go before spending credits on 02, 04 and 06.

Drafts first (≈ 115 credits, ≈ $6) keeps the first spend small and lets you check the diamond look before the longer clips.

---

## 5. What Claude does once connected

1. Lists models to confirm the Seedance 2.0 job type and live schema. **Uses whatever the live schema says; never guesses.**
2. Uploads `refs/diamond.png` through the tool's file input. Before job 06, copies the chosen clip 04 download to `out/keepers/04-one-billion-voices.mp4` (the path `jobs.json` names) and uploads that.
3. Submits each `jobs.json` entry as one generation call; drafts in `fast` mode, finals in `std`.
4. Polls the job-status tool until `completed`; collects result URLs.
5. Downloads the MP4s into `../out/<id>-s<seed>.mp4` (or returns the URLs if downloads are blocked), writes the sidecar request JSON for provenance, and stops. Keepers are promoted to `../out/keepers/<id>.mp4`.
6. You pick keepers; `../optimize.sh` does the web encode.

Guardrails enforced during the run: no living public figures, no fake documents or institutional signage, no readable text in frame, respectful historical iconography, every published clip keeps its prompt + seed on file.
