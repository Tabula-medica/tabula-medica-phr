# PHR `.us` / `.world` split — GO-LIVE CHECKLIST

Single source of truth for finishing the domain split. Updated 2026-06-23.

## DONE ✅
- [x] `tabulamedica.us` + `tabulamedica.world` verified to the Google account.
- [x] Cloud Run **domain mappings created** → both point at service `tabula-medica-web`
      (project `united-planet-485003-n7`, region `us-central1`). Status "Unknown" =
      awaiting DNS (no traffic flows until Cloudflare points — safe).
- [x] DNS automation staged: `deploy/cloudflare-phr-dns.sh` (idempotent).

## REMAINING — `.us` (can go fully live now)
1. [ ] **Mint a Cloudflare token** — `Zone:DNS:Edit` on `tabulamedica.us` (+ `.world`).
       Short TTL; revoke after.
2. [ ] **Run:** `export CF_API_TOKEN=...; ./deploy/cloudflare-phr-dns.sh us`
       (or add the 8 apex A/AAAA records by hand, **DNS-only / grey-cloud** — IPs in the script).
3. [ ] **Wait for Google-managed cert** (auto, a few min–1h):
       `gcloud beta run domain-mappings describe --domain tabulamedica.us --region us-central1 --project united-planet-485003-n7`
4. [ ] **Smoke test:** `curl -I https://tabulamedica.us/` → expect 200 + valid cert.

## REMAINING — `.world` (GUARDED until geofence) ⛔
The GDPR-defer plan requires **blocking EU traffic before `.world` is reachable**.
Decide the geofence approach — they're mutually exclusive with the `.us` grey-cloud setup:
- **Option A — Cloudflare edge (recommended):** proxy `.world` (orange-cloud) + CF SSL
  **Full (strict)** + a WAF custom rule "block where country in EU/EEA". Requires the
  token to also have `Zone WAF:Edit`, or build the rule in the dashboard. NOTE: orange-cloud
  changes the DNS setup vs `.us` (proxied), so the script's grey-cloud records do **not**
  apply to `.world` as-is.
- **Option B — app-layer:** enforce the geofence in the host-config code (block EU by
  request geo) and keep `.world` grey-cloud like `.us`. Simpler DNS, but the block lives
  in the app, not the edge.
- [ ] Choose A or B → implement → THEN: `CONFIRM_WORLD=yes ./deploy/cloudflare-phr-dns.sh world`
      (Option B only; for Option A do the proxied records + WAF rule instead).

## REMAINING — host-config code (build-env; owned by THIS session)
- [ ] In `tabula-medica-web`: branch behavior by `Host` header —
      `tabulamedica.us` → TEFCA/US-networks ON, US-only; `tabulamedica.world` → TEFCA OFF +
      geofence (per chosen option). Keep NO-CDS / BAA-LLM (Vertex) / token-not-PHI guardrails.
- [ ] Clean up: `tabula-medica-web` latest revision is FAILED (serving via an older healthy
      revision) — redeploy a clean revision so the route reports Ready (also unblocks the
      domain-mapping cert reconciliation).
- Needs WSL / Cloud Shell / Mac — cannot run on the Windows box.

## Guardrails (do not violate)
- TEFCA = `.us` ONLY; live network connections gated on counsel + agreements.
- Never point `.world` DNS before its geofence is live.
- All LLM calls on Vertex (BAA-covered); summaries factual/no-CDS; QR = token, never PHI.
