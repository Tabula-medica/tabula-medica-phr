# Tabula Medica PHR — Enhancement Roadmap (2026-06-24)

Grounded in the current repo. The app already has: rich meta/OG/Twitter tags, a
dynamic `useSEO` hook + JSON-LD, `sitemap.xml`, `robots.txt`, `manifest.json`,
Bing verification, 4 CI workflows (CI, SOC2-deploy, iOS-submit, PR-security), and
full Capacitor + EAS mobile setup. So this is **enhancement, not greenfield.**

Priorities: **P0** = do before/at launch · **P1** = soon after · **P2** = ongoing.

---

## 0. HONEST CORRECTION — "Google Cloud → better ranking"
Hosting on Google Cloud does **NOT** give you preferential Google Search ranking —
Google has stated hosting provider/location is not a ranking factor. **But** being on
GCP *does* help marketing, indirectly and really:
- **Core Web Vitals** (a real ranking factor): Cloud Run + Cloud CDN = fast TTFB/LCP.
- **Frictionless Google toolchain:** Search Console, Analytics 4, Tag Manager,
  PageSpeed Insights, Merchant/Business Profile all plug in with no infra work.
- **AI/Translation/Speech** on Vertex for the product itself (BAA-covered).
So: lean into **speed + Google's marketing toolchain**, not imagined ranking favoritism.

---

## 1. CONTENT — the biggest organic lever (E-E-A-T / YMYL) · P0
Health content is **"Your Money or Your Life"** — Google holds it to the highest
**E-E-A-T** bar (Experience, Expertise, Authoritativeness, Trust). This matters more
than any technical tweak for a health PHR.
- **Medical review byline** on every health/content page: "Medically reviewed by
  [name, credential], [date]." Add author/reviewer entities + dates.
- **Citations** to primary sources (CDC, NIH, peer-reviewed) inline.
- **Expand the existing content hub** (`/learn`, `/insurance-learning`,
  `/uninsured-resources`, `/symptom-checker`): turn into authoritative, cited,
  regularly-updated articles. This is what AI engines and Google both reward.
- Keep the **NO-CDS** framing (informational, not diagnosis) — consistent with the
  product's regulatory posture.

## 2. AEO — Answer Engine Optimization (ChatGPT/Perplexity/Google AI Overviews) · P1
Getting *cited* by AI answer engines. Currently **missing**:
- **`llms.txt`** at site root (you don't have one in the real repo) — a concise,
  structured map of what Tabula Medica is + key pages, for LLM crawlers.
- **FAQPage JSON-LD** on content pages (direct Q&A blocks AI engines lift verbatim).
- **Concise factual answer blocks** (40–60 words) near the top of each article.
- **Entity clarity:** consistent "Tabula Medica is a [patient-controlled PHR that…]"
  definition + `SameAs` links (LinkedIn, Crunchbase, etc.) in Organization schema.

## 3. GEO — Generative Engine Optimization + geo-targeting · P1
Two senses, both relevant here:
- **Generative Engine Optimization:** statistics, quotable claims, structured data,
  clean semantic HTML, and authoritativeness → makes you the source generative models
  cite. (Heavy overlap with §1–2.)
- **Geo-targeting for the `.us`/`.world` split:** add **`hreflang`** tags
  (`en-us` → `.us`, `x-default`/`en` → `.world`) + **per-host canonical** (today
  canonical is hardcoded to `.health` — must become host-aware or `.us`/`.world`
  pages self-canonicalize wrong and split ranking).

## 4. SEO — technical polish on a strong base · P1
- **Per-host canonical + sitemap** (the hardcoded `.health` canonical is the #1 SEO
  bug for the multi-domain split).
- **Expand JSON-LD types:** `MedicalOrganization`, `SoftwareApplication` (for the
  app), `FAQPage`, `BreadcrumbList`, `WebSite` + Sitelinks SearchBox.
- **Submit sitemaps** to Google Search Console + Bing (Bing token already in `<head>`).
- **Image SEO + alt text**, lazy-loading, `og:image` per page (currently one global).
- **Core Web Vitals budget** (see CI below).

## 5. UI/UX · P1
(Stack = React + Radix/shadcn + Tailwind — modern, good base.)
- **Accessibility (WCAG 2.2 AA)** — legally + ethically important for a health app;
  also an SEO signal. Run axe/Lighthouse a11y; fix contrast, focus, labels, ARIA.
- **Patient-reported provenance display** (from strategy): patient-entered data shown
  **blue AND labeled "patient-reported"** (color not sole signal; survive
  color-blind + print) until clinician-reconciled.
- **Onboarding flow** for first-time record connection (Fasten/Apple Health) — the
  highest-drop-off moment; make it dead simple.
- **Mobile parity** since the same build ships via Capacitor — test touch targets,
  safe areas, offline states.

## 6. CI/CD — harden + automate · P1
You have CI + SOC2 deploy. Add:
- **Cloud Build trigger** auto-deploy on push to `main` (de-risks manual deploys; the
  trigger infra already exists). Target the **live service `tabula-medica-phr`** (note:
  configs historically pointed at `tabula-medica-backend`/`tabula-medica-web` — reconcile).
- **Dependency-presence guard** (prevents the `Cannot find module 'express'` /
  prod-prune class of boot bug that just bit us): a post-build smoke test that the
  image actually boots + `/health` 200 before promote.
- **Lighthouse CI** with perf/a11y/SEO budgets → fail PRs that regress Core Web Vitals.
- **Preview environments** per PR (Cloud Run tagged revisions) for review.
- **Pin the AI provider check** → enforce **Vertex-only** (no OpenAI) before real-PHI launch.

## 7. APP STORE LAUNCH — iOS + Android · P0 for mobile
Infra exists (`capacitor.config.ts`, `app.json`, `eas.json`, `ANDROID_DATA_SAFETY.md`,
`MOBILE_BUILD.md`, `mobile-ios-submit.yml`). **Health apps get extra review scrutiny.**

**Both stores need:**
- Public **Privacy Policy** + **in-app account deletion** (Google *requires* it; Apple too).
- **Data Safety (Google)** / **Privacy Nutrition Labels (Apple)** — declare health-data
  collection/use accurately (`ANDROID_DATA_SAFETY.md` is a start).
- **ASO:** title, subtitle, keyword field, screenshots (6.7"/5.5" iPhone, iPad,
  Android phone/tablet), feature graphic, preview video.
- No medical **diagnosis/treatment claims** in listing (keep NO-CDS framing).

**iOS specifics:** Apple Developer Program ($99/yr), App Store Connect record,
TestFlight beta, **macOS required** for the build/submit (EAS/Xcode). Health apps:
expect questions on data handling + intended use.

**Android specifics:** Play Console ($25 one-time), **Health apps declaration**,
closed → open testing track, Data Safety form, target API level compliance.

**Sequence:** TestFlight / Play closed-testing first → fix → phased public rollout.

---

## Suggested order
1. **P0 content E-E-A-T + per-host canonical/hreflang** (unblocks the multi-domain SEO).
2. **P0 app-store privacy/account-deletion + data-safety** (gating for store review).
3. **P1 AEO (llms.txt + FAQPage) + JSON-LD expansion.**
4. **P1 CI/CD smoke-test guard + Lighthouse budgets + Vertex-only gate.**
5. **P1 a11y + onboarding + provenance UI.**

## What needs a build env vs doable from here
- **From here (Windows):** write `llms.txt`, sitemap/canonical/hreflang fixes, JSON-LD
  additions, robots, content drafts, CI YAML edits — all source edits.
- **Build env / Mac:** Lighthouse runs, EAS iOS build + TestFlight, a11y runtime audit.
