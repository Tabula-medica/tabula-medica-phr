---
name: accountable-law-state
description: "accountablehub.com — 21 live pages; iOS+Android apps submitted; Base44 admin app created; Kinbridge Global nonprofit; GCS bucket gate"
metadata: 
  node_type: memory
  type: project
  originSessionId: 387c3ff7-0ec8-4aa2-8dc3-d4db09d71141
---

## accountablehub.com — Current State (2026-10-19)

### Domain & Deployment
- **Canonical domain**: `accountablehub.com` (CF Pages, branch: `master`)
- Frontend repo: `Tabula-medica/accountable-law`, local: `C:\Users\Aggarwal\ventures\accountable-law\`
- Backend repo: `Tabula-medica/accountable-law-api`, local: `C:\Users\Aggarwal\ventures\accountable-law-api\`
- Backend Cloud Run: `https://accountable-law-api-owiu7hqlja-uc.a.run.app` (GCP `accountable-law-prod`, `abhiaggarwalmd@gmail.com`)
- API routing: CF Pages Functions proxy `/api/*` → Cloud Run (no CORS issues)
- GA4: `G-7CS3Y78NB0`

### Mobile Apps (Expo native-shell)
- Repo: `C:\Users\Aggarwal\repos\accountablehub-mobile\`
- EAS project: `22cf6c2f-2a8f-4c08-8217-f346562978ca` (owner: `rajivka2`)
- Bundle ID: `com.accountablehub.app`
- **iOS**: ASC app ID `6824271539`; build `c3ee4f7a` attached to version `cd317645`
  - Screenshots: ✅ 4 uploaded (APP_IPHONE_67 ×2, APP_IPAD_PRO_3GEN_129 ×2)
  - All metadata: ✅ set via API (description, keywords, subtitle, copyright, categories, age rating)
  - Build attached: ✅
  - **Remaining gates (UI-only)**:
    - App Privacy → "Data Not Collected" → must be Published at appstoreconnect.apple.com
    - Pricing → must be set to Free at appstoreconnect.apple.com/apps/6824271539
  - **After those 2 gates**: `node asc-final-submit.cjs` in accountablehub-mobile/
- **Android**: AAB uploaded to Play internal track
  - Package: `com.accountablehub.app`
  - Remaining: store listing + content rating + promote to production in Play Console
- 3-tab native-shell: Home (stats/tools), Hospitals (expo-location GPS), Explore (WebView)

### Base44 Admin App
- Base44 app ID: `6ad59d952b833f25179435db`
- Editor: https://app.base44.com/apps/6ad59d952b833f25179435db/editor/preview
- Built 2026-10-19: admin dashboard for data upload, inquiry tracker, KPIs
- Part of Kinbridge Global nonprofit umbrella

### GCS Bucket (PENDING)
- Bucket: `gs://accountablehub-data` (not yet created — gcloud auth expired)
- Target project: `tabula-medica-bfd3d`, region `us-east1`
- Gate: `! gcloud auth login --account rajiv@tabulamedica.com`
- Then: `gcloud storage buckets create gs://accountablehub-data --project=tabula-medica-bfd3d --location=us-east1 --uniform-bucket-level-access`

### Org Affiliation
- Part of **Kinbridge Global** (nonprofit umbrella, covers UHR/Katha/NoorJyoti/UnRaj)
- Data sensitivity is high — use GCS + Vertex (no PHI but accountability data)

### All Live Pages (21 total):
**Hospital/Medical:**
- `/` homepage with live stats
- `/worst-hospitals/` — Hall of Shame, state filter
- `/hospital/?ccn=...` — hospital detail
- `/procedure/` — cross-hospital price comparison
- `/top-procedures/` — most overcharged leaderboard
- `/states/` — state-level markup leaderboard
- `/bill-check/` — surprise bill calculator
- `/dispute-letter/` — free dispute letter generator
- `/your-rights/` — patient rights explainer
- `/compare/` — hospital comparison tool
- `/physician/` — physician overutilization audit (CMS Part B 2022)

**Nonprofit/Legal:**
- `/charity/?ein=...` — nonprofit detail: A-F grade, 990 filings, exec pay
- `/attorney/` — CA State Bar discipline: search, leaderboard, detail panel

**Program Audits (all live):**
- `/programs/` — audit index
- `/programs/va-birth-injury/` — VA birth injury fund (~47% funded)
- `/programs/primary-care-first/` — CMS PCF audit (8-12% vs promised 35%)
- `/programs/vicp/` — federal VICP: $5.6B paid, 5yr wait, 20-25% legal fees
- `/programs/340b/` — 340B drug pricing: $54B, zero pass-through requirement
- `/programs/aco-mssp/` — MSSP ACO: $3.5B gross, physician-led 2× hospital-owned

**Other:**
- `/privacy/`, `/terms/`, `/jarvis` (AI command center)

### Data:
- Hospitals: 3,428 (CMS 2022) · Charities: 1.965M · 990 filings: 7,455
- Charity scores: 2,504 · Physicians: 130,614 unique (CMS Part B 2022)
- Attorneys: CA State Bar, nightly sync

### Key Gotcha — Merging PRs:
- After push, GitHub needs ~8s to compute mergeability — rebase + force-push + short sleep before `gh pr merge --admin --squash`
- Org rulesets NOT an issue for these repos (only sawd-web has the 20585594/23992403 blocker)

### Launch Assets:
- `LAUNCH-KIT.md` in repo root — ProductHunt, HN Show HN, Twitter thread, Reddit drafts (review before posting)

### Open Work:
1. **iOS final submit**: After App Privacy + Pricing in ASC UI → `node asc-final-submit.cjs`
2. **Android production**: Store listing + content rating + promote from internal in Play Console
3. **GCS bucket**: `gcloud auth login` then create `gs://accountablehub-data`
4. **Viral launch**: ProductHunt + HN + Twitter (drafts in LAUNCH-KIT.md)
5. **Phase 3**: Hospital bill OCR, NY/TX/FL state bar scrapers, attorney grading
