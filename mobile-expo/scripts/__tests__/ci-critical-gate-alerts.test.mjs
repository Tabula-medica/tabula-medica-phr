import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import yaml from 'js-yaml';

const { jobs } = yaml.load(
  readFileSync(new URL('../../.github/workflows/ci-cd.yml', import.meta.url), 'utf8'),
);
const action = './.github/actions/post-slack-notification';
const reviewerAlert = jobs['reviewer-login-gate'].steps.find(
  (step) => step.name === 'Notify Slack on reviewer credentials failure',
);
const runUrl = '${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}';

for (const [jobId, alertName, condition, label] of [
  ['jest-tests', 'Notify Slack on Jest tests failure', 'failure()', 'jest-tests'],
  ['security', 'Notify Slack on security scanning failure', 'failure()', 'security'],
  [
    'eas-build-ios',
    'Notify Slack on iOS client ID check failure',
    "failure() && steps.check-ios-client-id.conclusion == 'failure'",
    'iOS Google client ID check',
  ],
  [
    'eas-build-android',
    'Notify Slack on Android client ID check failure',
    "failure() && steps.check-android-client-id.conclusion == 'failure'",
    'Android Google client ID check',
  ],
]) {
  test(`${jobId} alerts on failure using the reviewer gate's Slack destination`, () => {
    const steps = jobs[jobId].steps;
    const alert = steps.find((step) => step.name === alertName);
    assert.ok(alert, `${jobId} is missing its failure notification`);
    assert.equal(alert.if, condition, 'Must run on failure, not success or cancellation');
    assert.equal(alert.uses, action);
    assert.equal(alert.with.webhook_url, reviewerAlert.with.webhook_url);
    assert.equal(alert.with.channel, reviewerAlert.with.channel);
    assert.equal(alert.with.run_url, runUrl);
    assert.ok(alert.with.fallback_text.includes(label));
    assert.ok(alert.with.markdown.includes(label));
    assert.ok(alert.with.markdown.includes('<{run_url}|'), 'Must link to the failed run');
    if (jobId === 'jest-tests' || jobId === 'security') {
      assert.equal(steps.at(-1), alert, 'Job alert must follow every blocking step');
    }
  });
}
