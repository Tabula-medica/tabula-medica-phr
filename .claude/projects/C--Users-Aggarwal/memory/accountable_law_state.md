---
name: accountable-law-state
description: "accountablehub.com — full SEO/SSR suite shipped; iOS+Android user gates; CA migrate pending fix"
metadata: 
  node_type: memory
  type: project
  originSessionId: 387c3ff7-0ec8-4aa2-8dc3-d4db09d71141
---

## accountablehub.com — Current State (2026-10-22)

### Domain & Deployment
- **Canonical domain**: `accountablehub.com` (CF Pages, branch: `master`)
- Frontend repo: `Tabula-medica/accountable-law`, local: `C:\Users\Aggarwal\ventures\accountable-law\`
- Backend repo: `Tabula-medica/accountable-law-api`, local: `C:\Users\Aggarwal\ventures\accountable-law-api\`
- Backend Cloud Run: `https://accountable-law-api-owiu7hqlja-uc.a.run.app` (GCP `accountable-law-prod`)
- API routing: CF Pages Functions proxy `/api/*` → Cloud Run

### Mobile Apps (Expo native-shell)
- Repo: `C:\Users\Aggarwal\repos\accountablehub-mobile\`
- EAS project: `22cf6c2f-2a8f-4c08-8217-f346562978ca` (owner: `rajivka2`)
- Bundle ID: `com.accountablehub.app`
- **iOS**: ASC app ID `6824271539` — PREPARE_FOR_SUBMISSION
  - **Remaining UI gates**: App Privacy → "Data Not Collected" → Published; Pricing → Free in ASC
  - After gates: `node asc-attach-latest-build.cjs` then `node asc-final-submit.cjs` in `accountablehub-mobile/`
- **Android**: AAB uploaded to Play internal track; remaining: store listing + content rating + promote to prod

### SSR OG / JSON-LD (fully deployed 2026-10-22):
All entity types have CF Pages Function SSR injection. PRs #78–#96 all merged.

| Path | Function | Schema type | Notes |
|---|---|---|---|
| `/attorney/?bar=` | `functions/attorney/index.js` | LegalService + BreadcrumbList | sameAs=calbar.ca.gov for CA |
| `/attorney/?state=XX` | same | BreadcrumbList | Leaderboard title with count |
| `/hospital/?ccn=` | `functions/hospital/index.js` | Hospital + BreadcrumbList | sameAs=medicare.gov Care Compare |
| `/charity/?ein=` | `functions/charity/index.js` | NGO/Organization + BreadcrumbList | sameAs=ProPublica Nonprofit Explorer |
| `/physician/?npi=` | `functions/physician/index.js` | Physician + BreadcrumbList | sameAs=NPI Registry |
| `/worst-hospitals/?state=XX` | `functions/worst-hospitals/index.js` | ItemList + BreadcrumbList | PR #91 |
| `/compare/?a=CCN1&b=CCN2` | `functions/compare/index.js` | OG comparison title | PR #92 |

`public/_routes.json` includes: `/api/*`, `/sitemap*`, `/attorney/`, `/hospital/`, `/charity/`, `/physician/`, `/worst-hospitals/`, `/compare/`

### Sitemaps (live, all 4 working):
- `/sitemap.xml` → index pointing to 4 child sitemaps (FIXED: was only listing 2)
- `/sitemap-main.xml`: static pages + 50 state hospital pages + 28-state×3-filter attorney leaderboards
- `/sitemap-attorneys.xml`: top 49,990 disciplined attorneys
- `/sitemap-charities.xml`: top 49,990 charities by accountability_score + revenue_amount (backend PR #81 added route)
- `/sitemap-physicians.xml`: top 49,990 physicians by total_services (backend PR #81 added route)
- `robots.txt`: `Sitemap` + `Disallow: /api/` (PR #94)

### SEO Improvements (sessions through 2026-10-22):
- Homepage: `WebSite` Schema.org JSON-LD, stat fallbacks corrected (PRs #84, #89)
- All entity JSON-LD: `sameAs` links — hospital→CMS Care Compare, charity→ProPublica, physician→NPI Registry (PR #93)
- Listing pages: physician title+description updated with 134k count; attorney updated 240k→246k (PR #94)
- Listing pages: charity/hospital default meta descriptions improved (PR #88)
- Programs pages: all 5 now have complete og:title, og:description, og:type, og:url, twitter:card, canonical (PR #96)
- Programs index: title+description updated with specific program names and dollar figures (PR #95)
- LAUNCH-KIT.md: tweet #3 updated 1.96M→1.97M (PR #86)
- Custom 404 page: `public/404.html` with navigation links, noindex (PR #90)

### Data (2026-10-22):
- Hospitals: 3,428 · Charities: 1.97M · Physicians: 134,070
- CA attorneys: 67,553 total / 27,574 disciplined / 4,879 suspended
- Total portfolio: ~246,579 attorneys

### CA Range Scan + Migrate Status: COMPLETE ✅
- `mode=migrate` run 39871880132 completed successfully 2026-10-22 ~23:30 UTC (execution `scrape-calbar-9vdc2`)
- Indexes `ix_attorneys_state_disc` + `ix_attorneys_disc_global` created CONCURRENTLY
- fix-state SQL ran (sets state='CA' for CA bar numbers)
- **Bug fixed**: `CREATE INDEX CONCURRENTLY` requires AUTOCOMMIT — fixed in `ingestion/scrape_calbar.py` (PR #80)

### Launch Kit (LAUNCH-KIT.md in frontend repo root):
- ProductHunt, HN Show HN, Twitter thread (10 tweets), Reddit drafts — all updated with current stats
- **User gate before posting**: verify specific numbers against live API first

### Open Work:
1. **iOS final submit** (USER GATE): App Privacy → "Data Not Collected" → Published; Pricing → Free in ASC UI; then `node asc-attach-latest-build.cjs` → `node asc-final-submit.cjs` in `repos/accountablehub-mobile/`
2. **Android production** (USER GATE): Store listing + content rating + promote from internal track in Play Console
3. **Viral launch** (USER GATE): ProductHunt + HN + Twitter (drafts in LAUNCH-KIT.md — review numbers before posting)
4. **Submit sitemaps to Google Search Console** (USER GATE — requires GSC access): submit `https://accountablehub.com/sitemap.xml`

### Scraper Crons (live):
- CA: `scrape-calbar.yml` 3:00 UTC nightly (seed-recent mode)
- WA: `scrape-wabar.yml` 4:30 UTC nightly

### Deploys — Known Gotchas:
- `CREATE INDEX CONCURRENTLY` fails inside SQLAlchemy transaction → must use `isolation_level="AUTOCOMMIT"`
- CF Pages sitemap functions must exist as separate JS files (backend endpoints alone are not enough)
- Cloud Run Job uses same `api:latest` image as Cloud Run Service — wait for deploy to finish before triggering migrate
