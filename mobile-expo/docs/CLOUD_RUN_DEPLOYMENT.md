# Tabula Medica — Cloud Run Production Deployment

**Why this exists:** The Express server processes PHI. Replit does not offer a HIPAA BAA on any tier we're using, so production cannot run there. Google Cloud Run runs under the existing GCP BAA on project `united-planet-485003-n7` and is the production target.

---

## What's already in the repo (no work needed)

| Artifact | Path | Purpose |
|---|---|---|
| Multi-stage Dockerfile | `Dockerfile` | Builds the Express server (`server:build` → esbuild bundle), runs as non-root `node` user, prod deps only |
| Cloud Build config (fallback) | `cloudbuild.yaml` | Manual `gcloud builds submit` path — service `tabula-medica-web` |
| GitHub Actions deploy (primary) | `.github/workflows/deploy-cloudrun.yml` | Builds + deploys on push to `main`, runs smoke test, Slack alerts on failure/recovery |
| Post-deploy smoke test | `scripts/post-deploy-smoke.mjs` | Hits `https://api.tabulamedica.health` and verifies App Store reviewer login still works |
| GCP bootstrap script | `scripts/bootstrap-gcp-cloudrun.sh` | One-shot: enables APIs, creates SAs, sets IAM, configures Workload Identity Federation, pushes secrets |
| Production domain | `api.tabulamedica.health` | Hardcoded into smoke test + Slack messages |

---

## What you need to do — once, in order

### Step 0 — BAA verification (BLOCKING for production PHI traffic)
Before any real patient data hits Cloud Run, your PM needs **written confirmation from your Google Cloud account team** that:
- The signed BAA on project `united-planet-485003-n7` covers **Cloud Run** as a service.
- The signed BAA also covers **Vertex AI generative API** + the specific Gemini model versions we plan to use (Gemini 2.5 Pro, 2.5 Flash, 2.0 Flash) — these must NOT be on Google's "excluded from BAA" preview list at the time we go live.

This is the same open question already on your PM's plate from the Vertex AI migration design doc. One verification covers both.

### Step 1 — install / authenticate gcloud locally
On your machine (not in Replit):
```bash
brew install --cask google-cloud-sdk      # macOS; or follow https://cloud.google.com/sdk/docs/install
gcloud auth login
gcloud config set project united-planet-485003-n7
```

### Step 2 — prepare your secrets file
Create a local file at `.local/prod-secrets.env` (already in `.gitignore` via `.local/`). One `KEY=value` per line. The bootstrap script reads it and pushes each value to GCP Secret Manager — values are never printed.

Required keys (the deploy workflow won't start the container without them):

```env
# Postgres (Neon / Cloud SQL — production instance, NOT the dev one)
DATABASE_URL=postgresql://user:pass@host:5432/dbname?sslmode=require

# PHI envelope encryption — 32-byte base64 key, generate fresh for prod, NEVER reuse dev key
PHI_ENCRYPTION_KEY=<openssl rand -base64 32>

# Express session signing — 64+ char random string
SESSION_SECRET=<openssl rand -base64 64>

# GCS HIPAA bucket (already created — same bucket as dev is fine)
GCS_BUCKET_NAME=tabula-medica-gcs
GCS_ENCRYPTION_KEY=<existing GCS encryption key — same value as Replit env>

# GCP service account JSON for Vertex AI / GCS — same JSON blob as Replit env
GOOGLE_APPLICATION_CREDENTIALS_JSON=<paste full JSON one-line>

# Cross-app HMAC for landing-page auth handoff
CROSS_APP_SECRET=<openssl rand -base64 32>
```

Optional but recommended (add later as features go live):
```env
HEALOW_API_KEY=...        # if Healow integration is enabled in prod
AUTH0_DOMAIN=...          # if Auth0 is the prod identity provider (see open question on Auth0 BAA)
AUTH0_AUDIENCE=...
AUTH0_CLIENT_ID=...
AUTH0_CLIENT_SECRET=...
AUTH0_BAA_EXECUTED=true   # set ONLY after Auth0 Enterprise BAA is signed
```

**`OPENAI_API_KEY` is intentionally NOT in this list.** Production runs on Vertex AI under the GCP BAA. Including OpenAI would re-introduce the PHI-exposure path we just closed.

### Step 3 — run the bootstrap script
```bash
GITHUB_REPO=your-org/your-repo bash scripts/bootstrap-gcp-cloudrun.sh
```

The script is idempotent — safe to re-run. It will:
1. Enable Cloud Run, Cloud Build, Artifact Registry, Secret Manager, IAM Credentials, STS, and Vertex AI APIs.
2. Create runtime service account `cloud-run-runtime@united-planet-485003-n7.iam.gserviceaccount.com` and grant it Vertex AI User, Secret Manager Accessor, Storage Object Admin, Logging Writer, Monitoring Writer.
3. Create deploy service account `cloud-run-deploy@…` and grant it Run Admin, Cloud Build Editor, Artifact Registry Writer, Storage Admin, plus `actAs` on the runtime SA.
4. Set up Workload Identity Federation so GitHub Actions can authenticate without a long-lived JSON key. The script will print the two values you need to add to GitHub.
5. Push every secret in `.local/prod-secrets.env` to Secret Manager and grant the runtime SA access.
6. Tell you the gcloud command to run after first deploy to map `api.tabulamedica.health`.

### Step 4 — add 5 GitHub repo secrets
GitHub → your repo → Settings → Secrets and variables → Actions → New repository secret. The bootstrap script will print exact values for the first two:

> **SECURITY:** `REVIEWER_EMAIL` and `REVIEWER_PASSWORD` are credentials for a real production-accessible account. They MUST be stored exclusively as GitHub repo secrets and Replit Secrets — never committed to the repository, `.replit`, or any other source-controlled file. Anyone with repository access who also has these values can authenticate directly against the production login endpoint.
>
> **CREDENTIAL ROTATION REQUIRED:** If these credentials were previously committed to the repository (even in a prior commit), treat them as compromised. Rotate the reviewer account password immediately via the app's password-change flow before storing the new password in secret managers. Previous git history retaining the old values does not prevent the new password from being secure — the live account credential is what must be changed.

| Secret name | Value source |
|---|---|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Printed by bootstrap script |
| `GCP_SERVICE_ACCOUNT` | Printed by bootstrap script (`cloud-run-deploy@…`) |
| `REVIEWER_EMAIL` | App Store reviewer demo account email — store as secret only, never commit |
| `REVIEWER_PASSWORD` | App Store reviewer demo account password — store as secret only, never commit |
| `SLACK_WEBHOOK_URL` | Optional — Slack incoming webhook for the `#engineering` channel. Omit and Slack notifications become a no-op |
| `SENDGRID_API_KEY` | Optional — SendGrid API key with `mail.send` scope, used by `.github/workflows/security-alerts.yml` to email the security distribution list on new high/critical CVEs. Omit and the email step becomes a no-op (Slack + GitHub issue still fire) |
| `SECURITY_ALERT_EMAIL_TO` | Optional — Comma-separated recipient list for security CVE alerts (e.g. `security-oncall@tabulamedica.health`). Required alongside `SENDGRID_API_KEY` to enable email pages |
| `SECURITY_ALERT_EMAIL_FROM` | Optional — Verified SendGrid sender address. Defaults to `security-alerts@tabulamedica.health` if unset |

### Step 5 — first deploy
Push any commit to `main` that touches `server/`, `shared/`, `Dockerfile`, or `package*.json`. The workflow auto-runs.

Watch it: GitHub → Actions → "Deploy to Cloud Run".

### Step 6 — map the custom domain
After the first successful deploy, run the command the bootstrap script printed:
```bash
gcloud run domain-mappings create \
  --service=tabula-medica-web \
  --domain=api.tabulamedica.health \
  --region=us-central1
```

It will print 1-4 DNS records (A / AAAA or CNAME). Add them at your domain registrar. SSL certificate provisions automatically once DNS resolves (usually 5-15 min).

### Step 7 — verify
```bash
curl https://api.tabulamedica.health/api/health
```
Should return 200 with a JSON body. The post-deploy smoke test in the GitHub workflow runs the same check automatically on every deploy.

### Step 8 — point the mobile app at production
For App Store / TestFlight builds, the mobile app needs `EXPO_PUBLIC_DOMAIN=api.tabulamedica.health`. Set it in EAS:
```bash
eas secret:create --name EXPO_PUBLIC_DOMAIN --value api.tabulamedica.health --scope project
```

For dev builds, leave it unset — the existing logic falls back to the Replit dev domain.

---

## AI matching platform backstop

The in-process AI duplicate-matching alert uses `SLACK_WEBHOOK_URL` and
`OPS_ALERT_SLACK_CHANNEL` (default `#engineering`). The independent backstop is a
Cloud Logging counter plus a Cloud Monitoring metric-threshold policy:

| Configuration | File |
|---|---|
| Log-based DELTA/INT64 counter | `infra/monitoring/vertex-dedup-degraded-metric.json` |
| Metric-threshold alert | `infra/monitoring/vertex-dedup-degraded-policy.json` |
| Dry-run / idempotent provisioning | `scripts/setup-vertex-dedup-monitoring.mjs` |

**Scope:** production `tabula-medica-web`, `us-central1`, project
`united-planet-485003-n7`. The filter matches `[VertexDedup] AI matching DEGRADED`
in `jsonPayload.message` or `textPayload`, with Cloud Logging ERROR-or-higher
severity or the logger's structured `level=error/critical`. Cloud Run stderr JSON
does not have to promote `level` to Cloud Logging's `severity`. The resource
filter intentionally uses Cloud Run's collected container logs, not the logger's
optional direct SDK writes under a different monitored resource. No PHI is
extracted into metric labels or notifications. Counts are **log entries**, not
failed comparisons; duplicate ingestion can increase the count without changing
the >0 alert decision. Staging is excluded.

### One-time setup (operator with GCP access)

Run from an authenticated operator machine after the Cloud Run bootstrap. This
repository change does **not** provision live GCP resources automatically.
Use a current Google Cloud CLI with `gcloud monitoring policies` support, Node.js,
and a principal with Logs Configuration Writer (`roles/logging.configWriter`),
Monitoring AlertPolicy Editor (`roles/monitoring.alertPolicyEditor`), and
Monitoring NotificationChannel Viewer (`roles/monitoring.notificationChannelViewer`).
An administrator must enable `logging.googleapis.com` and
`monitoring.googleapis.com` if not already enabled.

1. In **Monitoring → Alerting → Edit notification channels → Slack**, create or
   reuse an enabled Slack channel pointing to the **same actual on-call Slack
   destination** as `OPS_ALERT_SLACK_CHANNEL` / the app webhook. Default:
   `#engineering`. Authorize Google Cloud Monitoring in that Slack workspace;
   invite its Slack app to the channel, including private channels. This uses
   Monitoring's independent Slack integration, **not** the app webhook. Test the
   notification channel in the console and confirm receipt with on-call.
   Channel creation requires NotificationChannel Editor permissions.
2. Obtain its resource name without printing channel credentials:

   ```bash
   gcloud monitoring channels list --project=united-planet-485003-n7 \
     --format='table(name,type,displayName,enabled,labels.channel_name)'
   ```

3. Inspect the local dry run, then explicitly apply (replace the numeric ID):

   ```bash
   node scripts/setup-vertex-dedup-monitoring.mjs \
     --channel projects/united-planet-485003-n7/notificationChannels/123456

   node scripts/setup-vertex-dedup-monitoring.mjs \
     --channel projects/united-planet-485003-n7/notificationChannels/123456 \
     --slack-channel '#engineering' --apply
   ```

   If ops uses another destination, supply that exact channel name instead.
   The script verifies the existing Monitoring channel is enabled, is Slack,
   and has the expected name. Operators must also verify the Slack **workspace**
   and app webhook destination; identical channel names in different workspaces
   do not prove identical routing. No tokens or webhook URLs belong in these
   files or command arguments.

   Re-running updates the named metric and the policy tagged
   `managed_by=vertex-dedup-backstop`; unrelated policies are untouched.
   Duplicate managed policies and read/permission failures abort rather than
   silently creating extra alerts. A partial apply is safe to retry. The script
   does not grant IAM or enable APIs.

### Timing, closure, and limitations

The policy sums entries across production revisions/instances over five minutes
and opens when the sum stays above zero for 60 seconds. Allow several additional
minutes for log ingestion, metric creation, evaluation, and Slack delivery.
Log-based metrics count new entries after creation, not historical matches.

When entries stop, zero counts or **missing data treated as inactive** close the
incident. A 30-minute `autoClose` is also configured as a missing-data backstop;
it is not a guaranteed 30-minute end-to-end closure deadline. Monitoring sends
opening and closing notifications. The nonzero 60-second retest window is
intentional: Monitoring ignores the missing-data control for a zero-second
window.

**Closure is not recovery.** The app logs on entering degraded state, not on
every failed comparison. Silence can mean no work, continued degradation, or a
dead server. This policy can page after Node crashes or loses Slack access
**only if the degraded entry already reached Cloud Logging**. It cannot detect a
crash before that entry, a lost/unflushed log, total log-ingestion failure, or a
Slack-wide outage. Check Cloud Run/Vertex health and authenticated
`GET /api/phr/dedup/status` before treating an incident as resolved. Keep
availability monitoring and the in-process recovery/re-page mechanisms separate.

### Verify end-to-end without breaking AI

Coordinate with on-call: this deliberately sends a **real test page**. After
provisioning, use Logs Explorer to confirm the metric filter matches production
container logs. Then write a PHI-free synthetic entry with the production
monitored resource (requires `roles/logging.logWriter`):

```bash
gcloud logging write vertex-dedup-backstop-test \
  '{"message":"[VertexDedup] AI matching DEGRADED: [TEST] platform backstop delivery check; no AI failure induced","level":"error"}' \
  --project=united-planet-485003-n7 --payload-type=json --severity=ERROR \
  --monitored-resource-type=cloud_run_revision \
  --monitored-resource-labels=project_id=united-planet-485003-n7,service_name=tabula-medica-web,location=us-central1,revision_name=monitoring-backstop-test,configuration_name=tabula-medica-web
```

Confirm all three: the user metric
`logging.googleapis.com/user/vertex_dedup_ai_matching_degraded` increments, a
Monitoring incident opens, and the intended on-call Slack channel receives it.
Stop writing entries and confirm the incident and closing notification follow
automatically. This exercises the platform path without calling Node or its
Slack webhook, and does not alter real deduplication state. If no alert arrives,
check the raw log against the exact filter, Logs Router exclusions, metric time
series, policy enabled state, channel authorization/workspace membership, and
Monitoring delivery errors. Re-test after channel authorization changes.

Local regression checks (no GCP credentials or writes):

```bash
node --test scripts/test-vertex-dedup-monitoring.mjs
```

Rollback: disable the tagged policy in Monitoring to stop notifications; do not
delete a shared Slack channel. If retiring the backstop permanently, delete that
policy and then the log-based metric. Re-running setup re-enables the policy.

References: [log-based metrics](https://cloud.google.com/logging/docs/logs-based-metrics/counter-metrics),
[missing-data behavior and closure](https://cloud.google.com/monitoring/alerts/concepts-indepth),
[Slack notification channels](https://cloud.google.com/monitoring/support/notification-options#slack).

---

## Cost expectation
Cloud Run pricing model is request-based — you pay for CPU/memory only while requests are being served. With this app's traffic level (developer demo + App Store reviewer + early users):
- Idle: ~$0/month
- Light traffic (< 100k requests/month): ~$10-30/month
- Plus ~$3-5/month for Secret Manager + minimal Cloud Build minutes

This will be cheaper than the Replit Autoscale Deployment tier you'd otherwise need for production traffic.

---

## What this closes

| Risk before | Status after |
|---|---|
| PHI in HTTP request bodies hits Replit servers (no BAA) | ✅ Closed — production traffic terminates on Cloud Run under existing GCP BAA |
| PHI in server memory / logs sits on Replit hosts | ✅ Closed — same |
| AI prompts containing PHI route through Replit AI proxy | ✅ Closed in Phase 1 (Vertex AI now primary, OpenAI removed from production secret list) |
| Long-lived GCP service account JSON keys checked into CI | ✅ Avoided — Workload Identity Federation, no keys |
| Container runs as root | ✅ Closed — multi-stage Dockerfile uses `USER node` |
| One-stage Docker image bloated with dev deps | ✅ Closed — multi-stage with `--omit=dev` in runtime stage |

## Automated vulnerability alerting

Three layers, ordered by how quickly they react to a new CVE landing in the dependency tree:

1. **Per-PR scan — `.github/workflows/security-scan.yml`.** Runs `npm audit --omit=dev --audit-level=high`, `audit-ci`, TruffleHog, CodeQL, and a license check on every PR to `main`. Blocks merge if a high/critical CVE is introduced by the PR.
2. **Daily scheduled scan — `.github/workflows/security-alerts.yml`.** Runs `npm audit --omit=dev --json` at 13:00 UTC daily (and on `workflow_dispatch`), plus a Trivy scan of the production container image. When any high/critical advisory is present:
   - Posts a Slack message via the shared `post-slack-notification` action (uses the existing `SLACK_WEBHOOK_URL` secret — no new secret needed).
   - Opens or comments on a deduplicated GitHub issue labelled `security,automated`. Repo watchers receive this as email.
   - **Pages the security distribution list directly via SendGrid** (`.github/scripts/send-security-email.mjs`) when `SENDGRID_API_KEY` + `SECURITY_ALERT_EMAIL_TO` are configured (see Step 4 secret table). The email is sent **only on first detection** — i.e. the same scan run that opens the tracking issue. Subsequent daily scans that find the same CVEs only add a comment to the existing issue and do **not** resend the email, so a multi-day outage of a CVE never spams the on-call alias. Closing the tracking issue (after upgrading the offending package) re-arms the email: the next scan that still finds the CVE will reopen the issue and resend the email. To pause emails for a known-irrelevant CVE without losing Slack/issue visibility, leave the tracking issue open. Both the npm and container scan jobs run this independently, so each surface has its own dedup window.
   - Uploads `audit.json` / `trivy.json` + a high/critical advisory list as a 30-day artifact.
   This catches CVEs published against already-pinned deps that no PR would otherwise touch.
3. **Weekly unresolved-alert digest — `weekly-digest` job in `.github/workflows/security-alerts.yml`.** Runs every Monday at 13:00 UTC (and on `workflow_dispatch`). Lists every currently-open GitHub issue labelled `security,automated` and emails a single digest to `SECURITY_ALERT_EMAIL_TO` via `.github/scripts/send-security-digest.mjs`. Each entry shows the issue number, title, age (in days since opened), the date of the most recent activity (last comment or update), and a direct link. Skips silently when `SENDGRID_API_KEY` / `SECURITY_ALERT_EMAIL_TO` are not configured, matching the per-detection email step. The per-detection email above only pages on first detection of a CVE batch (mirroring the GitHub-issue dedup), so a CVE that sits open for weeks would otherwise go silent after day 1; this digest closes that visibility gap without reintroducing daily noise. The digest payload (`digest-issues.json`) is uploaded as a 30-day artifact for auditability.
4. **Deploy gate — `.github/workflows/deploy-cloudrun.yml`.** Before authenticating to GCP, the deploy job runs `npm audit --omit=dev --audit-level=critical`. A critical CVE in the production dep tree blocks the Cloud Run deploy entirely. We gate on `critical` only (not `high`) so a noisy-but-non-exploitable high doesn't block hotfixes; on-call still sees highs via the daily Slack ping.

Dependabot (`.github/dependabot.yml`) opens the PRs that *fix* these CVEs on a weekly cadence; the scheduled scan + deploy gate above ensure nothing slips through between Dependabot runs.

### Validating the on-call email alias after a secret rotation

The SendGrid email step in the daily scan only fires on *first detection* of a new CVE batch, so a rotated `SENDGRID_API_KEY`, a revoked verified sender, or a deleted `SECURITY_ALERT_EMAIL_TO` alias can sit broken for weeks before anyone notices. To exercise the full SendGrid path on demand:

1. Open the **Security Alerts (Scheduled)** workflow in the GitHub Actions UI (`.github/workflows/security-alerts.yml`).
2. Click **Run workflow**, tick **Send a synthetic [TEST] CVE alert through SendGrid to validate the on-call email path**, and run it.
3. The `email-smoke-test` job posts a clearly-marked `[TEST]` advisory through `.github/scripts/send-security-email.mjs` using the production secrets, and fails red on any non-2xx response from SendGrid (or if `SENDGRID_API_KEY` / `SECURITY_ALERT_EMAIL_TO` are missing). The real `audit` / `container-scan` / `suppression-expiry` jobs are skipped on a test run so it stays cheap.
4. Confirm with on-call that the `[TEST]` email actually landed in the distribution-list inbox — SendGrid 2xx only proves the API accepted the message, not deliverability to the recipient.

Recommended cadence: run this after every `SENDGRID_API_KEY` rotation, after any change to `SECURITY_ALERT_EMAIL_TO` / `SECURITY_ALERT_EMAIL_FROM`, and as a quarterly heartbeat so a silently-broken integration cannot hide between real CVE batches.

---

## Staging environment

### Overview

Every push to `main` that touches server/web code automatically deploys to the `tabula-medica-staging` Cloud Run service before any production traffic is touched. QA and on-call engineers validate on staging, then promote to production by pushing a `v*` tag (e.g. `v1.4.2`), which triggers the manual-approval gate.

| Attribute | Value |
|---|---|
| Cloud Run service | `tabula-medica-staging` |
| Region | `us-central1` |
| URL | `https://tabula-medica-staging-<hash>-uc.a.run.app` (auto-assigned on first deploy; run `gcloud run services describe tabula-medica-staging --region=us-central1 --format='value(status.url)'` to retrieve) |
| `NODE_ENV` | `staging` |
| Database secret | `DATABASE_URL_STAGING` — **separate staging DB, isolated from production** |
| Other secrets | Shared Secret Manager versions as production (`PHI_ENCRYPTION_KEY`, `SESSION_SECRET`, `GCS_*`, etc.) |
| Service accounts | Same `cloud-run-runtime` / `cloud-run-deploy` SAs as production |
| PHI handling | Same BAA-covered services as production; staging DB must contain demo/synthetic data only — NO real patient records |

> **HIPAA isolation guarantee:** The `deploy-staging` CI job mounts `DATABASE_URL_STAGING` (not `DATABASE_URL`) as the `DATABASE_URL` environment variable inside the container. Staging can therefore never write to — or read from — the production patient database, even if a migration or bulk-write runs on the staging service.

### Staging database setup

The staging database must be a **separate** Neon branch or Cloud SQL instance, not a copy of the production connection string. Populate it with synthetic or demo data only.

**1. Provision the database**

Option A — Neon branch (recommended for low cost):
```bash
# In the Neon console: Projects → your project → Branches → New branch
# Name it "staging". Copy the connection string.
```

Option B — Cloud SQL (same GCP project, simplest IAM path):
```bash
gcloud sql instances create tabula-medica-staging \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --storage-type=SSD \
  --storage-size=10GB

gcloud sql databases create tabula_staging --instance=tabula-medica-staging
```

**2. Push the secret to Secret Manager**

```bash
# Replace the connection string with the real staging DB URL.
echo "postgresql://user:pass@host:5432/staging_db?sslmode=require" | \
  gcloud secrets create DATABASE_URL_STAGING \
    --data-file=- \
    --replication-policy=automatic

# Grant the Cloud Run runtime SA read access.
gcloud secrets add-iam-policy-binding DATABASE_URL_STAGING \
  --member="serviceAccount:cloud-run-runtime@united-planet-485003-n7.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

To rotate the staging DB URL later:
```bash
echo "postgresql://new-url..." | \
  gcloud secrets versions add DATABASE_URL_STAGING --data-file=-
```

**3. Run Drizzle migrations against staging**

```bash
DATABASE_URL="postgresql://user:pass@staging-host:5432/staging_db?sslmode=require" \
  npx drizzle-kit push
```

**4. Seed with demo / synthetic data**

Load the reviewer demo account and any fixture data your QA team needs. Do NOT copy rows from the production database.

### One-time provisioning

Prerequisites: run `scripts/bootstrap-gcp-cloudrun.sh` first (creates service accounts, WIF, shared secrets), then complete the staging database setup above. Then:

```bash
gcloud auth login
gcloud config set project united-planet-485003-n7
bash scripts/bootstrap-gcp-cloudrun-staging.sh
```

The script:
1. Verifies the production SAs exist.
2. Verifies `DATABASE_URL_STAGING` and all other required secrets exist in Secret Manager (fails if `DATABASE_URL_STAGING` is absent).
3. Reports the staging service URL if the service already exists, or prints instructions to trigger the first deploy.
4. Prints a summary of the required GitHub `production` Environment steps (see below).

The `tabula-medica-staging` Cloud Run service itself is created automatically on the **first push to main** that triggers the `deploy-staging` CI job. You do not need to pre-create it.

### Post-deploy staging smoke

After every successful `deploy-staging`, the `smoke-staging` CI job runs two checks in sequence:

1. **Liveness check** — hits `GET /api/health` on the staging URL and retries for up to ~60 seconds. A Slack alert fires in `#ops-releases` on failure.

2. **Reviewer-login auth check** — runs `scripts/smoke-test-reviewer-login.sh` against the staging URL using the `REVIEWER_EMAIL` / `REVIEWER_PASSWORD` GitHub repo secrets (the same credentials used by the production post-deploy and post-promotion smoke jobs). This catches broken reviewer auth on staging **before** a commit is promoted to production via a `v*` tag, where a broken reviewer account would block App Store review.

   If the auth check fails, a Slack alert fires in `#ops-releases` with an explicit **"do NOT promote to production until staging auth is fixed"** message. The alert includes the structured PASS/FAIL summary from the script. A recovery ping fires automatically when staging auth passes again on the next main-branch push.

   The step exits 0 with a warning (and skips the live curl checks) if `REVIEWER_EMAIL` is not set in the repo secrets — a staging environment that hasn't had the credentials propagated yet will not block merges to main.

Consult staging logs in Cloud Run before promoting:

```bash
gcloud run services logs read tabula-medica-staging --region=us-central1 --limit=100
```

---

## Setting up the production approval gate (GitHub Environments)

The `promote-production` CI job uses `environment: production`, which causes GitHub to pause the job and wait for a required reviewer to approve before the Cloud Run deploy runs. **This gate is inert until the `production` environment is created in GitHub Settings.**

### One-time GitHub setup (do this before cutting the first `v*` tag)

1. Navigate to your GitHub repository → **Settings** → **Environments** → **New environment**.
2. Name it exactly `production` (case-sensitive — the workflow uses `environment: production`).
3. Under **Environment protection rules**:
   - Enable **Required reviewers** and add the on-call engineers (minimum 1, recommended 2).
   - Enable **Prevent self-review** if your team size allows.
4. Under **Deployment branches and tags**:
   - Select **Selected branches and tags**.
   - Click **Add deployment branch or tag rule** → choose **Tag** → pattern `v*`.
   - This restricts the environment so only `v*` tags can trigger it; branch pushes to `main` route to staging only and cannot accidentally invoke the production gate.
5. Click **Save protection rules**.

### How the promotion flow works end-to-end

```
git push origin main          # triggers: server-tests + jest-tests + script-tests → deploy-staging → smoke-staging
                              #   smoke-staging runs two checks in sequence:
                              #     1. GET /api/health liveness (retries ~60 s)
                              #     2. reviewer-login auth smoke (scripts/smoke-test-reviewer-login.sh)
                              #   Slack alert fires in #ops-releases on either failure.
                              # production is untouched

git tag v1.4.2 && git push origin v1.4.2
                              # triggers: server-tests + jest-tests + script-tests → promote-production (PAUSED)
                              #   ↳ GitHub shows "Waiting for approval" in the Actions UI
                              #   ↳ required reviewers receive an email + GitHub notification
                              # reviewer approves → npm CVE gate + container CVE gate → Cloud Run deploy → promote-smoke
```

### What reviewers see and do

When a `v*` tag is pushed, GitHub emails every required reviewer with a link to the pending deployment. Reviewers open the link, inspect the workflow run (test results, diff, staging smoke status), and click **Approve and deploy** or **Reject**. The deploy only proceeds after approval. Rejections do not affect production; the tag remains and can be re-approved later.

### Tag naming convention

Follow semantic versioning: `vMAJOR.MINOR.PATCH` (e.g. `v1.4.2`). Hotfix tags: `v1.4.3`. The `v*` glob in the environment protection rules and in `deploy-cloudrun.yml` matches all of these.

---

## What this does NOT close (still on the PM action list)

1. **Auth0 BAA.** `[Auth0-Hardening] BAA Executed: NO` is still in the startup logs. Even if the server moves to Cloud Run, identity claims (which include patient identifiers) still flow through Auth0. Either sign Auth0 Enterprise BAA or migrate to Firebase Auth / Google Identity Platform under the same GCP BAA.
2. **GCP BAA scope confirmation** for both Cloud Run AND Vertex AI generative models — Step 0 above.
3. **Database hosting.** If your `DATABASE_URL` points to Neon, confirm Neon's BAA status. If it points to Replit's bundled Postgres, that's the same gap as the app server. Cloud SQL on the same GCP project is the cleanest path.
