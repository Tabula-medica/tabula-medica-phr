# unraj.org × Seedance 2.0 — Video Upgrade Kit

**Site:** [unraj.org](https://unraj.org) — *"Bring the Kohinoor Diamond Home to India."* A campaign site asking Britain to return the Koh-i-Noor and other artifacts taken during the Raj. Core pieces on the live page: the story of the stone (Golconda mines, 105.6 carats, Mughal courts to the Tower of London), the **Empire Ledger** (a country-by-country record of what was taken and never returned), an FAQ, a **global declaration** visitors sign, and translations in dozens of languages (English, Nepali, Malayalam, Santali, Yoruba, Greek and more).
**Prepared for:** Rajiv Aggarwal (site owner) · **As of:** 2026-09-20
**Scope:** use ByteDance Seedance 2.0 to add short, dignified, cinematic video that raises signature conversion without hurting page speed, accessibility, or credibility.

> Correction to the first draft of this kit (2026-09-03): it assumed unraj.org was a physician founder page. The live site was unreachable from the sandbox then; it has since been read via search indexing and every prompt, copy block, and guardrail below now targets the actual campaign.

---

## 1. What Seedance 2.0 gives you (and what it doesn't)

| Capability | Seedance 2.0 | Notes for this site |
|---|---|---|
| Inputs | Text, image, audio, video references (≤12 refs: 9 images, 3 videos, 3 audio) | Feed the site's own diamond render or logo so the hero matches the brand |
| Output | 4–15 s per call, 480p–4K, native audio, multi-shot in one pass | Hero loops need 6–10 s, muted; explainers 12–15 s with sound |
| Control | Timecoded shot scripts, one camera move per shot, `@Image1` style refs | Lets you storyboard "mine → court → Tower" in one prompt |
| Successor | Seedance 2.5 (Jul 2026): 30 s clips, 50 refs, in-place edits | Use 2.5 only for a long "story of the stone" film; 2.0 is cheaper for loops |

Where to run it:

| Route | Best for | Cost (Sep 2026) | Notes |
|---|---|---|---|
| **Higgsfield MCP** (`https://mcp.higgsfield.ai/mcp`) | Saying "make the clips" to Claude in chat, Cowork, or Claude Code | ≈ 9 credits/s at 1080p (10 s ≈ 90 credits ≈ $4.50); Unlimited windows cover Seedance 2.0 at 1080p/8 s | No API keys; watermark-free on paid plans; see `higgsfield/RUNBOOK.md` |
| **Dreamina (CapCut) web UI** | Hand-tuning one shot, 4K exports | Free (watermarked) · Pro ≈ $19.99/mo | Pro = no watermark + commercial license |
| **fal.ai API** (`bytedance/seedance-2.0/*`) | Repeatable batch runs (`generate.mjs`) | 720p $0.30/s · 1080p $0.68/s · fast 720p $0.24/s | Public endpoints top out at 1080p |

Budget (from `node generate.mjs --estimate`, fal list prices):

| Run | Est. USD |
|---|---|
| Draft pass, all 6 clips, fast tier 720p, 3 seeds | ≈ $44 |
| Final pass at spec, 1 seed each | ≈ $32 |
| Final pass at spec, 3 seeds each | ≈ $92 |

On Higgsfield the same six clips at one seed are ≈ 500 credits (≈ $25); a Seedance Unlimited window makes them free but paces one job at a time.

---

## 2. The six clips and where each goes on unraj.org

| # | Clip | Length | Ratio | Placement | Why it helps |
|---|---|---|---|---|---|
| 1 | `01-hero-loop` — the diamond turning in darkness, light from Golconda | 8 s loop | 16:9 | Above-the-fold hero background, muted | Instant emotional weight behind "Bring the Kohinoor home" |
| 2 | `02-story-of-the-stone` — 4-shot journey: mine → Mughal court → 1849 Lahore → Tower of London | 15 s | 16:9 | "The story" section, click-to-play, captioned | The whole argument in 15 s without reading |
| 3 | `03-empire-ledger` — ledger pages and a world map filling with lines from India outward | 10 s | 16:9 | Empire Ledger section header | Visualises "what was taken" at a glance |
| 4 | `04-one-billion-voices` — faces across India and the diaspora, many scripts, one gesture | 12 s | 16:9 | Above the declaration form | Social proof for the signature ask |
| 5 | `05-return-home` — an empty velvet cushion in Delhi, then light returns to it | 8 s | 16:9 | After the FAQ / closing section | Hopeful ending, the "what winning looks like" beat |
| 6 | `06-social-vertical` — 9:16 cut of #1 + #4 with space for a "Sign the declaration" overlay | 8 s | 9:16 | Instagram Reels, WhatsApp status, X, YouTube Shorts | Drives traffic back to the form |

Prompts live in `prompts/` (one file per clip, paste-ready; `prompts.json` is what `generate.mjs` and `higgsfield/jobs.json` use).

---

## 3. Workflow (≈ 3 hours end to end)

1. **Collect references** into `refs/` (not committed): the site's diamond hero image or logo PNG, and optionally a still of the Empire Ledger page for palette. No photos of real people are needed for any clip.
2. **Generate** — pick one route:
   - **Higgsfield MCP (recommended, no code):** connect once per `higgsfield/RUNBOOK.md` §1, then paste the §4 message into a Claude session.
   - **Dreamina:** paste `prompts/*.md` (attach refs in Multiframes mode using `@Image1`).
   - **fal.ai script:** `npm i @fal-ai/client && FAL_KEY=... node generate.mjs --only 01,03` (run `--estimate` first).
3. **Pick keepers** — 3 seeds per clip; reject any frame with readable text, distorted hands, or a recognisable living person. Promote each winner to a stable path: `node generate.mjs --keep 01:1000` copies `out/01-hero-loop-s1000.mp4` to `out/keepers/01-hero-loop.mp4` (Higgsfield or Dreamina downloads: copy them to the same `out/keepers/<id>.mp4` path by hand). Clip 06 reads `out/keepers/04-one-billion-voices.mp4`, so promote 04 before generating 06.
4. **Optimise for web** — `bash optimize.sh out/keepers/01-hero-loop.mp4` (a raw seed file such as `out/01-hero-loop-s1000.mp4` also works; the seed suffix is stripped) → H.264 MP4 + WebM + poster + 9:16 crop under the budgets in §5.
5. **Drop in** — `web/hero-video.html|css|js` for the static site, or `web/HeroVideo.tsx` if the site is React. Both honour `prefers-reduced-motion`, poster fallback, lazy loading, and a pause button. Copy is already the site's own language and is translatable through the existing `?lng=` mechanism.
6. **QA** — run `checklist.md` before publishing.

---

## 4. Guardrails for an advocacy site

- **No living real people.** Do not generate current British royals, politicians, or museum staff. Historical figures who died before 1926 (Mughal emperors, Ranjit Singh, the boy Maharaja Duleep Singh) may be *evoked* as period figures, never captioned as portraits.
- **No fake institutions.** No invented Tower of London signage, no forged documents or "official" letters. The Empire Ledger clip shows *a* ledger, not a mock British record.
- **Accuracy lives in HTML.** Every date, carat weight, and claim stays in editable page text where it can be sourced and translated. The prompts render no text on purpose.
- **Tone: dignified, not inflammatory.** No violence, no crowds with weapons, no mocking imagery. The site's power is moral clarity; the video should look like a museum film, not a protest reel.
- **AI disclosure.** One line under the hero: "Illustrative video created with AI-generated imagery." Several jurisdictions now require this for advocacy media.
- **Cultural respect.** Sikh, Mughal, and Hindu iconography rendered accurately and without costume-stereotyping; audio references use classical Indian instruments, not generic "ethnic" loops.
- **Accessibility (WCAG 2.1 AA).** Captions on any clip with speech, reduced-motion honoured, visible pause control, no flashing above 3 Hz. The site already serves many languages, so caption files ship per `?lng=`.

---

## 5. Performance budgets

| Asset | Budget | How |
|---|---|---|
| Hero MP4 (1280×720, 8 s, no audio) | ≤ 1.5 MB | `optimize.sh` CRF 28, `-an`, `faststart` |
| Hero WebM AV1 | ≤ 900 KB | served first via `<source>` order |
| Poster JPEG | ≤ 80 KB | first frame, quality 80, shown instantly |
| Click-to-play clips (1080p) | ≤ 6 MB each | `preload="none"`, poster only until click |
| LCP impact | 0 ms | poster is the LCP image; video decodes after |
| Mobile data | Poster only under `Save-Data` or reduced motion | handled in `hero-video.js` |

---

## 6. Files in this kit

```
unraj-seedance/
├── README.md                 ← this plan
├── checklist.md              ← pre-publish QA
├── generate.mjs              ← fal.ai batch generator + cost estimator
├── optimize.sh               ← ffmpeg web-encode pipeline
├── higgsfield/
│   ├── RUNBOOK.md            ← connect the Higgsfield MCP, official Seedance 2.0 flags, credit budget
│   ├── jobs.json             ← the six clips as MCP video-generation jobs
│   └── mcp.json              ← drop-in .mcp.json for Claude Code
├── prompts/
│   ├── prompts.json          ← machine-readable (used by generate.mjs and jobs.json)
│   ├── 01-hero-loop.md
│   ├── 02-story-of-the-stone.md
│   ├── 03-empire-ledger.md
│   ├── 04-one-billion-voices.md
│   ├── 05-return-home.md
│   └── 06-social-vertical.md
└── web/
    ├── hero-video.html       ← static drop-in section with the site's copy
    ├── hero-video.css
    ├── hero-video.js
    └── HeroVideo.tsx         ← React + Tailwind variant
```

Sources: unraj.org page titles and descriptions via search index (2026-09-20); Higgsfield CLI `MODELS.md` (official Seedance 2.0 flags) and Higgsfield MCP/Supercomputer guides; fal.ai Seedance 2.0 endpoint README; community Seedance 2.0 prompting guide; Seedance 2.5 launch coverage.
