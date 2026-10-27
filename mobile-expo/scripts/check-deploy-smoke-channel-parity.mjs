#!/usr/bin/env node
/**
 * check-deploy-smoke-channel-parity.mjs
 *
 * Asserts that the `channel:` field on every paired Slack-notification step
 * shared between `.github/workflows/deploy-cloudrun.yml` and
 * `.github/workflows/post-deploy-smoke.yml` is identical in both files, and
 * that the `channel:` field carries the expected value on every notification
 * step in the other workflow files that use post-slack-notification.
 *
 * Paired steps checked (deploy-cloudrun.yml smoke job  <->  post-deploy-smoke.yml):
 *   1. Notify Slack on version-smoke failure   — channel must match
 *   2. Notify Slack on version-smoke recovery  — channel must match
 *   3. Notify Slack on smoke failure           — channel must match
 *   4. Notify Slack on smoke recovery          — channel must match
 *
 * Non-paired deploy-cloudrun.yml steps checked for expected channel value:
 *   5. Notify Slack on deploy failure          — channel must equal '#ops-releases'
 *   6. Notify Slack on deploy recovery         — channel must equal '#ops-releases'
 *
 *   These steps live in the `deploy` job (not the smoke job) and have no
 *   corresponding step in post-deploy-smoke.yml, so cross-file parity is not
 *   applicable. They are intentionally on '#ops-releases', the same channel
 *   as the paired smoke steps, so engineers receive all deploy-pipeline alerts
 *   in one place.
 *
 * Security-alerts steps checked for expected channel value:
 *   7. Notify Slack on high/critical CVEs              — channel must equal '#ops-releases'
 *   8. Notify Slack on high/critical container CVEs    — channel must equal '#ops-releases'
 *
 * reviewer-login-scheduled.yml steps checked for expected channel value:
 *   9. Notify Slack on reviewer credentials failure    — channel must equal '#ops-releases'
 *  10. Notify Slack on reviewer credentials recovery   — channel must equal '#ops-releases'
 *  11. Notify Slack on reviewer login smoke-test failure  — channel must equal '#ops-releases'
 *  12. Notify Slack on reviewer login smoke-test recovery — channel must equal '#ops-releases'
 *
 * ci-cd.yml steps checked for expected channel value (three jobs):
 *  reviewer-login-gate job (state keys shared with reviewer-login-scheduled.yml):
 *  13. Notify Slack on reviewer credentials failure    — channel must equal '#ops-releases'
 *  14. Notify Slack on reviewer credentials recovery   — channel must equal '#ops-releases'
 *  15. Notify Slack on reviewer login smoke-test failure  — channel must equal '#ops-releases'
 *  16. Notify Slack on reviewer login smoke-test recovery — channel must equal '#ops-releases'
 *  eas-build-ios job:
 *  17. Notify Slack on iOS client ID check failure     — channel must equal '#ops-releases'
 *  18. Notify Slack on iOS client ID check recovery    — channel must equal '#ops-releases'
 *  eas-build-android job:
 *  19. Notify Slack on Android client ID check failure — channel must equal '#ops-releases'
 *  20. Notify Slack on Android client ID check recovery — channel must equal '#ops-releases'
 *
 *   NOTE: ci-cd.yml's reviewer-login-gate steps (13–16) share state keys with
 *   reviewer-login-scheduled.yml steps (9–12) — both must use the same channel
 *   so ops can't tell which workflow posted the alert. The named value assertions
 *   in both files enforce this independently without a cross-file comparison.
 *
 *   NOTE: ci-cd.yml's iOS/Android client-ID steps (17–20) use SLACK_OPS_WEBHOOK_URL,
 *   unlike deploy-cloudrun.yml's SLACK_WEBHOOK_URL. No counterpart exists in other
 *   workflow files so value assertions replace cross-file parity.
 *
 * codeowners-gate-check.yml steps checked for expected channel value:
 *  21. Notify Slack on gate misconfiguration          — channel must equal '#ops-releases'
 *
 *   NOTE: codeowners-gate-check.yml uses SLACK_WEBHOOK_URL (the security webhook,
 *   same as security-alerts.yml), not SLACK_OPS_WEBHOOK_URL. The channel value
 *   is still '#ops-releases' so all security alerts land in one channel.
 *   This is an intentional divergence in webhook secret, not channel destination.
 *
 * uptime-smoke.yml steps checked for expected channel value:
 *  22. Notify Slack on uptime failure                 — channel must equal '#ops-releases'
 *  23. Notify Slack on uptime recovery                — channel must equal '#ops-releases'
 *
 *   NOTE: uptime-smoke.yml uses SLACK_WEBHOOK_URL (same as codeowners-gate-check.yml
 *   and security-alerts.yml), not SLACK_OPS_WEBHOOK_URL. The channel value is still
 *   '#ops-releases'. This is an intentional divergence in webhook secret, not channel
 *   destination — the uptime alerts are operational and belong in the same channel as
 *   deploy-pipeline alerts.
 *
 * All-call-sites sweep (independent of parity):
 *   Workflow files are auto-discovered from .github/workflows/*.yml and *.yaml.
 *   Any Slack workflow or individual step without named assertions fails CI.
 *   Every `post-slack-notification` call site in the discovered workflow files is
 *   checked for a non-empty `channel:` field. This catches the case where a
 *   developer removes `channel:` from both sides of a pair simultaneously — the
 *   parity comparison would still pass (both sides equally missing) but this
 *   sweep catches the absence.
 *
 * Webhook-secret sweep:
 *   Every notification step in the seven workflows must reference the exact
 *   secret in EXPECTED_WEBHOOK_SECRETS below, independently of channel parity.
 *   This validates source references only, not repository secret contents or
 *   Slack workspace configuration; it never reads secrets or sends messages.
 *
 * A divergence or missing channel field fails CI before the PR can merge,
 * preventing on-call from receiving alerts in different channels from the
 * auto-triggered and manually-triggered smoke workflows.
 *
 * Usage:
 *   node scripts/check-deploy-smoke-channel-parity.mjs
 */

import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Preserve the intentional routing split, even though channels share a name.
export const EXPECTED_WEBHOOK_SECRETS = Object.freeze({
  // Deploy and manual smoke alerts already use the shared/security webhook.
  '.github/workflows/deploy-cloudrun.yml': 'SLACK_WEBHOOK_URL',
  '.github/workflows/post-deploy-smoke.yml': 'SLACK_WEBHOOK_URL',
  '.github/workflows/security-alerts.yml': 'SLACK_WEBHOOK_URL',
  // Reviewer checks share recovery state and must both use the ops webhook.
  // CI/CD's build and critical-gate notifications also use this ops secret.
  '.github/workflows/reviewer-login-scheduled.yml': 'SLACK_OPS_WEBHOOK_URL',
  '.github/workflows/ci-cd.yml': 'SLACK_OPS_WEBHOOK_URL',
  // Intentional exceptions: CODEOWNERS and uptime (including SLO) alerts use
  // the security webhook, NOT the ops webhook, despite being operational.
  '.github/workflows/codeowners-gate-check.yml': 'SLACK_WEBHOOK_URL',
  '.github/workflows/uptime-smoke.yml': 'SLACK_WEBHOOK_URL',
});

/**
 * Check actual step inputs, not comments or text embedded in run/markdown.
 * Parsing YAML also prevents a missing input from borrowing the next step's
 * webhook. Report only the expected secret name, never a possibly literal URL.
 * @returns {string[]} Failures including workflow, job and notification step.
 */
export function findNotificationStepsWithWrongWebhook(source, filePath) {
  const expectedSecret = EXPECTED_WEBHOOK_SECRETS[filePath];
  if (!expectedSecret) return [`[${filePath}] has no expected webhook secret mapping`];

  let workflow;
  try {
    workflow = yaml.load(source);
  } catch {
    // YAML parser errors can contain source snippets; do not expose URLs.
    return [`[${filePath}] cannot check webhook secrets: invalid workflow YAML`];
  }

  const failures = [];
  let notificationCount = 0;
  for (const [jobId, job] of Object.entries(workflow?.jobs ?? {})) {
    for (const [index, step] of (job?.steps ?? []).entries()) {
      if (step?.uses !== './.github/actions/post-slack-notification') continue;
      notificationCount += 1;
      const label = `[${filePath}] job "${jobId}" step "${step.name ?? step.id ?? index + 1}"`;
      const value = step.with?.webhook_url;
      if (typeof value !== 'string' || !value.trim()) {
        failures.push(`${label} is missing a non-empty webhook_url: input; expected secrets.${expectedSecret}`);
        continue;
      }
      // Accept expression whitespace and YAML quote styles, but no fallback,
      // env/vars indirection, literal URLs, or merely mentioning the right name.
      const secret = value.trim().match(/^\$\{\{\s*secrets\.([A-Za-z_][A-Za-z0-9_]*)\s*\}\}$/)?.[1];
      if (secret !== expectedSecret) {
        failures.push(`${label} must use webhook_url: \${{ secrets.${expectedSecret} }} (wrong secret or expression)`);
      }
    }
  }
  if (notificationCount === 0) {
    failures.push(`[${filePath}] has no post-slack-notification steps to check`);
  }
  return failures;
}

/**
 * Discover real Slack action steps, not mentions in comments or run scripts.
 * Both GitHub workflow extensions are supported; invalid YAML fails closed.
 */
export function discoverNotificationWorkflows(root = ROOT) {
  const workflowsDir = resolve(root, '.github/workflows');
  return readdirSync(workflowsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.ya?ml$/.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const path = `.github/workflows/${entry.name}`;
      const text = readFileSync(resolve(root, path), 'utf8');
      let workflow;
      try {
        workflow = yaml.load(text);
      } catch {
        // Parser diagnostics can expose source snippets containing webhook URLs.
        throw new Error(`[${path}] cannot discover Slack steps: invalid workflow YAML`);
      }
      const hasNotification = Object.values(workflow?.jobs ?? {}).some((job) =>
        Array.isArray(job?.steps) && job.steps.some((step) =>
          step?.uses === './.github/actions/post-slack-notification'));
      return hasNotification ? [{ path, yaml: text }] : [];
    });
}

export function findWorkflowsWithoutNamedAssertions(workflows, namedAssertionFiles) {
  const covered = new Set(namedAssertionFiles);
  return workflows
    .filter(({ path }) => !covered.has(path))
    .map(({ path }) =>
      `[${path}] uses post-slack-notification but has no named assertions. ` +
      'Add named channel-value assertions for its notification steps to ' +
      'scripts/check-deploy-smoke-channel-parity.mjs and include the workflow in the webhook checks ' +
      'by adding its expected secret to EXPECTED_WEBHOOK_SECRETS.');
}

export function findNotificationStepsWithoutNamedAssertions(workflows, assertions) {
  const key = ({ path, jobId, stepName }) => JSON.stringify([path, jobId, stepName]);
  const covered = new Set(assertions.map(key));
  const failures = [];
  for (const { path, yaml: source } of workflows) {
    for (const [jobId, job] of Object.entries(yaml.load(source)?.jobs ?? {})) {
      for (const [index, step] of (job?.steps ?? []).entries()) {
        if (step?.uses !== './.github/actions/post-slack-notification') continue;
        if (!covered.has(key({ path, jobId, stepName: step.name }))) {
          failures.push(
            `[${path}] job "${jobId}" step "${step.name ?? step.id ?? index + 1}" has no named channel assertion. ` +
            'Add a named channel-value assertion for this job and step to scripts/check-deploy-smoke-channel-parity.mjs.',
          );
        }
      }
    }
  }
  return failures;
}

/**
 * Scan every `post-slack-notification` call site in a workflow YAML string and
 * assert that each one has a non-empty `channel:` field.
 *
 * Unlike the parity check — which compares paired steps and would treat two
 * equally-missing channel fields as equal — this sweep detects absence
 * independently, regardless of what any paired file contains.
 *
 * @param {string} yaml     - Full text of the workflow YAML file.
 * @param {string} filePath - Human-readable file path used in error messages.
 * @returns {string[]} Array of failure messages; empty means all sites pass.
 */
export function findNotificationStepsWithoutChannel(yaml, filePath) {
  const failures = [];
  const usePattern = /uses:\s*\.\/\.github\/actions\/post-slack-notification/g;
  let match;

  while ((match = usePattern.exec(yaml)) !== null) {
    const usesIdx = match.index;

    // Resolve the step name by scanning backwards for the nearest `name:` line.
    const preceding = yaml.slice(0, usesIdx);
    const nameMatches = [...preceding.matchAll(/name:\s*(.+)/g)];
    const stepName = nameMatches.length > 0
      ? nameMatches[nameMatches.length - 1][1].trim()
      : `(unknown step at offset ${usesIdx})`;

    // Bound the search scope to this step only: stop at the next sibling step.
    const nextStepIdx = yaml.indexOf('\n      - name:', usesIdx);
    const scopeEnd = nextStepIdx === -1 ? yaml.length : nextStepIdx;
    const scope = yaml.slice(usesIdx, scopeEnd);

    // Match channel: in double-quoted, single-quoted, or unquoted form.
    const channelMatch = scope.match(
      /channel:\s*(?:"([^"]+)"|'([^']+)'|([^#\n'"][^\n]*))/,
    );
    if (!channelMatch) {
      failures.push(
        `[${filePath}] step "${stepName}" is missing a channel: field`,
      );
      continue;
    }

    const raw = (channelMatch[1] ?? channelMatch[2] ?? channelMatch[3]).trim();
    const channel =
      channelMatch[3] !== undefined ? raw.replace(/\s+#.*$/, '') : raw;

    if (!channel || channel.trim() === '') {
      failures.push(
        `[${filePath}] step "${stepName}" has an empty channel: field`,
      );
    }
  }

  return failures;
}

// ── Main (only when run directly, not when imported for testing) ─────────────

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMain) {
  // Build coverage from the named assertions that actually execute, rather
  // than a separate allowlist that could be updated without adding checks.
  const namedAssertions = [];
  const extractChannelName = (text, stepName, path, expectedJobId) => {
    let workflow;
    try {
      workflow = yaml.load(text);
    } catch {
      throw new Error(`[${path}] cannot check named channels: invalid workflow YAML`);
    }
    const matches = Object.entries(workflow?.jobs ?? {}).flatMap(([jobId, job]) =>
      (job?.steps ?? [])
        .filter((step) => step?.uses === './.github/actions/post-slack-notification' &&
          step.name === stepName && (expectedJobId === undefined || expectedJobId === jobId))
        .map((step) => ({ jobId, step })));
    if (matches.length !== 1) {
      throw new Error(`[${path}] named channel assertion for "${stepName}" must select exactly one Slack step; specify its job when names repeat`);
    }
    const { jobId, step } = matches[0];
    namedAssertions.push({ path, jobId, stepName });
    return step.with?.channel;
  };

  const DEPLOY_PATH     = '.github/workflows/deploy-cloudrun.yml';
  const MANUAL_PATH     = '.github/workflows/post-deploy-smoke.yml';
  const SECURITY_PATH   = '.github/workflows/security-alerts.yml';
  const SCHEDULED_PATH  = '.github/workflows/reviewer-login-scheduled.yml';
  const CICD_PATH       = '.github/workflows/ci-cd.yml';
  const CODEOWNERS_PATH = '.github/workflows/codeowners-gate-check.yml';
  const UPTIME_PATH     = '.github/workflows/uptime-smoke.yml';

  const deployYaml      = readFileSync(resolve(ROOT, DEPLOY_PATH), 'utf8');
  const manualYaml      = readFileSync(resolve(ROOT, MANUAL_PATH), 'utf8');
  const securityYaml    = readFileSync(resolve(ROOT, SECURITY_PATH), 'utf8');
  const scheduledYaml   = readFileSync(resolve(ROOT, SCHEDULED_PATH), 'utf8');
  const cicdYaml        = readFileSync(resolve(ROOT, CICD_PATH), 'utf8');
  const codeownersYaml  = readFileSync(resolve(ROOT, CODEOWNERS_PATH), 'utf8');
  const uptimeYaml      = readFileSync(resolve(ROOT, UPTIME_PATH), 'utf8');

  const VERSION_SMOKE_FAILURE  = 'Notify Slack on version-smoke failure';
  const VERSION_SMOKE_RECOVERY = 'Notify Slack on version-smoke recovery';
  const SMOKE_FAILURE          = 'Notify Slack on smoke failure';
  const SMOKE_RECOVERY         = 'Notify Slack on smoke recovery';
  const DEPLOY_FAILURE         = 'Notify Slack on deploy failure';
  const DEPLOY_RECOVERY        = 'Notify Slack on deploy recovery';
  const NPM_CVE                = 'Notify Slack on high/critical CVEs';
  const CONTAINER_CVE          = 'Notify Slack on high/critical container CVEs';
  const CREDS_FAILURE          = 'Notify Slack on reviewer credentials failure';
  const CREDS_RECOVERY         = 'Notify Slack on reviewer credentials recovery';
  const LOGIN_SMOKE_FAILURE    = 'Notify Slack on reviewer login smoke-test failure';
  const LOGIN_SMOKE_RECOVERY   = 'Notify Slack on reviewer login smoke-test recovery';
  const IOS_FAILURE            = 'Notify Slack on iOS client ID check failure';
  const IOS_RECOVERY           = 'Notify Slack on iOS client ID check recovery';
  const ANDROID_FAILURE        = 'Notify Slack on Android client ID check failure';
  const ANDROID_RECOVERY       = 'Notify Slack on Android client ID check recovery';
  const GATE_MISCONFIG         = 'Notify Slack on gate misconfiguration';
  const UPTIME_FAILURE         = 'Notify Slack on uptime failure';
  const UPTIME_RECOVERY        = 'Notify Slack on uptime recovery';

  const EXPECTED_CHANNEL = '#ops-releases';

  let allPassed = true;

  // ── 1–4: Cross-file parity checks ─────────────────────────────────────────

  const pairs = [
    {
      label: 'version-smoke-failure channel',
      deploy: extractChannelName(deployYaml,  VERSION_SMOKE_FAILURE,  DEPLOY_PATH),
      manual: extractChannelName(manualYaml,  VERSION_SMOKE_FAILURE,  MANUAL_PATH),
    },
    {
      label: 'version-smoke-recovery channel',
      deploy: extractChannelName(deployYaml,  VERSION_SMOKE_RECOVERY, DEPLOY_PATH),
      manual: extractChannelName(manualYaml,  VERSION_SMOKE_RECOVERY, MANUAL_PATH),
    },
    {
      label: 'smoke-failure channel',
      deploy: extractChannelName(deployYaml,  SMOKE_FAILURE,          DEPLOY_PATH),
      manual: extractChannelName(manualYaml,  SMOKE_FAILURE,          MANUAL_PATH),
    },
    {
      label: 'smoke-recovery channel',
      deploy: extractChannelName(deployYaml,  SMOKE_RECOVERY,         DEPLOY_PATH),
      manual: extractChannelName(manualYaml,  SMOKE_RECOVERY,         MANUAL_PATH),
    },
  ];

  for (const { label, deploy, manual } of pairs) {
    if (deploy === manual && deploy === EXPECTED_CHANNEL) {
      console.log(`  PASS  ${label}`);
    } else {
      console.error(`  FAIL  ${label}`);
      console.error(`    ${DEPLOY_PATH}:`);
      console.error(`      ${JSON.stringify(deploy)}`);
      console.error(`    ${MANUAL_PATH}:`);
      console.error(`      ${JSON.stringify(manual)}`);
      allPassed = false;
    }
  }

  // ── 5–6: Non-paired deploy-cloudrun.yml channel-value checks ─────────────
  // These steps live in the `deploy` job and have no counterpart in
  // post-deploy-smoke.yml, so cross-file parity is not applicable. Both must
  // use '#ops-releases' so all deploy-pipeline alerts land in one channel.

  const deployOnlySteps = [
    { label: 'deploy-failure channel', stepName: DEPLOY_FAILURE },
    { label: 'deploy-recovery channel', stepName: DEPLOY_RECOVERY },
  ];

  for (const { label, stepName } of deployOnlySteps) {
    let channel;
    try {
      channel = extractChannelName(deployYaml, stepName, DEPLOY_PATH);
    } catch (err) {
      console.error(`  FAIL  ${label} — ${err.message}`);
      allPassed = false;
      continue;
    }
    if (channel === EXPECTED_CHANNEL) {
      console.log(`  PASS  ${label}  (${channel})`);
    } else {
      console.error(`  FAIL  ${label} — expected "${EXPECTED_CHANNEL}", got "${channel}" in ${DEPLOY_PATH}`);
      allPassed = false;
    }
  }

  // ── 7–8: Security-alerts channel-value checks ─────────────────────────────

  const securitySteps = [
    { label: 'npm-cve channel',       stepName: NPM_CVE },
    { label: 'container-cve channel', stepName: CONTAINER_CVE },
  ];

  for (const { label, stepName } of securitySteps) {
    let channel;
    try {
      channel = extractChannelName(securityYaml, stepName, SECURITY_PATH);
    } catch (err) {
      console.error(`  FAIL  ${label} — ${err.message}`);
      allPassed = false;
      continue;
    }
    if (channel === EXPECTED_CHANNEL) {
      console.log(`  PASS  ${label}  (${channel})`);
    } else {
      console.error(`  FAIL  ${label} — expected "${EXPECTED_CHANNEL}", got "${channel}" in ${SECURITY_PATH}`);
      allPassed = false;
    }
  }

  // ── 9–12: reviewer-login-scheduled.yml channel-value checks ───────────────
  // These steps have no cross-file pair (the workflow is standalone), so we
  // assert the expected channel value directly. The state keys are shared with
  // ci-cd.yml's reviewer-login-gate job — both must use the same channel so
  // ops receives a consistent alert regardless of which workflow fired.

  const scheduledSteps = [
    { label: 'scheduled: reviewer-credentials-failure channel', stepName: CREDS_FAILURE },
    { label: 'scheduled: reviewer-credentials-recovery channel', stepName: CREDS_RECOVERY },
    { label: 'scheduled: reviewer-login-smoke-failure channel', stepName: LOGIN_SMOKE_FAILURE },
    { label: 'scheduled: reviewer-login-smoke-recovery channel', stepName: LOGIN_SMOKE_RECOVERY },
  ];

  for (const { label, stepName } of scheduledSteps) {
    let channel;
    try {
      channel = extractChannelName(scheduledYaml, stepName, SCHEDULED_PATH);
    } catch (err) {
      console.error(`  FAIL  ${label} — ${err.message}`);
      allPassed = false;
      continue;
    }
    if (channel === EXPECTED_CHANNEL) {
      console.log(`  PASS  ${label}  (${channel})`);
    } else {
      console.error(`  FAIL  ${label} — expected "${EXPECTED_CHANNEL}", got "${channel}" in ${SCHEDULED_PATH}`);
      allPassed = false;
    }
  }

  // ── 13–20: ci-cd.yml channel-value checks ─────────────────────────────────
  // ci-cd.yml has three jobs with Slack notification steps:
  //   reviewer-login-gate (13–16): state keys shared with reviewer-login-scheduled.yml.
  //   eas-build-ios (17–18): iOS Google client-ID check, no counterpart in other files.
  //   eas-build-android (19–20): Android client-ID check, no counterpart in other files.
  // All must use '#ops-releases' so all release-pipeline alerts land in one channel.

  const cicdSteps = [
    { label: 'ci-cd: reviewer-credentials-failure channel', stepName: CREDS_FAILURE },
    { label: 'ci-cd: reviewer-credentials-recovery channel', stepName: CREDS_RECOVERY },
    { label: 'ci-cd: reviewer-login-smoke-failure channel', stepName: LOGIN_SMOKE_FAILURE },
    { label: 'ci-cd: reviewer-login-smoke-recovery channel', stepName: LOGIN_SMOKE_RECOVERY },
    { label: 'ci-cd: ios-client-id-failure channel', stepName: IOS_FAILURE },
    { label: 'ci-cd: ios-client-id-recovery channel', stepName: IOS_RECOVERY },
    { label: 'ci-cd: android-client-id-failure channel', stepName: ANDROID_FAILURE },
    { label: 'ci-cd: android-client-id-recovery channel', stepName: ANDROID_RECOVERY },
  ];

  for (const { label, stepName } of cicdSteps) {
    let channel;
    try {
      channel = extractChannelName(cicdYaml, stepName, CICD_PATH);
    } catch (err) {
      console.error(`  FAIL  ${label} — ${err.message}`);
      allPassed = false;
      continue;
    }
    if (channel === EXPECTED_CHANNEL) {
      console.log(`  PASS  ${label}  (${channel})`);
    } else {
      console.error(`  FAIL  ${label} — expected "${EXPECTED_CHANNEL}", got "${channel}" in ${CICD_PATH}`);
      allPassed = false;
    }
  }

  // ── 21: codeowners-gate-check.yml channel-value check ─────────────────────
  // Uses SLACK_WEBHOOK_URL (the security webhook, same as security-alerts.yml),
  // not SLACK_OPS_WEBHOOK_URL. This is an intentional divergence in webhook
  // secret — the channel destination ('#ops-releases') is the same so all
  // security alerts land in one place.

  const codeownersSteps = [
    { label: 'codeowners: gate-misconfiguration channel', stepName: GATE_MISCONFIG },
  ];

  for (const { label, stepName } of codeownersSteps) {
    let channel;
    try {
      channel = extractChannelName(codeownersYaml, stepName, CODEOWNERS_PATH);
    } catch (err) {
      console.error(`  FAIL  ${label} — ${err.message}`);
      allPassed = false;
      continue;
    }
    if (channel === EXPECTED_CHANNEL) {
      console.log(`  PASS  ${label}  (${channel})`);
    } else {
      console.error(`  FAIL  ${label} — expected "${EXPECTED_CHANNEL}", got "${channel}" in ${CODEOWNERS_PATH}`);
      allPassed = false;
    }
  }

  // ── 22–23: uptime-smoke.yml channel-value checks ───────────────────────────
  // Uses SLACK_WEBHOOK_URL (same as codeowners-gate-check.yml and
  // security-alerts.yml), not SLACK_OPS_WEBHOOK_URL. This is an intentional
  // divergence in webhook secret — the channel destination ('#ops-releases')
  // is the same so all uptime and deploy-pipeline alerts land in one channel.

  const uptimeSteps = [
    { label: 'uptime: failure channel', stepName: UPTIME_FAILURE },
    { label: 'uptime: recovery channel', stepName: UPTIME_RECOVERY },
  ];

  for (const { label, stepName } of uptimeSteps) {
    let channel;
    try {
      channel = extractChannelName(uptimeYaml, stepName, UPTIME_PATH);
    } catch (err) {
      console.error(`  FAIL  ${label} — ${err.message}`);
      allPassed = false;
      continue;
    }
    if (channel === EXPECTED_CHANNEL) {
      console.log(`  PASS  ${label}  (${channel})`);
    } else {
      console.error(`  FAIL  ${label} — expected "${EXPECTED_CHANNEL}", got "${channel}" in ${UPTIME_PATH}`);
      allPassed = false;
    }
  }

  // ── All-call-sites channel-presence sweep ──────────────────────────────────
  // This check is independent of parity: it finds every post-slack-notification
  // call site across all discovered files and asserts a non-empty channel: field is
  // present. It catches the "both sides equally missing" case that the parity
  // comparison above cannot detect, and also covers any step that only has a
  // value assertion (not a cross-file pair) but still requires a non-empty
  // channel field.

  const sweepFiles = discoverNotificationWorkflows();
  // Additional notifications introduced outside the original paired checks.
  // Keep each job/name explicit so adding a step never implicitly covers it.
  const additionalAssertions = [
    [DEPLOY_PATH, deployYaml, 'deploy-staging', 'Notify Slack on staging deploy failure'],
    [DEPLOY_PATH, deployYaml, 'smoke-staging', 'Notify Slack on staging health smoke failure'],
    [DEPLOY_PATH, deployYaml, 'smoke-staging', 'Notify Slack on staging auth smoke failure'],
    [DEPLOY_PATH, deployYaml, 'smoke-staging', 'Notify Slack on staging auth smoke recovery'],
    [DEPLOY_PATH, deployYaml, 'promote-production', 'Notify Slack on production promotion'],
    [DEPLOY_PATH, deployYaml, 'promote-production', 'Notify Slack on production promotion failure'],
    [DEPLOY_PATH, deployYaml, 'promote-smoke', 'Notify Slack on promotion smoke failure'],
    [DEPLOY_PATH, deployYaml, 'promote-smoke', 'Notify Slack on promotion smoke recovery'],
    [CICD_PATH, cicdYaml, 'jest-tests', 'Notify Slack on Jest tests failure'],
    [CICD_PATH, cicdYaml, 'security', 'Notify Slack on security scanning failure'],
    [UPTIME_PATH, uptimeYaml, 'uptime', 'Notify Slack on SLO failure'],
  ];
  for (const [path, text, jobId, stepName] of additionalAssertions) {
    const channel = extractChannelName(text, stepName, path, jobId);
    if (channel !== EXPECTED_CHANNEL) {
      console.error(`  FAIL  [${path}] job "${jobId}" step "${stepName}" must use channel "${EXPECTED_CHANNEL}"`);
      allPassed = false;
    }
  }
  const coverageFailures = [
    ...findWorkflowsWithoutNamedAssertions(sweepFiles, namedAssertions.map(({ path }) => path)),
    ...findNotificationStepsWithoutNamedAssertions(sweepFiles, namedAssertions),
  ];
  for (const message of coverageFailures) {
    console.error(`  FAIL  ${message}`);
    allPassed = false;
  }
  if (coverageFailures.length === 0) {
    console.log('  PASS  every discovered Slack workflow and notification step has named channel assertions');
  }

  let allSitesPassed = true;
  for (const { yaml, path } of sweepFiles) {
    const failures = findNotificationStepsWithoutChannel(yaml, path);
    if (failures.length === 0) {
      console.log(`  PASS  all post-slack-notification steps in ${path} have a non-empty channel field`);
    } else {
      for (const msg of failures) {
        console.error(`  FAIL  ${msg}`);
      }
      allSitesPassed = false;
    }
  }
  if (!allSitesPassed) allPassed = false;

  for (const { yaml, path } of sweepFiles) {
    const failures = findNotificationStepsWithWrongWebhook(yaml, path);
    if (failures.length === 0) {
      console.log(`  PASS  all notification webhooks in ${path} use secrets.${EXPECTED_WEBHOOK_SECRETS[path]}`);
    } else {
      for (const message of failures) console.error(`  FAIL  ${message}`);
      allPassed = false;
    }
  }

  if (!allPassed) {
    console.error(
      '\nDeploy/smoke channel parity check FAILED.\n' +
      'Ensure every paired notification step uses the same channel: value,\n' +
      'every post-slack-notification call site carries a non-empty channel: field,\n' +
      'every webhook_url: input references the secret in EXPECTED_WEBHOOK_SECRETS,\n' +
      'every discovered Slack workflow has named assertions in this checker,\n' +
      `and that all standalone notification steps carry the expected "${EXPECTED_CHANNEL}" value.\n` +
      `Files checked: ${DEPLOY_PATH}  <->  ${MANUAL_PATH}  and  ` +
      `${SECURITY_PATH},  ${SCHEDULED_PATH},  ${CICD_PATH},  ${CODEOWNERS_PATH},  ${UPTIME_PATH}`,
    );
    process.exit(1);
  }

  console.log('\nAll Slack channel fields match and all workflow notification steps use the expected channel and webhook secret.');
}
