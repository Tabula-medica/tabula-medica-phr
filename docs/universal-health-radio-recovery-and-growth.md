# Universal Health Radio (healonda.com) — recovery and growth plan

**Supersedes `docs/health-radio-rebuild-spec.md`** (merged in #56), which was written
before the source could be read and is wrong in its central claims. Corrections in §1.

---

## 1. Correction to the merged spec

| #56 claimed | Actually true |
| --- | --- |
| The source code is unrecoverable | **It is fully readable.** The Replit workspace files are intact and readable today |
| No backup exists | **A GitHub mirror exists** — the workspace auto-pushes `health-radio-fm-src.zip` to `tabulamedica246-web/health-radio-fm` |
| The app must be rebuilt from scratch | **Nothing needs rebuilding.** It is a mature pnpm monorepo with five artifacts |
| It is (assumed) a directory of third-party radio streams | **No streaming at all.** Content is spoken on-device via TTS — that is the core design choice |
| Product definition unknown | Fully documented in the workspace's own `replit.md` |

The one claim from #56 that still holds: **the deployment is suspended and healonda.com
serves nothing.** Re-verified — status `suspended`, deployment
`0fa6e83e-897f-49f2-9ec6-96435f691935`.

I could not attach the GitHub mirror to this session — `add_repo` refuses cross-owner
adds (`tabulamedica246-web` vs `tabula-medica`). To work in that repo directly, start a
session with it as the initial source.

---

## 2. What the product actually is

**Universal Health Radio** is the `web` artifact — a React + Vite "receiver faceplate"
served at healonda.com. Its sibling, the Expo mobile app, is separately branded
**Health Radio FM**. One mission, two front-ends.

A low-data, multilingual health-information radio for low-bandwidth regions. It reads
clinician-reviewed WHO/CDC/FDA health segments aloud using the device's **built-in
text-to-speech — no audio is ever streamed** — with synced scrolling subtitles, in each
region's own language.

- **14 regional stations** — Swahili, French, Hindi, Tamil, Telugu, Bengali, Urdu,
  Nepali, Mandarin, Cantonese, Spanish, Portuguese, Arabic, English. Urdu and Arabic
  render right-to-left.
- **Five sections** — Listen (TTS radio with Web Audio-synthesized station idents and
  regional music beds, never under the voice), Talk (two-host Deep Dive Hour + Talk
  Hour, pre-written, never live-AI), Ask (24/7 AI health assistant), Kids Corner
  (parent-gated), How we verify.
- **A six-step content gate** ending in a hard clinician sign-off (Rajiv Aggarwal, MD).
  No signature, no broadcast.
- **Monorepo** — pnpm workspaces, Node 24, TS 5.9; artifacts: `web`, `mobile`,
  `api-server`, `mockup-sandbox`, `promo-video`.

This is a genuinely differentiated product. The zero-streaming design is the moat: it
works where streaming does not.

---

## 3. Findings

### F1 — The site is offline, and the cost compounds (blocker)

Nothing below matters until healonda.com serves traffic. Worse than a flat loss:
sustained downtime gets pages **dropped from the search index**, so the substantial SEO
work already shipped decays the longer this runs. Marketing spend against a dead domain
is wasted outright.

### F2 — The sitemap advertises five URLs that do not exist

`artifacts/web/public/sitemap.xml` lists six URLs: `/web/` plus `/web/listen`,
`/web/talk`, `/web/ask`, `/web/kids`, `/web/how-we-verify`.

But `artifacts/web/src/pages/` contains exactly one file — `not-found.tsx`. The project's
own `seo_strategy.md` confirms it: those sections are *"tab-state views, not route-backed
public documents."* The prerendered crawler markup in `index.html` links to all five as
well.

So every deep URL either 404s or serves byte-identical homepage HTML.

### F3 — Canonical tags collapse every deep URL onto the homepage

The inline script in `index.html` computes the canonical URL as the origin plus the
pathname with its last segment stripped:

```js
var pathname = location.pathname.replace(/[^/]*$/, '');
var canonicalUrl = origin + base;
```

For `/web/listen` that yields `/web/`. **Every section URL self-canonicalises to the
homepage.** Even if F2 were fixed and the routes returned 200, they would remain
non-indexable by construction.

Net effect of F2 + F3: roughly ten distinct topic clusters — mental health, women's
health, nutrition, vaccines, maternal health, misinformation, verification — across
14 languages, all competing on **one indexable URL**. No site ranks for that many
distinct intents on a single page.

### F4 — No hreflang

`og:locale:alternate` is Open Graph, not hreflang; it does not drive search language
targeting. There are no `rel="alternate" hreflang="…"` annotations. Fourteen languages
of content sit on one URL with no per-language targeting, so a Swahili query and a Hindi
query compete for the same page.

### F5 — `PodcastSeries` schema, but no podcast

The JSON-LD declares a `PodcastSeries` ("Deep Dive Hour") with genres like "Mental Health
Podcast". But the product's defining feature is that it **synthesizes speech on-device
and ships no audio files** — there is no RSS feed and no enclosures.

Consequences: it cannot be listed in Apple Podcasts or Spotify (both require an RSS feed
with audio enclosures), and the markup asserts a format that does not exist. Decide one
way or the other — either produce real audio plus an RSS feed, or drop the
`PodcastSeries` claim and the podcast keywords with it.

### F6 — Replit couplings that block migration

| Coupling | Where | Migration impact |
| --- | --- | --- |
| Sitemap URLs generated from `REPLIT_DOMAINS` | Vite `generateSitemap` plugin | Must take the domain from config |
| Ask backed by Replit AI Integrations (`/anthropic/ask`) | `api-server` | Needs a direct provider call + key in a secret store |
| `@replit/connectors-sdk` | root `package.json` | Remove |
| Auto-push watcher runs **only while the workspace is awake** | `scripts/watch-and-push.ts` | The GitHub mirror is stale whenever the Repl sleeps — verify freshness before trusting it |

### F7 — Two governance flags (not blockers, but decide deliberately)

- **Brand collision.** `docs/NONPROFIT_AND_FREE_MARKETING_PLAYBOOK.md` §6 lists "**UHR** —
  health records" as one of the four brands. Universal Health Radio is a health *radio*
  product, not a records product. Either these are two different things sharing an
  acronym, or the playbook mislabels this one. It matters, because Ad Grants campaign
  structure and the 1023 narrative are both built per brand.
- **Ask and the AI boundary.** This repo's `CLAUDE.md` sets a non-negotiable that
  PHI-bearing AI calls go to Vertex under the Google BAA, never Anthropic or OpenAI. UHR
  is a separate product and Ask is general public health Q&A, not records — so the rule
  arguably does not bind it. But listeners will type personal symptoms into a free-text
  health box. Decide the boundary explicitly and write it down, especially if UHR lands
  in the same GCP project.

---

## 4. The link that makes this urgent

The nonprofit playbook budgets **$120,000/year in Google Ad Grants** as the primary
marketing engine. Ad Grants requires an owned domain, an HTTPS site, conversion tracking,
and ≥5% CTR — and the playbook's own warning is that *"thin sites are the top cause of
Ad Grants rejection."*

A domain serving nothing fails outright. A one-page SPA whose five advertised
destinations 404 or duplicate the homepage is exactly the "thin site" profile that gets
applications rejected and live accounts suspended.

**F1, F2 and F3 are not SEO hygiene. They are the gate on the $120,000.** Fix them first
and the marketing budget unlocks; skip them and no amount of campaign work compensates.

---

## 5. Priorities

| P | Work | Why now |
| --- | --- | --- |
| **P0** | Restore hosting on infrastructure you control | Everything is downstream; index decay is running |
| **P1** | Make the five sections real routes, each with its own prerendered HTML and a correct self-referencing canonical | Turns 1 indexable page into 6; unblocks Ad Grants |
| **P2** | Per-language URLs with reciprocal `hreflang` + `x-default` | Turns 6 pages into per-language landing pages across 14 languages |
| **P3** | Resolve F5 — ship real audio + RSS, or drop the podcast claim | Either opens podcast directories or removes a false assertion |
| **P4** | Then market: Ad Grants campaigns, partnerships, app stores | Only now does spend convert |

### On P0 — hosting

This repo already deploys to Cloud Run (`united-planet-485003-n7`, `us-central1`) with a
proven no-traffic-candidate → health-gate → `update-traffic --to-latest` promotion
pattern in `deploy.sh`. UHR is a static SPA plus a small API — it would run on the same
pattern as its **own** service at `--min-instances 0`.

The standing recommendation from #56 holds and is reinforced by F7: **separate repo,
separate Cloud Run service, same GCP project.** A public consumer radio product must not
share a runtime or database with the PHI-bearing PHR.

Because the mirror repo cannot be attached here, the practical route is a session started
against `tabulamedica246-web/health-radio-fm`, migrating F6's couplings as the first
commits.

---

## 6. Open questions

1. **Is healonda.com still under your control at the registrar?** Unanswered since #56
   and still gating P0.
2. **Where should UHR live** — the existing mirror repo, or a fresh one?
3. **F7 brand collision** — is playbook "UHR" this product or a different one?
4. **F5** — real audio and an RSS feed, or drop the podcast framing?
