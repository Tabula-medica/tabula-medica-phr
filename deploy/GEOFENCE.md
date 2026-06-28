# .world EU/EEA Geofence — how it works + the infra it needs

The `.us` / `.world` split is enforced in one app via `server/middleware/host-edition.ts`:
- `tabulamedica.us` → edition `us`, `tefcaAllowed = true` (US networks on)
- `tabulamedica.world` → edition `world`, `tefcaAllowed = false`, EU/EEA/UK/CH geofenced
- `tabulamedica.health` / other → `default`, falls back to the user's region preference

## The geofence chain
`geoCountryMiddleware()` sets `req.country` → `worldGeofenceMiddleware()` blocks the
`.world` edition (HTTP 451) when `req.country` ∈ {EU-27, EEA, UK, CH}.

## ⚠️ The catch: country signal needs infra
`geoCountryMiddleware` reads `req.country` from, in order:
1. `CF-IPCountry` (Cloudflare edge) — **only present if Cloudflare PROXIES the request (orange cloud)**
2. `X-Country-Code` (custom upstream)
3. `DEV_COUNTRY_CODE` (dev only)

`.us`/`.world` are currently **grey-cloud (DNS-only)** so traffic goes straight to
Google Cloud Run and **Cloudflare is NOT in the path → no `CF-IPCountry` → country is
"unknown"**. With no country signal, the geofence **fails open** (serves everyone)
unless `WORLD_GEOFENCE_STRICT=true` (which would block *everyone*, not just the EU).

## To get a reliable EU block on .world, pick ONE (infra decision):
- **A — Google Cloud Armor (recommended):** put `.world` behind an external HTTPS Load
  Balancer with a Cloud Armor geo policy denying EU/EEA/UK regions. Cloud Run stays
  grey-cloud-friendly; no Cloudflare proxy needed. Block happens at Google's edge.
- **B — Cloudflare proxy mode for .world:** orange-cloud `.world` + CF SSL Full(strict)
  + a WAF rule blocking EU. Then `CF-IPCountry` populates `req.country` and this
  middleware enforces too (defense in depth). NOTE: orange-cloud changes the cert
  story vs the grey-cloud `.us` setup.

Either way, the **app-layer middleware here is the enforcement backstop** — it
activates automatically once `req.country` is populated. Do NOT point `.world` DNS at
the app until one of A/B is live (per the GDPR-defer directive).

## Testing locally
`DEV_COUNTRY_CODE=DE` + Host `tabulamedica.world` → expect 451.
`DEV_COUNTRY_CODE=US` + Host `tabulamedica.world` → 200.
