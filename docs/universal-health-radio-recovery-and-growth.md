# Universal Health Radio (healonda.com) — recovery and growth plan

**Supersedes `docs/health-radio-rebuild-spec.md`** (merged in #56), which was written
before the source could be read and is wrong in its central claims.

**Revision note (2026-09-26):** an earlier draft of *this* document claimed the five
section URLs had no routes and that canonicals collapsed onto the homepage. Both were
wrong — inferred from a stale snapshot before `App.tsx`, `main.tsx`, `vite.config.ts` and
`scripts/prerender.mjs` had been read. Routing and per-route prerendering both exist.
Corrected findings below are verified against the current source.

---

## 1. Correction to the merged spec (#56)

| #56 claimed | Actually true |
| --- | --- |
| Source is unrecoverable | **Fully readable** in the Replit workspace |
| No backup exists | **GitHub mirror** — `tabulamedica246-web/health-radio-fm`, auto-pushed as `health-radio-fm-src.zip` |
| Must be rebuilt from scratch | **Nothing needs rebuilding** — mature pnpm monorepo |
| A directory of third-party streams | **Zero streaming.** Segments are spoken on-device via TTS |

Still true: **the deployment is `suspended`** (`0fa6e83e-897f-49f2-9ec6-96435f691935`), so
healonda.com serves nothing. The domain itself is confirmed held at an independent
registrar, so the Cloud Run domain-mapping path below is viable.

---

## 2. What the product is

**Universal Health Radio** is the `web` artifact at healonda.com — React + Vite, wouter
routing, Clerk-gated admin. Its Expo sibling is **Health Radio FM**.

A low-data multilingual health radio: clinician-reviewed WHO/CDC/FDA segments read aloud
by the device's own text-to-speech, **no audio ever streamed**, with synced subtitles in
each region's language. 14 stations (Urdu and Arabic right-to-left). Content passes a
six-step gate ending in a hard clinician sign-off — no signature, no broadcast.

Public sections, from `App.tsx`: `/listen`, `/talk`, `/ask`, `/kids`, `/classroom`,
`/how-we-verify`, plus a private `/admin`.

**What already works** (credit where due — these are done, not to-do):

- Real client-side routes via `<Router base="/web">`, with `tabFromPath` mapping.
- Per-route `<title>`, `<meta description>` and a self-referencing canonical set at
  runtime (`canonical.setAttribute("href", window.location.href)`).
- A post-build prerender script emitting `dist/public/<slug>/index.html` per route.
- Substantial JSON-LD (`Organization`, `WebSite`, `MedicalWebPage` with `reviewedBy`).
- Native-script crawlable content for Hindi, Swahili, and both Chinese scripts.
- `robots.txt`, `llms.txt`, a skip-link, and a `<noscript>` fallback.

---

## 3. Verified findings

### F1 — The site is offline (blocker)

Nothing else matters until healonda.com serves traffic, and the cost compounds: sustained
downtime gets pages dropped from the index, so the real SEO work already shipped decays
the longer this runs.

### F2 — The prerender silently substitutes nothing (highest-value fix)

`scripts/prerender.mjs` swaps route body content with:

```js
html = replaceFirst(html, /<section[^>]*id="uhr-static"[\s\S]*?<\/section>/, route.content.trim());
```

But `index.html`'s static block is `<main id="main-content" …>`. **There is no
`<section id="uhr-static">` anywhere in the template.** `String.prototype.replace` with a
non-matching pattern returns the string unchanged, so:

- Every `dist/public/<slug>/index.html` ships the **homepage body**, not its route content.
- Only the `<head>` differs, giving six URLs with distinct titles and near-identical
  bodies — textbook duplicate content.
- The genuinely good per-route copy in that script (the 14-station frequency list, the
  six-step process, Ask's example questions) **has never reached production**.
- It fails silently: the loop still prints `✓ /web/listen` and
  `Prerender complete — 5 routes written`.

`App.tsx` also calls `document.getElementById("uhr-static")` to strip the hero — also a
no-op, though harmless, since `createRoot().render()` replaces `#root`'s children anyway.

### F3 — `REPLIT_DOMAINS` gates canonical URLs *and* the entire sitemap

In `vite.config.ts`, both plugins bail early:

```js
const domains = process.env.REPLIT_DOMAINS;
if (!domains) return;        // injectCanonicalUrls — and generateSitemap
```

Off Replit that variable is unset, so on Cloud Run the build produces:

- `sitemap.xml` **never generated** (the committed `public/sitemap.xml` is a
  self-described dev placeholder with root-relative `<loc>` values — invalid; `<loc>`
  must be absolute).
- `robots.txt` still containing the literal `__SITEMAP_URL__`.
- `__CANONICAL_URL__`, `__OG_IMAGE_URL__`, `__LOGO_URL__` left as literal placeholders in
  the served HTML. The inline script repairs them for browsers, but crawlers and social
  scrapers reading raw HTML see the placeholder text.

This is the single biggest migration trap: the build "succeeds" and quietly ships broken
metadata.

### F4 — `og:url` becomes relative in prerendered routes

`prerender.mjs` writes `<meta property="og:url" content="/web/listen">`. Open Graph
requires an absolute URL; relative values break link previews. (A relative `<link
rel="canonical">` is legal and resolves correctly, so that one is cosmetic — `og:url` is
not.)

### F5 — Classroom is invisible

`/classroom` is a real public route with its own `TAB_META`, but it appears in **neither**
the `generateSitemap` page list, **nor** `prerender.mjs`'s `ROUTES`, **nor** the crawlable
`<nav>` in `index.html`. An entire section is unreachable for crawlers.

### F6 — No hreflang

There is no `rel="alternate" hreflang="…"` anywhere. `og:locale:alternate` is Open Graph
and does not drive search language targeting. Fourteen languages of content therefore
compete on one set of URLs with no per-language signal.

### F7 — `PodcastSeries` schema with no podcast

The JSON-LD declares a `PodcastSeries` with genres like "Mental Health Podcast", and the
page keywords lean hard on podcast terms. But the product's defining feature is on-device
synthesis: there are **no audio files and no RSS feed**. Apple Podcasts and Spotify both
require an RSS feed with enclosures, so it cannot be listed — and the markup asserts a
format that does not exist. Either ship real audio plus a feed, or drop the claim.

### F8 — `/admin` is crawlable

`robots.txt` is `Allow: /` with no exclusions, and the global robots meta is
`index, follow`. The Clerk sign-in and sign-up pages at `/admin/sign-in` and
`/admin/sign-up` are therefore indexable. Add a `Disallow`.

### F9 — Governance flags (decide deliberately)

- **Brand collision.** `NONPROFIT_AND_FREE_MARKETING_PLAYBOOK.md` §6 lists "UHR — health
  records" as one of four brands. This is a *radio* product. Either two things share an
  acronym or the playbook mislabels one — and Ad Grants campaign structure and the 1023
  narrative are both built per brand.
- **Ask and the AI boundary.** This repo's `CLAUDE.md` forbids Anthropic/OpenAI for
  PHI-bearing calls. Ask is public health Q&A rather than records, so the rule arguably
  does not bind it — but listeners will type personal symptoms into a free-text box.
  Decide the boundary explicitly and write it down.

---

## 4. Why this gates the marketing budget

The nonprofit playbook budgets **$120,000/yr in Google Ad Grants** as the primary engine,
and warns that *"thin sites are the top cause of Ad Grants rejection."* Ad Grants also
requires a working site, conversion tracking, and ≥5% CTR.

A domain serving nothing fails outright (F1). Six URLs sharing one body (F2) plus missing
canonical and sitemap metadata (F3) is the thin-duplicate profile that gets applications
rejected and live accounts suspended. **F1–F3 are the gate on the $120k**, not SEO
hygiene. Nothing about campaign craft compensates for them.

---

## 5. Priorities

| P | Work | Findings |
| --- | --- | --- |
| **P0** | Restore hosting on infrastructure you control | F1 |
| **P1** | Fix the prerender substitution; make the build host-agnostic | F2, F3, F4 |
| **P2** | Add Classroom everywhere; add hreflang; `Disallow: /admin` | F5, F6, F8 |
| **P3** | Resolve the podcast claim — real audio + RSS, or drop it | F7 |
| **P4** | Then market: Ad Grants campaigns, partnerships, app stores | — |

### P0 — hosting

This repo already deploys to Cloud Run (`united-planet-485003-n7`, `us-central1`) with a
proven no-traffic-candidate → health-gate → `update-traffic --to-latest` promotion in
`deploy.sh`. UHR is a static SPA plus a small API: same pattern, its **own** service,
`--min-instances 0`, then a Cloud Run domain mapping for `healonda.com` and `www`, and
DNS repointed at the registrar.

**Keep it separate from the PHR** — separate repo, separate service, same GCP project. A
public consumer radio product must not share a runtime or database with the PHI-bearing
PHR, which attaches the Cloud SQL PHI instance and runs medical-safety gates per deploy.

Because `add_repo` refuses cross-owner adds (`tabulamedica246-web` vs `tabula-medica`),
the practical route is a session started against the mirror repo.

---

## 6. Appendix — the P1/P2 patch

Precise changes against `artifacts/web`. Each is small and independently testable.

### A. Fix the prerender regex (F2)

In `scripts/prerender.mjs`, the `section()` helper emits
`<section id="uhr-static">…</section>` while the template carries
`<main id="main-content">…</main>`. Align them and **fail loudly** rather than silently:

```js
// Match the template's actual static block.
const STATIC_BLOCK = /<main[^>]*id="main-content"[\s\S]*?<\/main>/;

const before = html;
html = html.replace(STATIC_BLOCK, route.content.trim());
if (html === before) {
  console.error(`ERROR: static block not found for /${route.slug} — nothing substituted.`);
  process.exit(1);
}
```

And change `section()` to wrap in `<main id="main-content" …>` so the emitted route
content keeps the skip-link target and landmark role that `index.html` relies on.

Verify after building: `grep -c "14 regional stations" dist/public/listen/index.html`
should be `1`, and the string must be **absent** from `dist/public/index.html`.

### B. Make the build host-agnostic (F3, F4)

Replace the `REPLIT_DOMAINS` lookups with an explicit origin, falling back to the Replit
value so nothing breaks while still on Replit:

```js
function siteOrigin() {
  if (process.env.SITE_ORIGIN) return process.env.SITE_ORIGIN.replace(/\/$/, "");
  const domains = process.env.REPLIT_DOMAINS;
  if (domains) return `https://${domains.split(",")[0].trim()}`;
  return null;
}
```

Then in both plugins, fail the build rather than silently skipping:

```js
const origin = siteOrigin();
if (!origin) throw new Error("SITE_ORIGIN (or REPLIT_DOMAINS) is required to emit canonical URLs and sitemap.xml");
```

Set `SITE_ORIGIN=https://healonda.com` in the Cloud Run build. Pass the same value into
`prerender.mjs` and make its `canonical` and `og:url` absolute
(`${origin}/web/${slug}`) — `og:url` must not be relative.

### C. Add Classroom (F5)

Three places, all easy to miss independently — which is why it went missing:

1. `vite.config.ts` → `generateSitemap` pages: `{ path: "classroom", changefreq: "monthly", priority: "0.7" }`
2. `scripts/prerender.mjs` → a `ROUTES` entry with its own copy
3. `index.html` → a nav `<li>` and a content `<section>`, matching the other five

### D. hreflang (F6)

Emit reciprocal annotations on every prerendered page, one per served language plus
`x-default`. These must be mutual — each URL lists all alternates including itself — or
Google ignores the set.

### E. `Disallow: /admin` (F8)

In `public/robots.txt`, above the `Sitemap:` line:

```
Disallow: /web/admin
Disallow: /web/admin/
```

---

## 7. Open questions

1. **Where should UHR live** — the existing mirror repo, or a fresh one?
2. **F9 brand collision** — is playbook "UHR" this product or a different one?
3. **F7** — real audio and an RSS feed, or drop the podcast framing?
4. Was the `uhr-static` / `main-content` mismatch a rename that missed two call sites?
   If so, check whether anything else referenced the old id.
