# Tabula Medica PHR — Go-Live Status & Roadmap (.us / .world)

_Ground-truth assessment of what's actually wired vs. stubbed, and the concrete
work left to launch the "complete deduplicated shareable PHI" tool on
**tabulamedica.us** (US / TEFCA) and **tabulamedica.world** (global). Based on a
full code read, not memory. Last updated 2026-07-01._

## TL;DR
The app has a mature UI surface and real skeletons for every pillar, but three of
the four product pillars have a **stubbed core** that must be finished before this
is a truthful "complete, deduplicated, shareable PHI" product. The easy-login
pillar is essentially done. The AI PHI-safety leak is now fixed (this branch).

| Pillar | State | Blocker to launch |
|---|---|---|
| Easy login (patient/provider) | ✅ Done (typechecks) | none — ship it |
| PHI ingestion | 🟠 Connect UX real, **data pull stubbed** | Fasten webhook only logs; no PHI actually enters |
| Deduplication | 🟠 Real engine, **breaks under encryption + patient review is fake** | hash-column lookups; wire real merge-review |
| AI summarize | ✅ PHI now pinned to Vertex (this branch) | Medplum creds OR repoint at stored bundle |
| Shareable PHI | 🟠 Only break-glass path is end-to-end | `care-share-qr` has no backend; care-packet carries no PHI |
| Deploy to .us/.world | 🔴 **Service-name split** | domains map to `tabula-medica-web`; pipeline builds `tabula-medica-backend` |

---

## Pillar 1 — Easy login ✅ DONE
- `auth-login.tsx` / `auth-register.tsx` reworked; single-screen `simple-onboarding.tsx`
  gates first-run via `/api/onboarding/status`. Passes `tsc --noEmit` clean.
- GCIP-only patient auth (project `united-planet-485003-n7-9f345`).
- **Action:** merge. Only external dependency is the GCIP allowlist (see Pillar 6).

## Pillar 2 — PHI ingestion 🟠 (highest product risk)
- **Fasten (headline source) never pulls data.** `server/routes.ts:1173-1178` webhook
  only logs `{received:true}`. Add: fetch authorized bundle → ingest → dedup → store.
- **SMART-on-FHIR** works only with a real client ID; else mock (dev) / empty (prod)
  — `server/services/ehr-integration-service.ts:325-384, 516-560`.
- **Connections + synced data are in-memory** (`:162`); `saveSyncedDataToCloud` stores
  only counts (`:942-951`). Persist connections + actual FHIR resources to DB/GCS.
- Health Gorilla / Metriport: not implemented (catalog references only).

## Pillar 3 — Deduplication 🟠
- Real 2-pass matcher exists (`server/services/deduplication-engine-service.ts`), surfaced
  in `deduplication-center.tsx`. BUT:
  - **Breaks under PHI encryption** — deterministic/probabilistic/search `eq()` lookups hit
    encrypted columns → zero matches (`:337-435, 472-482, 1053-1067`, all `F1-LATENT`).
    Fix: match on hash columns (`emailHash/mrnHash/phoneHash` + new `ssnLast4/dob` hashes).
  - **Patient merge-review is fake** — `getPatientPendingReviews` returns samples,
    `patientConfirmMerge` is a no-op (`:1085-1225`). Wire to `matchCandidatesTable`/`resolveMatch`.
  - **"Vertex AI dedup" is not Vertex** — `phr-orchestration-service.ts:392-431` is local
    bucketing mislabeled. Either implement real entity resolution or correct the claim.
  - **Deduped master record is never displayed** — `my-health-record.tsx:578`,
    `health-records-display.tsx`, `universal-search.tsx` don't consume `/api/deduplication/*`.

## Pillar 4 — AI summarize ✅ (PHI leak fixed this branch)
- `server/services/ai-provider.ts`: default provider is now **Vertex**, PHI features pinned
  to Vertex, and Vertex **fails closed** (no silent OpenAI fallback) for PHI. Portfolio rule
  (no Anthropic/OpenAI BAA) enforced in code.
- Remaining: `summarizePatient` depends on Medplum `getPatientEverything`, which 503s without
  creds (`medplum-client-service.ts:3-7`). Provision Medplum OR repoint at the stored bundle.

## Pillar 5 — Shareable PHI 🟠
- **`care-share-qr.tsx` has no backend** — POSTs to nonexistent `/api/share/generate-link`,
  falls back to a fake `demo-` token (`:74-92`). Implement the route or repoint at care-packets.
- **Care-packet share carries no PHI + not durable** — `care-packet-share-routes.ts`: in-memory
  Map (`:20`), IP-based ownership (`:91`), `/access` returns only a type label (`:183-188`).
  Attach the deduped bundle + real auth + persistence.
- **Break-glass emergency-view is the only end-to-end path** (`emergency-routes.ts`, token+PIN).
  Token-not-PHI is correct — use it as the model for the others.

## Pillar 6 — Deploy to .us / .world 🔴
- **Service-name split (blocker):** domain mappings + DNS + GitHub Actions use
  `tabula-medica-web`; `cloudbuild.yaml:112` + `deploy.sh:10` build `tabula-medica-backend`.
  Pick ONE service; make it the one the domains map to.
- **Mapped service must have full runtime config** — Cloud SQL attach
  (`united-planet-485003-n7:us-central1:tabula-medica-db`), `FHIR_BASE_URL`, LiteLLM/Vertex env.
  `soc2-deploy.yml:178` lacks these and uses `REPLIT_DB_URL` → DB/AI-broken.
- **Clear the FAILED `tabula-medica-web` revision** (`GO-LIVE-CHECKLIST.md:39`) so cert reconciles.
- **`.us` can go live now** once above is fixed: `deploy/cloudflare-phr-dns.sh us`.
- **`.world` needs geofence infra FIRST** (grey-cloud drops `CF-IPCountry`, EU block fails open
  — `host-edition.ts:56-60`). Stand up Cloud Armor geo-policy or CF orange-cloud+WAF, THEN
  `CONFIRM_WORLD=yes deploy/cloudflare-phr-dns.sh world`.
- **Client ignores host edition** — `region-provider.tsx:49-60` uses timezone, not hostname.
  Feed `/api/region-features` region into `RegionProvider` so UI matches the domain.

### GCP / console actions (owner: Rajiv — not doable in-repo)
1. **GCIP allowlist** — add `tabulamedica.us` + `tabulamedica.world` to the browser API key's
   HTTP-referrer allowlist AND GCIP "Authorized domains" (project `united-planet-485003-n7-9f345`).
   This is the fix for the auth `internal-error`.
2. **Reconcile Cloud Run service** — confirm which service the domain mappings target
   (`gcloud run domain-mappings describe`) and align the deploy pipeline to it.
3. **DNS** — run the cloudflare-phr-dns script per domain after the geofence decision.

---

## Recommended sequence
1. ✅ Merge easy-login + PHI-safety (this branch).
2. Reconcile the Cloud Run service-name split + clear the failed revision → get ONE clean revision.
3. GCIP allowlist for both domains → auth works.
4. Point `.us` DNS → **`.us` live** (US/TEFCA).
5. Finish Fasten ingestion (real data pull + persistence) → PHI actually flows.
6. Fix dedup hash-column lookups + surface the master record → "deduplicated" becomes true.
7. Back the share token with the deduped bundle → "shareable" becomes true.
8. Stand up `.world` geofence → point `.world` DNS → **`.world` live** (global).
</content>
</invoke>
