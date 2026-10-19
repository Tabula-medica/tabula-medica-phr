---
name: accountable-law-state
description: "accountablehub.com — 21 live pages; hospital/charity/physician/attorney/5 program audits; brand fleet-wide AccountableHub; launch kit drafted"
metadata: 
  node_type: memory
  type: project
  originSessionId: 387c3ff7-0ec8-4aa2-8dc3-d4db09d71141
---

## accountablehub.com — Current State (2026-10-15)

### Domain & Deployment
- **Canonical domain**: `accountablehub.com` (CF Pages, branch: `master`)
- Frontend repo: `Tabula-medica/accountable-law`, local: `C:\Users\Aggarwal\ventures\accountable-law\`
- Backend repo: `Tabula-medica/accountable-law-api`, local: `C:\Users\Aggarwal\ventures\accountable-law-api\`
- Backend Cloud Run: `https://accountable-law-api-owiu7hqlja-uc.a.run.app` (GCP `accountable-law-prod`, `abhiaggarwalmd@gmail.com`)
- API routing: CF Pages Functions proxy `/api/*` → Cloud Run (no CORS issues)
- GA4: `G-7CS3Y78NB0`

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
- All copy verified against live data numbers; tech stack description confirmed accurate

### Next Steps:
1. **Viral launch** — Rajiv posts ProductHunt + HN Show HN + Twitter thread (drafts in LAUNCH-KIT.md)
2. **Phase 3**: Hospital bill OCR (anonymous upload → extract line items → compare to CMS rates)
3. **Expand attorneys** — NY, TX, FL state bar scrapers
4. **Attorney score/grade** — A-F like charity scoring
5. **OG image / social preview** — per-page dynamic OG meta for richer Twitter/LinkedIn shares
