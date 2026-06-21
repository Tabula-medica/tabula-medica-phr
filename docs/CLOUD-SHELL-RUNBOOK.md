# Cloud Shell / Linux Build & Deploy Runbook — tabula-medica-phr

Everything here needs a **Linux build env** (Cloud Shell, WSL, or a Mac) — it
cannot be done on the Windows box because each step is verify-by-build
(`npm ci`, `tsc`, tests, FHIR smoke test). See `MIGRATION-STATUS-2026-06-21.md`
for *why* each item is build-gated.

Target GCP project: **`united-planet-485003-n7`**
Canonical Cloud Run service: **`tabula-medica-backend`** (us-central1)
(Deploy configs `deploy.sh` + `cloudbuild.yaml` were reconciled 2026-06-21 to this
name and now wire `DATABASE_URL` + `FHIR_BASE_URL` secrets — earlier they targeted
non-existent service names and shipped a DB-less app.)

---

## 0. Prerequisite — get the repo into the build env
The repo is **local-only** (`~/repos/tabula-medica-phr`, single import commit,
not pushed to GitHub). To work in Cloud Shell, first publish it to a **private**
remote (GitHub private repo or Cloud Source Repositories), then:

```bash
git clone <your-private-remote> tabula-medica-phr
cd tabula-medica-phr
```

> Do NOT make this repo public — it contains a HIPAA app and historical config.

---

## 1. Baseline build (no edits yet) — prove it compiles as-is
```bash
npm ci
npm run check        # tsc --noEmit
npm test             # if a test script exists
npm run build
```
If this fails before any edits, fix the baseline first — don't layer dep removal
on top of a broken build.

## 2. Drop deprecated deps (Auth0 / Medplum / Aidbox)
The patient-login rip-out is ~90% done; these are the leftover unused deps.
**Remove and resync the lockfile in one step** (never hand-edit package.json without
`npm install`, or `npm ci` breaks):
```bash
npm rm express-openid-connect @auth0/auth0-react @auth0/auth0-spa-js \
        @medplum/core @medplum/fhirtypes @aidbox/node-server-sdk
npm run check        # confirm 0 type errors after removal
```
**DECISION GATE — SMART-on-FHIR / NMN / TEFCA** still uses Auth0 as an OAuth2
*authorization server* (not patient login), env-gated OFF. Files listed in
`MIGRATION-STATUS-2026-06-21.md` §2. Either:
- (a) defer/remove the NMN SMART-provider feature (delete those files + the
  `@auth0/*` server deps), or
- (b) keep it and re-add only the server-side Auth0 deps it needs.
Until decided, leave it inert (don't delete blindly).

## 3. FHIR provider cutover
Default is `mock`. To use Cloud Healthcare API in the deployed env:
```bash
gcloud run services update tabula-medica-backend --region us-central1 \
  --project united-planet-485003-n7 \
  --set-env-vars FHIR_PROVIDER=cloud_healthcare_api
```
Then run a FHIR smoke test against a non-prod patient before promoting.

## 4. F1 PHI-encryption guardrail
~84 of 102+ violations remained (per README). Security-sensitive — run the test
suite after each batch. Do not ship partial encryption coverage to prod.

## 5. Deploy (production-grade path)
The reconciled `cloudbuild.yaml` does: install → tsc → medical-safety NO-CDS scan →
build → image push → **staging deploy (no traffic)** → health check → promote.
```bash
gcloud builds submit --config cloudbuild.yaml \
  --project united-planet-485003-n7
```
Quick manual path (skips staging gate) is `./deploy.sh` — same service + secrets.

---

## Known risks to verify in the build env
- **Cloud SQL socket vs no mount:** the live service's `DATABASE_URL` secret uses a
  `host=/cloudsql/...:tabula-medica-db` unix socket, but the service has **no**
  `--add-cloudsql-instances` annotation. It currently reports Ready, but confirm DB
  calls actually succeed at runtime; if not, add
  `--add-cloudsql-instances=united-planet-485003-n7:us-central1:tabula-medica-db`
  to both deploy configs.
- **Service account:** deploys run as the default compute SA. Hardening TODO: move to
  a dedicated least-privilege SA with only `roles/secretmanager.secretAccessor` +
  Cloud SQL client.
- **Two dead services:** `tabula-medica` and `tabula-medica-ai` (us-central1) are
  Ready=False failed deploys — decide delete vs fix (separate from the live backend).
- **Image repo divergence:** `cloudbuild.yaml` pushes to `cloud-run-source-deploy`,
  `deploy.sh` to `tabula-medica-docker`. Harmless but pick one to avoid drift.

## State already handled (2026-06-21, from Windows)
- P0 leaked Cloud SQL password rotated; orphaned `patient-db-us-central1` exported
  (empty) + stopped; broken us-east1 backend duplicate deleted. See
  `tabula_medica_phr_app` memory for details.
