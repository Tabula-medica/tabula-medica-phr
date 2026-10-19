---
name: energystoragedisease-state
description: "energystoragedisease.com — ESD venture state, repo, mobile app, and store submission gates"
metadata: 
  node_type: memory
  type: project
  originSessionId: c0b33f77-a9b8-4398-baab-1726be78df2d
---

New venture: reframe Type 2 Diabetes as "Energy Storage Disease" (ESD) to shift from symptom-focused to root-cause-focused treatment.

**Why:** Conventional "diabetes" framing misnames the disease (describes overflow symptom, not storage failure). ESD model covers 4 pillars: cellular energy lock, metabolic inflexibility, chronic surplus, mitochondrial dysfunction.

**Repo:** `C:/Users/Aggarwal/repos/energystoragedisease-web/` — React + Vite + TypeScript + Tailwind v3; CF Pages deploy target.

**Site sections (14):** Hero → ProblemSection → EsdFramework → TheCascade → MythsVsTruth → HomaIrCalculator (+ localStorage history tracking, max 10) → ResearchEvidence → LabMarkers → ReversalEvidence → ForWhom (provider card → /for-providers) → **DownloadSection** (App Store + Play Store badges; feature callouts mention history/trend tracking) → **FaqSection** (6-item accordion) → WaitlistSection → Footer.

**Build:** `npm run build` → dist/ — typecheck clean. 26 PRs merged as of 2026-10-19.

**Deploy:** LIVE at `energystoragedisease.com` (apex + www). Command: `npx wrangler pages deploy dist --project-name energystoragedisease`.

**Pages:** Clean URLs (CF Pages auto-strips `.html`): `/privacy` `/terms` `/flyer` `/for-providers` all live. SPA catch-all via `_redirects: /* /index.html 200`. PWA manifest at `/manifest.json`. iOS touch icon at `/apple-touch-icon.png`.

**Waitlist backend:** LIVE — CF Pages Function at `functions/api/subscribe.ts` backed by KV namespace `da94d048cf9a45ce88b096295c286f66` (binding `ESD_WAITLIST`).

**Analytics:** Plausible snippet in index.html (`data-domain="energystoragedisease.com"`). **USER GATE:** Add site at plausible.io to activate.

**SEO:** schema.org `MedicalWebPage` + `HowTo` + `FAQPage` (all 6 questions) + `SoftwareApplication` (both iOS + Android downloadUrl). HOMA-IR thresholds consistent across FAQ/calculator/for-providers (< 1.0 optimal, 5-tier scale). Sitemap excludes noindex pages.

**Mobile app:**
- Repo: `C:/Users/Aggarwal/repos/energystoragedisease-app` → GitHub `Tabula-medica/energystoragedisease-app`
- EAS project: `@rajivka2/energystoragedisease` (ID `b1046181-9d1e-46d5-8335-5a8b48f2fed0`)
- Bundle: `com.energystoragedisease.app` iOS + Android
- Architecture: 3-tab native shell — Overview (native) / HOMA-IR Calculator (native) / Research (WebView)
- **History feature:** 10-entry SecureStore JSON array in `src/lib/config.js` (`loadHistory`/`saveToHistory`). CalculatorScreen shows trend indicator (▼/▲/→) + last 5 history rows. HomeScreen has feature chips including "Trend Tracking". Matches web app localStorage pattern.
- 2 PRs merged: PR#1 (history tracking) + PR#2 (home feature chips)

**iOS App Store (ASC):**
- App ID: `6824261239`, Version ID: `846a0c4c-6d97-4c90-a45e-c3f56704f41f`
- iOS build 7 (buildId `7bead500-3a5f-401f-8dad-19449ad3b1c1`) **FINISHED 2026-10-19 17:09** — IPA ready at EAS
- IPA URL: `https://expo.dev/artifacts/eas/-HfpsEEYYA-OO-q5qOyzw1Py6QSJJk1v53OPDjDPQpk.ipa`
- Age rating questionnaire: COMPLETED via API (ageRatingDeclarations patch) 2026-10-19
- Metadata COMPLETE: Category, Name/Subtitle, Description, Keywords, Screenshots (iPhone 6.5" + iPad 12.9"), Copyright, contentRightsDeclaration, appStoreReviewDetail
- **REMAINING GATES (ASC UI required):**
  1. App Privacy → Data Types (go to appstoreconnect.apple.com/apps/6824261239)
  2. Pricing → Free (UI)
  3. Run: `npx eas submit --platform ios --latest --non-interactive` (submits IPA to ASC; then click Submit for Review)

**Android Play Store:**
- Package: `com.energystoragedisease.app`
- Android build versionCode 4 (buildId `5973ade6-3208-402d-9c2b-ef0df3afb4d7`) **FINISHED 2026-10-19 17:17**
- AAB URL: `https://expo.dev/artifacts/eas/LPTDev8jxj8HvIUnE_TTC85dDB9u25KV0zcjvJvP674.aab`
- Listing text, screenshots, feature graphic uploaded ✓
- **REMAINING GATE:** Run `npx eas submit --platform android --latest --non-interactive` OR manually upload AAB to Play Console → then promote Internal → Production

**Marketing:**
- Flyer: `public/flyer.html` → `energystoragedisease.com/flyer`
- Provider clinical guide: `public/for-providers.html` → `energystoragedisease.com/for-providers`
- NPPES provider list: **84,932 unique providers** → `Desktop\esd-providers-ALL.csv`
- Trevor JFPA review draft: `Desktop\esd-trevor-jfpa-review.md` — READY TO SEND
- Social media post drafts: `Desktop\esd-social-posts.md` — updated for history tracking feature
- Email addresses needing CF Dashboard email routing (all user gates):
  - `opt-out@energystoragedisease.com` (flyer.html opt-out)
  - `info@energystoragedisease.com` (FAQ contact)
  - `hello@energystoragedisease.com` (for-providers.html questions)
  - `privacy@energystoragedisease.com` (privacy page deletion requests)
- Opt-out phone: placeholder `(888) 000-0000` in flyer.html — replace before mass send

**How to apply:** iOS: appstoreconnect.apple.com/apps/6824261239 → App Privacy → Pricing → run `eas submit --platform ios --latest` → Submit for Review. Android: run `eas submit --platform android --latest` then Play Console promote to Production. Fax: Trevor JFPA first. Plausible: add domain. Social: review Desktop\esd-social-posts.md.
