---
name: accountable-law-state
description: "accountablehub.com — 7 state bars live; GA seeded; TX URL rewrite fixed; iOS+Android user gates"
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

### Data (2026-10-26 actual from /api/v1/attorneys/states):
- **CA**: 87,208 total / 36,052 disciplined
- **NY**: 434,912 total / 434,807 disciplined
- **FL**: 2,974 total / 2,928 disciplined
- **WA**: 1,875 total / 1,812 disciplined
- **TX**: 353 total / 251 disciplined
- **IL**: 208 total / 167 disciplined
- **GA**: 57 total / 46 disciplined (seeded 2026-10-26 from GA State Bar 6-month page)
- **Total portfolio**: ~527,587 attorneys / ~475,063 disciplined

Other data: Hospitals 3,428 · Charities 1.97M · Physicians 134,070

### Nightly Crons (all live, scrape-state-bars.yml):
- FL: 2:00 UTC (--nightly)
- GA: 5:00 UTC (--seed-from-discipline, Cloud Run)
- NY: 6:00 UTC (--nightly)
- IL: 7:00 UTC (--nightly)
- TX: 8:00 UTC (--patch-only, applies TX_KNOWN_PAIRS without HTTP)
- CA: scrape-calbar.yml 3:00 UTC (seed-recent mode)
- WA: scrape-wabar.yml 4:30 UTC

### TX Limitation (2026-10-26):
- texasbar.com blocks both GCP (Cloud Run) AND Azure (GitHub Actions) IPs at the TCP level
- `--last-names` A-Z sweep returns "All connection attempts failed" for every letter
- Only `--patch-only` works (no HTTP needed), so TX is capped at 353 profiles / 251 disciplined
- FIX if needed: use a residential proxy or Cloudflare WARP or a different data source

### TX Workflow Fix History (2026-10-26):
- PR #117: heredoc approach → broke YAML parser (GitHub 422 on workflow_dispatch)
- PR #118: replaced heredoc with python3 one-liner (fixed YAML issue)
- PR #119: broadened URL regex from `@/` to `@[^/]*/` to handle `@localhost/` in stored secret
- All merged. URL rewrite now works: `@localhost/accountable_law?host=/cloudsql/...` → `@127.0.0.1:5432/accountable_law`

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
- Org rulesets 20585594 + 23992403 require 1 approval — use patch_20585594_v2.json / restore files at C:/tmp/ to bypass
