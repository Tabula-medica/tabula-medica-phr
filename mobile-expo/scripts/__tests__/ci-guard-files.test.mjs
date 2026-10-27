#!/usr/bin/env node
/**
 * CI guard-file existence tests.
 *
 * This file acts as a persistent "canary" for security-critical test files and
 * CI steps that must never be silently removed.  It lives alongside the test
 * files it watches so it is auto-picked up by `npm run test:scripts` and always
 * executes inside the `script-tests` CI job.
 *
 * What it protects against:
 *   - scripts/__tests__/bash-guard-expansion.test.mjs being deleted: without
 *     this file the bash-level subprocess tests that verify the
 *     SKIP_REVIEWER_LOGIN_CHECK guard expansion are gone, but `node --test
 *     scripts/__tests__/*.test.mjs` would still exit 0 (other test files pass).
 *     This canary fails loudly in that case, causing the `script-tests` CI job
 *     to reject the PR before it can merge.
 *   - The ci-cd.yml `test:scripts` step being quietly dropped: asserts the step
 *     is still present in the workflow file so an accidental removal is caught
 *     on the very next push/PR by this test (which still runs via whatever
 *     invocation remains, e.g. local `npm run test:scripts`).
 *
 * Enforcement is two-layered so neither path alone is a single point of failure:
 *
 *   1. INDEPENDENT — ci-cd.yml `web-lint` job calls this file directly with
 *      `node scripts/__tests__/ci-guard-files.test.mjs`.  This layer runs
 *      regardless of whether the `script-tests` job exists or its step is
 *      present, so removing the `test:scripts` CI step is still caught on the
 *      next push/PR via the `web-lint` job.
 *
 *   2. REDUNDANT — `npm run test:scripts` (glob `scripts/__tests__/*.test.mjs`)
 *      auto-picks up this file, so it also runs inside the `script-tests` CI
 *      job as a second guard.
 *
 * Run with: node scripts/__tests__/ci-guard-files.test.mjs
 * Also invoked directly from: .github/workflows/ci-cd.yml (web-lint job)
 * Auto-picked up by: npm run test:scripts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const TESTS_DIR = join(ROOT, 'scripts', '__tests__');
const CI_WORKFLOW = join(ROOT, '.github', 'workflows', 'ci-cd.yml');
const COMPOSITE_ACTION = join(ROOT, '.github', 'actions', 'assert-required-checks', 'action.yml');

// ── bash-guard-expansion.test.mjs existence ───────────────────────────────────

test('scripts/__tests__/bash-guard-expansion.test.mjs exists on disk', () => {
  const filePath = join(TESTS_DIR, 'bash-guard-expansion.test.mjs');
  assert.ok(
    existsSync(filePath),
    `${filePath} does not exist.\n` +
    'The bash-level guard expansion tests (which verify the SKIP_REVIEWER_LOGIN_CHECK\n' +
    'bash expansion operator in smoke-test-reviewer-login.sh) have been removed.\n' +
    'Restore scripts/__tests__/bash-guard-expansion.test.mjs to re-enable the protection.',
  );
});

test('scripts/__tests__/bash-guard-expansion.test.mjs has non-empty content', () => {
  const filePath = join(TESTS_DIR, 'bash-guard-expansion.test.mjs');

  // File must exist for this test to be meaningful — the previous test
  // catches the missing-file case; this one catches an empty truncation.
  if (!existsSync(filePath)) {
    assert.fail(
      `${filePath} does not exist — see the previous test for details.`,
    );
  }

  const size = statSync(filePath).size;
  assert.ok(
    size > 0,
    `${filePath} exists but is empty (0 bytes).\n` +
    'The file must contain the bash-guard subprocess tests.\n' +
    'Restore the original content from git history.',
  );

  const content = readFileSync(filePath, 'utf8').trim();
  assert.ok(
    content.length > 0,
    `${filePath} exists but contains only whitespace.\n` +
    'The file must contain the bash-guard subprocess tests.',
  );

  // Verify the file contains at least one `test(` call so a file that was
  // replaced with a stub (e.g. `// removed`) is also caught.
  assert.ok(
    content.includes('test('),
    `${filePath} exists but does not contain any test() calls.\n` +
    'The file appears to have been stubbed out. Restore the original test content.',
  );
});

// ── CI-gates branch-protection scripts ──────────────────────────────────────

test('scripts/set-ci-gates-branch-protection.sh exists, is non-empty, and has a bash shebang', () => {
  const filePath = join(ROOT, 'scripts', 'set-ci-gates-branch-protection.sh');
  assert.ok(
    existsSync(filePath),
    `${filePath} does not exist. Restore the CI-gates branch-protection setup script.`,
  );

  const content = readFileSync(filePath, 'utf8');
  assert.ok(
    content.trim().length > 0,
    `${filePath} is empty or whitespace-only. Restore the original content from git history.`,
  );
  assert.match(
    content,
    /^#!\/usr\/bin\/env bash\r?\n/,
    `${filePath} must start with the bash shebang line: #!/usr/bin/env bash`,
  );
  // Exercise payload construction offline; never use real credentials or curl.
  const result = spawnSync('bash', ['-c', `
    curl() {
      local output=""
      while (( $# )); do
        case "$1" in
          -o) output="$2"; shift 2 ;;
          -X) [[ "$2" == GET ]] || return 1; shift 2 ;;
          *) shift ;;
        esac
      done
      printf '%s' '{"strict":true,"checks":[{"context":"existing-check","app_id":123}],"contexts":["legacy-check"]}' > "$output"
      printf '200'
    }
    export -f curl
    bash "$1"
  `, 'ci-gates-guard', filePath], {
    cwd: ROOT,
    env: { PATH: process.env.PATH, GITHUB_TOKEN: 'test-only', GITHUB_REPOSITORY: 'test/repo', DRY_RUN: '1' },
    encoding: 'utf8',
    timeout: 10_000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, `Setup dry run failed: ${result.stderr}`);
  const payloadText = result.stdout.split('  Full payload:\n')[1]?.split('[3/3]')[0].trim();
  assert.ok(payloadText, 'Setup script must construct a required-checks payload, not just contain a shebang.');
  const payload = JSON.parse(payloadText);
  assert.equal(payload.strict, true);
  assert.deepEqual(payload.contexts, ['legacy-check']);
  assert.deepEqual(payload.checks[0], { context: 'existing-check', app_id: 123 });
  for (const gate of ['server-tests', 'jest-tests', 'reviewer-login-gate', 'script-tests']) {
    assert.ok(payload.checks.some(check => check.context === gate), `Setup payload is missing ${gate}.`);
  }
});

test('scripts/verify-ci-gates-branch-protection.sh exists, is non-empty, and has a bash shebang', () => {
  const filePath = join(ROOT, 'scripts', 'verify-ci-gates-branch-protection.sh');
  assert.ok(
    existsSync(filePath),
    `${filePath} does not exist. Restore the CI-gates branch-protection verification script.`,
  );

  const content = readFileSync(filePath, 'utf8');
  assert.ok(
    content.trim().length > 0,
    `${filePath} is empty or whitespace-only. Restore the original content from git history.`,
  );
  assert.match(
    content,
    /^#!\/usr\/bin\/env bash\r?\n/,
    `${filePath} must start with the bash shebang line: #!/usr/bin/env bash`,
  );
  const result = spawnSync('bash', [filePath], {
    cwd: ROOT,
    env: { PATH: process.env.PATH, REQUIRE_BP_CHECK: '1' },
    encoding: 'utf8',
    timeout: 10_000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 1, 'Verification must fail when branch-protection checking is required but no admin token is supplied.');
  assert.match(result.stdout, /FAIL\s+REQUIRE_BP_CHECK=1 but GH_ADMIN_PAT is not set/);
  for (const gate of ['server-tests', 'jest-tests', 'reviewer-login-gate', 'script-tests']) {
    assert.ok(result.stdout.includes(`PASS    Job '${gate}:' found`), `Verification must check the ${gate} workflow job.`);
  }
});

// ── ci-cd.yml test:scripts step presence ─────────────────────────────────────

/**
 * Extract the YAML lines that belong to a top-level jobs.<jobId> block.
 * "Top-level job" in GitHub Actions YAML means a key at 2-space indent under
 * `jobs:`.  We find the job's opening line, then collect lines until the next
 * sibling job key (another 2-space-indented key that is not a continuation).
 *
 * @param {string[]} lines  - all lines of the workflow file
 * @param {string}   jobId  - the job key to extract (e.g. 'script-tests')
 * @returns {string[]}      - lines belonging to that job block, or []
 */
function extractJobBlock(lines, jobId) {
  // A top-level job key looks like exactly two leading spaces then the id + colon.
  const jobHeaderRe = new RegExp(`^  ${jobId}:`);
  const startIdx = lines.findIndex(l => jobHeaderRe.test(l));
  if (startIdx === -1) return [];

  // The job ends just before the next sibling job (another 2-space key that
  // is not blank and not purely a comment at 2-space indent, e.g. `  other-job:`).
  // We also stop at a top-level key with 0 indent (e.g. `jobs:` itself) just
  // to be safe.
  const siblingRe = /^  [a-zA-Z0-9_-]+:/;
  const topLevelRe = /^[a-zA-Z0-9_-]+:/;
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (siblingRe.test(lines[i]) || topLevelRe.test(lines[i])) {
      endIdx = i;
      break;
    }
  }
  return lines.slice(startIdx, endIdx);
}

test('ci-cd.yml contains the script-tests job with a run: npm run test:scripts step', () => {
  assert.ok(
    existsSync(CI_WORKFLOW),
    `${CI_WORKFLOW} does not exist.\n` +
    'The CI/CD workflow file is missing.',
  );

  const workflowLines = readFileSync(CI_WORKFLOW, 'utf8').split('\n');

  // ── 1. The script-tests job must exist ──────────────────────────────────
  const jobBlock = extractJobBlock(workflowLines, 'script-tests');
  assert.ok(
    jobBlock.length > 0,
    'ci-cd.yml no longer contains a `script-tests:` job.\n' +
    'The bash-guard subprocess tests are no longer gated by CI.\n' +
    'Restore the script-tests job to ci-cd.yml.',
  );

  // ── 2. Within the job block, a non-comment line must invoke test:scripts ─
  //
  // Filter out lines that are purely YAML comments (optional leading whitespace
  // then `#`).  This prevents a line like
  //   `# run: npm run test:scripts` (commented-out remnant)
  // or the comment added in the web-lint step from satisfying the check.
  const nonCommentJobLines = jobBlock.filter(l => !/^\s*#/.test(l));
  const hasRunStep = nonCommentJobLines.some(l => l.includes('npm run test:scripts'));

  assert.ok(
    hasRunStep,
    'The `script-tests` job in ci-cd.yml no longer has a non-comment line\n' +
    'that calls `npm run test:scripts`.\n' +
    'The bash-guard subprocess tests would not run in CI even if the job exists.\n' +
    'Restore the `run: npm run test:scripts` step inside the script-tests job.\n\n' +
    'Job block found (first 20 lines):\n' +
    jobBlock.slice(0, 20).join('\n'),
  );
});

// ── ci-cd.yml shellcheck-scripts hard-fail step presence ──────────────────────

test('ci-cd.yml shellcheck-scripts job contains the non-200 hard-fail guard step', () => {
  assert.ok(
    existsSync(CI_WORKFLOW),
    `${CI_WORKFLOW} does not exist.\n` +
    'The CI/CD workflow file is missing.',
  );

  const workflowLines = readFileSync(CI_WORKFLOW, 'utf8').split('\n');

  // ── 1. The shellcheck-scripts job must exist ─────────────────────────────
  const jobBlock = extractJobBlock(workflowLines, 'shellcheck-scripts');
  assert.ok(
    jobBlock.length > 0,
    'ci-cd.yml no longer contains a `shellcheck-scripts:` job.\n' +
    'The non-200 hard-fail guard and ShellCheck linting are no longer gated by CI.\n' +
    'Restore the shellcheck-scripts job to ci-cd.yml.',
  );

  // ── 2. Within the job block, a non-comment line must name the hard-fail step
  //
  // We check for the step name text (from `name:` lines) rather than the run
  // body so that even a cosmetic rename is caught — the sentinel text is what
  // the task document and reviewers know this step by.
  const nonCommentJobLines = jobBlock.filter(l => !/^\s*#/.test(l));
  const hasHardFailStep = nonCommentJobLines.some(
    l => l.includes('Verify != "200" catch-all branches'),
  );

  assert.ok(
    hasHardFailStep,
    'The `shellcheck-scripts` job in ci-cd.yml no longer has a non-comment line\n' +
    'containing `Verify != "200" catch-all branches`.\n' +
    'The guard that ensures every non-200 catch-all branch hard-fails (exit 1)\n' +
    'is missing from CI and would not run at PR time.\n' +
    'Restore the step named `Verify != "200" catch-all branches hard-fail (exit 1)`\n' +
    'inside the shellcheck-scripts job.\n\n' +
    'Job block found (first 20 lines):\n' +
    jobBlock.slice(0, 20).join('\n'),
  );
});

// ── ci-cd.yml web-lint job existence ─────────────────────────────────────────
//
// The web-lint job is one of the two independent enforcement layers that runs
// ci-guard-files.test.mjs.  If the entire job were deleted the direct
// invocation path (layer 1) would silently vanish; only the script-tests glob
// path (layer 2) would remain.  This test watches from OUTSIDE web-lint
// (runs via the script-tests glob) so deleting the job still fails CI.

test('ci-cd.yml contains a web-lint job (enforcement-layer canary)', () => {
  assert.ok(
    existsSync(CI_WORKFLOW),
    `${CI_WORKFLOW} does not exist.\n` +
    'The CI/CD workflow file is missing.',
  );

  const workflowLines = readFileSync(CI_WORKFLOW, 'utf8').split('\n');
  const jobBlock = extractJobBlock(workflowLines, 'web-lint');

  assert.ok(
    jobBlock.length > 0,
    'ci-cd.yml no longer contains a `web-lint:` job.\n\n' +
    'The web-lint job is an independent enforcement layer: it runs\n' +
    '`node scripts/__tests__/ci-guard-files.test.mjs` directly on every\n' +
    'push/PR, separate from the `script-tests` glob path.\n\n' +
    'Without this job the only remaining path that calls ci-guard-files.test.mjs\n' +
    'is the `script-tests` glob — a single point of failure for all the guards\n' +
    'it contains (bash-guard expansion, shellcheck-scripts coverage, composite\n' +
    'action existence, and this canary itself).\n\n' +
    'Restore the web-lint job to ci-cd.yml and ensure it contains:\n' +
    '  - name: Verify bash-guard test file exists and CI step is present\n' +
    '    run: node scripts/__tests__/ci-guard-files.test.mjs',
  );
});

// ── ci-cd.yml web-lint job direct ci-guard-files invocation ──────────────────
//
// The two-layer enforcement for shellcheck-scripts coverage depends on the
// web-lint job calling this file DIRECTLY with:
//   node scripts/__tests__/ci-guard-files.test.mjs
// If that line is removed from web-lint AND the shellcheck-scripts job is
// deleted, neither enforcement layer catches the gap.  This test closes that
// hole: it asserts the web-lint job still contains the direct invocation, so
// removing it fails CI on the very next push/PR via whatever path still runs
// this file (script-tests job, local npm run test:scripts, etc.).

test('ci-cd.yml web-lint job contains the direct node ci-guard-files.test.mjs invocation', () => {
  assert.ok(
    existsSync(CI_WORKFLOW),
    `${CI_WORKFLOW} does not exist.\n` +
    'The CI/CD workflow file is missing.',
  );

  const workflowLines = readFileSync(CI_WORKFLOW, 'utf8').split('\n');

  // ── 1. The web-lint job must exist ──────────────────────────────────────
  const jobBlock = extractJobBlock(workflowLines, 'web-lint');
  assert.ok(
    jobBlock.length > 0,
    'ci-cd.yml no longer contains a `web-lint:` job.\n' +
    'The independent enforcement layer that directly runs ci-guard-files.test.mjs\n' +
    '(separate from the script-tests job) has been removed.\n' +
    'Restore the web-lint job to ci-cd.yml.',
  );

  // ── 2. Within the job block, a non-comment line must directly invoke this
  //        guard file so the independent enforcement layer cannot be silently
  //        dropped without failing CI.
  const nonCommentJobLines = jobBlock.filter(l => !/^\s*#/.test(l));
  const hasDirectInvocation = nonCommentJobLines.some(
    l => l.includes('node scripts/__tests__/ci-guard-files.test.mjs'),
  );

  assert.ok(
    hasDirectInvocation,
    'The `web-lint` job in ci-cd.yml no longer contains a non-comment line\n' +
    'that directly invokes `node scripts/__tests__/ci-guard-files.test.mjs`.\n\n' +
    'This independent enforcement layer ensures that if the `shellcheck-scripts`\n' +
    'job is deleted, CI still catches the loss of ShellCheck coverage on every\n' +
    'push/PR via the web-lint job — regardless of whether the script-tests job\n' +
    'or its step is present.\n\n' +
    'Restore the step:\n' +
    '  - name: Verify bash-guard test file exists and CI step is present\n' +
    '    run: node scripts/__tests__/ci-guard-files.test.mjs\n' +
    'inside the web-lint job in ci-cd.yml.\n\n' +
    'Job block found (first 20 lines):\n' +
    jobBlock.slice(0, 20).join('\n'),
  );
});

// ── ci-cd.yml web-build job existence ────────────────────────────────────────
//
// The web-build job runs `npm run build:web` (Vite production build) and is
// the only CI gate that catches a broken web SPA before it lands on main and
// ships via the Cloud Run deploy.  It depends on web-lint, so if the job were
// deleted silently, broken production builds would no longer be caught.
//
// This test runs from OUTSIDE the web-build job (it is picked up by the
// script-tests glob and invoked directly in web-lint) so deleting web-build
// still fails CI on the very next push/PR.

test('ci-cd.yml contains a web-build job (production-build gate canary)', () => {
  assert.ok(
    existsSync(CI_WORKFLOW),
    `${CI_WORKFLOW} does not exist.\n` +
    'The CI/CD workflow file is missing.',
  );

  const workflowLines = readFileSync(CI_WORKFLOW, 'utf8').split('\n');
  const jobBlock = extractJobBlock(workflowLines, 'web-build');

  assert.ok(
    jobBlock.length > 0,
    'ci-cd.yml no longer contains a `web-build:` job.\n\n' +
    'The web-build job is the only CI gate that catches a broken Vite production\n' +
    'build before it lands on main and ships via the Cloud Run deploy (which\n' +
    'bundles the web SPA from dist/web/). Without this job a broken `npm run\n' +
    'build:web` would merge silently and the deployed app would serve a stale\n' +
    'or missing bundle.\n\n' +
    'Restore the web-build job to ci-cd.yml and ensure it:\n' +
    '  - is named `web-build:`\n' +
    '  - declares `needs: web-lint` (so the cheaper lint gate fails first)\n' +
    '  - contains a step that runs `npm run build:web`',
  );
});

// ── ci-cd.yml web-build job needs: web-lint dependency ───────────────────────
//
// The web-build job declares `needs: web-lint` so that the cheaper lint /
// type-check gate fails first and we don't burn an expensive Vite runner on a
// workspace that is already known-broken.  If that dependency were silently
// removed the two jobs would run in parallel — a broken build is still caught
// eventually, but with wasted runner cost and no fast-fail.  This test asserts
// the dependency is still present inside the web-build job block.

test('ci-cd.yml web-build job declares needs: web-lint', () => {
  assert.ok(
    existsSync(CI_WORKFLOW),
    `${CI_WORKFLOW} does not exist.\n` +
    'The CI/CD workflow file is missing.',
  );

  const workflowLines = readFileSync(CI_WORKFLOW, 'utf8').split('\n');

  // ── 1. The web-build job must exist ─────────────────────────────────────
  const jobBlock = extractJobBlock(workflowLines, 'web-build');
  assert.ok(
    jobBlock.length > 0,
    'ci-cd.yml no longer contains a `web-build:` job.\n' +
    'The `needs: web-lint` dependency check requires the job to exist.\n' +
    'Restore the web-build job to ci-cd.yml.',
  );

  // ── 2. Within the job block, a non-comment line must declare needs: web-lint
  //
  // Filter out comment-only lines so that a commented-out remnant like
  //   `# needs: web-lint`
  // does not satisfy the guard.
  const nonCommentJobLines = jobBlock.filter(l => !/^\s*#/.test(l));
  const hasNeedsWebLint = nonCommentJobLines.some(l => l.includes('needs: web-lint'));

  assert.ok(
    hasNeedsWebLint,
    'The `web-build` job in ci-cd.yml no longer declares `needs: web-lint`\n' +
    'on a non-comment line.\n\n' +
    'The `needs: web-lint` dependency ensures the cheaper lint/type-check gate\n' +
    'fails first so an expensive Vite production-build runner is not burned on a\n' +
    'web workspace that is already known-broken.\n\n' +
    'Removing this dependency causes web-lint and web-build to run in parallel,\n' +
    'wasting runner cost and eliminating the fast-fail ordering guarantee.\n\n' +
    'Restore `needs: web-lint` inside the web-build job definition.\n\n' +
    'Job block found (first 20 lines):\n' +
    jobBlock.slice(0, 20).join('\n'),
  );
});

// ── ci-cd.yml web-build job runs npm run build:web ───────────────────────────
//
// Asserting the job exists and has the correct `needs:` ordering is not enough:
// if the step that actually invokes `npm run build:web` were silently removed or
// renamed the job would still pass vacuously (GitHub Actions jobs with no steps
// succeed) and a broken Vite production bundle would still land on main.
// This test opens the web-build job block and asserts that at least one
// non-comment line contains the exact command `npm run build:web`.

test('ci-cd.yml web-build job contains a step that runs npm run build:web', () => {
  assert.ok(
    existsSync(CI_WORKFLOW),
    `${CI_WORKFLOW} does not exist.\n` +
    'The CI/CD workflow file is missing.',
  );

  const workflowLines = readFileSync(CI_WORKFLOW, 'utf8').split('\n');

  // ── 1. The web-build job must exist ─────────────────────────────────────
  const jobBlock = extractJobBlock(workflowLines, 'web-build');
  assert.ok(
    jobBlock.length > 0,
    'ci-cd.yml no longer contains a `web-build:` job.\n' +
    'The build-step assertion requires the job to exist.\n' +
    'Restore the web-build job to ci-cd.yml.',
  );

  // ── 2. Within the job block, a non-comment line must invoke the build ───
  //
  // Filter out lines that are purely YAML comments so that a commented-out
  // remnant like `# run: npm run build:web` does not satisfy the guard.
  const nonCommentJobLines = jobBlock.filter(l => !/^\s*#/.test(l));
  const hasBuildStep = nonCommentJobLines.some(l => l.includes('npm run build:web'));

  assert.ok(
    hasBuildStep,
    'The `web-build` job in ci-cd.yml no longer has a non-comment line\n' +
    'that calls `npm run build:web`.\n\n' +
    'Without this step the job passes vacuously — it never builds the Vite\n' +
    'production bundle, so a broken web SPA would still land on main and\n' +
    'ship via the Cloud Run deploy.\n\n' +
    'Restore a step containing `npm run build:web` inside the web-build job.\n\n' +
    'Job block found (first 20 lines):\n' +
    jobBlock.slice(0, 20).join('\n'),
  );
});

// ── root package.json build:web script existence ─────────────────────────────
//
// The CI web-build job runs `npm run build:web`.  That command resolves to
// whatever the root package.json `scripts.build:web` key says.  If someone
// renames that key (e.g. to `build:web:prod`) the CI step quietly stops doing
// anything useful, but the step itself still reads `npm run build:web` and
// the earlier CI-yml guard would still pass — because the YAML line is fine.
// This test closes that gap by asserting the key exists in root package.json
// and delegates to the web workspace.

test('root package.json has a "build:web" script that delegates to the web workspace', () => {
  const rootPkgPath = join(ROOT, 'package.json');
  assert.ok(
    existsSync(rootPkgPath),
    `${rootPkgPath} does not exist.\n` +
    'The root package.json is missing.',
  );

  let pkg;
  try {
    pkg = JSON.parse(readFileSync(rootPkgPath, 'utf8'));
  } catch (e) {
    assert.fail(`Failed to parse root package.json as JSON: ${e.message}`);
  }

  const scripts = pkg.scripts ?? {};

  assert.ok(
    Object.prototype.hasOwnProperty.call(scripts, 'build:web'),
    'root package.json does not have a "build:web" script.\n\n' +
    'The CI web-build job runs `npm run build:web`; if that key is renamed\n' +
    'the job passes vacuously (npm exits 0 with "Missing script: build:web"\n' +
    'only in npm ≥ 7 strict mode — some CI environments silently succeed).\n\n' +
    'Restore `"build:web"` to the scripts section of root package.json.\n\n' +
    `Current scripts keys: ${Object.keys(scripts).join(', ')}`,
  );

  const buildWebCmd = scripts['build:web'];
  assert.ok(
    typeof buildWebCmd === 'string' && buildWebCmd.trim().length > 0,
    'root package.json "build:web" script is empty.\n' +
    'Restore a non-empty command that triggers the Vite web production build.',
  );

  // The command must reference the web workspace (by workspace name or by
  // running the build script inside web/).  We accept any of:
  //   npm --workspace tabula-medica-web run build
  //   npm run build --workspace=tabula-medica-web
  //   npm run build -w tabula-medica-web
  //   cd web && ...
  // rather than locking to a single spelling, so that cosmetic rewrites of the
  // delegation mechanism don't false-positive — but any form must still involve
  // "web" and "build".
  const cmdLower = buildWebCmd.toLowerCase();
  const mentionsWeb = cmdLower.includes('web');
  const mentionsBuild = cmdLower.includes('build');

  assert.ok(
    mentionsWeb && mentionsBuild,
    'root package.json "build:web" script does not appear to delegate to\n' +
    'the web workspace build.\n\n' +
    `Current value: ${buildWebCmd}\n\n` +
    'The command must reference the web workspace and trigger the Vite build.\n' +
    'Example: "npm --workspace tabula-medica-web run build"',
  );
});

// ── web/package.json build script invokes vite build ─────────────────────────
//
// The root `build:web` delegates to `npm run build` inside the `web/` workspace
// (tabula-medica-web).  That workspace's `build` script must invoke `vite build`
// to produce the production bundle.  If someone renames the web-side script or
// swaps it for something that doesn't call vite, the Cloud Run deploy bundles a
// stale or missing SPA — even if both the CI YAML step and the root package.json
// delegation look correct.  This test catches that rename.

test('web/package.json has a "build" script that invokes vite build', () => {
  const webPkgPath = join(ROOT, 'web', 'package.json');
  assert.ok(
    existsSync(webPkgPath),
    `${webPkgPath} does not exist.\n` +
    'The web workspace package.json is missing.\n' +
    'Restore web/package.json with a "build" script that invokes `vite build`.',
  );

  let webPkg;
  try {
    webPkg = JSON.parse(readFileSync(webPkgPath, 'utf8'));
  } catch (e) {
    assert.fail(`Failed to parse web/package.json as JSON: ${e.message}`);
  }

  const webScripts = webPkg.scripts ?? {};

  assert.ok(
    Object.prototype.hasOwnProperty.call(webScripts, 'build'),
    'web/package.json does not have a "build" script.\n\n' +
    'The root `build:web` delegates to `npm run build` inside the web workspace.\n' +
    'If that key is absent or renamed, the Vite production bundle is never built\n' +
    'and the deployed Cloud Run app serves a stale or missing SPA.\n\n' +
    'Restore `"build"` to the scripts section of web/package.json.\n\n' +
    `Current scripts keys: ${Object.keys(webScripts).join(', ')}`,
  );

  const webBuildCmd = webScripts['build'];
  assert.ok(
    typeof webBuildCmd === 'string' && webBuildCmd.trim().length > 0,
    'web/package.json "build" script is empty.\n' +
    'Restore a non-empty command that runs `vite build`.',
  );

  // Must invoke vite (directly or via a vite sub-command).  We accept:
  //   vite build
  //   npx vite build
  //   NODE_OPTIONS=... vite build
  // but NOT arbitrary wrappers that don't call vite at all.
  assert.ok(
    webBuildCmd.includes('vite build'),
    'web/package.json "build" script does not invoke `vite build`.\n\n' +
    `Current value: ${webBuildCmd}\n\n` +
    'The web workspace build script must contain `vite build` so that renaming\n' +
    'or swapping the bundler is caught by this guard before it reaches Cloud Run.\n' +
    'Restore a command containing `vite build` (e.g. "vite build" or\n' +
    '"NODE_OPTIONS=... vite build").',
  );
});

// ── root package.json workspaces field lists the web workspace ────────────────
//
// The npm workspace delegation chain that powers `npm run build:web` depends on
// two links being intact: (1) root package.json must declare the "web" workspace
// so npm can resolve `--workspace tabula-medica-web`, and (2) web/package.json
// must exist so the workspace can be loaded.  If the workspaces entry is quietly
// removed (e.g. during a merge conflict) `npm run build:web` still has the root
// script key (guarded above) but the `--workspace tabula-medica-web` flag would
// resolve nothing and the build would silently no-op or error at runtime.
//
// This test catches that deletion: it reads the workspaces field directly and
// asserts that the "web" directory is still listed.  It is separate from the
// build-script delegation tests above so each failure mode has its own clear
// error message.

test('root package.json workspaces field lists the "web" workspace directory', () => {
  const rootPkgPath = join(ROOT, 'package.json');
  assert.ok(
    existsSync(rootPkgPath),
    `${rootPkgPath} does not exist.\n` +
    'The root package.json is missing.',
  );

  let pkg;
  try {
    pkg = JSON.parse(readFileSync(rootPkgPath, 'utf8'));
  } catch (e) {
    assert.fail(`Failed to parse root package.json as JSON: ${e.message}`);
  }

  const workspaces = pkg.workspaces;

  assert.ok(
    Array.isArray(workspaces) && workspaces.length > 0,
    'root package.json does not have a "workspaces" array (or it is empty).\n\n' +
    'The npm workspace delegation chain requires this field to resolve\n' +
    '`--workspace tabula-medica-web` when `npm run build:web` is invoked.\n\n' +
    'Restore `"workspaces": ["web"]` (or equivalent) to root package.json.\n\n' +
    `Current workspaces value: ${JSON.stringify(workspaces)}`,
  );

  // Accept both the bare directory name "web" and a glob like "web/*" or
  // "web/", so that cosmetic changes to the glob form don't false-positive.
  // The critical invariant is that "web" is referenced so npm can discover
  // the tabula-medica-web workspace package.
  const hasWeb = workspaces.some(
    (entry) => typeof entry === 'string' && entry === 'web' || (typeof entry === 'string' && entry.startsWith('web')),
  );

  assert.ok(
    hasWeb,
    'root package.json "workspaces" array no longer references the "web" workspace.\n\n' +
    'The npm workspace delegation chain (`npm run build:web` →\n' +
    '`npm --workspace tabula-medica-web run build`) depends on the "web"\n' +
    'directory being listed here so npm can discover web/package.json.\n\n' +
    'Without this entry the workspace flag resolves nothing and\n' +
    '`npm run build:web` errors at runtime even if the root script key exists.\n\n' +
    'Restore "web" (or a glob that covers it) to the workspaces array.\n\n' +
    `Current workspaces: ${JSON.stringify(workspaces)}`,
  );
});

// ── web/package.json existence and parseability (workspace-chain integrity) ───
//
// The workspace delegation guard above asserts that root package.json lists
// "web" in its workspaces field.  But if web/package.json itself is deleted
// or corrupted, npm cannot load the workspace even with the correct workspaces
// declaration — the build silently breaks.
//
// The earlier `web/package.json has a "build" script` test already checks
// file existence and JSON validity as a precondition, but keeping this as an
// independent test means: (a) the error message clearly names the workspace-
// chain breakage rather than the build-script missing, and (b) if the build-
// script test is ever refactored the existence check is not accidentally lost.

test('web/package.json exists and is parseable JSON (workspace-chain integrity)', () => {
  const webPkgPath = join(ROOT, 'web', 'package.json');

  assert.ok(
    existsSync(webPkgPath),
    `${webPkgPath} does not exist.\n\n` +
    'The npm workspace delegation chain is broken: root package.json lists\n' +
    '"web" in its workspaces field but there is no web/package.json for npm\n' +
    'to load.  `npm run build:web` will error at workspace-resolution time.\n\n' +
    'Restore web/package.json (including a "name": "tabula-medica-web" field\n' +
    'and a "build": "vite build" script) from git history.',
  );

  let webPkg;
  try {
    webPkg = JSON.parse(readFileSync(webPkgPath, 'utf8'));
  } catch (e) {
    assert.fail(
      `web/package.json exists but is not valid JSON: ${e.message}\n\n` +
      'A corrupt web/package.json breaks npm workspace resolution and\n' +
      'causes `npm run build:web` to fail at runtime.\n' +
      'Restore valid JSON content from git history.',
    );
  }

  // The workspace must have the expected npm name so that
  // `npm --workspace tabula-medica-web run build` resolves correctly.
  assert.ok(
    webPkg.name === 'tabula-medica-web',
    'web/package.json is valid JSON but its "name" field is not "tabula-medica-web".\n\n' +
    `Current name: ${JSON.stringify(webPkg.name)}\n\n` +
    'The root build:web script delegates via `npm --workspace tabula-medica-web\n' +
    'run build`.  If the workspace name changes the flag no longer matches and\n' +
    'the build fails.\n\n' +
    'Restore `"name": "tabula-medica-web"` in web/package.json, or update\n' +
    'the --workspace flag in the root "build:web" script and this guard together.',
  );
});

// ── root build:web workspace name matches web/package.json name ───────────────
//
// The root `build:web` script hard-codes the workspace name in a flag like
// `--workspace tabula-medica-web`.  If someone renames the workspace in
// web/package.json (e.g. during a branding change) but forgets to update the
// root script — or vice-versa — the delegation silently breaks: npm cannot
// resolve the flag and the Vite build never runs.
//
// The earlier `web/package.json exists` test asserts the name equals the
// hard-coded string "tabula-medica-web", which catches a rename on the
// web/package.json side.  This test closes the symmetric gap by dynamically
// extracting whichever name the root build:web command references and asserting
// it matches the actual name in web/package.json.  That way drift is caught in
// both directions without requiring this guard file itself to be updated when
// the workspace is intentionally renamed (as long as both sides are updated
// together).

test('root build:web workspace name matches web/package.json name field', () => {
  const rootPkgPath = join(ROOT, 'package.json');
  const webPkgPath  = join(ROOT, 'web', 'package.json');

  assert.ok(
    existsSync(rootPkgPath),
    `${rootPkgPath} does not exist.\nThe root package.json is missing.`,
  );
  assert.ok(
    existsSync(webPkgPath),
    `${webPkgPath} does not exist.\nThe web workspace package.json is missing.`,
  );

  let rootPkg;
  try {
    rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf8'));
  } catch (e) {
    assert.fail(`Failed to parse root package.json as JSON: ${e.message}`);
  }

  let webPkg;
  try {
    webPkg = JSON.parse(readFileSync(webPkgPath, 'utf8'));
  } catch (e) {
    assert.fail(`Failed to parse web/package.json as JSON: ${e.message}`);
  }

  const buildWebCmd = (rootPkg.scripts ?? {})['build:web'];
  assert.ok(
    typeof buildWebCmd === 'string' && buildWebCmd.trim().length > 0,
    'root package.json does not have a non-empty "build:web" script.\n' +
    'Cannot cross-validate the workspace name without it.',
  );

  // Extract the workspace name from the delegation command.  We support the
  // three common npm workspace spellings:
  //   --workspace <name>    (space-separated long flag)
  //   --workspace=<name>    (equals-separated long flag)
  //   -w <name>             (short flag)
  const workspaceMatch =
    buildWebCmd.match(/--workspace[= ](\S+)/) ||
    buildWebCmd.match(/-w[ =](\S+)/);

  assert.ok(
    workspaceMatch !== null,
    'root package.json "build:web" script does not contain a recognizable\n' +
    '`--workspace <name>` (or `-w <name>`) flag.\n\n' +
    `Current value: ${buildWebCmd}\n\n` +
    'Cannot extract the workspace name to cross-validate against web/package.json.\n' +
    'Ensure the script delegates via `npm --workspace <name> run build`.',
  );

  const workspaceNameInScript = workspaceMatch[1];
  const workspaceNameInPkg    = webPkg.name;

  assert.strictEqual(
    workspaceNameInScript,
    workspaceNameInPkg,
    `Workspace name mismatch detected:\n\n` +
    `  root package.json "build:web" references: "${workspaceNameInScript}"\n` +
    `  web/package.json "name" field declares:   "${workspaceNameInPkg}"\n\n` +
    'These must match so that `npm run build:web` correctly resolves the web\n' +
    'workspace and triggers the Vite production build.\n\n' +
    'To fix: update BOTH values together — either change the `--workspace` flag\n' +
    'in the root "build:web" script to match web/package.json "name", or change\n' +
    'web/package.json "name" to match the flag (and re-run `npm install` so npm\n' +
    'refreshes the workspace link).',
  );
});

// ── root package.json dev:web script existence ───────────────────────────────
//
// The `dev:web` key is now cross-validated (workspace name matches
// web/package.json), but the cross-validation test bails out with a
// "cannot cross-validate" message when the key is absent rather than a
// crisp "dev:web script is missing" error.  This dedicated test closes
// that gap: it asserts `scripts["dev:web"]` exists in root package.json
// and is non-empty before the workspace-name cross-validation runs, so
// failure messages are ordered from most-fundamental to most-derived.

test('root package.json has a "dev:web" script (dev server entry-point guard)', () => {
  const rootPkgPath = join(ROOT, 'package.json');
  assert.ok(
    existsSync(rootPkgPath),
    `${rootPkgPath} does not exist.\n` +
    'The root package.json is missing.',
  );

  let pkg;
  try {
    pkg = JSON.parse(readFileSync(rootPkgPath, 'utf8'));
  } catch (e) {
    assert.fail(`Failed to parse root package.json as JSON: ${e.message}`);
  }

  const scripts = pkg.scripts ?? {};

  assert.ok(
    Object.prototype.hasOwnProperty.call(scripts, 'dev:web'),
    'root package.json does not have a "dev:web" script.\n\n' +
    'The Vite dev server is started with `npm run dev:web`; if that key is\n' +
    'deleted the dev server is silently broken — contributors see an\n' +
    '"Missing script: dev:web" error and have no way to run the web client\n' +
    'locally.  The downstream workspace-name cross-validation test also\n' +
    'cannot run without this key.\n\n' +
    'Restore `"dev:web"` to the scripts section of root package.json.\n\n' +
    `Current scripts keys: ${Object.keys(scripts).join(', ')}`,
  );

  const devWebCmd = scripts['dev:web'];
  assert.ok(
    typeof devWebCmd === 'string' && devWebCmd.trim().length > 0,
    'root package.json "dev:web" script exists but is empty.\n' +
    'Restore a non-empty command that starts the Vite web dev server\n' +
    '(e.g. "npm --workspace tabula-medica-web run dev").',
  );
});

// ── root dev:web workspace name matches web/package.json name ────────────────
//
// The root `dev:web` script hard-codes the workspace name in the same
// `--workspace <name>` flag as `build:web`.  If someone updates the workspace
// name in one script but forgets the other — or renames web/package.json
// without touching either script — the dev server silently breaks while CI
// stays green (the build:web guard passes, the dev:web flag now resolves
// nothing).
//
// This test closes that symmetric gap by extracting the workspace name from
// the root dev:web command and asserting it equals the actual name in
// web/package.json, using the same regex as the build:web guard above.

test('root dev:web workspace name matches web/package.json name field', () => {
  const rootPkgPath = join(ROOT, 'package.json');
  const webPkgPath  = join(ROOT, 'web', 'package.json');

  assert.ok(
    existsSync(rootPkgPath),
    `${rootPkgPath} does not exist.\nThe root package.json is missing.`,
  );
  assert.ok(
    existsSync(webPkgPath),
    `${webPkgPath} does not exist.\nThe web workspace package.json is missing.`,
  );

  let rootPkg;
  try {
    rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf8'));
  } catch (e) {
    assert.fail(`Failed to parse root package.json as JSON: ${e.message}`);
  }

  let webPkg;
  try {
    webPkg = JSON.parse(readFileSync(webPkgPath, 'utf8'));
  } catch (e) {
    assert.fail(`Failed to parse web/package.json as JSON: ${e.message}`);
  }

  const devWebCmd = (rootPkg.scripts ?? {})['dev:web'];
  assert.ok(
    typeof devWebCmd === 'string' && devWebCmd.trim().length > 0,
    'root package.json does not have a non-empty "dev:web" script.\n' +
    'Cannot cross-validate the workspace name without it.',
  );

  // Extract the workspace name using the same three-spelling regex as build:web:
  //   --workspace <name>    (space-separated long flag)
  //   --workspace=<name>    (equals-separated long flag)
  //   -w <name>             (short flag)
  const workspaceMatch =
    devWebCmd.match(/--workspace[= ](\S+)/) ||
    devWebCmd.match(/-w[ =](\S+)/);

  assert.ok(
    workspaceMatch !== null,
    'root package.json "dev:web" script does not contain a recognizable\n' +
    '`--workspace <name>` (or `-w <name>`) flag.\n\n' +
    `Current value: ${devWebCmd}\n\n` +
    'Cannot extract the workspace name to cross-validate against web/package.json.\n' +
    'Ensure the script delegates via `npm --workspace <name> run dev`.',
  );

  const workspaceNameInScript = workspaceMatch[1];
  const workspaceNameInPkg    = webPkg.name;

  assert.strictEqual(
    workspaceNameInScript,
    workspaceNameInPkg,
    `Workspace name mismatch detected between "dev:web" script and web/package.json:\n\n` +
    `  root package.json "dev:web" references: "${workspaceNameInScript}"\n` +
    `  web/package.json "name" field declares: "${workspaceNameInPkg}"\n\n` +
    'These must match so that `npm run dev:web` correctly resolves the web\n' +
    'workspace and starts the Vite dev server.\n\n' +
    'To fix: update BOTH values together — either change the `--workspace` flag\n' +
    'in the root "dev:web" script to match web/package.json "name", or change\n' +
    'web/package.json "name" to match the flag (and re-run `npm install` so npm\n' +
    'refreshes the workspace link).\n\n' +
    'Also ensure "build:web" uses the same workspace name so both scripts stay\n' +
    'in sync.',
  );
});

// ── ci-cd.yml web-lint job dev:web smoke-test step ───────────────────────────
//
// Unlike `build:web` (guarded by the web-build job), there is no CI gate that
// actually RUNS the Vite dev server.  A broken import or bad vite.config.ts
// change could crash `npm run dev:web` while all other guards stay green
// because they only exercise the production build path.  The `web-lint` job
// contains a step named "Smoke-test Vite dev server starts (dev:web)" that
// starts the dev server under a `timeout` and waits for Vite's ready banner.
//
// These two tests close the same two-gap pattern used for other critical steps:
//   1. The named step still exists in the web-lint job (catches step deletion).
//   2. The run: line still invokes `dev:web` (catches the step being hollowed
//      out or its command renamed to something that doesn't exercise the path).

test('ci-cd.yml web-lint job contains the Smoke-test Vite dev server step', () => {
  assert.ok(
    existsSync(CI_WORKFLOW),
    `${CI_WORKFLOW} does not exist.\n` +
    'The CI/CD workflow file is missing.',
  );

  const workflowLines = readFileSync(CI_WORKFLOW, 'utf8').split('\n');

  // ── 1. The web-lint job must exist ──────────────────────────────────────
  const jobBlock = extractJobBlock(workflowLines, 'web-lint');
  assert.ok(
    jobBlock.length > 0,
    'ci-cd.yml no longer contains a `web-lint:` job.\n' +
    'The Vite dev-server smoke-test step lives inside that job.\n' +
    'Restore the web-lint job to ci-cd.yml.',
  );

  // ── 2. Within the job block, a non-comment name: line must name the step
  const nonCommentJobLines = jobBlock.filter(l => !/^\s*#/.test(l));
  const hasSmokeName = nonCommentJobLines.some(
    l => l.includes('Smoke-test Vite dev server starts'),
  );

  assert.ok(
    hasSmokeName,
    'The `web-lint` job in ci-cd.yml no longer contains a non-comment line\n' +
    'with `Smoke-test Vite dev server starts`.\n\n' +
    'A broken import or bad vite.config.ts change could crash `npm run dev:web`\n' +
    'while the production-build gate (web-build job) stays green, because that\n' +
    'gate only exercises `vite build`, not `vite` (dev mode).\n\n' +
    'Restore the step named `Smoke-test Vite dev server starts (dev:web)` inside\n' +
    'the web-lint job.  The step must start the dev server under a `timeout` and\n' +
    'wait for Vite\'s "ready in" startup line so broken dev configs fail CI\n' +
    'before they can merge.\n\n' +
    'Job block found (first 20 lines):\n' +
    jobBlock.slice(0, 20).join('\n'),
  );
});

test('ci-cd.yml web-lint job Smoke-test Vite dev server step invokes dev:web', () => {
  assert.ok(
    existsSync(CI_WORKFLOW),
    `${CI_WORKFLOW} does not exist.\n` +
    'The CI/CD workflow file is missing.',
  );

  const workflowLines = readFileSync(CI_WORKFLOW, 'utf8').split('\n');

  // ── 1. The web-lint job must exist ──────────────────────────────────────
  const jobBlock = extractJobBlock(workflowLines, 'web-lint');
  assert.ok(
    jobBlock.length > 0,
    'ci-cd.yml no longer contains a `web-lint:` job.\n' +
    'The Vite dev-server smoke-test step lives inside that job.\n' +
    'Restore the web-lint job to ci-cd.yml.',
  );

  // ── 2. Within the job block, a non-comment run: line must invoke dev:web ─
  //
  // Filter out lines that are purely YAML comments so a commented-out remnant
  // like `# run: npm run dev:web` does not satisfy the guard.
  const nonCommentJobLines = jobBlock.filter(l => !/^\s*#/.test(l));
  const hasDevWebRun = nonCommentJobLines.some(l => l.includes('dev:web'));

  assert.ok(
    hasDevWebRun,
    'The `web-lint` job in ci-cd.yml no longer has a non-comment line\n' +
    'that invokes `dev:web` inside the Vite dev-server smoke-test step.\n\n' +
    'Without this invocation the step passes vacuously and a broken Vite dev\n' +
    'server config (e.g. a bad import in vite.config.ts) would merge silently.\n\n' +
    'Restore a run: line containing `dev:web` inside the\n' +
    '`Smoke-test Vite dev server starts (dev:web)` step of the web-lint job.\n' +
    'The command must start the Vite dev server and verify it reaches its ready\n' +
    'state before a timeout kills it (e.g.:\n' +
    '  timeout 30 bash -c \'npm run dev:web 2>&1 | grep -m1 "ready in\\|Local:"\').\n\n' +
    'Job block found (first 20 lines):\n' +
    jobBlock.slice(0, 20).join('\n'),
  );
});

// ── package-lock.json workspace name matches web/package.json name ────────────
//
// npm records the workspace package name inside package-lock.json under
// `packages["web"].name`.  If someone renames `web/package.json` `name` and
// re-runs `npm install`, npm rewrites this entry.  But if they forget to run
// `npm install`, the lockfile still carries the old name — and the next CI run
// that calls `npm ci` or `npm install` will install a symlink under the OLD
// name, so `npm run build:web` (which passes `--workspace <new-name>`) fails
// at workspace-resolution time with "No workspaces found".
//
// This test catches that stale-lockfile state by comparing the `name` field
// that npm recorded in the lockfile against the live `web/package.json` name.
// Any mismatch means the lockfile is out-of-date and `npm install` must be
// re-run before the build will succeed.

test('package-lock.json workspace entry name matches web/package.json name (stale-install guard)', () => {
  const lockfilePath = join(ROOT, 'package-lock.json');
  const webPkgPath   = join(ROOT, 'web', 'package.json');

  assert.ok(
    existsSync(lockfilePath),
    `${lockfilePath} does not exist.\n` +
    'The package-lock.json is missing — run `npm install` to generate it.',
  );
  assert.ok(
    existsSync(webPkgPath),
    `${webPkgPath} does not exist.\n` +
    'The web workspace package.json is missing.',
  );

  let lockfile;
  try {
    lockfile = JSON.parse(readFileSync(lockfilePath, 'utf8'));
  } catch (e) {
    assert.fail(`Failed to parse package-lock.json as JSON: ${e.message}`);
  }

  let webPkg;
  try {
    webPkg = JSON.parse(readFileSync(webPkgPath, 'utf8'));
  } catch (e) {
    assert.fail(`Failed to parse web/package.json as JSON: ${e.message}`);
  }

  // npm v7+ (lockfileVersion 2+) stores workspace metadata under
  // packages["web"] — the key is the workspace directory path.
  const packages = lockfile.packages ?? {};
  assert.ok(
    Object.prototype.hasOwnProperty.call(packages, 'web'),
    'package-lock.json does not contain a `packages["web"]` entry.\n\n' +
    'npm records workspace metadata under this key when you run `npm install`.\n' +
    'Its absence means either the lockfile is very old (lockfileVersion < 2)\n' +
    'or `npm install` has never been run in this repo.\n\n' +
    'Run `npm install` to generate the workspace entry.',
  );

  const lockfileWorkspaceName = packages['web'].name;
  const webPkgName = webPkg.name;

  assert.ok(
    typeof lockfileWorkspaceName === 'string' && lockfileWorkspaceName.trim().length > 0,
    'package-lock.json `packages["web"].name` is missing or empty.\n\n' +
    'npm normally sets this to the workspace package name when `npm install` runs.\n' +
    'Run `npm install` to refresh the lockfile.',
  );

  assert.strictEqual(
    lockfileWorkspaceName,
    webPkgName,
    `Stale npm install detected — workspace name mismatch between lockfile and source:\n\n` +
    `  package-lock.json packages["web"].name: "${lockfileWorkspaceName}"\n` +
    `  web/package.json "name" field:          "${webPkgName}"\n\n` +
    'This means web/package.json was renamed after the last `npm install`.\n' +
    'npm will install a symlink under the OLD name, so `npm run build:web`\n' +
    'fails with "No workspaces found: --workspace <new-name>".\n\n' +
    'Fix: run `npm install` to refresh package-lock.json and the node_modules\n' +
    'workspace symlink, then commit the updated lockfile.',
  );
});

// ── node_modules workspace symlink exists for the declared web package name ───
//
// Even with a correct lockfile, `npm ci` (used in most CI environments) may not
// have been run yet in the local environment, or someone may have manually
// deleted / not-committed the symlink.  This test checks the *installed* state
// directly: it asserts that `node_modules/<workspace-name>` exists as a
// symbolic link pointing into the `web/` directory.
//
// If the workspace was renamed and `npm install` was NOT re-run:
//   - `node_modules/<old-name>` still exists (stale symlink)
//   - `node_modules/<new-name>` does NOT exist
// Running `npm run build:web` then fails because the `--workspace <new-name>`
// flag can't be resolved.  This test catches that gap before the build runs.

test('node_modules/<web-workspace-name> symlink exists and resolves to web/ (stale-install guard)', () => {
  const webPkgPath   = join(ROOT, 'web', 'package.json');
  const nodeModules  = join(ROOT, 'node_modules');

  assert.ok(
    existsSync(webPkgPath),
    `${webPkgPath} does not exist.\n` +
    'The web workspace package.json is missing.',
  );

  let webPkg;
  try {
    webPkg = JSON.parse(readFileSync(webPkgPath, 'utf8'));
  } catch (e) {
    assert.fail(`Failed to parse web/package.json as JSON: ${e.message}`);
  }

  const webPkgName = webPkg.name;
  assert.ok(
    typeof webPkgName === 'string' && webPkgName.trim().length > 0,
    'web/package.json "name" field is missing or empty.\n' +
    'npm cannot create a workspace symlink without a package name.',
  );

  const symlinkPath = join(nodeModules, webPkgName);

  assert.ok(
    existsSync(symlinkPath),
    `node_modules/${webPkgName} does not exist.\n\n` +
    'npm creates a symlink at this path when `npm install` resolves the\n' +
    `"${webPkgName}" workspace from web/package.json.\n\n` +
    'Its absence means either:\n' +
    '  (a) `npm install` has not been run since web/package.json was renamed, or\n' +
    '  (b) `npm install` has never been run in this checkout.\n\n' +
    `\`npm run build:web\` (--workspace ${webPkgName}) will fail with\n` +
    '"No workspaces found" until the symlink is created.\n\n' +
    'Fix: run `npm install` to create the workspace symlink, then verify\n' +
    `\`node_modules/${webPkgName}\` points to the web/ directory.`,
  );

  // Also verify the symlink actually points into the web/ directory so that a
  // dangling or mis-targeted symlink doesn't silently pass.
  const stat = lstatSync(symlinkPath);
  assert.ok(
    stat.isSymbolicLink() || stat.isDirectory(),
    `node_modules/${webPkgName} exists but is neither a symlink nor a directory.\n` +
    'Expected npm to have created a workspace symlink here.\n' +
    'Run `npm install` to recreate the workspace link.',
  );

  let realTarget;
  try {
    realTarget = realpathSync(symlinkPath);
  } catch (e) {
    assert.fail(
      `node_modules/${webPkgName} exists but its target cannot be resolved: ${e.message}\n` +
      'The workspace symlink is dangling (points to a non-existent path).\n' +
      'Run `npm install` to recreate the workspace link.',
    );
  }

  const expectedTarget = join(ROOT, 'web');
  assert.strictEqual(
    realTarget,
    expectedTarget,
    `node_modules/${webPkgName} exists but does not point to web/.\n\n` +
    `  Symlink resolves to: ${realTarget}\n` +
    `  Expected target:     ${expectedTarget}\n\n` +
    'The workspace symlink points to the wrong directory.\n' +
    'Run `npm install` to recreate the correct workspace link.',
  );
});

// ── .github/actions/assert-required-checks/action.yml existence ───────────────

test('.github/actions/assert-required-checks/action.yml exists on disk', () => {
  assert.ok(
    existsSync(COMPOSITE_ACTION),
    `${COMPOSITE_ACTION} does not exist.\n` +
    'The composite GitHub Action that gates every required-checks job has been\n' +
    'deleted or renamed. Four CI jobs delegate to this file; without it all four\n' +
    'gate checks error out at runtime with "uses: path does not exist".\n' +
    'Restore .github/actions/assert-required-checks/action.yml from git history.',
  );
});

test('.github/actions/assert-required-checks/action.yml has non-empty content', () => {
  if (!existsSync(COMPOSITE_ACTION)) {
    assert.fail(
      `${COMPOSITE_ACTION} does not exist — see the previous test for details.`,
    );
  }

  const size = statSync(COMPOSITE_ACTION).size;
  assert.ok(
    size > 0,
    `${COMPOSITE_ACTION} exists but is empty (0 bytes).\n` +
    'The composite action file must contain the required-checks assertion logic.\n' +
    'Restore the original content from git history.',
  );

  const content = readFileSync(COMPOSITE_ACTION, 'utf8').trim();
  assert.ok(
    content.length > 0,
    `${COMPOSITE_ACTION} exists but contains only whitespace.\n` +
    'The composite action file must contain the required-checks assertion logic.',
  );

  // Verify the file still looks like a real composite action definition —
  // not a stub that was left behind after the logic was gutted.
  assert.ok(
    content.includes('runs:'),
    `${COMPOSITE_ACTION} exists but does not contain a "runs:" key.\n` +
    'The file does not appear to be a valid GitHub composite action.\n' +
    'Restore the original content from git history.',
  );
});

// ── dev-web-smoke-test.test.mjs existence ─────────────────────────────────────
//
// scripts/__tests__/dev-web-smoke-test.test.mjs is the mutation test that
// verifies the Vite dev-server smoke-test step actually FAILS when
// web/vite.config.ts has a broken import.  If the file is silently deleted,
// the CI structural guards (which only assert the YAML step exists) would still
// pass — nothing would catch a hollowed-out or inverted smoke command.
//
// This canary watches from ci-guard-files.test.mjs, which is picked up by BOTH
// enforcement layers (web-lint direct invocation + script-tests glob), so a
// deletion of dev-web-smoke-test.test.mjs fails CI on the very next push/PR.

test('scripts/__tests__/dev-web-smoke-test.test.mjs exists on disk', () => {
  const filePath = join(TESTS_DIR, 'dev-web-smoke-test.test.mjs');
  assert.ok(
    existsSync(filePath),
    `${filePath} does not exist.\n\n` +
    'The mutation test that verifies the Vite dev-server smoke-test FAILS on a\n' +
    'broken vite.config.ts has been removed.\n\n' +
    'Without this file, only structural guards remain: they confirm the CI YAML\n' +
    'step exists, but they cannot catch a hollowed-out or inverted smoke command\n' +
    'that silently succeeds on a broken Vite config.\n\n' +
    'Restore scripts/__tests__/dev-web-smoke-test.test.mjs from git history.',
  );
});

test('scripts/__tests__/dev-web-smoke-test.test.mjs has non-empty content with test() calls', () => {
  const filePath = join(TESTS_DIR, 'dev-web-smoke-test.test.mjs');

  if (!existsSync(filePath)) {
    assert.fail(
      `${filePath} does not exist — see the previous test for details.`,
    );
  }

  const size = statSync(filePath).size;
  assert.ok(
    size > 0,
    `${filePath} exists but is empty (0 bytes).\n` +
    'The mutation test file must contain the broken-import mutation test.\n' +
    'Restore the original content from git history.',
  );

  const content = readFileSync(filePath, 'utf8').trim();
  assert.ok(
    content.length > 0,
    `${filePath} exists but contains only whitespace.\n` +
    'The mutation test file must contain the broken-import mutation test.',
  );

  assert.ok(
    content.includes('test('),
    `${filePath} exists but does not contain any test() calls.\n` +
    'The file appears to have been stubbed out. Restore the original test content.',
  );

  // The file must still reference the sentinel broken-import string so that
  // someone who replaces the mutation test with a no-op stub is caught.
  assert.ok(
    content.includes('tabula-medica-smoke-test-broken-import'),
    `${filePath} exists and has test() calls but no longer references the\n` +
    'broken-import sentinel string "tabula-medica-smoke-test-broken-import".\n\n' +
    'The mutation test may have been replaced with a stub that does not actually\n' +
    'inject a bad import — it would then pass trivially without exercising the\n' +
    'failure path.\n\n' +
    'Restore the original broken-import mutation test content from git history.',
  );

  // The file must contain the CI guard that throws when CI=true and vite is
  // absent.  Without this guard the two t.skip() paths silently swallow a
  // missing-web-deps condition in CI, allowing a real Vite regression to pass
  // undetected.  This assertion prevents the guard from being silently removed.
  assert.ok(
    content.includes("process.env.CI === 'true'"),
    `${filePath} no longer contains the CI guard (process.env.CI === 'true').\n\n` +
    'The guard throws at module-load time when CI=true and vite is absent,\n' +
    'preventing the two t.skip() paths from silently hiding a broken web-deps\n' +
    'install in CI.  Without it, a missing vite binary in CI produces a quiet\n' +
    '"2 skipped" result instead of a loud failure, allowing a real Vite\n' +
    'regression to pass undetected.\n\n' +
    'Restore the CI guard from git history.',
  );
});

// ── Forward-looking guard: all environment-dependent t.skip() calls must have a CI guard ──
//
// Any test file in scripts/__tests__/ that uses t.skip() conditioned on a
// binary or env-var check represents a hidden CI risk: if the binary install
// step is dropped or the env-var is never set in CI, the skip fires silently
// ("N skipped") instead of failing loudly.  This is the same class of invisible
// regression that originally motivated the Vite guard in
// dev-web-smoke-test.test.mjs.
//
// Detection heuristic:
//   A file is "environment-dependent" if it contains BOTH:
//     (a) t.skip( — a runtime skip controlled by some condition, AND
//     (b) existsSync( — a binary/file presence check that typically drives (a)
//
// Files matching both must also contain the CI guard pattern:
//   process.env.CI === 'true'
// which causes the file to throw at module-load time (before any test runs)
// when CI is true and the environment condition is absent — surfacing the
// infrastructure failure loudly instead of silently skipping tests.
//
// This test runs as part of BOTH enforcement layers (web-lint direct invocation
// and the script-tests glob), so adding a new test file with an environment-
// dependent skip but no CI guard fails CI on the very next push/PR.
//
// HOW TO FIX (when this test fails for a new file):
//   Add a module-load-time guard in the new test file, following the pattern
//   in dev-web-smoke-test.test.mjs:
//
//     const binaryInstalled = existsSync('/path/to/binary');
//
//     if (!binaryInstalled && process.env.CI === 'true') {
//       throw new Error(
//         'CI=true but <binary> is absent.\n\n' +
//         'The skip in this file is intended for local dev environments only.\n' +
//         'In CI the dependency is always installed, so the skip must never fire.\n' +
//         'Its presence in CI indicates a broken install step.\n\n' +
//         'Fix: ensure the install step completes before this test suite runs.',
//       );
//     }
//
//   Then use t.skip() inside the test body (not at module level), guarded by
//   the same boolean:
//
//     test('my env-dependent test', (t) => {
//       if (!binaryInstalled) {
//         t.skip('SKIP: binary not installed — install deps to run this test');
//         return;
//       }
//       // ... actual test body ...
//     });

test('every test file with an environment-dependent t.skip() also contains the CI guard (process.env.CI === \'true\')', () => {
  // Collect all *.test.mjs files in TESTS_DIR, excluding this file itself
  // (ci-guard-files.test.mjs references the guard pattern in its own assertions
  // but does not use t.skip(), so it must not appear in the violations list).
  const THIS_FILE = 'ci-guard-files.test.mjs';
  const testFiles = readdirSync(TESTS_DIR)
    .filter(name => name.endsWith('.test.mjs') && name !== THIS_FILE)
    .map(name => join(TESTS_DIR, name));

  // A file is "environment-dependent" if it satisfies BOTH conditions:
  //   (a) contains t.skip( — has at least one runtime-conditional skip, AND
  //   (b) contains existsSync( — uses file/binary presence checks
  //
  // Both conditions are required to avoid false-positives on files that use
  // existsSync only for test setup (checking files exist before reading them)
  // without any environment-conditional skips.
  const CI_GUARD_PATTERN = "process.env.CI === 'true'";
  const violations = [];

  for (const filePath of testFiles) {
    const content = readFileSync(filePath, 'utf8');
    const hasTSkip     = content.includes('t.skip(');
    const hasExistsSync = content.includes('existsSync(');

    if (hasTSkip && hasExistsSync && !content.includes(CI_GUARD_PATTERN)) {
      violations.push(filePath.replace(ROOT + '/', ''));
    }
  }

  assert.strictEqual(
    violations.length,
    0,
    `${violations.length} test file(s) in scripts/__tests__/ contain an\n` +
    'environment-dependent t.skip() (uses both t.skip() and existsSync()) but\n' +
    `are missing the CI guard (${CI_GUARD_PATTERN}).\n\n` +
    'Without the guard, if the binary install step is dropped in CI or the\n' +
    'dependency is never set up, the test silently skips ("N skipped") instead\n' +
    'of failing loudly — exactly the class of invisible regression this guard\n' +
    'pattern was designed to catch.\n\n' +
    `Affected file(s):\n${violations.map(f => `  - ${f}`).join('\n')}\n\n` +
    'Fix: add a module-load-time CI guard to each affected file:\n\n' +
    '  const binaryInstalled = existsSync(\'/path/to/binary\');\n\n' +
    "  if (!binaryInstalled && process.env.CI === 'true') {\n" +
    "    throw new Error(\n" +
    "      'CI=true but <binary> is absent.\\n\\n' +\n" +
    "      'The skip is intended for local dev environments only.\\n' +\n" +
    "      'In CI the dependency is always installed, so the skip must never fire.\\n' +\n" +
    "      'Fix: ensure the install step completes before this test suite runs.',\n" +
    '    );\n' +
    '  }\n\n' +
    'See dev-web-smoke-test.test.mjs (lines 50-79) for the reference implementation.',
  );
});

// ── Forward-looking guard: env-var-dependent t.skip() calls must have a CI guard ─
//
// A second common pattern for environment-dependent skips is checking a missing
// environment variable instead of a missing binary file.  For example:
//
//   if (!process.env.DATABASE_URL) { t.skip('no DATABASE_URL'); return; }
//   if (!process.env.SOME_SECRET)  { t.skip('secret not configured'); return; }
//
// If the required env-var is accidentally removed from CI secrets or omitted from
// the job's `env:` mapping, the test silently skips ("N skipped") in CI instead
// of failing loudly — the same invisible regression that the binary-check guard
// above was designed to catch.
//
// Detection heuristic:
//   A file is "env-var-dependent" if it contains BOTH:
//     (a) t.skip( — a runtime skip controlled by some condition, AND
//     (b) process.env. — a reference to an environment variable (potential skip
//         condition) that is NOT the CI guard pattern itself
//
// Files matching both must ALSO contain the CI guard pattern:
//   process.env.CI === 'true'
// which causes the file to throw at module-load time when CI=true and the
// required env-var is absent — surfacing the infrastructure failure loudly
// instead of silently skipping tests.
//
// Note: a file that already contains the CI guard also contains "process.env.",
// so the check is: hasTSkip && hasProcessEnv && !hasCIGuard.  Files with the
// guard already in place are NOT flagged.
//
// HOW TO FIX (when this test fails for a new file):
//   Add a module-load-time guard in the new test file, following the pattern
//   in dev-web-smoke-test.test.mjs:
//
//     const requiredEnvVar = process.env.MY_REQUIRED_VAR;
//
//     if (!requiredEnvVar && process.env.CI === 'true') {
//       throw new Error(
//         'CI=true but MY_REQUIRED_VAR is absent.\n\n' +
//         'The skip in this file is intended for local dev environments only.\n' +
//         'In CI the env-var must be set via the job env: mapping or CI secrets.\n' +
//         'Its absence in CI means the secret was removed or the env: mapping was\n' +
//         'dropped — exactly the class of invisible regression this guard catches.\n\n' +
//         'Fix: restore MY_REQUIRED_VAR to the CI job env: block or secrets.',
//       );
//     }
//
//   Then use t.skip() inside the test body (not at module level), guarded by
//   the same boolean:
//
//     test('my env-var-dependent test', (t) => {
//       if (!requiredEnvVar) {
//         t.skip('SKIP: MY_REQUIRED_VAR not set — configure the env-var to run this test');
//         return;
//       }
//       // ... actual test body ...
//     });

test('every test file with an env-var-dependent t.skip() also contains the CI guard (process.env.CI === \'true\')', () => {
  // Collect all *.test.mjs files in TESTS_DIR, excluding:
  //   - ci-guard-files.test.mjs (this file): references process.env. in its own
  //     assertions but does not use t.skip() conditioned on an env-var.
  //   - ci-env-skip-mutation.test.mjs: contains process.env. and t.skip() inside
  //     the TEMPLATE STRING LITERALS it uses to build temp test files for mutation
  //     testing.  The file itself does not skip on any env-var — all mutation tests
  //     run unconditionally.  The static text scan cannot distinguish an env-var
  //     reference inside a template string from one that drives a real skip.
  const THIS_FILE = 'ci-guard-files.test.mjs';
  const MUTATION_FILE = 'ci-env-skip-mutation.test.mjs';
  const testFiles = readdirSync(TESTS_DIR)
    .filter(name => name.endsWith('.test.mjs') && name !== THIS_FILE && name !== MUTATION_FILE)
    .map(name => join(TESTS_DIR, name));

  // A file is "env-var-dependent" if it satisfies BOTH conditions:
  //   (a) contains t.skip( — has at least one runtime-conditional skip, AND
  //   (b) contains process.env. — references an environment variable that could
  //       be the skip condition
  //
  // If the file already contains the CI guard (process.env.CI === 'true') it
  // is compliant — NOT flagged.  The guard itself references process.env., but
  // the check short-circuits on !hasCIGuard so compliant files are excluded.
  const CI_GUARD_PATTERN = "process.env.CI === 'true'";
  const violations = [];

  for (const filePath of testFiles) {
    const content = readFileSync(filePath, 'utf8');
    const hasTSkip      = content.includes('t.skip(');
    const hasProcessEnv = content.includes('process.env.');

    if (hasTSkip && hasProcessEnv && !content.includes(CI_GUARD_PATTERN)) {
      violations.push(filePath.replace(ROOT + '/', ''));
    }
  }

  assert.strictEqual(
    violations.length,
    0,
    `${violations.length} test file(s) in scripts/__tests__/ contain an\n` +
    'env-var-dependent t.skip() (uses both t.skip() and process.env.) but\n' +
    `are missing the CI guard (${CI_GUARD_PATTERN}).\n\n` +
    'Without the guard, if the required env-var is accidentally removed from CI\n' +
    "secrets or dropped from the job's env: mapping, the test silently skips\n" +
    '("N skipped") instead of failing loudly — the same invisible regression\n' +
    'that the binary-check guard pattern was designed to catch.\n\n' +
    `Affected file(s):\n${violations.map(f => `  - ${f}`).join('\n')}\n\n` +
    'Fix: add a module-load-time CI guard to each affected file:\n\n' +
    '  const requiredEnvVar = process.env.MY_REQUIRED_VAR;\n\n' +
    "  if (!requiredEnvVar && process.env.CI === 'true') {\n" +
    "    throw new Error(\n" +
    "      'CI=true but MY_REQUIRED_VAR is absent.\\n\\n' +\n" +
    "      'The skip is intended for local dev environments only.\\n' +\n" +
    "      'In CI the env-var must be set via the job env: mapping or CI secrets.\\n' +\n" +
    "      'Fix: restore MY_REQUIRED_VAR to the CI job env: block or secrets.',\n" +
    '    );\n' +
    '  }\n\n' +
    'See dev-web-smoke-test.test.mjs (lines 50-79) for the reference implementation.',
  );
});

// ── ci-env-skip-mutation.test.mjs existence ───────────────────────────────────
//
// scripts/__tests__/ci-env-skip-mutation.test.mjs is the runtime mutation test
// that verifies the CI guard on env-var-dependent t.skip() calls actually works:
//   - guarded file + CI=true + env-var absent  → exits non-zero (guard threw)
//   - unguarded file + CI=true + env-var absent → exits zero (silent failure)
//   - guarded file + CI=true + env-var present  → exits zero (normal operation)
//   - guarded file + CI not set + env-var absent → exits zero (local dev skip)
//
// The static scan in this file (the two forward-looking guard tests above) only
// detects the pattern textually — it cannot catch subtler variants where the
// env-var check is inside a helper function or derived from multiple variables.
// The runtime mutation test closes that gap.
//
// This canary watches from ci-guard-files.test.mjs, which is picked up by BOTH
// enforcement layers (web-lint direct invocation + script-tests glob), so a
// deletion of ci-env-skip-mutation.test.mjs fails CI on the very next push/PR.

test('scripts/__tests__/ci-env-skip-mutation.test.mjs exists on disk', () => {
  const filePath = join(TESTS_DIR, 'ci-env-skip-mutation.test.mjs');
  assert.ok(
    existsSync(filePath),
    `${filePath} does not exist.\n\n` +
    'The runtime mutation test that verifies the CI guard on env-var-dependent\n' +
    't.skip() calls has been removed.\n\n' +
    'Without this file, only the static text scan remains: it confirms the\n' +
    'guard pattern is present in the file, but it cannot catch subtler variants\n' +
    'where the env-var check is inside a helper function, imported from another\n' +
    'module, or derived from multiple variables — the class of invisible\n' +
    'regression that the runtime mutation test was designed to catch.\n\n' +
    'Restore scripts/__tests__/ci-env-skip-mutation.test.mjs from git history.',
  );
});

test('scripts/__tests__/ci-env-skip-mutation.test.mjs has non-empty content with test() calls', () => {
  const filePath = join(TESTS_DIR, 'ci-env-skip-mutation.test.mjs');

  if (!existsSync(filePath)) {
    assert.fail(
      `${filePath} does not exist — see the previous test for details.`,
    );
  }

  const size = statSync(filePath).size;
  assert.ok(
    size > 0,
    `${filePath} exists but is empty (0 bytes).\n` +
    'The runtime mutation test file must contain the guarded/unguarded pattern\n' +
    'mutation tests.\n' +
    'Restore the original content from git history.',
  );

  const content = readFileSync(filePath, 'utf8').trim();
  assert.ok(
    content.length > 0,
    `${filePath} exists but contains only whitespace.\n` +
    'The runtime mutation test file must contain the mutation tests.',
  );

  assert.ok(
    content.includes('test('),
    `${filePath} exists but does not contain any test() calls.\n` +
    'The file appears to have been stubbed out. Restore the original test content.',
  );

  // The file must still reference the sentinel template strings so that
  // someone who replaces the mutation tests with no-op stubs is caught.
  assert.ok(
    content.includes('TABULA-MEDICA-CI-GUARD-MUTATION'),
    `${filePath} exists and has test() calls but no longer references the\n` +
    'template sentinel string "TABULA-MEDICA-CI-GUARD-MUTATION".\n\n' +
    'The mutation tests may have been replaced with stubs that do not actually\n' +
    'write guarded/unguarded test templates and run them as subprocesses — they\n' +
    'would then pass trivially without exercising any real guard behavior.\n\n' +
    'Restore the original mutation test content from git history.',
  );

  // The file must reference the sentinel env-var name so that the template
  // contents are non-trivial and actually test the guard behavior.
  assert.ok(
    content.includes('TABULA_MEDICA_CI_GUARD_MUTATION_SENTINEL'),
    `${filePath} exists but no longer references the sentinel env-var\n` +
    '"TABULA_MEDICA_CI_GUARD_MUTATION_SENTINEL".\n\n' +
    'The mutation tests use this sentinel env-var in the guarded/unguarded\n' +
    'templates to simulate the env-var-absent condition.  Without it the\n' +
    'templates cannot exercise the guard pattern.\n\n' +
    'Restore the original sentinel env-var reference from git history.',
  );

  // The file must contain the helper-fn template sentinel so that the indirect
  // skip pattern (env-var check inside a helper function) is covered at runtime.
  assert.ok(
    content.includes('TABULA-MEDICA-CI-GUARD-MUTATION: helper-fn template'),
    `${filePath} exists but no longer contains the sentinel string\n` +
    '"TABULA-MEDICA-CI-GUARD-MUTATION: helper-fn template".\n\n' +
    'The HELPER_FN_TEMPLATE variant (env-var check delegated to a helper function)\n' +
    'may have been removed or its sentinel comment stripped.  Without it the runtime\n' +
    'mutation tests for the indirect skip pattern (tests E-G) cannot run, and the\n' +
    'static scan gap for helper-function env-var checks is no longer covered.\n\n' +
    'Restore the HELPER_FN_TEMPLATE constant and its sentinel comment from git history.',
  );

  // The unguarded helper-fn counterpart proves tests E-G prevent a real silent skip.
  assert.ok(
    content.includes('TABULA-MEDICA-CI-GUARD-MUTATION: unguarded helper-fn template'),
    `${filePath} exists but no longer contains the sentinel string\n` +
    '"TABULA-MEDICA-CI-GUARD-MUTATION: unguarded helper-fn template".\n\n' +
    'The UNGUARDED_HELPER_FN_TEMPLATE variant (helper-function skip with no CI guard)\n' +
    'may have been removed or its sentinel comment stripped. Without it mutation test Q\n' +
    'cannot prove the silent failure is real for the helper-function pattern, so tests E-G\n' +
    'lose the validation that their guards exit non-zero for a meaningful reason.\n\n' +
    'Restore the UNGUARDED_HELPER_FN_TEMPLATE constant and its sentinel comment from git history.',
  );

  // The file must contain the multi-var template sentinel so that the multi-env-var
  // skip pattern (skip derived from !A || !B) is covered at runtime.
  assert.ok(
    content.includes('TABULA-MEDICA-CI-GUARD-MUTATION: multi-var template'),
    `${filePath} exists but no longer contains the sentinel string\n` +
    '"TABULA-MEDICA-CI-GUARD-MUTATION: multi-var template".\n\n' +
    'The MULTI_VAR_TEMPLATE variant (skip condition derived from multiple env-vars)\n' +
    'may have been removed or its sentinel comment stripped.  Without it the runtime\n' +
    'mutation tests for multi-var skip patterns (tests H-K) cannot run, and the\n' +
    'static scan gap for OR-combined env-var checks is no longer covered.\n\n' +
    'Restore the MULTI_VAR_TEMPLATE constant and its sentinel comment from git history.',
  );

  // The file must contain the bool-derived template sentinel so that the indirect
  // boolean pattern (const skip = !process.env.X; if (skip) t.skip()) is covered
  // at runtime.
  assert.ok(
    content.includes('TABULA-MEDICA-CI-GUARD-MUTATION: bool-derived template'),
    `${filePath} exists but no longer contains the sentinel string\n` +
    '"TABULA-MEDICA-CI-GUARD-MUTATION: bool-derived template".\n\n' +
    'The BOOL_DERIVED_TEMPLATE variant (skip condition stored in an intermediate\n' +
    'boolean before the t.skip() call) may have been removed or its sentinel comment\n' +
    'stripped.  Without it the runtime mutation tests for the bool-derived pattern\n' +
    '(tests L-N) cannot run, and the final indirect-skip gap is no longer covered\n' +
    'at runtime — only the static text scan would remain.\n\n' +
    'Restore the BOOL_DERIVED_TEMPLATE constant and its sentinel comment from git history.',
  );

  // The file must contain the unguarded bool-derived template sentinel so that
  // mutation test O can prove the silent failure is real for the bool-derived
  // variant — validating that tests L-N are exercising real guard behavior.
  assert.ok(
    content.includes('TABULA-MEDICA-CI-GUARD-MUTATION: unguarded bool-derived template'),
    `${filePath} exists but no longer contains the sentinel string\n` +
    '"TABULA-MEDICA-CI-GUARD-MUTATION: unguarded bool-derived template".\n\n' +
    'The UNGUARDED_BOOL_DERIVED_TEMPLATE variant (bool-derived skip with no CI guard)\n' +
    'may have been removed or its sentinel comment stripped.  Without it mutation test O\n' +
    'cannot prove the silent failure is real for the bool-derived pattern, so tests L-N\n' +
    'lose the validation that their guards are doing real work (i.e. that they exit\n' +
    'non-zero for a meaningful reason, not by accident).\n\n' +
    'Restore the UNGUARDED_BOOL_DERIVED_TEMPLATE constant and its sentinel comment from git history.',
  );

  // The file must contain the unguarded multi-var template sentinel so that
  // mutation test P can prove the silent failure is real for the multi-var
  // variant — validating that tests H-K are exercising real guard behavior.
  assert.ok(
    content.includes('TABULA-MEDICA-CI-GUARD-MUTATION: unguarded multi-var template'),
    `${filePath} exists but no longer contains the sentinel string\n` +
    '"TABULA-MEDICA-CI-GUARD-MUTATION: unguarded multi-var template".\n\n' +
    'The UNGUARDED_MULTI_VAR_TEMPLATE variant (multi-var OR-combined skip with no CI guard)\n' +
    'may have been removed or its sentinel comment stripped.  Without it mutation test P\n' +
    'cannot prove the silent failure is real for the multi-var pattern, so tests H-K\n' +
    'lose the validation that their guards are doing real work (i.e. that they exit\n' +
    'non-zero for a meaningful reason, not by accident).\n\n' +
    'Restore the UNGUARDED_MULTI_VAR_TEMPLATE constant and its sentinel comment from git history.',
  );
});
