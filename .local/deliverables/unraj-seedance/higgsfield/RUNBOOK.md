# Higgsfield MCP runbook — generate the unraj.org clips from inside Claude

**Goal:** Dr. Aggarwal connects the hosted Higgsfield MCP once; Claude (this session or any Cowork/Claude Code session) then generates all six Seedance 2.0 clips, polls them, and hands back download URLs. No API keys, no scripts.

**Status on 2026-09-03:** the Higgsfield connector is **not connected** to this session. It is a custom-URL connector (not in the public claude.ai directory), so it has to be added once by the account owner (steps in §1). Everything below is ready for the moment it is.

---

## 1. Connect it (one time, ≈ 2 minutes)

| Surface | Steps |
|---|---|
| **claude.ai / Cowork / this remote session** | Settings → Connectors → **Add custom connector** → Name `Higgsfield`, URL `https://mcp.higgsfield.ai/mcp` → Add → **Connect** (OAuth with your Higgsfield login). Then in this chat's connector toggles, enable **Higgsfield**. |
| **Claude Code (terminal)** | `claude mcp add --transport http --scope user higgsfield https://mcp.higgsfield.ai/mcp` then run `/mcp` and finish the OAuth sign-in. Restart if tools do not appear. |
| **Any project repo** | Drop `higgsfield/mcp.json` from this folder in as `.mcp.json` at the repo root so every Claude Code session in that repo gets it (asks each dev to approve once). |

Requirements: a paid Higgsfield plan (Plus/Pro/Ultimate; credits are billed per generation). Seedance 2.0 is available on Higgsfield in Standard, Fast, and Mini modes at 480p–4K, 4–15 s, with optional audio and video reference inputs.

---

## 2. Credit budget (Higgsfield credit mode, Sep 2026 public figures)

| Clip | Spec | Approx. credits | Approx. USD on Plus |
|---|---|---|---|
| 01 hero loop | 8 s · 720p · no audio | ≈ 40 | ≈ $1.80 |
| 02 founder intro | 12 s · 1080p · audio · image + audio refs | ≈ 110 | ≈ $4.80 |
| 03 explainer | 15 s · 1080p · audio | ≈ 135 | ≈ $6.00 |
| 04 care access | 10 s · 720p · no audio | ≈ 50 | ≈ $2.25 |
| 05 diaspora | 10 s · 720p · audio | ≈ 55 | ≈ $2.50 |
| 06 social 9:16 | 8 s · 1080p · audio · refs | ≈ 75 | ≈ $3.30 |
| **One seed each** | | **≈ 465** | **≈ $21** |
| **Three seeds each** | | **≈ 1,400** | **≈ $62** |

Basis: Higgsfield lists ≈ 45 credits for a 5 s 1080p Seedance 2.0 clip and ≈ 25 credits for 5 s at lower resolution, scaled linearly by duration with a small uplift for audio and reference inputs. Treat these as ± 30% until the first job returns its actual charge. If you are on a Seedance Unlimited add-on window, the per-clip cost is zero and you should run all three seeds.

---

## 3. What Claude will do once connected (the exact loop)

1. Call the connector's model-listing tool (if present) to confirm the Seedance 2.0 model id and the parameter schema. Expected ids: `seedance-2.0` / `seedance` (Standard), a `fast` variant, and `seedance-2.5`. **Use whatever the live schema says; do not guess.**
2. Upload references for clips 02 and 06 (headshot, voice sample, the chosen clip 03 output) through the tool's file/URL input.
3. Submit each entry in `jobs.json` as one video-generation call, three seeds for the keepers, one seed for drafts.
4. Poll with the connector's job-status / wait tool until each job is `completed`; collect result URLs.
5. Download the MP4s into `../out/` (or hand you the URLs if downloads are blocked in the environment), write the sidecar request JSON for provenance, and stop.
6. You pick keepers; `../optimize.sh` does the web encode as before.

Guardrails Claude will enforce during the run: no patient images or PHI in references, no text baked into video, the Uninsurance clip never says "insurance", and every published clip keeps its prompt + seed on file.

---

## 4. Paste-ready message for the session (after connecting)

> Higgsfield is connected. Run the unraj.org batch from `.local/deliverables/unraj-seedance/higgsfield/jobs.json`: first list the available models and confirm the Seedance 2.0 id and parameters, then generate clips 01, 04 and 05 with one seed each as drafts, show me the URLs, and wait for my go before spending credits on 02, 03 and 06.

Drafts first (≈ 145 credits, ≈ $6.50) keeps the first spend small and lets you check the look before the reference-driven clips.

---

## 5. Why Higgsfield instead of fal.ai or Dreamina

| | Higgsfield MCP | fal.ai API (`../generate.mjs`) | Dreamina web |
|---|---|---|---|
| Runs from Claude with no code | **Yes** | No (script) | No (manual) |
| Seedance 2.0 + 2.5 + 30 other models on one login | **Yes** | Seedance only | Seedance only |
| Predictable per-second USD | No (credits) | **Yes** | No (credits) |
| 4K / 10-bit masters | Yes (plan-dependent) | 720p–1080p on the public endpoints | Yes (Pro) |
| Best for | You saying "make the clips" in chat | Repeatable batch runs | Hand-tuning one shot |

Keep all three routes in the kit; the prompts and the web components do not change.
