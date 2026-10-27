# CVE triage runbook (container scans)

This runbook tells on-call **when to silence a container CVE in
[`.trivyignore.yaml`](../.trivyignore.yaml) and when to fix it instead**. It
covers advisories surfaced by the Trivy jobs in
[`.github/workflows/security-alerts.yml`](../.github/workflows/security-alerts.yml)
(daily scan + monthly suppression review) and the deploy-time CVE gate in
[`.github/workflows/deploy-cloudrun.yml`](../.github/workflows/deploy-cloudrun.yml).

> **Scope.** This document is about *container / OS-package* CVEs reported by
> Trivy. JS dependency CVEs from `npm audit` are handled by Dependabot PRs and
> are out of scope — there is no suppression file for them and the deploy
> blocks on `--audit-level=critical` unconditionally.

---

## 1. Where alerts come from

| Source | What it does | What you should do |
| --- | --- | --- |
| `container-scan` job in `security-alerts.yml` (daily, 13:00 UTC) | Builds the production `Dockerfile` and runs Trivy at `HIGH,CRITICAL`, `ignore-unfixed: true`. Posts Slack + opens a `[security] Trivy found high/critical container CVEs` GitHub issue. | Triage per §3 below within one business day. |
| Deploy-time gate in `deploy-cloudrun.yml` | Same image, but only blocks on `CRITICAL`. A failed deploy here means a critical CVE landed between scans, **or** a suppression just expired. | If a critical is real, fix per §4. If it was a stale suppression, refresh per §5. Never bypass the gate by widening severity. |
| `suppression-expiry` job in `security-alerts.yml` (1st of each month) | Re-reads `.trivyignore.yaml` and opens `[security] Trivy suppression review needed` for any entry that is expired, malformed, or expiring within 30 days. | Walk every listed entry and either refresh `expired_at` with a fresh justification, or delete it. |

The Slack alert template links back here — that link comes from
[`.github/workflows/security-alerts.yml`](../.github/workflows/security-alerts.yml).

---

## 2. How to read a Trivy advisory line

The container-scan job writes lines like this into the GitHub issue body and
the workflow summary:

```
[CRITICAL] tabula-medica-web:scan (debian 12.5) — libxml2 2.9.14+dfsg-1.3~deb12u1 → 2.9.14+dfsg-1.3~deb12u2 (CVE-2024-12345)
```

| Field | Meaning |
| --- | --- |
| `CRITICAL` / `HIGH` | Severity Trivy assigned. The deploy gate only blocks on `CRITICAL`. |
| `tabula-medica-web:scan (debian 12.5)` | Image + the layer/target the package lives in. `debian 12.5` means it came in via the `node:20-slim` base image, not via our app. |
| `libxml2 2.9.14+dfsg-1.3~deb12u1` | Installed package and version. |
| `→ 2.9.14+dfsg-1.3~deb12u2` | Fixed version. `no fix` means upstream has no patch yet — the entry was filtered out by `ignore-unfixed: true` for scans, but check anyway. |
| `CVE-2024-12345` | Advisory ID. Click through to the NVD entry to read the affected functions and the vector. |

Open the full report from the workflow run artifact (`trivy-container-<run_id>`
→ `trivy.json`) when you need the CVSS vector, the affected functions, or the
file paths Trivy matched.

---

## 3. Decision tree: silence vs. fix

Apply these in order. **Default to fix.** Suppression is the exception.

1. **Is a fixed upstream version available *and* is bumping `FROM node:20-slim`
   (or rebuilding to pull the latest patch tag) enough to clear it?**
   → **Fix.** Rebuild on the patched base image and redeploy. This is the
   normal path and should clear the majority of OS-package CVEs without any
   `.trivyignore.yaml` change.

2. **Is the vulnerable code actually invoked from any production code path?**
   Run:
   ```
   rg -n "<binary_or_symbol>" server/ scripts/ Dockerfile
   ```
   - If **yes** → **Fix** even if the base-image bump is painful (pin a
     transitional package version in the `Dockerfile`, or carry a temporary
     `apt-get install` for the patched build).
   - If **no** → continue to step 3.

3. **Is the package a CLI binary or library that we never call at runtime
   (e.g. `imagemagick`, `git`, `curl`, an alt build of `openssl` shipped for
   another tool)?**
   - **Yes, and** the package cannot be removed from the image without
     breaking the build → **Silence** per §5, with `expired_at` set to the
     date you expect the upstream Debian package to be patched (check
     <https://security-tracker.debian.org/>).
   - **Yes, and** the package can simply be removed → prefer
     `apt-get purge` in the `Dockerfile` over a suppression. A removed
     package can't regress.

4. **Is there no upstream fix yet *and* the CVE is exploitable in our runtime?**
   → **Escalate**, do not silence. Page Security, consider rolling back the
   feature that introduced the dependency, or accept the deploy block until a
   fix lands. Do not widen the gate.

5. **Is there no upstream fix yet *and* the CVE is not exploitable in our
   runtime (e.g. requires a code path we don't have)?**
   → **Silence** per §5 with a short `expired_at` (≤ 60 days) and a link to
   the analysis. Re-review when the entry expires.

Things that **never** justify a suppression:

- "It's noisy and blocks my hotfix." → Rebuild on the patched base image.
- "We'll fix it next sprint." → Use a Dependabot/base-image bump PR, not the
  ignore file. The ignore file is for permanent or upstream-blocked
  decisions, not scheduling.
- "CVSS looks low." → Severity is already gated to HIGH/CRITICAL; if Trivy
  says it's CRITICAL, trust it until you've done step 2.
- "I don't know what this CVE is about." → Read the NVD entry first.

---

## 4. How to fix (the common case)

For a base-image CVE, this is almost always the entire fix:

1. In `Dockerfile`, confirm the base tag (e.g. `FROM node:20-slim`).
2. Trigger a fresh build — `docker buildx build --no-cache --pull` locally,
   or merge a no-op commit so CI rebuilds without the layer cache. The
   `node:20-slim` tag is a moving pointer and will pick up the patched
   Debian packages on the next pull.
3. Re-run the container scan via `workflow_dispatch` on
   `security-alerts.yml` and confirm the CVE is gone.
4. Close the `[security] Trivy found high/critical container CVEs` issue.
   The next scheduled scan will reopen it if anything is still outstanding.

If the moving tag has not been republished yet, pin to the next minor
(e.g. `node:20.18-slim` → `node:20.19-slim`) in the `Dockerfile`.

---

## 5. How to silence (when steps 1–4 don't apply)

1. Open `.trivyignore.yaml` and add an entry with **all three required
   fields** (the file header has the full schema):
   ```yaml
   vulnerabilities:
     - id: CVE-2024-12345
       statement: |
         Affects libxml2 XPath parser shipped in node:20-slim. We do not
         parse untrusted XML in any production code path (verified by
         `rg "libxml|xml2|DOMParser" server/`). Upstream Debian fix
         tracked at https://security-tracker.debian.org/tracker/CVE-2024-12345.
         Triage: SEC-1234 / Slack thread <link>.
       expired_at: 2026-07-15
   ```
   - `statement` MUST explain **why this is not exploitable in our runtime**
     and link to the triage ticket or Slack thread. `"not exploitable"` alone
     will be flagged as malformed by the monthly review job.
   - `expired_at` MUST be ≤ 90 days out. Pick a date when you genuinely
     expect the upstream fix (or our base-image bump) to be in.
2. Record the triage decision in the **GitHub issue that the
   container-scan job opened**. Paste the new YAML block, the
   `rg`/code-search output that proves the code path is unreachable, and a
   link to the NVD entry. The issue is the canonical record — do not rely on
   commit messages alone, because the suppression review issue references
   CVE IDs and reviewers will look for the original triage there.
3. Open the PR. **Required approver: Security on-call** (not just any team
   member). The PR description must repeat the justification and link the
   tracking issue.
4. After merge, re-run the container scan workflow and confirm the advisory
   is filtered out. Close the tracking issue.

---

## 6. Responding to the monthly suppression-expiry issue

When `[security] Trivy suppression review needed` appears:

1. Walk every entry in the **Expired / malformed** section first. For each:
   - If the CVE is now fixed upstream → delete the entry from
     `.trivyignore.yaml` and let the scan confirm it's clean.
   - If still unfixed but the original justification still holds → bump
     `expired_at` (≤ 90 days) and add a one-line comment to the issue
     explaining what changed in the re-review.
   - If the justification no longer holds → delete the entry and treat the
     CVE as a fresh finding (back to §3).
2. Then walk the **Expiring within 30 days** section the same way — better
   to refresh proactively than to discover a stale suppression via a
   blocked deploy.
3. Close the issue once `.trivyignore.yaml` is clean. The next monthly run
   will reopen it if anything new is expiring.

---

## 7. Approvals and audit trail

- **Approver for any `.trivyignore.yaml` change:** Security on-call. This is
  a HIPAA-relevant control surface; a self-approved suppression is a finding.
- **How that's enforced (not just convention):** [`.github/CODEOWNERS`](../.github/CODEOWNERS)
  declares `@tabula-medica/security` as the owner of `.trivyignore.yaml`, and
  the `main` branch protection rule has **"Require review from Code Owners"**
  enabled, requires **at least 1 approving review**, and is **enforced for
  administrators** (GitHub's "Include administrators" / `enforce_admins`). Any
  PR that touches the suppression file therefore auto-requests the Security
  team and cannot be merged on the author's approval alone — and because admin
  enforcement is on and at least one approval is required, even repo admins go
  through the same gate rather than quietly bypassing it. If you are Security
  on-call and the request didn't auto-route to you, check that you are a member
  of the `@tabula-medica/security` GitHub team; do not work around it by editing
  CODEOWNERS in the same PR.
- **Where the decision is recorded:** the tracking GitHub issue opened by
  the `container-scan` job (or the suppression-expiry issue for refreshes),
  not the commit message.
- **Where the policy file lives:** `.trivyignore.yaml` at repo root. It is
  consumed by both the daily scan and the deploy gate via the
  `trivyignores:` input — do not fork it.
- **Automated verification that the gate is still wired up:** the
  [`codeowners-gate-check.yml`](../.github/workflows/codeowners-gate-check.yml)
  workflow runs weekly (Mondays 14:00 UTC, plus on-demand via
  `workflow_dispatch`) and asserts the GitHub-side settings this section
  depends on: that `main` branch protection has **"Require review from Code
  Owners"** enabled (`required_pull_request_reviews.require_code_owner_reviews
  = true`), requires at least one approving review
  (`required_pull_request_reviews.required_approving_review_count >= 1` — a
  count of 0 would let a suppression PR merge with no review), is **enforced
  for administrators** (`enforce_admins.enabled = true` — otherwise a repo
  admin could quietly bypass the code-owner gate), and that every team named in
  [`.github/CODEOWNERS`](../.github/CODEOWNERS) for `.trivyignore.yaml`
  (currently `@tabula-medica/security`) exists with ≥ 1 member. On failure it
  opens a `[security] CODEOWNERS gate misconfigured` issue and posts to the
  same Slack channel as `security-alerts.yml`; it auto-closes the issue once
  the gate is healthy again. The check needs a `SECURITY_GATE_GITHUB_TOKEN`
  repo secret (a PAT or GitHub App token with repo administration + `read:org`)
  because branch-protection and org-team membership are not readable by the
  default `GITHUB_TOKEN` — if that secret is missing the check reports a
  "could not verify" finding rather than silently passing.
