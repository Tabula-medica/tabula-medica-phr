/**
 * Exercise the real manifest canary in disposable repositories. No tracked
 * files are mutated, so these tests can run alongside the server canaries.
 * Run with: node --test scripts/__tests__/ci-guard-manifest-coverage.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CANARY = 'server/__tests__/ci-guard-file-canary.test.ts';
const META = 'server/__tests__/ci-guard-file-canary-meta.test.ts';
const MANIFEST = 'server/__tests__/ci-guard-manifest.json';
const ACTION = '.github/actions/assert-required-checks/action.yml';

function runFixture(extraFiles) {
  const root = mkdtempSync(join(tmpdir(), 'ci-guard-coverage-'));
  try {
    const write = (path, content) => {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), content);
    };
    write('package.json', '{"type":"module"}');
    const manifest = JSON.parse(readFileSync(join(ROOT, MANIFEST), 'utf8'));
    for (const [dir, files] of Object.entries(manifest)) {
      for (const file of files) write(`${dir}/${file}`, 'test("fixture", () => {});\n');
    }
    for (const file of [CANARY, META, MANIFEST, ACTION]) {
      mkdirSync(dirname(join(root, file)), { recursive: true });
      copyFileSync(join(ROOT, file), join(root, file));
    }
    for (const file of extraFiles) write(file, 'test("new file", () => {});\n');
    // Do not inherit node:test's private child protocol: it produces binary
    // events instead of human-readable assertion messages in nested processes.
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const result = spawnSync(process.execPath, [
      '--import', import.meta.resolve('tsx'), join(root, CANARY),
    ], { cwd: root, env, encoding: 'utf8', timeout: 30_000 });
    assert.ifError(result.error);
    assert.equal(result.signal, null, 'Canary must exit normally, not time out or crash');
    return { status: result.status, output: result.stdout + result.stderr };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('complete manifest passes, excluding ordinary server tests and the watcher/meta pair', () => {
  const result = runFixture([
    'server/__tests__/patient-records.test.ts',
    'server/__tests__/ai-guardrail.test.ts',
  ]);
  assert.equal(result.status, 0, result.output);
});

test('every new script test must be in the manifest, regardless of its name', () => {
  const files = [
    'scripts/__tests__/new-thing.test.mjs',
    'scripts/__tests__/another-thing.test.mjs',
  ];
  const result = runFixture(files);
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /MANIFEST COVERAGE GAP/);
  for (const file of files) assert.ok(result.output.includes(file.split('/').at(-1)), result.output);
  assert.match(result.output, /Bump MANIFEST_MIN_ENTRIES/);
});

test('new server guard and canary tests fail loudly when omitted from the manifest', () => {
  const files = [
    'server/__tests__/new-release-guard.test.ts',
    'server/__tests__/guard-new-release.test.ts',
    'server/__tests__/new-release-canary.test.ts',
  ];
  const result = runFixture(files);
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /MANIFEST COVERAGE GAP/);
  for (const file of files) assert.ok(result.output.includes(file.split('/').at(-1)), result.output);
  assert.match(result.output, /Add it to the "server\/__tests__" array/);
});
