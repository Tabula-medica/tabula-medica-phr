import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import yaml from 'js-yaml';

const root = fileURLToPath(new URL('../../', import.meta.url));
const workflow = yaml.load(readFileSync(
  resolve(root, '.github/workflows/deploy-cloudrun.yml'), 'utf8',
));
const gate = workflow.jobs['build-web'];
const ciWorkflow = yaml.load(readFileSync(
  resolve(root, '.github/workflows/ci-cd.yml'), 'utf8',
));
const configurations = [
  { workflow, gateId: 'build-web', deployJobs: ['deploy', 'deploy-staging', 'promote-production'] },
  { workflow: ciWorkflow, gateId: 'web-build', deployJobs: ['deploy-backend'] },
];

for (const { workflow: currentWorkflow, gateId, deployJobs } of configurations) {
test(`${gateId}: web compilation and output smoke check are mandatory deploy gates`, () => {
  const gate = currentWorkflow.jobs[gateId];
  assert.ok(gate, `${gateId} job must exist`);
  assert.equal(gate.if, undefined, 'gate must run for every deployment trigger');
  assert.equal(gate['continue-on-error'], undefined);
  const steps = gate.steps;
  const installIndex = steps.findIndex(step => step.run === 'npm ci');
  const buildIndex = steps.findIndex(step => step.run === 'npm run build:web');
  const smokeIndex = steps.findIndex(step => step.run === 'test -s dist/web/index.html');
  assert.ok(installIndex >= 0 && buildIndex > installIndex && smokeIndex > buildIndex,
    'install, build, and nonempty entry-point check must run in order');
  for (const step of steps) {
    assert.equal(step.if, undefined, 'build gate steps must not skip or override failure');
    assert.equal(step['continue-on-error'], undefined);
  }
  for (const jobId of deployJobs) {
    assert.ok(currentWorkflow.jobs[jobId].needs.includes(gateId),
      `${jobId} must wait for web compilation and its smoke check`);
    // Status-check overrides can let jobs run even when a dependency fails.
    assert.doesNotMatch(currentWorkflow.jobs[jobId].if ?? '', /\b(always|failure|cancelled)\s*\(/);
  }
});
}

test('workflow edits trigger the deployment gates', () => {
  assert.ok(workflow.on.push.paths.includes('.github/workflows/deploy-cloudrun.yml'));
});

test('entry-point smoke check rejects missing or empty output and accepts generated HTML', () => {
  const dir = mkdtempSync(join(tmpdir(), 'web-build-gate-'));
  try {
    const command = gate.steps.find(step => step.run === 'test -s dist/web/index.html').run;
    const check = () => spawnSync('bash', ['-e', '-c', command], { cwd: dir }).status;
    assert.equal(check(), 1, 'missing bundle must fail');
    mkdirSync(join(dir, 'dist/web'), { recursive: true });
    writeFileSync(join(dir, 'dist/web/index.html'), '');
    assert.equal(check(), 1, 'empty bundle must fail');
    writeFileSync(join(dir, 'dist/web/index.html'), '<!doctype html><html></html>');
    assert.equal(check(), 0, 'nonempty entry point must pass');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
