# BD Firecrawl Toolkit

Non-PHI business-development tooling powered by Firecrawl. Serves **WorldEHR**
and **Tabula Medica PHR** (and reusable for the fleet). **Nothing here touches a
clinical/PHI repo or patient data** — it works on the public NPPES registry and
public vendor/practice websites only.

## Setup

```bash
# Key comes from env / GCP Secret Manager (tabula-secrets) — NEVER commit it.
export FIRECRAWL_API_KEY=fc-...
```

## 1. Lead-gen — who to sell EHR/PHR to (`leadgen.mjs`)

```bash
# smoke test (one site)
node leadgen.mjs --url https://ltfm.health --product worldehr

# discover: NPPES orgs by taxonomy + state → resolve site → scrape qualification signals
node leadgen.mjs --product worldehr --taxonomy "Family Medicine" --state VA --limit 25

# from a seed list (CSV columns: name, city, state, website?)
node leadgen.mjs --product phr --input seed.csv
```

Extracts sales-qualification signals: current EHR/portal vendor, online
scheduling, telehealth, patient portal, approx provider count, public contact
info. Output → `out/<product>-<ts>.leads.csv` (gitignored — real contact data).

## 2. Competitive intel — track competitor pages (`competitive.mjs`)

```bash
node competitive.mjs --url https://www.drchrono.com/pricing/   # smoke test
node competitive.mjs --segment ehr                              # all EHR competitors
node competitive.mjs                                            # everything
```

Edit `competitors.json` to curate the list. Output → `out/competitive-*.{csv,json}`.

### Scheduled tracking (do this instead of cron)

For recurring change-alerts, use a **Firecrawl monitor** rather than re-running
this on a cron — it diffs each page and only notifies on real changes judged
against a plain-language goal:

```bash
firecrawl monitor create --url https://www.drchrono.com/pricing/ \
  --schedule "every 7 days" \
  --goal "alert only if pricing or plan tiers change" \
  --notify email:you@example.com
```

## Safety
- `FIRECRAWL_API_KEY` is read from env only — never written to any file.
- All output (`out/`, `*.leads.csv`, `*.leads.json`) is gitignored at the home-repo root.
- Firecrawl is a third-party service with **no BAA** — send it public web content only, never PHI. (Portfolio rule.)
- Lead output holds real people's contact data: use with consent / CAN-SPAM, and send only from warmed, opted-in channels.
