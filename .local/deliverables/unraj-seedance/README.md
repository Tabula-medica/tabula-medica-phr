# unraj.org × Seedance 2.0 — Video Upgrade Kit

**Prepared for:** Dr. Rajiv Aggarwal (physician-founder, Tabula Medica / Uninsurance)
**As of:** 2026-09-03
**Scope:** Use ByteDance Seedance 2.0 to add short, cinematic, brand-consistent video to unraj.org without hurting page speed, accessibility, or medical-marketing compliance.

> **Assumption (stated once):** unraj.org is the personal/professional hub for Dr. Aggarwal that links the portfolio (Tabula Medica, Uninsurance, sawd.ai, Universal Health Radio, katha.kids). The site is not in this repo and the live page was unreachable from the build sandbox, so the prompts and components below are written to be dropped into any static or React site and adjusted to the real copy in under an hour.

---

## 1. What Seedance 2.0 gives you (and what it doesn't)

| Capability | Seedance 2.0 (Feb 2026) | Notes for a website |
|---|---|---|
| Inputs | Text, image, audio, video references (≤12 refs: 9 images, 3 videos, 3 audio) | Feed your real headshot + logo so the founder looks like you |
| Output | 4–15 s per call, up to 1080p (4K on Dreamina Pro), native audio, multi-shot in one pass | Hero loops need 6–10 s, muted, no audio track |
| Control | Timecoded shot scripts, single primary camera move, `@Image1` style refs | Lets you storyboard a 3-shot explainer in one prompt |
| Lip-sync | 8+ languages | Founder intro in English + Hindi + Spanish from one script |
| Successor | Seedance 2.5 (Jul 31 2026): 30 s clips, 50 refs, in-place "redraw" edits | Use 2.5 only for the long founder story; 2.0 is cheaper for loops |

Where to run it:

| Route | Best for | Cost (Sep 2026) | Watermark / license |
|---|---|---|---|
| **Dreamina (CapCut) web UI** | Hands-on iteration, 1080p–4K exports | Free tier (watermarked) · Standard ≈ $9.99/mo · Pro ≈ $19.99/mo | Pro = no watermark + commercial license |
| **fal.ai API** (`bytedance/seedance-2.0/*`) | Batch generation from the prompt pack, repeatable | 720p std $0.30/s · 1080p std $0.68/s · 720p fast $0.24/s | No watermark; check fal ToS for commercial use |
| **BytePlus ModelArk** (`dreamina-seedance-2-0-260128`) | Enterprise billing, region control | Token-based, ≈ $0.014 / 1k tokens | `watermark:false` flag available |

Budget reality (from `node generate.mjs --estimate`, fal list prices):

| Run | What | Est. USD |
|---|---|---|
| Draft pass | all 6 clips, fast tier 720p, 3 seeds | ≈ $44 |
| Final pass | all 6 clips at spec (720p/1080p), 1 seed each | ≈ $32 |
| Final pass | same, 3 seeds each (recommended for keepers) | ≈ $92 |

Cheapest sane plan: drafts on `--fast` (≈ $44), then re-run only the 2–3 clips you love at full spec (≈ $30–50). Total ≈ $75–95. On Dreamina Pro the same volume fits inside one month's credits at ≈ $20.

---

## 2. The six clips, and where each one goes on unraj.org

| # | Clip | Length | Ratio | Placement | Why it improves the site |
|---|---|---|---|---|---|
| 1 | `01-hero-loop` — abstract "records that follow you" motion | 8 s loop | 16:9 | Above-the-fold hero background, muted, autoplay | Replaces a static hero; conveys the thesis in 2 s without reading |
| 2 | `02-founder-intro` — Dr. Aggarwal to camera (from your headshot + voice ref) | 12 s | 16:9 | "About" section, click-to-play with captions | Trust: 38-year family physician, in his own voice |
| 3 | `03-portfolio-explainer` — 3-shot: fragmented records → one record → affordable care | 15 s | 16:9 | "What I'm building" section | Explains TM + Uninsurance in one breath |
| 4 | `04-care-access` — uninsured family finding a sliding-scale clinic on a phone | 10 s | 16:9 | Uninsurance card | Emotional hook for the 40M uninsured message |
| 5 | `05-diaspora-families` — multilingual, multigenerational health moments | 10 s | 16:9 | Universal Health Radio / katha.kids card | Shows the 22-language, immigrant-family audience |
| 6 | `06-social-vertical` — 9:16 cut of #1 + #3 for LinkedIn/WhatsApp/Instagram | 8 s | 9:16 | Not on site; social traffic driver back to unraj.org | Same assets, second channel |

Prompts are in `prompts/` (one file per clip, paste-ready for Dreamina; the JSON is what `generate.mjs` consumes).

---

## 3. Workflow (≈ 3 hours end to end)

1. **Collect references** into `refs/` (not committed): one clean headshot (front-lit, neutral background), the unraj logo PNG, a 10–20 s voice sample of you reading any paragraph, and one still from the Tabula Medica app.
2. **Generate** — either paste `prompts/*.md` into Dreamina (attach refs in Multiframes mode using `@Image1`, `@Audio1`), or run:
   ```bash
   cd .local/deliverables/unraj-seedance
   npm i @fal-ai/client
   FAL_KEY=... node generate.mjs --only 01,03      # dry-run cost first: --estimate
   ```
3. **Pick keepers** — generate 3 seeds per clip, keep the one with no identity drift and no text artifacts.
4. **Optimize for web** — `bash optimize.sh out/01-hero-loop.mp4` produces H.264 MP4 + WebM (AV1/VP9) + poster JPEG + a 9:16 crop, all under the budgets in §5.
5. **Drop in** — `web/hero-video.html|css|js` for a static site, or `web/HeroVideo.tsx` for React/Tailwind. Both handle `prefers-reduced-motion`, poster fallback, lazy loading, and a pause button.
6. **QA** — run `checklist.md` before publishing.

---

## 4. Compliance guardrails (physician site, US)

- **No real patients, ever.** Every person in a clip is synthetic or is you. Never upload a patient photo, chart, or name as a reference. Nothing in the prompt pack contains PHI; keep it that way.
- **You are the only real likeness.** Uploading your own headshot/voice is fine. Do not generate colleagues, staff, or public figures.
- **Truthful claims (FTC §5, Virginia Board of Medicine advertising rules).** On-screen text stays factual: "Family physician, 38 years," "Founder, Tabula Medica." No outcome claims, no "best," no implied endorsements. The prompts render no text on purpose; add captions in HTML where you control the wording.
- **AI disclosure.** Add one line in the footer: "Illustrative video created with AI-generated imagery; no patient data was used." Good practice today and required under several state AI-disclosure bills.
- **Not insurance.** Any Uninsurance clip must not use the word "insurance" in visuals or captions (Virginia DMPO §38.2-6300).
- **Accessibility (WCAG 2.1 AA, §1557).** Captions on any clip with speech, `prefers-reduced-motion` honored, a visible pause control, no flashing >3 Hz.

---

## 5. Performance budgets (what keeps Lighthouse green)

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
├── prompts/
│   ├── prompts.json          ← machine-readable (used by generate.mjs)
│   ├── 01-hero-loop.md
│   ├── 02-founder-intro.md
│   ├── 03-portfolio-explainer.md
│   ├── 04-care-access.md
│   ├── 05-diaspora-families.md
│   └── 06-social-vertical.md
└── web/
    ├── hero-video.html       ← static drop-in section
    ├── hero-video.css
    ├── hero-video.js
    └── HeroVideo.tsx         ← React + Tailwind (matches Tabula Medica hero)
```

Sources consulted: fal.ai Seedance 2.0 endpoint README, BytePlus ModelArk docs, Dreamina/CapCut Seedance pages, the community Seedance 2.0 prompting guide, and Seedance 2.5 launch coverage (July 31 2026).
