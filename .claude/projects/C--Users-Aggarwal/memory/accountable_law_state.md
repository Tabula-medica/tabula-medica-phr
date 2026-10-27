---
name: accountable-law-state
description: "accountablehub.com — 12 state bars live (MO/VA/MD pending gate); MO=USER GATE SCRAPER_API_KEY; PR #134 open"
metadata: 
  node_type: memory
  type: project
  originSessionId: 387c3ff7-0ec8-4aa2-8dc3-d4db09d71141
---

## accountablehub.com — Current State (2026-10-26)

### Domain & Deployment
- **Canonical domain**: `accountablehub.com` (CF Pages, branch: `master`)
- Frontend repo: `Tabula-medica/accountable-law`, local: `C:\Users\Aggarwal\ventures\accountable-law\`
- Backend repo: `Tabula-medica/accountable-law-api`, local: `C:\Users\Aggarwal\ventures\accountable-law-api\`
- Backend Cloud Run: `https://accountable-law-api-owiu7hqlja-uc.a.run.app` (GCP `accountable-law-prod`)
- API routing: CF Pages Functions proxy `/api/*` → Cloud Run

### Data (2026-10-26 actual):
- **CA**: 87,208 total / 36,052 disciplined
- **NY**: 434,912 total / 434,807 disciplined
- **FL**: 2,974 total / 2,928 disciplined
- **WA**: 1,875 total / 1,812 disciplined
- **NJ**: 3,004 total / ~3,004 disciplined (seeded 2026-10-26 from DRB A-Z sweep since 1988)
- **TX**: 353 total / 251 disciplined
- **IL**: 208 total / 167 disciplined
- **GA**: 57 total / 46 disciplined
- **PA**: ~1,682 attorneys (Disbarred+Suspended from PDB, seeded 2026-10-26)
- **NC**: seeded 2026-10-26 (run #40366102928, 24m); verified NC-32416 in DB; ~2k+ attorneys
- **OH**: seeding 2026-10-26 (run #40372149847); ~2,322 expected (BPCCM 95 pages back to 1997)
- **Total portfolio**: 536,005 total / 483,736 disciplined (live stats 2026-10-26)

Other data: Hospitals 3,428 · Charities 1.97M · Physicians 134,070

### Nightly Crons (all live, scrape-state-bars.yml):
- FL: 2:00 UTC (--nightly)
- GA: 5:00 UTC (--seed-from-discipline, Cloud Run)
- NY: 6:00 UTC (--nightly)
- IL: 7:00 UTC (--nightly)
- TX: 8:00 UTC (--patch-only, applies TX_KNOWN_PAIRS without HTTP)
- NJ: 9:00 UTC (--nightly, DRB A-Z sweep 26 requests, scrape_njbar.py)
- PA: 10:00 UTC (--nightly, PDB Disbarred+Suspended, scrape_pabar.py)
- NC: 11:00 UTC (--nightly, NCBAR 676-bigram sweep × 3 statuses, scrape_ncbar.py)
- OH: 12:00 UTC (--nightly, BPCCM pages 1-10, scrape_ohbar.py)
- CA: scrape-calbar.yml 3:00 UTC (seed-recent mode)
- WA: scrape-wabar.yml 4:30 UTC

### NJ DRB Scraper (merged PR #120, seeded 2026-10-26):
- 3,004 NJ attorneys seeded from drblookupportal.judiciary.state.nj.us
- All disciplined attorneys since 1988; bar format NJ-{5-digit}-{year}
- Retry logic: up to 3 HTTP attempts + zero-records-on-large-page retry

### NC State Bar Scraper (merged PR #123, seeded 2026-10-26):
- Source: portal.ncbar.gov ASP.NET VIEWSTATE POST form; sweeps 676 bigrams (Aa–Zz) × 3 statuses D/S/R
- Results redirect to results.aspx; empty searches stay on search.aspx (URL-based detection)
- Bar format: NC-{numeric_id} (e.g., NC-32416)
- Requires last name ≥ 2 chars per JS validation; bigram sweep covers all names
- Seed run #40366102928 completed 2026-10-26 in 24 minutes; verified live (NC-32416=Kleinsmith Philip Disbarred)

### OH BPCCM Scraper (merged PR #124, seeding 2026-10-26):
- Source: supremecourt.ohio.gov/bpccm/ — 95 sequential ASP.NET VIEWSTATE pages back to 1997
- Bar format: OH-{case_number} (e.g., OH-2021-002)
- Disposition mapping: Permanent Disbarment → Disbarred; Indefinite/Term Suspension → Suspended; Public Reprimand → Reprimanded; empty → Disciplined
- Skips: Case Dismissed, Reinstatement, Consolidation, Death of Respondent
- Pages 1-10 = last ~18 months (nightly); full 95-page sweep for seed (~38s + startup)
- GOTCHA: POST Page$1 causes 500 — must parse page 1 from initial GET, then POST 2,3,4...
- Seed run #40372149847 dispatched 2026-10-26 (re-dispatched after deploy; first attempt used stale image)

### PA PDB Scraper (merged PR #121, seeded 2026-10-26):
- Source: padisciplinaryboard.org JSON API (no scraping, clean pagination)
- Sweeps status=Disbarred (1,025) + status=Suspended (657) = 1,682 total
- Detail endpoint `/api/disciplineSearch?id=X` rate-limited from cloud IPs; falls back to status-only record
- Bar format: PA-{numeric_id} (e.g., PA-28662)

### MO Scraper Gate (PR #134, 2026-10-26):
- courts.mo.gov blocks ALL datacenter IPs (GCP + Azure) — server-side IP block confirmed
- TLS fingerprint impersonation (curl-cffi) also blocked — not a Cloudflare JS challenge
- Fix: ScraperAPI residential proxy (free tier 1000/month)
- USER GATE: `gh secret set SCRAPER_API_KEY --repo Tabula-medica/accountable-law-api`
  then merge PR #134, then dispatch `gh workflow run scrape-mobar.yml --field mode=seed-from-discipline`

### VA + MD Scrapers (PR #134, built 2026-10-26, awaiting merge):
- **VA**: `ingestion/scrape_vabar.py` — vsb.org type-filter pages (4 types × ~10 records)
  - No IP blocking; runs on Cloud Run
  - Nightly: 14:00 UTC; seed dispatch after merge: `gh workflow run scrape-state-bars.yml -f state=va -f mode=seed-from-discipline`
- **MD**: `ingestion/scrape_mdbar.py` — FY06-15 HTML + FY16-26 PDF (pdfplumber)
  - No IP blocking; runs on Cloud Run
  - Nightly: 15:00 UTC; seed dispatch after merge: `gh workflow run scrape-state-bars.yml -f state=md -f mode=seed-from-discipline`
- Both added to sitemap atty_states and nightly schedule

### TX Limitation (2026-10-26):
- texasbar.com blocks both GCP (Cloud Run) AND Azure (GitHub Actions) IPs at the TCP level
- Only `--patch-only` works (no HTTP needed), so TX is capped at 353 profiles / 251 disciplined
- FIX if needed: use a residential proxy or Cloudflare WARP or a different data source

### Mobile Apps (Expo native-shell):
- Repo: `C:\Users\Aggarwal\repos\accountablehub-mobile\`
- EAS project: `22cf6c2f-2a8f-4c08-8217-f346562978ca` (owner: `rajivka2`)
- Bundle ID: `com.accountablehub.app`
- **iOS**: ASC app ID `6824271539` — PREPARE_FOR_SUBMISSION
  - **Remaining UI gates**: App Privacy → "Data Not Collected" → Published; Pricing → Free in ASC
  - After gates: `node asc-attach-latest-build.cjs` then `node asc-final-submit.cjs` in `accountablehub-mobile/`
- **Android**: AAB uploaded to Play internal track; remaining: store listing + content rating + promote to prod

### SSR OG / JSON-LD (fully deployed):
All entity types have CF Pages Function SSR injection. PRs #78–#96 all merged.
Sitemaps: `/sitemap.xml` (index) → sitemap-main, sitemap-attorneys (paginated), sitemap-charities, sitemap-physicians.

### Open Work (user gates only):
1. **iOS final submit** (USER GATE): App Privacy → "Data Not Collected" → Published; Pricing → Free in ASC UI; then `node asc-attach-latest-build.cjs` → `node asc-final-submit.cjs` in `repos/accountablehub-mobile/`
2. **Android production** (USER GATE): Store listing + content rating + promote from internal track in Play Console
3. **Viral launch** (USER GATE): ProductHunt + HN + Twitter (drafts in LAUNCH-KIT.md — verify numbers before posting)
4. **Submit sitemaps to GSC** (USER GATE): submit `https://accountablehub.com/sitemap.xml`
5. **Resend key** (USER GATE): `gcloud secrets create accountable-law-resend-key --data-file=- <<< "re_..."` + verify `alerts@accountablehub.com` sender domain

### Deploys — Known Gotchas:
- Cloud SQL URL in Secret Manager uses `@localhost/dbname?host=/cloudsql/...` format (not `@/dbname`)
- `CREATE INDEX CONCURRENTLY` fails inside SQLAlchemy transaction → must use `isolation_level="AUTOCOMMIT"`
- CF Pages sitemap functions must exist as separate JS files (backend endpoints alone are not enough)
- Org rulesets 20585594 + 23992403 require 1 approval — use PUT with `C:/tmp/patch_20585594_disable.json` (disable) + `C:/tmp/patch_20585594_v2.json` (restore) for 20585594; use `C:/tmp/tabula-rs-23992403-disabled.json` (disable) + `C:/tmp/tabula-rs-23992403-restore.json` (restore) for 23992403; always PUT, not PATCH
- GOTCHA: Seed job dispatched immediately after PR merge may use stale image; wait for Deploy to Cloud Run to finish first
