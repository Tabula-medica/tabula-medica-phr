#!/usr/bin/env node
/**
 * Unit tests for check-deploy-smoke-channel-parity.mjs.
 *
 * The parity checker re-uses extractChannelName from
 * check-reviewer-alert-parity.mjs (tested separately in
 * check-reviewer-alert-parity.test.mjs). These tests focus on the
 * *integration* logic of the new checker: that it correctly identifies
 * matching vs. mismatched channels across deploy-cloudrun.yml and
 * post-deploy-smoke.yml, validates expected values in the other workflow
 * files, and that the all-call-sites sweep detects missing channel fields —
 * using the real live workflow files on disk.
 *
 * Run with: node scripts/__tests__/check-deploy-smoke-channel-parity.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync, symlinkSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractChannelName } from '../check-reviewer-alert-parity.mjs';
import yaml from 'js-yaml';
import {
  findNotificationStepsWithoutChannel,
  findNotificationStepsWithWrongWebhook,
  EXPECTED_WEBHOOK_SECRETS,
  discoverNotificationWorkflows,
  findWorkflowsWithoutNamedAssertions,
  findNotificationStepsWithoutNamedAssertions,
} from '../check-deploy-smoke-channel-parity.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// ── Helpers ──────────────────────────────────────────────────────────────────

function loadWorkflow(relPath) {
  return readFileSync(resolve(ROOT, relPath), 'utf8');
}

// Keep fixtures under the repo so subprocesses resolve the same dependencies.
function withWorkflowFixture(run) {
  const root = mkdtempSync(resolve(ROOT, '.parity-fixture-'));
  mkdirSync(resolve(root, '.github/workflows'), { recursive: true });
  try {
    run(root, (name, text) =>
      writeFileSync(resolve(root, '.github/workflows', name), text));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const newSlackWorkflow = `
name: New notification workflow
on: push
jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - name: New Slack alert
        uses: './.github/actions/post-slack-notification'
        with:
          webhook_url: \${{ secrets.SLACK_OPS_WEBHOOK_URL }}
          channel: '#ops-releases'
`;

test('discovery finds both workflow extensions and ignores non-workflow files and directories', () => {
  withWorkflowFixture((root, write) => {
    write('new.yml', newSlackWorkflow);
    write('another.yaml', newSlackWorkflow);
    write('notes.txt', newSlackWorkflow);
    mkdirSync(resolve(root, '.github/workflows/directory.yml'));
    const workflows = discoverNotificationWorkflows(root);
    assert.deepEqual(workflows.map(({ path }) => path), [
      '.github/workflows/another.yaml',
      '.github/workflows/new.yml',
    ]);
    assert.equal(workflows[0].yaml, newSlackWorkflow);
  });
});

test('discovery ignores action mentions in comments, commands and message text', () => {
  withWorkflowFixture((root, write) => {
    write('mentions.yml', `
name: Not a Slack workflow
# uses: ./.github/actions/post-slack-notification
jobs:
  test:
    steps:
      - run: |
          uses: ./.github/actions/post-slack-notification
      - uses: actions/github-script@v7 # post-slack-notification
        with:
          script: |
            console.log('uses: ./.github/actions/post-slack-notification');
`);
    assert.deepEqual(discoverNotificationWorkflows(root), []);
  });
});

test('discovery fails closed on invalid workflow YAML', () => {
  withWorkflowFixture((root, write) => {
    write('broken.yaml', 'jobs: [https://example.invalid/private-webhook');
    assert.throws(() => discoverNotificationWorkflows(root), (error) => {
      assert.match(error.message, /broken\.yaml.*invalid workflow YAML/);
      assert.ok(!error.message.includes('private-webhook'));
      return true;
    });
  });
});

test('new Slack workflow needs named assertions even with a valid channel and webhook', () => {
  withWorkflowFixture((root, write) => {
    write('new.yaml', newSlackWorkflow);
    const workflows = discoverNotificationWorkflows(root);
    const failures = findWorkflowsWithoutNamedAssertions(workflows, ['.github/workflows/other.yml']);
    assert.equal(failures.length, 1);
    assert.match(failures[0], /\.github\/workflows\/new\.yaml/);
    assert.match(failures[0], /Add named channel-value assertions/);
    assert.match(failures[0], /scripts\/check-deploy-smoke-channel-parity\.mjs/);
    assert.match(failures[0], /webhook checks/);
    assert.deepEqual(findWorkflowsWithoutNamedAssertions(
      workflows, new Set(['.github/workflows/new.yaml']),
    ), []);
  });
});

test('step assertion coverage is scoped to the workflow, job and name', () => {
  const source = yaml.load(newSlackWorkflow);
  source.jobs.other = structuredClone(source.jobs.notify);
  source.jobs.notify.steps.push({
    name: 'Another alert',
    uses: './.github/actions/post-slack-notification',
    with: { channel: '#unmonitored' },
  });
  const path = '.github/workflows/new.yaml';
  const failures = findNotificationStepsWithoutNamedAssertions(
    [{ path, yaml: yaml.dump(source) }],
    [{ path, jobId: 'notify', stepName: 'New Slack alert' }],
  );
  assert.equal(failures.length, 2);
  assert.match(failures[0], /job "notify" step "Another alert"/);
  assert.match(failures[1], /job "other" step "New Slack alert"/);
});

test('CLI rejects unchecked workflows and new steps in already-covered workflows', () => {
  withWorkflowFixture((root, write) => {
    cpSync(resolve(ROOT, '.github/workflows'), resolve(root, '.github/workflows'), { recursive: true });
    mkdirSync(resolve(root, 'scripts'));
    for (const name of ['check-deploy-smoke-channel-parity.mjs', 'check-reviewer-alert-parity.mjs']) {
      cpSync(resolve(ROOT, 'scripts', name), resolve(root, 'scripts', name));
    }
    const run = () => spawnSync(process.execPath, [
      resolve(root, 'scripts/check-deploy-smoke-channel-parity.mjs'),
    ], { encoding: 'utf8', timeout: 10000 });
    const baseline = run();
    assert.equal(baseline.status, 0, baseline.stderr);
    write('new-alert.yaml', newSlackWorkflow);
    const result = run();
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /new-alert\.yaml.*has no named assertions/);
    assert.match(result.stderr, /Add named channel-value assertions/);
    assert.match(result.stderr, /parity check FAILED/);
    rmSync(resolve(root, '.github/workflows/new-alert.yaml'));

    const original = loadWorkflow('.github/workflows/ci-cd.yml');
    for (const stepName of ['New wrong-channel alert', undefined]) {
      const workflow = yaml.load(original);
      workflow.jobs['jest-tests'].steps.push({
        ...(stepName ? { name: stepName } : {}),
        uses: './.github/actions/post-slack-notification',
        with: {
          channel: '#unmonitored',
          webhook_url: '${{ secrets.SLACK_OPS_WEBHOOK_URL }}',
        },
      });
      write('ci-cd.yml', yaml.dump(workflow));
      const unchecked = run();
      assert.equal(unchecked.status, 1, unchecked.stderr);
      assert.match(unchecked.stderr, /ci-cd\.yml.*job "jest-tests".*has no named channel assertion/);
    }

    // A duplicate name in another job cannot borrow the original assertion.
    const duplicate = yaml.load(original);
    duplicate.jobs['jest-tests'].steps.push({
      name: 'Notify Slack on reviewer credentials failure',
      uses: './.github/actions/post-slack-notification',
      with: {
        channel: '#unmonitored',
        webhook_url: '${{ secrets.SLACK_OPS_WEBHOOK_URL }}',
      },
    });
    write('ci-cd.yml', yaml.dump(duplicate));
    const ambiguous = run();
    assert.equal(ambiguous.status, 1, ambiguous.stderr);
    assert.match(ambiguous.stderr, /must select exactly one Slack step/);

    const wrongExistingChannel = yaml.load(original);
    wrongExistingChannel.jobs['jest-tests'].steps.find((step) =>
      step.name === 'Notify Slack on Jest tests failure').with.channel = '#unmonitored';
    write('ci-cd.yml', yaml.dump(wrongExistingChannel));
    const wrongChannel = run();
    assert.equal(wrongChannel.status, 1, wrongChannel.stderr);
    assert.match(wrongChannel.stderr, /Jest tests failure.*must use channel "#ops-releases"/);
  });
});

// ── Live workflow files ───────────────────────────────────────────────────────

const DEPLOY_PATH     = '.github/workflows/deploy-cloudrun.yml';
const MANUAL_PATH     = '.github/workflows/post-deploy-smoke.yml';
const SECURITY_PATH   = '.github/workflows/security-alerts.yml';
const SCHEDULED_PATH  = '.github/workflows/reviewer-login-scheduled.yml';
const CICD_PATH       = '.github/workflows/ci-cd.yml';
const CODEOWNERS_PATH = '.github/workflows/codeowners-gate-check.yml';
const UPTIME_PATH     = '.github/workflows/uptime-smoke.yml';

const deployYaml      = loadWorkflow(DEPLOY_PATH);
const manualYaml      = loadWorkflow(MANUAL_PATH);
const securityYaml    = loadWorkflow(SECURITY_PATH);
const scheduledYaml   = loadWorkflow(SCHEDULED_PATH);
const cicdYaml        = loadWorkflow(CICD_PATH);
const codeownersYaml  = loadWorkflow(CODEOWNERS_PATH);
const uptimeYaml      = loadWorkflow(UPTIME_PATH);

const EXPECTED_CHANNEL = '#ops-releases';

// Independent expectations: changing the implementation's mapping must not
// silently redefine what these live-file tests consider correct.
const webhookExpectations = [
  [DEPLOY_PATH, 'SLACK_WEBHOOK_URL'],
  [MANUAL_PATH, 'SLACK_WEBHOOK_URL'],
  [SECURITY_PATH, 'SLACK_WEBHOOK_URL'],
  [SCHEDULED_PATH, 'SLACK_OPS_WEBHOOK_URL'],
  [CICD_PATH, 'SLACK_OPS_WEBHOOK_URL'],
  [CODEOWNERS_PATH, 'SLACK_WEBHOOK_URL'],
  [UPTIME_PATH, 'SLACK_WEBHOOK_URL'],
];

function notificationSteps(workflow) {
  return Object.values(workflow.jobs).flatMap(job =>
    (job.steps ?? []).filter(step => step.uses === './.github/actions/post-slack-notification'));
}

for (const [path, secret] of webhookExpectations) {
  test(`${path}: every live notification uses the intended webhook secret`, () => {
    assert.equal(EXPECTED_WEBHOOK_SECRETS[path], secret);
    const source = loadWorkflow(path);
    const steps = notificationSteps(yaml.load(source));
    assert.ok(steps.length > 0, 'Must exercise real notification steps');
    for (const step of steps) assert.equal(step.with.webhook_url, `\${{ secrets.${secret} }}`);
    assert.deepEqual(findNotificationStepsWithWrongWebhook(source, path), []);
  });

  test(`${path}: detects a swapped or missing webhook in each live notification`, () => {
    const workflow = yaml.load(loadWorkflow(path));
    const otherSecret = secret === 'SLACK_WEBHOOK_URL' ? 'SLACK_OPS_WEBHOOK_URL' : 'SLACK_WEBHOOK_URL';
    for (const step of notificationSteps(workflow)) {
      const original = step.with.webhook_url;
      // All mutations are in memory. Every call site is exercised individually,
      // including failure/recovery, SLO, deploy and critical-gate notifications.
      for (const badValue of [
        `\${{ secrets.${otherSecret} }}`,
        `\${{ secrets.${secret}_TYPO }}`,
        '', '   ', null, undefined,
        `\${{ secrets.${secret} || secrets.${otherSecret} }}`,
        `\${{ env.${secret} }}`,
        'https://example.invalid/private-webhook',
      ]) {
        if (badValue === undefined) delete step.with.webhook_url;
        else step.with.webhook_url = badValue;
        const failures = findNotificationStepsWithWrongWebhook(yaml.dump(workflow), path);
        assert.equal(failures.length, 1, `${step.name}: must flag only the mutated step`);
        assert.ok(failures[0].includes(path));
        assert.ok(failures[0].includes(step.name));
        assert.ok(failures[0].includes(`secrets.${secret}`));
        assert.ok(!failures[0].includes('https://example.invalid/private-webhook'));
      }
      step.with.webhook_url = original;
    }
  });
}

test('webhook validation accepts YAML quotes, expression whitespace and trailing comments', () => {
  const source = scheduledYaml.replaceAll(
    'webhook_url: ${{ secrets.SLACK_OPS_WEBHOOK_URL }}',
    'webhook_url: "${{secrets.SLACK_OPS_WEBHOOK_URL}}" # intentional ops routing',
  );
  assert.notEqual(source, scheduledYaml);
  assert.deepEqual(findNotificationStepsWithWrongWebhook(source, SCHEDULED_PATH), []);
});

test('a comment or markdown mention cannot replace a missing webhook input', () => {
  const source = scheduledYaml.replace(
    'webhook_url: ${{ secrets.SLACK_OPS_WEBHOOK_URL }}',
    '# webhook_url: ${{ secrets.SLACK_OPS_WEBHOOK_URL }}',
  );
  const failures = findNotificationStepsWithWrongWebhook(source, SCHEDULED_PATH);
  assert.equal(failures.length, 1);
  assert.match(failures[0], /missing a non-empty webhook_url/);
});

test('missing with block cannot borrow the following live notification webhook', () => {
  const workflow = yaml.load(scheduledYaml);
  delete notificationSteps(workflow)[0].with;
  assert.equal(findNotificationStepsWithWrongWebhook(yaml.dump(workflow), SCHEDULED_PATH).length, 1);
});

test('webhook validation fails closed for unmapped files, invalid YAML and absent notifications', () => {
  assert.match(findNotificationStepsWithWrongWebhook(scheduledYaml, 'unknown.yml')[0], /no expected webhook/);
  assert.match(findNotificationStepsWithWrongWebhook('jobs: [', SCHEDULED_PATH)[0], /invalid workflow YAML/);
  assert.match(findNotificationStepsWithWrongWebhook('jobs: {}', SCHEDULED_PATH)[0], /no post-slack-notification/);
});

test('live CI gates the combined checker on every push and PR', () => {
  const workflow = yaml.load(cicdYaml);
  assert.deepEqual(workflow.on.push.branches, ['**']);
  assert.deepEqual(workflow.on.pull_request.branches, ['**']);
  const job = workflow.jobs['web-lint'];
  assert.equal(job.if, undefined);
  const step = job.steps.find(step => step.run === 'node scripts/check-deploy-smoke-channel-parity.mjs');
  assert.ok(step, 'web-lint must execute the combined channel/webhook checker');
  assert.equal(step.if, undefined);
  assert.equal(step['continue-on-error'], undefined);
});

test('CLI exits nonzero for wrong and missing webhook references in live workflows', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'slack-webhook-check-'));
  try {
    mkdirSync(resolve(root, 'scripts'));
    mkdirSync(resolve(root, '.github/workflows'), { recursive: true });
    // Resolve the existing YAML dependency without installing or copying it.
    symlinkSync(resolve(ROOT, 'node_modules'), resolve(root, 'node_modules'), 'dir');
    for (const name of ['check-deploy-smoke-channel-parity.mjs', 'check-reviewer-alert-parity.mjs']) {
      copyFileSync(resolve(ROOT, 'scripts', name), resolve(root, 'scripts', name));
    }
    for (const [path] of webhookExpectations) {
      copyFileSync(resolve(ROOT, path), resolve(root, path));
    }
    const run = () => spawnSync(process.execPath,
      [resolve(root, 'scripts/check-deploy-smoke-channel-parity.mjs')],
      { encoding: 'utf8', timeout: 15_000 });
    assert.equal(run().status, 0, 'Unmodified live files must pass the CLI');
    for (const replacement of ['webhook_url: ${{ secrets.SLACK_WEBHOOK_URL }}', '']) {
      writeFileSync(resolve(root, SCHEDULED_PATH), scheduledYaml.replace(
        'webhook_url: ${{ secrets.SLACK_OPS_WEBHOOK_URL }}', replacement,
      ));
      const result = run();
      assert.equal(result.status, 1, result.stderr);
      assert.match(result.stderr, /reviewer-login-scheduled\.yml/);
      assert.match(result.stderr, /Notify Slack on reviewer credentials failure/);
      assert.match(result.stderr, /secrets\.SLACK_OPS_WEBHOOK_URL/);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── Live-file parity tests (deploy-cloudrun <-> post-deploy-smoke) ────────────

test('version-smoke-failure channel matches between deploy-cloudrun and post-deploy-smoke', () => {
  const stepName = 'Notify Slack on version-smoke failure';
  const deployChannel = extractChannelName(deployYaml,  stepName, DEPLOY_PATH);
  const manualChannel = extractChannelName(manualYaml,  stepName, MANUAL_PATH);
  assert.equal(
    deployChannel,
    manualChannel,
    `Channel mismatch for "${stepName}": deploy="${deployChannel}" manual="${manualChannel}"`,
  );
});

test('version-smoke-recovery channel matches between deploy-cloudrun and post-deploy-smoke', () => {
  const stepName = 'Notify Slack on version-smoke recovery';
  const deployChannel = extractChannelName(deployYaml,  stepName, DEPLOY_PATH);
  const manualChannel = extractChannelName(manualYaml,  stepName, MANUAL_PATH);
  assert.equal(
    deployChannel,
    manualChannel,
    `Channel mismatch for "${stepName}": deploy="${deployChannel}" manual="${manualChannel}"`,
  );
});

test('smoke-failure channel matches between deploy-cloudrun and post-deploy-smoke', () => {
  const stepName = 'Notify Slack on smoke failure';
  const deployChannel = extractChannelName(deployYaml,  stepName, DEPLOY_PATH);
  const manualChannel = extractChannelName(manualYaml,  stepName, MANUAL_PATH);
  assert.equal(
    deployChannel,
    manualChannel,
    `Channel mismatch for "${stepName}": deploy="${deployChannel}" manual="${manualChannel}"`,
  );
});

test('smoke-recovery channel matches between deploy-cloudrun and post-deploy-smoke', () => {
  const stepName = 'Notify Slack on smoke recovery';
  const deployChannel = extractChannelName(deployYaml,  stepName, DEPLOY_PATH);
  const manualChannel = extractChannelName(manualYaml,  stepName, MANUAL_PATH);
  assert.equal(
    deployChannel,
    manualChannel,
    `Channel mismatch for "${stepName}": deploy="${deployChannel}" manual="${manualChannel}"`,
  );
});

// ── Synthetic mismatch detection ──────────────────────────────────────────────

test('extractChannelName detects a deliberate channel mismatch', () => {
  const yamlA = `
      - name: My Alert
        uses: ./.github/actions/post-slack-notification
        with:
          webhook_url: \${{ secrets.SLACK_WEBHOOK_URL }}
          channel: '#ops-releases'
          fallback_text: 'Alert fired'
          markdown: |
            Details here.
      - name: Next Step
        run: echo done
`;
  const yamlB = `
      - name: My Alert
        uses: ./.github/actions/post-slack-notification
        with:
          webhook_url: \${{ secrets.SLACK_WEBHOOK_URL }}
          channel: '#different-channel'
          fallback_text: 'Alert fired'
          markdown: |
            Details here.
      - name: Next Step
        run: echo done
`;
  const channelA = extractChannelName(yamlA, 'My Alert', 'fileA.yml');
  const channelB = extractChannelName(yamlB, 'My Alert', 'fileB.yml');
  assert.notEqual(channelA, channelB, 'Expected channels to differ but they matched');
});

test('extractChannelName throws when channel field is absent', () => {
  const yaml = `
      - name: My Alert
        uses: ./.github/actions/post-slack-notification
        with:
          webhook_url: \${{ secrets.SLACK_WEBHOOK_URL }}
          fallback_text: 'Alert fired'
          markdown: |
            Details here.
      - name: Next Step
        run: echo done
`;
  assert.throws(
    () => extractChannelName(yaml, 'My Alert', 'missing-channel.yml'),
    /No channel found for step "My Alert"/,
  );
});

test('all four paired steps use the same expected channel value', () => {
  const pairedSteps = [
    'Notify Slack on version-smoke failure',
    'Notify Slack on version-smoke recovery',
    'Notify Slack on smoke failure',
    'Notify Slack on smoke recovery',
  ];
  for (const stepName of pairedSteps) {
    const deployChannel = extractChannelName(deployYaml, stepName, DEPLOY_PATH);
    const manualChannel = extractChannelName(manualYaml, stepName, MANUAL_PATH);
    assert.equal(deployChannel, EXPECTED_CHANNEL,
      `deploy-cloudrun.yml "${stepName}" should use "${EXPECTED_CHANNEL}", got "${deployChannel}"`);
    assert.equal(manualChannel, EXPECTED_CHANNEL,
      `post-deploy-smoke.yml "${stepName}" should use "${EXPECTED_CHANNEL}", got "${manualChannel}"`);
  }
});

// ── Non-paired deploy-cloudrun.yml step assertions ────────────────────────────
// These steps live in the `deploy` job (not the smoke job) and have no
// counterpart in post-deploy-smoke.yml. Cross-file parity is not applicable;
// instead we assert the exact expected channel value so a rename or wrong
// channel value is caught even when the all-call-sites sweep only checks for
// presence. Both steps are intentionally on '#ops-releases', the same channel
// as the paired smoke steps, so all deploy-pipeline alerts arrive in one place.

test('deploy-failure step in deploy-cloudrun.yml uses the expected channel value', () => {
  const stepName = 'Notify Slack on deploy failure';
  const channel = extractChannelName(deployYaml, stepName, DEPLOY_PATH);
  assert.equal(
    channel,
    EXPECTED_CHANNEL,
    `deploy-cloudrun.yml "${stepName}" should use "${EXPECTED_CHANNEL}", got "${channel}"`,
  );
});

test('deploy-recovery step in deploy-cloudrun.yml uses the expected channel value', () => {
  const stepName = 'Notify Slack on deploy recovery';
  const channel = extractChannelName(deployYaml, stepName, DEPLOY_PATH);
  assert.equal(
    channel,
    EXPECTED_CHANNEL,
    `deploy-cloudrun.yml "${stepName}" should use "${EXPECTED_CHANNEL}", got "${channel}"`,
  );
});

test('both security-alerts steps use the expected channel value', () => {
  const securitySteps = [
    'Notify Slack on high/critical CVEs',
    'Notify Slack on high/critical container CVEs',
  ];
  for (const stepName of securitySteps) {
    const channel = extractChannelName(securityYaml, stepName, SECURITY_PATH);
    assert.equal(channel, EXPECTED_CHANNEL,
      `security-alerts.yml "${stepName}" should use "${EXPECTED_CHANNEL}", got "${channel}"`);
  }
});

// ── reviewer-login-scheduled.yml named assertions ────────────────────────────
// These steps are standalone (no cross-file pair). The state keys are shared
// with ci-cd.yml's reviewer-login-gate job, so both files must use the same
// channel. Named value assertions enforce this independently in both files.

test('all reviewer-login-scheduled.yml notification steps use the expected channel value', () => {
  const steps = [
    'Notify Slack on reviewer credentials failure',
    'Notify Slack on reviewer credentials recovery',
    'Notify Slack on reviewer login smoke-test failure',
    'Notify Slack on reviewer login smoke-test recovery',
  ];
  for (const stepName of steps) {
    const channel = extractChannelName(scheduledYaml, stepName, SCHEDULED_PATH);
    assert.equal(
      channel,
      EXPECTED_CHANNEL,
      `reviewer-login-scheduled.yml "${stepName}" should use "${EXPECTED_CHANNEL}", got "${channel}"`,
    );
  }
});

test('reviewer-login-scheduled.yml reviewer-credentials-failure step uses the expected channel', () => {
  const stepName = 'Notify Slack on reviewer credentials failure';
  const channel = extractChannelName(scheduledYaml, stepName, SCHEDULED_PATH);
  assert.equal(channel, EXPECTED_CHANNEL,
    `reviewer-login-scheduled.yml "${stepName}" should use "${EXPECTED_CHANNEL}", got "${channel}"`);
});

test('reviewer-login-scheduled.yml reviewer-credentials-recovery step uses the expected channel', () => {
  const stepName = 'Notify Slack on reviewer credentials recovery';
  const channel = extractChannelName(scheduledYaml, stepName, SCHEDULED_PATH);
  assert.equal(channel, EXPECTED_CHANNEL,
    `reviewer-login-scheduled.yml "${stepName}" should use "${EXPECTED_CHANNEL}", got "${channel}"`);
});

test('reviewer-login-scheduled.yml reviewer-login-smoke-failure step uses the expected channel', () => {
  const stepName = 'Notify Slack on reviewer login smoke-test failure';
  const channel = extractChannelName(scheduledYaml, stepName, SCHEDULED_PATH);
  assert.equal(channel, EXPECTED_CHANNEL,
    `reviewer-login-scheduled.yml "${stepName}" should use "${EXPECTED_CHANNEL}", got "${channel}"`);
});

test('reviewer-login-scheduled.yml reviewer-login-smoke-recovery step uses the expected channel', () => {
  const stepName = 'Notify Slack on reviewer login smoke-test recovery';
  const channel = extractChannelName(scheduledYaml, stepName, SCHEDULED_PATH);
  assert.equal(channel, EXPECTED_CHANNEL,
    `reviewer-login-scheduled.yml "${stepName}" should use "${EXPECTED_CHANNEL}", got "${channel}"`);
});

// ── ci-cd.yml named assertions ────────────────────────────────────────────────
// ci-cd.yml has three jobs with Slack notification steps. All steps that share
// state keys with reviewer-login-scheduled.yml must use the same channel.
// The EAS iOS/Android client-ID steps are ci-cd-only but must also target
// '#ops-releases' so all release-pipeline alerts land in one channel.

test('ci-cd.yml reviewer-login-gate: reviewer-credentials-failure step uses the expected channel', () => {
  const stepName = 'Notify Slack on reviewer credentials failure';
  const channel = extractChannelName(cicdYaml, stepName, CICD_PATH);
  assert.equal(channel, EXPECTED_CHANNEL,
    `ci-cd.yml "${stepName}" should use "${EXPECTED_CHANNEL}", got "${channel}"`);
});

test('ci-cd.yml reviewer-login-gate: reviewer-credentials-recovery step uses the expected channel', () => {
  const stepName = 'Notify Slack on reviewer credentials recovery';
  const channel = extractChannelName(cicdYaml, stepName, CICD_PATH);
  assert.equal(channel, EXPECTED_CHANNEL,
    `ci-cd.yml "${stepName}" should use "${EXPECTED_CHANNEL}", got "${channel}"`);
});

test('ci-cd.yml reviewer-login-gate: reviewer-login-smoke-failure step uses the expected channel', () => {
  const stepName = 'Notify Slack on reviewer login smoke-test failure';
  const channel = extractChannelName(cicdYaml, stepName, CICD_PATH);
  assert.equal(channel, EXPECTED_CHANNEL,
    `ci-cd.yml "${stepName}" should use "${EXPECTED_CHANNEL}", got "${channel}"`);
});

test('ci-cd.yml reviewer-login-gate: reviewer-login-smoke-recovery step uses the expected channel', () => {
  const stepName = 'Notify Slack on reviewer login smoke-test recovery';
  const channel = extractChannelName(cicdYaml, stepName, CICD_PATH);
  assert.equal(channel, EXPECTED_CHANNEL,
    `ci-cd.yml "${stepName}" should use "${EXPECTED_CHANNEL}", got "${channel}"`);
});

test('ci-cd.yml eas-build-ios: iOS client-ID failure step uses the expected channel', () => {
  const stepName = 'Notify Slack on iOS client ID check failure';
  const channel = extractChannelName(cicdYaml, stepName, CICD_PATH);
  assert.equal(channel, EXPECTED_CHANNEL,
    `ci-cd.yml "${stepName}" should use "${EXPECTED_CHANNEL}", got "${channel}"`);
});

test('ci-cd.yml eas-build-ios: iOS client-ID recovery step uses the expected channel', () => {
  const stepName = 'Notify Slack on iOS client ID check recovery';
  const channel = extractChannelName(cicdYaml, stepName, CICD_PATH);
  assert.equal(channel, EXPECTED_CHANNEL,
    `ci-cd.yml "${stepName}" should use "${EXPECTED_CHANNEL}", got "${channel}"`);
});

test('ci-cd.yml eas-build-android: Android client-ID failure step uses the expected channel', () => {
  const stepName = 'Notify Slack on Android client ID check failure';
  const channel = extractChannelName(cicdYaml, stepName, CICD_PATH);
  assert.equal(channel, EXPECTED_CHANNEL,
    `ci-cd.yml "${stepName}" should use "${EXPECTED_CHANNEL}", got "${channel}"`);
});

test('ci-cd.yml eas-build-android: Android client-ID recovery step uses the expected channel', () => {
  const stepName = 'Notify Slack on Android client ID check recovery';
  const channel = extractChannelName(cicdYaml, stepName, CICD_PATH);
  assert.equal(channel, EXPECTED_CHANNEL,
    `ci-cd.yml "${stepName}" should use "${EXPECTED_CHANNEL}", got "${channel}"`);
});

// ci-cd.yml and reviewer-login-scheduled.yml share state keys for the
// reviewer-login-gate steps. Both files must use the same channel so ops
// receives a consistent alert regardless of which workflow fired.
test('ci-cd.yml and reviewer-login-scheduled.yml reviewer steps use the same channel (state-key consistency)', () => {
  const sharedSteps = [
    'Notify Slack on reviewer credentials failure',
    'Notify Slack on reviewer credentials recovery',
    'Notify Slack on reviewer login smoke-test failure',
    'Notify Slack on reviewer login smoke-test recovery',
  ];
  for (const stepName of sharedSteps) {
    const scheduledChannel = extractChannelName(scheduledYaml, stepName, SCHEDULED_PATH);
    const cicdChannel = extractChannelName(cicdYaml, stepName, CICD_PATH);
    assert.equal(
      scheduledChannel,
      cicdChannel,
      `State-key shared step "${stepName}": scheduled="${scheduledChannel}" ci-cd="${cicdChannel}" — must match`,
    );
  }
});

// ── codeowners-gate-check.yml named assertions ────────────────────────────────
// Uses SLACK_WEBHOOK_URL (the security webhook), not SLACK_OPS_WEBHOOK_URL.
// The channel value must still be '#ops-releases' so all security alerts land
// in one channel. The divergence in webhook secret is intentional and documented
// in the checker script.

test('codeowners-gate-check.yml gate-misconfiguration step uses the expected channel value', () => {
  const stepName = 'Notify Slack on gate misconfiguration';
  const channel = extractChannelName(codeownersYaml, stepName, CODEOWNERS_PATH);
  assert.equal(
    channel,
    EXPECTED_CHANNEL,
    `codeowners-gate-check.yml "${stepName}" should use "${EXPECTED_CHANNEL}", got "${channel}"`,
  );
});

// ── uptime-smoke.yml named assertions ─────────────────────────────────────────
// Uses SLACK_WEBHOOK_URL (same as codeowners-gate-check.yml and
// security-alerts.yml), not SLACK_OPS_WEBHOOK_URL. The channel value must
// still be '#ops-releases'. The divergence in webhook secret is intentional and
// documented in the checker script.

test('uptime-smoke.yml uptime-failure step uses the expected channel value', () => {
  const stepName = 'Notify Slack on uptime failure';
  const channel = extractChannelName(uptimeYaml, stepName, UPTIME_PATH);
  assert.equal(
    channel,
    EXPECTED_CHANNEL,
    `uptime-smoke.yml "${stepName}" should use "${EXPECTED_CHANNEL}", got "${channel}"`,
  );
});

test('uptime-smoke.yml uptime-recovery step uses the expected channel value', () => {
  const stepName = 'Notify Slack on uptime recovery';
  const channel = extractChannelName(uptimeYaml, stepName, UPTIME_PATH);
  assert.equal(
    channel,
    EXPECTED_CHANNEL,
    `uptime-smoke.yml "${stepName}" should use "${EXPECTED_CHANNEL}", got "${channel}"`,
  );
});

// ── findNotificationStepsWithoutChannel — unit tests ─────────────────────────

test('findNotificationStepsWithoutChannel returns empty array when all steps have a channel', () => {
  const yaml = `
      - name: Notify Slack on smoke failure
        uses: ./.github/actions/post-slack-notification
        with:
          webhook_url: \${{ secrets.SLACK_WEBHOOK_URL }}
          channel: '#ops-releases'
          fallback_text: 'Smoke failed'
          markdown: |
            Details here.
      - name: Notify Slack on smoke recovery
        uses: ./.github/actions/post-slack-notification
        with:
          webhook_url: \${{ secrets.SLACK_WEBHOOK_URL }}
          channel: '#ops-releases'
          fallback_text: 'Smoke recovered'
          markdown: |
            All clear.
      - name: Next Step
        run: echo done
`;
  const failures = findNotificationStepsWithoutChannel(yaml, 'test.yml');
  assert.deepEqual(failures, [], 'Expected no failures when all steps have a channel');
});

test('findNotificationStepsWithoutChannel catches a step with no channel field', () => {
  const yaml = `
      - name: Notify Slack on smoke failure
        uses: ./.github/actions/post-slack-notification
        with:
          webhook_url: \${{ secrets.SLACK_WEBHOOK_URL }}
          fallback_text: 'Smoke failed'
          markdown: |
            Details here.
      - name: Next Step
        run: echo done
`;
  const failures = findNotificationStepsWithoutChannel(yaml, 'no-channel.yml');
  assert.equal(failures.length, 1, 'Expected exactly one failure');
  assert.match(failures[0], /missing a channel: field/);
  assert.match(failures[0], /Notify Slack on smoke failure/);
});

test('findNotificationStepsWithoutChannel catches a step with an empty channel field', () => {
  const yaml = `
      - name: Notify Slack on smoke failure
        uses: ./.github/actions/post-slack-notification
        with:
          webhook_url: \${{ secrets.SLACK_WEBHOOK_URL }}
          channel: '   '
          fallback_text: 'Smoke failed'
          markdown: |
            Details here.
      - name: Next Step
        run: echo done
`;
  const failures = findNotificationStepsWithoutChannel(yaml, 'empty-channel.yml');
  assert.equal(failures.length, 1, 'Expected exactly one failure for whitespace-only channel');
  assert.match(failures[0], /empty channel: field/);
});

test('findNotificationStepsWithoutChannel catches multiple steps missing channel', () => {
  const yaml = `
      - name: Notify Slack on smoke failure
        uses: ./.github/actions/post-slack-notification
        with:
          webhook_url: \${{ secrets.SLACK_WEBHOOK_URL }}
          fallback_text: 'Smoke failed'
          markdown: |
            Details here.
      - name: Notify Slack on smoke recovery
        uses: ./.github/actions/post-slack-notification
        with:
          webhook_url: \${{ secrets.SLACK_WEBHOOK_URL }}
          fallback_text: 'Smoke recovered'
          markdown: |
            All clear.
      - name: Next Step
        run: echo done
`;
  const failures = findNotificationStepsWithoutChannel(yaml, 'multi-missing.yml');
  assert.equal(failures.length, 2, 'Expected two failures, one per missing channel');
});

test('findNotificationStepsWithoutChannel returns empty array for YAML with no post-slack-notification steps', () => {
  const yaml = `
      - name: Run tests
        run: npm test
      - name: Deploy
        run: ./deploy.sh
`;
  const failures = findNotificationStepsWithoutChannel(yaml, 'no-slack.yml');
  assert.deepEqual(failures, [], 'Expected no failures when there are no notification steps');
});

// ── "Both sides missing" gap test ─────────────────────────────────────────────
// This is the key scenario the parity check could not catch: when a developer
// removes channel: from both sides of a pair simultaneously, extractChannelName
// throws on both sides (crashing the parity script) rather than reporting a
// clean failure. findNotificationStepsWithoutChannel detects the absence on each
// file independently, regardless of what the paired file contains.

test('findNotificationStepsWithoutChannel catches both sides when channel is dropped from a paired step in both files simultaneously', () => {
  const sharedYamlNoChannel = `
      - name: Notify Slack on smoke failure
        uses: ./.github/actions/post-slack-notification
        with:
          webhook_url: \${{ secrets.SLACK_WEBHOOK_URL }}
          fallback_text: 'Smoke failed'
          markdown: |
            Details here.
      - name: Next Step
        run: echo done
`;

  const deployFailures = findNotificationStepsWithoutChannel(sharedYamlNoChannel, 'deploy-cloudrun.yml');
  const manualFailures = findNotificationStepsWithoutChannel(sharedYamlNoChannel, 'post-deploy-smoke.yml');

  assert.equal(deployFailures.length, 1, 'deploy side: expected one failure for missing channel');
  assert.equal(manualFailures.length, 1, 'manual side: expected one failure for missing channel');
  assert.match(deployFailures[0], /deploy-cloudrun\.yml/);
  assert.match(manualFailures[0], /post-deploy-smoke\.yml/);

  // Demonstrate the gap the new check closes: the parity comparison of two
  // equally-missing sides would result in extractChannelName throwing on both,
  // which means the old parity-only approach crashes rather than cleanly failing.
  assert.throws(
    () => extractChannelName(sharedYamlNoChannel, 'Notify Slack on smoke failure', 'deploy-cloudrun.yml'),
    /No channel found/,
    'parity approach: extractChannelName throws on missing channel (no clean fail)',
  );
  assert.throws(
    () => extractChannelName(sharedYamlNoChannel, 'Notify Slack on smoke failure', 'post-deploy-smoke.yml'),
    /No channel found/,
    'parity approach: extractChannelName throws on missing channel (no clean fail)',
  );
});

// ── Live-file sweep (all seven workflow files) ────────────────────────────────

test('all post-slack-notification steps in deploy-cloudrun.yml have a non-empty channel field', () => {
  const failures = findNotificationStepsWithoutChannel(deployYaml, DEPLOY_PATH);
  assert.deepEqual(
    failures,
    [],
    `Channel field missing or empty in ${DEPLOY_PATH}:\n${failures.join('\n')}`,
  );
});

test('all post-slack-notification steps in post-deploy-smoke.yml have a non-empty channel field', () => {
  const failures = findNotificationStepsWithoutChannel(manualYaml, MANUAL_PATH);
  assert.deepEqual(
    failures,
    [],
    `Channel field missing or empty in ${MANUAL_PATH}:\n${failures.join('\n')}`,
  );
});

test('all post-slack-notification steps in security-alerts.yml have a non-empty channel field', () => {
  const failures = findNotificationStepsWithoutChannel(securityYaml, SECURITY_PATH);
  assert.deepEqual(
    failures,
    [],
    `Channel field missing or empty in ${SECURITY_PATH}:\n${failures.join('\n')}`,
  );
});

test('all post-slack-notification steps in reviewer-login-scheduled.yml have a non-empty channel field', () => {
  const failures = findNotificationStepsWithoutChannel(scheduledYaml, SCHEDULED_PATH);
  assert.deepEqual(
    failures,
    [],
    `Channel field missing or empty in ${SCHEDULED_PATH}:\n${failures.join('\n')}`,
  );
});

test('all post-slack-notification steps in ci-cd.yml have a non-empty channel field', () => {
  const failures = findNotificationStepsWithoutChannel(cicdYaml, CICD_PATH);
  assert.deepEqual(
    failures,
    [],
    `Channel field missing or empty in ${CICD_PATH}:\n${failures.join('\n')}`,
  );
});

test('all post-slack-notification steps in codeowners-gate-check.yml have a non-empty channel field', () => {
  const failures = findNotificationStepsWithoutChannel(codeownersYaml, CODEOWNERS_PATH);
  assert.deepEqual(
    failures,
    [],
    `Channel field missing or empty in ${CODEOWNERS_PATH}:\n${failures.join('\n')}`,
  );
});

test('all post-slack-notification steps in uptime-smoke.yml have a non-empty channel field', () => {
  const failures = findNotificationStepsWithoutChannel(uptimeYaml, UPTIME_PATH);
  assert.deepEqual(
    failures,
    [],
    `Channel field missing or empty in ${UPTIME_PATH}:\n${failures.join('\n')}`,
  );
});
